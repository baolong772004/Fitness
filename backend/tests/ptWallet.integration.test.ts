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
const { markPaymentPaid } = await import('../src/services/payment.service.js');
const { ptRenewalError } = await import('../src/services/ptRenewal.service.js');
const { createWalletPtBookings } = await import('../src/services/ptBooking.service.js');
const { walletSummary, settlePtCredit, releasePtCredit, refundConsumedPtCredit } = await import('../src/services/ptWallet.service.js');
const { dayOfWeek, localInstant, vietnamDate } = await import('../src/services/ptCalendar.service.js');
const { cancelUncoveredWalletBooking, markPtNoShow } = await import('../src/services/ptNoShow.service.js');
const { backfillPtWallet } = await import('../scripts/backfillPtWallet.js');
const { createWalletPtMakeup } = await import('../src/services/ptBooking.service.js');
const { PtController } = await import('../src/controllers/pt.controller.js');
const { PaymentController } = await import('../src/controllers/payment.controller.js');
const { putCoachDates } = await import('../src/controllers/ptAvailability.controller.js');
const { adjustPtWallet, createPtProduct, updatePtProduct, createPtRenewalOption, setCoachSpecializations } = await import('../src/controllers/ptWallet.controller.js');
const { updateTrainerPricing } = await import('../src/controllers/adminTrainer.controller.js');
const { getMembersList, getMemberDetailProfile } = await import('../src/controllers/admin.controller.js');
const { getPtChatAccess } = await import('../src/services/ptChat.service.js');
const prisma = new PrismaClient();

let sequence = 0;
const orderCode = () => BigInt(Date.now() * 1000 + ++sequence);
const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 86400000);
const fakeResponse = () => {
  const output: { code: number; body: any } = { code: 200, body: null };
  const response = { status(code: number) { output.code = code; return response; },
    json(body: any) { output.body = body; return response; } };
  return { output, response: response as any };
};

async function memberFixture(t: { after: (fn: () => Promise<void>) => void }) {
  const user = await prisma.user.create({ data: { email: `pt-${randomUUID()}@example.invalid`,
    fullName: 'PT test member', password: 'unused', role: 'MEMBER', status: 'ACTIVE' } });
  const packages: number[] = [], products: number[] = [], renewalOptions: number[] = [];
  t.after(async () => {
    const batchIds = (await prisma.ptCreditBatch.findMany({ where: { wallet: { memberId: user.id } }, select: { id: true } })).map(row => row.id);
    const bookingIds = (await prisma.booking.findMany({ where: { memberId: user.id }, select: { id: true } })).map(row => row.id);
    await prisma.ptRenewalEvent.deleteMany({ where: { batchId: { in: batchIds } } });
    await prisma.payment.deleteMany({ where: { userId: user.id, ptRenewalBatchId: { not: null } } });
    await prisma.ptCreditTransaction.deleteMany({ where: { batchId: { in: batchIds } } });
    await prisma.ptBookingCreditAllocation.deleteMany({ where: { bookingId: { in: bookingIds } } });
    await prisma.makeUpRequest.deleteMany({ where: { originalBookingId: { in: bookingIds } } });
    await prisma.booking.deleteMany({ where: { id: { in: bookingIds } } });
    await prisma.ptCreditBatch.deleteMany({ where: { id: { in: batchIds } } });
    await prisma.ptWallet.deleteMany({ where: { memberId: user.id } });
    await prisma.checkIn.deleteMany({ where: { memberId: user.id } });
    await prisma.payment.deleteMany({ where: { userId: user.id } });
    await prisma.membership.deleteMany({ where: { userId: user.id } });
    await prisma.ptRenewalOption.deleteMany({ where: { id: { in: renewalOptions } } });
    await prisma.ptProduct.deleteMany({ where: { id: { in: products } } });
    await prisma.package.deleteMany({ where: { id: { in: packages } } });
    await prisma.notification.deleteMany({ where: { userId: user.id } });
    await prisma.actionLog.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });
  const makeGym = async (trialPtSessions = 0) => {
    const pkg = await prisma.package.create({ data: { name: `Gym ${randomUUID()}`, type: 'MEMBERSHIP',
      price: 100000, durationDays: 30, trialPtSessions } });
    packages.push(pkg.id);
    const gym = await prisma.membership.create({ data: { userId: user.id, packageId: pkg.id,
      isGymMembership: true, status: 'PENDING', startDate: new Date(), endDate: addDays(new Date(), 30),
      remainingSessions: trialPtSessions } });
    const code = orderCode();
    const payment = await prisma.payment.create({ data: { userId: user.id, membershipId: gym.id,
      amount: 100000, method: 'PAYOS', status: 'PENDING', orderCode: code, transactionNo: `TEST-${code}` } });
    assert.equal((await markPaymentPaid(payment.orderCode!, 100000)).result, 'PAID');
    return { gym, payment };
  };
  const buy = async (level: string, sessionCount: number, quantity = 1, durationDays?: number) => {
    const product = await prisma.ptProduct.create({ data: { name: `${level} ${randomUUID()}`,
      level, sessionCount, price: 100000, durationDays } });
    products.push(product.id);
    const code = orderCode();
    const payment = await prisma.payment.create({ data: { userId: user.id, amount: 100000 * quantity,
      method: 'PAYOS', status: 'PENDING', orderCode: code, transactionNo: `TEST-${code}`,
      ptProductId: product.id, ptQuantity: quantity,
      ptLevelSnapshot: level, ptSessionsSnapshot: sessionCount, ptDurationDays: durationDays } });
    assert.equal((await markPaymentPaid(payment.orderCode!, 100000 * quantity)).result, 'PAID');
    return payment;
  };
  const renewalOrder = async (batchId: number, durationDays: number, amount = 50000) => {
    const batch = await prisma.ptCreditBatch.findUniqueOrThrow({ where: { id: batchId },
      include: { payment: { select: { ptProductId: true } } } });
    const ptProductId = batch.payment?.ptProductId ?? null;
    const option = await prisma.ptRenewalOption.create({ data: { name: `Renew ${randomUUID()}`,
      level: batch.level, durationDays, price: amount, ptProductId } });
    renewalOptions.push(option.id);
    const code = orderCode();
    const payment = await prisma.payment.create({ data: { userId: user.id, amount,
      method: 'PAYOS', status: 'PENDING', orderCode: code, transactionNo: `TEST-${code}`,
      ptRenewalOptionId: option.id, ptRenewalProductId: ptProductId, ptRenewalBatchId: batchId,
      ptRenewalDays: durationDays, ptLevelSnapshot: batch.level } });
    return { option, payment };
  };
  return { user, makeGym, buy, renewalOrder, renewalOptions };
}

async function coachFixture(t: { after: (fn: () => Promise<void>) => void }, date: string) {
  const coach = await prisma.user.create({ data: { email: `coach-${randomUUID()}@example.invalid`,
    fullName: 'PT test coach', password: 'unused', role: 'COACH', status: 'ACTIVE' } });
  const profile = await prisma.coachProfile.create({ data: { userId: coach.id, status: 'ACTIVE',
    specializations: { create: [{ level: 'BEGINNER' }, { level: 'ADVANCED' }, { level: 'TRIAL' }] },
    schedules: { create: [{ dayOfWeek: dayOfWeek(date), startTime: '09:00', endTime: '11:00' }] } } });
  t.after(async () => {
    await prisma.coachSpecialization.deleteMany({ where: { coachProfileId: profile.id } });
    await prisma.coachSchedule.deleteMany({ where: { coachProfileId: profile.id } });
    await prisma.coachProfile.delete({ where: { id: profile.id } });
    await prisma.notification.deleteMany({ where: { userId: coach.id } });
    await prisma.actionLog.deleteMany({ where: { userId: coach.id } });
    await prisma.user.delete({ where: { id: coach.id } });
  });
  return coach;
}

