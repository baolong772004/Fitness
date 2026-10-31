import { Router } from 'express';
import { createHash, createHmac } from 'node:crypto';
import bcrypt from 'bcrypt';
import prisma from '../config/prisma.js';
import { authenticateToken, authorizeRoles, type AuthRequest } from '../middlewares/auth.middleware.js';
import { CANDIDATE_SQUAT_POLICIES, buildHoldoutExportBundle, coachAnalysisSummary, compareAiAndCoachLabels, resolveCoachLabelHistory, videoAvailable } from '../services/exerciseAnalysis.utils.js';
import { sendAnalysisVideo } from '../services/exerciseAnalysis.media.js';
import { hasValidTrainingRelation } from '../services/studentWorkoutPlan.service.js';

const router = Router();

function canonical(value: any): any {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
const standardDigest = (standard: unknown) => createHash('sha256').update(JSON.stringify(canonical(standard)), 'utf8').digest('hex');
router.use(authenticateToken, authorizeRoles('COACH', 'TRAINER'));
router.use(async (req: AuthRequest, res, next) => {
  try {
    const profile = await prisma.coachProfile.findUnique({ where: { userId: req.user!.userId }, select: { status: true } });
    if (profile?.status !== 'ACTIVE') return res.status(403).json({ success: false, message: 'Hồ sơ Coach không còn hoạt động.' });
    next();
  } catch (error) { next(error); }
});

router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const page = Math.max(1, Math.min(1000, Number(req.query.page) || 1));
    const coachId = req.user!.userId;
    const shares = await prisma.exerciseAnalysisSharing.findMany({
      where: { coachId, revokedAt: null },
      include: {
        analysis: {
          include: {
            member: { select: { id: true, fullName: true } },
            feedback: { where: { coachId }, orderBy: { createdAt: 'desc' } },
            techniqueLabels: { where: { coachId }, orderBy: [{ startSeconds: 'asc' }, { criterionId: 'asc' }] },
          },
        },
      },
      orderBy: { sharedAt: 'desc' }, skip: (page - 1) * 20, take: 20,
    });
    const allowed = await Promise.all(shares.map(async share => {
      if (!await hasValidTrainingRelation(prisma, coachId, share.analysis.memberId)) return null;
      const analysis = coachAnalysisSummary(share.analysis);
      analysis.videoAvailable = share.includeVideo && analysis.videoAvailable;
      const parsedLabels = (share.analysis.techniqueLabels || []).map(row => ({ ...row, evidence: JSON.parse(row.evidenceJson || '{}') }));
      const resolvedHistory = resolveCoachLabelHistory(parsedLabels, analysis.result?.cameraView?.detected || 'UNKNOWN');
      const aiCoachComparison = compareAiAndCoachLabels(analysis.result, parsedLabels);
      return { id: share.id, sharedAt: share.sharedAt, includeVideo: share.includeVideo, analysis, techniqueLabels: resolvedHistory.activeLabels, labelRevisionsCount: resolvedHistory.totalRevisions, aiCoachComparison };
    }));
    res.json({ success: true, data: allowed.filter(Boolean), candidatePolicies: CANDIDATE_SQUAT_POLICIES, page });
  } catch (error) { next(error); }
});

router.get('/criteria-reviews', async (req: AuthRequest, res, next) => {
  try {
    const coachId = req.user!.userId;
    const rows = await prisma.exerciseTechniqueCriterionReview.findMany({
      where: { coachId },
      orderBy: { reviewedAt: 'desc' },
      take: 100,
    });
    res.json({
      success: true,
      data: rows.map(row => ({
        ...row,
        thresholds: JSON.parse(row.thresholdsJson || '{}'),
        cameraViews: JSON.parse(row.cameraViewsJson || '[]'),
        limitations: JSON.parse(row.limitationsJson || '[]'),
        correctionAdviceParsed: JSON.parse(row.correctionAdvice || '{}'),
      })),
      candidatePolicies: CANDIDATE_SQUAT_POLICIES,
    });
  } catch (error) { next(error); }
});

