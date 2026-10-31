import { Router } from 'express';
import { getTrainersList, setupTrainerProfile, toggleTrainerStatus, updateTrainerPricing } from '../controllers/adminTrainer.controller.js';
import { authenticateToken, authorizeRoles } from '../middlewares/auth.middleware.js';
import { getMasterCalendar, putMasterCalendar, addClosure, removeClosure, getCoachCalendarOverview, getCalendarAudit, listCoachChangeRequests, resolveCoachScheduleChange } from '../controllers/ptAvailability.controller.js';

const router = Router();
router.get('/calendar', authenticateToken, authorizeRoles('ADMIN', 'STAFF'), getMasterCalendar);
router.put('/calendar', authenticateToken, authorizeRoles('ADMIN'), putMasterCalendar);
router.post('/calendar/closures', authenticateToken, authorizeRoles('ADMIN'), addClosure);
router.delete('/calendar/closures/:id', authenticateToken, authorizeRoles('ADMIN'), removeClosure);
router.get('/calendar/coaches', authenticateToken, authorizeRoles('ADMIN', 'STAFF'), getCoachCalendarOverview);
router.get('/calendar/audit', authenticateToken, authorizeRoles('ADMIN', 'STAFF'), getCalendarAudit);
router.get('/calendar/change-requests', authenticateToken, authorizeRoles('ADMIN', 'STAFF'), listCoachChangeRequests);
router.patch('/calendar/change-requests/:id', authenticateToken, authorizeRoles('ADMIN'), resolveCoachScheduleChange);

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
 *     summary: Cấu hình hồ sơ và giá cho Coach; Coach tự đăng ký lịch
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
 *     responses:
 *       200:
 *         description: Cấu hình thành công
 */
router.post('/setup', authenticateToken, authorizeRoles('ADMIN'), setupTrainerProfile);

/**
 * @swagger
 * /admin-trainers/{id}/pricing:
 *   patch:
 *     summary: Cập nhật đơn giá, cấp bậc và hoa hồng theo ID hồ sơ HLV
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
 *             required: [hourlyRate, commissionPercent, rank]
 *             properties:
 *               hourlyRate:
 *                 type: number
 *               commissionPercent:
 *                 type: integer
 *               rank:
 *                 type: string
 *                 enum: [junior, senior, master]
 *     responses:
 *       200:
 *         description: Đã lưu cấu hình giá HLV
 */
router.patch('/:id/pricing', authenticateToken, authorizeRoles('ADMIN'), updateTrainerPricing);

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
