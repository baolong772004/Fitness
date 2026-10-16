import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

const testDatabaseUrl = process.env.GYM_TEST_DATABASE_URL;
const databaseName = /(?:^|;)database=([^;]+)/i.exec(testDatabaseUrl ?? '')?.[1];
if (!testDatabaseUrl || testDatabaseUrl === process.env.DATABASE_URL || !databaseName || !/test/i.test(databaseName)) {
  throw new Error('Set GYM_TEST_DATABASE_URL to a separate SQL Server database with "test" in its name');
}
process.env.DATABASE_URL = testDatabaseUrl;

const { PrismaClient } = await import('@prisma/client');
const { markPaymentFailed, markPaymentPaid } = await import('../src/services/payment.service.js');
const { refreshGymMembershipStates } = await import('../src/services/membership.service.js');
const { PaymentController } = await import('../src/controllers/payment.controller.js');
const prisma = new PrismaClient();

let orderSequence = 0;
const orderCode = () => BigInt(Date.now() * 1000 + ++orderSequence);
const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

async function fixture(t: { after: (fn: () => Promise<void>) => void }) {
  const user = await prisma.user.create({
    data: {
      email: `gym-integration-${randomUUID()}@example.invalid`,
      fullName: 'Gym integration test',
      password: 'unused',
      role: 'MEMBER',
      status: 'ACTIVE',
    },
  });
  const packages: number[] = [];
  t.after(async () => {
    await prisma.payment.deleteMany({ where: { userId: user.id } });
    await prisma.membership.deleteMany({ where: { userId: user.id } });
    await prisma.package.deleteMany({ where: { id: { in: packages } } });
    await prisma.user.delete({ where: { id: user.id } });
  });
  const makePackage = async (name: string, durationDays = 30) => {
    const pkg = await prisma.package.create({
      data: { name: `${name} ${randomUUID()}`, type: 'MEMBERSHIP', price: 100000, durationDays },
    });
    packages.push(pkg.id);
    return pkg;
  };
  return { user, makePackage };
}

async function checkout(userId: number, packageId: number) {
  const now = new Date();
  const membership = await prisma.membership.create({
    data: {
      userId, packageId, isGymMembership: true,
      startDate: now, endDate: addDays(now, 30), status: 'PENDING',
    },
  });
  const payment = await prisma.payment.create({
    data: {
      userId, membershipId: membership.id, amount: 100000, method: 'PAYOS',
      status: 'PENDING', orderCode: orderCode(),
    },
  });
  return { membership, payment };
}

async function renewal(userId: number, membershipId: number, days: number) {
  return prisma.payment.create({
    data: {
      userId, membershipId, amount: 100000, method: 'PAYOS', status: 'PENDING',
      renewalDurationDays: days, orderCode: orderCode(),
    },
  });
}

test('TC01: two concurrent payments leave one Active Gym membership', async t => {
  const { user, makePackage } = await fixture(t);
  const basic = await makePackage('Basic');
  const standard = await makePackage('Standard');
  const first = await checkout(user.id, basic.id);
  const second = await checkout(user.id, standard.id);
  await Promise.all([
    markPaymentPaid(first.payment.orderCode!, 100000),
    markPaymentPaid(second.payment.orderCode!, 100000),
  ]);
  const rows = await prisma.membership.findMany({ where: { userId: user.id }, orderBy: { activationOrder: 'asc' } });
  assert.equal(rows.filter(row => row.status === 'ACTIVE').length, 1);
  assert.equal(rows.filter(row => row.status === 'PENDING_ACTIVATION').length, 1);
  assert.ok(rows[0].endDate < rows[1].startDate);
  assert.ok(rows[0].activationOrder! < rows[1].activationOrder!);
});

