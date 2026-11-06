import prisma from '../config/prisma.js';
import { debitPtSession, lockPtMember, lockPtMembership, PtBookingError } from './ptBooking.service.js';
import { refundConsumedPtCredit, releasePtCredit, settlePtCredit } from './ptWallet.service.js';
import { createUserNotification } from './notification.service.js';

const DAY_MS = 86400000;

export async function beginPtAttendanceReview(bookingId: number, cutoff: Date) {
  const initial = await prisma.booking.findUnique({ where: { id: bookingId },
    select: { memberId: true, membershipId: true, coachId: true } });
  if (!initial) return null;
  const result = await prisma.$transaction(async tx => {
    await lockPtMember(tx, initial.memberId);
    if (initial.membershipId) await lockPtMembership(tx, initial.membershipId);
    const now = new Date();
    const allocation = await tx.ptBookingCreditAllocation.findUnique({ where: { bookingId } });
    if (allocation ? allocation.status !== 'HELD' : !initial.membershipId) {
      throw new PtBookingError(409, 'Buổi PT không có Credit đang giữ để đối soát.');
    }
    const claimed = await tx.booking.updateMany({ where: {
      id: bookingId, type: 'PT', status: 'CONFIRMED', endTime: { lte: cutoff },
    }, data: { status: 'PENDING_ATTENDANCE_REVIEW', sessionQrToken: null } });
    if (claimed.count !== 1) return null;
    const review = await tx.ptAttendanceReview.create({ data: {
      bookingId, status: 'PENDING_COACH', deadlineAt: new Date(now.getTime() + DAY_MS),
      events: { create: { action: 'SYSTEM_REVIEW_STARTED', details: `Grace ended at ${cutoff.toISOString()}` } },
    } });
    return { review, ...initial };
  }, { isolationLevel: 'Serializable', maxWait: 15000, timeout: 20000 });
  if (result) await Promise.allSettled([
    createUserNotification({ userId: result.memberId, title: 'Buổi PT đang đối soát điểm danh',
      message: 'Chưa ghi nhận check-in. Credit vẫn được giữ trong lúc Coach xác nhận trong 24 giờ.' }),
    ...(result.coachId ? [createUserNotification({ userId: result.coachId,
      title: 'Xác nhận điểm danh PT', message: `Vui lòng xác nhận buổi PT #${bookingId} trong 24 giờ.` })] : []),
  ]);
  return result;
}

export async function decidePtAttendanceByCoach(input: {
  bookingId: number; coachId: number; decision: 'ATTENDED' | 'NO_SHOW'; note: string;
}) {
  const initial = await prisma.booking.findUnique({ where: { id: input.bookingId },
    select: { memberId: true, coachId: true, membershipId: true } });
  if (!initial || initial.coachId !== input.coachId) throw new PtBookingError(403, 'Không có quyền xác nhận buổi PT này.');
  const result = await prisma.$transaction(async tx => {
    await lockPtMember(tx, initial.memberId);
    if (initial.membershipId) await lockPtMembership(tx, initial.membershipId);
    const now = new Date();
    const review = await tx.ptAttendanceReview.findUnique({ where: { bookingId: input.bookingId } });
    if (!review || review.status !== 'PENDING_COACH' || review.deadlineAt <= now) {
      throw new PtBookingError(409, 'Đã hết thời gian Coach xác nhận; Admin sẽ đối soát.');
    }
    const claimed = await tx.booking.updateMany({ where: {
      id: input.bookingId, status: 'PENDING_ATTENDANCE_REVIEW',
    }, data: { status: input.decision === 'ATTENDED' ? 'COMPLETED' : 'NO_SHOW',
      absenceReason: input.decision === 'NO_SHOW' ? input.note || 'Coach xác nhận vắng' : null,
      cancelledBy: input.decision === 'NO_SHOW' ? 'COACH_NO_SHOW' : null } });
    if (claimed.count !== 1) throw new PtBookingError(409, 'Buổi PT đã được xử lý.');
    const allocation = await tx.ptBookingCreditAllocation.findUnique({ where: { bookingId: input.bookingId } });
    if (allocation) await settlePtCredit(tx, input.bookingId);
    else if (initial.membershipId) await debitPtSession(tx, initial.membershipId);
    else throw new PtBookingError(409, 'Buổi PT không có nguồn Credit.');
    await tx.ptAttendanceReview.update({ where: { id: review.id }, data: {
      status: input.decision, coachDecision: input.decision, coachNote: input.note,
      coachReviewedAt: now,
    } });
    await tx.ptAttendanceReviewEvent.create({ data: { reviewId: review.id, actorId: input.coachId,
      action: `COACH_${input.decision}`, details: input.note } });
    return await tx.booking.findUniqueOrThrow({ where: { id: input.bookingId } });
  }, { isolationLevel: 'Serializable', maxWait: 15000, timeout: 20000 });
  await createUserNotification({ userId: result.memberId, title: 'Điểm danh PT đã xác nhận',
    message: input.decision === 'ATTENDED' ? 'Coach xác nhận bạn đã tham gia; buổi PT đã được tính.' :
      'Coach xác nhận bạn vắng; một buổi PT đã được tính. Liên hệ Admin nếu cần đối soát.' })
    .catch(error => console.error('PT attendance notification failed:', error));
  return result;
}

