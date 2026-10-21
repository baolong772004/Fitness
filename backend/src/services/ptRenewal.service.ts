export const PT_RENEWAL_GRACE_DAYS = 30;
const DAY_MS = 86400000;

export type RenewablePtBatch = {
  level: string;
  endAt?: Date | null;
  initialCount: number;
  usedCount: number;
};

export function ptRenewalOptionMatchesBatch(
  option: { level: string; ptProductId: number | null },
  batch: { level: string; ptProductId: number | null },
) {
  return option.level === batch.level &&
    (option.ptProductId === null || option.ptProductId === batch.ptProductId);
}

export function ptRenewalError(batch: RenewablePtBatch, now = new Date()): string | null {
  if (!['BEGINNER', 'INTERMEDIATE', 'ADVANCED'].includes(batch.level) || !batch.endAt) {
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