test('TC02: repeated success callback only pays and activates once', async t => {
  const { user, makePackage } = await fixture(t);
  const pkg = await makePackage('Basic');
  const { payment, membership } = await checkout(user.id, pkg.id);
  const results = await Promise.all([
    markPaymentPaid(payment.orderCode!, 100000),
    markPaymentPaid(payment.orderCode!, 100000),
  ]);
  assert.deepEqual(results.map(result => result.result).sort(), ['ALREADY_PAID', 'PAID']);
  const paid = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
  const active = await prisma.membership.findUniqueOrThrow({ where: { id: membership.id } });
  assert.ok(paid.paidAt);
  assert.equal(active.status, 'ACTIVE');
  assert.equal(active.activationOrder, 1);
});

test('TC03: queue order follows verified backend payment order', async t => {
  const { user, makePackage } = await fixture(t);
  const basic = await checkout(user.id, (await makePackage('Basic')).id);
  const standard = await checkout(user.id, (await makePackage('Standard')).id);
  await markPaymentPaid(standard.payment.orderCode!, 100000);
  await markPaymentPaid(basic.payment.orderCode!, 100000);
  const first = await prisma.membership.findUniqueOrThrow({ where: { id: standard.membership.id } });
  const second = await prisma.membership.findUniqueOrThrow({ where: { id: basic.membership.id } });
  assert.equal(first.status, 'ACTIVE');
  assert.equal(second.status, 'PENDING_ACTIVATION');
  assert.ok(first.activationOrder! < second.activationOrder!);
  assert.ok(first.endDate < second.startDate);
});

test('TC04 and TC05: concurrent Active renewals extend once per paid order and shift the queue', async t => {
  const { user, makePackage } = await fixture(t);
  const basic = await makePackage('Basic');
  const standard = await makePackage('Standard');
  const now = new Date();
  const activeEnd = addDays(now, 20);
  const active = await prisma.membership.create({
    data: {
      userId: user.id, packageId: basic.id, isGymMembership: true, activationOrder: 1,
      activatedAt: now, startDate: now, endDate: activeEnd, status: 'ACTIVE',
    },
  });
  const queuedStart = new Date(activeEnd.getTime() + 1);
  const queuedEnd = addDays(queuedStart, 30);
  const queued = await prisma.membership.create({
    data: {
      userId: user.id, packageId: standard.id, isGymMembership: true, activationOrder: 2,
      startDate: queuedStart, endDate: queuedEnd, status: 'PENDING_ACTIVATION',
    },
  });
  const first = await renewal(user.id, active.id, 10);
  const second = await renewal(user.id, active.id, 20);
  await Promise.all([
    markPaymentPaid(first.orderCode!, 100000),
    markPaymentPaid(second.orderCode!, 100000),
  ]);
  const updatedActive = await prisma.membership.findUniqueOrThrow({ where: { id: active.id } });
  const updatedQueued = await prisma.membership.findUniqueOrThrow({ where: { id: queued.id } });
  assert.equal(updatedActive.endDate.getTime(), addDays(activeEnd, 30).getTime());
  assert.equal(updatedQueued.startDate.getTime(), addDays(queuedStart, 30).getTime());
  assert.equal(updatedQueued.endDate.getTime(), addDays(queuedEnd, 30).getTime());
  assert.equal(updatedQueued.activationOrder, 2);
});

