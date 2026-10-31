import { Prisma, PrismaClient } from '@prisma/client';
import { PtBookingError } from './ptError.js';
import prisma from '../config/prisma.js';
import { PT_RENEWAL_GRACE_DAYS, ptRenewalError } from './ptRenewal.service.js';
import { isPaidPtSource } from './ptEntitlementPolicy.service.js';

type Db = Prisma.TransactionClient | PrismaClient;
export const PT_LEVELS = ['TRIAL', 'BEGINNER', 'INTERMEDIATE', 'ADVANCED'] as const;
export type PtLevel = typeof PT_LEVELS[number];
export const isPtLevel = (value: unknown): value is PtLevel => PT_LEVELS.includes(value as PtLevel);

export async function assertPtWalletSchemaReady() {
  const rows = await prisma.$queryRaw<Array<{ name: string }>>`
    SELECT name FROM sys.tables WHERE name IN
      (N'PtWallet', N'PtCreditBatch', N'PtBookingCreditAllocation', N'PtCreditTransaction', N'PtProduct', N'CoachSpecialization')
  `;
  if (rows.length !== 6) throw new Error('PT wallet migration is missing. Run prisma migrate deploy before starting the backend.');
  const columns = await prisma.$queryRaw<Array<{ name: string }>>`
    SELECT CONCAT(OBJECT_NAME(object_id), '.', name) AS name FROM sys.columns
    WHERE (object_id = OBJECT_ID(N'dbo.PtProduct') AND name = N'durationDays')
       OR (object_id = OBJECT_ID(N'dbo.PtCreditBatch') AND name IN (N'startAt', N'endAt', N'activatedAt'))
       OR (object_id = OBJECT_ID(N'dbo.Payment') AND name IN (N'ptLevelSnapshot', N'ptSessionsSnapshot', N'ptDurationDays'))
  `;
  if (columns.length !== 7) throw new Error('PT expiry migration is missing. Run prisma migrate deploy before starting the backend.');
  const renewalTables = await prisma.$queryRaw<Array<{ name: string }>>`
    SELECT name FROM sys.tables WHERE name IN (N'PtRenewalOption', N'PtRenewalEvent')
  `;
  const renewalColumns = await prisma.$queryRaw<Array<{ name: string }>>`
    SELECT name FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.Payment')
      AND name IN (N'ptRenewalOptionId', N'ptRenewalBatchId', N'ptRenewalDays')
  `;
  if (renewalTables.length !== 2 || renewalColumns.length !== 3) {
    throw new Error('PT renewal migration is missing. Run prisma migrate deploy before starting the backend.');
  }
  const renewalScopeColumns = await prisma.$queryRaw<Array<{ name: string }>>`
    SELECT CONCAT(OBJECT_NAME(object_id), '.', name) AS name FROM sys.columns
    WHERE (object_id = OBJECT_ID(N'dbo.PtRenewalOption') AND name = N'ptProductId')
       OR (object_id = OBJECT_ID(N'dbo.Payment') AND name = N'ptRenewalProductId')
  `;
  if (renewalScopeColumns.length !== 2) {
    throw new Error('PT renewal product scope migration is missing. Run prisma migrate deploy before starting the backend.');
  }
  const paidPolicyColumns = await prisma.$queryRaw<Array<{ name: string }>>`
    SELECT CONCAT(OBJECT_NAME(object_id), '.', name) AS name FROM sys.columns
    WHERE (object_id = OBJECT_ID(N'dbo.PtProduct') AND name = N'singleSessionPrice')
       OR (object_id = OBJECT_ID(N'dbo.Payment') AND name = N'ptPurchaseMode')
  `;
  const coachChangeTable = await prisma.$queryRaw<Array<{ name: string }>>`
    SELECT name FROM sys.tables WHERE name = N'PtCoachChangeRequest'
  `;
  if (paidPolicyColumns.length !== 2 || coachChangeTable.length !== 1) {
    throw new Error('PT Paid entitlement migration is missing. Run prisma migrate deploy before starting the backend.');
  }
  const purchaseUnitColumn = await prisma.$queryRaw<Array<{ name: string }>>`
    SELECT name FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.PtCreditBatch')
      AND name = N'purchaseUnitIndex'
  `;
  if (purchaseUnitColumn.length !== 1) {
    throw new Error('PT purchase units migration is missing. Run prisma migrate deploy before starting the backend.');
  }
  const offerTables = await prisma.$queryRaw<Array<{ name: string }>>`
    SELECT name FROM sys.tables WHERE name IN (N'PtSingleOffer', N'PtPurchaseItem')
  `;
  const batchProductColumn = await prisma.$queryRaw<Array<{ name: string }>>`
    SELECT name FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.PtCreditBatch')
      AND name IN (N'ptProductIdSnapshot', N'benefitsSnapshot')
  `;
  const renewalModeColumn = await prisma.$queryRaw<Array<{ name: string }>>`
    SELECT name FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.PtRenewalOption')
      AND name = N'purchaseMode'
  `;
  if (offerTables.length !== 2 || batchProductColumn.length !== 2 || renewalModeColumn.length !== 1) {
    throw new Error('PT offers and order items migration is missing. Run prisma migrate deploy before starting the backend.');
  }
}

