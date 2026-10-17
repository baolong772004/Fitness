import prisma from '../config/prisma.js';
import { debitPtSession, lockPtMembership } from './ptBooking.service.js';

const NO_SHOW_GRACE_MS = 15 * 60 * 1000;
const SCAN_INTERVAL_MS = 60 * 1000;

async function expireMakeupRight(requestId: number, cutoff: Date) {
  return prisma.$transaction(async (tx) => {
    const request = await tx.makeUpRequest.findUnique({
      where: { id: requestId }, include: { originalBooking: true },
    });
    const membershipId = request?.originalBooking.membershipId;
    if (!request || !membershipId) return null;
    await lockPtMembership(tx, membershipId);
    const claimed = await tx.makeUpRequest.updateMany({ where: {
      id: requestId, status: 'PENDING', expiresAt: { lte: cutoff },
    }, data: { status: 'EXPIRED' } });
    if (claimed.count !== 1) return null;
    await tx.notification.create({ data: {
      userId: request.originalBooking.memberId,
      title: 'Quyền học bù PT đã hết hạn',
      message: 'Bạn không đặt học bù trong 7 ngày. Quyền học bù đã hết hạn; buổi PT chưa bị trừ và vẫn dùng được nếu gói còn hiệu lực.',
    } });
    return requestId;
  }, { isolationLevel: 'Serializable', maxWait: 15000, timeout: 20000 });
}

async function markPtNoShow(bookingId: number, cutoff: Date) {
  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.booking.findUnique({ where: { id: bookingId }, select: { membershipId: true } });
    if (!current?.membershipId) return null;
    await lockPtMembership(tx, current.membershipId);
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
    await debitPtSession(tx, current.membershipId);

    await tx.notification.create({
      data: {
        userId: booking.memberId,
        title: 'Vắng buổi tập PT',
        message: `Bạn không check-in buổi PT lúc ${booking.startTime.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}. Hệ thống đã trừ 1 buổi trong gói.`,
      },
    });

    return { bookingId, debited: true };
  }, { isolationLevel: 'Serializable', maxWait: 15000, timeout: 20000 });

  return result;
}

export async function resolveAutomaticPtNoShow(
  bookingId: number,
  staffId: number,
  resolution: 'ATTENDED' | 'EXCUSED',
  reason: string,
) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.booking.findUnique({ where: { id: bookingId }, select: { membershipId: true } });
    if (!current?.membershipId) return null;
    await lockPtMembership(tx, current.membershipId);
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
    if (booking.membershipId === null) {
      throw new Error(`Booking ${bookingId} đã bị trừ buổi nhưng không có gói PT`);
    }

    if (resolution === 'EXCUSED') {
      const membership = await tx.membership.update({
        where: { id: booking.membershipId },
        data: { remainingSessions: { increment: 1 } },
      });
      if (membership.status === 'COMPLETED' && (membership.remainingSessions ?? 0) > 0) {
        await tx.membership.update({
          where: { id: membership.id },
          data: { status: membership.endDate > new Date() ? 'ACTIVE' : 'EXPIRED' },
        });
      }
    }

    await tx.actionLog.create({
      data: {
        userId: staffId,
        action: `RESOLVE_PT_NO_SHOW_${resolution}`,
        details: `Booking #${bookingId}: ${reason}`,
      },
    });
    await tx.notification.create({
      data: {
        userId: booking.memberId,
        title: 'Điều chỉnh buổi PT vắng',
        message: resolution === 'ATTENDED'
          ? `Nhân viên đã xác nhận bạn có tham gia buổi PT lúc ${booking.startTime.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}. Buổi này vẫn được tính vào gói. Lý do: ${reason}`
          : `Nhân viên đã điều chỉnh buổi PT lúc ${booking.startTime.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })} và hoàn lại 1 buổi vào gói. Lý do: ${reason}`,
      },
    });

    return booking;
  }, { isolationLevel: 'Serializable', maxWait: 15000, timeout: 20000 });
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
    } catch (error) {
      console.error('Lỗi quét lịch PT vắng:', error);
    } finally {
      running = false;
    }
  };

  void scan();
  const timer = setInterval(() => void scan(), SCAN_INTERVAL_MS);
  timer.unref();
  return () => clearInterval(timer);
}
