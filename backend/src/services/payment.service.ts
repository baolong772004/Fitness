import { randomInt } from 'node:crypto';
import PayOS from '@payos/node';
import { Prisma, PrismaClient } from '@prisma/client';
import { lockGymMember } from './gymMembershipLock.service.js';
import { reconcileGymMembershipStates } from './membership.service.js';

const prisma = new PrismaClient();

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
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

    if (Number(payment.amount) !== paidAmount) {
      return { result: 'AMOUNT_MISMATCH' as const };
    }

    if (payment.status === 'PAID') return { result: 'ALREADY_PAID' as const };
    if (payment.status === 'PAID_REVIEW') return { result: 'ALREADY_PAID_REVIEW' as const };

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
    let ptPurchaseUnavailable = false;
    if (purchaseTarget?.package.type === 'PT') {
      const [gym, coach] = await Promise.all([
        tx.membership.findFirst({ where: {
          userId: purchaseTarget.userId, status: 'ACTIVE',
          startDate: { lte: new Date() }, endDate: { gte: new Date() },
          package: { type: 'MEMBERSHIP' },
        }, select: { id: true } }),
        tx.coachProfile.findFirst({ where: {
          userId: purchaseTarget.coachId ?? -1, status: 'ACTIVE', user: { status: 'ACTIVE' },
        }, select: { id: true } }),
      ]);
      ptPurchaseUnavailable = !gym || !coach;
    }
    const requiresReview = renewalTarget?.package.type === 'PT' ||
      (renewalTarget?.package.type === 'MEMBERSHIP' && !['ACTIVE', 'EXPIRED'].includes(renewalTarget.status)) ||
      ptPurchaseUnavailable;

    const paidAt = new Date();
    const updated = await tx.payment.updateMany({
      where: { id: payment.id, status: { in: ['PENDING', 'FAILED', 'CANCELLED'] } },
      data: { status: requiresReview ? 'PAID_REVIEW' : 'PAID', paidAt },
    });
    if (updated.count === 0) return { result: 'NOT_PENDING' as const };
    if (requiresReview) return { result: 'PAID_REVIEW' as const };

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
