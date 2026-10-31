import { Prisma, type PrismaClient } from '@prisma/client';
import { normalizeWorkoutPlanContent, presentWorkoutPlan } from './workoutPlan.service.js';
import { activeCoachPtLevel } from './ptTraining.service.js';

type Db = Prisma.TransactionClient | PrismaClient;
export type PlanActor = { userId: number; role: string };
export class WorkoutPlanError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function planId(value: unknown) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) throw new WorkoutPlanError(400, 'Mã giáo án hoặc học viên không hợp lệ');
  return id;
}

export function normalizePlanDraft(body: any) {
  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  const description = body?.description == null ? '' : body.description;
  if (!title || title.length > 200 || typeof description !== 'string' || description.trim().length > 5000) {
    throw new WorkoutPlanError(400, 'Tên giáo án tối đa 200 ký tự, mục tiêu tối đa 5000 ký tự');
  }
  if (!Array.isArray(body.sessions) || body.sessions.length === 0) {
    throw new WorkoutPlanError(400, 'Giáo án cần ít nhất một buổi tập');
  }
  try {
    return { title, description: description.trim(), ...normalizeWorkoutPlanContent(body) };
  } catch (error) {
    throw new WorkoutPlanError(400, error instanceof Error ? error.message : 'Nội dung giáo án không hợp lệ');
  }
}

export function normalizeProgramName(value: unknown) {
  if (value === undefined) return 'PT';
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 120) {
    throw new WorkoutPlanError(400, 'Tên chương trình cần từ 1 đến 120 ký tự');
  }
  return value.trim().replace(/\s+/g, ' ').toLocaleUpperCase('vi-VN');
}

export function revisionReason(value: unknown) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 1000) {
    throw new WorkoutPlanError(400, 'Nhập lý do cập nhật từ 1 đến 1000 ký tự');
  }
  return value.trim();
}

export const studentPlanInclude = {
  member: { select: { id: true, fullName: true } },
  coach: { select: { id: true, fullName: true } },
} satisfies Prisma.StudentWorkoutPlanInclude;

export function presentStudentPlan<T extends { sessionsJson: string; mealsJson: string }>(plan: T) {
  return { ...presentWorkoutPlan(plan), kind: 'ASSIGNED' as const };
}

export async function hasValidTrainingRelation(db: Db, coachId: number, memberId: number, now = new Date()) {
  const paidBatches = await db.ptCreditBatch.findMany({ where: {
    wallet: { memberId }, coachId, source: { in: ['PACKAGE_PURCHASE', 'SINGLE_PURCHASE'] },
    OR: [{ startAt: null }, { startAt: { lte: now } }],
    AND: [{ OR: [{ endAt: null }, { endAt: { gt: now } }] }],
  }, select: { initialCount: true, usedCount: true } });
  if (paidBatches.some(batch => batch.initialCount > batch.usedCount)) return true;
  const booking = await db.booking.findFirst({
    where: { memberId, coachId, type: 'PT', status: { in: ['CONFIRMED', 'IN_PROGRESS', 'MAKEUP_BOOKED'] }, endTime: { gt: now } },
    select: { id: true },
  });
  if (booking) return true;
  return !!await db.membership.findFirst({
    where: { userId: memberId, coachId, package: { type: 'PT' }, status: 'ACTIVE',
      startDate: { lte: now }, endDate: { gt: now },
      OR: [{ remainingSessions: null }, { remainingSessions: { gt: 0 } }] },
    select: { id: true },
  });
}

// A separate lock namespace serializes plan changes without settling, reserving,
// releasing or otherwise changing PT credits or booking state.
async function lockStudentPlans(tx: Prisma.TransactionClient, memberId: number) {
  const rows = await tx.$queryRaw<Array<{ result: number }>>`
    SET NOCOUNT ON;
    DECLARE @result int;
    EXEC @result = sp_getapplock @Resource = ${`student-workout-plan:${memberId}`},
      @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 10000;
    SELECT @result AS result;
  `;
  if (rows.length !== 1 || rows[0].result < 0) throw new WorkoutPlanError(409, 'Giáo án đang được cập nhật, vui lòng thử lại');
}

function canEdit(actor: PlanActor, coachId: number) {
  if (actor.role !== 'ADMIN' && (!['COACH', 'TRAINER'].includes(actor.role) || actor.userId !== coachId)) {
    throw new WorkoutPlanError(403, 'Bạn không có quyền chỉnh sửa giáo án này');
  }
}