test('paid Gym gift grants exactly two Trial credits despite callback replay', async t => {
  const { user, makeGym } = await memberFixture(t);
  const { payment } = await makeGym(2);
  assert.equal((await markPaymentPaid(payment.orderCode!, 100000)).result, 'ALREADY_PAID');
  const wallet = await walletSummary(prisma, user.id);
  assert.equal(wallet.levels.find(row => row.level === 'TRIAL')?.total, 2);
  assert.equal(await prisma.ptCreditBatch.count({ where: { membershipId: payment.membershipId } }), 1);
});

test('admin member list and profile report each member real Gym, PT credit and check-in data', async t => {
  const first = await memberFixture(t);
  const second = await memberFixture(t);
  const { gym: firstGym } = await first.makeGym(2);
  await second.makeGym();
  await second.buy('BEGINNER', 3);
  await prisma.checkIn.create({ data: { memberId: first.user.id, membershipId: firstGym.id, status: 'SUCCESS' } });
  await prisma.checkIn.create({ data: { memberId: second.user.id, status: 'REJECTED' } });

  const firstList = fakeResponse();
  await getMembersList({ query: { search: first.user.email, limit: '10' } } as any, firstList.response);
  assert.equal(firstList.output.code, 200);
  const firstRow = firstList.output.body.data[0];
  assert.equal(firstRow.id, first.user.id);
  assert.equal(firstRow.currentGymMembership.id, firstGym.id);
  assert.equal(firstRow.ptCredit.available, 2);
  assert.equal(firstRow.checkInCount, 1);

  const secondList = fakeResponse();
  await getMembersList({ query: { search: second.user.email, limit: '10' } } as any, secondList.response);
  assert.equal(secondList.output.code, 200);
  const secondRow = secondList.output.body.data[0];
  assert.equal(secondRow.id, second.user.id);
  assert.notEqual(secondRow.currentGymMembership.package.name, firstRow.currentGymMembership.package.name);
  assert.equal(secondRow.ptCredit.available, 3);
  assert.equal(secondRow.checkInCount, 0);

  const profile = fakeResponse();
  await getMemberDetailProfile({ params: { id: String(first.user.id) } } as any, profile.response);
  assert.equal(profile.output.code, 200);
  assert.equal(profile.output.body.data.currentGymMembership.id, firstGym.id);
  assert.equal(profile.output.body.data.ptWalletSummary.available, 2);
  assert.equal(profile.output.body.data.checkInTotal, 1);
});

test('single Beginner and three Advanced accumulate independently and survive Gym expiry', async t => {
  const { user, makeGym, buy } = await memberFixture(t);
  const { gym } = await makeGym();
  await buy('BEGINNER', 1);
  await buy('ADVANCED', 1, 3);
  await prisma.membership.update({ where: { id: gym.id }, data: { status: 'EXPIRED', endDate: addDays(new Date(), -1) } });
  const wallet = await walletSummary(prisma, user.id);
  assert.equal(wallet.levels.find(row => row.level === 'BEGINNER')?.available, 1);
  assert.equal(wallet.levels.find(row => row.level === 'ADVANCED')?.available, 3);
});

test('batch booking holds credit, blocks wrong level, then settles and refunds once', async t => {
  const { user, makeGym, buy } = await memberFixture(t);
  await makeGym();
  await buy('BEGINNER', 2);
  const date = vietnamDate(addDays(new Date(), 3));
  const coach = await coachFixture(t, date);
  const first = localInstant(date, 9 * 60), second = localInstant(date, 10 * 60);
  await assert.rejects(createWalletPtBookings({ memberId: user.id, coachId: coach.id,
    level: 'ADVANCED', starts: [first] }));
  const bookings = await createWalletPtBookings({ memberId: user.id, coachId: coach.id,
    level: 'BEGINNER', starts: [first, second] });
  assert.equal(bookings.length, 2);
  assert.ok(bookings.every(booking => booking.status === 'CONFIRMED'));
  assert.equal((await walletSummary(prisma, user.id)).levels.find(row => row.level === 'BEGINNER')?.held, 2);
  await assert.rejects(createWalletPtBookings({ memberId: user.id, coachId: coach.id,
    level: 'BEGINNER', starts: [first] }));
  await prisma.$transaction(async tx => {
    assert.equal(await settlePtCredit(tx, bookings[0].id), true);
    assert.equal(await settlePtCredit(tx, bookings[0].id), false);
    assert.equal(await releasePtCredit(tx, bookings[1].id), true);
    assert.equal(await releasePtCredit(tx, bookings[1].id), false);
    assert.equal(await refundConsumedPtCredit(tx, bookings[0].id), true);
    assert.equal(await refundConsumedPtCredit(tx, bookings[0].id), false);
  });
  const balance = (await walletSummary(prisma, user.id)).levels.find(row => row.level === 'BEGINNER');
  assert.equal(balance?.held, 0);
  assert.equal(balance?.used, 0);
  assert.equal(balance?.available, 2);
});

test('paid Pending Activation Gym covers a future Trial session but not dates after expiry', async t => {
  const { user, makeGym } = await memberFixture(t);
  await makeGym();
  await makeGym(2);
  const queued = await prisma.membership.findFirstOrThrow({ where: { userId: user.id,
    status: 'PENDING_ACTIVATION' } });
  const date = vietnamDate(addDays(queued.startDate, 2));
  const coach = await coachFixture(t, date);
  const [booking] = await createWalletPtBookings({ memberId: user.id, coachId: coach.id,
    level: 'TRIAL', starts: [localInstant(date, 9 * 60)] });
  assert.equal(booking.status, 'CONFIRMED');
  assert.equal(booking.membershipId, queued.id);
  const afterExpiry = vietnamDate(addDays(localInstant(date, 9 * 60), 35));
  await assert.rejects(createWalletPtBookings({ memberId: user.id, coachId: coach.id,
    level: 'TRIAL', starts: [localInstant(afterExpiry, 9 * 60)] }));
});

test('two members racing for one coach slot produce exactly one booking', async t => {
  const first = await memberFixture(t), second = await memberFixture(t);
  await Promise.all([first.makeGym(), second.makeGym()]);
  await Promise.all([first.buy('BEGINNER', 1), second.buy('BEGINNER', 1)]);
  const date = vietnamDate(addDays(new Date(), 4));
  const coach = await coachFixture(t, date);
  const start = localInstant(date, 9 * 60);
  const results = await Promise.allSettled([first, second].map(item => createWalletPtBookings({
    memberId: item.user.id, coachId: coach.id, level: 'BEGINNER', starts: [start],
  })));
  assert.equal(results.filter(row => row.status === 'fulfilled').length, 1);
  assert.equal(await prisma.booking.count({ where: { coachId: coach.id, startTime: start,
    status: 'CONFIRMED' } }), 1);
});

test('automatic no-show consumes exactly one held credit on repeated scans', async t => {
  const { user, makeGym, buy } = await memberFixture(t);
  await makeGym(); await buy('BEGINNER', 1);
  const date = vietnamDate(addDays(new Date(), 3));
  const coach = await coachFixture(t, date);
  const [booking] = await createWalletPtBookings({ memberId: user.id, coachId: coach.id,
    level: 'BEGINNER', starts: [localInstant(date, 9 * 60)] });
  const cutoff = new Date();
  await prisma.booking.update({ where: { id: booking.id }, data: {
    startTime: addDays(cutoff, -1), endTime: addDays(cutoff, -1),
  } });
  assert.ok(await markPtNoShow(booking.id, cutoff));
  assert.equal(await markPtNoShow(booking.id, cutoff), null);
  const balance = (await walletSummary(prisma, user.id)).levels.find(row => row.level === 'BEGINNER');
  assert.equal(balance?.held, 0);
  assert.equal(balance?.used, 1);
});

