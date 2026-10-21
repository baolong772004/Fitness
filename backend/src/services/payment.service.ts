import { randomInt } from 'node:crypto';
import PayOS from '@payos/node';
import { Prisma, PrismaClient } from '@prisma/client';
import { lockGymMember } from './gymMembershipLock.service.js';
import { reconcileGymMembershipStates } from './membership.service.js';
import { grantPtCredit, isPtLevel } from './ptWallet.service.js';
import { ptRenewalError, ptRenewalOptionMatchesBatch, renewedPtPeriod } from './ptRenewal.service.js';

const prisma = new PrismaClient();

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function addPtDurationDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 86400000);
}

function laterDate(first: Date, second: Date) {
  return first > second ? first : second;
}

export function getPayOS(): PayOS | null {
  const clientId = process.env.PAYOS_CLIENT_ID?.trim();
  const apiKey = process.env.PAYOS_API_KEY?.trim();
  const checksumKey = process.env.PAYOS_CHECKSUM_KEY?.trim();

  if (!clientId || !apiKey || !checksumKey) return null;
  return new PayOS(clientId, apiKey, checksumKey);
}

export function generateOrderCode(): number {
  // Milliseconds plus a random suffix remain within Number.MAX_SAFE_INTEGER and
  // greatly reduce collisions compared with a short random-only code.
  return Date.now() * 1_000 + randomInt(0, 1_000);
}

export function getPayOSRedirectUrls() {
  const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
  return {
    cancelUrl: `${frontendUrl}/payment-cancel`,
    returnUrl: `${frontendUrl}/payment-success`,
  };
}