router.get('/:analysisId/video', async (req: AuthRequest, res, next) => {
  try {
    const analysisId = Number(req.params.analysisId);
    if (!Number.isSafeInteger(analysisId) || analysisId <= 0) return res.status(400).json({ success: false, message: 'ID không hợp lệ.' });
    const coachId = req.user!.userId;
    const share = await prisma.exerciseAnalysisSharing.findFirst({ where: { analysisId, coachId, revokedAt: null, includeVideo: true }, include: { analysis: true } });
    if (!share || !await hasValidTrainingRelation(prisma, coachId, share.analysis.memberId)) return res.status(403).json({ success: false, message: 'Bạn không có quyền xem video này.' });
    await sendAnalysisVideo(share.analysis, res, next);
  } catch (error) { next(error); }
});

router.get('/:analysisId/technique-labels', async (req: AuthRequest, res, next) => {
  try {
    const analysisId = Number(req.params.analysisId);
    const coachId = req.user!.userId;
    const share = await prisma.exerciseAnalysisSharing.findFirst({ where: { analysisId, coachId, revokedAt: null, includeVideo: true }, include: { analysis: true } });
    if (!share || !videoAvailable(share.analysis) || !await hasValidTrainingRelation(prisma, coachId, share.analysis.memberId)) return res.status(403).json({ success: false, message: 'Cần video được học viên chia sẻ và quan hệ PT còn hiệu lực.' });
    const data = await prisma.exerciseTechniqueCoachLabel.findMany({ where: { analysisId, coachId }, orderBy: [{ startSeconds: 'asc' }, { criterionId: 'asc' }, { createdAt: 'asc' }] });
    const parsed = data.map(row => ({ ...row, evidence: JSON.parse(row.evidenceJson) }));
    const result = share.analysis.resultJson ? JSON.parse(share.analysis.resultJson) : null;
    const resolved = resolveCoachLabelHistory(parsed, result?.cameraView?.detected || 'UNKNOWN');
    res.json({ success: true, data: resolved.activeLabels, allRevisions: parsed, totalRevisions: resolved.totalRevisions, comparison: compareAiAndCoachLabels(result, parsed) });
  } catch (error) { next(error); }
});

router.get('/:analysisId/export-holdout-bundle', async (req: AuthRequest, res, next) => {
  try {
    const analysisId = Number(req.params.analysisId);
    const coachId = req.user!.userId;
    const share = await prisma.exerciseAnalysisSharing.findFirst({
      where: { analysisId, coachId, revokedAt: null, includeVideo: true },
      include: { analysis: true, coach: { select: { id: true, fullName: true, email: true } } },
    });
    if (!share || !await hasValidTrainingRelation(prisma, coachId, share.analysis.memberId)) {
      return res.status(403).json({ success: false, message: 'Cần quyền truy cập bài phân tích được chia sẻ.' });
    }
    const labels = await prisma.exerciseTechniqueCoachLabel.findMany({
      where: { analysisId, coachId },
      orderBy: [{ startSeconds: 'asc' }, { criterionId: 'asc' }],
    });
    const result = share.analysis.resultJson ? JSON.parse(share.analysis.resultJson) : {};
    const reviewer = `${share.coach.fullName} (coachId:${share.coach.id})`;
    const bundle = buildHoldoutExportBundle(share.analysis, result, labels, reviewer);
    res.json({
      success: true,
      data: {
        ...bundle,
        // Keep the measured features bound to the same video hash and rule version
        // when a Coach later prepares a development reference or holdout audit.
        inferenceResult: result,
        comparison: compareAiAndCoachLabels(result, labels),
      },
    });
  } catch (error) { next(error); }
});