test('legacy PT balances and confirmed bookings backfill without duplicate grants', async t => {
  const { user } = await memberFixture(t);
  const date = vietnamDate(addDays(new Date(), 3));
  const coach = await coachFixture(t, date);
  const pkg = await prisma.package.create({ data: { name: `Legacy PT ${randomUUID()}`,
    type: 'PT', ptLevel: 'ADVANCED', price: 300000, durationDays: 30, totalPtSessions: 3 } });
  t.after(() => prisma.package.delete({ where: { id: pkg.id } }).then(() => undefined));
  const membership = await prisma.membership.create({ data: { userId: user.id, packageId: pkg.id,
    coachId: coach.id, status: 'ACTIVE', startDate: new Date(), endDate: addDays(new Date(), 30),
    remainingSessions: 2 } });
  const code = orderCode();
  await prisma.payment.create({ data: { userId: user.id, membershipId: membership.id,
    amount: 300000, method: 'PAYOS', status: 'PAID', orderCode: code,
    transactionNo: `TEST-${code}`, paidAt: new Date() } });
  const booking = await prisma.booking.create({ data: { type: 'PT', memberId: user.id,
    coachId: coach.id, membershipId: membership.id, startTime: localInstant(date, 9 * 60),
    endTime: localInstant(date, 10 * 60), status: 'CONFIRMED' } });
  const dryRun = await backfillPtWallet(prisma);
  assert.equal(dryRun.errors.length, 0);
  assert.equal(dryRun.ready, 1);
  const applied = await backfillPtWallet(prisma, true);
  assert.equal(applied.errors.length, 0);
  assert.equal((await backfillPtWallet(prisma, true)).ready, 0);
  const batch = await prisma.ptCreditBatch.findFirstOrThrow({ where: { membershipId: membership.id } });
  assert.equal(batch.initialCount, 3);
  assert.equal(batch.usedCount, 1);
  assert.equal(batch.heldCount, 1);
  assert.equal((await prisma.ptBookingCreditAllocation.findUnique({ where: { bookingId: booking.id } }))?.batchId, batch.id);
  assert.equal((await walletSummary(prisma, user.id)).levels.find(row => row.level === 'ADVANCED')?.available, 1);
});

test('early member absence transfers the held credit to a makeup session within seven days', async t => {
  const { user, makeGym, buy } = await memberFixture(t);
  await makeGym(); await buy('BEGINNER', 1);
  const date = vietnamDate(addDays(new Date(), 3));
  const coach = await coachFixture(t, date);
  const [original] = await createWalletPtBookings({ memberId: user.id, coachId: coach.id,
    level: 'BEGINNER', starts: [localInstant(date, 9 * 60)] });
  const makeupDate = vietnamDate(addDays(localInstant(date, 9 * 60), 1));
  const profile = await prisma.coachProfile.findUniqueOrThrow({ where: { userId: coach.id } });
  await prisma.coachSchedule.create({ data: { coachProfileId: profile.id,
    dayOfWeek: dayOfWeek(makeupDate), startTime: '09:00', endTime: '11:00' } });
  const absence = fakeResponse();
  await PtController.markAbsent({ user: { userId: user.id, role: 'MEMBER' },
    params: { id: String(original.id) }, body: { reason: 'Bận công tác' } } as any, absence.response);
  assert.equal(absence.output.code, 200);
  assert.equal(absence.output.body.data.status, 'ABSENT_ELIGIBLE');
  const makeup = await createWalletPtMakeup({ memberId: user.id, originalBookingId: original.id,
    start: localInstant(makeupDate, 9 * 60) });
  assert.equal(makeup.status, 'CONFIRMED');
  assert.equal(makeup.isMakeup, true);
  assert.equal(await prisma.ptBookingCreditAllocation.findUnique({ where: { bookingId: original.id } }), null);
  assert.ok(await prisma.ptBookingCreditAllocation.findUnique({ where: { bookingId: makeup.id } }));
  assert.equal((await walletSummary(prisma, user.id)).levels.find(row => row.level === 'BEGINNER')?.held, 1);
  await assert.rejects(createWalletPtMakeup({ memberId: user.id, originalBookingId: original.id,
    start: localInstant(makeupDate, 10 * 60) }));
});

test('late member absence consumes one credit and cannot create a makeup right', async t => {
  const { user, makeGym, buy } = await memberFixture(t);
  await makeGym(); await buy('BEGINNER', 1);
  const date = vietnamDate(addDays(new Date(), 3));
  const coach = await coachFixture(t, date);
  const [booking] = await createWalletPtBookings({ memberId: user.id, coachId: coach.id,
    level: 'BEGINNER', starts: [localInstant(date, 9 * 60)] });
  await prisma.booking.update({ where: { id: booking.id }, data: {
    startTime: new Date(Date.now() + 60 * 60000), endTime: new Date(Date.now() + 120 * 60000),
  } });
  const response = fakeResponse();
  await PtController.markAbsent({ user: { userId: user.id, role: 'MEMBER' },
    params: { id: String(booking.id) }, body: { reason: 'Báo trễ' } } as any, response.response);
  assert.equal(response.output.code, 200);
  assert.equal(response.output.body.data.status, 'ABSENT_NO_REFUND');
  assert.equal(await prisma.makeUpRequest.count({ where: { originalBookingId: booking.id } }), 0);
  assert.equal((await walletSummary(prisma, user.id)).levels.find(row => row.level === 'BEGINNER')?.used, 1);
});

test('PT QR accepts the correct member once and rejects a replay', async t => {
  process.env.JWT_SECRET = 'pt-integration-secret';
  const { user, makeGym, buy } = await memberFixture(t);
  await makeGym(); await buy('BEGINNER', 1);
  const date = vietnamDate(addDays(new Date(), 3));
  const coach = await coachFixture(t, date);
  const [booking] = await createWalletPtBookings({ memberId: user.id, coachId: coach.id,
    level: 'BEGINNER', starts: [localInstant(date, 9 * 60)] });
  await prisma.booking.update({ where: { id: booking.id }, data: {
    startTime: new Date(Date.now() + 5 * 60000), endTime: new Date(Date.now() + 65 * 60000),
  } });
  const generated = fakeResponse();
  await PtController.generateSessionQr({ user: { userId: coach.id, role: 'COACH' },
    params: { id: String(booking.id) } } as any, generated.response);
  assert.equal(generated.output.code, 200);
  const token = generated.output.body.data.token;
  const scanned = fakeResponse();
  await PtController.startSessionWithQr({ user: { userId: user.id, role: 'MEMBER' },
    body: { qrToken: token } } as any, scanned.response);
  assert.equal(scanned.output.code, 200);
  const replay = fakeResponse();
  await PtController.startSessionWithQr({ user: { userId: user.id, role: 'MEMBER' },
    body: { qrToken: token } } as any, replay.response);
  assert.notEqual(replay.output.code, 200);
});

