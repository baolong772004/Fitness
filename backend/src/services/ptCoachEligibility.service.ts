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
