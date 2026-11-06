import prisma from '../config/prisma.js';
import { lockPtCalendar, lockPtCoach, lockPtMember, lockPtMembership, PtBookingError } from './ptBooking.service.js';
import { isPtLevel } from './ptWallet.service.js';
import { requireQualifiedPtCoach } from './ptCoachEligibility.service.js';
import { createUserNotification } from './notification.service.js';
import { emitUserNotification } from '../sockets/ptChat.socket.js';

export async function listMakeupCoachOptions(input: { requestId: number; memberId: number }) {
  const right = await prisma.makeUpRequest.findUnique({ where: { id: input.requestId },
    include: { originalBooking: { include: { membership: { include: { package: true } },
      ptCreditAllocation: { include: { batch: true } } } } } });
  if (!right || right.originalBooking.memberId !== input.memberId || right.cause !== 'COACH' ||
    right.status !== 'PENDING') throw new PtBookingError(404, 'Không tìm thấy quyền học bù đang chờ của bạn.');
  const level = right.originalBooking.ptCreditAllocation?.batch.level ?? right.originalBooking.membership?.package.ptLevel;
  if (!isPtLevel(level)) throw new PtBookingError(409, 'Chưa xác định được cấp PT của quyền học bù.');
  const currentCoachId = right.assignedCoachId ?? right.originalBooking.coachId;
  const profiles = await prisma.coachProfile.findMany({ where: { status: 'ACTIVE',
    user: { status: 'ACTIVE', role: { in: ['COACH', 'TRAINER'] } },
    userId: { not: currentCoachId ?? -1 }, specializations: { some: { level } },
  }, select: { id: true, userId: true, user: { select: { fullName: true } } }, orderBy: { userId: 'asc' } });
  return profiles.map(profile => ({ coachId: profile.userId,
    coachName: profile.user.fullName, level }));
}

export async function submitMakeupCoachChoice(input: {
  requestId: number; memberId: number; coachId: number; reason: string;
}) {
  const initial = await prisma.makeUpRequest.findUnique({ where: { id: input.requestId },
    select: { assignedCoachId: true, originalBooking: { select: {
      coachId: true, memberId: true, membershipId: true,
    } } } });
  if (!initial || initial.originalBooking.memberId !== input.memberId || !initial.originalBooking.coachId)
    throw new PtBookingError(404, 'Không tìm thấy quyền học bù của bạn.');
  const oldCoachId = initial.assignedCoachId ?? initial.originalBooking.coachId;
  if (input.coachId === oldCoachId) throw new PtBookingError(409, 'Hãy chọn HLV khác HLV hiện tại.');
  const result = await prisma.$transaction(async tx => {
    await lockPtCalendar(tx);
    for (const id of new Set([oldCoachId, input.coachId].sort((a, b) => a - b))) await lockPtCoach(tx, id);
    await lockPtMember(tx, input.memberId);
    if (initial.originalBooking.membershipId) await lockPtMembership(tx, initial.originalBooking.membershipId);
    const right = await tx.makeUpRequest.findUniqueOrThrow({ where: { id: input.requestId },
      include: { originalBooking: { include: { membership: { include: { package: true } },
        ptCreditAllocation: { include: { batch: true } } } } } });
    if (right.originalBooking.memberId !== input.memberId || right.cause !== 'COACH' ||
      right.status !== 'PENDING' || right.requestedCoachId ||
      (right.assignedCoachId ?? right.originalBooking.coachId) !== oldCoachId ||
      (right.expiresAt <= new Date() && !right.escalatedAt))
      throw new PtBookingError(409, 'Quyền học bù đã có đề nghị đang chờ hoặc không còn hợp lệ.');
    if (right.originalBooking.ptCreditAllocation?.status !== 'HELD')
      throw new PtBookingError(409, 'Credit của buổi học bù không còn được giữ.');
    const level = right.originalBooking.ptCreditAllocation.batch.level ?? right.originalBooking.membership?.package.ptLevel;
    if (!isPtLevel(level)) throw new PtBookingError(409, 'Chưa xác định được cấp PT của quyền học bù.');
    await requireQualifiedPtCoach(tx, input.coachId, level);
    const now = new Date();
    const claimed = await tx.makeUpRequest.updateMany({ where: { id: right.id,
      status: 'PENDING', requestedCoachId: null }, data: { requestedCoachId: input.coachId,
      requestedStartAt: null, requestReason: input.reason,
      coachChangeRequestedAt: now, escalatedAt: right.escalatedAt ?? now } });
    if (claimed.count !== 1) throw new PtBookingError(409, 'Đề nghị đổi HLV vừa được gửi.');
    const details = JSON.stringify({ coachId: input.coachId, reason: input.reason });
    await tx.ptMakeUpEvent.create({ data: { requestId: right.id, actorId: input.memberId,
      action: 'MEMBER_REQUESTED_COACH_CHANGE', details } });
    await tx.actionLog.create({ data: { userId: input.memberId,
      action: 'PT_MAKEUP_MEMBER_COACH_CHANGE_REQUEST', details: JSON.stringify({ requestId: right.id, ...JSON.parse(details) }) } });
    const admins = await tx.user.findMany({ where: { role: 'ADMIN', status: 'ACTIVE' }, select: { id: true } });
    const notifications = [];
    for (const admin of admins) {
      const notification = await tx.notification.create({ data: { userId: admin.id,
        title: 'Hội viên chọn HLV học bù PT',
        message: `Quyền #${right.id}: đề nghị HLV #${input.coachId}. Hội viên sẽ chọn ca sau khi duyệt.` } });
      notifications.push({ userId: admin.id, notification });
    }
    return { right: { ...right, requestedCoachId: input.coachId,
      requestedStartAt: null, requestReason: input.reason,
      coachChangeRequestedAt: now, escalatedAt: right.escalatedAt ?? now }, notifications };
  }, { isolationLevel: 'Serializable', maxWait: 15000, timeout: 30000 });
  for (const row of result.notifications) emitUserNotification(row.userId, row.notification);
  return result.right;
}

