import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

const testUrl = process.env.PT_TEST_DATABASE_URL;
const databaseName = /(?:^|;)database=([^;]+)/i.exec(testUrl ?? '')?.[1];
if (!testUrl || testUrl === process.env.DATABASE_URL || !databaseName || !/test/i.test(databaseName)) {
  throw new Error('Set PT_TEST_DATABASE_URL to a separate migrated SQL Server database with "test" in its name');
}
process.env.DATABASE_URL = testUrl;
const { PrismaClient } = await import('@prisma/client');
const { assignStudentPlan, assertPlanAccess, normalizePlanDraft, normalizeProgramName, reviseStudentPlan, WorkoutPlanError } = await import('../src/services/studentWorkoutPlan.service.js');
const { presentWorkoutPlan } = await import('../src/services/workoutPlan.service.js');
const { getStudentPlanRevisions, updateStudentPlan } = await import('../src/controllers/studentWorkoutPlan.controller.js');
const { getMemberProgress } = await import('../src/controllers/workoutLog.controller.js');
const { default: appPrisma } = await import('../src/config/prisma.js');
const prisma = new PrismaClient();
test.after(async () => { await prisma.$disconnect(); await appPrisma.$disconnect(); });

const draft = (weightKg = 25) => ({ title: 'Giáo án sức mạnh', description: 'Ưu tiên kỹ thuật',
  sessions: [{ dayOfWeek: 1, title: 'Thân trên', notes: '', exercises: [{ exerciseName: 'Bench Press', sets: 3, reps: 8, weightKg, notes: 'Kiểm soát động tác' }] }], mealDays: [] });
const errorStatus = (status: number) => (error: unknown) => error instanceof WorkoutPlanError && error.status === status;

async function fixture(t: { after: (fn: () => Promise<void>) => void }) {
  const users = await Promise.all(['COACH', 'COACH', 'MEMBER', 'MEMBER', 'ADMIN'].map(role => prisma.user.create({
    data: { email: `plan-${randomUUID()}@example.invalid`, password: 'unused', fullName: `Plan ${role}`, role, status: 'ACTIVE' },
  })));
  const [coach, otherCoach, first, second, admin] = users;
  const ids = users.map(user => user.id);
  for (const user of [coach, otherCoach]) await prisma.coachProfile.create({ data: { userId: user.id } });
  for (const member of [first, second]) await prisma.booking.create({ data: { memberId: member.id, coachId: coach.id,
    type: 'PT', status: 'CONFIRMED', startTime: new Date(Date.now() + 3600000), endTime: new Date(Date.now() + 7200000) } });
  const wallet = await prisma.ptWallet.create({ data: { memberId: first.id } });
  await prisma.ptCreditBatch.create({ data: { walletId: wallet.id, level: 'BEGINNER', source: 'PURCHASE', initialCount: 10 } });
  const source = await prisma.workoutPlan.create({ data: { coachId: coach.id, ...normalizePlanDraft(draft()) } });
  t.after(async () => {
    await prisma.workoutPlanRevision.deleteMany({ where: { studentPlan: { memberId: { in: ids } } } });
    await prisma.studentWorkoutPlan.deleteMany({ where: { memberId: { in: ids } } });
    await prisma.workoutPlan.deleteMany({ where: { coachId: { in: ids } } });
    await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
    await prisma.booking.deleteMany({ where: { memberId: { in: ids } } });
    await prisma.ptCreditBatch.deleteMany({ where: { walletId: wallet.id } });
    await prisma.ptWallet.deleteMany({ where: { memberId: { in: ids } } });
    await prisma.coachProfile.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  });
  const assign = (memberId = first.id, programName: string = 'PT') => prisma.$transaction(tx => assignStudentPlan(tx,
    { coachId: coach.id, memberId, workoutPlanId: source.id, content: normalizePlanDraft(presentWorkoutPlan(source)), programName }));
  const revise = (id: number, expectedVersion: number, body = draft(20), actor = coach, extra = {}) => prisma.$transaction(tx => reviseStudentPlan(tx,
    { id, actor: { userId: actor.id, role: actor.role }, expectedVersion, draft: body, reason: 'Điều chỉnh theo thể lực', ...extra }));
  return { coach, otherCoach, first, second, admin, source, wallet, assign, revise };
}