router.post('/:analysisId/technique-labels', async (req: AuthRequest, res, next) => {
  try {
    const analysisId = Number(req.params.analysisId);
    const coachId = req.user!.userId;
    const share = await prisma.exerciseAnalysisSharing.findFirst({ where: { analysisId, coachId, revokedAt: null, includeVideo: true }, include: { analysis: true } });
    if (!share || !videoAvailable(share.analysis) || !await hasValidTrainingRelation(prisma, coachId, share.analysis.memberId)) return res.status(403).json({ success: false, message: 'Cần video được học viên chia sẻ và quan hệ PT còn hiệu lực.' });
    const result = share.analysis.resultJson ? JSON.parse(share.analysis.resultJson) : {};
    const snapshot = result.techniqueEvaluation?.standardSnapshot;
    const criteria = new Set((snapshot?.criteria || []).map((item: any) => item.criterionId));
    const labels = req.body?.labels;
    const duration = Number(result.video?.durationSeconds);
    const videoSha256 = String(result.inputVideoSha256 || '');
    if (!Array.isArray(labels) || labels.length < 1 || labels.length > 200 || !snapshot || !/^[a-f0-9]{64}$/i.test(videoSha256) || !Number.isFinite(duration)) return res.status(400).json({ success: false, message: 'Thiếu dữ liệu video, tiêu chuẩn hoặc danh sách nhãn hợp lệ.' });
    const rows = [];
    const defaultCameraView = String(result.cameraView?.detected || 'UNKNOWN').toUpperCase();
    const labeledAtIso = new Date().toISOString();
    for (const label of labels) {
      const start = Number(label?.startSeconds), end = Number(label?.endSeconds), stamp = label?.timestampSeconds == null ? null : Number(label.timestampSeconds);
      const rep = label?.repNumber == null ? null : Number(label.repNumber);
      const outcome = label?.outcome;
      const rawCameraView = String(label?.cameraView || label?.evidence?.cameraView || defaultCameraView).toUpperCase();
      const cameraView = ['SIDE', 'FRONT', 'OBLIQUE', 'UNKNOWN'].includes(rawCameraView) ? rawCameraView : defaultCameraView;
      const notes = typeof label?.reviewerNotes === 'string' ? label.reviewerNotes.trim() : '';
      if (!criteria.has(label?.criterionId) || !['MEETS', 'IMPROVE', 'UNASSESSABLE'].includes(outcome)
          || !Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start >= end || end > duration
          || (stamp != null && (!Number.isFinite(stamp) || stamp < start || stamp > end))
          || (outcome !== 'UNASSESSABLE' && stamp == null) || (rep != null && (!Number.isInteger(rep) || rep < 1))
          || !notes || notes.length > 2000 || !label?.evidence || typeof label.evidence !== 'object') {
        return res.status(400).json({ success: false, message: 'Nhãn cần đúng tiêu chí, khoảng thời gian, timestamp, bằng chứng và ghi chú Coach.' });
      }
      const enrichedEvidence = {
        ...label.evidence,
        cameraView,
        reviewerId: coachId,
        labeledAt: labeledAtIso,
        standardVersion: snapshot.standardVersion,
      };
      rows.push({ analysisId, coachId, videoSha256, exerciseVariant: result.exerciseVariant || snapshot.exerciseVariant,
        standardVersion: snapshot.standardVersion, criterionId: label.criterionId, outcome, repNumber: rep,
        startSeconds: start, endSeconds: end, timestampSeconds: stamp, evidenceJson: JSON.stringify(enrichedEvidence), reviewerNotes: notes });
    }
    await prisma.exerciseTechniqueCoachLabel.createMany({ data: rows });
    res.status(201).json({ success: true, data: { created: rows.length, status: 'COACH_LABELS_PENDING_INDEPENDENT_REVIEW' } });
  } catch (error) { next(error); }
});

