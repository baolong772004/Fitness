/** Real HTTP -> worker -> FastAPI -> MediaPipe -> engine -> SQL -> detail contract.
 * Uses public development footage, no fabricated landmarks or Coach labels.
 * This does not claim on-device Mobile UI acceptance or technique accuracy.
 */
import 'dotenv/config';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const testUrl = process.env.PT_TEST_DATABASE_URL;
const name = /(?:^|;)database=([^;]+)/i.exec(testUrl ?? '')?.[1];
if (!testUrl || testUrl === process.env.DATABASE_URL || !name || !/test/i.test(name)) throw new Error('A separate test SQL database is required');
process.env.DATABASE_URL = testUrl;
const [{ default: express }, { default: jwt }, { PrismaClient }, { default: memberRoute }, { default: coachRoute }, { default: appPrisma }, { startExerciseAnalysisWorker }] = await Promise.all([
  import('express'), import('jsonwebtoken'), import('@prisma/client'), import('../src/routes/exerciseAnalysis.route.js'), import('../src/routes/coachExerciseAnalysis.route.js'), import('../src/config/prisma.js'), import('../src/services/exerciseAnalysis.service.js'),
]);
const prisma = new PrismaClient();
const app = express(); app.use(express.json()); app.use('/api/exercise-analysis', memberRoute); app.use('/api/coach/shared-exercise-analyses', coachRoute);
const server = app.listen(0, '127.0.0.1');
await new Promise<void>(resolve => server.once('listening', resolve));
const base = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/exercise-analysis`;
test.after(async () => { await new Promise<void>(resolve => server.close(() => resolve())); await prisma.$disconnect(); await appPrisma.$disconnect(); });

test('real upload/worker persists Squat evidence and read-only standard snapshot', { timeout: 110_000 }, async t => {
  const health = await (await fetch(`${process.env.AI_SERVICE_URL || 'http://127.0.0.1:8001'}/health`)).json() as any;
  assert.equal(health.techniqueEngineVersion, 'technique-evaluation-3', 'Start the updated real AI service before this test');
  const member = await prisma.user.create({ data: { email: `real-ai-${randomUUID()}@example.invalid`, password: 'TEST_UNUSED', fullName: 'TEST ONLY', role: 'MEMBER', status: 'ACTIVE' } });
  let workflowCoachId: number | null = null;
  let secondMemberId: number | null = null;
  const headers = { Authorization: `Bearer ${jwt.sign({ userId: member.id, role: 'MEMBER' }, process.env.JWT_SECRET || 'default_secret')}` };
  t.after(async () => {
    if (workflowCoachId != null) {
      await prisma.exerciseTechniqueCriterionReview.deleteMany({ where: { coachId: workflowCoachId } });
      await prisma.booking.deleteMany({ where: { coachId: workflowCoachId } });
    }
    const rows = await prisma.exerciseAnalysis.findMany({ where: { memberId: member.id } });
    for (const row of rows) if (row.mediaStorageKey) await unlink(path.resolve('private-exercise-media', row.mediaStorageKey)).catch(() => undefined);
    await prisma.exerciseAnalysis.deleteMany({ where: { memberId: member.id } });
    await prisma.user.delete({ where: { id: member.id } });
    if (secondMemberId != null) {
      const extraRows = await prisma.exerciseAnalysis.findMany({ where: { memberId: secondMemberId } });
      for (const extra of extraRows) if (extra.mediaStorageKey) await unlink(path.resolve('private-exercise-media', extra.mediaStorageKey)).catch(() => undefined);
      await prisma.exerciseAnalysis.deleteMany({ where: { memberId: secondMemberId } });
      await prisma.user.delete({ where: { id: secondMemberId } });
    }
    if (workflowCoachId != null) {
      await prisma.coachProfile.deleteMany({ where: { userId: workflowCoachId } });
      await prisma.user.delete({ where: { id: workflowCoachId } });
    }
  });
  const credits = await prisma.ptCreditBatch.count({ where: { wallet: { memberId: member.id } } });
  const video = await readFile(path.resolve('../ai-exercise-service/samples/front-facing-squat-pexels-5034577.mp4'));
  const form = new FormData(); form.append('video', new Blob([video]), 'front.mp4');
  form.append('consent', 'true'); form.append('exerciseType', 'SQUAT'); form.append('exerciseVariant', 'BODYWEIGHT');
  form.append('analysisOptions', JSON.stringify({ cameraView: 'FRONT', depthTarget: 'NONE', descentTargetSeconds: null }));
  const uploaded = await fetch(base, { method: 'POST', headers, body: form });
  assert.equal(uploaded.status, 202);
  const queued = (await uploaded.json() as any).data;
  assert.equal(queued.evaluationMode, 'OFFICIAL');
  assert.equal(queued.videoOrigin, 'SAMPLE');
  assert.equal(queued.performerDeclaration, 'UNKNOWN');
  assert.equal(queued.sourceReference, 'squat-front-pexels-5034577');
  startExerciseAnalysisWorker();
  let row = await prisma.exerciseAnalysis.findUniqueOrThrow({ where: { id: queued.id } });
  for (let poll = 0; poll < 180 && ['PENDING', 'PROCESSING'].includes(row.status); poll++) {
    await new Promise(resolve => setTimeout(resolve, 500));
    row = await prisma.exerciseAnalysis.findUniqueOrThrow({ where: { id: queued.id } });
  }
  assert.equal(row.status, 'COMPLETED');
  assert.equal(row.evaluationMode, 'OFFICIAL');
  assert.equal(row.resultVersion, 'exercise-analysis-result-4');
  const detailResponse = await fetch(`${base}/${row.id}`, { headers });
  assert.equal(detailResponse.status, 200);
  const detail = (await detailResponse.json() as any).data;
  const result = detail.result;
  assert.equal(result.provenance?.videoOrigin, 'SAMPLE');
  assert.equal(result.provenance?.performerIdentityVerified, false);
  assert.equal(result.exerciseVariant, 'BODYWEIGHT');
  assert.equal(result.evaluationMode, 'OFFICIAL');
  assert.equal(result.experimentalEvaluation, undefined);
  assert.equal(result.provisionalEvaluation?.mode, 'PROVISIONAL');
  assert.equal(result.provisionalEvaluation?.validation, 'UNVALIDATED');
  assert.equal(result.provisionalEvaluation?.passedCriteria, 3);
  assert.equal(result.provisionalEvaluation?.screeningStatus, 'NO_ISSUE_DETECTED_IN_ASSESSED_SCOPE');
  assert.equal(result.provisionalEvaluation?.wholeExerciseStatus, 'UNABLE_TO_CONFIRM');
  assert.equal(result.techniqueEvaluation.passedCriteria, 0);
  assert.deepEqual(result.provisionalEvaluation, JSON.parse(row.resultJson || '{}').provisionalEvaluation);
  assert.equal(result.detectedRepetitions, 5);
  assert.equal(result.poseFrames.length, 165);
  assert.equal(result.techniqueEvaluation.criteria.length, 8);
  assert.equal(result.techniqueEvaluation.measuredCriteria, 5);
  assert.equal(result.techniqueEvaluation.referenceStandardVersion, 'bodyweight-squat-1.0.0-draft');
  assert.equal(result.techniqueEvaluation.standardSnapshot.approvedByCoach, null);
  assert.ok(result.techniqueEvaluation.criteria.some((c: any) => c.criterionId === 'SQUAT-05' && c.measurement.perRep.length === 5));
  assert.ok(result.techniqueEvaluation.criteria.every((c: any) => !['MEETS_CRITERION', 'NEEDS_IMPROVEMENT'].includes(c.status)));
  assert.equal(await prisma.ptCreditBatch.count({ where: { wallet: { memberId: member.id } } }), credits);
  const history = (await (await fetch(`${base}/my-history`, { headers })).json() as any).data;
  assert.equal(history[0].result.poseFrames, undefined);
  assert.equal(history[0].result.techniqueEvaluation.standardSnapshot, undefined);
  assert.ok(result.modelVersion.startsWith('pose_landmarker_lite-'));
  // Edited side-view development fixture exercises the correction path.
  // Its signal is not evidence of an actual athlete's technique error.
  const sideVideo = await readFile(path.resolve('../ai-exercise-service/samples/squat-variable-depth-test.mp4'));
  const sideForm = new FormData();
  sideForm.append('video', new Blob([sideVideo]), 'side.mp4');
  sideForm.append('consent', 'true'); sideForm.append('exerciseType', 'SQUAT');
  sideForm.append('exerciseVariant', 'BODYWEIGHT');
  sideForm.append('analysisOptions', JSON.stringify({ cameraView: 'SIDE', depthTarget: 'HIP_AT_KNEE', descentTargetSeconds: null }));
  const sideUpload = await fetch(base, { method: 'POST', headers, body: sideForm });
  assert.equal(sideUpload.status, 202);
  const sideId = (await sideUpload.json() as any).data.id;
  let sideRow = await prisma.exerciseAnalysis.findUniqueOrThrow({ where: { id: sideId } });
  for (let poll = 0; poll < 180 && ['PENDING', 'PROCESSING'].includes(sideRow.status); poll++) {
    await new Promise(resolve => setTimeout(resolve, 500));
    sideRow = await prisma.exerciseAnalysis.findUniqueOrThrow({ where: { id: sideId } });
  }
  assert.equal(sideRow.status, 'COMPLETED');
  const sideDetail = (await (await fetch(`${base}/${sideId}`, { headers })).json() as any).data;
  assert.equal(sideDetail.videoOrigin, 'SAMPLE');
  assert.match(sideDetail.sourceReference, /edited/);
  assert.equal(sideDetail.result.techniqueEvaluation.measuredCriteria, 6);
  const { visibleProvisionalEvaluation } = await import('../../mobile-react-native/src/lib/exerciseAnalysisData.js');
  const sidePreview = visibleProvisionalEvaluation(sideDetail, false);
  assert.ok(sidePreview?.needsImprovementCriteria >= 1);
  assert.equal(sidePreview.screeningStatus, 'NEEDS_IMPROVEMENT_DETECTED');
  assert.ok(sidePreview.correctionPriorities.some((item: any) => item.criterionId === 'SQUAT-02'
    && item.repNumber === 2 && item.evidenceFrames >= 3 && item.feedback));
  assert.equal(sideDetail.result.techniqueEvaluation.needsImprovementCriteria, 0);
  const sideDepth = sidePreview.criteria.find((item: any) => item.criterionId === 'SQUAT-02');
  assert.equal(sideDepth.status, 'NEEDS_IMPROVEMENT');
  assert.ok(sideDepth.predictions.some((item: any) => item.observedValue > 0 && item.threshold?.maximum === 0
    && item.landmarkEvidence?.length >= 3 && item.feedback));
  assert.deepEqual(sidePreview, JSON.parse(sideRow.resultJson || '{}').provisionalEvaluation);
  async function analyzeRealSample(filename: string, view: 'SIDE' | 'OBLIQUE', sampleHeaders = headers) {
    const source = await readFile(path.resolve('../ai-exercise-service/samples', filename));
    const body = new FormData(); body.append('video', new Blob([source]), filename);
    body.append('consent', 'true'); body.append('exerciseType', 'SQUAT'); body.append('exerciseVariant', 'BODYWEIGHT');
    body.append('analysisOptions', JSON.stringify({ cameraView: view === 'OBLIQUE' ? 'AUTO' : view,
      depthTarget: 'NONE', descentTargetSeconds: null }));
    const response = await fetch(base, { method: 'POST', headers: sampleHeaders, body });
    assert.equal(response.status, 202);
    const id = (await response.json() as any).data.id;
    let sample = await prisma.exerciseAnalysis.findUniqueOrThrow({ where: { id } });
    for (let poll = 0; poll < 180 && ['PENDING', 'PROCESSING'].includes(sample.status); poll++) {
      await new Promise(resolve => setTimeout(resolve, 500));
      sample = await prisma.exerciseAnalysis.findUniqueOrThrow({ where: { id } });
    }
    assert.equal(sample.status, 'COMPLETED');
    const detail = (await (await fetch(`${base}/${id}`, { headers: sampleHeaders })).json() as any).data;
    assert.equal(detail.videoOrigin, 'SAMPLE');
    assert.equal(detail.performerDeclaration, 'UNKNOWN');
    assert.equal(detail.result.cameraView.detected, view);
    return detail;
  }
  const realSide = await analyzeRealSample('github-side-squat.mp4', 'SIDE');
  assert.equal(realSide.result.techniqueEvaluation.measuredCriteria, 6);
  const secondMember = await prisma.user.create({ data: { email: `real-ai-oblique-${randomUUID()}@example.invalid`,
    password: 'TEST_UNUSED', fullName: 'TEST ONLY', role: 'MEMBER', status: 'ACTIVE' } });
  secondMemberId = secondMember.id;
  const obliqueHeaders = { Authorization: `Bearer ${jwt.sign({ userId: secondMember.id, role: 'MEMBER' }, process.env.JWT_SECRET || 'default_secret')}` };
  const realOblique = await analyzeRealSample('oblique-squat-pexels-8837221.mp4', 'OBLIQUE', obliqueHeaders);
  const obliqueTempo = realOblique.result.provisionalEvaluation.criteria.find((item: any) => item.criterionId === 'SQUAT-05');
  assert.equal(obliqueTempo.status, 'NEEDS_IMPROVEMENT');
  assert.ok(obliqueTempo.predictions.some((item: any) => item.status === 'NEEDS_IMPROVEMENT' && item.landmarkEvidence?.length >= 3));
  assert.equal(realOblique.result.techniqueEvaluation.needsImprovementCriteria, 0);
  // Workflow fixture: a test Coach can persist a label and a content review;
  // neither action counts as real Coach approval or independent validation.
  const coach = await prisma.user.create({ data: { email: `workflow-coach-${randomUUID()}@example.invalid`, password: 'TEST_UNUSED', fullName: 'TEST ONLY', role: 'COACH', status: 'ACTIVE' } });
  workflowCoachId = coach.id;
  await prisma.coachProfile.create({ data: { userId: coach.id, status: 'ACTIVE' } });
  await prisma.booking.create({ data: { memberId: member.id, coachId: coach.id, type: 'PT', status: 'CONFIRMED', startTime: new Date(Date.now() + 3600000), endTime: new Date(Date.now() + 7200000) } });
  const share = await fetch(`${base}/${row.id}/share`, { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify({ coachId: coach.id, includeVideo: true }) });
  assert.equal(share.status, 200);
  const coachHeaders = { Authorization: `Bearer ${jwt.sign({ userId: coach.id, role: 'COACH' }, process.env.JWT_SECRET || 'default_secret')}`, 'content-type': 'application/json' };
  const labelResponse = await fetch(`http://127.0.0.1:${(server.address() as { port: number }).port}/api/coach/shared-exercise-analyses/${row.id}/technique-labels`, {
    method: 'POST', headers: coachHeaders, body: JSON.stringify({ labels: [{ criterionId: 'SQUAT-03', outcome: 'UNASSESSABLE', repNumber: 1,
      startSeconds: 1, endSeconds: 2, reviewerNotes: 'INTEGRATION FIXTURE ONLY', evidence: { testOnly: true } }] }),
  });
  assert.equal(labelResponse.status, 201);
  assert.equal(await prisma.exerciseTechniqueCoachLabel.count({ where: { analysisId: row.id, coachId: coach.id } }), 1);
  const reviewResponse = await fetch(`http://127.0.0.1:${(server.address() as { port: number }).port}/api/coach/shared-exercise-analyses/criteria-review`, {
    method: 'POST', headers: coachHeaders, body: JSON.stringify({ exerciseType: 'SQUAT', exerciseVariant: 'BODYWEIGHT',
      standardVersion: result.techniqueEvaluation.referenceStandardVersion,
      standardDigest: result.techniqueEvaluation.referenceStandardDigest,
      criterionId: 'SQUAT-03', decision: 'CONTENT_REVIEWED_PENDING_VIDEO_VALIDATION',
      qualification: 'INTEGRATION FIXTURE ONLY', reviewRecordId: `TEST-${row.id}`, reviewScope: 'INTEGRATION FIXTURE ONLY',
      approvedConditions: 'INTEGRATION FIXTURE ONLY', proposedThresholds: { maximum: 0.1 } }),
  });
  assert.equal(reviewResponse.status, 201);
  assert.equal((await prisma.exerciseTechniqueCriterionReview.findFirstOrThrow({ where: { coachId: coach.id } })).status, 'COACH_REVIEWED_PENDING_VIDEO_VALIDATION');
  await mkdir('tests/artifacts', { recursive: true });
  await writeFile('tests/artifacts/real-ai-integration.json', JSON.stringify({
    testedAt: new Date().toISOString(), upload: uploaded.status, workerStatus: row.status,
    exercise: result.exercise, variant: result.exerciseVariant, modelVersion: result.modelVersion,
    ruleVersion: row.ruleVersion, standardVersion: result.referenceStandardVersion,
    repetitions: result.detectedRepetitions, poseFrames: result.poseFrames.length,
    criterionResults: result.techniqueEvaluation.criteria.map((c: any) => ({ criterionId: c.criterionId, resultStatus: c.resultStatus })),
    memberSidePreview: { screeningStatus: sidePreview.screeningStatus,
      wholeExerciseStatus: sidePreview.wholeExerciseStatus,
      corrections: sidePreview.correctionPriorities,
      officialImproved: sideDetail.result.techniqueEvaluation.needsImprovementCriteria },
    uneditedSamples: { front: { analysisId: row.id, measuredCriteria: result.techniqueEvaluation.measuredCriteria,
      sourceReference: detail.sourceReference }, side: { analysisId: realSide.id,
      measuredCriteria: realSide.result.techniqueEvaluation.measuredCriteria, sourceReference: realSide.sourceReference },
      oblique: { analysisId: realOblique.id, sourceReference: realOblique.sourceReference,
        tempoStatus: obliqueTempo.status, improvementPredictions: obliqueTempo.predictions.filter((item: any) => item.status === 'NEEDS_IMPROVEMENT').map((item: any) => ({
          repNumber: item.repNumber, timestampSeconds: item.timestampSeconds, observedValue: item.observedValue,
          units: item.units, threshold: item.threshold, feedback: item.feedback,
          evidenceFrames: item.landmarkEvidence?.length || 0 })) } },
    detailAndHistoryChecked: true, creditBatchCountUnchanged: true,
    coachWorkflowFixture: { labelPersisted: true, reviewStatus: 'COACH_REVIEWED_PENDING_VIDEO_VALIDATION', realCoachApproval: false },
    limitation: 'HTTP/SQL integration; on-device Mobile interaction and Coach accuracy are not assessed.',
  }, null, 2));
});