export async function grantPtCredit(tx: Prisma.TransactionClient, input: {
  memberId: number; level: PtLevel; source: string; count: number;
  paymentId?: number; purchaseBatchOrdinal?: number; ptProductIdSnapshot?: number | null; benefitsSnapshot?: string | null; membershipId?: number; coachId?: number | null;
  startAt?: Date | null; endAt?: Date | null; activatedAt?: Date | null;
}) {
  if (!Number.isSafeInteger(input.count) || input.count <= 0) throw new Error('Invalid PT credit grant');
  if (input.paymentId) {
    const alreadyGranted = await tx.ptCreditBatch.findFirst({ where: { paymentId: input.paymentId,
      purchaseUnitIndex: input.purchaseBatchOrdinal ?? 0 } });
    if (alreadyGranted) return alreadyGranted;
  }
  if (input.membershipId && await tx.ptCreditBatch.findFirst({ where: {
    membershipId: input.membershipId, source: input.source,
  } })) return;
  const wallet = await tx.ptWallet.upsert({ where: { memberId: input.memberId },
    create: { memberId: input.memberId }, update: {} });
  const batch = await tx.ptCreditBatch.create({ data: {
    walletId: wallet.id, level: input.level, source: input.source,
    initialCount: input.count, paymentId: input.paymentId,
    purchaseUnitIndex: input.purchaseBatchOrdinal ?? 0,
    ptProductIdSnapshot: input.ptProductIdSnapshot ?? null,
    benefitsSnapshot: input.benefitsSnapshot ?? null,
    membershipId: input.membershipId, coachId: input.coachId ?? null,
    startAt: input.startAt ?? null, endAt: input.endAt ?? null,
    activatedAt: input.activatedAt ?? null,
  } });
  await tx.ptCreditTransaction.create({ data: {
    batchId: batch.id, kind: 'GRANT', quantity: input.count,
  } });
  return batch;
}

type SummaryBatch = { level: string; initialCount: number; usedCount: number; heldCount: number;
  id?: number; source?: string; coachId?: number | null; grantedAt?: Date; paymentId?: number | null; membershipId?: number | null; ptProductIdSnapshot?: number | null; benefitsSnapshot?: string | null;
  startAt?: Date | null; endAt?: Date | null; activatedAt?: Date | null;
  payment?: { ptProductId: number | null } | null;
  membership?: { status: string; startDate: Date; endDate: Date } | null };

export function ptBatchCovers(batch: SummaryBatch, start: Date, end: Date) {
  if (batch.level === 'TRIAL') {
    const gift = batch.membership;
    return Boolean(gift && ['ACTIVE', 'PENDING_ACTIVATION'].includes(gift.status) &&
      gift.startDate <= start && gift.endDate > start && gift.endDate >= end);
  }
  if (batch.startAt && batch.startAt > start) return false;
  if (batch.endAt && batch.endAt <= start) return false;
  if (batch.endAt && batch.endAt < end) return false;
  return true;
}

