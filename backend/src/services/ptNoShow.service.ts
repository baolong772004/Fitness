import { PrismaClient } from '@prisma/client';
import { closePtChatRoom } from '../sockets/ptChat.socket.js';

const prisma = new PrismaClient();
const NO_SHOW_GRACE_MS = 15 * 60 * 1000;
const SCAN_INTERVAL_MS = 60 * 1000;

async function markPtNoShow(bookingId: number, cutoff: Date) {
  const result = await prisma.$transaction(async (tx) => {
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
        cancelledBy: 'SYSTEM_NO_SHOW_NO_DEBIT',
      },
    });
    if (claimed.count === 0) return null;

    const booking = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
    let debited = false;

    if (booking.membershipId !== null) {
      const updated = await tx.membership.updateMany({
        where: {
          id: booking.membershipId,
          remainingSessions: { gt: 0 },
        },
        data: { remainingSessions: { decrement: 1 } },
      });
      debited = updated.count === 1;
      if (debited) {
        const membership = await tx.membership.findUniqueOrThrow({
          where: { id: booking.membershipId },
          select: { remainingSessions: true, package: { select: { type: true } } },
        });
        if (membership.remainingSessions === 0 && membership.package.type === 'PT') {
          await tx.membership.update({
            where: { id: booking.membershipId },
            data: { status: 'COMPLETED' },
          });
        }
        await tx.booking.update({
          where: { id: bookingId },
          data: { cancelledBy: 'SYSTEM_NO_SHOW' },
        });
      }
    }

    await tx.notification.create({
      data: {
        userId: booking.memberId,
        title: 'Vắng buổi tập PT',
        message: debited
          ? `Bạn không check-in buổi PT lúc ${booking.startTime.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}. Hệ thống đã trừ 1 buổi trong gói.`
          : `Bạn không check-in buổi PT lúc ${booking.startTime.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}. Gói hiện không còn lượt để trừ; vui lòng liên hệ quầy lễ tân.`,
      },
    });

    return { bookingId, debited };
  }, { isolationLevel: 'Serializable' });

  if (result) closePtChatRoom(result.bookingId);
  return result;
}

export async function resolveAutomaticPtNoShow(
  bookingId: number,
  staffId: number,
  resolution: 'ATTENDED' | 'EXCUSED',
  reason: string,
) {
  return prisma.$transaction(async (tx) => {
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
  }, { isolationLevel: 'Serializable' });
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
