// Read-only audit of real Coach access and the current validation blocker.
import 'dotenv/config';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const analysisId = Number(process.argv[2] || 18);
const now = new Date();

async function trainingRelation(coachId, memberId) {
  const batches = await prisma.ptCreditBatch.findMany({ where: {
    wallet: { memberId }, coachId, source: { in: ['PACKAGE_PURCHASE', 'SINGLE_PURCHASE'] },
    OR: [{ startAt: null }, { startAt: { lte: now } }],
    AND: [{ OR: [{ endAt: null }, { endAt: { gt: now } }] }],
  }, select: { initialCount: true, usedCount: true } });
  if (batches.some(batch => batch.initialCount > batch.usedCount)) return true;
  if (await prisma.booking.findFirst({ where: { memberId, coachId, type: 'PT',
    status: { in: ['CONFIRMED', 'IN_PROGRESS', 'MAKEUP_BOOKED'] }, endTime: { gt: now } }, select: { id: true } })) return true;
  return !!await prisma.membership.findFirst({ where: { userId: memberId, coachId,
    package: { type: 'PT' }, status: 'ACTIVE', startDate: { lte: now }, endDate: { gt: now },
    OR: [{ remainingSessions: null }, { remainingSessions: { gt: 0 } }] }, select: { id: true } });
}

try {
  const [coaches, analysis, labels, reviews, approved] = await Promise.all([
    prisma.user.findMany({ where: { role: { in: ['COACH', 'TRAINER'] } },
      select: { id: true, fullName: true, role: true, status: true, coachProfile: { select: { status: true } } },
      orderBy: { id: 'asc' } }),
    prisma.exerciseAnalysis.findUnique({ where: { id: analysisId },
      include: { shares: { select: { coachId: true, includeVideo: true, revokedAt: true } },
        techniqueLabels: { select: { criterionId: true, outcome: true, coachId: true } } } }),
    prisma.exerciseTechniqueCoachLabel.count(),
    prisma.exerciseTechniqueCriterionReview.count(),
    prisma.exerciseTechniqueCriterionReview.count({ where: { status: 'APPROVED_AND_VIDEO_VALIDATED' } }),
  ]);
  const videoAvailable = analysis && !!analysis.mediaStorageKey && !analysis.mediaDeletedAt
    && analysis.createdAt.getTime() > now.getTime() - 7 * 24 * 60 * 60_000;
  const videoFilePresent = analysis?.mediaStorageKey
    ? existsSync(path.resolve(process.cwd(), 'private-exercise-media', analysis.mediaStorageKey)) : false;
  const eligibleCoaches = analysis ? await Promise.all(coaches.map(async coach => ({
    id: coach.id, fullName: coach.fullName, accountStatus: coach.status,
    profileStatus: coach.coachProfile?.status || null,
    activePtRelation: await trainingRelation(coach.id, analysis.memberId),
    share: analysis.shares.find(row => row.coachId === coach.id && !row.revokedAt) || null,
  }))) : [];
  const result = analysis?.resultJson ? JSON.parse(analysis.resultJson) : null;
  console.log(JSON.stringify({ auditedAt: now.toISOString(), analysis: analysis && {
    id: analysis.id, memberId: analysis.memberId, status: analysis.status,
    evaluationMode: analysis.evaluationMode, exerciseType: analysis.exerciseType,
    createdAt: analysis.createdAt.toISOString(), videoAvailable, videoFilePresent,
    standardVersion: result?.techniqueEvaluation?.referenceStandardVersion || null,
    inputVideoSha256: result?.inputVideoSha256 || null,
    detectedRepetitions: result?.detectedRepetitions ?? null,
    detectedCameraView: result?.cameraView?.detected || null,
    protocol: result?.protocol || null,
    durationSeconds: result?.video?.durationSeconds ?? null,
    shares: analysis.shares, labels: analysis.techniqueLabels,
  }, coaches: eligibleCoaches, totals: { coachLabels: labels, criterionReviews: reviews,
    approvedVideoValidatedReviews: approved } }, null, 2));
} finally {
  await prisma.$disconnect();
}
