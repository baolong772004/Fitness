/**
 * Run after 20261019_pt_credit_wallet. Dry-run by default; pass --apply only after
 * reviewing package ptLevel mappings and a database backup. No records are deleted.
 */
import { Prisma, PrismaClient } from '@prisma/client';
import { pathToFileURL } from 'node:url';

const levels = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];
const holdStatuses = ['PENDING', 'UPCOMING', 'CONFIRMED', 'IN_PROGRESS'];

export async function backfillPtWallet(prisma: PrismaClient, apply = false) {
  const memberships = await prisma.membership.findMany({ where: {
    status: { in: ['ACTIVE', 'PENDING_ACTIVATION', 'EXPIRED', 'COMPLETED'] },
    package: { type: { in: ['PT', 'MEMBERSHIP'] } },
  }, include: { package: true, payments: { where: { OR: [
      { status: 'PAID' }, { status: 'COMPLETED', method: { in: ['CASH', 'POS_CARD'] } },
    ] }, orderBy: { paidAt: 'desc' } },
    bookings: { where: { type: 'PT' }, include: { makeUpRequests: true } } },
  orderBy: { id: 'asc' } });
  let ready = 0, skipped = 0;
  const errors: string[] = [];
  const plans: Array<{ item: typeof memberships[number]; gift: boolean; count: number;
    level: string; source: string; remaining: number; heldBookings: typeof memberships[number]['bookings'] }> = [];
  for (const item of memberships) {
    const gift = item.package.type === 'MEMBERSHIP';
    const count = gift ? item.package.trialPtSessions : item.package.totalPtSessions ?? 0;
    if (count <= 0) { skipped++; continue; }
    const level = gift ? 'TRIAL' : item.package.ptLevel;
    const source = gift ? 'MEMBERSHIP_GIFT' : 'LEGACY_PT';
    const existing = await prisma.ptCreditBatch.findFirst({ where: { membershipId: item.id, source } });
    if (existing) { skipped++; continue; }
    if (!gift && !levels.includes(level ?? '')) {
      errors.push(`Membership #${item.id}: map Package #${item.packageId} to a PT level`); continue;
    }
    if (!item.payments.length) {
      errors.push(`Membership #${item.id}: no verified PayOS or recorded desk payment`); continue;
    }
    const remaining = item.remainingSessions ?? 0;
    if (remaining < 0 || remaining > count) {
      errors.push(`Membership #${item.id}: remainingSessions ${remaining} outside 0..${count}`); continue;
    }
    const heldBookings = item.bookings.filter(booking => holdStatuses.includes(booking.status) ||
      (booking.status === 'ABSENT_ELIGIBLE' && booking.makeUpRequests.some(request =>
        request.status === 'PENDING' && request.expiresAt > new Date())));
    if (heldBookings.length > remaining) {
      errors.push(`Membership #${item.id}: ${heldBookings.length} held bookings exceed ${remaining} remaining sessions`); continue;
    }
    ready++;
    plans.push({ item, gift, count, level: level!, source, remaining, heldBookings });
  }
  const report = { mode: apply ? 'apply' : 'dry-run', ready, skipped, errors };
  if (errors.length || !apply) return report;
  for (const { item, gift, count, level, source, remaining, heldBookings } of plans) {
    await prisma.$transaction(async tx => {
      const wallet = await tx.ptWallet.upsert({ where: { memberId: item.userId },
        create: { memberId: item.userId }, update: {} });
      const concurrent = await tx.ptCreditBatch.findFirst({ where: { membershipId: item.id, source } });
      if (concurrent) return;
      const batch = await tx.ptCreditBatch.create({ data: {
        walletId: wallet.id, level, source, initialCount: count,
        usedCount: count - remaining, heldCount: heldBookings.length,
        membershipId: item.id, paymentId: gift ? null : item.payments[0].id,
        coachId: gift ? null : item.coachId,
        grantedAt: item.payments[0].paidAt ?? item.createdAt,
      } });
      await tx.ptCreditTransaction.create({ data: { batchId: batch.id, kind: 'GRANT', quantity: count,
        note: `Backfilled from Membership #${item.id}` } });
      if (count > remaining) await tx.ptCreditTransaction.create({ data: {
        batchId: batch.id, kind: 'LEGACY_CONSUMED', quantity: count - remaining,
        note: 'Historical usage retained in Membership and Booking records',
      } });
      for (const booking of heldBookings) {
        await tx.ptBookingCreditAllocation.create({ data: { bookingId: booking.id, batchId: batch.id } });
        await tx.ptCreditTransaction.create({ data: {
          batchId: batch.id, bookingId: booking.id, kind: 'HOLD', quantity: 1,
          note: 'Backfilled active booking',
        } });
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30000 });
  }
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const prisma = new PrismaClient();
  backfillPtWallet(prisma, process.argv.includes('--apply'))
    .then(report => { console.log(JSON.stringify(report, null, 2)); if (report.errors.length) process.exitCode = 1; })
    .catch(error => { console.error(error); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
}