export async function escalatePtAttendanceReview(reviewId: number, cutoff: Date) {
  const initial = await prisma.ptAttendanceReview.findUnique({ where: { id: reviewId },
    select: { booking: { select: { memberId: true, membershipId: true } } } });
  if (!initial) return null;
  const changed = await prisma.$transaction(async tx => {
    await lockPtMember(tx, initial.booking.memberId);
    if (initial.booking.membershipId) await lockPtMembership(tx, initial.booking.membershipId);
    const claimed = await tx.ptAttendanceReview.updateMany({ where: {
      id: reviewId, status: 'PENDING_COACH', deadlineAt: { lte: cutoff },
    }, data: { status: 'PENDING_ADMIN' } });
    if (claimed.count !== 1) return false;
    await tx.ptAttendanceReviewEvent.create({ data: { reviewId, action: 'SYSTEM_ESCALATED_ADMIN' } });
    return true;
  }, { isolationLevel: 'Serializable', maxWait: 15000, timeout: 20000 });
  if (changed) {
    const admins = await prisma.user.findMany({ where: { role: 'ADMIN', status: 'ACTIVE' }, select: { id: true } });
    await Promise.allSettled(admins.map(admin => createUserNotification({ userId: admin.id,
      title: 'PT cần đối soát điểm danh', message: `Review #${reviewId}: Coach chưa xác nhận trong 24 giờ.` })));
  }
  return changed;
}

export async function decidePtAttendanceByAdmin(input: {
  bookingId: number; adminId: number; decision: 'ATTENDED' | 'NO_SHOW' | 'EXCUSED'; note: string;
}) {
  const initial = await prisma.booking.findUnique({ where: { id: input.bookingId },
    select: { memberId: true, membershipId: true } });
  if (!initial) throw new PtBookingError(404, 'Không tìm thấy buổi PT.');
  const booking = await prisma.$transaction(async tx => {
    await lockPtMember(tx, initial.memberId);
    if (initial.membershipId) await lockPtMembership(tx, initial.membershipId);
    const review = await tx.ptAttendanceReview.findUnique({ where: { bookingId: input.bookingId } });
    const current = await tx.booking.findUniqueOrThrow({ where: { id: input.bookingId } });
    if (!review || !['PENDING_ATTENDANCE_REVIEW', 'COMPLETED', 'NO_SHOW'].includes(current.status)) {
      throw new PtBookingError(409, 'Buổi PT không có review có thể điều chỉnh.');
    }
    if (current.status === 'COMPLETED' && input.decision === 'EXCUSED') {
      throw new PtBookingError(409, 'Buổi đã hoàn thành; cần đối soát trước khi hoàn Credit.');
    }
    const nextStatus = input.decision === 'EXCUSED' ? 'ABSENT_EXCUSED' :
      input.decision === 'ATTENDED' ? 'COMPLETED' : 'NO_SHOW';
    if (current.status === nextStatus) throw new PtBookingError(409, 'Quyết định đã được ghi nhận trước đó.');
    const claimed = await tx.booking.updateMany({ where: { id: input.bookingId, status: current.status },
      data: { status: nextStatus, absenceReason: input.note,
        cancelledBy: input.decision === 'NO_SHOW' ? 'ADMIN_NO_SHOW' : 'ADMIN_CORRECTION' } });
    if (claimed.count !== 1) throw new PtBookingError(409, 'Buổi PT vừa được xử lý.');
    const allocation = await tx.ptBookingCreditAllocation.findUnique({ where: { bookingId: input.bookingId } });
    if (current.status === 'PENDING_ATTENDANCE_REVIEW') {
      if (input.decision === 'EXCUSED') {
        if (allocation && !await releasePtCredit(tx, input.bookingId)) throw new PtBookingError(409, 'Credit không còn giữ chỗ.');
        // Membership-only bookings reserve by status; no balance was debited yet.
      } else if (allocation) await settlePtCredit(tx, input.bookingId);
      else if (initial.membershipId) await debitPtSession(tx, initial.membershipId);
      else throw new PtBookingError(409, 'Buổi PT không có nguồn Credit.');
    } else if (current.status === 'NO_SHOW' && input.decision === 'EXCUSED') {
      if (allocation && !await refundConsumedPtCredit(tx, input.bookingId)) throw new PtBookingError(409, 'Credit đã được hoàn.');
      else if (!allocation && initial.membershipId) {
        const membership = await tx.membership.update({ where: { id: initial.membershipId },
          data: { remainingSessions: { increment: 1 } } });
        if (membership.status === 'COMPLETED' && (membership.remainingSessions ?? 0) > 0) {
          await tx.membership.update({ where: { id: membership.id },
            data: { status: membership.endDate > new Date() ? 'ACTIVE' : 'EXPIRED' } });
        }
      }
    }
    await tx.ptAttendanceReview.update({ where: { id: review.id }, data: {
      status: input.decision, adminDecision: input.decision, adminNote: input.note,
      adminReviewedAt: new Date(),
    } });
    await tx.ptAttendanceReviewEvent.create({ data: { reviewId: review.id, actorId: input.adminId,
      action: `ADMIN_${input.decision}`, details: input.note } });
    return tx.booking.findUniqueOrThrow({ where: { id: input.bookingId } });
  }, { isolationLevel: 'Serializable', maxWait: 15000, timeout: 20000 });
  await createUserNotification({ userId: booking.memberId, title: 'Admin đã đối soát điểm danh PT',
    message: `Buổi PT #${input.bookingId}: ${input.decision}. ${input.note}` })
    .catch(error => console.error('PT attendance notification failed:', error));
  return booking;
}
