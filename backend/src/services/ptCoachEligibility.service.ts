import type { Prisma } from '@prisma/client';
import { PtBookingError } from './ptError.js';

/** Shared validation only. Each change flow owns its own transaction and data updates. */
export async function requireQualifiedPtCoach(
  tx: Prisma.TransactionClient, coachId: number, level: string, conflictStatus = 409,
) {
  const profile = await tx.coachProfile.findUnique({ where: { userId: coachId },
    include: { user: { select: { status: true, role: true } },
      specializations: { select: { level: true } } } });
  if (!profile || profile.status !== 'ACTIVE' || profile.user.status !== 'ACTIVE' ||
    !['COACH', 'TRAINER'].includes(profile.user.role) ||
    !profile.specializations.some(item => item.level === level)) {
    throw new PtBookingError(conflictStatus, 'HLV không hoạt động hoặc không đủ chuyên môn cho cấp PT này.');
  }
  return profile;
}

/** Ensures a coach has no upcoming bookings, pending makeup rights, or remaining PT batches for removed levels. */
export async function assertCoachCanRemovePtLevels(
  tx: Prisma.TransactionClient,
  coachUserId: number,
  removedLevels: string[],
  now = new Date(),
) {
  if (!removedLevels.length) return;

  const affectedBooking = await tx.booking.findFirst({
    where: {
      coachId: coachUserId,
      type: 'PT',
      status: { in: ['PENDING', 'UPCOMING', 'CONFIRMED', 'IN_PROGRESS', 'MAKEUP_BOOKED'] },
      endTime: { gt: now },
      ptCreditAllocation: { is: { batch: { level: { in: removedLevels } } } },
    },
    select: { id: true },
  });
  if (affectedBooking) {
    throw new PtBookingError(409, `Coach còn Booking #${affectedBooking.id} ở cấp độ đang xóa.`);
  }

  const pendingMakeup = await tx.makeUpRequest.findFirst({
    where: {
      status: { in: ['PENDING', 'ESCALATED'] },
      expiresAt: { gt: now },
      OR: [
        { assignedCoachId: coachUserId },
        { assignedCoachId: null, originalBooking: { coachId: coachUserId } },
      ],
      originalBooking: {
        ptCreditAllocation: { is: { batch: { level: { in: removedLevels } } } },
      },
    },
    select: { id: true },
  });
  if (pendingMakeup) {
    throw new PtBookingError(409, `Không thể gỡ cấp độ: HLV còn yêu cầu học bù #${pendingMakeup.id} chưa hoàn tất.`);
  }

  const batches = await tx.ptCreditBatch.findMany({
    where: {
      coachId: coachUserId,
      level: { in: removedLevels },
      OR: [{ endAt: null }, { endAt: { gt: now } }],
    },
    select: {
      id: true,
      level: true,
      initialCount: true,
      usedCount: true,
      wallet: { select: { member: { select: { fullName: true } } } },
    },
  });
  const activeBatch = batches.find((b) => b.initialCount - b.usedCount > 0);
  if (activeBatch) {
    const owner = activeBatch.wallet?.member?.fullName || 'học viên';
    throw new PtBookingError(
      409,
      `Không thể gỡ cấp độ ${activeBatch.level}: HLV đang phụ trách gói PT còn buổi của ${owner}.`,
    );
  }
}
