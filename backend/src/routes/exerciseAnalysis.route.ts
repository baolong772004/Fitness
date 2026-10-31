import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import multer from 'multer';
import prisma from '../config/prisma.js';
import { authenticateToken, authorizeRoles, type AuthRequest } from '../middlewares/auth.middleware.js';
import { createExerciseAnalysis, deleteExerciseAnalysis, isSupportedVideo, publicAnalysis, reanalyzeOwnExerciseVideo } from '../services/exerciseAnalysis.service.js';
import { analysisQuota, analysisSummary, parseAnalysisOptions } from '../services/exerciseAnalysis.utils.js';
import { sendAnalysisVideo } from '../services/exerciseAnalysis.media.js';
import { hasValidTrainingRelation } from '../services/studentWorkoutPlan.service.js';
import { exerciseCatalog, exerciseVariants, isExerciseType, publicExercises } from '../services/exerciseAnalysis.catalog.js';
import { summarizeSquatSession } from '../services/exerciseAnalysis.session.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024, files: 1 } });
const recent = new Map<number, number[]>();
const reanalysisRecent = new Map<number, number>();
const includeReview = { shares: { include: { coach: { select: { id: true, fullName: true } } } }, feedback: { include: { coach: { select: { id: true, fullName: true } } }, orderBy: { createdAt: 'desc' as const } } };
const validId = (value: unknown) => { const id = Number(value); return Number.isSafeInteger(id) && id > 0 ? id : null; };

async function shareableCoaches(memberId: number) {
  const [memberships, batches, plans, bookings] = await Promise.all([
    prisma.membership.findMany({ where: { userId: memberId, coachId: { not: null }, package: { type: 'PT' } }, select: { coachId: true } }),
    prisma.ptCreditBatch.findMany({ where: { wallet: { memberId }, coachId: { not: null } }, select: { coachId: true } }),
    prisma.studentWorkoutPlan.findMany({ where: { memberId }, select: { coachId: true } }),
    prisma.booking.findMany({ where: { memberId, type: 'PT', status: { in: ['CONFIRMED', 'IN_PROGRESS', 'MAKEUP_BOOKED'] }, endTime: { gt: new Date() } }, select: { coachId: true } }),
  ]);
  const ids = [...new Set([...memberships, ...batches, ...plans, ...bookings].map(row => row.coachId).filter((id): id is number => id != null))];
  const coaches = await prisma.user.findMany({ where: { id: { in: ids }, role: { in: ['COACH', 'TRAINER'] }, coachProfile: { is: { status: 'ACTIVE' } } }, select: { id: true, fullName: true } });
  const valid = await Promise.all(coaches.map(async coach => await hasValidTrainingRelation(prisma, coach.id, memberId) ? coach : null));
  return valid.filter((coach): coach is { id: number; fullName: string } => coach != null);
}

