import prisma from '../config/prisma.js';
import { availableSlots, assertBookingsCovered, vietnamDate } from './ptCalendar.service.js';
import { lockPtCalendar, lockPtCoach, lockPtMember, lockPtMembership, PtBookingError } from './ptBooking.service.js';
import { createUserNotification } from './notification.service.js';
import { closePtChatRoom, emitCoachScheduleChanged } from '../sockets/ptChat.socket.js';

const WEEK_MS = 7 * 86400000;

export async function reportCoachAbsence(input: {
  bookingId: number; coachId: number; actorId: number; reason: string; pendingRequestId?: number;
}) {
  const initial = await prisma.booking.findUnique({ where: { id: input.bookingId },
    select: { coachId: true, memberId: true, membershipId: true } });
  if (!initial || initial.coachId !== input.coachId) throw new PtBookingError(403, 'Không có quyền báo vắng buổi PT này.');
  const result = await prisma.$transaction(async tx => {
    await lockPtCalendar(tx);
    await lockPtCoach(tx, input.coachId);
    await lockPtMember(tx, initial.memberId);
    if (initial.membershipId) await lockPtMembership(tx, initial.membershipId);
    const booking = await tx.booking.findUniqueOrThrow({ where: { id: input.bookingId } });
    const now = new Date();
    if (booking.type !== 'PT' || booking.coachId !== input.coachId ||
      booking.status !== 'CONFIRMED' || booking.startTime <= now) {
      throw new PtBookingError(409, 'Buổi PT đã bắt đầu hoặc đã được xử lý.');
    }
    const allocation = await tx.ptBookingCreditAllocation.findUnique({ where: { bookingId: booking.id } });
    if ((!allocation && !booking.membershipId) || (allocation && allocation.status !== 'HELD')) {
      throw new PtBookingError(409, 'Booking không có Credit đang giữ chỗ.');
    }
    let rootId = booking.id;
    for (let i = 0; i < 50 && booking.isMakeup; i++) {
      const parent = await tx.booking.findUnique({ where: { id: rootId }, select: { makeupFromId: true } });
      if (!parent?.makeupFromId || parent.makeupFromId === rootId) break;
      rootId = parent.makeupFromId;
    }
    const previous = booking.isMakeup ? await tx.makeUpRequest.findFirst({ where: {
      newBookingId: booking.id, status: 'APPROVED',
    } }) : null;
    const absenceCount = booking.isMakeup ? Math.max(2, (previous?.coachAbsenceCount ?? 1) + 1) : 1;
    const existing = await tx.makeUpRequest.findFirst({ where: {
      chainRootBookingId: rootId, status: { in: ['PENDING', 'ESCALATED'] },
    } });
    if (existing) throw new PtBookingError(409, 'Chuỗi buổi PT đã có quyền học bù đang hoạt động.');
    const claimed = await tx.booking.updateMany({ where: { id: booking.id, status: 'CONFIRMED' }, data: {
      status: 'ABSENT_ELIGIBLE', absenceReason: input.reason || 'Coach báo vắng',
      absenceReportedAt: now, cancelledBy: 'COACH', sessionQrToken: null,
    } });
    if (claimed.count !== 1) throw new PtBookingError(409, 'Buổi PT đã được xử lý.');
    const right = await tx.makeUpRequest.create({ data: {
      originalBookingId: booking.id, status: 'PENDING', cause: 'COACH',
      chainRootBookingId: rootId, coachAbsenceCount: absenceCount,
      escalatedAt: absenceCount >= 2 ? now : null,
      expiresAt: new Date(now.getTime() + WEEK_MS),
    } });
    await tx.ptMakeUpEvent.create({ data: { requestId: right.id, actorId: input.actorId,
      action: 'COACH_ABSENCE_GRANTED', details: JSON.stringify({ bookingId: booking.id,
        rootId, absenceCount, expiresAt: right.expiresAt.toISOString() }) } });
    const profile = await tx.coachProfile.findUniqueOrThrow({ where: { userId: input.coachId } });
    const date = vietnamDate(booking.startTime);
    const slots = await availableSlots(tx, profile.id, date);
    const remaining = slots.filter(slot => slot.start.getTime() !== booking.startTime.getTime())
      .map(slot => ({ startTime: slot.startTime, endTime: slot.endTime }));
    await tx.coachDateAvailability.upsert({ where: { coachProfileId_date: { coachProfileId: profile.id, date } },
      create: { coachProfileId: profile.id, date, shifts: JSON.stringify(remaining) },
      update: { shifts: JSON.stringify(remaining) } });
    await assertBookingsCovered(tx, input.coachId, profile.id, { date, override: remaining });
    if (input.pendingRequestId) {
      const updated = await tx.coachScheduleChangeRequest.updateMany({ where: {
        id: input.pendingRequestId, bookingId: booking.id, coachId: input.coachId, status: 'PENDING',
      }, data: { status: 'APPROVED', handledById: input.actorId, handledAt: now } });
      if (updated.count !== 1) throw new PtBookingError(409, 'Yêu cầu báo vắng đã được xử lý.');
    } else {
      await tx.coachScheduleChangeRequest.create({ data: {
        bookingId: booking.id, coachId: input.coachId, reason: input.reason || 'Coach báo vắng',
        status: 'APPROVED', handledAt: now,
      } });
    }
    await tx.actionLog.create({ data: { userId: input.actorId, action: 'PT_COACH_ABSENCE',
      details: JSON.stringify({ bookingId: booking.id, rootId, rightId: right.id, absenceCount,
        reason: input.reason }) } });
    return { booking: await tx.booking.findUniqueOrThrow({ where: { id: booking.id } }), right };
  }, { maxWait: 15000, timeout: 30000 });
  closePtChatRoom(input.bookingId);
  emitCoachScheduleChanged(input.coachId);
  const admins = await prisma.user.findMany({ where: { role: 'ADMIN', status: 'ACTIVE' }, select: { id: true } });
  await Promise.allSettled([
    createUserNotification({ userId: result.booking.memberId, title: 'Coach báo vắng buổi PT',
      message: 'Bạn được đặt học bù trong 7 ngày; Credit vẫn được giữ cho buổi này.' }),
    ...admins.map(admin => createUserNotification({ userId: admin.id, title: 'Coach báo vắng buổi PT',
      message: `Booking #${input.bookingId}, quyền bù #${result.right.id}${result.right.coachAbsenceCount >= 2 ? ' — Coach vắng lặp lại, cần hỗ trợ đổi Coach.' : '.'}` })),
  ]);
  return result;
}
