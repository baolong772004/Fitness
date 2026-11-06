import type { Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../config/prisma.js';
import type { AuthRequest } from '../middlewares/auth.middleware.js';
import { lockPtCalendar, lockPtCoach, lockPtMember, PtBookingError } from '../services/ptBooking.service.js';
import { releasePtCredit } from '../services/ptWallet.service.js';
import { createUserNotification } from '../services/notification.service.js';
import { emitCoachScheduleChanged, emitUserNotification } from '../sockets/ptChat.socket.js';
import { hasValidTrainingRelation } from '../services/studentWorkoutPlan.service.js';
import { requireQualifiedPtCoach } from '../services/ptCoachEligibility.service.js';
import { planPackageCoachTransfer, protectedOldCoachSlot } from '../services/ptPackageCoachTransfer.service.js';

const bookingTime = (value: Date) => value.toLocaleString('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit',
  day: '2-digit', month: '2-digit', year: 'numeric',
});

async function transferCoach(tx: Prisma.TransactionClient, input: {
  batchId: number; memberId: number; oldCoachId: number; newCoachId: number; actorId: number;
}) {
  const changed = await tx.ptCreditBatch.updateMany({
    where: { id: input.batchId, coachId: input.oldCoachId }, data: { coachId: input.newCoachId },
  });
  if (changed.count !== 1) throw new PtBookingError(409, 'Coach của gói PT vừa thay đổi. Vui lòng tải lại.');
  const plans = await tx.studentWorkoutPlan.findMany({
    where: { memberId: input.memberId, coachId: input.oldCoachId, status: 'ACTIVE' },
  });
  const oldCoachStillAssigned = await hasValidTrainingRelation(tx, input.oldCoachId, input.memberId);
  for (const plan of plans) {
    if (!oldCoachStillAssigned) await tx.studentWorkoutPlan.updateMany({ where: { id: plan.id, status: 'ACTIVE' }, data: { status: 'ARCHIVED' } });
    const existingNewPlan = await tx.studentWorkoutPlan.findFirst({ where: {
      memberId: input.memberId, coachId: input.newCoachId, programName: plan.programName, status: 'ACTIVE',
    } });
    if (existingNewPlan && existingNewPlan.updatedAt >= plan.updatedAt) continue;
    await tx.studentWorkoutPlan.updateMany({ where: {
      memberId: input.memberId, coachId: input.newCoachId, programName: plan.programName, status: 'ACTIVE',
    }, data: { status: 'ARCHIVED' } });
    await tx.studentWorkoutPlan.create({ data: {
      memberId: input.memberId, coachId: input.newCoachId, programName: plan.programName,
      title: plan.title, description: plan.description,
      sessionsJson: plan.sessionsJson, mealsJson: plan.mealsJson,
      revisions: { create: { version: 1, title: plan.title, description: plan.description,
        sessionsJson: plan.sessionsJson, mealsJson: plan.mealsJson, changedById: input.actorId,
        reason: `Chuyển giao giáo án từ Coach #${input.oldCoachId}` } },
    } });
  }
}

function fail(res: Response, error: unknown) {
  if (error instanceof PtBookingError) return res.status(error.status).json({ success: false, message: error.message });
  if ((error as { code?: string })?.code === 'P2002') return res.status(409).json({ success: false, message: 'Gói PT đã có yêu cầu đổi Coach đang chờ xử lý.' });
  console.error('PT coach change failed:', error);
  return res.status(500).json({ success: false, message: 'Không thể xử lý yêu cầu đổi Coach.' });
}

export async function listMyCoachChanges(req: AuthRequest, res: Response) {
  const memberId = req.user?.userId;
  if (!memberId) return res.status(401).json({ success: false });
  const data = await prisma.ptCoachChangeRequest.findMany({ where: { memberId },
    orderBy: { requestedAt: 'desc' }, take: 50 });
  return res.json({ success: true, data });
}

