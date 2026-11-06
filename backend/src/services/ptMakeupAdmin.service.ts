import prisma from '../config/prisma.js';
import { lockPtCalendar, lockPtCoach, lockPtMember, lockPtMembership, PtBookingError } from './ptBooking.service.js';
import { isPtLevel } from './ptWallet.service.js';
import { requireQualifiedPtCoach } from './ptCoachEligibility.service.js';
import { createUserNotification } from './notification.service.js';
import { emitUserNotification } from '../sockets/ptChat.socket.js';

export async function requestMakeupCoachChange(input: {
  requestId: number; memberId: number; reason: string;
}) {
  const initial = await prisma.makeUpRequest.findUnique({ where: { id: input.requestId },
    select: { assignedCoachId: true, originalBooking: { select: {
      coachId: true, memberId: true, membershipId: true,
    } } } });
  if (!initial || initial.originalBooking.memberId !== input.memberId ||
    !initial.originalBooking.coachId) throw new PtBookingError(404, 'Không tìm thấy quyền học bù của bạn.');
  const result = await prisma.$transaction(async tx => {
    await lockPtCalendar(tx);
    await lockPtCoach(tx, initial.assignedCoachId ?? initial.originalBooking.coachId!);
    await lockPtMember(tx, input.memberId);
    if (initial.originalBooking.membershipId) await lockPtMembership(tx, initial.originalBooking.membershipId);
    const right = await tx.makeUpRequest.findUniqueOrThrow({ where: { id: input.requestId },
      include: { originalBooking: true } });
    if (right.originalBooking.memberId !== input.memberId || right.cause !== 'COACH' ||
      right.status !== 'PENDING' || right.expiresAt <= new Date() ||
      (right.assignedCoachId ?? right.originalBooking.coachId) !==
        (initial.assignedCoachId ?? initial.originalBooking.coachId)) {
      throw new PtBookingError(409, 'Quyền học bù không còn chờ đặt lịch hoặc vừa thay đổi HLV.');
    }
    const allocation = await tx.ptBookingCreditAllocation.findUnique({
      where: { bookingId: right.originalBookingId }, select: { status: true },
    });
    if (allocation ? allocation.status !== 'HELD' : !right.originalBooking.membershipId) {
      throw new PtBookingError(409, 'Buổi PT không còn Credit đang giữ.');
    }
    if (right.escalatedAt) return { right, notifications: [] };
    const now = new Date();
    const claimed = await tx.makeUpRequest.updateMany({ where: {
      id: right.id, status: 'PENDING', escalatedAt: null,
    }, data: { escalatedAt: now } });
    if (claimed.count !== 1) throw new PtBookingError(409, 'Yêu cầu đổi HLV vừa được gửi.');
    await tx.ptMakeUpEvent.create({ data: { requestId: right.id, actorId: input.memberId,
      action: 'MEMBER_REQUESTED_COACH_CHANGE', details: input.reason } });
    await tx.actionLog.create({ data: { userId: input.memberId,
      action: 'PT_MAKEUP_MEMBER_COACH_CHANGE_REQUEST',
      details: JSON.stringify({ requestId: right.id, reason: input.reason }) } });
    const admins = await tx.user.findMany({ where: { role: 'ADMIN', status: 'ACTIVE' },
      select: { id: true } });
    const notifications = [];
    for (const admin of admins) {
      const notification = await tx.notification.create({ data: { userId: admin.id,
        title: 'Hội viên đề nghị đổi HLV học bù PT',
        message: `Quyền học bù #${right.id}: ${input.reason}` } });
      notifications.push({ userId: admin.id, notification });
    }
    return { right: { ...right, escalatedAt: now }, notifications };
  }, { isolationLevel: 'Serializable', maxWait: 15000, timeout: 30000 });
  for (const row of result.notifications) emitUserNotification(row.userId, row.notification);
  return result.right;
}

