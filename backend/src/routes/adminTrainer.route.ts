import { Router } from 'express';
import { getTrainersList, setupTrainerProfile, toggleTrainerStatus } from '../controllers/adminTrainer.controller.js';
import { authenticateToken, authorizeRoles } from '../middlewares/auth.middleware.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: AdminTrainer
 *   description: Quản lý Huấn luyện viên (Coach/PT) dành cho Admin
 */

/**
 * @swagger
 * /admin-trainers:
 *   get:
 *     summary: Lấy danh sách Coach kèm bộ lọc
 *     tags: [AdminTrainer]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Tìm theo tên, email, sđt
 *       - in: query
 *         name: specialization
 *         schema:
 *           type: string
 *         description: Lọc theo chuyên môn (Yoga, Boxing...)
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ACTIVE, INACTIVE, BLOCKED]
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Danh sách Coach
 */
router.get('/', authenticateToken, authorizeRoles('ADMIN', 'STAFF'), getTrainersList);

/**
 * @swagger
 * /admin-trainers/setup:
 *   post:
 *     summary: Cấu hình Hồ sơ, Giá & Lịch làm việc cho Coach
 *     tags: [AdminTrainer]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: integer
 *               bio:
 *                 type: string
 *               specialties:
 *                 type: array
 *                 items:
 *                   type: string
 *               hourlyRate:
 *                 type: number
 *               experienceYears:
 *                 type: integer
 *               workingSchedules:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     dayOfWeek:
 *                       type: integer
 *                       description: 0 (Chủ nhật) -> 6 (Thứ 7)
 *                     startTime:
 *                       type: string
 *                       description: HH:mm (VD 08:00)
 *                     endTime:
 *                       type: string
 *                       description: HH:mm (VD 17:00)
 *                     isAvailable:
 *                       type: boolean
 *     responses:
 *       200:
 *         description: Cấu hình thành công
 */
router.post('/setup', authenticateToken, authorizeRoles('ADMIN'), setupTrainerProfile);

/**
 * @swagger
 * /admin-trainers/{id}/status:
 *   patch:
 *     summary: Khóa / Mở khóa tài khoản Coach
 *     tags: [AdminTrainer]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [ACTIVE, INACTIVE, BLOCKED]
 *     responses:
 *       200:
 *         description: Đổi trạng thái thành công
 */
router.patch('/:id/status', authenticateToken, authorizeRoles('ADMIN'), toggleTrainerStatus);

export default router;