export async function listPendingCoachChanges(_req: AuthRequest, res: Response) {
  const requests = await prisma.ptCoachChangeRequest.findMany({ where: { status: 'PENDING_ADMIN' },
    include: { batch: { select: { level: true, source: true } } },
    orderBy: { requestedAt: 'asc' }, take: 100 });
  const ids = [...new Set(requests.flatMap(item => [item.memberId, item.oldCoachId, item.newCoachId]))];
  const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, fullName: true } });
  const names = new Map(users.map(item => [item.id, item.fullName]));
  const data = requests.map(item => ({ ...item, memberName: names.get(item.memberId) ?? `#${item.memberId}`,
    oldCoachName: names.get(item.oldCoachId) ?? `#${item.oldCoachId}`,
    newCoachName: names.get(item.newCoachId) ?? `#${item.newCoachId}` }));
  return res.json({ success: true, data });
}

export async function requestCoachChange(req: AuthRequest, res: Response) {
  const memberId = req.user?.userId;
  const batchId = Number(req.body?.batchId);
  const newCoachId = Number(req.body?.newCoachId);
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
  if (!memberId) return res.status(401).json({ success: false });
  if (!Number.isSafeInteger(batchId) || batchId <= 0 || !Number.isSafeInteger(newCoachId) || newCoachId <= 0 ||
    !reason || reason.length > 500) return res.status(400).json({ success: false, message: 'Chọn gói, Coach mới và nhập lý do tối đa 500 ký tự.' });
  try {
    const initialBatch = await prisma.ptCreditBatch.findFirst({ where: { id: batchId, wallet: { memberId } },
      select: { coachId: true } });
    if (!initialBatch?.coachId) throw new PtBookingError(404, 'Không tìm thấy gói PT có Coach phụ trách.');
    const result = await prisma.$transaction(async tx => {
      await lockPtCalendar(tx);
      for (const coachId of [initialBatch.coachId!, newCoachId].sort((a, b) => a - b)) await lockPtCoach(tx, coachId);
      await lockPtMember(tx, memberId);
      const batch = await tx.ptCreditBatch.findFirst({ where: { id: batchId, wallet: { memberId } } });
      if (batch?.coachId !== initialBatch.coachId) throw new PtBookingError(409, 'Coach của gói PT vừa thay đổi. Vui lòng tải lại.');
      const now = new Date();
      if (!batch || batch.source !== 'PACKAGE_PURCHASE' || batch.initialCount <= 1 ||
        batch.initialCount <= batch.usedCount || (batch.startAt && batch.startAt > now) ||
        (batch.endAt && batch.endAt <= now)) {
        throw new PtBookingError(403, 'Chỉ gói PT Paid nhiều buổi còn hiệu lực mới được yêu cầu đổi Coach.');
      }
      if (!batch.coachId || batch.coachId === newCoachId) throw new PtBookingError(409, 'Gói chưa có Coach phụ trách hoặc Coach mới trùng Coach hiện tại.');
      const oldProfile = await tx.coachProfile.findUnique({ where: { userId: batch.coachId },
        select: { status: true, user: { select: { status: true } } } });
      await requireQualifiedPtCoach(tx, newCoachId, batch.level, 403);
      const quotaExempt = !oldProfile || oldProfile.status !== 'ACTIVE' || oldProfile.user.status !== 'ACTIVE';
      const usedChanges = await tx.ptCoachChangeRequest.count({ where: { batchId, status: 'APPROVED', quotaExempt: false } });
      if (!quotaExempt && usedChanges >= 1) throw new PtBookingError(409, 'Gói PT đã sử dụng quyền đổi Coach theo yêu cầu.');
      const pending = await tx.ptCoachChangeRequest.findFirst({ where: { batchId, status: 'PENDING_ADMIN' } });
      if (pending) throw new PtBookingError(409, 'Gói PT đã có yêu cầu đổi Coach đang chờ Admin.');
      const change = await tx.ptCoachChangeRequest.create({ data: {
        batchId, memberId, oldCoachId: batch.coachId, newCoachId, reason,
        status: 'PENDING_ADMIN', quotaExempt,
      } });
      await tx.actionLog.create({ data: { userId: memberId, action: 'PT_COACH_CHANGE_REQUEST',
        details: JSON.stringify({ scope: 'PACKAGE_COACH_CHANGE', batchId,
          oldCoachId: batch.coachId, newCoachId, status: 'PENDING_ADMIN', reason }) } });
      return change;
    }, { maxWait: 15000, timeout: 30000 });
    await Promise.allSettled([memberId, result.oldCoachId, result.newCoachId].map(userId => createUserNotification({
      userId, title: 'Yêu cầu đổi Coach PT',
      message: 'Yêu cầu đổi HLV gói PT đang chờ Admin duyệt. Quyền học bù được xử lý riêng.',
    })));
    return res.status(201).json({ success: true, data: result });
  } catch (error) { return fail(res, error); }
}