router.post('/criteria-review', async (req: AuthRequest, res, next) => {
  try {
    const body = req.body || {};
    const exerciseType = String(body.exerciseType || '').toUpperCase();
    const exerciseVariant = String(body.exerciseVariant || '');
    const standardVersion = String(body.standardVersion || '');
    const criterionId = String(body.criterionId || '');
    const decision = String(body.decision || '');
    const qualification = typeof body.qualification === 'string' ? body.qualification.trim() : '';
    const reviewRecordId = typeof body.reviewRecordId === 'string' ? body.reviewRecordId.trim() : '';
    const reviewScope = typeof body.reviewScope === 'string' ? body.reviewScope.trim() : '';
    const approvedConditions = typeof body.approvedConditions === 'string' ? body.approvedConditions.trim() : '';
    const proposedThresholds = body.proposedThresholds;
    if (!/^[A-Z_]{2,30}$/.test(exerciseType) || !exerciseVariant || !standardVersion || !criterionId
        || !['CONTENT_REVIEWED_PENDING_VIDEO_VALIDATION', 'CHANGES_REQUESTED', 'NOT_APPLICABLE'].includes(decision)
        || !qualification || qualification.length > 300 || !reviewRecordId || reviewRecordId.length > 100
        || !reviewScope || reviewScope.length > 1000 || !approvedConditions || !proposedThresholds || typeof proposedThresholds !== 'object') {
      return res.status(400).json({ success: false, message: 'Cần đủ định danh chuẩn, năng lực Coach, phạm vi, điều kiện và ngưỡng đề xuất.' });
    }
    const response = await fetch(`${process.env.AI_SERVICE_URL || 'http://127.0.0.1:8001'}/standards/${exerciseType.toLowerCase()}`, { headers: { 'x-ai-service-key': process.env.AI_SERVICE_KEY || '' }, signal: AbortSignal.timeout(15000) });
    if (!response.ok) return res.status(503).json({ success: false, message: 'Không đọc được chuẩn tham chiếu từ AI service.' });
    const standard = await response.json() as any;
    if (standard.standardVersion !== standardVersion || standard.exerciseVariant !== exerciseVariant) return res.status(409).json({ success: false, message: 'Phiên bản chuẩn hoặc biến thể đã thay đổi.' });
    const criterion = standard.criteria?.find((item: any) => item.criterionId === criterionId);
    if (!criterion || criterion.type === 'D') return res.status(404).json({ success: false, message: 'Không tìm thấy tiêu chí có thể rà soát.' });
    const digest = standardDigest(standard);
    if (body.standardDigest !== digest) return res.status(409).json({ success: false, message: 'Digest chuẩn không khớp; hãy tải lại nội dung mới nhất.' });
    const row = await prisma.exerciseTechniqueCriterionReview.create({ data: {
      coachId: req.user!.userId, exerciseType, exerciseVariant, standardVersion, standardDigest: digest, criterionId,
      decision, qualification, reviewRecordId, reviewScope, approvedConditions,
      measurementFormula: String(criterion.measurementMethod?.formula || '').slice(0, 2000),
      thresholdsJson: JSON.stringify(proposedThresholds), cameraViewsJson: JSON.stringify(criterion.requiredCameraAngles || []),
      limitationsJson: JSON.stringify(criterion.limitations || []), correctionAdvice: JSON.stringify(criterion.correctionAdvice || {}),
      status: decision === 'CONTENT_REVIEWED_PENDING_VIDEO_VALIDATION' ? 'COACH_REVIEWED_PENDING_VIDEO_VALIDATION' : decision,
    } });
    res.status(201).json({ success: true, data: row, message: 'Đã lưu rà soát Coach. Cần kiểm chứng video độc lập trước mọi verdict chính thức.' });
  } catch (error) { next(error); }
});

