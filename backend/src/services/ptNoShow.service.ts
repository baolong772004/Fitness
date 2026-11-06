import prisma from '../config/prisma.js';
import { debitPtSession, lockPtCalendar, lockPtCoach, lockPtMember, lockPtMembership } from './ptBooking.service.js';
import { refundConsumedPtCredit, releasePtCredit, settlePtCredit } from './ptWallet.service.js';
import { lockGymMember } from './gymMembershipLock.service.js';
import { createUserNotification } from './notification.service.js';
import { emitCoachScheduleChanged, emitUserNotification } from '../sockets/ptChat.socket.js';
import { verifiedGymPayment } from './gymEntitlement.service.js';
import { beginPtAttendanceReview, escalatePtAttendanceReview } from './ptAttendance.service.js';
import { captureMakeupAvailability, hadNotifiedSuitableSlot } from './ptMakeupAvailability.service.js';

const NO_SHOW_GRACE_MS = 15 * 60 * 1000;
const SCAN_INTERVAL_MS = 60 * 1000;

export async function isPtAbsenceSchemaReady() {
  const rows = await prisma.$queryRaw<Array<{ ready: number }>>`
    SELECT CASE WHEN OBJECT_ID(N'dbo.PtAttendanceReview', N'U') IS NOT NULL
      AND OBJECT_ID(N'dbo.PtAttendanceReviewEvent', N'U') IS NOT NULL
      AND OBJECT_ID(N'dbo.PtMakeUpEvent', N'U') IS NOT NULL
      AND COL_LENGTH(N'dbo.MakeUpRequest', N'cause') IS NOT NULL
      AND COL_LENGTH(N'dbo.MakeUpRequest', N'chainRootBookingId') IS NOT NULL
      AND COL_LENGTH(N'dbo.MakeUpRequest', N'requestedCoachId') IS NOT NULL
      AND COL_LENGTH(N'dbo.MakeUpRequest', N'requestedStartAt') IS NOT NULL
      AND COL_LENGTH(N'dbo.MakeUpRequest', N'requestReason') IS NOT NULL
      AND COL_LENGTH(N'dbo.MakeUpRequest', N'coachChangeRequestedAt') IS NOT NULL
      THEN 1 ELSE 0 END AS ready
  `;
  return rows[0]?.ready === 1;
}

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
    const protectedMakeup = booking.isMakeup && Boolean(await tx.makeUpRequest.findFirst({ where: {
      newBookingId: booking.id, cause: 'COACH', status: 'APPROVED',
    }, select: { id: true } }));
    const trialValid = protectedMakeup || batch.level !== 'TRIAL' || (gift &&
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

export async function expireMakeupRight(requestId: number, cutoff: Date) {
  const initial = await prisma.makeUpRequest.findUnique({ where: { id: requestId },
    select: { originalBooking: { select: { coachId: true, memberId: true, membershipId: true } } } });
  if (!initial) return null;
  const result = await prisma.$transaction(async (tx) => {
    await lockPtCalendar(tx);
    if (initial.originalBooking.coachId) await lockPtCoach(tx, initial.originalBooking.coachId);
    await lockPtMember(tx, initial.originalBooking.memberId);
    await lockGymMember(tx, initial.originalBooking.memberId);
    if (initial.originalBooking.membershipId) await lockPtMembership(tx, initial.originalBooking.membershipId);
    const request = await tx.makeUpRequest.findUniqueOrThrow({
      where: { id: requestId }, include: { originalBooking: true },
    });
    if (request.status !== 'PENDING' || request.expiresAt > cutoff ||
      (request.cause === 'COACH' && (request.requestedCoachId || request.escalatedAt))) return null;
    const coachRight = request.cause === 'COACH';
    const hadSlot = coachRight && request.originalBooking.coachId ?
      await hadNotifiedSuitableSlot(tx, { coachId: request.assignedCoachId ?? request.originalBooking.coachId,
        memberId: request.originalBooking.memberId, evidence: request.slotEvidence,
        deadline: request.expiresAt }) : false;
    const extend = coachRight && !hadSlot && request.extensionCount === 0;
    const escalate = coachRight && !hadSlot && request.extensionCount > 0;
    const nextStatus = escalate ? 'ESCALATED' : extend ? 'PENDING' : 'EXPIRED';
    const nextExpiry = extend ? new Date(Math.max(cutoff.getTime(), request.expiresAt.getTime()) + 7 * 86400000) : request.expiresAt;
    const claimed = await tx.makeUpRequest.updateMany({ where: {
      id: requestId, status: 'PENDING', expiresAt: { lte: cutoff },
    }, data: { status: nextStatus, expiresAt: nextExpiry,
      extensionCount: extend ? 1 : request.extensionCount, escalatedAt: escalate ? cutoff : request.escalatedAt } });
    if (claimed.count !== 1) return null;
    const action = extend ? 'SYSTEM_EXTENDED_7_DAYS' : escalate ? 'SYSTEM_ESCALATED_ADMIN' : 'SYSTEM_RIGHT_EXPIRED';
    await tx.ptMakeUpEvent.create({ data: { requestId, action,
      details: JSON.stringify({ hadNotifiedSuitableSlot: hadSlot, previousExpiry: request.expiresAt.toISOString(),
        nextExpiry: nextExpiry.toISOString(), evidence: request.slotEvidence }).slice(0, 1000) } });
    if (nextStatus === 'EXPIRED') {
      const allocation = await tx.ptBookingCreditAllocation.findUnique({ where: { bookingId: request.originalBookingId } });
      if (allocation && !await releasePtCredit(tx, request.originalBookingId)) {
        throw new Error(`Quyền học bù #${requestId} không thể hoàn Credit đang giữ.`);
      }
    }
    const message = extend ? 'Coach/Gym chưa có ca phù hợp; quyền học bù được gia hạn thêm 7 ngày một lần.' :
      escalate ? 'Vẫn chưa có ca phù hợp; quyền học bù và Credit đang giữ được chuyển Admin xử lý.' :
        'Quyền học bù đã hết hạn sau khi có ca phù hợp được thông báo; Credit trở lại lô ban đầu nếu còn hiệu lực.';
    const notification = await tx.notification.create({ data: {
      userId: request.originalBooking.memberId, title: 'Cập nhật quyền học bù PT', message,
    } });
    const notifications = [{ userId: request.originalBooking.memberId, notification }];
    if (escalate) {
      const admins = await tx.user.findMany({ where: { role: 'ADMIN', status: 'ACTIVE' }, select: { id: true } });
      for (const admin of admins) {
        const alert = await tx.notification.create({ data: { userId: admin.id,
          title: 'PT học bù cần Admin sắp xếp', message: `Quyền #${requestId} không có ca sau lần gia hạn.` } });
        notifications.push({ userId: admin.id, notification: alert });
      }
    }
    return { notifications, status: nextStatus };
  }, { isolationLevel: 'Serializable', maxWait: 15000, timeout: 20000 });
  if (result) for (const row of result.notifications) emitUserNotification(row.userId, row.notification);
  return result;
}

export async function markPtNoShow(bookingId: number, cutoff: Date) {
  return beginPtAttendanceReview(bookingId, cutoff);
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
  let warnedMissingSchema = false;

  const scan = async () => {
    if (running) return;
    running = true;
    try {
      if (!await isPtAbsenceSchemaReady()) {
        if (!warnedMissingSchema) {
          console.warn('PT absence worker paused: PT absence/makeup migrations 20261109 and 20261110 are required. No PT attendance or make-up job will run.');
          warnedMissingSchema = true;
        }
        return;
      }
      warnedMissingSchema = false;
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
        const overdue = await prisma.ptAttendanceReview.findMany({ where: {
          id: { gt: cursor }, status: 'PENDING_COACH', deadlineAt: { lte: new Date() },
        }, select: { id: true }, orderBy: { id: 'asc' }, take: 100 });
        if (!overdue.length) break;
        for (const item of overdue) {
          cursor = item.id;
          try { await escalatePtAttendanceReview(item.id, new Date()); }
          catch (error) { console.error(`Lỗi chuyển Admin đối soát PT #${item.id}:`, error); }
        }
      }
      cursor = 0;
      while (true) {
        const liveRights = await prisma.makeUpRequest.findMany({ where: {
          id: { gt: cursor }, status: 'PENDING', cause: 'COACH',
          requestedCoachId: null, expiresAt: { gt: new Date() },
        }, select: { id: true }, orderBy: { id: 'asc' }, take: 100 });
        if (!liveRights.length) break;
        for (const item of liveRights) {
          cursor = item.id;
          try { await captureMakeupAvailability(item.id); }
          catch (error) { console.error(`Lỗi lưu ca học bù #${item.id}:`, error); }
        }
      }
      cursor = 0;
      while (true) {
        const expired = await prisma.makeUpRequest.findMany({ where: {
          id: { gt: cursor }, status: 'PENDING', expiresAt: { lte: new Date() },
          OR: [{ cause: { not: 'COACH' } }, { requestedCoachId: null, escalatedAt: null }],
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
