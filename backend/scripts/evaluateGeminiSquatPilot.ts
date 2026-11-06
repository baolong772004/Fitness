// Read-only holdout comparison. Run only against an isolated test database.
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { buildSquatAssessment } from '../src/services/exerciseAssessmentFusion.service.js';

const key = (rep: number, criterion: string) => `${rep}:${criterion}`;
function score(predicted: Set<string>, truth: Map<string, boolean>) {
  let tp = 0; let fp = 0; let fn = 0; let tn = 0;
  for (const [item, needsImprovement] of truth) {
    if (needsImprovement && predicted.has(item)) tp++;
    else if (needsImprovement) fn++;
    else if (predicted.has(item)) fp++;
    else tn++;
  }
  return { tp, fp, fn, tn };
}

async function main() {
  const url = process.env.PT_TEST_DATABASE_URL;
  const databaseName = /(?:^|;)database=([^;]+)/i.exec(url || '')?.[1];
  if (!url || url === process.env.DATABASE_URL || !databaseName || !/test/i.test(databaseName)) {
    throw new Error('PT_TEST_DATABASE_URL must point to a separate SQL Server test database.');
  }
  const prisma = new PrismaClient({ datasources: { db: { url } } });
try {
  const rows = await prisma.exerciseAnalysis.findMany({ where: { evaluationMode: { in: ['EXPERIMENTAL', 'OFFICIAL'] }, exerciseType: 'SQUAT',
    techniqueLabels: { some: {} } }, include: { techniqueLabels: { orderBy: { createdAt: 'asc' } } },
    orderBy: { createdAt: 'desc' }, take: 100 });
  const seenVideos = new Set<string>();
  const cases = rows.flatMap(row => {
    const result = JSON.parse(row.resultJson || '{}');
    if (!(result.visionAnalysis?.status === 'COMPLETED' || result.visionPilot) || result.exerciseVariant !== 'BODYWEIGHT') return [];
    if (!row.videoSha256 || seenVideos.has(row.videoSha256)) return [];
    const latest = new Map<string, boolean>();
    for (const label of row.techniqueLabels) {
      if (label.videoSha256 === row.videoSha256 && label.repNumber != null && ['MEETS', 'IMPROVE'].includes(label.outcome)) {
        latest.set(key(label.repNumber, label.criterionId), label.outcome === 'IMPROVE');
      }
    }
    if (!latest.size) return [];
    seenVideos.add(row.videoSha256);
    const vision = new Set<string>((result.visionAnalysis?.assessments?.filter((item: any) => item.status === 'NEEDS_IMPROVEMENT') || result.visionPilot?.findings || []).map((item: any) => key(item.repNumber, item.criterionId)));
    const rule = new Set<string>((result.provisionalEvaluation?.criteria || result.experimentalEvaluation?.criteria || []).flatMap((criterion: any) =>
      (criterion.predictions || []).filter((item: any) => item.status === 'NEEDS_IMPROVEMENT')
        .map((item: any) => key(Number(item.rep ?? item.repNumber), criterion.id ?? criterion.criterionId))));
    const fusionRows = buildSquatAssessment(result)?.assessment.reps.flatMap(rep => rep.criteria.map(criterion => ({ ...criterion, repNumber: rep.repNumber }))) || [];
    const fusion = new Set(fusionRows.filter(item => item.status === 'NEEDS_IMPROVEMENT').map(item => key(item.repNumber, item.id)));
    return [{ id: row.id, labeledCriteria: latest.size,
      deferred: fusionRows.filter(item => item.status === 'UNABLE_TO_ASSESS' && latest.has(key(item.repNumber, item.id))).length,
      unlabeledVisionFindings: [...vision].filter(item => !latest.has(item)).length,
      vision: score(vision, latest), rule: score(rule, latest), fusion: score(fusion, latest) }];
  }).slice(0, 30);
  const total = (system: 'vision' | 'rule' | 'fusion') => cases.reduce((acc, item) => {
    for (const name of ['tp', 'fp', 'fn', 'tn'] as const) acc[name] += item[system][name];
    return acc;
  }, { tp: 0, fp: 0, fn: 0, tn: 0 });
  const metrics = (counts: ReturnType<typeof total>) => ({ ...counts,
    precision: counts.tp + counts.fp ? counts.tp / (counts.tp + counts.fp) : null,
    recall: counts.tp + counts.fn ? counts.tp / (counts.tp + counts.fn) : null });
  console.log(JSON.stringify({ databaseName, videos: cases.length, status: cases.length >= 20 ? 'READY_FOR_COACH_REVIEW' : 'INSUFFICIENT_COACH_LABELED_VIDEOS',
    vision: metrics(total('vision')), rules: metrics(total('rule')), decisionEngine: metrics(total('fusion')), cases }, null, 2));
} finally { await prisma.$disconnect(); }
}
void main().catch(error => { console.error(error instanceof Error ? error.message : 'Evaluation failed'); process.exitCode = 1; });
