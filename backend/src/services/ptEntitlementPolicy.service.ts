export const PT_ABSENCE_EARLY_MS = 2 * 60 * 60 * 1000;
export const PT_RENEWAL_GRACE_DAYS = 30;

export type PtCreditSource = 'MEMBERSHIP_GIFT' | 'PACKAGE_PURCHASE' | 'SINGLE_PURCHASE' | string;
export type PtAbsenceOutcome = 'RELEASE' | 'MAKEUP' | 'DEBIT';

export const isPaidPtSource = (source: string | null | undefined) =>
  source === 'PACKAGE_PURCHASE' || source === 'SINGLE_PURCHASE';

export function protectedAbsenceLimit(source: PtCreditSource, initialCount: number) {
  if (source === 'MEMBERSHIP_GIFT') return 1;
  if (source === 'SINGLE_PURCHASE') return 1;
  if (source === 'PACKAGE_PURCHASE') return Math.min(3, Math.max(1, initialCount));
  return 0;
}

export function decidePtAbsence(input: {
  source?: PtCreditSource | null;
  initialCount?: number;
  protectedUsed: number;
  startTime: Date;
  now: Date;
  isMakeup: boolean;
  coachAbsence: boolean;
  legacyMakeupRemaining?: boolean;
}) {
  const protectedMax = input.source
    ? protectedAbsenceLimit(input.source, input.initialCount ?? 0)
    : 0;
  const early = input.startTime.getTime() - input.now.getTime() >= PT_ABSENCE_EARLY_MS;
  let outcome: PtAbsenceOutcome = 'DEBIT';
  if (input.coachAbsence) outcome = 'MAKEUP';
  else if (early && !input.isMakeup) {
    if (input.source && input.protectedUsed < protectedMax) outcome = 'RELEASE';
    else if (!input.source && input.legacyMakeupRemaining) outcome = 'MAKEUP';
  }
  const message = input.coachAbsence
    ? 'Coach báo vắng: hội viên được đặt học bù trong 7 ngày và không mất Credit.'
    : outcome === 'RELEASE'
      ? 'Hủy sớm hợp lệ: Credit trở về đúng lô ban đầu, không cấp thêm buổi và vẫn giữ hạn sử dụng cũ.'
      : outcome === 'MAKEUP'
        ? 'Báo vắng hợp lệ: được đặt học bù trong 7 ngày.'
        : !early ? 'Báo dưới 2 giờ trước buổi tập: mất 1 Credit.'
          : input.isMakeup ? 'Buổi học bù không được bảo lưu lần nữa: mất 1 Credit.'
            : 'Đã hết lượt hủy được bảo lưu: mất 1 Credit.';
  return { outcome, early, protectedUsed: input.protectedUsed, protectedMax, message };
}
