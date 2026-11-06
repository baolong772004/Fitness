import type { Response } from 'express';
import prisma from '../config/prisma.js';
import type { AuthRequest } from '../middlewares/auth.middleware.js';
import { decidePtAttendanceByAdmin, decidePtAttendanceByCoach } from '../services/ptAttendance.service.js';
import { PtBookingError } from '../services/ptBooking.service.js';
import { assignMakeupCoach } from '../services/ptMakeupAdmin.service.js';
import { listMakeupCoachOptions, rejectMakeupCoachChoice, submitMakeupCoachChoice } from '../services/ptMakeupCoachChoice.service.js';

function fail(res: Response, error: unknown) {
  if (error instanceof PtBookingError) return res.status(error.status).json({ success: false, message: error.message });
  console.error('PT operations error:', error);
  return res.status(500).json({ success: false, message: 'Không thể xử lý buổi PT.' });
}

export async function coachAttendanceDecision(req: AuthRequest, res: Response) {
  const bookingId = Number(req.params.id);
  const decision = req.body?.decision;
  const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';
  if (!Number.isSafeInteger(bookingId) || bookingId <= 0 ||
    !['ATTENDED', 'NO_SHOW'].includes(decision) || note.length > 500) {
    return res.status(400).json({ success: false, message: 'Cần booking, quyết định điểm danh và ghi chú hợp lệ.' });
  }
  try {
    const data = await decidePtAttendanceByCoach({ bookingId, coachId: req.user!.userId, decision, note });
    return res.json({ success: true, data });
  } catch (error) { return fail(res, error); }
}

export async function adminAttendanceDecision(req: AuthRequest, res: Response) {
  const bookingId = Number(req.params.id);
  const decision = req.body?.decision;
  const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';
  if (!Number.isSafeInteger(bookingId) || bookingId <= 0 ||
    !['ATTENDED', 'NO_SHOW', 'EXCUSED'].includes(decision) || !note || note.length > 500) {
    return res.status(400).json({ success: false, message: 'Cần quyết định và lý do đối soát tối đa 500 ký tự.' });
  }
  try {
    const data = await decidePtAttendanceByAdmin({ bookingId, adminId: req.user!.userId, decision, note });
    return res.json({ success: true, data });
  } catch (error) { return fail(res, error); }
}

export async function listPtOperations(req: AuthRequest, res: Response) {
  const [attendance, makeup, legacy, legacyCount] = await Promise.all([
    prisma.ptAttendanceReview.findMany({ where: { status: 'PENDING_ADMIN' },
      include: { booking: { select: { id: true, memberId: true, coachId: true, startTime: true } } },
      orderBy: { deadlineAt: 'asc' }, take: 100 }),
    prisma.makeUpRequest.findMany({ where: { OR: [{ status: 'ESCALATED' },
      { status: 'PENDING', escalatedAt: { not: null } }] },
      include: { originalBooking: { select: { memberId: true, coachId: true, startTime: true,
        member: { select: { fullName: true } }, coach: { select: { fullName: true } },
        membership: { select: { package: { select: { ptLevel: true } } } },
        ptCreditAllocation: { include: { batch: { select: { level: true } } } } } },
        events: { orderBy: { createdAt: 'desc' }, take: 5,
          select: { action: true, details: true, createdAt: true } } },
      orderBy: { createdAt: 'asc' }, take: 100 }),
    req.user?.role === 'ADMIN' ? prisma.ptCreditBatch.findMany({ where: { source: 'LEGACY_PT' },
      select: { id: true, wallet: { select: { memberId: true } }, membershipId: true,
        paymentId: true, level: true, initialCount: true, usedCount: true, heldCount: true,
        membership: { select: { package: { select: { type: true, name: true,
          totalPtSessions: true } } } } },
      orderBy: { id: 'asc' }, take: 100 }) : Promise.resolve([]),
    req.user?.role === 'ADMIN' ? prisma.ptCreditBatch.count({ where: { source: 'LEGACY_PT' } }) : Promise.resolve(0),
  ]);
  const requestedCoaches = await prisma.user.findMany({ where: { id: {
    in: makeup.flatMap(row => row.requestedCoachId ? [row.requestedCoachId] : []),
  } }, select: { id: true, fullName: true } });
  const coachNames = new Map(requestedCoaches.map(row => [row.id, row.fullName]));
  return res.json({ success: true, data: { attendance,
    makeup: makeup.map(row => ({ ...row,
      requestedCoachName: row.requestedCoachId ? coachNames.get(row.requestedCoachId) ?? null : null })),
    legacy, legacyCount } });
}

