import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
try {
  const [labels, reviews, approvedReviews, jobs] = await Promise.all([
    prisma.exerciseTechniqueCoachLabel.count(),
    prisma.exerciseTechniqueCriterionReview.count(),
    prisma.exerciseTechniqueCriterionReview.count({ where: { status: 'APPROVED_AND_VIDEO_VALIDATED' } }),
    prisma.exerciseAnalysis.groupBy({ by: ['exerciseType', 'evaluationMode', 'status'], _count: { id: true } }),
  ]);
  console.log(JSON.stringify({ coachLabels: labels, criterionReviews: reviews,
    approvedVideoValidatedReviews: approvedReviews,
    jobs: jobs.map(row => ({ exercise: row.exerciseType, mode: row.evaluationMode,
      status: row.status, count: row._count.id })) }, null, 2));
} finally { await prisma.$disconnect(); }
