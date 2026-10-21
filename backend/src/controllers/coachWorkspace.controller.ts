import type { Response } from 'express';
import prisma from '../config/prisma.js';
import type { AuthRequest } from '../middlewares/auth.middleware.js';
import { normalizeWorkoutPlanContent, presentWorkoutPlan } from '../services/workoutPlan.service.js';
import { generateCoachPlanWithGemini } from '../services/geminiPlan.service.js';
import { createUserNotification } from '../services/notification.service.js';
import { walletSummary } from '../services/ptWallet.service.js';


const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export async function getCoachWorkspace(req: AuthRequest, res: Response) {
  const coachId = req.user?.userId;
  if (!coachId) return res.status(401).json({ success: false, message: 'Chưa đăng nhập' });
  try {
    const profile = await prisma.coachProfile.findUnique({
      where: { userId: coachId },
      include: {
        user: { select: { id: true, fullName: true, email: true, phone: true, avatar: true } },
        schedules: { orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }] },
        specializations: { select: { level: true } },
      },
    });
    if (!profile) return res.status(404).json({ success: false, message: 'Coach chưa được quản trị viên tạo hồ sơ PT' });
    return res.json({ success: true, data: profile });
  } catch (error) {
    console.error('Lỗi tải hồ sơ Coach:', error);
    return res.status(500).json({ success: false, message: 'Không thể tải hồ sơ Coach' });
  }
}