router.use(authenticateToken);
router.post('/developer', authorizeRoles('ADMIN', 'COACH', 'TRAINER'), (req, res, next) => upload.single('video')(req, res, error => {
  if (error) return res.status(400).json({ success: false, code: error.code || 'INVALID_FILE', message: 'Video không hợp lệ hoặc vượt quá 25 MB.' });
  next();
}), async (req: AuthRequest, res, next) => {
  try {
    if (process.env.NODE_ENV === 'production' || process.env.AI_EXPERIMENTAL_EVALUATION !== 'true') return res.status(404).json({ success: false, message: 'Developer evaluation is unavailable.' });
    if (['COACH', 'TRAINER'].includes(req.user!.role)) {
      const profile = await prisma.coachProfile.findUnique({ where: { userId: req.user!.userId }, select: { status: true } });
      if (profile?.status !== 'ACTIVE') return res.status(403).json({ success: false, message: 'Hồ sơ Coach không còn hoạt động.' });
    }
    if (!isExerciseType(req.body.exerciseType) || !exerciseVariants[req.body.exerciseType].includes(req.body.exerciseVariant)) return res.status(400).json({ success: false, message: 'Bài tập hoặc biến thể không hợp lệ.' });
    if (req.body.consent !== 'true' || !req.file || !isSupportedVideo(req.file.buffer)) return res.status(400).json({ success: false, message: 'Cần đồng ý phân tích và chọn video hợp lệ.' });
    let options;
    try { options = parseAnalysisOptions(req.body.analysisOptions); }
    catch { return res.status(400).json({ success: false, message: 'Tùy chọn phân tích không hợp lệ.' }); }
    const row = await createExerciseAnalysis(req.user!.userId, req.file.buffer, undefined, options, req.body.exerciseType, undefined, req.body.exerciseVariant, 'EXPERIMENTAL', req.body);
    return res.status(202).json({ success: true, data: publicAnalysis(row) });
  } catch (error) { if (error instanceof Error && error.message === 'INVALID_VIDEO_PROVENANCE') return res.status(400).json({ success: false, code: error.message }); next(error); }
});
router.get('/developer', authorizeRoles('ADMIN', 'COACH', 'TRAINER'), async (req: AuthRequest, res, next) => {
  try {
    if (process.env.NODE_ENV === 'production' || process.env.AI_EXPERIMENTAL_EVALUATION !== 'true') return res.status(404).json({ success: false, message: 'Developer evaluation is unavailable.' });
    const rows = await prisma.exerciseAnalysis.findMany({ where: { memberId: req.user!.userId, evaluationMode: 'EXPERIMENTAL' }, orderBy: { createdAt: 'desc' }, take: 30 });
    res.json({ success: true, data: rows.map(analysisSummary) });
  } catch (error) { next(error); }
});
router.post('/developer/:id/reanalyze', authorizeRoles('ADMIN', 'COACH', 'TRAINER'), async (req: AuthRequest, res, next) => {
  try {
    if (process.env.NODE_ENV === 'production' || process.env.AI_EXPERIMENTAL_EVALUATION !== 'true') return res.status(404).json({ success: false, message: 'Developer evaluation is unavailable.' });
    const id = validId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'ID không hợp lệ.' });
    const row = await reanalyzeOwnExerciseVideo(id, req.user!.userId);
    if (!row) return res.status(410).json({ success: false, message: 'Video thử nghiệm không còn lưu hoặc không thuộc tài khoản của bạn. Hãy tải lại video.' });
    res.status(202).json({ success: true, data: publicAnalysis(row) });
  } catch (error) { next(error); }
});
router.get('/developer/:id', authorizeRoles('ADMIN', 'COACH', 'TRAINER'), async (req: AuthRequest, res, next) => {
  try {
    if (process.env.NODE_ENV === 'production' || process.env.AI_EXPERIMENTAL_EVALUATION !== 'true') return res.status(404).json({ success: false, message: 'Developer evaluation is unavailable.' });
    const id = validId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'ID không hợp lệ.' });
    const row = await prisma.exerciseAnalysis.findFirst({ where: { id, memberId: req.user!.userId, evaluationMode: 'EXPERIMENTAL' } });
    if (!row) return res.status(404).json({ success: false, message: 'Không tìm thấy kết quả thử nghiệm.' });
    res.json({ success: true, data: publicAnalysis(row) });
  } catch (error) { next(error); }
});
router.get('/developer/:id/video', authorizeRoles('ADMIN', 'COACH', 'TRAINER'), async (req: AuthRequest, res, next) => {
  try {
    if (process.env.NODE_ENV === 'production' || process.env.AI_EXPERIMENTAL_EVALUATION !== 'true') return res.status(404).json({ success: false, message: 'Developer evaluation is unavailable.' });
    const id = validId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'ID không hợp lệ.' });
    const row = await prisma.exerciseAnalysis.findFirst({ where: { id, memberId: req.user!.userId, evaluationMode: 'EXPERIMENTAL' } });
    if (!row) return res.status(404).json({ success: false, message: 'Không tìm thấy video thử nghiệm.' });
    await sendAnalysisVideo(row, res, next);
  } catch (error) { next(error); }
});
router.delete('/developer/:id', authorizeRoles('ADMIN', 'COACH', 'TRAINER'), async (req: AuthRequest, res, next) => {
  try {
    if (process.env.NODE_ENV === 'production' || process.env.AI_EXPERIMENTAL_EVALUATION !== 'true') return res.status(404).json({ success: false, message: 'Developer evaluation is unavailable.' });
    const id = validId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'ID không hợp lệ.' });
    const deleted = await deleteExerciseAnalysis(id, req.user!.userId, 'EXPERIMENTAL');
    res.status(deleted ? 200 : 404).json({ success: deleted, message: deleted ? 'Đã xóa kết quả thử nghiệm và video.' : 'Không tìm thấy kết quả thử nghiệm.' });
  } catch (error) { next(error); }
});
router.get('/supported-exercises', (_req, res) => res.json({ success: true, data: publicExercises }));
router.use(authorizeRoles('MEMBER'));
router.post('/sessions', async (req: AuthRequest, res, next) => {
  try {
    const frontId = validId(req.body?.frontAnalysisId);
    const sideId = validId(req.body?.sideAnalysisId);
    if (!frontId || !sideId || frontId === sideId || req.body?.samePersonSessionConfirmed !== true) {
      return res.status(400).json({ success: false, code: 'TWO_CLIPS_AND_EXPLICIT_SAME_SESSION_CONFIRMATION_REQUIRED' });
    }
    const sessionGroupId = randomUUID();
    const rows = await prisma.$transaction(async tx => {
      const found = await tx.exerciseAnalysis.findMany({ where: { id: { in: [frontId, sideId] }, memberId: req.user!.userId,
        evaluationMode: 'OFFICIAL', exerciseType: 'SQUAT' } });
      if (found.length !== 2) throw new Error('SESSION_CLIPS_NOT_OWNED');
      const byId = new Map(found.map(row => [row.id, row]));
      const front = byId.get(frontId)!;
      const side = byId.get(sideId)!;
      const frontSaved = JSON.parse(front.resultJson || '{}');
      const sideSaved = JSON.parse(side.resultJson || '{}');
      if (frontSaved.exerciseVariant !== 'BODYWEIGHT' || sideSaved.exerciseVariant !== 'BODYWEIGHT' ||
          (frontSaved.cameraView?.requested || frontSaved.requestOptions?.cameraView) !== 'FRONT' ||
          (sideSaved.cameraView?.requested || sideSaved.requestOptions?.cameraView) !== 'SIDE') throw new Error('SESSION_CAMERA_OR_VARIANT_MISMATCH');
      if (!['COMPLETED', 'INSUFFICIENT_DATA', 'NEEDS_REVIEW'].includes(front.status) ||
          !['COMPLETED', 'INSUFFICIENT_DATA', 'NEEDS_REVIEW'].includes(side.status)) throw new Error('SESSION_ANALYSES_NOT_READY');
      if (frontSaved.cameraView?.detected !== 'FRONT' || sideSaved.cameraView?.detected !== 'SIDE') {
        throw new Error('SESSION_DETECTED_VIEW_MISMATCH');
      }
      if (found.some(row => row.sessionGroupId || row.videoOrigin !== 'USER_UPLOAD' || row.performerDeclaration !== 'SELF_DECLARED' ||
          row.sourceReference || !row.videoSha256 || !row.mediaStorageKey || row.mediaDeletedAt) || front.videoSha256 === side.videoSha256) {
        throw new Error('SESSION_REQUIRES_TWO_DISTINCT_SELF_DECLARED_UPLOADS');
      }
      const updated = await tx.exerciseAnalysis.updateMany({ where: { id: { in: [frontId, sideId] }, memberId: req.user!.userId,
        sessionGroupId: null }, data: { sessionGroupId, samePersonSessionConfirmed: true } });
      if (updated.count !== 2) throw new Error('SESSION_LINK_CONFLICT');
      return tx.exerciseAnalysis.findMany({ where: { memberId: req.user!.userId, sessionGroupId } });
    });
    return res.status(201).json({ success: true, data: { sessionGroupId, ...summarizeSquatSession(rows) } });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('SESSION_')) return res.status(422).json({ success: false, code: error.message });
    next(error);
  }
});
router.get('/sessions/:sessionGroupId', async (req: AuthRequest, res, next) => {
  try {
    const sessionGroupId = String(req.params.sessionGroupId);
    if (!/^[a-f0-9-]{36}$/i.test(sessionGroupId)) return res.status(400).json({ success: false, code: 'INVALID_SESSION_ID' });
    const rows = await prisma.exerciseAnalysis.findMany({ where: { memberId: req.user!.userId,
      sessionGroupId, evaluationMode: 'OFFICIAL', samePersonSessionConfirmed: true } });
    if (rows.length !== 2) return res.status(404).json({ success: false, code: 'SESSION_NOT_FOUND' });
    res.json({ success: true, data: { sessionGroupId, ...summarizeSquatSession(rows) } });
  } catch (error) { next(error); }
});
router.get('/share-options', async (req: AuthRequest, res, next) => {
  try { res.json({ success: true, data: await shareableCoaches(req.user!.userId) }); } catch (error) { next(error); }
});