test('recorded cash Gym membership gifts Trial credit and covers a PT booking', async t => {
  const { user } = await memberFixture(t);
  const pkg = await prisma.package.create({ data: { name: `Cash Gym ${randomUUID()}`,
    type: 'MEMBERSHIP', durationDays: 30, price: 100000, trialPtSessions: 2 } });
  t.after(() => prisma.package.delete({ where: { id: pkg.id } }).then(() => undefined));
  const gym = await prisma.membership.create({ data: { userId: user.id, packageId: pkg.id,
    status: 'ACTIVE', isGymMembership: true, startDate: addDays(new Date(), -1),
    endDate: addDays(new Date(), 30), remainingSessions: 2 } });
  const code = orderCode();
  await prisma.payment.create({ data: { userId: user.id, membershipId: gym.id,
    amount: 100000, method: 'CASH', status: 'COMPLETED', orderCode: code,
    transactionNo: `CASH-TEST-${code}` } });
  assert.equal((await backfillPtWallet(prisma, true)).errors.length, 0);
  const date = vietnamDate(addDays(new Date(), 3));
  const coach = await coachFixture(t, date);
  const [booking] = await createWalletPtBookings({ memberId: user.id, coachId: coach.id,
    level: 'TRIAL', starts: [localInstant(date, 9 * 60)] });
  assert.equal(booking.status, 'CONFIRMED');
  assert.equal(booking.membershipId, gym.id);
});

test('cancelling Gym before a confirmed session releases its held paid credit', async t => {
  const { user, makeGym, buy } = await memberFixture(t);
  const { gym } = await makeGym();
  await buy('BEGINNER', 1);
  const date = vietnamDate(addDays(new Date(), 3));
  const coach = await coachFixture(t, date);
  const [booking] = await createWalletPtBookings({ memberId: user.id, coachId: coach.id,
    level: 'BEGINNER', starts: [localInstant(date, 9 * 60)] });
  await prisma.membership.update({ where: { id: gym.id }, data: { status: 'CANCELLED' } });
  await cancelUncoveredWalletBooking(booking.id);
  await cancelUncoveredWalletBooking(booking.id);
  assert.equal((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).status, 'CANCELLED');
  const balance = (await walletSummary(prisma, user.id)).levels.find(row => row.level === 'BEGINNER');
  assert.equal(balance?.held, 0);
  assert.equal(balance?.available, 1);
});

test('two paid purchases of the same level create separate batches and one pooled balance', async t => {
  const { user, buy } = await memberFixture(t);
  await buy('INTERMEDIATE', 2);
  await buy('INTERMEDIATE', 3);
  const balance = (await walletSummary(prisma, user.id)).levels.find(row => row.level === 'INTERMEDIATE');
  assert.equal(balance?.available, 5);
  assert.equal(await prisma.ptCreditBatch.count({ where: { wallet: { memberId: user.id }, level: 'INTERMEDIATE' } }), 2);
});

test('Gym must cover the entire PT slot and booking must be at least two hours ahead', async t => {
  const { user, makeGym, buy } = await memberFixture(t);
  const { gym } = await makeGym(); await buy('BEGINNER', 1);
  const date = vietnamDate(addDays(new Date(), 3));
  const coach = await coachFixture(t, date);
  const start = localInstant(date, 9 * 60);
  await prisma.membership.update({ where: { id: gym.id }, data: { endDate: new Date(start.getTime() + 30 * 60000) } });
  await assert.rejects(createWalletPtBookings({ memberId: user.id, coachId: coach.id,
    level: 'BEGINNER', starts: [start] }));
  await assert.rejects(createWalletPtBookings({ memberId: user.id, coachId: coach.id,
    level: 'BEGINNER', starts: [new Date(Date.now() + 60 * 60000)] }));
  assert.equal((await walletSummary(prisma, user.id)).held, 0);
});

test('batch booking is atomic when one requested slot is invalid or credit is insufficient', async t => {
  const { user, makeGym, buy } = await memberFixture(t);
  await makeGym(); await buy('BEGINNER', 1);
  const date = vietnamDate(addDays(new Date(), 3));
  const coach = await coachFixture(t, date);
  const first = localInstant(date, 9 * 60), second = localInstant(date, 10 * 60);
  await assert.rejects(createWalletPtBookings({ memberId: user.id, coachId: coach.id,
    level: 'BEGINNER', starts: [first, localInstant(date, 12 * 60)] }));
  assert.equal(await prisma.booking.count({ where: { memberId: user.id } }), 0);
  await assert.rejects(createWalletPtBookings({ memberId: user.id, coachId: coach.id,
    level: 'BEGINNER', starts: [first, second] }));
  assert.equal(await prisma.booking.count({ where: { memberId: user.id } }), 0);
  assert.equal((await walletSummary(prisma, user.id)).held, 0);
});

test('member cannot overlap two coaches and coach specialization is checked by backend', async t => {
  const { user, makeGym, buy } = await memberFixture(t);
  await makeGym(); await buy('BEGINNER', 2); await buy('ADVANCED', 1);
  const date = vietnamDate(addDays(new Date(), 3));
  const firstCoach = await coachFixture(t, date), secondCoach = await coachFixture(t, date);
  const start = localInstant(date, 9 * 60);
  await createWalletPtBookings({ memberId: user.id, coachId: firstCoach.id,
    level: 'BEGINNER', starts: [start] });
  await assert.rejects(createWalletPtBookings({ memberId: user.id, coachId: secondCoach.id,
    level: 'BEGINNER', starts: [start] }));
  const profile = await prisma.coachProfile.findUniqueOrThrow({ where: { userId: secondCoach.id } });
  await prisma.coachSpecialization.delete({ where: { coachProfileId_level: {
    coachProfileId: profile.id, level: 'ADVANCED' } } });
  await assert.rejects(createWalletPtBookings({ memberId: user.id, coachId: secondCoach.id,
    level: 'ADVANCED', starts: [localInstant(date, 10 * 60)] }));
});

test('Coach cannot publish a shift outside Gym hours or remove a booked shift', async t => {
  const { user, makeGym, buy } = await memberFixture(t);
  await makeGym(); await buy('BEGINNER', 1);
  const date = vietnamDate(addDays(new Date(), 3));
  const coach = await coachFixture(t, date);
  const outside = fakeResponse();
  await putCoachDates({ user: { userId: coach.id, role: 'COACH' }, body: { dates: [{ date,
    shifts: [{ startTime: '23:00', endTime: '24:00' }] }] } } as any, outside.response);
  assert.equal(outside.output.code, 409);
  await createWalletPtBookings({ memberId: user.id, coachId: coach.id,
    level: 'BEGINNER', starts: [localInstant(date, 9 * 60)] });
  const remove = fakeResponse();
  await putCoachDates({ user: { userId: coach.id, role: 'COACH' }, body: { dates: [{ date,
    shifts: [] }] } } as any, remove.response);
  assert.equal(remove.output.code, 409);
});

test('Admin cannot revoke a specialization used by a future confirmed booking', async t => {
  const { user, makeGym, buy } = await memberFixture(t);
  await makeGym(); await buy('BEGINNER', 1);
  const date = vietnamDate(addDays(new Date(), 3));
  const coach = await coachFixture(t, date);
  await createWalletPtBookings({ memberId: user.id, coachId: coach.id,
    level: 'BEGINNER', starts: [localInstant(date, 9 * 60)] });
  const response = fakeResponse();
  await assert.rejects(setCoachSpecializations({ user: { userId: user.id, role: 'ADMIN' },
    params: { coachId: String(coach.id) }, body: { levels: ['TRIAL', 'ADVANCED'] } } as any, response.response));
  const profile = await prisma.coachProfile.findUniqueOrThrow({ where: { userId: coach.id } });
  assert.ok(await prisma.coachSpecialization.findUnique({ where: { coachProfileId_level: {
    coachProfileId: profile.id, level: 'BEGINNER' } } }));
});

