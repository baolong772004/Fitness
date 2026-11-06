import { Prisma } from '@prisma/client';
import prisma from '../config/prisma.js';
import { availableSlots, vietnamDate } from './ptCalendar.service.js';
import { lockPtCalendar, lockPtCoach, lockPtMember, lockPtMembership, PT_BOOKING_HOLD_STATUSES } from './ptBooking.service.js';
import { lockGymMember } from './gymMembershipLock.service.js';
import { verifiedGymPayment } from './gymEntitlement.service.js';
import { emitUserNotification } from '../sockets/ptChat.socket.js';

type Offer = { start: string; end: string; notifiedAt: string };
type Evidence = { checkedAt?: string; offers: Offer[] };

export function parseSlotEvidence(value: string | null): Evidence {
  try {
    const parsed = JSON.parse(value ?? '{}');
    return { checkedAt: typeof parsed.checkedAt === 'string' ? parsed.checkedAt : undefined,
      offers: Array.isArray(parsed.offers) ? parsed.offers.filter((row: any) =>
        typeof row.start === 'string' && typeof row.end === 'string' && typeof row.notifiedAt === 'string') : [] };
  } catch { return { offers: [] }; }
}

export async function suitableSlot(tx: Prisma.TransactionClient, input: {
  coachId: number; memberId: number; start: Date; end: Date;
}) {
  const profile = await tx.coachProfile.findUnique({ where: { userId: input.coachId },
    select: { id: true, status: true, user: { select: { status: true } } } });
  if (!profile || profile.status !== 'ACTIVE' || profile.user.status !== 'ACTIVE') return false;
  const cells = await availableSlots(tx, profile.id, vietnamDate(input.start));
  if (!cells.some(cell => cell.start.getTime() === input.start.getTime() &&
    cell.end.getTime() === input.end.getTime())) return false;
  const overlap = { status: { in: PT_BOOKING_HOLD_STATUSES }, startTime: { lt: input.end },
    endTime: { gt: input.start } };
  if (await tx.booking.findFirst({ where: { coachId: input.coachId, ...overlap }, select: { id: true } })) return false;
  if (await tx.booking.findFirst({ where: { memberId: input.memberId, ...overlap }, select: { id: true } })) return false;
  const gym = await tx.membership.findFirst({ where: { userId: input.memberId,
    status: { in: ['ACTIVE', 'PENDING_ACTIVATION'] }, startDate: { lte: input.start },
    endDate: { gte: input.end }, package: { type: 'MEMBERSHIP' },
    payments: { some: verifiedGymPayment } }, select: { id: true } });
  return Boolean(gym);
}

export async function hadNotifiedSuitableSlot(tx: Prisma.TransactionClient, input: {
  coachId: number; memberId: number; evidence: string | null; deadline: Date;
}) {
  for (const offer of parseSlotEvidence(input.evidence).offers) {
    const start = new Date(offer.start), end = new Date(offer.end), notified = new Date(offer.notifiedAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || Number.isNaN(notified.getTime()) ||
      end > input.deadline ||
      start.getTime() - notified.getTime() < 2 * 3600000) continue;
    if (await suitableSlot(tx, { coachId: input.coachId, memberId: input.memberId, start, end })) return true;
  }
  return false;
}

export async function captureMakeupAvailability(requestId: number) {
  const initial = await prisma.makeUpRequest.findUnique({ where: { id: requestId },
    select: { originalBooking: { select: { coachId: true, memberId: true, membershipId: true } } } });
  if (!initial?.originalBooking.coachId) return null;
  const result = await prisma.$transaction(async tx => {
    await lockPtCalendar(tx);
    await lockPtCoach(tx, initial.originalBooking.coachId!);
    await lockPtMember(tx, initial.originalBooking.memberId);
    await lockGymMember(tx, initial.originalBooking.memberId);
    if (initial.originalBooking.membershipId) await lockPtMembership(tx, initial.originalBooking.membershipId);
    const request = await tx.makeUpRequest.findUnique({ where: { id: requestId }, include: { originalBooking: true } });
    const now = new Date();
    if (!request || request.status !== 'PENDING' || request.cause !== 'COACH' ||
      request.requestedCoachId || request.expiresAt <= now) return null;
    const evidence = parseSlotEvidence(request.slotEvidence);
    if (evidence.checkedAt && now.getTime() - new Date(evidence.checkedAt).getTime() < 3600000) return null;
    const coachId = request.assignedCoachId ?? request.originalBooking.coachId!;
    const profile = await tx.coachProfile.findUnique({ where: { userId: coachId },
      select: { id: true, status: true, user: { select: { status: true } } } });
    const offers: Offer[] = [];
    if (profile?.status === 'ACTIVE' && profile.user.status === 'ACTIVE') {
      for (let day = new Date(now.getTime()); day < request.expiresAt; day = new Date(day.getTime() + 86400000)) {
        const slots = await availableSlots(tx, profile.id, vietnamDate(day));
        for (const slot of slots) {
          if (slot.start.getTime() < now.getTime() + 2 * 3600000 || slot.end > request.expiresAt ||
            evidence.offers.some(row => row.start === slot.start.toISOString())) continue;
          if (await suitableSlot(tx, { coachId, memberId: request.originalBooking.memberId,
            start: slot.start, end: slot.end })) {
            offers.push({ start: slot.start.toISOString(), end: slot.end.toISOString(),
              notifiedAt: now.toISOString() });
          }
          if (offers.length >= 12) break;
        }
        if (offers.length >= 12) break;
      }
    }
    const next = { checkedAt: now.toISOString(), offers: [...evidence.offers, ...offers].slice(-100) };
    await tx.makeUpRequest.update({ where: { id: requestId }, data: { slotEvidence: JSON.stringify(next) } });
    await tx.ptMakeUpEvent.create({ data: { requestId, action: 'SLOT_EVIDENCE_CAPTURED',
      details: JSON.stringify({ at: now.toISOString(), offered: offers.map(row => row.start) }).slice(0, 1000) } });
    const notification = offers.length ? await tx.notification.create({ data: {
      userId: request.originalBooking.memberId, title: 'Có ca học bù PT phù hợp',
      message: `Quyền học bù #${requestId} có ${offers.length} ca phù hợp. Hãy đặt trước hạn ${request.expiresAt.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}.`,
    } }) : null;
    return notification ? { memberId: request.originalBooking.memberId, notification } : null;
  }, { isolationLevel: 'Serializable', maxWait: 15000, timeout: 30000 });
  if (result) emitUserNotification(result.memberId, result.notification);
  return result;
}
