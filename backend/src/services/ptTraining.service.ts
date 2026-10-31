import type { Prisma, PrismaClient } from '@prisma/client';

type Db = Prisma.TransactionClient | PrismaClient;
export const PAID_PT_LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] as const;
export type PaidPtLevel = typeof PAID_PT_LEVELS[number];
export const isPaidPtLevel = (value: unknown): value is PaidPtLevel =>
  PAID_PT_LEVELS.includes(value as PaidPtLevel);

export const ptTrainingPolicy: Record<PaidPtLevel, { reviewEverySessions: number }> = {
  BEGINNER: { reviewEverySessions: 4 },
  INTERMEDIATE: { reviewEverySessions: 3 },
  ADVANCED: { reviewEverySessions: 2 },
};

export async function coachHasPaidPtLevel(db: Db, coachId: number, memberId: number, level: PaidPtLevel) {
  const now = new Date();
  const [batches, membership] = await Promise.all([
    db.ptCreditBatch.findMany({ where: { wallet: { memberId }, coachId, level,
      source: { in: ['PACKAGE_PURCHASE', 'SINGLE_PURCHASE'] },
      OR: [{ startAt: null }, { startAt: { lte: now } }],
      AND: [{ OR: [{ endAt: null }, { endAt: { gt: now } }] }],
    }, select: { initialCount: true, usedCount: true } }),
    db.membership.findFirst({
      where: { userId: memberId, coachId, package: { type: 'PT', ptLevel: level },
        status: 'ACTIVE', startDate: { lte: now }, endDate: { gt: now } },
      select: { id: true },
    }),
  ]);
  return batches.some(batch => batch.initialCount > batch.usedCount) || Boolean(membership);
}

export async function activeCoachPtLevel(db: Db, coachId: number, memberId: number, now = new Date()) {
  const paidBatches = await db.ptCreditBatch.findMany({ where: {
    wallet: { memberId }, coachId, source: { in: ['PACKAGE_PURCHASE', 'SINGLE_PURCHASE'] },
    level: { in: [...PAID_PT_LEVELS] },
    OR: [{ startAt: null }, { startAt: { lte: now } }],
    AND: [{ OR: [{ endAt: null }, { endAt: { gt: now } }] }],
  }, select: { level: true, initialCount: true, usedCount: true }, orderBy: { grantedAt: 'desc' } });
  const paidLevel = paidBatches.find(batch => batch.initialCount > batch.usedCount)?.level;
  if (isPaidPtLevel(paidLevel)) return paidLevel;
  const booking = await db.booking.findFirst({
    where: { memberId, coachId, type: 'PT', status: { in: ['CONFIRMED', 'IN_PROGRESS', 'MAKEUP_BOOKED'] }, endTime: { gt: now } },
    include: { ptCreditAllocation: { include: { batch: { select: { level: true } } } },
      membership: { include: { package: { select: { ptLevel: true } } } } },
    orderBy: { startTime: 'desc' },
  });
  const bookingLevel = booking?.ptCreditAllocation?.batch.level ?? booking?.membership?.package.ptLevel;
  if (isPaidPtLevel(bookingLevel)) return bookingLevel;
  const membership = await db.membership.findFirst({
    where: { userId: memberId, coachId, status: 'ACTIVE', startDate: { lte: now }, endDate: { gt: now },
      package: { type: 'PT', ptLevel: { in: [...PAID_PT_LEVELS] } } },
    select: { package: { select: { ptLevel: true } } },
    orderBy: { startDate: 'desc' },
  });
  return isPaidPtLevel(membership?.package.ptLevel) ? membership.package.ptLevel : null;
}

export class PtAssessmentError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

function optionalText(value: unknown, max: number, field: string) {
  if (value == null || value === '') return null;
  if (typeof value !== 'string' || value.trim().length > max) {
    throw new PtAssessmentError(400, `${field} tối đa ${max} ký tự.`);
  }
  return value.trim() || null;
}

export function normalizeAssessment(input: any) {
  const level = input?.level;
  const kind = input?.kind;
  if (!isPaidPtLevel(level) || !['BASELINE', 'REVIEW'].includes(kind)) {
    throw new PtAssessmentError(400, 'Cấp độ hoặc loại đánh giá PT không hợp lệ.');
  }
  const goal = optionalText(input.goal, 500, 'Mục tiêu');
  const movementNotes = optionalText(input.movementNotes, 2000, 'Nhận xét kỹ thuật');
  const metricName = optionalText(input.metricName, 100, 'Tên chỉ số');
  const phaseName = optionalText(input.phaseName, 100, 'Giai đoạn');
  const nextSteps = optionalText(input.nextSteps, 2000, 'Bước tiếp theo');
  const metricValue = input.metricValue === '' || input.metricValue == null ? null : Number(input.metricValue);
  if (metricValue !== null && !Number.isFinite(metricValue)) {
    throw new PtAssessmentError(400, 'Giá trị chỉ số không hợp lệ.');
  }
  if (kind === 'BASELINE' && !goal) throw new PtAssessmentError(400, 'Cần ghi mục tiêu ban đầu của học viên.');
  if (!nextSteps) throw new PtAssessmentError(400, 'Cần ghi bước tập luyện tiếp theo.');
  if (level === 'BEGINNER' && !movementNotes) {
    throw new PtAssessmentError(400, 'Cấp Cơ bản cần đánh giá kỹ thuật và khả năng vận động.');
  }
  if (level !== 'BEGINNER' && (!metricName || metricValue === null)) {
    throw new PtAssessmentError(400, 'Cấp Trung cấp và Nâng cao cần một chỉ số đo tiến bộ.');
  }
  if (level === 'ADVANCED' && !phaseName) {
    throw new PtAssessmentError(400, 'Cấp Nâng cao cần xác định giai đoạn tập luyện.');
  }
  return { level, kind: kind as 'BASELINE' | 'REVIEW', goal, movementNotes,
    metricName, metricValue, phaseName, nextSteps };
}