test('TC06 and TC07: concurrent scheduler runs recover due periods without changing paid dates', async t => {
  const { user, makePackage } = await fixture(t);
  const pkg = await makePackage('Gym');
  const now = new Date();
  const expired = await prisma.membership.create({
    data: {
      userId: user.id, packageId: pkg.id, isGymMembership: true, activationOrder: 1,
      startDate: addDays(now, -10), endDate: addDays(now, -5), status: 'ACTIVE',
    },
  });
  const elapsed = await prisma.membership.create({
    data: {
      userId: user.id, packageId: pkg.id, isGymMembership: true, activationOrder: 2,
      startDate: addDays(now, -5), endDate: addDays(now, -2), status: 'PENDING_ACTIVATION',
    },
  });
  const dueStart = addDays(now, -2);
  const dueEnd = addDays(now, 3);
  const due = await prisma.membership.create({
    data: {
      userId: user.id, packageId: pkg.id, isGymMembership: true, activationOrder: 3,
      startDate: dueStart, endDate: dueEnd, status: 'PENDING_ACTIVATION',
    },
  });
  await Promise.all([refreshGymMembershipStates(user.id), refreshGymMembershipStates(user.id)]);
  const rows = await prisma.membership.findMany({ where: { userId: user.id }, orderBy: { activationOrder: 'asc' } });
  assert.equal(rows.find(row => row.id === expired.id)?.status, 'EXPIRED');
  assert.equal(rows.find(row => row.id === elapsed.id)?.status, 'EXPIRED');
  assert.equal(rows.find(row => row.id === due.id)?.status, 'ACTIVE');
  assert.equal(rows.find(row => row.id === due.id)?.startDate.getTime(), dueStart.getTime());
  assert.equal(rows.find(row => row.id === due.id)?.endDate.getTime(), dueEnd.getTime());
  assert.ok(rows.find(row => row.id === due.id)?.activatedAt);
});

test('TC08: renewing an Expired package while another is Active queues it', async t => {
  const { user, makePackage } = await fixture(t);
  const basic = await makePackage('Basic');
  const standard = await makePackage('Standard');
  const now = new Date();
  const expired = await prisma.membership.create({
    data: {
      userId: user.id, packageId: basic.id, isGymMembership: true, activationOrder: 1,
      startDate: addDays(now, -60), endDate: addDays(now, -30), status: 'EXPIRED',
    },
  });
  const activeEnd = addDays(now, 30);
  await prisma.membership.create({
    data: {
      userId: user.id, packageId: standard.id, isGymMembership: true, activationOrder: 2,
      startDate: now, endDate: activeEnd, status: 'ACTIVE', activatedAt: now,
    },
  });
  const payment = await renewal(user.id, expired.id, 30);
  await markPaymentPaid(payment.orderCode!, 100000);
  const updated = await prisma.membership.findUniqueOrThrow({ where: { id: expired.id } });
  assert.equal(updated.status, 'PENDING_ACTIVATION');
  assert.ok(updated.startDate > activeEnd);
  assert.equal(updated.activationOrder, 3);
});

test('TC09: checkout API rejects a package already awaiting activation', async t => {
  const { user, makePackage } = await fixture(t);
  const pkg = await makePackage('Standard');
  await prisma.membership.create({
    data: {
      userId: user.id, packageId: pkg.id, isGymMembership: true, activationOrder: 1,
      startDate: addDays(new Date(), 1), endDate: addDays(new Date(), 31), status: 'PENDING_ACTIVATION',
    },
  });
  process.env.PAYOS_CLIENT_ID ??= 'integration-test';
  process.env.PAYOS_API_KEY ??= 'integration-test';
  process.env.PAYOS_CHECKSUM_KEY ??= 'integration-test';
  let statusCode = 200;
  let body: { message?: string } = {};
  const response = {
    status(code: number) { statusCode = code; return this; },
    json(value: { message?: string }) { body = value; return this; },
  };
  await PaymentController.createCheckoutSession(
    { user: { userId: user.id }, body: { packageId: pkg.id } } as any,
    response as any,
  );
  assert.equal(statusCode, 409);
  assert.match(body.message ?? '', /tự động kích hoạt/);
});

test('TC10: failed payment does not activate a membership', async t => {
  const { user, makePackage } = await fixture(t);
  const pkg = await makePackage('Basic');
  const { payment, membership } = await checkout(user.id, pkg.id);
  await markPaymentFailed(payment.orderCode!);
  const failed = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
  const cancelled = await prisma.membership.findUniqueOrThrow({ where: { id: membership.id } });
  assert.equal(failed.status, 'FAILED');
  assert.equal(failed.paidAt, null);
  assert.equal(cancelled.status, 'CANCELLED');
});

test.after(async () => { await prisma.$disconnect(); });
