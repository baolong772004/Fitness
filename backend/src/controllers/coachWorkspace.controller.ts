import type { Response } from 'express';
import prisma from '../config/prisma.js';
import type { AuthRequest } from '../middlewares/auth.middleware.js';
import { presentWorkoutPlan } from '../services/workoutPlan.service.js';
import { generateCoachPlanWithGemini } from '../services/geminiPlan.service.js';
import { emitUserNotification } from '../sockets/ptChat.socket.js';
import { assignStudentPlan, normalizePlanDraft, presentStudentPlan, studentPlanInclude, hasValidTrainingRelation } from '../services/studentWorkoutPlan.service.js';
import { workoutPlanResponseError } from './studentWorkoutPlan.controller.js';
import { walletSummary } from '../services/ptWallet.service.js';
import { activeCoachPtLevel } from '../services/ptTraining.service.js';


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
        package: { select: { name: true, totalPtSessions: true, ptLevel: true } },
        user: {
          select: {
            id: true, fullName: true, phone: true, email: true, avatar: true,
            gender: true, dateOfBirth: true, height: true, weight: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    const now = new Date();
    const bookings = await prisma.booking.findMany({ where: { coachId, type: 'PT',
      status: { in: ['CONFIRMED', 'IN_PROGRESS', 'MAKEUP_BOOKED'] }, endTime: { gt: now } },
      include: { member: { select: { id: true, fullName: true, phone: true, email: true,
        avatar: true, gender: true, dateOfBirth: true, height: true, weight: true } },
        ptCreditAllocation: { include: { batch: { select: { level: true } } } },
        membership: { include: { package: { select: { ptLevel: true } } } } },
      orderBy: { startTime: 'desc' } });
    const latestByMember = new Map<number, typeof bookings[number]>();
    for (const booking of bookings) if (!latestByMember.has(booking.memberId)) latestByMember.set(booking.memberId, booking);
    const walletTrainees = await Promise.all([...latestByMember.values()].map(async booking => {
      const wallet = await walletSummary(prisma, booking.memberId);
      return { id: -booking.id, userId: booking.memberId, user: booking.member,
        startDate: booking.startTime, endDate: booking.endTime,
        remainingSessions: wallet.available, status: booking.status,
        level: booking.ptCreditAllocation?.batch.level ?? booking.membership?.package.ptLevel ?? null,
        package: { name: 'PT Credit', totalPtSessions: wallet.total } };
    }));
    const assignedBatches = await prisma.ptCreditBatch.findMany({ where: {
      coachId, source: { in: ['PACKAGE_PURCHASE', 'SINGLE_PURCHASE'] },
      OR: [{ startAt: null }, { startAt: { lte: now } }],
      AND: [{ OR: [{ endAt: null }, { endAt: { gt: now } }] }],
    }, include: { wallet: { include: { member: { select: { id: true, fullName: true, phone: true,
      email: true, avatar: true, gender: true, dateOfBirth: true, height: true, weight: true } } } } },
      orderBy: { grantedAt: 'desc' } });
    const seenAssignedMembers = new Set<number>();
    const assignedTrainees = assignedBatches.filter(batch => {
      if (batch.initialCount <= batch.usedCount || latestByMember.has(batch.wallet.memberId) ||
        seenAssignedMembers.has(batch.wallet.memberId)) return false;
      seenAssignedMembers.add(batch.wallet.memberId);
      return true;
    }).map(batch => ({
      id: -batch.id, userId: batch.wallet.memberId, user: batch.wallet.member,
      startDate: batch.startAt ?? batch.grantedAt, endDate: batch.endAt ?? batch.grantedAt,
      remainingSessions: batch.initialCount - batch.usedCount - batch.heldCount,
      status: 'ACTIVE', level: batch.level,
      package: { name: 'PT Paid', totalPtSessions: batch.initialCount },
    }));
    return res.json({ success: true, data: [
      ...walletTrainees, ...assignedTrainees, ...memberships.filter(item =>
        item.status === 'ACTIVE' && item.endDate > now && !latestByMember.has(item.userId) &&
        !assignedTrainees.some(batch => batch.userId === item.userId)).map(item => ({
        ...item, level: item.package.ptLevel,
      })),
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
    const [plans, studentPlans] = await Promise.all([prisma.workoutPlan.findMany({
      where: { coachId, memberId: null },
      orderBy: { createdAt: 'desc' },
    }), prisma.studentWorkoutPlan.findMany({ where: { coachId }, include: studentPlanInclude,
      orderBy: { updatedAt: 'desc' } })]);
    return res.json({ success: true, data: [
      ...plans.map(plan => ({ ...presentWorkoutPlan(plan), kind: 'TEMPLATE', member: null })),
      ...studentPlans.map(presentStudentPlan),
    ] });
  } catch (error) {
    return workoutPlanResponseError(error, res);
  }
}

export async function createCoachPlan(req: AuthRequest, res: Response) {
  const coachId = req.user?.userId;
  if (!coachId) return res.status(401).json({ success: false, message: 'Chưa đăng nhập' });
  const rawMemberId = req.body?.memberId;
  const memberId = rawMemberId === undefined || rawMemberId === null || rawMemberId === '' ? null : Number(rawMemberId);
  if (memberId !== null && (!Number.isSafeInteger(memberId) || memberId <= 0)) return res.status(400).json({ success: false, message: 'Học viên không hợp lệ' });
  try {
    const content = normalizePlanDraft(req.body ?? {});
    if (memberId !== null) {
      const result = await prisma.$transaction(tx => assignStudentPlan(tx, { coachId, memberId, content, programName: req.body?.programName }));
      emitUserNotification(memberId, result.notification);
      return res.status(201).json({ success: true, message: 'Đã gán giáo án', data: result.plan });
    }
    const plan = await prisma.workoutPlan.create({
      data: { coachId, memberId: null, ...content },
    });
    return res.status(201).json({ success: true, message: 'Đã lưu giáo án mẫu', data: { ...presentWorkoutPlan(plan), kind: 'TEMPLATE', member: null } });
  } catch (error) {
    return workoutPlanResponseError(error, res);
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
    let trainingContext = null;
    if (memberId !== null) {
      if (!await hasValidTrainingRelation(prisma, coachId, memberId)) return res.status(403).json({ success: false, message: 'Học viên không có quan hệ PT còn hiệu lực với Coach này.' });
      member = await prisma.user.findUnique({ where: { id: memberId },
        select: { fullName: true, gender: true, dateOfBirth: true, height: true, weight: true } });
      if (!member) return res.status(404).json({ success: false, message: 'Học viên không tồn tại.' });
      const level = await activeCoachPtLevel(prisma, coachId, memberId);
      if (level) {
        const baseline = await prisma.ptTrainingAssessment.findFirst({
          where: { memberId, coachId, level, kind: 'BASELINE' }, orderBy: { createdAt: 'desc' },
        });
        if (!baseline) return res.status(409).json({ success: false, message: 'Cần đánh giá PT đầu vào trước khi tạo giáo án riêng.' });
        const [latest, latestGoal] = await Promise.all([
          prisma.ptTrainingAssessment.findFirst({ where: { memberId, coachId, level }, orderBy: { createdAt: 'desc' } }),
          prisma.ptTrainingAssessment.findFirst({ where: { memberId, coachId, level, goal: { not: null } },
            orderBy: { createdAt: 'desc' }, select: { goal: true } }),
        ]);
        trainingContext = { level, goal: latestGoal?.goal ?? baseline.goal, movementNotes: latest?.movementNotes ?? baseline.movementNotes,
          metricName: latest?.metricName, metricValue: latest?.metricValue,
          phaseName: latest?.phaseName, nextSteps: latest?.nextSteps };
      }
    }
    const plan = await generateCoachPlanWithGemini(member, req.body?.request ?? '', trainingContext);
    return res.json({ success: true, data: plan });
  } catch (error) {
    console.error('Lỗi tạo giáo án AI:', error);
    const message = error instanceof Error ? error.message : 'Không thể tạo giáo án bằng AI.';
    return res.status(message.includes('GEMINI_API_KEY') ? 503 : 400).json({ success: false, message });
  }
}