test('Coach form saves pricing and PT levels together and rejects a booked level removal atomically', async t => {
  const { user, makeGym, buy } = await memberFixture(t);
  await makeGym(); await buy('BEGINNER', 1);
  const date = vietnamDate(addDays(new Date(), 3));
  const coach = await coachFixture(t, date);
  const profile = await prisma.coachProfile.findUniqueOrThrow({ where: { userId: coach.id } });
  const save = fakeResponse();
  await updateTrainerPricing({ user: { userId: user.id, role: 'ADMIN' },
    params: { id: String(profile.id) }, body: { hourlyRate: 125000,
      commissionPercent: 45, rank: 'senior', levels: ['BEGINNER', 'TRIAL'] } } as any, save.response);
  assert.equal(save.output.code, 200);
  assert.deepEqual((await prisma.coachSpecialization.findMany({ where: { coachProfileId: profile.id },
    orderBy: { level: 'asc' } })).map(row => row.level), ['BEGINNER', 'TRIAL']);
  await createWalletPtBookings({ memberId: user.id, coachId: coach.id,
    level: 'BEGINNER', starts: [localInstant(date, 9 * 60)] });
  const rejected = fakeResponse();
  await updateTrainerPricing({ user: { userId: user.id, role: 'ADMIN' },
    params: { id: String(profile.id) }, body: { hourlyRate: 200000,
      commissionPercent: 50, rank: 'master', levels: ['TRIAL'] } } as any, rejected.response);
  assert.equal(rejected.output.code, 409);
  const unchanged = await prisma.coachProfile.findUniqueOrThrow({ where: { id: profile.id },
    include: { specializations: true } });
  assert.equal(Number(unchanged.hourlyRate), 125000);
  assert.equal(unchanged.rank, 'senior');
  assert.ok(unchanged.specializations.some(row => row.level === 'BEGINNER'));
});

test('Admin adjustment cannot use held credit and records positive and negative changes', async t => {
  const { user, makeGym, buy } = await memberFixture(t);
  await makeGym(); await buy('BEGINNER', 1);
  const date = vietnamDate(addDays(new Date(), 3));
  const coach = await coachFixture(t, date);
  await createWalletPtBookings({ memberId: user.id, coachId: coach.id,
    level: 'BEGINNER', starts: [localInstant(date, 9 * 60)] });
  const debit = fakeResponse();
  await adjustPtWallet({ user: { userId: user.id, role: 'ADMIN' },
    params: { memberId: String(user.id) }, body: { level: 'BEGINNER', delta: -1, reason: 'Kiểm tra số dư' } } as any, debit.response);
  assert.equal(debit.output.code, 409);
  const credit = fakeResponse();
  await adjustPtWallet({ user: { userId: user.id, role: 'ADMIN' },
    params: { memberId: String(user.id) }, body: { level: 'BEGINNER', delta: 2, reason: 'Bù quyền lợi' } } as any, credit.response);
  assert.equal(credit.output.code, 200);
  const afterCredit = (await walletSummary(prisma, user.id)).levels.find(row => row.level === 'BEGINNER');
  assert.equal(afterCredit?.available, 2);
  const adjusted = fakeResponse();
  await adjustPtWallet({ user: { userId: user.id, role: 'ADMIN' },
    params: { memberId: String(user.id) }, body: { level: 'BEGINNER', delta: -1, reason: 'Sửa sai lệch' } } as any, adjusted.response);
  assert.equal(adjusted.output.code, 200);
  assert.equal((await walletSummary(prisma, user.id)).levels.find(row => row.level === 'BEGINNER')?.available, 1);
});

test('PT chat access is restricted to the booked member and coach', async t => {
  const { user, makeGym, buy } = await memberFixture(t);
  const outsider = await memberFixture(t);
  await makeGym(); await buy('BEGINNER', 1);
  const date = vietnamDate(addDays(new Date(), 3));
  const coach = await coachFixture(t, date);
  const [booking] = await createWalletPtBookings({ memberId: user.id, coachId: coach.id,
    level: 'BEGINNER', starts: [localInstant(date, 9 * 60)] });
  assert.equal((await getPtChatAccess(booking.id, user.id)).canSend, true);
  assert.equal((await getPtChatAccess(booking.id, coach.id)).canSend, true);
  await assert.rejects(getPtChatAccess(booking.id, outsider.user.id));
});

test('mismatched PayOS amount requires review and grants no PT credit', async t => {
  const { user } = await memberFixture(t);
  const product = await prisma.ptProduct.create({ data: { name: `PT ${randomUUID()}`,
    level: 'BEGINNER', sessionCount: 2, price: 100000 } });
  t.after(() => prisma.ptProduct.delete({ where: { id: product.id } }).then(() => undefined));
  const code = orderCode();
  await prisma.payment.create({ data: { userId: user.id, amount: 100000, method: 'PAYOS',
    status: 'PENDING', orderCode: code, transactionNo: `TEST-${code}`,
    ptProductId: product.id, ptQuantity: 1 } });
  assert.equal((await markPaymentPaid(code, 50000)).result, 'AMOUNT_MISMATCH');
  assert.equal((await markPaymentPaid(code, 50000)).result, 'ALREADY_PAID_REVIEW');
  assert.equal((await walletSummary(prisma, user.id)).total, 0);
});

test('paid PT credit without any Gym entitlement cannot book', async t => {
  const { user, buy } = await memberFixture(t);
  await buy('BEGINNER', 1);
  const date = vietnamDate(addDays(new Date(), 3));
  const coach = await coachFixture(t, date);
  await assert.rejects(createWalletPtBookings({ memberId: user.id, coachId: coach.id,
    level: 'BEGINNER', starts: [localInstant(date, 9 * 60)] }));
  assert.equal((await walletSummary(prisma, user.id)).levels.find(row => row.level === 'BEGINNER')?.available, 1);
});

test('Coach publishing a valid new shift makes its slots bookable', async t => {
  const { user, makeGym, buy } = await memberFixture(t);
  await makeGym(); await buy('BEGINNER', 1);
  const date = vietnamDate(addDays(new Date(), 3));
  const coach = await coachFixture(t, date);
  const published = fakeResponse();
  await putCoachDates({ user: { userId: coach.id, role: 'COACH' }, body: { dates: [{ date,
    shifts: [{ startTime: '13:00', endTime: '14:00' }] }] } } as any, published.response);
  assert.equal(published.output.code, 200);
  const [booking] = await createWalletPtBookings({ memberId: user.id, coachId: coach.id,
    level: 'BEGINNER', starts: [localInstant(date, 13 * 60)] });
  assert.equal(booking.status, 'CONFIRMED');
});

test('Coach absence retains credit and creates a makeup right without member quota use', async t => {
  const { user, makeGym, buy } = await memberFixture(t);
  await makeGym(); await buy('BEGINNER', 1);
  const date = vietnamDate(addDays(new Date(), 3));
  const coach = await coachFixture(t, date);
  const [booking] = await createWalletPtBookings({ memberId: user.id, coachId: coach.id,
    level: 'BEGINNER', starts: [localInstant(date, 9 * 60)] });
  const response = fakeResponse();
  await PtController.markAbsent({ user: { userId: coach.id, role: 'COACH' },
    params: { id: String(booking.id) }, body: { reason: 'Coach ill' } } as any, response.response);
  assert.equal(response.output.code, 200);
  assert.equal(response.output.body.data.status, 'ABSENT_ELIGIBLE');
  assert.equal(await prisma.makeUpRequest.count({ where: { originalBookingId: booking.id,
    status: 'PENDING' } }), 1);
  assert.equal(await prisma.ptCreditTransaction.count({ where: { bookingId: booking.id,
    kind: 'MEMBER_MAKEUP' } }), 0);
  assert.equal((await walletSummary(prisma, user.id)).held, 1);
});

