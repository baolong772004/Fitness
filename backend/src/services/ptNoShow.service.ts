import prisma from '../config/prisma.js';
import { debitPtSession, lockPtCalendar, lockPtCoach, lockPtMember, lockPtMembership } from './ptBooking.service.js';
import { refundConsumedPtCredit, releasePtCredit, settlePtCredit } from './ptWallet.service.js';
import { lockGymMember } from './gymMembershipLock.service.js';
import { createUserNotification } from './notification.service.js';
import { emitCoachScheduleChanged, emitUserNotification } from '../sockets/ptChat.socket.js';
import { verifiedGymPayment } from './gymEntitlement.service.js';

const NO_SHOW_GRACE_MS = 15 * 60 * 1000;
const SCAN_INTERVAL_MS = 60 * 1000;

export async function cancelUncoveredWalletBooking(bookingId: number) {
  const initial = await prisma.booking.findUnique({ where: { id: bookingId },
    select: { coachId: true, memberId: true } });
  if (!initial?.coachId) return;
  const cancelled = await prisma.$transaction(async tx => {
    await lockPtCalendar(tx);
    await lockPtCoach(tx, initial.coachId!);
    await lockPtMember(tx, initial.memberId);
    await lockGymMember(tx, initial.memberId);
    const booking = await tx.booking.findUnique({ where: { id: bookingId }, include: {
      ptCreditAllocation: { include: { batch: { include: { membership: true } } } },
    } });
    if (!booking || booking.status !== 'CONFIRMED' || booking.startTime <= new Date() ||
      booking.ptCreditAllocation?.status !== 'HELD') return null;
    const gym = await tx.membership.findFirst({ where: {
      userId: booking.memberId, status: { in: ['ACTIVE', 'PENDING_ACTIVATION'] },
      startDate: { lte: booking.startTime }, endDate: { gte: booking.endTime },
      package: { type: 'MEMBERSHIP' }, payments: { some: verifiedGymPayment },
    }, select: { id: true } });
    const batch = booking.ptCreditAllocation.batch;
    const gift = batch.membership;
    const trialValid = batch.level !== 'TRIAL' || (gift &&
      ['ACTIVE', 'PENDING_ACTIVATION'].includes(gift.status) &&
      gift.startDate <= booking.startTime && gift.endDate >= booking.endTime);
    if (gym && trialValid) return null;
    const claimed = await tx.booking.updateMany({ where: { id: bookingId, status: 'CONFIRMED' },
      data: { status: 'CANCELLED', cancelledBy: 'SYSTEM_MEMBERSHIP',
        absenceReason: 'Quyền Gym hoặc Trial không còn bao phủ ca tập', sessionQrToken: null } });
    if (claimed.count !== 1) return null;
    await releasePtCredit(tx, bookingId);
    return { memberId: booking.memberId, coachId: booking.coachId! };
  }, { maxWait: 15000, timeout: 30000 });
  if (cancelled) {
    emitCoachScheduleChanged(cancelled.coachId);
    await Promise.all([cancelled.memberId, cancelled.coachId].map(userId =>
      createUserNotification({ userId, title: 'Lịch PT đã hủy',
        message: `Lịch PT #${bookingId} đã hủy vì quyền Gym hoặc Trial không còn bao phủ ca tập. Credit được hoàn giữ chỗ.` })));
  }
}

async function expireMakeupRight(requestId: number, cutoff: Date) {
  const result = await prisma.$transaction(async (tx) => {
    const request = await tx.makeUpRequest.findUnique({
      where: { id: requestId }, include: { originalBooking: true },
    });
    const membershipId = request?.originalBooking.membershipId;
    if (!request) return null;
    if (membershipId) await lockPtMembership(tx, membershipId);
    const claimed = await tx.makeUpRequest.updateMany({ where: {
      id: requestId, status: 'PENDING', expiresAt: { lte: cutoff },
    }, data: { status: 'EXPIRED' } });
    if (claimed.count !== 1) return null;
    await releasePtCredit(tx, request.originalBookingId);
    const notification = await tx.notification.create({ data: {
      userId: request.originalBooking.memberId,
      title: 'Quyền học bù PT đã hết hạn',
      message: 'Bạn không đặt học bù trong 7 ngày. Quyền học bù đã hết hạn; buổi PT chưa bị trừ và vẫn dùng được nếu gói còn hiệu lực.',
    } });
    return { userId: request.originalBooking.memberId, notification };
  }, { isolationLevel: 'Serializable', maxWait: 15000, timeout: 20000 });
  if (result) emitUserNotification(result.userId, result.notification);
  return result;
}

export async function markPtNoShow(bookingId: number, cutoff: Date) {
  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.booking.findUnique({ where: { id: bookingId }, select: { membershipId: true } });
    if (!current) return null;
    if (current.membershipId) await lockPtMembership(tx, current.membershipId);
    const claimed = await tx.booking.updateMany({
      where: {
        id: bookingId,
        type: 'PT',
        status: 'CONFIRMED',
        endTime: { lte: cutoff },
      },
      data: {
        status: 'ABSENT_NO_REFUND',
        absenceReason: 'Tự động ghi nhận vắng vì không check-in buổi PT',
        absenceReportedAt: new Date(),
        cancelledBy: 'SYSTEM_NO_SHOW',
      },
    });
    if (claimed.count === 0) return null;

    const booking = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
    const allocation = await tx.ptBookingCreditAllocation.findUnique({ where: { bookingId } });
    if (allocation) await settlePtCredit(tx, bookingId);
    else if (current.membershipId) await debitPtSession(tx, current.membershipId);
    else throw new Error('PT no-show has no credit allocation');

    const notification = await tx.notification.create({
      data: {
        userId: booking.memberId,
        title: 'Vắng buổi tập PT',
        message: `Bạn không check-in buổi PT lúc ${booking.startTime.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}. Hệ thống đã trừ 1 buổi trong gói.`,
      },
    });

    return { bookingId, debited: true, notification, userId: booking.memberId };
  }, { isolationLevel: 'Serializable', maxWait: 15000, timeout: 20000 });
  if (result) emitUserNotification(result.userId, result.notification);
  return result;
}