router.post('/:id/reanalyze', async (req: AuthRequest, res, next) => {
  try {
    const id = validId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'ID không hợp lệ.' });
    const now = Date.now();
    if (now - (reanalysisRecent.get(id) || 0) < 60 * 60_000) return res.status(429).json({ success: false, message: 'Video này vừa được phân tích lại. Hãy mở kết quả mới trong lịch sử.' });
    const row = await reanalyzeOwnExerciseVideo(id, req.user!.userId, 'OFFICIAL');
    if (!row) return res.status(410).json({ success: false, message: 'Video không còn lưu hoặc kết quả đã dùng phiên bản phân tích mới nhất.' });
    reanalysisRecent.set(id, now);
    res.status(202).json({ success: true, data: publicAnalysis(row) });
  } catch (error) { next(error); }
});

router.post('/', (req, res, next) => upload.single('video')(req, res, error => {
  if (error) return res.status(400).json({ success: false, code: error.code || 'INVALID_FILE', message: 'Video không hợp lệ hoặc vượt quá 25 MB.' });
  next();
}), async (req: AuthRequest, res, next) => {
  try {
    if (!isExerciseType(req.body.exerciseType)) return res.status(400).json({ success: false, message: 'Bài tập chưa được hỗ trợ.' });
    const exerciseType = req.body.exerciseType;
    const exerciseVariant = typeof req.body.exerciseVariant === 'string' ? req.body.exerciseVariant : 'UNSPECIFIED';
    if (!exerciseVariants[exerciseType].includes(exerciseVariant)) return res.status(400).json({ success: false, message: 'Biến thể bài tập không hợp lệ.' });
    if (req.body.consent !== 'true') return res.status(400).json({ success: false, message: 'Cần đồng ý gửi video để phân tích.' });
    if (!req.file || !isSupportedVideo(req.file.buffer)) return res.status(400).json({ success: false, message: 'Chỉ hỗ trợ video MP4/MOV hoặc WebM hợp lệ.' });
    let analysisOptions;
    try { analysisOptions = parseAnalysisOptions(req.body.analysisOptions); }
    catch { return res.status(400).json({ success: false, message: 'Góc quay hoặc mục tiêu phân tích không hợp lệ.' }); }
    const id = req.user!.userId;
    const now = Date.now();
    const attempts = (recent.get(id) || []).filter(at => now - at < 60 * 60_000);
    if (attempts.length >= 5) return res.status(429).json({ success: false, message: 'Bạn đã gửi quá 5 video trong một giờ. Vui lòng thử lại sau.' });
    attempts.push(now); recent.set(id, attempts);
    let studentPlanId: number | undefined;
    let coachPlanContext: { exerciseName: string; sessionTitle: string; sets: number; reps: number; weightKg: number | null; notes: string } | undefined;
    if (req.body.studentPlanId) {
      const requestedId = validId(req.body.studentPlanId);
      if (!requestedId) return res.status(400).json({ success: false, message: 'Giáo án không hợp lệ.' });
      const plan = await prisma.studentWorkoutPlan.findFirst({ where: { id: requestedId, memberId: id, status: 'ACTIVE' }, select: { id: true, version: true, coachId: true, sessionsJson: true } });
      if (!plan) return res.status(403).json({ success: false, message: 'Bạn không có giáo án đang áp dụng này.' });
      let sessions: any[] = [];
      try { sessions = JSON.parse(plan.sessionsJson); } catch { return res.status(400).json({ success: false, message: 'Giáo án chưa có dữ liệu bài tập hợp lệ.' }); }
      const matches = Array.isArray(sessions) ? sessions.flatMap(session => Array.isArray(session.exercises)
        ? session.exercises.filter((exercise: any) => exerciseCatalog[exerciseType].planName.test(String(exercise.exerciseName || '')))
          .map((exercise: any) => ({ session, exercise })) : []) : [];
      if (!matches.length) return res.status(400).json({ success: false, message: `Giáo án này không có bài ${exerciseCatalog[exerciseType].name}.` });
      const match = matches[0];
      coachPlanContext = { exerciseName: String(match.exercise.exerciseName), sessionTitle: String(match.session.title || ''),
        sets: Number(match.exercise.sets), reps: Number(match.exercise.reps),
        weightKg: typeof match.exercise.weightKg === 'number' ? match.exercise.weightKg : null,
        notes: String(match.exercise.notes || '') };
      Object.assign(coachPlanContext, { planId: plan.id, planVersion: plan.version, coachId: plan.coachId,
        candidateCount: matches.length, targetSource: 'PLAN_CONTEXT_ONLY', appliedTechniqueTargets: [],
        limitation: matches.length > 1 ? 'Giáo án có nhiều bài phù hợp; chưa chọn một hiệp cụ thể để áp mục tiêu.' : 'Giáo án chưa có ngưỡng kỹ thuật dạng cấu trúc; không suy diễn ngưỡng từ ghi chú.' });
      studentPlanId = plan.id;
    }
    const currentTime = new Date();
    const batches = await prisma.ptCreditBatch.findMany({ where: { wallet: { memberId: id }, OR: [{ startAt: null }, { startAt: { lte: currentTime } }], AND: [{ OR: [{ endAt: null }, { endAt: { gt: currentTime } }] }] }, select: { level: true, source: true, initialCount: true, usedCount: true, membership: { select: { status: true, startDate: true, endDate: true } } } });
    const active = batches.filter(batch => batch.initialCount > batch.usedCount && (!batch.membership || (batch.membership.status === 'ACTIVE' && batch.membership.startDate <= currentTime && batch.membership.endDate > currentTime)));
    const paid = active.some(batch => ['PACKAGE_PURCHASE', 'SINGLE_PURCHASE'].includes(batch.source)) || !!await prisma.membership.findFirst({ where: { userId: id, package: { type: 'PT' }, status: 'ACTIVE', startDate: { lte: currentTime }, endDate: { gt: currentTime }, OR: [{ remainingSessions: null }, { remainingSessions: { gt: 0 } }] }, select: { id: true } });
    const trial = !paid && active.some(batch => batch.level === 'TRIAL');
    const quotaKey = paid ? 'AI_FORM_PT_24H_LIMIT' : trial ? 'AI_FORM_TRIAL_24H_LIMIT' : 'AI_FORM_MEMBER_24H_LIMIT';
    const { limit } = analysisQuota({ paid, trial, configured: process.env[quotaKey] });
    const used = await prisma.exerciseAnalysis.count({ where: { memberId: id, createdAt: { gte: new Date(now - 24 * 60 * 60_000) } } });
    if (used >= limit) return res.status(429).json({ success: false, message: `Bạn đã dùng hết ${limit} lượt phân tích trong 24 giờ.` });
    const row = await createExerciseAnalysis(id, req.file.buffer, studentPlanId, analysisOptions, exerciseType, coachPlanContext, exerciseVariant, 'OFFICIAL', req.body);
    return res.status(202).json({ success: true, data: publicAnalysis(row) });
  } catch (error) { if (error instanceof Error && error.message === 'INVALID_VIDEO_PROVENANCE') return res.status(400).json({ success: false, code: error.message }); next(error); }
});

