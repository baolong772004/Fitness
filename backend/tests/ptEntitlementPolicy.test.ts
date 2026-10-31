import assert from 'node:assert/strict';
import test from 'node:test';
import { decidePtAbsence, isPaidPtSource, protectedAbsenceLimit } from '../src/services/ptEntitlementPolicy.service.js';
import { ptRenewalError, ptRenewalOptionMatchesBatch } from '../src/services/ptRenewal.service.js';

const now = new Date('2026-10-29T10:00:00.000Z');
const startsIn = (minutes: number) => new Date(now.getTime() + minutes * 60000);
const absence = (source: string, protectedUsed: number, minutes = 180, initialCount = 10) =>
  decidePtAbsence({ source, initialCount, protectedUsed, startTime: startsIn(minutes), now,
    isMakeup: false, coachAbsence: false });

test('Trial, package Paid and single Paid have separate early cancellation quotas', () => {
  assert.equal(protectedAbsenceLimit('MEMBERSHIP_GIFT', 2), 1);
  assert.equal(protectedAbsenceLimit('PACKAGE_PURCHASE', 10), 3);
  assert.equal(protectedAbsenceLimit('SINGLE_PURCHASE', 1), 1);
  assert.equal(absence('MEMBERSHIP_GIFT', 0).outcome, 'RELEASE');
  assert.equal(absence('MEMBERSHIP_GIFT', 1).outcome, 'DEBIT');
  assert.equal(absence('PACKAGE_PURCHASE', 2).outcome, 'RELEASE');
  assert.equal(absence('PACKAGE_PURCHASE', 3).outcome, 'DEBIT');
  assert.equal(absence('SINGLE_PURCHASE', 1, 180, 1).outcome, 'DEBIT');
});

test('late member absence debits; Coach absence preserves credit regardless of member quota', () => {
  assert.equal(absence('PACKAGE_PURCHASE', 0, 119).outcome, 'DEBIT');
  const coach = decidePtAbsence({ source: 'PACKAGE_PURCHASE', initialCount: 10, protectedUsed: 3,
    startTime: startsIn(30), now, isMakeup: false, coachAbsence: true });
  assert.equal(coach.outcome, 'MAKEUP');
  assert.equal(coach.protectedUsed, 3);
});

test('renewal is only for Paid with remaining credit inside 30 day grace', () => {
  const endAt = new Date(now.getTime() - 29 * 86400000);
  const paid = { level: 'BEGINNER', source: 'PACKAGE_PURCHASE', endAt, initialCount: 10, usedCount: 9 };
  assert.equal(ptRenewalError(paid, now), null);
  assert.ok(ptRenewalError({ ...paid, source: 'MEMBERSHIP_GIFT' }, now));
  assert.ok(ptRenewalError({ ...paid, usedCount: 10 }, now));
  assert.ok(ptRenewalError({ ...paid, endAt: new Date(now.getTime() - 31 * 86400000) }, now));
  assert.equal(isPaidPtSource('SINGLE_PURCHASE'), true);
  assert.equal(isPaidPtSource('MEMBERSHIP_GIFT'), false);
});

test('single and package renewal prices apply only to their purchase mode', () => {
  const single = { level: 'BEGINNER', ptProductId: null, purchaseMode: 'SINGLE' };
  assert.equal(ptRenewalOptionMatchesBatch(single, { level: 'BEGINNER', ptProductId: null, source: 'SINGLE_PURCHASE' }), true);
  assert.equal(ptRenewalOptionMatchesBatch(single, { level: 'BEGINNER', ptProductId: 5, source: 'PACKAGE_PURCHASE' }), false);
  const pkg = { level: 'BEGINNER', ptProductId: 5, purchaseMode: 'PACKAGE' };
  assert.equal(ptRenewalOptionMatchesBatch(pkg, { level: 'BEGINNER', ptProductId: 5, source: 'PACKAGE_PURCHASE' }), true);
  assert.equal(ptRenewalOptionMatchesBatch(pkg, { level: 'BEGINNER', ptProductId: null, source: 'SINGLE_PURCHASE' }), false);
  assert.equal(ptRenewalOptionMatchesBatch({ level: 'BEGINNER', ptProductId: null, purchaseMode: null },
    { level: 'BEGINNER', ptProductId: 5, source: 'PACKAGE_PURCHASE' }), true);
});