export async function getCoachTrainees(req: AuthRequest, res: Response) {
  const coachId = req.user?.userId;
  if (!coachId) return res.status(401).json({ success: false, message: 'Chưa đăng nhập' });
  try {
    const memberships = await prisma.membership.findMany({
      where: { coachId, package: { type: 'PT' } },
      select: {
        id: true,
        userId: true,
        startDate: true,
        endDate: true,
        remainingSessions: true,
        status: true,
        package: { select: { name: true, totalPtSessions: true } },
        user: {
          select: {
            id: true, fullName: true, phone: true, email: true, avatar: true,
            gender: true, dateOfBirth: true, height: true, weight: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    const bookings = await prisma.booking.findMany({ where: { coachId, type: 'PT',
      status: { in: ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'MAKEUP_BOOKED'] } },
      include: { member: { select: { id: true, fullName: true, phone: true, email: true,
        avatar: true, gender: true, dateOfBirth: true, height: true, weight: true } } },
      orderBy: { startTime: 'desc' } });
    const latestByMember = new Map<number, typeof bookings[number]>();
    for (const booking of bookings) if (!latestByMember.has(booking.memberId)) latestByMember.set(booking.memberId, booking);
    const walletTrainees = await Promise.all([...latestByMember.values()].map(async booking => {
      const wallet = await walletSummary(prisma, booking.memberId);
      return { id: -booking.id, userId: booking.memberId, user: booking.member,
        startDate: booking.startTime, endDate: booking.endTime,
        remainingSessions: wallet.available, status: booking.status,
        package: { name: 'PT Credit', totalPtSessions: wallet.total } };
    }));
    return res.json({ success: true, data: [
      ...walletTrainees, ...memberships.filter(item => !latestByMember.has(item.userId)),
    ] });
  } catch (error) {
    console.error('Lỗi tải học viên Coach:', error);
    return res.status(500).json({ success: false, message: 'Không thể tải học viên PT' });
  }
}

export async function updateCoachAvailability(req: AuthRequest, res: Response) {
  const coachId = req.user?.userId;
  if (!coachId) return res.status(401).json({ success: false, message: 'Chưa đăng nhập' });

  const schedules = req.body?.schedules;
  if (!Array.isArray(schedules) || schedules.length > 28) {
    return res.status(400).json({ success: false, message: 'schedules phải là mảng tối đa 28 ca' });
  }
  const normalized: Array<{ dayOfWeek: number; startTime: string; endTime: string; isAvailable: boolean }> = [];
  for (const row of schedules) {
    const dayOfWeek = Number(row?.dayOfWeek);
    const startTime = row?.startTime;
    const endTime = row?.endTime;
    if (!Number.isInteger(dayOfWeek) || dayOfWeek < 1 || dayOfWeek > 7 ||
        typeof startTime !== 'string' || !timePattern.test(startTime) ||
        typeof endTime !== 'string' || !timePattern.test(endTime) || endTime <= startTime ||
        (row?.isAvailable !== undefined && typeof row.isAvailable !== 'boolean')) {
      return res.status(400).json({ success: false, message: 'Mỗi ca cần thứ 2–Chủ nhật và giờ HH:mm hợp lệ' });
    }
    normalized.push({ dayOfWeek, startTime, endTime, isAvailable: row.isAvailable ?? true });
  }
  for (const [index, row] of normalized.entries()) {
    if (normalized.some((other, otherIndex) => otherIndex !== index && other.dayOfWeek === row.dayOfWeek &&
        row.startTime < other.endTime && other.startTime < row.endTime)) {
      return res.status(400).json({ success: false, message: 'Các ca cùng ngày không được chồng giờ' });
    }
  }

  try {
    const profile = await prisma.coachProfile.findUnique({ where: { userId: coachId } });
    if (!profile || profile.status === 'BLOCKED') {
      return res.status(403).json({ success: false, message: 'Hồ sơ Coach không thể cập nhật lịch' });
    }
    const result = await prisma.$transaction(async (tx) => {
      await tx.coachSchedule.deleteMany({ where: { coachProfileId: profile.id } });
      if (normalized.length > 0) {
        await tx.coachSchedule.createMany({
          data: normalized.map(row => ({ ...row, coachProfileId: profile.id })),
        });
      }
      return tx.coachSchedule.findMany({
        where: { coachProfileId: profile.id },
        orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
      });
    });
    return res.json({ success: true, message: 'Đã lưu lịch rảnh', data: result });
  } catch (error) {
    console.error('Lỗi lưu lịch Coach:', error);
    return res.status(500).json({ success: false, message: 'Không thể lưu lịch rảnh' });
  }
}

export async function getCoachPlans(req: AuthRequest, res: Response) {
  const coachId = req.user?.userId;
  if (!coachId) return res.status(401).json({ success: false, message: 'Chưa đăng nhập' });
  try {
    const plans = await prisma.workoutPlan.findMany({
      where: { coachId },
      include: { member: { select: { id: true, fullName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return res.json({ success: true, data: plans.map(presentWorkoutPlan) });
  } catch (error) {
    console.error('Lỗi tải giáo án Coach:', error);
    return res.status(500).json({ success: false, message: 'Không thể tải giáo án' });
  }
}

export async function createCoachPlan(req: AuthRequest, res: Response) {
  const coachId = req.user?.userId;
  if (!coachId) return res.status(401).json({ success: false, message: 'Chưa đăng nhập' });
  const rawMemberId = req.body?.memberId;
  const memberId = rawMemberId === undefined || rawMemberId === null || rawMemberId === '' ? null : Number(rawMemberId);
  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
  const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
  if ((memberId !== null && (!Number.isSafeInteger(memberId) || memberId <= 0)) || !title || title.length > 200 || description.length > 5000) {
    return res.status(400).json({ success: false, message: 'Tiêu đề và nội dung giáo án không hợp lệ' });
  }
  let content: ReturnType<typeof normalizeWorkoutPlanContent>;
  try {
    content = normalizeWorkoutPlanContent(req.body ?? {});
  } catch (error) {
    return res.status(400).json({ success: false, message: error instanceof Error ? error.message : 'Nội dung giáo án không hợp lệ' });
  }
  try {
    if (memberId !== null) {
      const assigned = await prisma.membership.findFirst({
        where: { userId: memberId, coachId, package: { type: 'PT' } },
        select: { id: true },
      });
      const activeBooking = await prisma.booking.findFirst({ where: { memberId, coachId, type: 'PT',
        status: { in: ['CONFIRMED', 'IN_PROGRESS'] }, endTime: { gt: new Date() } }, select: { id: true } });
      if (!assigned && !activeBooking) return res.status(403).json({ success: false, message: 'Học viên không thuộc Coach này' });
    }
    const plan = await prisma.workoutPlan.create({
      data: { coachId, memberId, title, description, ...content },
      include: { member: { select: { id: true, fullName: true } } },
    });
    if (memberId !== null) {
      await createUserNotification({
        userId: memberId,
        title: 'Bạn có giáo án PT mới',
        message: `HLV đã giao giáo án "${title}" cho bạn. Mở mục PT & Tiến độ cá nhân để xem.`,
      });
    }
    return res.status(201).json({ success: true, message: 'Đã lưu giáo án', data: presentWorkoutPlan(plan) });
  } catch (error) {
    console.error('Lỗi lưu giáo án Coach:', error);
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2011') {
      return res.status(409).json({
        success: false,
        message: 'Cơ sở dữ liệu chưa cập nhật để lưu giáo án mẫu. Hãy chạy `npx prisma migrate deploy` trong thư mục backend rồi thử lại.',
      });
    }
    return res.status(500).json({ success: false, message: 'Không thể lưu giáo án' });
  }
}

export async function generateCoachPlan(req: AuthRequest, res: Response) {
  const coachId = req.user?.userId;
  if (!coachId) return res.status(401).json({ success: false, message: 'Chưa đăng nhập' });
  const rawMemberId = req.body?.memberId;
  const memberId = rawMemberId === undefined || rawMemberId === null || rawMemberId === '' ? null : Number(rawMemberId);
  if (memberId !== null && (!Number.isSafeInteger(memberId) || memberId <= 0)) {
    return res.status(400).json({ success: false, message: 'Học viên không hợp lệ.' });
  }
  try {
    let member = null;
    if (memberId !== null) {
      const membership = await prisma.membership.findFirst({
        where: { userId: memberId, coachId, package: { type: 'PT' } },
        select: { user: { select: { fullName: true, gender: true, dateOfBirth: true, height: true, weight: true } } },
      });
      const booking = await prisma.booking.findFirst({ where: { memberId, coachId, type: 'PT',
        status: { in: ['CONFIRMED', 'IN_PROGRESS'] }, endTime: { gt: new Date() } },
        select: { member: { select: { fullName: true, gender: true, dateOfBirth: true,
          height: true, weight: true } } } });
      if (!membership && !booking) return res.status(403).json({ success: false, message: 'Học viên không thuộc Coach này.' });
      member = membership?.user ?? booking!.member;
    }
    const plan = await generateCoachPlanWithGemini(member, req.body?.request ?? '');
    return res.json({ success: true, data: plan });
  } catch (error) {
    console.error('Lỗi tạo giáo án AI:', error);
    const message = error instanceof Error ? error.message : 'Không thể tạo giáo án bằng AI.';
    return res.status(message.includes('GEMINI_API_KEY') ? 503 : 400).json({ success: false, message });
  }
}
