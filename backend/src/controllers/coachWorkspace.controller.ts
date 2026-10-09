import type { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import type { AuthRequest } from '../middlewares/auth.middleware.js';

const prisma = new PrismaClient();
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
    return res.json({ success: true, data: memberships });
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
    return res.json({ success: true, data: plans });
  } catch (error) {
    console.error('Lỗi tải giáo án Coach:', error);
    return res.status(500).json({ success: false, message: 'Không thể tải giáo án' });
  }
}

export async function createCoachPlan(req: AuthRequest, res: Response) {
  const coachId = req.user?.userId;
  if (!coachId) return res.status(401).json({ success: false, message: 'Chưa đăng nhập' });
  const memberId = Number(req.body?.memberId);
  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
  const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
  if (!Number.isSafeInteger(memberId) || memberId <= 0 || !title || title.length > 200 || description.length > 5000) {
    return res.status(400).json({ success: false, message: 'Cần học viên, tiêu đề và nội dung giáo án hợp lệ' });
  }
  try {
    const assigned = await prisma.membership.findFirst({
      where: { userId: memberId, coachId, package: { type: 'PT' } },
      select: { id: true },
    });
    if (!assigned) return res.status(403).json({ success: false, message: 'Học viên không thuộc Coach này' });
    const plan = await prisma.workoutPlan.create({
      data: { coachId, memberId, title, description },
      include: { member: { select: { id: true, fullName: true } } },
    });
    return res.status(201).json({ success: true, message: 'Đã lưu giáo án', data: plan });
  } catch (error) {
    console.error('Lỗi lưu giáo án Coach:', error);
    return res.status(500).json({ success: false, message: 'Không thể lưu giáo án' });
  }
}