export async function memberRequestMakeupCoachChange(req: AuthRequest, res: Response) {
  const requestId = Number(req.params.id);
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
  const coachId = Number(req.body?.coachId);
  if (!Number.isSafeInteger(requestId) || requestId <= 0 || !reason || reason.length > 500 ||
    !Number.isSafeInteger(coachId) || coachId <= 0) {
    return res.status(400).json({ success: false,
      message: 'Cần quyền học bù, HLV và lý do (tối đa 500 ký tự).' });
  }
  try {
    const data = await submitMakeupCoachChoice({ requestId,
      memberId: req.user!.userId, coachId, reason });
    return res.json({ success: true, data,
      message: 'Đã chuyển đề nghị đổi HLV học bù cho Admin. Credit vẫn được giữ.' });
  } catch (error) { return fail(res, error); }
}

export async function memberMakeupCoachOptions(req: AuthRequest, res: Response) {
  const requestId = Number(req.params.id);
  if (!Number.isSafeInteger(requestId) || requestId <= 0)
    return res.status(400).json({ success: false, message: 'Quyền học bù không hợp lệ.' });
  try {
    const data = await listMakeupCoachOptions({ requestId, memberId: req.user!.userId });
    return res.json({ success: true, data });
  } catch (error) { return fail(res, error); }
}

export async function adminReviewMakeupCoachChange(req: AuthRequest, res: Response) {
  const requestId = Number(req.params.id);
  const decision = req.body?.decision;
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
  const suggestedCoachId = req.body?.suggestedCoachId == null ? undefined : Number(req.body.suggestedCoachId);
  if (!Number.isSafeInteger(requestId) || requestId <= 0 ||
    !['APPROVED', 'REJECTED'].includes(decision) || !reason || reason.length > 500 ||
    (suggestedCoachId !== undefined && (!Number.isSafeInteger(suggestedCoachId) || suggestedCoachId <= 0)))
    return res.status(400).json({ success: false, message: 'Cần quyết định và lý do xử lý hợp lệ.' });
  try {
    if (decision === 'REJECTED') {
      const data = await rejectMakeupCoachChoice({ requestId, adminId: req.user!.userId,
        reason, suggestedCoachId });
      return res.json({ success: true, data });
    }
    const right = await prisma.makeUpRequest.findUnique({ where: { id: requestId },
      select: { requestedCoachId: true } });
    if (!right?.requestedCoachId) throw new PtBookingError(409, 'Không có HLV do hội viên chọn đang chờ duyệt.');
    const data = await assignMakeupCoach({ requestId, coachId: right.requestedCoachId,
      adminId: req.user!.userId, reason, approval: true });
    return res.json({ success: true, data });
  } catch (error) { return fail(res, error); }
}

export async function adminAssignMakeupCoach(req: AuthRequest, res: Response) {
  const requestId = Number(req.params.id);
  const coachId = Number(req.body?.coachId);
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
  if (!Number.isSafeInteger(requestId) || requestId <= 0 ||
    !Number.isSafeInteger(coachId) || coachId <= 0 || !reason || reason.length > 500) {
    return res.status(400).json({ success: false, message: 'Cần quyền bù, Coach mới và lý do tối đa 500 ký tự.' });
  }
  try {
    const data = await assignMakeupCoach({ requestId, coachId, adminId: req.user!.userId, reason });
    return res.json({ success: true, data });
  } catch (error) { return fail(res, error); }
}
