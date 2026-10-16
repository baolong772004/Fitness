import { Prisma } from '@prisma/client';
import prisma from '../config/prisma.js';
import { lockGymMember } from './gymMembershipLock.service.js';
import { availableSlots, vietnamDate } from './ptCalendar.service.js';

const HOUR = 60 * 60 * 1000;
export const PT_BOOKING_HOLD_STATUSES = ['PENDING', 'UPCOMING', 'CONFIRMED', 'IN_PROGRESS'];

export class PtBookingError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

async function lock(tx: Prisma.TransactionClient, resource: string) {
  const rows = await tx.$queryRaw<Array<{ result: number }>>`
    SET NOCOUNT ON;
    DECLARE @result int;
    EXEC @result = sp_getapplock @Resource = ${resource}, @LockMode = 'Exclusive',
      @LockOwner = 'Transaction', @LockTimeout = 10000;
    SELECT @result AS result;
  `;
  if (rows[0]?.result === undefined || rows[0].result < 0) {
    throw new PtBookingError(409, 'Lịch đang được xử lý. Vui lòng thử lại.');
  }
}

export async function lockPtCoach(tx: Prisma.TransactionClient, coachId: number) {
  await lock(tx, `pt-coach:${coachId}`);
}
export async function lockPtCalendar(tx: Prisma.TransactionClient) {
  await lock(tx, 'pt-master-calendar');
}

export async function lockPtMember(tx: Prisma.TransactionClient, memberId: number) {
  await lock(tx, `pt-member:${memberId}`);
}

export async function lockPtMembership(tx: Prisma.TransactionClient, membershipId: number) {
  await lock(tx, `pt-membership:${membershipId}`);
}

export async function reservedPtSessions(tx: Prisma.TransactionClient, membershipId: number, now = new Date()) {
  const [bookings, makeups] = await Promise.all([
    tx.booking.count({ where: { type: 'PT', membershipId, status: { in: PT_BOOKING_HOLD_STATUSES } } }),
    tx.makeUpRequest.count({ where: {
      status: 'PENDING', expiresAt: { gt: now }, originalBooking: { membershipId },
    } }),
  ]);
  return bookings + makeups;
}

export async function requirePtSlot(
  tx: Prisma.TransactionClient, coachId: number, memberId: number, start: Date,
) {
  const now = new Date();
  if (Number.isNaN(start.getTime()) || start.getTime() < now.getTime() + 2 * HOUR) {
    throw new PtBookingError(400, 'Cần đặt lịch trước giờ tập ít nhất 2 tiếng.');
  }
  const profile = await tx.coachProfile.findUnique({
    where: { userId: coachId }, select: { id: true, status: true, user: { select: { status: true } } },
  });
  if (!profile || profile.status !== 'ACTIVE' || profile.user.status !== 'ACTIVE') {
    throw new PtBookingError(409, 'Coach không còn hoạt động.');
  }
  const slot = (await availableSlots(tx, profile.id, vietnamDate(start)))
    .find(row => row.start.getTime() === start.getTime());
  if (!slot) throw new PtBookingError(409, 'Ca này không còn trong lịch làm việc của Coach.');
  const end = slot.end;
  const overlap = { status: { in: PT_BOOKING_HOLD_STATUSES }, startTime: { lt: end }, endTime: { gt: start } };
  if (await tx.booking.findFirst({ where: { coachId, ...overlap }, select: { id: true } })) {
    throw new PtBookingError(409, 'Coach đã có lịch trong ca này.');
  }
  if (await tx.booking.findFirst({ where: { memberId, ...overlap }, select: { id: true } })) {
    throw new PtBookingError(409, 'Bạn đã có lịch trùng giờ.');
  }
  return end;
}

export async function requireGymOnDate(tx: Prisma.TransactionClient, memberId: number, start: Date, end: Date) {
  const gym = await tx.membership.findFirst({ where: {
    userId: memberId, status: { in: ['ACTIVE', 'PENDING_ACTIVATION'] },
    startDate: { lte: start }, endDate: { gte: end }, package: { type: 'MEMBERSHIP' },
  }, select: { id: true } });
  if (!gym) throw new PtBookingError(403, 'Cần có gói Gym hợp lệ vào ngày tập.');
}

