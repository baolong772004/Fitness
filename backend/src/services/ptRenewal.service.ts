import { isPaidPtSource, PT_RENEWAL_GRACE_DAYS } from './ptEntitlementPolicy.service.js';
export { PT_RENEWAL_GRACE_DAYS };
const DAY_MS = 86400000;

export type RenewablePtBatch = {
  level: string;
  source?: string;
  endAt?: Date | null;
  initialCount: number;
  usedCount: number;
};

export function ptRenewalOptionMatchesBatch(
  option: { level: string; ptProductId: number | null; purchaseMode?: string | null },
  batch: { level: string; ptProductId: number | null; source?: string },
) {
  return option.level === batch.level &&
    (!option.purchaseMode || (option.purchaseMode === 'SINGLE' ? batch.source === 'SINGLE_PURCHASE' : batch.source === 'PACKAGE_PURCHASE')) &&
    (option.ptProductId === null || option.ptProductId === batch.ptProductId);
}

export function ptRenewalError(batch: RenewablePtBatch, now = new Date()): string | null {
  if (!isPaidPtSource(batch.source) || !['BEGINNER', 'INTERMEDIATE', 'ADVANCED'].includes(batch.level) || !batch.endAt) {
    return 'Chỉ gói PT trả phí có thời hạn riêng mới được gia hạn.';
  }
  if (batch.initialCount <= batch.usedCount) return 'Gói PT đã dùng hết số buổi.';
  if (batch.endAt.getTime() + PT_RENEWAL_GRACE_DAYS * DAY_MS < now.getTime()) {
    return 'Gói PT đã hết hạn quá 30 ngày. Vui lòng mua gói mới.';
  }
  return null;
}

export function renewedPtPeriod(previousEndAt: Date, durationDays: number, paidAt: Date) {
  const startAt = previousEndAt > paidAt ? previousEndAt : paidAt;
  return { startAt, endAt: new Date(startAt.getTime() + durationDays * DAY_MS) };
}