export function summarizePtBatches(allBatches: SummaryBatch[], now = new Date()) {
  const levels = PT_LEVELS.map(level => {
    const batches = allBatches.filter(batch => batch.level === level);
    const total = batches.reduce((sum, batch) => sum + batch.initialCount, 0);
    const used = batches.reduce((sum, batch) => sum + batch.usedCount, 0);
    const held = batches.reduce((sum, batch) => sum + batch.heldCount, 0);
    const available = batches.reduce((sum, batch) => sum +
      (ptBatchCovers(batch, now, now) ? Math.max(0, batch.initialCount - batch.usedCount - batch.heldCount) : 0), 0);
    const expired = batches.reduce((sum, batch) => sum +
      ((batch.level === 'TRIAL' ? batch.membership?.endDate : batch.endAt) &&
        (batch.level === 'TRIAL' ? batch.membership?.endDate : batch.endAt)! <= now
        ? Math.max(0, batch.initialCount - batch.usedCount - batch.heldCount) : 0), 0);
    return { level, total, used, held, available, expired, retained: total - used - held };
  });
  return { total: levels.reduce((sum, level) => sum + level.total, 0),
    used: levels.reduce((sum, level) => sum + level.used, 0),
    held: levels.reduce((sum, level) => sum + level.held, 0),
    available: levels.reduce((sum, level) => sum + level.available, 0),
    expired: levels.reduce((sum, level) => sum + level.expired, 0), levels,
    sources: allBatches.map(batch => ({
      id: batch.id, level: batch.level, source: batch.source, coachId: batch.coachId,
      quantity: batch.initialCount, usedSessions: batch.usedCount, reservedSessions: batch.heldCount,
      remainingSessions: Math.max(0, batch.initialCount - batch.usedCount - batch.heldCount),
      availableSessions: ptBatchCovers(batch, now, now) ?
        Math.max(0, batch.initialCount - batch.usedCount - batch.heldCount) : 0,
      startAt: batch.level === 'TRIAL' ? batch.membership?.startDate ?? null : batch.startAt ?? null,
      endAt: batch.level === 'TRIAL' ? batch.membership?.endDate ?? null : batch.endAt ?? null,
      activatedAt: batch.activatedAt ?? null, paymentId: batch.paymentId ?? null,
      ptProductId: batch.ptProductIdSnapshot ?? batch.payment?.ptProductId ?? null,
      benefits: batch.benefitsSnapshot ?? null,
      membershipId: batch.membershipId ?? null,
      renewable: !ptRenewalError(batch, now),
      renewalDeadline: batch.endAt ? new Date(batch.endAt.getTime() + PT_RENEWAL_GRACE_DAYS * 86400000) : null,
      status: (batch.level === 'TRIAL' ? batch.membership?.endDate : batch.endAt) &&
        (batch.level === 'TRIAL' ? batch.membership?.endDate : batch.endAt)! <= now ? 'EXPIRED' :
        batch.level === 'TRIAL' && !ptBatchCovers(batch, now, now) ? 'INACTIVE' :
        batch.initialCount <= batch.usedCount && batch.heldCount === 0 ? 'COMPLETED' : 'ACTIVE',
    })),
  };
}

export async function walletSummary(db: Db, memberId: number) {
  const wallet = await db.ptWallet.findUnique({ where: { memberId }, include: {
    batches: { include: { membership: { select: { status: true, startDate: true, endDate: true } },
      payment: { select: { ptProductId: true } } },
      orderBy: [{ grantedAt: 'asc' }, { id: 'asc' }] },
  } });
  return summarizePtBatches(wallet?.batches ?? []);
}

export async function reservePtCredit(tx: Prisma.TransactionClient, input: {
  memberId: number; level: PtLevel; coachId: number; bookingId: number; start: Date; end: Date;
  legacyMembershipId?: number;
}) {
  const batches = await tx.ptCreditBatch.findMany({ where: {
    wallet: { memberId: input.memberId }, level: input.level,
    OR: [{ coachId: null }, { coachId: input.coachId }],
    ...(input.legacyMembershipId ? { membershipId: input.legacyMembershipId } : {}),
  }, include: { membership: true }, orderBy: [{ grantedAt: 'asc' }, { id: 'asc' }] });
  batches.sort((a, b) => (a.endAt?.getTime() ?? Infinity) - (b.endAt?.getTime() ?? Infinity) ||
    a.grantedAt.getTime() - b.grantedAt.getTime() || a.id - b.id);
  const batch = batches.find(row => row.initialCount > row.usedCount + row.heldCount &&
    ptBatchCovers(row, input.start, input.end));
  if (!batch) throw new PtBookingError(409, `Không đủ credit ${input.level} khả dụng cho ca này.`);
  if (isPaidPtSource(batch.source) && batch.coachId === null) {
    const assigned = await tx.ptCreditBatch.updateMany({ where: { id: batch.id, coachId: null },
      data: { coachId: input.coachId } });
    if (assigned.count !== 1) throw new PtBookingError(409, 'Coach của gói PT vừa thay đổi. Vui lòng đặt lại lịch.');
  }
  const held = await tx.ptCreditBatch.updateMany({ where: {
    id: batch.id, usedCount: batch.usedCount, heldCount: batch.heldCount,
  }, data: { heldCount: { increment: 1 } } });
  if (held.count !== 1) throw new PtBookingError(409, 'Số dư PT vừa thay đổi. Vui lòng thử lại.');
  await tx.ptBookingCreditAllocation.create({ data: { bookingId: input.bookingId, batchId: batch.id } });
  await tx.ptCreditTransaction.create({ data: {
    batchId: batch.id, bookingId: input.bookingId, kind: 'HOLD', quantity: 1,
  } });
  return batch;
}