export async function previewCoachChange(req: AuthRequest, res: Response) {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0)
    return res.status(400).json({ success: false, message: 'Yêu cầu đổi HLV không hợp lệ.' });
  try {
    const data = await prisma.$transaction(async tx => {
      const request = await tx.ptCoachChangeRequest.findUnique({ where: { id } });
      if (!request || request.status !== 'PENDING_ADMIN')
        throw new PtBookingError(409, 'Yêu cầu không còn chờ Admin duyệt.');
      const batch = await tx.ptCreditBatch.findUniqueOrThrow({ where: { id: request.batchId } });
      if (batch.coachId !== request.oldCoachId)
        throw new PtBookingError(409, 'HLV của gói PT vừa thay đổi.');
      return planPackageCoachTransfer(tx, request, batch);
    });
    return res.json({ success: true, data });
  } catch (error) { return fail(res, error); }
}

export async function resolveCoachChange(req: AuthRequest, res: Response) {
  const id = Number(req.params.id);
  const decision = req.body?.decision;
  const adminNote = typeof req.body?.adminNote === 'string' ? req.body.adminNote.trim() : '';
  const previewToken = typeof req.body?.previewToken === 'string' ? req.body.previewToken : '';
  const actorId = req.user?.userId;
  if (!actorId) return res.status(401).json({ success: false });
  if (!Number.isSafeInteger(id) || id <= 0 || !['APPROVED', 'REJECTED'].includes(decision) ||
    adminNote.length > 500) {
    return res.status(400).json({ success: false, message: 'Quyết định hoặc ghi chú không hợp lệ.' });
  }
  if (decision === 'APPROVED' && !/^[a-f0-9]{64}$/.test(previewToken))
    return res.status(400).json({ success: false,
      message: 'Cần xem trước lịch PT và xác nhận kết quả trước khi duyệt.' });
  try {
    const result = await prisma.$transaction(async tx => {
      const initial = await tx.ptCoachChangeRequest.findUnique({ where: { id } });
      if (!initial) throw new PtBookingError(404, 'Không tìm thấy yêu cầu đổi Coach.');
      await lockPtCalendar(tx);
      for (const coachId of [initial.oldCoachId, initial.newCoachId].sort((a, b) => a - b)) await lockPtCoach(tx, coachId);
      await lockPtMember(tx, initial.memberId);
      const request = await tx.ptCoachChangeRequest.findUniqueOrThrow({ where: { id } });
      if (request.status !== 'PENDING_ADMIN') throw new PtBookingError(409, 'Yêu cầu đã được xử lý.');
      const batch = await tx.ptCreditBatch.findUniqueOrThrow({ where: { id: request.batchId } });
      if (batch.coachId !== request.oldCoachId) throw new PtBookingError(409, 'Coach của gói PT đã thay đổi.');
      let summary: Awaited<ReturnType<typeof planPackageCoachTransfer>> | null = null;
      if (decision === 'APPROVED') {
        const now = new Date();
        if (batch.initialCount <= batch.usedCount || (batch.endAt && batch.endAt <= now)) {
          throw new PtBookingError(409, 'Gói PT đã hết Credit hoặc hết hạn; không thể duyệt đổi Coach.');
        }
        summary = await planPackageCoachTransfer(tx, request, batch, now);
        if (summary.token !== previewToken)
          throw new PtBookingError(409, 'Lịch HLV đã thay đổi từ lúc xem trước. Hãy tải lại kết quả trước khi duyệt.');
        for (const booking of summary.transferable) {
          if (booking.startTime <= new Date())
            throw new PtBookingError(409, 'Lịch PT đã bắt đầu. Hãy xem trước lại.');
          const claimed = await tx.booking.updateMany({ where: { id: booking.bookingId,
            memberId: request.memberId, coachId: request.oldCoachId, status: booking.status,
            startTime: booking.startTime, endTime: booking.endTime },
            data: { coachId: request.newCoachId, sessionQrToken: null } });
          if (claimed.count !== 1) throw new PtBookingError(409, 'Lịch PT vừa thay đổi. Vui lòng xem trước lại.');
        }
        for (const booking of summary.toCancel) {
          const executionTime = new Date();
          if (booking.startTime <= executionTime)
            throw new PtBookingError(409, 'Lịch PT đã bắt đầu. Hãy xem trước lại.');
          if (protectedOldCoachSlot(booking.startTime, executionTime, true))
            throw new PtBookingError(409, 'Lịch đã còn dưới 2 giờ. Hãy xem trước lại để giữ HLV cũ.');
          const claimed = await tx.booking.updateMany({ where: { id: booking.bookingId,
            memberId: request.memberId, coachId: request.oldCoachId, status: booking.status,
            startTime: booking.startTime, endTime: booking.endTime },
            data: { status: 'CANCELLED', cancelledBy: 'ADMIN_COACH_CHANGE',
              absenceReason: booking.reason, sessionQrToken: null } });
          if (claimed.count !== 1 || !await releasePtCredit(tx, booking.bookingId))
            throw new PtBookingError(409, 'Lịch PT vừa thay đổi. Vui lòng xem trước lại.');
        }
        await transferCoach(tx, { batchId: batch.id, memberId: request.memberId,
          oldCoachId: request.oldCoachId, newCoachId: request.newCoachId, actorId });
      }
      const updated = await tx.ptCoachChangeRequest.update({ where: { id }, data: {
        status: decision, adminNote: adminNote || null, handledById: actorId, handledAt: new Date(),
      } });
      await tx.actionLog.create({ data: { userId: actorId, action: 'PT_COACH_CHANGE_RESOLVED',
        details: JSON.stringify({ scope: 'PACKAGE_COACH_CHANGE', requestId: id, decision,
          keptBookingIds: summary?.transferable.map(item => item.bookingId) ?? [],
          keptOldCoachBookingIds: summary?.keepOldCoach.map(item => item.bookingId) ?? [],
          cancelledBookingIds: summary?.toCancel.map(item => item.bookingId) ?? [], adminNote }) } });
      const memberMessage = summary
        ? `Đổi HLV gói PT: ${summary.transferable.length} lịch chuyển sang HLV mới (${summary.transferable.map(item => bookingTime(item.startTime)).join(', ') || 'không có'}); ${summary.keepOldCoach.length} lịch gần giờ giữ HLV cũ (${summary.keepOldCoach.map(item => bookingTime(item.startTime)).join(', ') || 'không có'}); ${summary.toCancel.length} lịch cần đặt lại (${summary.toCancel.map(item => bookingTime(item.startTime)).join(', ') || 'không có'}). Credit các lịch hủy đã hoàn về lô gốc. Quyền học bù không thay đổi.`
        : `Yêu cầu đổi HLV gói PT không được duyệt. ${adminNote}`;
      const memberNotification = await tx.notification.create({ data: { userId: request.memberId,
        title: 'Yêu cầu đổi HLV gói PT đã xử lý', message: memberMessage } });
      return { request: updated, summary, memberNotification };
    }, { isolationLevel: 'Serializable', maxWait: 15000, timeout: 30000 });
    emitCoachScheduleChanged(result.request.oldCoachId);
    if (result.summary) emitCoachScheduleChanged(result.request.newCoachId);
    emitUserNotification(result.request.memberId, result.memberNotification);
    await Promise.allSettled([result.request.oldCoachId, result.request.newCoachId].map(userId => createUserNotification({
      userId, title: 'Yêu cầu đổi Coach PT đã xử lý',
      message: result.summary ? `Đã chuyển HLV gói PT. Chuyển ${result.summary.transferable.length} lịch, giữ HLV cũ cho ${result.summary.keepOldCoach.length} lịch gần giờ, hủy ${result.summary.toCancel.length} lịch không phù hợp.` :
        `Yêu cầu đổi Coach không được duyệt. ${result.request.adminNote || ''}`,
    })));
    return res.json({ success: true, data: result.request, summary: result.summary });
  } catch (error) { return fail(res, error); }
}