export async function resolveAutomaticPtNoShow(
  bookingId: number,
  staffId: number,
  resolution: 'ATTENDED' | 'EXCUSED',
  reason: string,
) {
  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.booking.findUnique({ where: { id: bookingId }, select: { membershipId: true } });
    if (!current) return null;
    if (current.membershipId) await lockPtMembership(tx, current.membershipId);
    const claimed = await tx.booking.updateMany({
      where: {
        id: bookingId,
        type: 'PT',
        status: 'ABSENT_NO_REFUND',
        cancelledBy: 'SYSTEM_NO_SHOW',
      },
      data: {
        status: resolution === 'ATTENDED' ? 'COMPLETED' : 'ABSENT_EXCUSED',
        absenceReason: reason,
        cancelledBy: 'ADMIN_CORRECTION',
      },
    });
    if (claimed.count === 0) return null;

    const booking = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
    if (resolution === 'EXCUSED') {
      const allocation = await tx.ptBookingCreditAllocation.findUnique({ where: { bookingId } });
      if (allocation) await refundConsumedPtCredit(tx, bookingId);
      else if (booking.membershipId !== null) {
        const membership = await tx.membership.update({
          where: { id: booking.membershipId }, data: { remainingSessions: { increment: 1 } },
        });
        if (membership.status === 'COMPLETED' && (membership.remainingSessions ?? 0) > 0) {
          await tx.membership.update({ where: { id: membership.id },
            data: { status: membership.endDate > new Date() ? 'ACTIVE' : 'EXPIRED' } });
        }
      } else throw new Error(`Booking ${bookingId} has no credit source`);
    }

    await tx.actionLog.create({
      data: {
        userId: staffId,
        action: `RESOLVE_PT_NO_SHOW_${resolution}`,
        details: `Booking #${bookingId}: ${reason}`,
      },
    });
    const notification = await tx.notification.create({
      data: {
        userId: booking.memberId,
        title: 'Điều chỉnh buổi PT vắng',
        message: resolution === 'ATTENDED'
          ? `Nhân viên đã xác nhận bạn có tham gia buổi PT lúc ${booking.startTime.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}. Buổi này vẫn được tính vào gói. Lý do: ${reason}`
          : `Nhân viên đã điều chỉnh buổi PT lúc ${booking.startTime.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })} và hoàn lại 1 buổi vào gói. Lý do: ${reason}`,
      },
    });

    return { booking, notification };
  }, { isolationLevel: 'Serializable', maxWait: 15000, timeout: 20000 });
  if (result) emitUserNotification(result.booking.memberId, result.notification);
  return result?.booking ?? null;
}

export function startPtNoShowWorker() {
  let running = false;

  const scan = async () => {
    if (running) return;
    running = true;
    try {
      const cutoff = new Date(Date.now() - NO_SHOW_GRACE_MS);
      let cursor = 0;
      while (true) {
        const candidates = await prisma.booking.findMany({
          where: {
            id: { gt: cursor },
            type: 'PT',
            status: 'CONFIRMED',
            endTime: { lte: cutoff },
          },
          select: { id: true },
          orderBy: { id: 'asc' },
          take: 100,
        });
        if (candidates.length === 0) break;
        for (const candidate of candidates) {
          cursor = candidate.id;
          try {
            await markPtNoShow(candidate.id, cutoff);
          } catch (error) {
            console.error(`Lỗi xử lý PT no-show #${candidate.id}:`, error);
          }
        }
      }
      cursor = 0;
      while (true) {
        const expired = await prisma.makeUpRequest.findMany({ where: {
          id: { gt: cursor }, status: 'PENDING', expiresAt: { lte: new Date() },
        }, select: { id: true }, orderBy: { id: 'asc' }, take: 100 });
        if (expired.length === 0) break;
        for (const item of expired) {
          cursor = item.id;
          try { await expireMakeupRight(item.id, new Date()); }
          catch (error) { console.error(`Lỗi xử lý quyền học bù PT #${item.id}:`, error); }
        }
      }
      cursor = 0;
      while (true) {
        const future = await prisma.ptBookingCreditAllocation.findMany({ where: {
          bookingId: { gt: cursor }, status: 'HELD',
          booking: { status: 'CONFIRMED', startTime: { gt: new Date() } },
        }, select: { bookingId: true }, orderBy: { bookingId: 'asc' }, take: 100 });
        if (!future.length) break;
        for (const item of future) {
          cursor = item.bookingId;
          try { await cancelUncoveredWalletBooking(item.bookingId); }
          catch (error) { console.error(`Lỗi kiểm tra quyền Gym của PT #${item.bookingId}:`, error); }
        }
      }
    } catch (error) {
      console.error('Lỗi quét lịch PT vắng:', error);
    } finally {
      running = false;
    }
  };

  void scan();
  const timer = setInterval(() => void scan(), SCAN_INTERVAL_MS);
  (timer as any).unref?.();
  return () => clearInterval(timer);
}
