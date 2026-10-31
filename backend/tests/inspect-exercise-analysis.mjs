import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
try {
  const id = process.argv[2] === 'latest'
    ? (await prisma.exerciseAnalysis.findFirst({ orderBy: { id: 'desc' }, select: { id: true } }))?.id
    : Number(process.argv[2]);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Pass a positive analysis ID or latest');
  const row = await prisma.exerciseAnalysis.findUnique({ where: { id }, include: { member: { select: { role: true } } } });
  if (!row) throw new Error('Analysis not found');
  const result = JSON.parse(row.resultJson || '{}');
  const activeVideoShares = await prisma.exerciseAnalysisSharing.count({ where: {
    analysisId: id, revokedAt: null, includeVideo: true,
  } });
  const approvedCriteria = await prisma.exerciseTechniqueCriterionReview.count({ where: {
    exerciseType: 'SQUAT', status: 'APPROVED_AND_VIDEO_VALIDATED',
  } });
  const coachLabels = await prisma.exerciseTechniqueCoachLabel.count({ where: { analysisId: id } });
  console.log(JSON.stringify({ id, ownerRole: row.member.role, status: row.status,
    evaluationMode: row.evaluationMode, resultVersion: row.resultVersion,
    ruleVersion: row.ruleVersion, createdAt: row.createdAt,
    videoSha256: result.inputVideoSha256,
    durationSeconds: result.video?.durationSeconds,
    hasStoredVideo: !!row.mediaStorageKey && !row.mediaDeletedAt,
    activeVideoShares,
    sampleRateHz: result.video?.sampleRateHz,
    lastPoseSeconds: result.poseFrames?.at(-1)?.timeSeconds,
    official: { passed: result.techniqueEvaluation?.passedCriteria,
      improved: result.techniqueEvaluation?.needsImprovementCriteria,
      measured: result.techniqueEvaluation?.measuredCriteria },
    experimental: result.experimentalEvaluation ? { passed: result.experimentalEvaluation.passedCriteria,
      improved: result.experimentalEvaluation.needsImprovementCriteria } : null,
    provisional: result.provisionalEvaluation ? {
      mode: result.provisionalEvaluation.mode,
      validation: result.provisionalEvaluation.validation,
      ruleVersion: result.provisionalEvaluation.ruleVersion,
      screeningStatus: result.provisionalEvaluation.screeningStatus,
      wholeExerciseStatus: result.provisionalEvaluation.wholeExerciseStatus,
      passed: result.provisionalEvaluation.passedCriteria,
      improved: result.provisionalEvaluation.needsImprovementCriteria,
      unassessable: result.provisionalEvaluation.unassessableCriteria,
      correctionPriorities: result.provisionalEvaluation.correctionPriorities,
      criteria: result.provisionalEvaluation.criteria?.map(item => ({ id: item.criterionId,
        status: item.status, reason: item.reasonCode, predictions: item.predictions?.length || 0 })),
    } : null,
    approvedSquatCriteriaInDatabase: approvedCriteria,
    coachLabelsForAnalysis: coachLabels,
    criteria: result.techniqueEvaluation?.criteria?.map(item => ({ id: item.criterionId,
      status: item.status, reason: item.reasonCode, measurement: !!item.measurement,
      perRep: item.measurement?.perRep?.length || 0 })) }, null, 2));
} finally { await prisma.$disconnect(); }