export async function createConfirmedPtBooking(input: {
  memberId: number; membershipId: number; start: Date; note?: string;
  makeupOriginalId?: number; coachId?: number;
}) {
  return prisma.$transaction(async (tx) => {
    const initialMembership = await tx.membership.findFirst({ where: {
      id: input.membershipId, userId: input.memberId, package: { type: { in: ['PT', 'MEMBERSHIP'] } },
    }, select: { id: true, coachId: true, package: { select: { type: true, trialPtSessions: true } } } });
    if (!initialMembership) throw new PtBookingError(404, 'Không tìm thấy quyền đặt PT hợp lệ.');
    const coachId = initialMembership.package.type === 'PT' ? initialMembership.coachId : input.coachId;
    if (!coachId || !Number.isSafeInteger(coachId)) throw new PtBookingError(400, 'Cần chọn Coach cho buổi PT.');
    if (initialMembership.package.type === 'MEMBERSHIP' && initialMembership.package.trialPtSessions <= 0) {
      throw new PtBookingError(403, 'Gói Gym này không kèm buổi PT dùng thử.');
    }
    // Consistent lock order across all booking paths.
    await lockPtCalendar(tx);
    await lockPtCoach(tx, coachId);
    await lockPtMember(tx, input.memberId);
    await lockPtMembership(tx, initialMembership.id);
    await lockGymMember(tx, input.memberId);
    const membership = await tx.membership.findUniqueOrThrow({ where: { id: initialMembership.id }, include: { package: true } });
    if (membership.package.type === 'PT' && membership.coachId !== coachId) throw new PtBookingError(409, 'Coach của gói PT đã thay đổi.');
    const end = await requirePtSlot(tx, coachId, input.memberId, input.start);
    await requireGymOnDate(tx, input.memberId, input.start, end);
    if ((membership.remainingSessions ?? 0) <= 0) throw new PtBookingError(409, 'Gói PT đã hết buổi.');

    if (input.makeupOriginalId) {
      const request = await tx.makeUpRequest.findFirst({ where: {
        originalBookingId: input.makeupOriginalId, status: 'PENDING',
        originalBooking: { memberId: input.memberId, membershipId: membership.id, coachId },
      } });
      if (!request || request.expiresAt <= new Date() || end > request.expiresAt) {
        throw new PtBookingError(409, 'Quyền học bù đã hết hạn hoặc ca học nằm ngoài hạn 7 ngày.');
      }
      const booking = await tx.booking.create({ data: {
        type: 'PT', memberId: input.memberId, coachId, membershipId: membership.id,
        startTime: input.start, endTime: end, status: 'CONFIRMED', isMakeup: true,
        makeupFromId: input.makeupOriginalId,
      } });
      const claimed = await tx.makeUpRequest.updateMany({ where: { id: request.id, status: 'PENDING' },
        data: { status: 'APPROVED', newBookingId: booking.id } });
      if (claimed.count !== 1) throw new PtBookingError(409, 'Quyền học bù đã được sử dụng.');
      await tx.booking.update({ where: { id: input.makeupOriginalId }, data: { status: 'MAKEUP_BOOKED' } });
      return booking;
    }

    if (membership.status !== 'ACTIVE' || membership.startDate > input.start || membership.endDate < end) {
      throw new PtBookingError(409, 'Gói PT không còn hiệu lực trong toàn bộ ca tập.');
    }
    const reserved = await reservedPtSessions(tx, membership.id);
    if ((membership.remainingSessions ?? 0) <= reserved) {
      throw new PtBookingError(409, 'Tất cả buổi PT còn lại đã được đặt hoặc dành cho học bù.');
    }
    return tx.booking.create({ data: {
      type: 'PT', memberId: input.memberId, coachId, membershipId: membership.id,
      startTime: input.start, endTime: end, status: 'CONFIRMED', absenceReason: input.note?.slice(0, 500) || '',
    } });
  }, { maxWait: 15000, timeout: 20000 });
}

export async function createConfirmedPtBookings(input: {
  memberId: number; membershipId: number; starts: Date[]; coachId?: number;
}) {
  if (input.starts.length < 1 || input.starts.length > 20 ||
      input.starts.some(start => Number.isNaN(start.getTime())) ||
      new Set(input.starts.map(start => start.getTime())).size !== input.starts.length) {
    throw new PtBookingError(400, 'Chọn từ 1 đến 20 ca PT khác nhau.');
  }
  const starts = [...input.starts].sort((a, b) => a.getTime() - b.getTime());
  return prisma.$transaction(async tx => {
    const initialMembership = await tx.membership.findFirst({ where: {
      id: input.membershipId, userId: input.memberId, package: { type: { in: ['PT', 'MEMBERSHIP'] } },
    }, select: { id: true, coachId: true, package: { select: { type: true, trialPtSessions: true } } } });
    if (!initialMembership) throw new PtBookingError(404, 'Không tìm thấy quyền đặt PT hợp lệ.');
    const coachId = initialMembership.package.type === 'PT' ? initialMembership.coachId : input.coachId;
    if (!coachId || !Number.isSafeInteger(coachId)) throw new PtBookingError(400, 'Cần chọn Coach cho buổi PT.');
    if (initialMembership.package.type === 'MEMBERSHIP' && initialMembership.package.trialPtSessions <= 0) {
      throw new PtBookingError(403, 'Gói Gym này không kèm buổi PT dùng thử.');
    }
    await lockPtCalendar(tx);
    await lockPtCoach(tx, coachId);
    await lockPtMember(tx, input.memberId);
    await lockPtMembership(tx, initialMembership.id);
    await lockGymMember(tx, input.memberId);
    const membership = await tx.membership.findUniqueOrThrow({ where: { id: initialMembership.id }, include: { package: true } });
    if (membership.package.type === 'PT' && membership.coachId !== coachId) throw new PtBookingError(409, 'Coach của gói PT đã thay đổi.');
    if (membership.status !== 'ACTIVE') throw new PtBookingError(409, 'Gói PT không còn hiệu lực.');
    const reserved = await reservedPtSessions(tx, membership.id);
    if ((membership.remainingSessions ?? 0) - reserved < starts.length) {
      throw new PtBookingError(409, 'Số buổi PT có thể đặt không đủ cho các ca đã chọn.');
    }
    const bookings = [];
    for (const start of starts) {
      try {
        const end = await requirePtSlot(tx, coachId, input.memberId, start);
        await requireGymOnDate(tx, input.memberId, start, end);
        if (membership.startDate > start || membership.endDate < end) {
          throw new PtBookingError(409, 'Ca nằm ngoài thời hạn của gói PT.');
        }
        bookings.push(await tx.booking.create({ data: {
          type: 'PT', memberId: input.memberId, coachId, membershipId: membership.id,
          startTime: start, endTime: end, status: 'CONFIRMED',
        } }));
      } catch (error) {
        if (error instanceof PtBookingError) {
          throw new PtBookingError(error.status, `Ca ${start.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}: ${error.message}`);
        }
        throw error;
      }
    }
    return bookings;
  }, { maxWait: 15000, timeout: 60000 });
}
