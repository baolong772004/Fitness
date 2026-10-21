import type { Prisma } from '@prisma/client';

/** PayOS success or a reconciled, recorded desk payment. */
export const verifiedGymPayment: Prisma.PaymentWhereInput = { OR: [
  { status: 'PAID' },
  { status: 'COMPLETED', method: { in: ['CASH', 'POS_CARD'] } },
] };