test('expired makeup right cannot be used and original hold stays intact', async t => {
  const { user, makeGym, buy } = await memberFixture(t);
  await makeGym(); await buy('BEGINNER', 1);
  const date = vietnamDate(addDays(new Date(), 3));
  const coach = await coachFixture(t, date);
  const [booking] = await createWalletPtBookings({ memberId: user.id, coachId: coach.id,
    level: 'BEGINNER', starts: [localInstant(date, 9 * 60)] });
  const response = fakeResponse();
  await PtController.markAbsent({ user: { userId: coach.id, role: 'COACH' },
    params: { id: String(booking.id) }, body: {} } as any, response.response);
  assert.equal(response.output.code, 200);
  await prisma.makeUpRequest.updateMany({ where: { originalBookingId: booking.id },
    data: { expiresAt: addDays(new Date(), -1) } });
  await assert.rejects(createWalletPtMakeup({ memberId: user.id,
    originalBookingId: booking.id, start: localInstant(date, 10 * 60) }));
  assert.equal((await walletSummary(prisma, user.id)).held, 1);
});

test('member absence makeup quota is limited to three per paid credit batch', async t => {
  const { user, makeGym, buy } = await memberFixture(t);
  await makeGym(); await buy('BEGINNER', 4);
  const date = vietnamDate(addDays(new Date(), 3));
  const coach = await coachFixture(t, date);
  const profile = await prisma.coachProfile.findUniqueOrThrow({ where: { userId: coach.id } });
  await prisma.coachSchedule.updateMany({ where: { coachProfileId: profile.id }, data: { endTime: '13:00' } });
  const bookings = await createWalletPtBookings({ memberId: user.id, coachId: coach.id,
    level: 'BEGINNER', starts: [9, 10, 11, 12].map(hour => localInstant(date, hour * 60)) });
  for (const [index, booking] of bookings.entries()) {
    const response = fakeResponse();
    await PtController.markAbsent({ user: { userId: user.id, role: 'MEMBER' },
      params: { id: String(booking.id) }, body: { reason: 'Cannot attend' } } as any, response.response);
    assert.equal(response.output.code, 200);
    assert.equal(response.output.body.data.status, index < 3 ? 'ABSENT_ELIGIBLE' : 'ABSENT_NO_REFUND');
  }
  assert.equal((await walletSummary(prisma, user.id)).levels.find(row => row.level === 'BEGINNER')?.used, 1);
  assert.equal(await prisma.ptCreditTransaction.count({ where: { kind: 'MEMBER_MAKEUP',
    batch: { wallet: { memberId: user.id } } } }), 3);
});

test('member absence on gifted Trial does not create repeatable makeup credit', async t => {
  const { user, makeGym } = await memberFixture(t);
  await makeGym(2);
  const date = vietnamDate(addDays(new Date(), 3));
  const coach = await coachFixture(t, date);
  const [booking] = await createWalletPtBookings({ memberId: user.id, coachId: coach.id,
    level: 'TRIAL', starts: [localInstant(date, 9 * 60)] });
  const response = fakeResponse();
  await PtController.markAbsent({ user: { userId: user.id, role: 'MEMBER' },
    params: { id: String(booking.id) }, body: { reason: 'Cannot attend' } } as any, response.response);
  assert.equal(response.output.code, 200);
  assert.equal(response.output.body.data.status, 'ABSENT_NO_REFUND');
  assert.equal(await prisma.makeUpRequest.count({ where: { originalBookingId: booking.id } }), 0);
  assert.equal((await walletSummary(prisma, user.id)).levels.find(row => row.level === 'TRIAL')?.used, 1);
});

test('Coach completing an in-progress session consumes one credit exactly once', async t => {
  const { user, makeGym, buy } = await memberFixture(t);
  await makeGym(); await buy('BEGINNER', 1);
  const date = vietnamDate(addDays(new Date(), 3));
  const coach = await coachFixture(t, date);
  const [booking] = await createWalletPtBookings({ memberId: user.id, coachId: coach.id,
    level: 'BEGINNER', starts: [localInstant(date, 9 * 60)] });
  await prisma.booking.update({ where: { id: booking.id }, data: { status: 'IN_PROGRESS' } });
  const first = fakeResponse(), replay = fakeResponse();
  const request = { user: { userId: coach.id, role: 'COACH' }, params: { id: String(booking.id) } } as any;
  await PtController.completeSession(request, first.response);
  await PtController.completeSession(request, replay.response);
  assert.equal(first.output.code, 200);
  assert.notEqual(replay.output.code, 200);
  assert.equal((await walletSummary(prisma, user.id)).levels.find(row => row.level === 'BEGINNER')?.used, 1);
  assert.equal(await prisma.ptCreditTransaction.count({ where: { bookingId: booking.id,
    kind: 'CONSUME' } }), 1);
});

test('QR check-in rejects a different member without changing the booking', async t => {
  process.env.JWT_SECRET = 'pt-integration-secret';
  const { user, makeGym, buy } = await memberFixture(t);
  const outsider = await memberFixture(t);
  await makeGym(); await buy('BEGINNER', 1);
  const date = vietnamDate(addDays(new Date(), 3));
  const coach = await coachFixture(t, date);
  const [booking] = await createWalletPtBookings({ memberId: user.id, coachId: coach.id,
    level: 'BEGINNER', starts: [localInstant(date, 9 * 60)] });
  await prisma.booking.update({ where: { id: booking.id }, data: {
    startTime: new Date(Date.now() + 5 * 60000), endTime: new Date(Date.now() + 65 * 60000),
  } });
  const generated = fakeResponse(), scanned = fakeResponse();
  await PtController.generateSessionQr({ user: { userId: coach.id, role: 'COACH' },
    params: { id: String(booking.id) } } as any, generated.response);
  assert.equal(generated.output.code, 200);
  await PtController.startSessionWithQr({ user: { userId: outsider.user.id, role: 'MEMBER' },
    body: { qrToken: generated.output.body.data.token } } as any, scanned.response);
  assert.equal(scanned.output.code, 403);
  assert.equal((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).status, 'CONFIRMED');
});

test('audited Staff exception starts a covered PT session once when QR fails', async t => {
  const { user, makeGym, buy } = await memberFixture(t);
  await makeGym(); await buy('BEGINNER', 1);
  const date = vietnamDate(addDays(new Date(), 3));
  const coach = await coachFixture(t, date);
  const [booking] = await createWalletPtBookings({ memberId: user.id, coachId: coach.id,
    level: 'BEGINNER', starts: [localInstant(date, 9 * 60)] });
  await prisma.booking.update({ where: { id: booking.id }, data: {
    startTime: new Date(Date.now() + 5 * 60000), endTime: new Date(Date.now() + 65 * 60000),
  } });
  const request = { user: { userId: user.id, role: 'STAFF' }, params: { id: String(booking.id) },
    body: { reason: 'QR camera unavailable' } } as any;
  const first = fakeResponse(), replay = fakeResponse();
  await PtController.manualCheckIn(request, first.response);
  await PtController.manualCheckIn(request, replay.response);
  assert.equal(first.output.code, 200);
  assert.equal(replay.output.code, 409);
  assert.equal((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).status, 'IN_PROGRESS');
  assert.equal(await prisma.actionLog.count({ where: { userId: user.id,
    action: 'PT_MANUAL_CHECKIN' } }), 1);
  assert.equal((await walletSummary(prisma, user.id)).held, 1);
});

