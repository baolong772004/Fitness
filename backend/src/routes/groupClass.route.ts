import { Router } from 'express';
import { getGroupClassSchedules, getGroupClassCheckInQr, getGroupClassAttendees, bookGroupClass, cancelGroupClass, checkInGroupClass, createGroupClass, createGroupClassSchedule } from '../controllers/groupClass.controller.js';
import { authenticateToken, authorizeRoles } from '../middlewares/auth.middleware.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: GroupClass
 *   description: Quản lý đăng ký Lớp học nhóm
 */

/**
 * @swagger
 * /group-classes/schedules:
 *   get:
 *     summary: Xem danh sách lớp học nhóm & Lịch học theo ngày
 *     tags: [GroupClass]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *         description: Ngày cần xem (YYYY-MM-DD). Nếu không truyền sẽ lấy ngày hôm nay.
 *       - in: query
 *         name: all
 *         schema:
 *           type: boolean
 *         description: Admin/Staff dùng true để xem toàn bộ lịch, kể cả ngày khác và lớp đã đóng.
 *     responses:
 *       200:
 *         description: Thành công
 */
router.get('/schedules', authenticateToken, getGroupClassSchedules);

/**
 * @swagger
 * /group-classes/schedules/{scheduleId}/check-in-qr:
 *   get:
 *     summary: HLV tạo mã QR điểm danh cho ca lớp nhóm được phân công
 *     tags: [GroupClass]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: scheduleId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Mã QR có hiệu lực 90 giây
 */
router.get('/schedules/:scheduleId/check-in-qr', authenticateToken, getGroupClassCheckInQr);

/**
 * @swagger
 * /group-classes/schedules/{scheduleId}/attendees:
 *   get:
 *     summary: HLV xem hội viên đã đặt và đã điểm danh lớp nhóm
 *     tags: [GroupClass]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: scheduleId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Danh sách hội viên của ca lớp
 */
router.get('/schedules/:scheduleId/attendees', authenticateToken, getGroupClassAttendees);

/**
 * @swagger
 * /group-classes/book:
 *   post:
 *     summary: Member Đăng ký tham gia Lớp Group Class
 *     tags: [GroupClass]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               scheduleId:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Đăng ký thành công
 *       400:
 *         description: Lớp đã bắt đầu, hết chỗ hoặc đã đăng ký
 */
router.post('/book', authenticateToken, bookGroupClass);

/**
 * @swagger
 * /group-classes/cancel/{bookingId}:
 *   post:
 *     summary: Hủy đăng ký Lớp Group Class (Báo vắng)
 *     tags: [GroupClass]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Hủy lịch thành công
 *       400:
 *         description: Trễ giờ hủy
 */
router.post('/cancel/:bookingId', authenticateToken, cancelGroupClass);

/**
 * @swagger
 * /group-classes/check-in/{bookingId}:
 *   post:
 *     summary: Member Check-in Lớp Group Class
 *     tags: [GroupClass]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [qrToken]
 *             properties:
 *               qrToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Check-in thành công
 */
router.post('/check-in/:bookingId', authenticateToken, checkInGroupClass);

/**
 * @swagger
 * /group-classes:
 *   post:
 *     summary: Tạo Lớp học nhóm mới (Admin/Staff)
 *     tags: [GroupClass]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               imageUrl:
 *                 type: string
 *               durationMin:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Thành công
 */
router.post('/', authenticateToken, authorizeRoles('ADMIN', 'STAFF'), createGroupClass);

/**
 * @swagger
 * /group-classes/schedules:
 *   post:
 *     summary: Lên lịch cho lớp học nhóm (Admin/Staff)
 *     tags: [GroupClass]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               classId:
 *                 type: integer
 *               trainerId:
 *                 type: integer
 *               roomId:
 *                 type: integer
 *               startTime:
 *                 type: string
 *                 format: date-time
 *               endTime:
 *                 type: string
 *                 format: date-time
 *               capacity:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Lên lịch thành công
 */
router.post('/schedules', authenticateToken, authorizeRoles('ADMIN', 'STAFF'), createGroupClassSchedule);

export default router;