export async function rejectMakeupCoachChoice(input: {
  requestId: number; adminId: number; reason: string; suggestedCoachId?: number;
}) {
  const initial = await prisma.makeUpRequest.findUnique({ where: { id: input.requestId },
    select: { originalBooking: { select: { memberId: true } } } });
  if (!initial) throw new PtBookingError(404, 'Không tìm thấy quyền học bù.');
  const result = await prisma.$transaction(async tx => {
    await lockPtCalendar(tx);
    await lockPtMember(tx, initial.originalBooking.memberId);
    const right = await tx.makeUpRequest.findUniqueOrThrow({ where: { id: input.requestId },
      include: { originalBooking: { include: { ptCreditAllocation: { include: { batch: true } } } } } });
    if (right.status !== 'PENDING' || !right.requestedCoachId ||
      right.originalBooking.ptCreditAllocation?.status !== 'HELD')
      throw new PtBookingError(409, 'Không có đề nghị đổi HLV đang chờ duyệt.');
    if (input.suggestedCoachId) {
      const level = right.originalBooking.ptCreditAllocation.batch.level;
      if (input.suggestedCoachId === (right.assignedCoachId ?? right.originalBooking.coachId))
        throw new PtBookingError(409, 'HLV đề xuất trùng HLV hiện tại.');
      await requireQualifiedPtCoach(tx, input.suggestedCoachId, level);
    }
    await tx.makeUpRequest.update({ where: { id: right.id }, data: { requestedCoachId: null,
      requestedStartAt: null, requestReason: null, coachChangeRequestedAt: null,
      escalatedAt: right.escalatedAt ?? new Date() } });
    const details = JSON.stringify({ requestedCoachId: right.requestedCoachId,
      requestedStartAt: right.requestedStartAt?.toISOString(), reason: input.reason,
      suggestedCoachId: input.suggestedCoachId ?? null });
    await tx.ptMakeUpEvent.create({ data: { requestId: right.id, actorId: input.adminId,
      action: 'ADMIN_REJECTED_COACH_CHOICE', details } });
    await tx.actionLog.create({ data: { userId: input.adminId,
      action: 'PT_MAKEUP_ADMIN_REJECT_CHOICE', details: JSON.stringify({ requestId: right.id, ...JSON.parse(details) }) } });
    const notification = await tx.notification.create({ data: { userId: right.originalBooking.memberId,
      title: 'Đề nghị đổi HLV học bù cần chọn lại',
      message: `Quyền #${right.id}: ${input.reason}${input.suggestedCoachId ? ` Admin đề xuất HLV #${input.suggestedCoachId}.` : ''} Bạn có thể chọn HLV khác; quyền bù vẫn được giữ.` } });
    return { memberId: right.originalBooking.memberId, notification };
  }, { isolationLevel: 'Serializable', maxWait: 15000, timeout: 30000 });
  emitUserNotification(result.memberId, result.notification);
  return result;
}