test('unverified Gym payment does not authorize a PT booking', async t => {
  const { user, makeGym, buy } = await memberFixture(t);
  const { payment } = await makeGym(); await buy('BEGINNER', 1);
  await prisma.payment.update({ where: { id: payment.id }, data: { status: 'PAID_REVIEW' } });
  const date = vietnamDate(addDays(new Date(), 3));
  const coach = await coachFixture(t, date);
  await assert.rejects(createWalletPtBookings({ memberId: user.id, coachId: coach.id,
    level: 'BEGINNER', starts: [localInstant(date, 9 * 60)] }));
  assert.equal((await walletSummary(prisma, user.id)).held, 0);
});

test('paid PT duration starts at first confirmation and replay does not extend it', async t => {
  const { user, buy } = await memberFixture(t);
  const payment = await buy('BEGINNER', 2, 1, 5);
  const batch = await prisma.ptCreditBatch.findFirstOrThrow({ where: { paymentId: payment.id } });
  assert.ok(batch.startAt && batch.endAt && batch.activatedAt);
  assert.equal(batch.startAt?.getTime(), batch.activatedAt?.getTime());
  assert.equal(batch.endAt!.getTime() - batch.startAt!.getTime(), 5 * 86400000);
  assert.equal((await markPaymentPaid(payment.orderCode!, 100000)).result, 'ALREADY_PAID');
  const after = await prisma.ptCreditBatch.findMany({ where: { paymentId: payment.id } });
  assert.equal(after.length, 1);
  assert.equal(after[0].endAt?.getTime(), batch.endAt?.getTime());
});

test('Admin must configure duration and can update PT product without changing old batches', async t => {
  const missing = fakeResponse();
  await createPtProduct({ body: { name: 'PT test', level: 'BEGINNER', sessionCount: 2,
    price: 100000 } } as any, missing.response);
  assert.equal(missing.output.code, 400);
  const created = fakeResponse();
  await createPtProduct({ body: { name: `PT ${randomUUID()}`, level: 'BEGINNER', sessionCount: 2,
    durationDays: 14, price: 100000 } } as any, created.response);
  assert.equal(created.output.code, 201);
  const id = created.output.body.data.id as number;
  t.after(() => prisma.ptProduct.delete({ where: { id } }).then(() => undefined));
  const updated = fakeResponse();
  await updatePtProduct({ params: { id: String(id) }, body: { name: 'PT updated',
    level: 'INTERMEDIATE', sessionCount: 3, durationDays: 21, price: 150000 } } as any, updated.response);
  assert.equal(updated.output.code, 200);
  assert.equal((await prisma.ptProduct.findUniqueOrThrow({ where: { id } })).durationDays, 21);
});

test('concurrent PT payment confirmations grant one batch', async t => {
  const { user } = await memberFixture(t);
  const product = await prisma.ptProduct.create({ data: { name: `PT ${randomUUID()}`,
    level: 'ADVANCED', sessionCount: 3, price: 100000, durationDays: 10 } });
  t.after(() => prisma.ptProduct.delete({ where: { id: product.id } }).then(() => undefined));
  const code = orderCode();
  const payment = await prisma.payment.create({ data: { userId: user.id, amount: 100000,
    method: 'PAYOS', status: 'PENDING', orderCode: code, transactionNo: `TEST-${code}`,
    ptProductId: product.id, ptQuantity: 1, ptLevelSnapshot: 'ADVANCED',
    ptSessionsSnapshot: 3, ptDurationDays: 10 } });
  const results = await Promise.all([markPaymentPaid(code, 100000), markPaymentPaid(code, 100000)]);
  assert.deepEqual(results.map(row => row.result).sort(), ['ALREADY_PAID', 'PAID']);
  assert.equal(await prisma.ptCreditBatch.count({ where: { paymentId: payment.id } }), 1);
  assert.equal((await walletSummary(prisma, user.id)).levels.find(row => row.level === 'ADVANCED')?.total, 3);
});

test('wallet excludes expired PT sessions and booking rejects a slot beyond expiration', async t => {
  const { user, makeGym, buy } = await memberFixture(t);
  await makeGym();
  const payment = await buy('BEGINNER', 2, 1, 1);
  const date = vietnamDate(addDays(new Date(), 3));
  const coach = await coachFixture(t, date);
  await assert.rejects(createWalletPtBookings({ memberId: user.id, coachId: coach.id,
    level: 'BEGINNER', starts: [localInstant(date, 9 * 60)] }));
  await prisma.ptCreditBatch.updateMany({ where: { paymentId: payment.id },
    data: { endAt: addDays(new Date(), -1) } });
  const wallet = await walletSummary(prisma, user.id);
  assert.equal(wallet.levels.find(row => row.level === 'BEGINNER')?.available, 0);
  assert.equal(wallet.levels.find(row => row.level === 'BEGINNER')?.expired, 2);
  assert.equal(wallet.sources.find(row => row.paymentId === payment.id)?.status, 'EXPIRED');
});

test('FEFO reserves the earliest valid paid batch of the same level', async t => {
  const { user, makeGym, buy } = await memberFixture(t);
  await makeGym();
  const later = await buy('BEGINNER', 1, 1, 20);
  const earlier = await buy('BEGINNER', 1, 1, 5);
  const date = vietnamDate(addDays(new Date(), 3));
  const coach = await coachFixture(t, date);
  const [booking] = await createWalletPtBookings({ memberId: user.id, coachId: coach.id,
    level: 'BEGINNER', starts: [localInstant(date, 9 * 60)] });
  const allocation = await prisma.ptBookingCreditAllocation.findUniqueOrThrow({ where: { bookingId: booking.id },
    include: { batch: true } });
  assert.equal(allocation.batch.paymentId, earlier.id);
  assert.notEqual(allocation.batch.paymentId, later.id);
});

test('coach absence makeup can use its recorded hold after paid batch expiry within seven days', async t => {
  const { user, makeGym, buy } = await memberFixture(t);
  await makeGym(); await buy('BEGINNER', 1, 1, 4);
  const originalDate = vietnamDate(addDays(new Date(), 3));
  const makeupDate = vietnamDate(addDays(new Date(), 5));
  const coach = await coachFixture(t, originalDate);
  const profile = await prisma.coachProfile.findUniqueOrThrow({ where: { userId: coach.id } });
  await prisma.coachSchedule.create({ data: { coachProfileId: profile.id,
    dayOfWeek: dayOfWeek(makeupDate), startTime: '09:00', endTime: '11:00' } });
  const [original] = await createWalletPtBookings({ memberId: user.id, coachId: coach.id,
    level: 'BEGINNER', starts: [localInstant(originalDate, 9 * 60)] });
  const response = fakeResponse();
  await PtController.markAbsent({ user: { userId: coach.id, role: 'COACH' },
    params: { id: String(original.id) }, body: { reason: 'Coach unavailable' } } as any, response.response);
  assert.equal(response.output.code, 200);
  const makeup = await createWalletPtMakeup({ memberId: user.id, originalBookingId: original.id,
    start: localInstant(makeupDate, 9 * 60) });
  assert.equal(makeup.isMakeup, true);
  const allocation = await prisma.ptBookingCreditAllocation.findUniqueOrThrow({ where: { bookingId: makeup.id },
    include: { batch: true } });
  assert.ok(allocation.batch.endAt && allocation.batch.endAt < makeup.startTime);
  assert.equal(allocation.status, 'HELD');
});

