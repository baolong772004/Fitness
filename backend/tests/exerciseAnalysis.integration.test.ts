import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const testUrl = process.env.PT_TEST_DATABASE_URL;
const databaseName = /(?:^|;)database=([^;]+)/i.exec(testUrl ?? '')?.[1];
if (!testUrl || testUrl === process.env.DATABASE_URL || !databaseName || !/test/i.test(databaseName)) {
  throw new Error('Set PT_TEST_DATABASE_URL to a separate migrated SQL Server database with "test" in its name');
}
process.env.DATABASE_URL = testUrl;

const [{ default: express }, { default: jwt }, { PrismaClient }, { default: memberRoute }, { default: coachRoute }, { default: appPrisma }] = await Promise.all([
  import('express'), import('jsonwebtoken'), import('@prisma/client'),
  import('../src/routes/exerciseAnalysis.route.js'), import('../src/routes/coachExerciseAnalysis.route.js'), import('../src/config/prisma.js'),
]);
const prisma = new PrismaClient();
const app = express();
app.use(express.json());
app.use('/api/exercise-analysis', memberRoute);
app.use('/api/coach/shared-exercise-analyses', coachRoute);
const server = app.listen(0, '127.0.0.1');
await new Promise<void>(resolve => server.once('listening', resolve));
test.after(async () => { await new Promise<void>(resolve => server.close(() => resolve())); await prisma.$disconnect(); await appPrisma.$disconnect(); });

