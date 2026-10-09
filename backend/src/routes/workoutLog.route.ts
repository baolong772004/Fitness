import { Router } from 'express';
import { logSessionResult, logInBodyProgress, getMemberProgress } from '../controllers/workoutLog.controller.js';
import { authenticateToken, authorizeRoles } from '../middlewares/auth.middleware.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: WorkoutLogs
 *   description: API Ghi nhận Nhật ký Tập luyện và Tiến độ
 */

/**
 * @swagger
 * /workouts/log-session:
 *   post:
 *     summary: PT Ghi nhật ký buổi tập (Giáo án, Calories, Exercises)
 *     tags: [WorkoutLogs]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               bookingId:
 *                 type: integer
 *               notes:
 *                 type: string
 *               calories:
 *                 type: integer
 *               durationMin:
 *                 type: integer
 *               exercises:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     exerciseName:
 *                       type: string
 *                     sets:
 *                       type: integer
 *                     reps:
 *                       type: integer
 *                     weightKg:
 *                       type: number
 *     responses:
 *       200:
 *         description: Ghi log thành công
 */
// Chỉ COACH mới được log giáo án buổi tập
router.post('/log-session', authenticateToken, authorizeRoles('COACH', 'TRAINER', 'ADMIN'), logSessionResult);

/**
 * @swagger
 * /workouts/inbody:
 *   post:
 *     summary: Ghi nhận chỉ số cơ thể (InBody)
 *     tags: [WorkoutLogs]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               memberId:
 *                 type: integer
 *               weight:
 *                 type: number
 *               bodyFat:
 *                 type: number
 *               muscleMass:
 *                 type: number
 *     responses:
 *       200:
 *         description: Lưu thành công
 */
// STAFF, COACH hoặc ADMIN có quyền lưu InBody cho khách
router.post('/inbody', authenticateToken, authorizeRoles('STAFF', 'COACH', 'TRAINER', 'ADMIN'), logInBodyProgress);

/**
 * @swagger
 * /workouts/progress/{memberId}:
 *   get:
 *     summary: Lấy tiến độ tập luyện của Member (InBody & Giáo án)
 *     tags: [WorkoutLogs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: memberId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Trả về biểu đồ InBody & Nhật ký buổi tập
 */
router.get('/progress/:memberId', authenticateToken, getMemberProgress);

export default router;