export async function assertPlanAccess(db: Db, id: number, actor: PlanActor, editing = false) {
  const plan = await db.studentWorkoutPlan.findUnique({ where: { id } });
  if (!plan) throw new WorkoutPlanError(404, 'Không tìm thấy giáo án của học viên');
  if (!editing && actor.role === 'MEMBER' && actor.userId === plan.memberId) return plan;
  canEdit(actor, plan.coachId);
  if (editing && actor.role !== 'ADMIN' && !await hasValidTrainingRelation(db, plan.coachId, plan.memberId)) {
    throw new WorkoutPlanError(403, 'Quan hệ PT với học viên đã kết thúc');
  }
  return plan;
}

const snapshot = (plan: { title: string; description: string | null; sessionsJson: string; mealsJson: string }) => ({
  title: plan.title, description: plan.description, sessionsJson: plan.sessionsJson, mealsJson: plan.mealsJson,
});

export async function assignStudentPlan(tx: Prisma.TransactionClient, input: {
  coachId: number; memberId: number; workoutPlanId?: number; programName?: unknown;
  content: ReturnType<typeof normalizePlanDraft>;
}) {
  const programName = normalizeProgramName(input.programName);
  await lockStudentPlans(tx, input.memberId);
  const coach = await tx.coachProfile.findUnique({ where: { userId: input.coachId }, select: { status: true } });
  if (!coach || coach.status !== 'ACTIVE') throw new WorkoutPlanError(403, 'Hồ sơ Coach không còn hoạt động');
  if (!await hasValidTrainingRelation(tx, input.coachId, input.memberId)) {
    throw new WorkoutPlanError(403, 'Học viên cần có gói PT còn hiệu lực hoặc Booking PT đã xác nhận với Coach này');
  }
  const level = await activeCoachPtLevel(tx, input.coachId, input.memberId);
  if (level) {
    const baseline = await tx.ptTrainingAssessment.findFirst({
      where: { memberId: input.memberId, coachId: input.coachId, level, kind: 'BASELINE' },
      select: { id: true },
    });
    if (!baseline) throw new WorkoutPlanError(409, 'Cần ghi đánh giá PT đầu vào trước khi gán giáo án cho học viên.');
  }
  await tx.studentWorkoutPlan.updateMany({
    where: { memberId: input.memberId, coachId: input.coachId, programName, status: 'ACTIVE' },
    data: { status: 'ARCHIVED' },
  });
  const plan = await tx.studentWorkoutPlan.create({
    data: { coachId: input.coachId, memberId: input.memberId, workoutPlanId: input.workoutPlanId,
      programName, ...input.content,
      revisions: { create: { version: 1, ...snapshot(input.content), changedById: input.coachId, reason: 'Gán giáo án cho học viên' } } },
    include: studentPlanInclude,
  });
  const notification = await tx.notification.create({ data: { userId: input.memberId,
    title: 'Bạn có giáo án PT mới', message: `HLV đã giao giáo án "${plan.title}" (${programName}). Mở Giáo án & Dinh dưỡng để xem.` } });
  return { plan: presentStudentPlan(plan), notification };
}

export async function reviseStudentPlan(tx: Prisma.TransactionClient, input: {
  id: number; actor: PlanActor; expectedVersion: unknown; reason: unknown;
  draft?: unknown; restoreRevisionId?: number;
}) {
  const initial = await assertPlanAccess(tx, input.id, input.actor, true);
  await lockStudentPlans(tx, initial.memberId);
  const plan = await assertPlanAccess(tx, input.id, input.actor, true);
  if (plan.status !== 'ACTIVE') throw new WorkoutPlanError(409, 'Giáo án đã lưu trữ; hãy gán lại giáo án để áp dụng cho học viên');
  if (!Number.isSafeInteger(input.expectedVersion) || input.expectedVersion !== plan.version) {
    throw new WorkoutPlanError(409, 'Giáo án đã có phiên bản mới. Tải lại trước khi chỉnh sửa');
  }
  let content: ReturnType<typeof normalizePlanDraft>;
  const reason = revisionReason(input.reason);
  if (input.restoreRevisionId !== undefined) {
    const revision = await tx.workoutPlanRevision.findFirst({ where: { id: input.restoreRevisionId, studentPlanId: plan.id } });
    if (!revision) throw new WorkoutPlanError(404, 'Phiên bản không thuộc giáo án này');
    content = snapshot(revision) as ReturnType<typeof normalizePlanDraft>;
  } else content = normalizePlanDraft(input.draft);
  const version = plan.version + 1;
  const updated = await tx.studentWorkoutPlan.update({ where: { id: plan.id }, data: {
    ...content, version, revisions: { create: { ...content, version, reason, changedById: input.actor.userId } },
  }, include: studentPlanInclude });
  const notification = await tx.notification.create({ data: { userId: plan.memberId,
    title: 'Giáo án PT đã được cập nhật', message: `Giáo án "${updated.title}" đã cập nhật lên phiên bản ${version}. Mở Giáo án & Dinh dưỡng để xem.` } });
  return { plan: presentStudentPlan(updated), notification };
}
