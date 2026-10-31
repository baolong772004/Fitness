import { Request, Response } from 'express';
import prisma from '../config/prisma.js';
import { AuthRequest } from '../middlewares/auth.middleware.js';
import { hasValidTrainingRelation, presentStudentPlan } from '../services/studentWorkoutPlan.service.js';
import { coachHasPaidPtLevel, normalizeAssessment, PtAssessmentError, ptTrainingPolicy } from '../services/ptTraining.service.js';
import { createUserNotification } from '../services/notification.service.js';

async function coachHasTraineeAccess(coachId: number, memberId: number) {
  return hasValidTrainingRelation(prisma, coachId, memberId);
}



/**
 * API 1: PT Ghi log kết quả buổi tập (Session Result & Exercises)
 * @route POST /api/workouts/log-session
 */
export const logSessionResult = async (req: AuthRequest, res: Response) => {
  try {
    const coachId = req.user?.userId;
    const { bookingId, notes, calories, durationMin, exercises } = req.body;

    if (!coachId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    if (!bookingId) return res.status(400).json({ success: false, message: 'Thiếu bookingId' });

    // 1. Kiểm tra buổi tập có tồn tại và thuộc về PT này không
    const booking = await prisma.booking.findUnique({
      where: { id: Number(bookingId) },
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy buổi tập' });
    }

    if (booking.type !== 'PT' || booking.coachId !== coachId) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền ghi log cho buổi tập này' });
    }

    // A workout log must not bypass the PT completion endpoint, which deducts
    // the membership session.
    if (booking.status !== 'COMPLETED') {
      return res.status(409).json({ success: false, message: 'Cần kết thúc buổi PT trước khi ghi nhật ký' });
    }

    // 3. Xử lý tạo/cập nhật SessionResult & SessionExercise trong Transaction
    const result = await prisma.$transaction(async (tx) => {
      // Xóa log cũ nếu có (để ghi đè)
      const existingSession = await tx.sessionResult.findUnique({
        where: { bookingId: booking.id },
      });

      if (existingSession) {
        await tx.sessionResult.delete({ where: { id: existingSession.id } });
      }

      // Tạo Session mới
      const sessionResult = await tx.sessionResult.create({
        data: {
          bookingId: booking.id,
          notes,
          calories: calories ? Number(calories) : null,
          durationMin: durationMin ? Number(durationMin) : null,
        },
      });

      // Gắn các bài tập (Exercises)
      if (exercises && Array.isArray(exercises) && exercises.length > 0) {
        const exerciseData = exercises.map((ex: any) => ({
          sessionResultId: sessionResult.id,
          exerciseName: ex.exerciseName,
          sets: Number(ex.sets),
          reps: Number(ex.reps),
          weightKg: ex.weightKg ? Number(ex.weightKg) : null,
        }));

        await tx.sessionExercise.createMany({
          data: exerciseData,
        });
      }

      return sessionResult;
    });

    return res.status(200).json({
      success: true,
      message: 'Ghi nhật ký buổi tập thành công!',
      data: result,
    });
  } catch (error: any) {
    console.error('Lỗi logSessionResult:', error);
    return res.status(500).json({ success: false, message: 'Lỗi ghi nhật ký buổi tập' });
  }
};

/** Coach records a level-specific baseline or progress review for an assigned PT student. */
export const createPtAssessment = async (req: AuthRequest, res: Response) => {
  const coachId = req.user?.userId;
  const memberId = Number(req.body?.memberId);
  if (!coachId) return res.status(401).json({ success: false, message: 'Chưa đăng nhập.' });
  if (!Number.isSafeInteger(memberId) || memberId <= 0) {
    return res.status(400).json({ success: false, message: 'Học viên không hợp lệ.' });
  }
  try {
    const assessment = normalizeAssessment(req.body);
    if (!await coachHasPaidPtLevel(prisma, coachId, memberId, assessment.level)) {
      return res.status(403).json({ success: false, message: 'Học viên không có gói PT cấp này với Coach.' });
    }
    const baseline = await prisma.ptTrainingAssessment.findFirst({
      where: { memberId, coachId, level: assessment.level, kind: 'BASELINE' }, select: { id: true },
    });
    if (assessment.kind === 'REVIEW' && !baseline) {
      return res.status(409).json({ success: false, message: 'Cần ghi đánh giá đầu vào trước khi đánh giá tiến bộ.' });
    }
    if (assessment.kind === 'BASELINE' && baseline) {
      return res.status(409).json({ success: false, message: 'Cấp PT này đã có đánh giá đầu vào.' });
    }
    const saved = await prisma.ptTrainingAssessment.create({ data: { memberId, coachId, ...assessment } });
    await createUserNotification({ userId: memberId,
      title: assessment.kind === 'BASELINE' ? 'Đã có đánh giá PT đầu vào' : 'Coach đã cập nhật tiến độ PT',
      message: 'Mở mục Tiến độ để xem nhận xét và bước tập luyện tiếp theo.' });
    return res.status(201).json({ success: true, data: saved });
  } catch (error) {
    if (error instanceof PtAssessmentError) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    if ((error as { code?: string })?.code === 'P2002') {
      return res.status(409).json({ success: false, message: 'Cấp PT này đã có đánh giá đầu vào.' });
    }
    console.error('Lỗi ghi đánh giá PT:', error);
    return res.status(500).json({ success: false, message: 'Không thể lưu đánh giá PT.' });
  }
};

/**
 * API 2: Ghi nhận chỉ số cơ thể (InBody / Progress Log)
 * @route POST /api/workouts/inbody
 */
export const logInBodyProgress = async (req: AuthRequest, res: Response) => {
  try {
    const { memberId, weight, bodyFat, muscleMass } = req.body;
    const actorId = req.user?.userId;
    const role = req.user?.role;

    if (!Number.isSafeInteger(Number(memberId)) || Number(memberId) <= 0 ||
        weight === undefined || !Number.isFinite(Number(weight)) || Number(weight) <= 0) {
      return res.status(400).json({ success: false, message: 'Thiếu memberId hoặc weight' });
    }
    if (role === 'COACH' || role === 'TRAINER') {
      if (!actorId || !await coachHasTraineeAccess(actorId, Number(memberId))) {
        return res.status(403).json({ success: false, message: 'Học viên không thuộc Coach này' });
      }
    }

    const progress = await prisma.progressLog.create({
      data: {
        memberId: Number(memberId),
        weight: Number(weight),
        bodyFat: bodyFat ? Number(bodyFat) : null,
        muscleMass: muscleMass ? Number(muscleMass) : null,
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Lưu chỉ số InBody thành công!',
      data: progress,
    });
  } catch (error: any) {
    console.error('Lỗi logInBodyProgress:', error);
    return res.status(500).json({ success: false, message: 'Lỗi lưu chỉ số cơ thể' });
  }
};

/**
 * API 3: Lấy toàn bộ tiến độ tập luyện của 1 Member (Dành cho Member hoặc PT)
 * @route GET /api/workouts/progress/:memberId
 */
export const getMemberProgress = async (req: AuthRequest, res: Response) => {
  try {
    const targetMemberId = Number(req.params.memberId);
    
    // Authorization: Phải là STAFF/ADMIN/PT hoặc chính Member đó xem
    const userId = req.user?.userId;
    const role = req.user?.role;
    
    if (!userId) return res.status(401).json({ success: false, message: 'Chưa đăng nhập' });
    if (!Number.isSafeInteger(targetMemberId) || targetMemberId <= 0) {
      return res.status(400).json({ success: false, message: 'memberId không hợp lệ' });
    }
    if (role === 'MEMBER' && userId !== targetMemberId) {
       return res.status(403).json({ success: false, message: 'Không có quyền xem tiến độ của người khác' });
    }
    if (role === 'COACH' || role === 'TRAINER') {
      if (!await coachHasTraineeAccess(userId, targetMemberId)) {
        return res.status(403).json({ success: false, message: 'Học viên không thuộc Coach này' });
      }
    }

    const [inbodyLogs, workoutLogs, workoutPlans, assessments] = await Promise.all([
      // Lấy lịch sử InBody (Đo cân nặng, mỡ)
      prisma.progressLog.findMany({
        where: { memberId: targetMemberId },
        orderBy: { loggedAt: 'desc' },
        take: 12, // Lấy 12 lần đo gần nhất để vẽ biểu đồ
      }),
      // Lấy danh sách các buổi tập đã hoàn thành kèm giáo án
      prisma.booking.findMany({
        where: { 
          memberId: targetMemberId,
          type: 'PT',
          status: 'COMPLETED'
        },
        include: {
          coach: { select: { fullName: true } },
          ptCreditAllocation: { include: { batch: { select: { level: true } } } },
          membership: { include: { package: { select: { ptLevel: true } } } },
          sessionResult: {
            include: { exercises: true }
          }
        },
        orderBy: { startTime: 'desc' },
        take: 10,
      }),
      prisma.studentWorkoutPlan.findMany({
        where: { memberId: targetMemberId, ...(['COACH', 'TRAINER'].includes(role) ? { coachId: userId } : {}) },
        include: { coach: { select: { fullName: true } } },
        orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
      }),
      prisma.ptTrainingAssessment.findMany({
        where: { memberId: targetMemberId, ...(['COACH', 'TRAINER'].includes(role) ? { coachId: userId } : {}) },
        include: { coach: { select: { fullName: true } } },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        inbodyLogs,
        workoutLogs,
        plans: workoutPlans.map(presentStudentPlan),
        assessments,
        trainingPolicy: ptTrainingPolicy,
      },
    });
  } catch (error: any) {
    console.error('Lỗi getMemberProgress:', error);
    return res.status(500).json({ success: false, message: 'Lỗi lấy tiến độ tập luyện' });
  }
};
