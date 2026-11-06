import type { Prisma } from '@prisma/client';

/** PayOS success or a reconciled, recorded desk payment. */
export const verifiedGymPayment: Prisma.PaymentWhereInput = { OR: [
  { status: 'PAID' },
  { status: 'COMPLETED', method: { in: ['CASH', 'POS_CARD'] } },
] };

export function activePaidGymMembershipWhere(userId: number, now: Date): Prisma.MembershipWhereInput {
  return {
    userId,
    status: { in: ['ACTIVE', 'FROZEN'] },
    startDate: { lte: now },
    endDate: { gt: now },
    package: { type: 'MEMBERSHIP' },
    payments: { some: verifiedGymPayment },
  };
}
