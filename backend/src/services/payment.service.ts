import { randomInt } from 'node:crypto';
import PayOS from '@payos/node';
import prisma from '../config/prisma.js';



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
  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({ where: { orderCode } });
    if (!payment) return { result: 'NOT_FOUND' as const };

    if (Number(payment.amount) !== paidAmount) {
      return { result: 'AMOUNT_MISMATCH' as const };
    }

    if (payment.status === 'PAID') return { result: 'ALREADY_PAID' as const };

    const updated = await tx.payment.updateMany({
      where: { id: payment.id, status: { in: ['PENDING', 'FAILED', 'CANCELLED'] } },
      data: { status: 'PAID' },
    });
    if (updated.count === 0) return { result: 'NOT_PENDING' as const };

    if (payment.membershipId !== null) {
      if (payment.renewalDurationDays !== null) {
        const membership = await tx.membership.findUnique({
          where: { id: payment.membershipId },
        });
        if (!membership) throw new Error('Membership for payment was not found');

        const now = new Date();
        const baseDate = membership.endDate > now ? membership.endDate : now;
        const newEndDate = new Date(baseDate);
        newEndDate.setDate(newEndDate.getDate() + payment.renewalDurationDays);

        await tx.membership.update({
          where: { id: payment.membershipId },
          data: { endDate: newEndDate, status: 'ACTIVE' },
        });
      } else {
        const membership = await tx.membership.findUnique({
          where: { id: payment.membershipId },
          include: { package: true },
        });
        if (!membership) throw new Error('Membership for payment was not found');

        const startDate = new Date();
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + membership.package.durationDays);
        await tx.membership.update({
          where: { id: payment.membershipId },
          data: { startDate, endDate, status: 'ACTIVE' },
        });
      }
    }

    return { result: 'PAID' as const };
  });
}

export async function markPaymentFailed(orderCode: bigint) {
  return prisma.$transaction(async (tx) => {
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
  });
}