export async function settlePtCredit(tx: Prisma.TransactionClient, bookingId: number) {
  const allocation = await tx.ptBookingCreditAllocation.findUnique({ where: { bookingId } });
  if (!allocation) throw new PtBookingError(409, 'Booking chưa có credit được giữ chỗ.');
  if (allocation.status === 'CONSUMED') return false;
  if (allocation.status !== 'HELD') throw new PtBookingError(409, 'Credit của Booking đã được hoàn.');
  const claimed = await tx.ptBookingCreditAllocation.updateMany({ where: { bookingId, status: 'HELD' },
    data: { status: 'CONSUMED' } });
  if (claimed.count !== 1) return false;
  const updated = await tx.ptCreditBatch.updateMany({ where: { id: allocation.batchId, heldCount: { gt: 0 } },
    data: { heldCount: { decrement: 1 }, usedCount: { increment: 1 } } });
  if (updated.count !== 1) throw new PtBookingError(409, 'Số dư giữ chỗ PT không hợp lệ.');
  await tx.ptCreditTransaction.create({ data: {
    batchId: allocation.batchId, bookingId, kind: 'CONSUME', quantity: 1,
  } });
  return true;
}

export async function releasePtCredit(tx: Prisma.TransactionClient, bookingId: number,
  options?: { kind: 'PROTECTED_CANCEL'; actorId: number; note: string }) {
  const allocation = await tx.ptBookingCreditAllocation.findUnique({ where: { bookingId } });
  if (!allocation || allocation.status !== 'HELD') return false;
  const claimed = await tx.ptBookingCreditAllocation.updateMany({ where: { bookingId, status: 'HELD' },
    data: { status: 'RELEASED' } });
  if (claimed.count !== 1) return false;
  const updated = await tx.ptCreditBatch.updateMany({ where: { id: allocation.batchId, heldCount: { gt: 0 } },
    data: { heldCount: { decrement: 1 } } });
  if (updated.count !== 1) throw new PtBookingError(409, 'Số dư giữ chỗ PT không hợp lệ.');
  await tx.ptCreditTransaction.create({ data: {
    batchId: allocation.batchId, bookingId, kind: options?.kind ?? 'RELEASE', quantity: 1,
    actorId: options?.actorId, note: options?.note,
  } });
  return true;
}

export async function refundConsumedPtCredit(tx: Prisma.TransactionClient, bookingId: number) {
  const allocation = await tx.ptBookingCreditAllocation.findUnique({ where: { bookingId } });
  if (!allocation || allocation.status !== 'CONSUMED') return false;
  const claimed = await tx.ptBookingCreditAllocation.updateMany({ where: { bookingId, status: 'CONSUMED' },
    data: { status: 'RELEASED' } });
  if (claimed.count !== 1) return false;
  const updated = await tx.ptCreditBatch.updateMany({ where: { id: allocation.batchId, usedCount: { gt: 0 } },
    data: { usedCount: { decrement: 1 } } });
  if (updated.count !== 1) throw new PtBookingError(409, 'Số dư PT đã sử dụng không hợp lệ.');
  await tx.ptCreditTransaction.create({ data: {
    batchId: allocation.batchId, bookingId, kind: 'REFUND', quantity: 1,
  } });
  return true;
}