export async function assignMakeupCoach(input: {
  requestId: number; coachId: number; adminId: number; reason: string; approval?: boolean;
}) {
  const initial = await prisma.makeUpRequest.findUnique({ where: { id: input.requestId },
    include: { originalBooking: { include: { membership: { include: { package: true } },
      ptCreditAllocation: { include: { batch: true } } } } } });
  if (!initial?.originalBooking.coachId) throw new PtBookingError(404, 'Không tìm thấy quyền học bù.');
  const oldCoachId = initial.assignedCoachId ?? initial.originalBooking.coachId;
  const result = await prisma.$transaction(async tx => {
    await lockPtCalendar(tx);
    for (const coachId of new Set([oldCoachId, input.coachId].sort((a, b) => a - b))) await lockPtCoach(tx, coachId);
    await lockPtMember(tx, initial.originalBooking.memberId);
    const request = await tx.makeUpRequest.findUniqueOrThrow({ where: { id: input.requestId },
      include: { originalBooking: { include: { membership: { include: { package: true } },
        ptCreditAllocation: { include: { batch: true } } } } } });
    if (request.cause !== 'COACH' || !['PENDING', 'ESCALATED'].includes(request.status) ||
      !request.escalatedAt || (request.assignedCoachId ?? request.originalBooking.coachId) !== oldCoachId) {
      throw new PtBookingError(409, 'Quyền học bù chưa cần Admin xử lý hoặc vừa thay đổi.');
    }
    if (input.coachId === oldCoachId) {
      throw new PtBookingError(409, 'Vui lòng chọn HLV khác cho buổi học bù.');
    }
    const level = request.originalBooking.ptCreditAllocation?.batch.level ??
      request.originalBooking.membership?.package.ptLevel;
    if (!isPtLevel(level)) throw new PtBookingError(409, 'Không xác định được cấp PT của gói cũ; cần đối soát thủ công.');
    await requireQualifiedPtCoach(tx, input.coachId, level, 403);
    if (request.originalBooking.ptCreditAllocation &&
      request.originalBooking.ptCreditAllocation.status !== 'HELD')
      throw new PtBookingError(409, 'Credit của buổi học bù không còn được giữ.');
    const nextExpiry = new Date(Math.max(request.expiresAt.getTime(), Date.now() + 7 * 86400000));
    if (input.approval) {
      if (request.status !== 'PENDING' || request.requestedCoachId !== input.coachId ||
        !request.requestReason)
        throw new PtBookingError(409, 'Lựa chọn HLV của hội viên vừa thay đổi hoặc không còn chờ duyệt.');
    }
    const updated = await tx.makeUpRequest.update({ where: { id: request.id }, data: {
      status: 'PENDING', assignedCoachId: input.coachId, expiresAt: nextExpiry,
      slotEvidence: null, escalatedAt: null, requestedCoachId: null,
      requestedStartAt: null, requestReason: null, coachChangeRequestedAt: null,
    } });
    await tx.ptMakeUpEvent.create({ data: { requestId: request.id, actorId: input.adminId,
      action: input.approval ? 'ADMIN_APPROVED_COACH_CHOICE' : 'ADMIN_ASSIGNED_COACH', details: JSON.stringify({ oldCoachId,
        newCoachId: input.coachId, previousDesiredStartAt: request.requestedStartAt?.toISOString(),
        reason: input.reason, previousEvidence: request.slotEvidence }).slice(0, 1000) } });
    await tx.actionLog.create({ data: { userId: input.adminId,
      action: input.approval ? 'PT_MAKEUP_ADMIN_APPROVE_CHOICE' : 'PT_MAKEUP_ADMIN_ASSIGN',
      details: JSON.stringify({ requestId: request.id, oldCoachId, newCoachId: input.coachId,
        expiresAt: nextExpiry.toISOString(), reason: input.reason }) } });
    return { right: updated, memberId: request.originalBooking.memberId };
  }, { isolationLevel: 'Serializable', maxWait: 15000, timeout: 30000 });
  await Promise.allSettled([result.memberId, input.coachId].map(userId => createUserNotification({ userId,
    title: 'Admin sắp xếp lại buổi PT học bù',
    message: `Quyền bù #${input.requestId} được chuyển sang Coach #${input.coachId}. Hạn đặt lịch: ${result.right.expiresAt.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}.`,
  })));
  return result.right;
}
