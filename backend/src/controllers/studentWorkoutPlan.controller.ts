import type { Response } from 'express';
import prisma from '../config/prisma.js';
import type { AuthRequest } from '../middlewares/auth.middleware.js';
import { emitUserNotification } from '../sockets/ptChat.socket.js';
import { presentWorkoutPlan } from '../services/workoutPlan.service.js';
import { assertPlanAccess, assignStudentPlan, normalizePlanDraft, planId, reviseStudentPlan, WorkoutPlanError } from '../services/studentWorkoutPlan.service.js';

export function workoutPlanResponseError(error: unknown, res: Response) {
  if (error instanceof WorkoutPlanError) return res.status(error.status).json({ success: false, message: error.message });
  const code = (error as { code?: string })?.code;
  if (code === 'P2002' || code === 'P2034') return res.status(409).json({ success: false, message: 'Giáo án đang được cập nhật. Tải lại và thử lại.' });
  if (code === 'P2021' || code === 'P2022') return res.status(503).json({ success: false, message: 'Cơ sở dữ liệu chưa cập nhật chức năng giáo án. Chạy prisma migrate deploy trong backend.' });
  console.error('Workout plan error:', error);
  return res.status(500).json({ success: false, message: 'Không thể xử lý giáo án. Vui lòng thử lại.' });
}

export async function assignCoachPlan(req: AuthRequest, res: Response) {
  if (!req.user) return res.status(401).json({ success: false, message: 'Chưa đăng nhập' });
  try {
    const id = planId(req.params.id);
    const memberId = planId(req.body?.memberId);
    const result = await prisma.$transaction(async tx => {
      const source = await tx.workoutPlan.findFirst({ where: { id, coachId: req.user!.userId, memberId: null } });
      if (!source) throw new WorkoutPlanError(404, 'Không tìm thấy giáo án mẫu của bạn');
      const content = normalizePlanDraft(presentWorkoutPlan(source));
      return assignStudentPlan(tx, { coachId: req.user!.userId, memberId, workoutPlanId: source.id, content, programName: req.body?.programName });
    });
    emitUserNotification(memberId, result.notification);
    return res.status(201).json({ success: true, message: 'Đã gán giáo án cho học viên', data: result.plan });
  } catch (error) { return workoutPlanResponseError(error, res); }
}

export async function updateStudentPlan(req: AuthRequest, res: Response) {
  if (!req.user) return res.status(401).json({ success: false, message: 'Chưa đăng nhập' });
  try {
    const result = await prisma.$transaction(tx => reviseStudentPlan(tx, { id: planId(req.params.id), actor: req.user!,
      expectedVersion: req.body?.expectedVersion, reason: req.body?.changeReason, draft: req.body }));
    emitUserNotification(result.plan.memberId, result.notification);
    return res.json({ success: true, message: 'Đã cập nhật giáo án cho học viên', data: result.plan });
  } catch (error) { return workoutPlanResponseError(error, res); }
}

export async function restoreStudentPlan(req: AuthRequest, res: Response) {
  if (!req.user) return res.status(401).json({ success: false, message: 'Chưa đăng nhập' });
  try {
    const result = await prisma.$transaction(tx => reviseStudentPlan(tx, { id: planId(req.params.id), actor: req.user!,
      expectedVersion: req.body?.expectedVersion, reason: req.body?.changeReason, restoreRevisionId: planId(req.body?.revisionId) }));
    emitUserNotification(result.plan.memberId, result.notification);
    return res.json({ success: true, message: 'Đã khôi phục nội dung thành phiên bản mới', data: result.plan });
  } catch (error) { return workoutPlanResponseError(error, res); }
}

export async function getStudentPlanRevisions(req: AuthRequest, res: Response) {
  if (!req.user) return res.status(401).json({ success: false, message: 'Chưa đăng nhập' });
  try {
    const id = planId(req.params.id);
    await assertPlanAccess(prisma, id, req.user);
    const revisions = await prisma.workoutPlanRevision.findMany({ where: { studentPlanId: id },
      include: { changedBy: { select: { id: true, fullName: true } } }, orderBy: { version: 'desc' } });
    return res.json({ success: true, data: revisions.map(presentWorkoutPlan) });
  } catch (error) { return workoutPlanResponseError(error, res); }
}
