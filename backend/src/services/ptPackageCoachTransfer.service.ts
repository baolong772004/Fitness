import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { availableSlots, vietnamDate } from './ptCalendar.service.js';
import { PT_BOOKING_HOLD_STATUSES } from './ptBooking.service.js';
import { requireQualifiedPtCoach } from './ptCoachEligibility.service.js';

type Change = { id: number; batchId: number; memberId: number; oldCoachId: number; newCoachId: number };
type Batch = { coachId: number | null; level: string };
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

export function protectedOldCoachSlot(startTime: Date, now: Date, unavailable: boolean) {
  return unavailable && startTime.getTime() > now.getTime() &&
    startTime.getTime() - now.getTime() < TWO_HOURS_MS;
}

export async function planPackageCoachTransfer(tx: Prisma.TransactionClient,
  request: Change, batch: Batch, now = new Date()) {
  const coach = await requireQualifiedPtCoach(tx, request.newCoachId, batch.level);
  const bookings = await tx.booking.findMany({ where: {
    type: 'PT', isMakeup: false, memberId: request.memberId, coachId: request.oldCoachId,
    status: { in: ['PENDING', 'UPCOMING', 'CONFIRMED'] }, startTime: { gt: now },
    ptCreditAllocation: { is: { batchId: request.batchId, status: 'HELD' } },
  }, select: { id: true, startTime: true, endTime: true, status: true },
    orderBy: [{ startTime: 'asc' }, { id: 'asc' }] });
  const slotsByDate = new Map<string, Awaited<ReturnType<typeof availableSlots>>>();
  const items: Array<{ bookingId: number; startTime: Date; endTime: Date;
    status: string; outcome: 'TRANSFER' | 'CANCEL' | 'KEEP_OLD'; reason: string | null }> = [];
  for (const booking of bookings) {
    const day = vietnamDate(booking.startTime);
    if (!slotsByDate.has(day)) slotsByDate.set(day, await availableSlots(tx, coach.id, day));
    let reason: string | null = null;
    if (!slotsByDate.get(day)!.some(slot =>
      slot.start.getTime() === booking.startTime.getTime() &&
      slot.end.getTime() === booking.endTime.getTime())) {
      reason = 'HLV mới không có ca làm việc hợp lệ hoặc Gym đóng cửa trong khung giờ này.';
    } else {
      const overlap = { status: { in: PT_BOOKING_HOLD_STATUSES },
        startTime: { lt: booking.endTime }, endTime: { gt: booking.startTime } };
      if (await tx.booking.findFirst({ where: { coachId: request.newCoachId, ...overlap },
        select: { id: true } })) reason = 'HLV mới đã có booking trùng giờ.';
      else if (await tx.booking.findFirst({ where: { memberId: request.memberId,
        id: { not: booking.id }, ...overlap }, select: { id: true } }))
        reason = 'Hội viên đã có booking khác trùng giờ.';
    }
    const keepOld = protectedOldCoachSlot(booking.startTime, now, !!reason);
    items.push({ bookingId: booking.id, startTime: booking.startTime,
      endTime: booking.endTime, status: booking.status,
      outcome: keepOld ? 'KEEP_OLD' : reason ? 'CANCEL' : 'TRANSFER',
      reason: keepOld ? `Còn dưới 2 giờ: giữ lịch với HLV cũ. ${reason}` : reason });
  }
  const token = createHash('sha256').update(JSON.stringify({ requestId: request.id,
    batchId: request.batchId, batchCoachId: batch.coachId, newCoachId: request.newCoachId,
    items })).digest('hex');
  return { requestId: request.id, generatedAt: now, token,
    transferable: items.filter(item => item.outcome === 'TRANSFER'),
    keepOldCoach: items.filter(item => item.outcome === 'KEEP_OLD'),
    toCancel: items.filter(item => item.outcome === 'CANCEL') };
}