test('updates one student snapshot, preserves template, other student, history, credits and booking state', async t => {
  const f = await fixture(t);
  const a = (await f.assign()).plan;
  const b = (await f.assign(f.second.id)).plan;
  const before = { credits: await prisma.ptCreditBatch.findMany({ where: { walletId: f.wallet.id } }),
    bookings: await prisma.booking.findMany({ where: { memberId: f.first.id } }),
    transactions: await prisma.ptCreditTransaction.count({ where: { batch: { walletId: f.wallet.id } } }) };
  const updated = (await f.revise(a.id, 1)).plan;
  assert.equal(updated.version, 2);
  assert.equal(updated.sessions[0].exercises[0].weightKg, 20);
  assert.equal(JSON.parse((await prisma.studentWorkoutPlan.findUniqueOrThrow({ where: { id: b.id } })).sessionsJson)[0].exercises[0].weightKg, 25);
  assert.equal((await prisma.workoutPlan.findUniqueOrThrow({ where: { id: f.source.id } })).sessionsJson, f.source.sessionsJson);
  const versions = await prisma.workoutPlanRevision.findMany({ where: { studentPlanId: a.id }, orderBy: { version: 'asc' } });
  assert.deepEqual(versions.map(row => row.version), [1, 2]);
  assert.equal(JSON.parse(versions[0].sessionsJson)[0].exercises[0].weightKg, 25);
  assert.equal(versions[1].changedById, f.coach.id);
  assert.equal(await prisma.notification.count({ where: { userId: f.first.id } }), 2);
  assert.deepEqual(await prisma.ptCreditBatch.findMany({ where: { walletId: f.wallet.id } }), before.credits);
  assert.deepEqual(await prisma.booking.findMany({ where: { memberId: f.first.id } }), before.bookings);
  assert.equal(await prisma.ptCreditTransaction.count({ where: { batch: { walletId: f.wallet.id } } }), before.transactions);
});

test('concurrent assignments leave one active plan per program and preserve archived plans', async t => {
  const f = await fixture(t);
  const initial = await f.assign();
  await Promise.all([f.assign(), f.assign()]);
  assert.equal(await prisma.studentWorkoutPlan.count({ where: { memberId: f.first.id, programName: 'PT', status: 'ACTIVE' } }), 1);
  assert.equal(await prisma.studentWorkoutPlan.count({ where: { memberId: f.first.id, programName: 'PT', status: 'ARCHIVED' } }), 2);
  await f.assign(f.first.id, ' sức   bền ');
  await f.assign(f.first.id, 'SỨC BỀN');
  assert.equal(await prisma.studentWorkoutPlan.count({ where: { memberId: f.first.id, status: 'ACTIVE' } }), 2);
  await assert.rejects(f.revise(initial.plan.id, 1), errorStatus(409));
  assert.equal(await prisma.workoutPlanRevision.count({ where: { studentPlanId: initial.plan.id } }), 1);
});

test('stale and simultaneous edits cannot overwrite a newer revision or send duplicate notifications', async t => {
  const f = await fixture(t);
  const { plan } = await f.assign();
  const results = await Promise.allSettled([f.revise(plan.id, 1, draft(20)), f.revise(plan.id, 1, draft(15))]);
  assert.equal(results.filter(row => row.status === 'fulfilled').length, 1);
  const rejection = results.find(row => row.status === 'rejected') as PromiseRejectedResult;
  assert.ok(errorStatus(409)(rejection.reason));
  assert.equal(await prisma.workoutPlanRevision.count({ where: { studentPlanId: plan.id } }), 2);
  assert.equal(await prisma.notification.count({ where: { userId: f.first.id } }), 2);
});

test('only owning coach or admin can edit; members only read their own history', async t => {
  const f = await fixture(t);
  const { plan } = await f.assign();
  await assert.rejects(f.revise(plan.id, 1, draft(), f.otherCoach), errorStatus(403));
  await assert.rejects(f.revise(plan.id, 1, draft(), f.first), errorStatus(403));
  await assert.rejects(assertPlanAccess(prisma, plan.id, { userId: f.second.id, role: 'MEMBER' }), errorStatus(403));
  assert.equal((await assertPlanAccess(prisma, plan.id, { userId: f.first.id, role: 'MEMBER' })).id, plan.id);
  await f.revise(plan.id, 1, draft(10), f.admin);
  const latest = await prisma.workoutPlanRevision.findFirstOrThrow({ where: { studentPlanId: plan.id }, orderBy: { version: 'desc' } });
  assert.equal(latest.changedById, f.admin.id);
});