router.post('/criteria-reviews/:reviewId/release', async (req: AuthRequest, res, next) => {
  try {
    const reviewId = Number(req.params.reviewId);
    const coachId = req.user!.userId;
    const body = req.body || {};
    if (!Number.isSafeInteger(reviewId) || reviewId <= 0) return res.status(400).json({ success: false, code: 'INVALID_REVIEW_ID' });
    const review = await prisma.exerciseTechniqueCriterionReview.findFirst({ where: { id: reviewId, coachId,
      status: { in: ['COACH_REVIEWED_PENDING_VIDEO_VALIDATION', 'APPROVAL_ACTIVATING'] },
      decision: 'CONTENT_REVIEWED_PENDING_VIDEO_VALIDATION' } });
    if (!review) return res.status(404).json({ success: false, code: 'PENDING_COACH_REVIEW_NOT_FOUND' });
    const coach = await prisma.user.findUnique({ where: { id: coachId }, select: { fullName: true, password: true, status: true } });
    if (!coach || coach.status !== 'ACTIVE' || typeof body.password !== 'string' ||
        !await bcrypt.compare(body.password, coach.password) || body.signatureName !== coach.fullName ||
        body.confirmation !== 'I_APPROVE_THIS_CRITERION_AFTER_INDEPENDENT_VALIDATION') {
      return res.status(403).json({ success: false, code: 'COACH_SIGNATURE_REQUIRED', message: 'Cần Coach đang hoạt động xác nhận tên và mật khẩu trước khi duyệt.' });
    }
    const labels = await prisma.exerciseTechniqueCoachLabel.count({ where: { coachId, criterionId: review.criterionId,
      standardVersion: review.standardVersion } });
    if (!labels) return res.status(422).json({ success: false, code: 'NO_REAL_COACH_LABELS_IN_SQL',
      message: 'Coach chưa gắn nhãn thật cho tiêu chí này trong SQL Server.' });
    const path = String(body.reportPath || '');
    const sha256 = String(body.reportSha256 || '').toLowerCase();
    const acceptanceCriteriaId = String(body.acceptanceCriteriaId || '');
    const scope = body.scope;
    const reviewCameras = JSON.parse(review.cameraViewsJson || '[]') as string[];
    if (!/^evaluation\/private\/[A-Za-z0-9_./-]+\.json$/.test(path) || path.includes('..') ||
        !/^[a-f0-9]{64}$/.test(sha256) || !acceptanceCriteriaId || !scope ||
        scope.exerciseVariant !== review.exerciseVariant || !scope.modelVersion || !scope.ruleVersion ||
        !Array.isArray(scope.cameraViews) || !scope.cameraViews.length ||
        !scope.cameraViews.every((view: string) => reviewCameras.includes(view))) {
      return res.status(400).json({ success: false, code: 'INVALID_VALIDATION_REPORT_SCOPE' });
    }
    const conditions = JSON.parse(review.thresholdsJson || '{}');
    if (!conditions.passCondition || !conditions.improvementCondition) {
      return res.status(422).json({ success: false, code: 'COACH_DECISION_CONDITIONS_MISSING' });
    }
    const service = process.env.AI_SERVICE_URL || 'http://127.0.0.1:8001';
    const key = process.env.AI_SERVICE_KEY;
    if (!key || !process.env.JWT_SECRET) return res.status(503).json({ success: false, code: 'RELEASE_SERVICE_NOT_CONFIGURED' });
    const standardResponse = await fetch(`${service}/standards/${review.exerciseType.toLowerCase()}`, {
      headers: { 'x-ai-service-key': key }, signal: AbortSignal.timeout(15000) });
    if (!standardResponse.ok) return res.status(503).json({ success: false, code: 'STANDARD_UNAVAILABLE' });
    const standard = await standardResponse.json() as any;
    if (review.status === 'APPROVAL_ACTIVATING') {
      const active = standard.criteria?.find((item: any) => item.criterionId === review.criterionId)?.evaluationPolicy;
      if (active?.status === 'APPROVED_AND_VALIDATED' &&
          active?.approvedByCoach?.approvalSignatureSha256 === review.approvalSignatureSha256 &&
          active?.validationReport?.sha256 === review.validationReportSha256) {
        const digest = standardDigest(standard);
        await prisma.exerciseTechniqueCriterionReview.updateMany({ where: { id: reviewId, coachId,
          status: 'APPROVAL_ACTIVATING' }, data: { status: 'APPROVED_AND_VIDEO_VALIDATED', releasedStandardDigest: digest } });
        return res.json({ success: true, data: { reviewId, criterionId: review.criterionId,
          status: 'APPROVED_AND_VIDEO_VALIDATED', releasedStandardDigest: digest,
          approvedAt: review.approvedAt?.toISOString() } });
      }
      if (standardDigest(standard) !== review.standardDigest) {
        return res.status(409).json({ success: false, code: 'RELEASE_RECONCILIATION_REQUIRED' });
      }
      await prisma.exerciseTechniqueCriterionReview.updateMany({ where: { id: reviewId, coachId,
        status: 'APPROVAL_ACTIVATING' }, data: { status: 'COACH_REVIEWED_PENDING_VIDEO_VALIDATION' } });
    }
    if (standard.standardVersion !== review.standardVersion || standardDigest(standard) !== review.standardDigest) {
      return res.status(409).json({ success: false, code: 'STANDARD_CHANGED_SINCE_COACH_REVIEW' });
    }
    const signedAt = new Date().toISOString();
    const signaturePayload = { reviewId, coachId, standardDigest: review.standardDigest,
      criterionId: review.criterionId, reportSha256: sha256, scope, signedAt };
    const approvalSignatureSha256 = createHmac('sha256', process.env.JWT_SECRET)
      .update(JSON.stringify(canonical(signaturePayload)), 'utf8').digest('hex');
    const payload = { exerciseVariant: review.exerciseVariant, criterionId: review.criterionId,
      standardVersion: review.standardVersion, standardDigest: review.standardDigest,
      reviewer: { reviewerId: String(coachId), qualification: review.qualification,
        reviewRecordId: review.reviewRecordId, reviewedAt: review.reviewedAt.toISOString() },
      signedAt, approvalSignatureSha256,
      conditions: { passCondition: conditions.passCondition, improvementCondition: conditions.improvementCondition },
      validationReport: { path, sha256, standardVersion: review.standardVersion,
        criterionId: review.criterionId, scope, acceptanceCriteriaId } };
    const aiCall = async (step: 'verify' | 'commit') => {
      const response = await fetch(`${service}/standards/${review.exerciseType.toLowerCase()}/release/${step}`, {
        method: 'POST', headers: { 'x-ai-service-key': key, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload), signal: AbortSignal.timeout(120_000),
      });
      const data = await response.json() as any;
      return { response, data };
    };
    const verified = await aiCall('verify');
    if (!verified.response.ok) return res.status(422).json({ success: false, code: 'RELEASE_EVIDENCE_REJECTED',
      blocker: String(verified.data?.detail || 'VALIDATION_NOT_ACCEPTED'),
      message: `Chưa thể phát hành: ${String(verified.data?.detail || 'VALIDATION_NOT_ACCEPTED')}` });
    const claim = await prisma.exerciseTechniqueCriterionReview.updateMany({ where: { id: reviewId, coachId,
      status: 'COACH_REVIEWED_PENDING_VIDEO_VALIDATION' }, data: { status: 'APPROVAL_ACTIVATING',
      validationReportSha256: sha256, validationReportPath: path,
      approvalSignatureSha256, approvalScopeJson: JSON.stringify(scope), approvedAt: new Date(signedAt) } });
    if (!claim.count) return res.status(409).json({ success: false, code: 'REVIEW_CHANGED_DURING_APPROVAL' });
    let committed;
    try { committed = await aiCall('commit'); }
    catch (error) {
      return res.status(503).json({ success: false, code: 'RELEASE_RECONCILIATION_REQUIRED',
        message: 'Không nhận được xác nhận từ AI service. Hãy thử lại để kiểm tra tiêu chí đã kích hoạt hay chưa.' });
    }
    if (!committed.response.ok) {
      await prisma.exerciseTechniqueCriterionReview.updateMany({ where: { id: reviewId, status: 'APPROVAL_ACTIVATING' },
        data: { status: 'COACH_REVIEWED_PENDING_VIDEO_VALIDATION' } });
      return res.status(422).json({ success: false, code: 'RELEASE_EVIDENCE_REJECTED',
        blocker: String(committed.data?.detail || 'VALIDATION_NOT_ACCEPTED'),
        message: `Chưa thể phát hành: ${String(committed.data?.detail || 'VALIDATION_NOT_ACCEPTED')}` });
    }
    const completed = await prisma.exerciseTechniqueCriterionReview.updateMany({ where: { id: reviewId, coachId,
      status: 'APPROVAL_ACTIVATING' }, data: { status: 'APPROVED_AND_VIDEO_VALIDATED',
      releasedStandardDigest: String(committed.data.releasedStandardDigest) } });
    if (!completed.count) return res.status(503).json({ success: false, code: 'RELEASE_RECONCILIATION_REQUIRED' });
    return res.json({ success: true, data: { reviewId, criterionId: review.criterionId,
      status: 'APPROVED_AND_VIDEO_VALIDATED', releasedStandardDigest: committed.data.releasedStandardDigest,
      approvedAt: signedAt } });
  } catch (error) { next(error); }
});

router.post('/:analysisId/feedback', async (req: AuthRequest, res, next) => {
  try {
    const analysisId = Number(req.params.analysisId);
    const comment = typeof req.body?.comment === 'string' ? req.body.comment.trim() : '';
    if (!Number.isSafeInteger(analysisId) || analysisId <= 0 || !comment || comment.length > 1000) return res.status(400).json({ success: false, message: 'Góp ý cần từ 1 đến 1000 ký tự.' });
    const coachId = req.user!.userId;
    const share = await prisma.exerciseAnalysisSharing.findFirst({ where: { analysisId, coachId, revokedAt: null }, include: { analysis: { select: { memberId: true } } } });
    if (!share || !await hasValidTrainingRelation(prisma, coachId, share.analysis.memberId)) return res.status(403).json({ success: false, message: 'Bạn không có quyền góp ý kết quả này.' });
    const row = await prisma.exerciseAnalysisFeedback.create({ data: { analysisId, coachId, comment } });
    res.status(201).json({ success: true, data: row });
  } catch (error) { next(error); }
});

export default router;