export async function markPaymentPaid(orderCode: bigint, paidAmount: number) {
  const paymentOwner = await prisma.payment.findUnique({ where: { orderCode }, select: { userId: true } });
  if (!paymentOwner) return { result: 'NOT_FOUND' as const };

  return prisma.$transaction(async (tx) => {
    await lockGymMember(tx, paymentOwner.userId);
    const payment = await tx.payment.findUnique({ where: { orderCode } });
    if (!payment) return { result: 'NOT_FOUND' as const };

    if (payment.status === 'PAID') return { result: 'ALREADY_PAID' as const };
    if (payment.status === 'PAID_REVIEW') return { result: 'ALREADY_PAID_REVIEW' as const };

    if (Number(payment.amount) !== paidAmount) {
      await tx.payment.updateMany({
        where: { id: payment.id, status: { in: ['PENDING', 'FAILED', 'CANCELLED'] } },
        data: { status: 'PAID_REVIEW', paidAt: new Date() },
      });
      return { result: 'AMOUNT_MISMATCH' as const };
    }

    await reconcileGymMembershipStates(tx, paymentOwner.userId, new Date());

    // A renewal order may have been created while the target was Expired, then
    // another verified payment queued that target before this callback arrived.
    // The money has arrived, but extending a queued Gym package would violate
    // the rule that a Pending Activation package cannot be renewed.
    const renewalTarget = payment.membershipId !== null && payment.renewalDurationDays !== null
      ? await tx.membership.findUnique({
          where: { id: payment.membershipId },
          include: { package: true },
        })
      : null;
    const purchaseTarget = payment.membershipId !== null && payment.renewalDurationDays === null
      ? await tx.membership.findUnique({ where: { id: payment.membershipId }, include: { package: true } })
      : null;
    const ptProduct = payment.ptProductId !== null
      ? await tx.ptProduct.findUnique({ where: { id: payment.ptProductId } }) : null;
    const ptRenewalBatch = payment.ptRenewalBatchId !== null
      ? await tx.ptCreditBatch.findUnique({ where: { id: payment.ptRenewalBatchId },
          include: { wallet: true, payment: { select: { ptProductId: true } } } }) : null;
    const ptRenewalOption = payment.ptRenewalOptionId !== null
      ? await tx.ptRenewalOption.findUnique({ where: { id: payment.ptRenewalOptionId } }) : null;
    const paidAt = new Date();
    const ptPurchaseUnavailable = Boolean(purchaseTarget?.package.type === 'PT' &&
      !isPtLevel(purchaseTarget.package.ptLevel)) ||
      Boolean(payment.ptProductId !== null && (!ptProduct || !payment.ptQuantity ||
        !['BEGINNER', 'INTERMEDIATE', 'ADVANCED'].includes(payment.ptLevelSnapshot ?? ptProduct.level) ||
        !(payment.ptSessionsSnapshot ?? ptProduct.sessionCount)));
    const ptRenewalUnavailable = (payment.ptRenewalBatchId !== null ||
      payment.ptRenewalOptionId !== null || payment.ptRenewalProductId !== null || payment.ptRenewalDays !== null) && (
      !ptRenewalBatch || !ptRenewalOption || ptRenewalBatch.wallet.memberId !== payment.userId ||
      !ptRenewalOptionMatchesBatch({ level: payment.ptLevelSnapshot ?? '',
        ptProductId: payment.ptRenewalProductId }, {
        level: ptRenewalBatch.level, ptProductId: ptRenewalBatch.payment?.ptProductId ?? null,
      }) ||
      !payment.ptRenewalDays || payment.ptRenewalDays < 1 ||
      Boolean(ptRenewalBatch && ptRenewalError(ptRenewalBatch, paidAt)));
    const requiresReview = (payment.membershipId !== null && !renewalTarget && !purchaseTarget) ||
      renewalTarget?.package.type === 'PT' ||
      (renewalTarget?.package.type === 'MEMBERSHIP' && !['ACTIVE', 'EXPIRED'].includes(renewalTarget.status)) ||
      (purchaseTarget !== null && purchaseTarget.status !== 'PENDING') ||
      ptPurchaseUnavailable || ptRenewalUnavailable;

    const updated = await tx.payment.updateMany({
      where: { id: payment.id, status: { in: ['PENDING', 'FAILED', 'CANCELLED'] } },
      data: { status: requiresReview ? 'PAID_REVIEW' : 'PAID', paidAt },
    });
    if (updated.count === 0) return { result: 'NOT_PENDING' as const };
    if (requiresReview) return { result: 'PAID_REVIEW' as const };

    if (ptProduct && payment.ptQuantity) {
      const sessions = payment.ptSessionsSnapshot ?? ptProduct.sessionCount;
      const startAt = paidAt;
      const endAt = payment.ptDurationDays ? addPtDurationDays(startAt, payment.ptDurationDays) : null;
      await grantPtCredit(tx, { memberId: payment.userId,
        level: (payment.ptLevelSnapshot ?? ptProduct.level) as 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED',
        source: sessions === 1 ? 'SINGLE_PURCHASE' : 'PACKAGE_PURCHASE',
        count: sessions * payment.ptQuantity, paymentId: payment.id,
        startAt, endAt, activatedAt: paidAt });
    }

    if (ptRenewalBatch?.endAt && payment.ptRenewalDays) {
      const period = renewedPtPeriod(ptRenewalBatch.endAt, payment.ptRenewalDays, paidAt);
      const extended = await tx.ptCreditBatch.updateMany({ where: {
        id: ptRenewalBatch.id, endAt: ptRenewalBatch.endAt,
      }, data: { endAt: period.endAt } });
      if (extended.count !== 1) throw new Error('PT renewal target changed during payment confirmation');
      await tx.ptRenewalEvent.create({ data: {
        batchId: ptRenewalBatch.id, paymentId: payment.id,
        previousEndAt: ptRenewalBatch.endAt, startAt: period.startAt,
        endAt: period.endAt, durationDays: payment.ptRenewalDays,
      } });
    }

    if (payment.membershipId !== null) {
      if (payment.renewalDurationDays !== null) {
        const membership = await tx.membership.findUnique({
          where: { id: payment.membershipId },
          include: { package: true },
        });
        if (!membership) throw new Error('Membership for payment was not found');

        const now = new Date();
        if (membership.package.type === 'MEMBERSHIP') {
          const lastOrder = await tx.membership.aggregate({
            where: { userId: membership.userId, isGymMembership: true },
            _max: { activationOrder: true },
          });
          const otherMemberships = await tx.membership.findMany({
            where: {
              userId: membership.userId,
              id: { not: membership.id },
              package: { type: 'MEMBERSHIP' },
              status: { in: ['ACTIVE', 'PENDING_ACTIVATION'] },
              endDate: { gte: now },
            },
            select: { id: true, startDate: true, endDate: true, status: true },
          });
          const otherActive = otherMemberships.filter(item => item.status === 'ACTIVE' && item.startDate <= now);

          if (membership.status !== 'PENDING_ACTIVATION' && (otherActive.length > 0 || membership.status !== 'ACTIVE')) {
            const latestEnd = otherMemberships.reduce((latest, item) => laterDate(latest, item.endDate), now);
            const startDate = latestEnd > now ? new Date(latestEnd.getTime() + 1) : now;
            await tx.membership.update({
              where: { id: membership.id },
              data: {
                startDate,
                endDate: addDays(startDate, payment.renewalDurationDays),
                status: startDate > now ? 'PENDING_ACTIVATION' : 'ACTIVE',
                activationOrder: (lastOrder._max.activationOrder ?? 0) + 1,
                activatedAt: startDate > now ? null : now,
              },
            });
          } else {
            const previousEnd = membership.endDate;
            const newEndDate = addDays(laterDate(previousEnd, now), payment.renewalDurationDays);
            await tx.membership.update({
              where: { id: membership.id },
              data: {
                endDate: newEndDate,
                status: membership.status === 'PENDING_ACTIVATION' ? 'PENDING_ACTIVATION' : 'ACTIVE',
              },
            });

            const queuedMemberships = await tx.membership.findMany({
              where: {
                userId: membership.userId,
                id: { not: membership.id },
                package: { type: 'MEMBERSHIP' },
                status: 'PENDING_ACTIVATION',
                startDate: { gt: previousEnd },
              },
              select: { id: true, startDate: true, endDate: true },
            });
            await Promise.all(queuedMemberships.map(item => tx.membership.update({
              where: { id: item.id },
              data: {
                startDate: addDays(item.startDate, payment.renewalDurationDays!),
                endDate: addDays(item.endDate, payment.renewalDurationDays!),
              },
            })));
          }
        } else {
          throw new Error('PT time extension requires a separately priced product');
        }
      } else {
        const membership = await tx.membership.findUnique({
          where: { id: payment.membershipId },
          include: { package: true },
        });
        if (!membership) throw new Error('Membership for payment was not found');

        const now = new Date();
        let startDate = now;
        let status = 'ACTIVE';
        let activationOrder: number | null = null;
        if (membership.package.type === 'MEMBERSHIP') {
          const lastOrder = await tx.membership.aggregate({
            where: { userId: membership.userId, isGymMembership: true },
            _max: { activationOrder: true },
          });
          activationOrder = (lastOrder._max.activationOrder ?? 0) + 1;
          const existingGymMemberships = await tx.membership.findMany({
            where: {
              userId: membership.userId,
              id: { not: membership.id },
              package: { type: 'MEMBERSHIP' },
              status: { in: ['ACTIVE', 'PENDING_ACTIVATION'] },
              endDate: { gte: now },
            },
            select: { endDate: true },
          });
          const latestEnd = existingGymMemberships.reduce((latest, item) => laterDate(latest, item.endDate), now);
          if (latestEnd > now) {
            startDate = new Date(latestEnd.getTime() + 1);
            status = 'PENDING_ACTIVATION';
          }
        }
        const endDate = addDays(startDate, membership.package.durationDays);
        await tx.membership.update({
          where: { id: payment.membershipId },
          data: {
            startDate, endDate, status,
            activationOrder,
            activatedAt: membership.package.type === 'MEMBERSHIP' && status === 'PENDING_ACTIVATION' ? null : now,
          },
        });
        if (membership.package.type === 'MEMBERSHIP' && membership.package.trialPtSessions > 0) {
          await grantPtCredit(tx, { memberId: membership.userId, level: 'TRIAL',
            source: 'MEMBERSHIP_GIFT', count: membership.package.trialPtSessions,
            membershipId: membership.id, startAt: startDate, endAt: endDate,
            activatedAt: status === 'ACTIVE' ? now : null });
        }
        if (membership.package.type === 'PT' && isPtLevel(membership.package.ptLevel) &&
          membership.package.ptLevel !== 'TRIAL') {
          await grantPtCredit(tx, { memberId: membership.userId, level: membership.package.ptLevel,
            source: 'PACKAGE_PURCHASE', count: membership.package.totalPtSessions ?? 0,
            paymentId: payment.id, membershipId: membership.id, coachId: membership.coachId,
            startAt: now, activatedAt: now });
        }
      }
    }

    return { result: 'PAID' as const };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10000, timeout: 30000 });
}

export async function markPaymentFailed(orderCode: bigint) {
  const paymentOwner = await prisma.payment.findUnique({ where: { orderCode }, select: { userId: true } });
  if (!paymentOwner) return;

  return prisma.$transaction(async (tx) => {
    await lockGymMember(tx, paymentOwner.userId);
    const payment = await tx.payment.findUnique({ where: { orderCode } });
    if (!payment || payment.status !== 'PENDING') return;

    const updated = await tx.payment.updateMany({
      where: { id: payment.id, status: 'PENDING' },
      data: { status: 'FAILED' },
    });
    if (updated.count === 0) return;

    // New checkout memberships are created solely for this payment. Renewal payments
    // point at an existing membership and must leave it unchanged on failure.
    if (payment.membershipId !== null && payment.renewalDurationDays === null) {
      await tx.membership.updateMany({
        where: { id: payment.membershipId, status: 'PENDING' },
        data: { status: 'CANCELLED' },
      });
    }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10000, timeout: 30000 });
}