test('restoring an old revision creates a new version; revisions of another student cannot be restored', async t => {
  const f = await fixture(t);
  const { plan } = await f.assign();
  const other = (await f.assign(f.second.id)).plan;
  const first = await prisma.workoutPlanRevision.findFirstOrThrow({ where: { studentPlanId: plan.id, version: 1 } });
  const foreign = await prisma.workoutPlanRevision.findFirstOrThrow({ where: { studentPlanId: other.id } });
  await f.revise(plan.id, 1);
  await assert.rejects(f.revise(plan.id, 2, draft(), f.coach, { restoreRevisionId: foreign.id }), errorStatus(404));
  const restored = await f.revise(plan.id, 2, draft(), f.coach, { restoreRevisionId: first.id, reason: 'Khôi phục sau khi sửa nhầm' });
  assert.equal(restored.plan.version, 3);
  assert.equal(restored.plan.sessions[0].exercises[0].weightKg, 25);
  const revisions = await prisma.workoutPlanRevision.findMany({ where: { studentPlanId: plan.id }, orderBy: { version: 'asc' } });
  assert.deepEqual(revisions.map(row => JSON.parse(row.sessionsJson)[0].exercises[0].weightKg), [25, 20, 25]);
});

test('assignment requires a current PT relationship and rejects inactive coaches without archiving current content', async t => {
  const f = await fixture(t);
  const { plan } = await f.assign();
  await prisma.booking.updateMany({ where: { memberId: f.first.id }, data: { status: 'CANCELLED' } });
  await assert.rejects(f.assign(), errorStatus(403));
  assert.equal((await prisma.studentWorkoutPlan.findUniqueOrThrow({ where: { id: plan.id } })).status, 'ACTIVE');
  await prisma.coachProfile.update({ where: { userId: f.coach.id }, data: { status: 'BLOCKED' } });
  await assert.rejects(f.assign(f.second.id), errorStatus(403));
});

function response() {
  const output = { status: 200, body: null as any };
  const res = { status(value: number) { output.status = value; return res; }, json(value: any) { output.body = value; return res; } };
  return { output, res: res as any };
}

test('member progress returns the updated personal plan and HTTP history/update handlers enforce ownership', async t => {
  const f = await fixture(t);
  const { plan } = await f.assign();
  await f.revise(plan.id, 1);
  const progress = response();
  await getMemberProgress({ params: { memberId: String(f.first.id) }, user: { userId: f.first.id, role: 'MEMBER' } } as any, progress.res);
  assert.equal(progress.output.status, 200);
  assert.equal(progress.output.body.data.plans[0].version, 2);
  assert.equal(progress.output.body.data.plans[0].sessions[0].exercises[0].weightKg, 20);
  const history = response();
  await getStudentPlanRevisions({ params: { id: String(plan.id) }, user: { userId: f.first.id, role: 'MEMBER' } } as any, history.res);
  assert.equal(history.output.body.data.length, 2);
  const forbidden = response();
  await updateStudentPlan({ params: { id: String(plan.id) }, user: { userId: f.otherCoach.id, role: 'COACH' }, body: { ...draft(5), expectedVersion: 2, changeReason: 'not allowed' } } as any, forbidden.res);
  assert.equal(forbidden.output.status, 403);
});

test('content validation rejects malformed exercises but permits a workout without a meal plan', () => {
  assert.equal(normalizePlanDraft(draft()).mealsJson, '[]');
  assert.equal(normalizeProgramName(' sức   bền '), 'SỨC BỀN');
  for (const bad of [{ ...draft(), title: '' }, { ...draft(), sessions: [] },
    { ...draft(), sessions: [{ ...draft().sessions[0], exercises: [{ ...draft().sessions[0].exercises[0], sets: 0 }] }] },
    { ...draft(), sessions: [{ ...draft().sessions[0], exercises: [{ ...draft().sessions[0].exercises[0], weightKg: -1 }] }] }]) {
    assert.throws(() => normalizePlanDraft(bad), errorStatus(400));
  }
});