router.get('/my-history', async (req: AuthRequest, res, next) => {
  try {
    const page = Math.max(1, Math.min(1000, Number(req.query.page) || 1));
    const rows = await prisma.exerciseAnalysis.findMany({ where: { memberId: req.user!.userId, evaluationMode: 'OFFICIAL' }, include: includeReview, orderBy: { createdAt: 'desc' }, skip: (page - 1) * 20, take: 20 });
    res.json({ success: true, data: rows.map(analysisSummary), page });
  } catch (error) { next(error); }
});
router.get('/:id', async (req: AuthRequest, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ success: false, message: 'ID không hợp lệ.' });
    const row = await prisma.exerciseAnalysis.findFirst({ where: { id, memberId: req.user!.userId, evaluationMode: 'OFFICIAL' }, include: includeReview });
    if (!row) return res.status(404).json({ success: false, message: 'Không tìm thấy kết quả.' });
    res.json({ success: true, data: publicAnalysis(row) });
  } catch (error) { next(error); }
});
router.get('/:id/video', async (req: AuthRequest, res, next) => {
  try {
    const id = validId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'ID không hợp lệ.' });
    const row = await prisma.exerciseAnalysis.findFirst({ where: { id, memberId: req.user!.userId, evaluationMode: 'OFFICIAL' } });
    if (!row) return res.status(404).json({ success: false, message: 'Không tìm thấy video.' });
    await sendAnalysisVideo(row, res, next);
  } catch (error) { next(error); }
});
router.post('/:id/share', async (req: AuthRequest, res, next) => {
  try {
    const id = validId(req.params.id);
    const coachId = validId(req.body?.coachId);
    if (!id || !coachId) return res.status(400).json({ success: false, message: 'Thông tin chia sẻ không hợp lệ.' });
    const analysis = await prisma.exerciseAnalysis.findFirst({ where: { id, memberId: req.user!.userId, evaluationMode: 'OFFICIAL' } });
    if (!analysis) return res.status(404).json({ success: false, message: 'Không tìm thấy kết quả.' });
    if (!['COMPLETED', 'INSUFFICIENT_DATA', 'NEEDS_REVIEW'].includes(analysis.status)) return res.status(409).json({ success: false, message: 'Chỉ chia sẻ khi AI đã xử lý xong.' });
    const coaches = await shareableCoaches(req.user!.userId);
    if (!coaches.some(coach => coach.id === coachId)) return res.status(403).json({ success: false, message: 'Coach không còn quan hệ PT hợp lệ.' });
    const includeVideo = req.body.includeVideo === true;
    const share = await prisma.exerciseAnalysisSharing.upsert({ where: { analysisId_coachId: { analysisId: id, coachId } }, create: { analysisId: id, coachId, includeVideo }, update: { revokedAt: null, sharedAt: new Date(), includeVideo } });
    res.json({ success: true, data: share });
  } catch (error) { next(error); }
});
router.delete('/:id/share', async (req: AuthRequest, res, next) => {
  try {
    const id = validId(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: 'ID không hợp lệ.' });
    const row = await prisma.exerciseAnalysis.findFirst({ where: { id, memberId: req.user!.userId, evaluationMode: 'OFFICIAL' } });
    if (!row) return res.status(404).json({ success: false, message: 'Không tìm thấy kết quả.' });
    const coachId = validId(req.query.coachId);
    if (!coachId) return res.status(400).json({ success: false, message: 'Coach không hợp lệ.' });
    await prisma.exerciseAnalysisSharing.updateMany({ where: { analysisId: id, coachId, revokedAt: null }, data: { revokedAt: new Date() } });
    res.json({ success: true, message: 'Đã thu hồi quyền xem của Coach.' });
  } catch (error) { next(error); }
});
router.delete('/:id', async (req: AuthRequest, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ success: false, message: 'ID không hợp lệ.' });
    const deleted = await deleteExerciseAnalysis(id, req.user!.userId);
    res.status(deleted ? 200 : 404).json({ success: deleted, message: deleted ? 'Đã xóa kết quả và video.' : 'Không tìm thấy kết quả.' });
  } catch (error) { next(error); }
});

export default router;