test('real developer flow retains experimental predictions through worker, SQL, API and reanalysis', { timeout: 110_000 }, async t => {
  const admin = await prisma.user.create({ data: { email: `tech-dev-${randomUUID()}@example.invalid`, password: 'TEST_UNUSED', fullName: 'TEST ONLY', role: 'ADMIN', status: 'ACTIVE' } });
  const headers = { Authorization: `Bearer ${jwt.sign({ userId: admin.id, role: 'ADMIN' }, process.env.JWT_SECRET || 'default_secret')}` };
  t.after(async () => {
    const rows = await prisma.exerciseAnalysis.findMany({ where: { memberId: admin.id } });
    for (const row of rows) if (row.mediaStorageKey) await unlink(path.resolve('private-exercise-media', row.mediaStorageKey)).catch(() => undefined);
    await prisma.exerciseAnalysis.deleteMany({ where: { memberId: admin.id } });
    await prisma.user.delete({ where: { id: admin.id } });
  });
  const video = await readFile(path.resolve('../ai-exercise-service/samples/front-facing-squat-pexels-5034577.mp4'));
  const videoSha256 = createHash('sha256').update(video).digest('hex');
  const criterionTrace = (result: any) => ({
    evaluationMode: result.evaluationMode,
    resultVersion: result.resultVersion,
    ruleVersion: result.ruleVersion,
    videoSha256: result.inputVideoSha256,
    repetitions: result.detectedRepetitions,
    official: { passed: result.techniqueEvaluation?.passedCriteria, improved: result.techniqueEvaluation?.needsImprovementCriteria },
    experimental: result.experimentalEvaluation ? {
      validation: result.experimentalEvaluation.validation,
      ruleVersion: result.experimentalEvaluation.ruleVersion,
      passed: result.experimentalEvaluation.passedCriteria,
      improved: result.experimentalEvaluation.needsImprovementCriteria,
      criteria: result.experimentalEvaluation.criteria.map((item: any) => ({
        id: item.criterionId, status: item.status, reasonCode: item.reasonCode,
        predictions: item.predictions.map((prediction: any) => ({ status: prediction.status, bodyPart: prediction.bodyPart,
          rep: prediction.repNumber, timestampSeconds: prediction.timestampSeconds, observedValue: prediction.observedValue,
          threshold: prediction.threshold, evidenceFrames: prediction.landmarkEvidence?.length || 0, feedback: prediction.feedback })),
      })),
    } : null,
  });
  const callFastApi = async (mode: 'OFFICIAL' | 'EXPERIMENTAL', source = video, options = { cameraView: 'FRONT', depthTarget: 'NONE', descentTargetSeconds: null } as any) => {
    const input = new FormData();
    input.append('file', new Blob([source]), 'squat.mp4');
    input.append('options', JSON.stringify(options));
    input.append('exercise_variant', 'BODYWEIGHT');
    input.append('evaluation_mode', mode);
    const response = await fetch(`${process.env.AI_SERVICE_URL || 'http://127.0.0.1:8001'}/analyze/squat`, {
      method: 'POST', headers: { 'x-ai-service-key': process.env.AI_SERVICE_KEY || '' }, body: input,
    });
    if (response.status !== 200) throw new Error(`FastAPI ${mode} returned ${response.status}: ${await response.text()}`);
    return response.json() as Promise<any>;
  };
  const fastApiOfficial = await callFastApi('OFFICIAL');
  const fastApiExperimental = await callFastApi('EXPERIMENTAL');
  assert.equal(fastApiOfficial.inputVideoSha256, videoSha256);
  assert.equal(fastApiOfficial.experimentalEvaluation, undefined);
  assert.equal(fastApiOfficial.referenceComparison, undefined);
  assert.equal(fastApiOfficial.provisionalEvaluation?.mode, 'PROVISIONAL');
  assert.equal(fastApiOfficial.provisionalEvaluation?.passedCriteria, 3);
  assert.equal(fastApiExperimental.inputVideoSha256, videoSha256);
  assert.equal(fastApiExperimental.experimentalEvaluation.passedCriteria, 3);
  assert.equal(fastApiExperimental.referenceComparison?.referenceExamples, 0);
  assert.equal(fastApiExperimental.referenceComparison?.validatedForDecision, false);
  const form = new FormData(); form.append('video', new Blob([video]), 'front.mp4');
  form.append('consent', 'true'); form.append('exerciseType', 'SQUAT'); form.append('exerciseVariant', 'BODYWEIGHT');
  form.append('analysisOptions', JSON.stringify({ cameraView: 'FRONT', depthTarget: 'NONE', descentTargetSeconds: null }));
  const upload = await fetch(`${base}/developer`, { method: 'POST', headers, body: form });
  assert.equal(upload.status, 202);
  startExerciseAnalysisWorker();
  const queued = (await upload.json() as any).data;
  async function awaitResult(id: number) {
    let row = await prisma.exerciseAnalysis.findUniqueOrThrow({ where: { id } });
    for (let poll = 0; poll < 180 && ['PENDING', 'PROCESSING'].includes(row.status); poll++) {
      await new Promise(resolve => setTimeout(resolve, 500));
      row = await prisma.exerciseAnalysis.findUniqueOrThrow({ where: { id } });
    }
    assert.equal(row.status, 'COMPLETED');
    return row;
  }
  const stored = await awaitResult(queued.id);
  const fromDb = JSON.parse(stored.resultJson || '{}');
  const detail = (await (await fetch(`${base}/developer/${stored.id}`, { headers })).json() as any).data;
  const { poseOverlayToleranceSeconds, visibleExperimentalEvaluation } = await import('../../mobile-react-native/src/lib/exerciseAnalysisData.js');
  const mobileVisible = visibleExperimentalEvaluation(detail, true);
  assert.equal(visibleExperimentalEvaluation(detail, false), null);
  assert.equal(mobileVisible?.passedCriteria, 3);
  const finalPose = fromDb.poseFrames.at(-1);
  const playerTime = 16.522;
  const overlayDelta = Math.abs(playerTime - finalPose.timeSeconds);
  const overlayTolerance = poseOverlayToleranceSeconds(finalPose.timeSeconds, finalPose.timeSeconds,
    playerTime, fromDb.video.durationSeconds, fromDb.video.sampleRateHz);
  assert.ok(overlayDelta > 0.1 && overlayDelta <= overlayTolerance);
  assert.equal(Object.keys(finalPose.landmarks).length, 16);
  assert.equal(stored.evaluationMode, 'EXPERIMENTAL');
  assert.equal(stored.resultVersion, 'exercise-analysis-result-4');
  assert.equal(stored.ruleVersion, fromDb.ruleVersion);
  assert.equal(queued.evaluationMode, 'EXPERIMENTAL');
  assert.deepEqual(fromDb.experimentalEvaluation, fastApiExperimental.experimentalEvaluation);
  assert.deepEqual(fromDb.referenceComparison, fastApiExperimental.referenceComparison);
  assert.deepEqual(detail.result.referenceComparison, fromDb.referenceComparison);
  assert.deepEqual(detail.result.experimentalEvaluation, fromDb.experimentalEvaluation);
  assert.equal(detail.result.experimentalEvaluation.mode, 'EXPERIMENTAL');
  assert.equal(detail.result.experimentalEvaluation.passedCriteria, 3);
  assert.equal(detail.result.techniqueEvaluation.passedCriteria, 0);
  assert.equal(detail.result.techniqueEvaluation.needsImprovementCriteria, 0);
  const trace: any = { testedAt: new Date().toISOString(), videoSha256,
    fastApiOfficial: criterionTrace(fastApiOfficial), fastApiExperimental: criterionTrace(fastApiExperimental),
    referenceComparison: fastApiExperimental.referenceComparison,
    backendQueued: { id: queued.id, status: queued.status, evaluationMode: queued.evaluationMode, resultVersion: queued.resultVersion },
    workerSql: { id: stored.id, status: stored.status, evaluationMode: stored.evaluationMode, ruleVersion: stored.ruleVersion,
      resultVersion: stored.resultVersion, result: criterionTrace(fromDb) },
    backendApi: { id: detail.id, status: detail.status, evaluationMode: detail.evaluationMode, ruleVersion: detail.ruleVersion,
      resultVersion: detail.resultVersion, result: criterionTrace(detail.result) },
    mobileProjection: { visibleToDeveloper: !!mobileVisible, visibleToMember: visibleExperimentalEvaluation(detail, false) !== null,
      predictionCount: mobileVisible?.criteria.flatMap((item: any) => item.predictions).length || 0,
      validation: mobileVisible?.validation,
      finalPoseOverlay: { playbackSeconds: playerTime, sampleSeconds: finalPose.timeSeconds,
        deltaSeconds: overlayDelta, toleranceSeconds: overlayTolerance, landmarkCount: Object.keys(finalPose.landmarks).length } },
  };
  await mkdir('tests/artifacts', { recursive: true });
  await writeFile('tests/artifacts/exercise-experimental-e2e.json', JSON.stringify(trace, null, 2));
  const history = (await (await fetch(`${base}/developer`, { headers })).json() as any).data;
  assert.ok(history.some((row: any) => row.id === stored.id));
  const replay = await fetch(`${base}/developer/${stored.id}/reanalyze`, { method: 'POST', headers });
  assert.equal(replay.status, 202);
  const nextId = (await replay.json() as any).data.id;
  assert.notEqual(nextId, stored.id);
  const replayed = await awaitResult(nextId);
  const replayedResult = JSON.parse(replayed.resultJson || '{}');
  trace.replay = { id: replayed.id, evaluationMode: replayed.evaluationMode,
    protocol: replayedResult.protocol, videoSha256: replayedResult.inputVideoSha256,
    cameraView: replayedResult.cameraView, result: criterionTrace(replayedResult) };
  await writeFile('tests/artifacts/exercise-experimental-e2e.json', JSON.stringify(trace, null, 2));
  assert.equal(replayedResult.experimentalEvaluation.passedCriteria, 3,
    JSON.stringify(trace.replay));
  assert.equal((await prisma.exerciseAnalysis.findUniqueOrThrow({ where: { id: stored.id } })).status, 'COMPLETED');
  const sideVideo = await readFile(path.resolve('../ai-exercise-service/samples/squat-variable-depth-test.mp4'));
  const sideOptions = { cameraView: 'SIDE', depthTarget: 'HIP_AT_KNEE', descentTargetSeconds: null };
  const sideFastApi = await callFastApi('EXPERIMENTAL', sideVideo, sideOptions);
  assert.ok(sideFastApi.experimentalEvaluation.needsImprovementCriteria >= 1);
  const sideForm = new FormData();
  sideForm.append('video', new Blob([sideVideo]), 'side.mp4');
  sideForm.append('consent', 'true'); sideForm.append('exerciseType', 'SQUAT');
  sideForm.append('exerciseVariant', 'BODYWEIGHT');
  sideForm.append('analysisOptions', JSON.stringify(sideOptions));
  const sideUpload = await fetch(`${base}/developer`, { method: 'POST', headers, body: sideForm });
  assert.equal(sideUpload.status, 202);
  const sideQueued = (await sideUpload.json() as any).data;
  const sideStored = await awaitResult(sideQueued.id);
  const sideSql = JSON.parse(sideStored.resultJson || '{}');
  const sideApi = (await (await fetch(`${base}/developer/${sideStored.id}`, { headers })).json() as any).data;
  assert.deepEqual(sideSql.experimentalEvaluation, sideFastApi.experimentalEvaluation);
  assert.deepEqual(sideApi.result.experimentalEvaluation, sideSql.experimentalEvaluation);
  assert.equal(visibleExperimentalEvaluation(sideApi, true)?.needsImprovementCriteria,
    sideFastApi.experimentalEvaluation.needsImprovementCriteria);
  const depth = sideSql.experimentalEvaluation.criteria.find((item: any) => item.criterionId === 'SQUAT-02');
  assert.equal(depth.status, 'NEEDS_IMPROVEMENT');
  assert.ok(depth.predictions.some((item: any) => item.status === 'NEEDS_IMPROVEMENT' &&
    item.observedValue > 0 && item.threshold.maximum === 0 && item.landmarkEvidence.length >= 3));
  trace.sideDepth = { fastApi: criterionTrace(sideFastApi), workerSql: { id: sideStored.id,
    evaluationMode: sideStored.evaluationMode, ruleVersion: sideStored.ruleVersion,
    resultVersion: sideStored.resultVersion, result: criterionTrace(sideSql) },
    backendApi: { id: sideApi.id, evaluationMode: sideApi.evaluationMode, result: criterionTrace(sideApi.result) },
    mobileProjection: { visibleToDeveloper: !!visibleExperimentalEvaluation(sideApi, true),
      visibleToMember: !!visibleExperimentalEvaluation(sideApi, false) } };
  await writeFile('tests/artifacts/exercise-experimental-e2e.json', JSON.stringify(trace, null, 2));
});
