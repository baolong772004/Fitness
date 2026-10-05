import { Router } from 'express';
import { PtController } from '../controllers/pt.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: PersonalTrainer
 *   description: API Quản lý Gói tập PT và Đặt lịch PT
 */

/**
 * @swagger
 * /pt/buy:
 *   post:
 *     summary: Mua gói PT (Yêu cầu phải có Membership ACTIVE)
 *     tags: [PersonalTrainer]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               ptPackageId:
 *                 type: integer
 *               trainerId:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Đăng ký thành công
 *       403:
 *         description: Chưa có Membership
 */
router.post('/buy', authenticateToken, PtController.buyPtPackage);

/**
 * @swagger
 * /pt/trainers/{trainerId}/slots:
 *   get:
 *     summary: Lấy danh sách lịch trống của PT theo ngày
 *     tags: [PersonalTrainer]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: trainerId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: date
 *         required: true
 *         schema:
 *           type: string
 *         description: YYYY-MM-DD
 *     responses:
 *       200:
 *         description: Danh sách ca tập
 */
router.get('/trainers/:trainerId/slots', authenticateToken, PtController.getTrainerSchedule);

/**
 * @swagger
 * /pt/booking:
 *   post:
 *     summary: Đặt lịch tập với PT
 *     tags: [PersonalTrainer]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               ptSubscriptionId:
 *                 type: integer
 *               bookingDate:
 *                 type: string
 *                 description: YYYY-MM-DDTHH:mm:ss.000Z
 *               note:
 *                 type: string
 *     responses:
 *       201:
 *         description: Đặt lịch thành công
 */
router.post('/booking', authenticateToken, PtController.createBooking);

/**
 * @swagger
 * /pt/booking/{id}/status:
 *   patch:
 *     summary: Cập nhật trạng thái lịch tập (CONFIRMED / COMPLETED / CANCELLED)
 *     tags: [PersonalTrainer]
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
 *                 enum: [CONFIRMED, COMPLETED, CANCELLED]
 *     responses:
 *       200:
 *         description: Thành công
 */
router.patch('/booking/:id/status', authenticateToken, PtController.updateBookingStatus);

/**
 * @swagger
 * /pt/my-bookings:
 *   get:
 *     summary: Xem danh sách lịch đặt PT của tôi
 *     tags: [PersonalTrainer]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Danh sách lịch đặt PT
 */
router.get('/my-bookings', authenticateToken, PtController.getMyBookings);

/**
 * @swagger
 * /pt/booking/{id}/generate-session-qr:
 *   post:
 *     summary: PT tạo mã QR cho buổi tập (Hiệu lực 90s)
 *     tags: [PersonalTrainer]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Thành công
 *       400:
 *         description: Lịch hẹn không đúng trạng thái
 */
router.post('/booking/:id/generate-session-qr', authenticateToken, PtController.generateSessionQr);

/**
 * @swagger
 * /pt/booking/start-session:
 *   post:
 *     summary: Hội viên quét mã QR để bắt đầu buổi tập
 *     tags: [PersonalTrainer]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               qrToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Buổi tập đã bắt đầu
 */
router.post('/booking/start-session', authenticateToken, PtController.startSessionWithQr);

/**
 * @swagger
 * /pt/booking/{id}/complete-session:
 *   post:
 *     summary: PT kết thúc buổi tập và tự động trừ số buổi
 *     tags: [PersonalTrainer]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Thành công
 */
router.post('/booking/:id/complete-session', authenticateToken, PtController.completeSession);

export default router;