const endpoint = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
const auth = (user: { id: number; role: string }) => ({ Authorization: `Bearer ${jwt.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET || 'default_secret')}` });
async function call(path: string, user: { id: number; role: string }, method = 'GET', body?: object) {
  const response = await fetch(`${endpoint}${path}`, { method, headers: { ...auth(user), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: response.status, json: await response.json() as any };
}

test('Member creates a two-view session only from distinct self-declared uploads', async t => {
  const member = await prisma.user.create({ data: { email: `session-${randomUUID()}@example.invalid`, password: 'unused', fullName: 'TEST ONLY', role: 'MEMBER', status: 'ACTIVE' } });
  t.after(async () => {
    const rows = await prisma.exerciseAnalysis.findMany({ where: { memberId: member.id } });
    for (const row of rows) if (row.mediaStorageKey) await unlink(path.resolve('private-exercise-media', row.mediaStorageKey)).catch(() => undefined);
    await prisma.exerciseAnalysis.deleteMany({ where: { memberId: member.id } });
    await prisma.user.delete({ where: { id: member.id } });
  });
  async function uploadView(view: 'FRONT' | 'SIDE', marker: number) {
    const bytes = Buffer.alloc(32, marker); bytes.write('ftyp', 4);
    const form = new FormData();
    form.append('video', new Blob([bytes]), `${view}.mp4`);
    form.append('consent', 'true'); form.append('exerciseType', 'SQUAT'); form.append('exerciseVariant', 'BODYWEIGHT');
    form.append('analysisOptions', JSON.stringify({ cameraView: view, depthTarget: 'NONE', descentTargetSeconds: null }));
    form.append('videoOrigin', 'USER_UPLOAD'); form.append('captureMethodDeclared', 'CAMERA');
    form.append('performerDeclaration', 'SELF_DECLARED');
    const response = await fetch(`${endpoint}/api/exercise-analysis`, { method: 'POST', headers: auth(member), body: form });
    assert.equal(response.status, 202);
    return (await response.json() as any).data;
  }
  const front = await uploadView('FRONT', 1);
  const side = await uploadView('SIDE', 2);
  assert.equal(front.videoOrigin, 'USER_UPLOAD');
  assert.equal(front.performerDeclaration, 'SELF_DECLARED');
  assert.equal(front.memberId, member.id);
  assert.equal((await call('/api/exercise-analysis/sessions', member, 'POST', { frontAnalysisId: front.id, sideAnalysisId: side.id })).status, 400);
  const fillResult = async (id: number, view: 'FRONT' | 'SIDE') => {
    const row = await prisma.exerciseAnalysis.findUniqueOrThrow({ where: { id } });
    const initial = JSON.parse(row.resultJson || '{}');
    await prisma.exerciseAnalysis.update({ where: { id }, data: { status: 'COMPLETED',
      resultJson: JSON.stringify({ ...initial, cameraView: { requested: view, detected: view },
        modelVersion: 'test-model', ruleVersion: 'test-rule', referenceStandardVersion: 'test-draft',
        detectedRepetitions: 1, techniqueEvaluation: { criteria: [] }, provisionalEvaluation: { criteria: [] } }) } });
  };
  assert.equal((await call('/api/exercise-analysis/sessions', member, 'POST', { frontAnalysisId: front.id,
    sideAnalysisId: side.id, samePersonSessionConfirmed: true })).json.code, 'SESSION_ANALYSES_NOT_READY');
  await fillResult(front.id, 'FRONT'); await fillResult(side.id, 'SIDE');
  const sideRow = await prisma.exerciseAnalysis.findUniqueOrThrow({ where: { id: side.id } });
  await prisma.exerciseAnalysis.update({ where: { id: side.id }, data: { resultJson: sideRow.resultJson!.replace('"detected":"SIDE"', '"detected":"FRONT"') } });
  assert.equal((await call('/api/exercise-analysis/sessions', member, 'POST', { frontAnalysisId: front.id,
    sideAnalysisId: side.id, samePersonSessionConfirmed: true })).json.code, 'SESSION_DETECTED_VIEW_MISMATCH');
  await fillResult(side.id, 'SIDE');
  const created = await call('/api/exercise-analysis/sessions', member, 'POST', { frontAnalysisId: front.id,
    sideAnalysisId: side.id, samePersonSessionConfirmed: true });
  assert.equal(created.status, 201);
  assert.equal(created.json.data.status, 'READY_FOR_PER_CLIP_REVIEW');
  assert.equal(created.json.data.repSynchronization, 'NONE');
  assert.equal(created.json.data.wholeExerciseStatus, 'UNABLE_TO_CONFIRM');
  const groupId = created.json.data.sessionGroupId;
  assert.equal((await call(`/api/exercise-analysis/sessions/${groupId}`, member)).status, 200);
  const outsider = await prisma.user.create({ data: { email: `outsider-${randomUUID()}@example.invalid`, password: 'unused', fullName: 'TEST ONLY', role: 'MEMBER', status: 'ACTIVE' } });
  assert.equal((await call(`/api/exercise-analysis/sessions/${groupId}`, outsider)).status, 404);
  await prisma.user.delete({ where: { id: outsider.id } });
  assert.equal((await call('/api/exercise-analysis/sessions', member, 'POST', { frontAnalysisId: front.id,
    sideAnalysisId: side.id, samePersonSessionConfirmed: true })).status, 422);
});

test('multipart upload validates and preserves explicit analysis goals for the worker', async t => {
  const member = await prisma.user.create({ data: { email: `goals-${randomUUID()}@example.invalid`, password: 'unused', fullName: 'TEST ONLY', role: 'MEMBER', status: 'ACTIVE' } });
  t.after(async () => {
    const rows = await prisma.exerciseAnalysis.findMany({ where: { memberId: member.id } });
    for (const row of rows) if (row.mediaStorageKey) await unlink(path.resolve('private-exercise-media', row.mediaStorageKey));
    await prisma.exerciseAnalysis.deleteMany({ where: { memberId: member.id } });
    await prisma.user.delete({ where: { id: member.id } });
  });
  // Container bytes are a route fixture only; no AI inference or accuracy claim.
  const bytes = Buffer.alloc(32); bytes.write('ftyp', 4);
  async function submit(options: object, exerciseType = 'SQUAT') {
    const form = new FormData();
    form.append('video', new Blob([bytes]), 'route-fixture.mp4');
    form.append('exerciseType', exerciseType); form.append('consent', 'true');
    form.append('analysisOptions', JSON.stringify(options));
    return fetch(`${endpoint}/api/exercise-analysis`, { method: 'POST', headers: auth(member), body: form });
  }
  assert.equal((await submit({ descentTargetSeconds: 0 })).status, 400);
  assert.equal(await prisma.exerciseAnalysis.count({ where: { memberId: member.id } }), 0);
  const options = { cameraView: 'SIDE', depthTarget: 'HIP_AT_KNEE', descentTargetSeconds: 2 };
  const response = await submit(options);
  assert.equal(response.status, 202);
  const body = await response.json() as any;
  const row = await prisma.exerciseAnalysis.findUniqueOrThrow({ where: { id: body.data.id } });
  assert.equal(row.status, 'PENDING');
  assert.deepEqual(JSON.parse(row.resultJson!).requestOptions, options);
  // A local transport stub verifies the real worker contract, NOT AI accuracy.
  const { default: multer } = await import('multer');
  const mockAi = express();
  let receivedOptions: unknown;
  mockAi.post('/analyze/:exercise', multer().single('file'), (req, res) => {
    receivedOptions = JSON.parse(req.body.options);
    res.json({ exercise: String(req.params.exercise).toUpperCase(), status: 'INSUFFICIENT_DATA', protocol: receivedOptions, observations: [], repetitions: [], evaluationMode: req.body.evaluation_mode, resultVersion: 'exercise-analysis-result-2', modelVersion: 'TRANSPORT_TEST_ONLY', ruleVersion: 'TRANSPORT_TEST_ONLY' });
  });
  const mockServer = mockAi.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => mockServer.once('listening', resolve));
  const previousUrl = process.env.AI_SERVICE_URL;
  t.after(async () => {
    if (previousUrl === undefined) delete process.env.AI_SERVICE_URL; else process.env.AI_SERVICE_URL = previousUrl;
    await new Promise<void>(resolve => mockServer.close(() => resolve()));
  });
  process.env.AI_SERVICE_URL = `http://127.0.0.1:${(mockServer.address() as { port: number }).port}`;
  const { startExerciseAnalysisWorker } = await import('../src/services/exerciseAnalysis.service.js');
  startExerciseAnalysisWorker();
  let processed = row;
  for (let i = 0; i < 100 && ['PENDING', 'PROCESSING'].includes(processed.status); i++) {
    await new Promise(resolve => setTimeout(resolve, 50));
    processed = await prisma.exerciseAnalysis.findUniqueOrThrow({ where: { id: row.id } });
  }
  assert.equal(processed.status, 'INSUFFICIENT_DATA');
  assert.deepEqual(receivedOptions, options);
  assert.deepEqual(JSON.parse(processed.resultJson!).protocol, options);
  const curlResponse = await submit({ cameraView: 'SIDE' }, 'BICEPS_CURL');
  assert.equal(curlResponse.status, 202);
  const curlBody = await curlResponse.json() as any;
  let curl = await prisma.exerciseAnalysis.findUniqueOrThrow({ where: { id: curlBody.data.id } });
  assert.equal(curl.exerciseType, 'BICEPS_CURL');
  for (let i = 0; i < 110 && ['PENDING', 'PROCESSING'].includes(curl.status); i++) {
    await new Promise(resolve => setTimeout(resolve, 100));
    curl = await prisma.exerciseAnalysis.findUniqueOrThrow({ where: { id: curl.id } });
  }
  assert.equal(curl.status, 'INSUFFICIENT_DATA');
  assert.equal(JSON.parse(curl.resultJson!).exercise, 'BICEPS_CURL');
});

test('Member routes never expose an experimental job, even if it belongs to the same user', async t => {
  const member = await prisma.user.create({ data: { email: `mode-gate-${randomUUID()}@example.invalid`, password: 'unused', fullName: 'TEST ONLY', role: 'MEMBER', status: 'ACTIVE' } });
  const job = await prisma.exerciseAnalysis.create({ data: { memberId: member.id, exerciseType: 'SQUAT',
    evaluationMode: 'EXPERIMENTAL', status: 'COMPLETED', resultJson: JSON.stringify({ exercise: 'SQUAT',
      evaluationMode: 'EXPERIMENTAL', experimentalEvaluation: { mode: 'EXPERIMENTAL', passedCriteria: 1 } }) } });
  t.after(async () => { await prisma.exerciseAnalysis.deleteMany({ where: { memberId: member.id } }); await prisma.user.delete({ where: { id: member.id } }); });
  const history = await call('/api/exercise-analysis/my-history', member);
  assert.equal(history.status, 200);
  assert.ok(!history.json.data.some((row: any) => row.id === job.id));
  assert.equal((await call(`/api/exercise-analysis/${job.id}`, member)).status, 404);
  assert.equal((await call(`/api/exercise-analysis/developer/${job.id}`, member)).status, 403);
});

test('Coach cannot release a reviewed criterion without real SQL labels', async t => {
  const { default: bcrypt } = await import('bcrypt');
  const coach = await prisma.user.create({ data: {
    email: `release-${randomUUID()}@example.invalid`, password: await bcrypt.hash('test-password', 8),
    fullName: 'Test Coach', role: 'COACH', status: 'ACTIVE',
  } });
  await prisma.coachProfile.create({ data: { userId: coach.id, status: 'ACTIVE' } });
  const review = await prisma.exerciseTechniqueCriterionReview.create({ data: {
    coachId: coach.id, exerciseType: 'SQUAT', exerciseVariant: 'BODYWEIGHT',
    standardVersion: 'bodyweight-squat-1.0.0-draft', standardDigest: '0'.repeat(64), criterionId: 'SQUAT-03',
    decision: 'CONTENT_REVIEWED_PENDING_VIDEO_VALIDATION', qualification: 'Test Coach',
    reviewRecordId: 'TEST-REVIEW', reviewScope: 'FRONT', approvedConditions: 'test',
    measurementFormula: 'test', thresholdsJson: '{}', cameraViewsJson: '["FRONT"]',
    limitationsJson: '[]', correctionAdvice: '{}', status: 'COACH_REVIEWED_PENDING_VIDEO_VALIDATION',
  } });
  t.after(async () => {
    await prisma.exerciseTechniqueCriterionReview.delete({ where: { id: review.id } });
    await prisma.coachProfile.delete({ where: { userId: coach.id } });
    await prisma.user.delete({ where: { id: coach.id } });
  });
  const result = await call(`/api/coach/shared-exercise-analyses/criteria-reviews/${review.id}/release`, coach, 'POST', {
    password: 'test-password', signatureName: 'Test Coach',
    confirmation: 'I_APPROVE_THIS_CRITERION_AFTER_INDEPENDENT_VALIDATION',
  });
  assert.equal(result.status, 422);
  assert.equal(result.json.code, 'NO_REAL_COACH_LABELS_IN_SQL');
  const saved = await prisma.exerciseTechniqueCriterionReview.findUniqueOrThrow({ where: { id: review.id } });
  assert.equal(saved.status, 'COACH_REVIEWED_PENDING_VIDEO_VALIDATION');
  assert.equal(saved.approvalSignatureSha256, null);
});

test('sharing requires owner and current PT relation; revocation removes coach access', async t => {
  const users = await Promise.all(['MEMBER', 'MEMBER', 'COACH', 'COACH'].map(role => prisma.user.create({ data: { email: `analysis-${randomUUID()}@example.invalid`, password: 'unused', fullName: role, role, status: 'ACTIVE' } })));
  const [member, otherMember, coach, otherCoach] = users;
  const ids = users.map(user => user.id);
  t.after(async () => {
    await prisma.exerciseAnalysis.deleteMany({ where: { memberId: { in: ids } } });
    await prisma.booking.deleteMany({ where: { memberId: { in: ids } } });
    await prisma.coachProfile.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  });
  await Promise.all([coach, otherCoach].map(user => prisma.coachProfile.create({ data: { userId: user.id, status: 'ACTIVE' } })));
  const booking = await prisma.booking.create({ data: { memberId: member.id, coachId: coach.id, type: 'PT', status: 'CONFIRMED', startTime: new Date(Date.now() + 3600000), endTime: new Date(Date.now() + 7200000) } });
  const analysis = await prisma.exerciseAnalysis.create({ data: { memberId: member.id, exerciseType: 'SQUAT', status: 'COMPLETED', resultJson: '{"exercise":"SQUAT","status":"COMPLETED","observations":[]}', mediaStorageKey: null } });
  const base = `/api/exercise-analysis/${analysis.id}`;

  assert.equal((await call(base, otherMember)).status, 404);
  assert.equal((await call(`${base}/video`, otherMember)).status, 404);
  assert.equal((await call(`${base}/video`, member)).status, 410);
  assert.equal((await call(`${base}/share`, otherMember, 'POST', { coachId: coach.id })).status, 404);
  assert.equal((await call(`${base}/share`, member, 'POST', { coachId: otherCoach.id })).status, 403);
  assert.equal((await call(`${base}/share`, member, 'POST', { coachId: coach.id })).status, 200);
  let visible = await call('/api/coach/shared-exercise-analyses', coach);
  assert.equal(visible.json.data.length, 1);
  assert.equal(visible.json.data[0].analysis.mediaStorageKey, undefined);
  const coachVideo = `/api/coach/shared-exercise-analyses/${analysis.id}/video`;
  assert.equal((await call(coachVideo, coach)).status, 403);
  assert.equal((await call(`${base}/share`, member, 'POST', { coachId: coach.id, includeVideo: true })).status, 200);
  // Consent grants access, but missing/deleted media still returns Gone.
  assert.equal((await call(coachVideo, coach)).status, 410);
  assert.equal((await call(coachVideo, otherCoach)).status, 403);
  assert.equal((await call('/api/coach/shared-exercise-analyses', otherCoach)).json.data.length, 0);
  assert.equal((await call(`/api/coach/shared-exercise-analyses/${analysis.id}/feedback`, coach, 'POST', { comment: 'Giữ nhịp đều hơn.' })).status, 201);
  assert.equal((await call(base, member)).json.data.feedback.length, 1);

  assert.equal((await call(`${base}/share?coachId=${coach.id}`, member, 'DELETE')).status, 200);
  assert.equal((await call('/api/coach/shared-exercise-analyses', coach)).json.data.length, 0);
  assert.equal((await call(coachVideo, coach)).status, 403);
  assert.equal((await call(`${base}/share`, member, 'POST', { coachId: coach.id })).status, 200);
  await prisma.booking.update({ where: { id: booking.id }, data: { status: 'CANCELLED' } });
  visible = await call('/api/coach/shared-exercise-analyses', coach);
  assert.equal(visible.json.data.length, 0);
  assert.equal((await call(`/api/coach/shared-exercise-analyses/${analysis.id}/feedback`, coach, 'POST', { comment: 'Không còn quyền.' })).status, 403);
});

test('video consent, ranges, expiry, active Coach, relationship and deletion are enforced on real routes', async t => {
  const users = await Promise.all(['MEMBER', 'MEMBER', 'COACH', 'COACH'].map(role => prisma.user.create({ data: { email: `video-${randomUUID()}@example.invalid`, password: 'unused', fullName: role, role, status: 'ACTIVE' } })));
  const [member, otherMember, coach, otherCoach] = users;
  const ids = users.map(user => user.id);
  const key = `${randomUUID()}.video`;
  const directory = path.resolve('private-exercise-media');
  const file = path.join(directory, key);
  t.after(async () => {
    await unlink(file).catch(error => { if (error.code !== 'ENOENT') throw error; });
    await prisma.exerciseAnalysis.deleteMany({ where: { memberId: { in: ids } } });
    await prisma.booking.deleteMany({ where: { memberId: { in: ids } } });
    await prisma.coachProfile.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  });
  await Promise.all([coach, otherCoach].map(user => prisma.coachProfile.create({ data: { userId: user.id, status: 'ACTIVE' } })));
  const booking = await prisma.booking.create({ data: { memberId: member.id, coachId: coach.id, type: 'PT', status: 'CONFIRMED', startTime: new Date(Date.now() + 3600000), endTime: new Date(Date.now() + 7200000) } });
  await mkdir(directory, { recursive: true });
  const bytes = Buffer.alloc(100, 7);
  bytes.write('ftyp', 4, 'ascii');
  await writeFile(file, bytes, { flag: 'wx' });
  const resultJson = JSON.stringify({ exercise: 'SQUAT', status: 'COMPLETED', observations: [], repetitions: [{ number: 1 }], poseFrames: [{ timeSeconds: 0 }] });
  const analysis = await prisma.exerciseAnalysis.create({ data: { memberId: member.id, exerciseType: 'SQUAT', status: 'COMPLETED', resultJson, mediaStorageKey: key } });
  const base = `/api/exercise-analysis/${analysis.id}`;
  const coachVideo = `/api/coach/shared-exercise-analyses/${analysis.id}/video`;
  const video = (url: string, user: typeof member) => fetch(`${endpoint}${url}`, { headers: { ...auth(user), Range: 'bytes=4-15' } });

  assert.equal((await fetch(`${endpoint}${base}/video`)).status, 401);
  assert.equal((await video(`${base}/video`, otherMember)).status, 404);
  assert.equal((await video(`${base}/video`, coach)).status, 403);
  const ownVideo = await video(`${base}/video`, member);
  assert.equal(ownVideo.status, 206);
  assert.equal(ownVideo.headers.get('cache-control'), 'private, no-store');
  assert.deepEqual(Buffer.from(await ownVideo.arrayBuffer()), bytes.subarray(4, 16));
  const detail = (await call(base, member)).json.data;
  assert.equal(detail.videoAvailable, true);
  assert.equal(detail.result.poseFrames.length, 1);
  const history = (await call('/api/exercise-analysis/my-history', member)).json.data;
  assert.equal(history[0].result.poseFrames, undefined);
  assert.equal((await call(`${base}/reanalyze`, otherMember, 'POST')).status, 410);
  const rerun = await call(`${base}/reanalyze`, member, 'POST');
  assert.equal(rerun.status, 202);
  assert.equal(rerun.json.data.evaluationMode, 'OFFICIAL');
  assert.equal((await call(`/api/exercise-analysis/${rerun.json.data.id}`, member, 'DELETE')).status, 200);

  await call(`${base}/share`, member, 'POST', { coachId: coach.id });
  assert.equal((await video(coachVideo, coach)).status, 403);
  assert.equal((await call('/api/coach/shared-exercise-analyses', coach)).json.data[0].analysis.videoAvailable, false);
  await call(`${base}/share`, member, 'POST', { coachId: coach.id, includeVideo: 'true' });
  assert.equal((await video(coachVideo, coach)).status, 403, 'String true must not grant video consent');
  await call(`${base}/share`, member, 'POST', { coachId: coach.id, includeVideo: true });
  const sharedVideo = await video(coachVideo, coach);
  assert.equal(sharedVideo.status, 206);
  assert.match(sharedVideo.headers.get('content-type') || '', /^video\/mp4\b/);
  assert.equal(sharedVideo.headers.get('accept-ranges'), 'bytes');
  assert.deepEqual(Buffer.from(await sharedVideo.arrayBuffer()), bytes.subarray(4, 16));
  assert.equal((await video(coachVideo, otherCoach)).status, 403);
  await prisma.coachProfile.update({ where: { userId: coach.id }, data: { status: 'INACTIVE' } });
  assert.equal((await video(coachVideo, coach)).status, 403);
  await prisma.coachProfile.update({ where: { userId: coach.id }, data: { status: 'ACTIVE' } });
  await prisma.booking.update({ where: { id: booking.id }, data: { status: 'CANCELLED' } });
  assert.equal((await video(coachVideo, coach)).status, 403);
  await prisma.booking.update({ where: { id: booking.id }, data: { status: 'CONFIRMED' } });
  await call(`${base}/share?coachId=${coach.id}`, member, 'DELETE');
  assert.equal((await video(coachVideo, coach)).status, 403);
  await call(`${base}/share`, member, 'POST', { coachId: coach.id, includeVideo: true });
  await prisma.exerciseAnalysis.update({ where: { id: analysis.id }, data: { createdAt: new Date(Date.now() - 7 * 86400000 - 1000) } });
  assert.equal((await video(coachVideo, coach)).status, 410);
  assert.equal((await video(`${base}/video`, member)).status, 410);
  assert.equal((await call(base, member)).json.data.videoAvailable, false);
  assert.equal((await call(base, otherMember, 'DELETE')).status, 404);
  assert.equal((await call(base, member, 'DELETE')).status, 200);
  assert.equal((await video(coachVideo, coach)).status, 403);
  assert.equal((await call(base, member)).status, 404);
  await assert.rejects(() => import('node:fs/promises').then(fs => fs.stat(file)), { code: 'ENOENT' });
});
