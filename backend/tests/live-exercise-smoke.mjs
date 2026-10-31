/** One temporary developer job through the running local Backend, Worker, AI, and SQL database. */
import 'dotenv/config';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

if (!process.argv.includes('--live-local') || process.env.NODE_ENV === 'production'
    || process.env.AI_EXPERIMENTAL_EVALUATION !== 'true'
    || !/^sqlserver:\/\/(localhost|127\.0\.0\.1)(?=[:;\\])/i.test(process.env.DATABASE_URL || '')) {
  throw new Error('Explicit --live-local, a localhost SQL database, and development experimental mode are required');
}
const prisma = new PrismaClient();
let userId = null;
let jobId = null;
let mediaKey = null;
try {
  const video = await readFile(path.resolve('../ai-exercise-service/samples/front-facing-squat-pexels-5034577.mp4'));
  const videoSha256 = createHash('sha256').update(video).digest('hex');
  const historical = await prisma.exerciseAnalysis.findUniqueOrThrow({ where: { id: 12 } });
  const historicalResult = JSON.parse(historical.resultJson || '{}');
  assert.equal(historicalResult.inputVideoSha256, videoSha256, 'Expected exact video from analysis #12');
  const aiHealth = await (await fetch(`${process.env.AI_SERVICE_URL || 'http://127.0.0.1:8001'}/health`)).json();
  assert.equal(aiHealth.ready, true);
  assert.equal(aiHealth.experimentalEvaluationEnabled, true);
  const user = await prisma.user.create({ data: { email: `live-tech-audit-${randomUUID()}@example.invalid`,
    password: 'TEST_UNUSED', fullName: 'TEMPORARY TECHNIQUE AUDIT', role: 'ADMIN', status: 'ACTIVE' } });
  userId = user.id;
  const headers = { Authorization: `Bearer ${jwt.sign({ userId, role: 'ADMIN' }, process.env.JWT_SECRET || 'default_secret')}` };
  const form = new FormData();
  form.append('video', new Blob([video]), 'same-as-12.mp4');
  form.append('consent', 'true'); form.append('exerciseType', 'SQUAT');
  form.append('exerciseVariant', 'BODYWEIGHT');
  form.append('analysisOptions', JSON.stringify({ cameraView: 'FRONT', depthTarget: 'NONE', descentTargetSeconds: null }));
  const endpoint = 'http://127.0.0.1:5000/api/exercise-analysis/developer';
  const upload = await fetch(endpoint, { method: 'POST', headers, body: form });
  if (upload.status !== 202) throw new Error(`Live Backend upload returned ${upload.status}: ${(await upload.text()).slice(0, 200)}`);
  const queued = (await upload.json()).data;
  jobId = queued.id;
  assert.equal(queued.evaluationMode, 'EXPERIMENTAL');
  let stored;
  for (let i = 0; i < 120; i++) {
    stored = await prisma.exerciseAnalysis.findUniqueOrThrow({ where: { id: jobId } });
    if (!['PENDING', 'PROCESSING'].includes(stored.status)) break;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  assert.equal(stored.status, 'COMPLETED');
  mediaKey = stored.mediaStorageKey;
  const sqlResult = JSON.parse(stored.resultJson || '{}');
  const detailResponse = await fetch(`${endpoint}/${jobId}`, { headers });
  assert.equal(detailResponse.status, 200);
  const detail = (await detailResponse.json()).data;
  assert.deepEqual(detail.result.experimentalEvaluation, sqlResult.experimentalEvaluation);
  assert.equal(detail.result.experimentalEvaluation.passedCriteria, 1);
  assert.equal(detail.result.techniqueEvaluation.passedCriteria, 0);
  const criterion = detail.result.experimentalEvaluation.criteria.find(row => row.criterionId === 'SQUAT-03');
  assert.equal(criterion.predictions.length, 10);
  const first = criterion.predictions[0];
  assert.ok(first.landmarkEvidence.length >= 3);
  const projection = { testedAt: new Date().toISOString(), videoSha256,
    historical12: { id: historical.id, mode: historical.evaluationMode,
      resultVersion: historical.resultVersion, experimental: historicalResult.experimentalEvaluation || null },
    aiHealth: { ready: aiHealth.ready, ruleVersion: aiHealth.ruleVersion,
      techniqueEngineVersion: aiHealth.techniqueEngineVersion, experimentalEvaluationEnabled: aiHealth.experimentalEvaluationEnabled },
    queued: { id: queued.id, status: queued.status, evaluationMode: queued.evaluationMode },
    workerSql: { id: stored.id, status: stored.status, evaluationMode: stored.evaluationMode,
      ruleVersion: stored.ruleVersion, resultVersion: stored.resultVersion,
      experimentalPassed: sqlResult.experimentalEvaluation.passedCriteria,
      experimentalImproved: sqlResult.experimentalEvaluation.needsImprovementCriteria },
    backendDetail: { id: detail.id, status: detail.status, evaluationMode: detail.evaluationMode,
      experimentalPassed: detail.result.experimentalEvaluation.passedCriteria,
      experimentalImproved: detail.result.experimentalEvaluation.needsImprovementCriteria,
      criterionId: criterion.criterionId, predictionCount: criterion.predictions.length,
      firstPrediction: { status: first.status, bodyPart: first.bodyPart, repNumber: first.repNumber,
        timestampSeconds: first.timestampSeconds, observedValue: first.observedValue,
        threshold: first.threshold, landmarkEvidenceFrames: first.landmarkEvidence.length } },
    temporaryJobRemovedAfterCapture: true };
  await mkdir('tests/artifacts', { recursive: true });
  await writeFile('tests/artifacts/live-runtime-experimental.json', JSON.stringify(projection, null, 2));
  console.log(JSON.stringify(projection, null, 2));
} finally {
  if (jobId != null) {
    const row = await prisma.exerciseAnalysis.findUnique({ where: { id: jobId } }).catch(() => null);
    if (row?.mediaStorageKey) mediaKey = row.mediaStorageKey;
    await prisma.exerciseAnalysis.deleteMany({ where: { id: jobId, memberId: userId ?? -1 } });
  }
  if (mediaKey) await unlink(path.resolve('private-exercise-media', mediaKey)).catch(() => undefined);
  if (userId != null) await prisma.user.delete({ where: { id: userId } });
  await prisma.$disconnect();
}