test('active PT renewal extends only its own batch from current end without adding sessions', async t => {
  const { user, buy, renewalOrder } = await memberFixture(t);
  const targetPayment = await buy('BEGINNER', 2, 1, 5);
  const otherPayment = await buy('BEGINNER', 1, 1, 10);
  const target = await prisma.ptCreditBatch.findFirstOrThrow({ where: { paymentId: targetPayment.id } });
  const other = await prisma.ptCreditBatch.findFirstOrThrow({ where: { paymentId: otherPayment.id } });
  const { option, payment } = await renewalOrder(target.id, 7);
  await prisma.ptRenewalOption.update({ where: { id: option.id }, data: { level: 'INTERMEDIATE', durationDays: 14, price: 75000 } });
  assert.equal((await markPaymentPaid(payment.orderCode!, 50000)).result, 'PAID');
  const renewed = await prisma.ptCreditBatch.findUniqueOrThrow({ where: { id: target.id } });
  assert.equal(renewed.endAt!.getTime(), target.endAt!.getTime() + 7 * 86400000);
  assert.equal(renewed.initialCount, target.initialCount);
  assert.equal((await prisma.ptCreditBatch.findUniqueOrThrow({ where: { id: other.id } })).endAt?.getTime(), other.endAt?.getTime());
  assert.equal((await walletSummary(prisma, user.id)).levels.find(row => row.level === 'BEGINNER')?.total, 3);
  assert.equal((await markPaymentPaid(payment.orderCode!, 50000)).result, 'ALREADY_PAID');
  assert.equal(await prisma.ptRenewalEvent.count({ where: { paymentId: payment.id } }), 1);
});

test('Admin renewal option uses selected product and independently configured duration', async t => {
  const { user, buy, renewalOptions } = await memberFixture(t);
  const purchase = await buy('BEGINNER', 2, 1, 30);
  const productId = (await prisma.payment.findUniqueOrThrow({ where: { id: purchase.id } })).ptProductId!;
  const response = fakeResponse();
  await createPtRenewalOption({ user: { userId: user.id, role: 'ADMIN' },
    body: { productId, durationDays: 14, price: 50000, name: 'Ignored name', level: 'ADVANCED' } } as any,
  response.response);
  assert.equal(response.output.code, 201);
  const option = response.output.body.data;
  renewalOptions.push(option.id);
  assert.equal(option.ptProductId, productId);
  assert.equal(option.level, 'BEGINNER');
  assert.equal(option.durationDays, 14);
});

test('renewal price for one PT product cannot renew another product of the same level', async t => {
  const { user, buy, renewalOrder } = await memberFixture(t);
  const firstPurchase = await buy('BEGINNER', 2, 1, 30);
  const secondPurchase = await buy('BEGINNER', 5, 1, 30);
  const first = await prisma.ptCreditBatch.findFirstOrThrow({ where: { paymentId: firstPurchase.id } });
  const second = await prisma.ptCreditBatch.findFirstOrThrow({ where: { paymentId: secondPurchase.id } });
  const { option } = await renewalOrder(first.id, 14);
  const checkout = fakeResponse();
  await PaymentController.createPtRenewalCheckout({ user: { userId: user.id, role: 'MEMBER' },
    body: { batchId: second.id, optionId: option.id } } as any, checkout.response);
  assert.equal(checkout.output.code, 409);
  const code = orderCode();
  await prisma.payment.create({ data: { userId: user.id, amount: 50000,
    method: 'PAYOS', status: 'PENDING', orderCode: code, transactionNo: `TEST-${code}`,
    ptRenewalOptionId: option.id, ptRenewalProductId: option.ptProductId,
    ptRenewalBatchId: second.id, ptRenewalDays: option.durationDays, ptLevelSnapshot: option.level } });
  assert.equal((await markPaymentPaid(code, 50000)).result, 'PAID_REVIEW');
  assert.equal((await prisma.ptCreditBatch.findUniqueOrThrow({ where: { id: second.id } })).endAt?.getTime(), second.endAt?.getTime());
});

test('expired PT renewed within 30 days restores only unused credit from confirmation time', async t => {
  const { user, buy, renewalOrder } = await memberFixture(t);
  const purchase = await buy('ADVANCED', 2, 1, 5);
  const batch = await prisma.ptCreditBatch.findFirstOrThrow({ where: { paymentId: purchase.id } });
  const previousEndAt = addDays(new Date(), -2);
  await prisma.ptCreditBatch.update({ where: { id: batch.id }, data: { endAt: previousEndAt } });
  assert.equal((await walletSummary(prisma, user.id)).levels.find(row => row.level === 'ADVANCED')?.available, 0);
  const { payment } = await renewalOrder(batch.id, 10);
  const before = Date.now();
  assert.equal((await markPaymentPaid(payment.orderCode!, 50000)).result, 'PAID');
  const event = await prisma.ptRenewalEvent.findUniqueOrThrow({ where: { paymentId: payment.id } });
  assert.equal(event.previousEndAt.getTime(), previousEndAt.getTime());
  assert.ok(event.startAt.getTime() >= before);
  assert.equal(event.endAt.getTime() - event.startAt.getTime(), 10 * 86400000);
  assert.equal((await walletSummary(prisma, user.id)).levels.find(row => row.level === 'ADVANCED')?.available, 2);
});

test('renewal paid after 30-day grace requires review and cannot revive the batch', async t => {
  const { user, buy, renewalOrder } = await memberFixture(t);
  const purchase = await buy('BEGINNER', 2, 1, 5);
  const batch = await prisma.ptCreditBatch.findFirstOrThrow({ where: { paymentId: purchase.id } });
  const oldEndAt = addDays(new Date(), -31);
  await prisma.ptCreditBatch.update({ where: { id: batch.id }, data: { endAt: oldEndAt } });
  const { option, payment } = await renewalOrder(batch.id, 10);
  const checkout = fakeResponse();
  await PaymentController.createPtRenewalCheckout({ user: { userId: user.id, role: 'MEMBER' },
    body: { batchId: batch.id, optionId: option.id } } as any, checkout.response);
  assert.equal(checkout.output.code, 409);
  assert.equal((await markPaymentPaid(payment.orderCode!, 50000)).result, 'PAID_REVIEW');
  assert.equal((await prisma.ptCreditBatch.findUniqueOrThrow({ where: { id: batch.id } })).endAt?.getTime(), oldEndAt.getTime());
  assert.equal(await prisma.ptRenewalEvent.count({ where: { paymentId: payment.id } }), 0);
  assert.equal((await walletSummary(prisma, user.id)).levels.find(row => row.level === 'BEGINNER')?.available, 0);
  assert.equal((await markPaymentPaid(payment.orderCode!, 50000)).result, 'ALREADY_PAID_REVIEW');
});

test('concurrent renewal callbacks extend a PT batch exactly once', async t => {
  const { buy, renewalOrder } = await memberFixture(t);
  const purchase = await buy('INTERMEDIATE', 2, 1, 5);
  const batch = await prisma.ptCreditBatch.findFirstOrThrow({ where: { paymentId: purchase.id } });
  const { payment } = await renewalOrder(batch.id, 3);
  const results = await Promise.all([markPaymentPaid(payment.orderCode!, 50000), markPaymentPaid(payment.orderCode!, 50000)]);
  assert.deepEqual(results.map(row => row.result).sort(), ['ALREADY_PAID', 'PAID']);
  assert.equal((await prisma.ptCreditBatch.findUniqueOrThrow({ where: { id: batch.id } })).endAt!.getTime(), batch.endAt!.getTime() + 3 * 86400000);
  assert.equal(await prisma.ptRenewalEvent.count({ where: { paymentId: payment.id } }), 1);
});

test('30-day renewal grace includes the boundary and excludes the next millisecond', () => {
  const now = new Date('2026-10-20T00:00:00.000Z');
  const batch = { level: 'BEGINNER', initialCount: 2, usedCount: 1,
    endAt: new Date(now.getTime() - 30 * 86400000) };
  assert.equal(ptRenewalError(batch, now), null);
  assert.ok(ptRenewalError(batch, new Date(now.getTime() + 1)));
});

test.after(async () => { await prisma.$disconnect(); });
