import { Router } from 'express';
import { PtController } from '../controllers/pt.controller.js';
import { PaymentController } from '../controllers/payment.controller.js';
import { authenticateToken, authorizeRoles } from '../middlewares/auth.middleware.js';
import { listPtChatMessages, sendPtChatMessage } from '../controllers/ptChat.controller.js';

const router = Router();

/**
 * @swagger
 * /pt/trainers:
 *   get:
 *     summary: Lấy danh sách huấn luyện viên đang hoạt động
 *     tags: [PersonalTrainer]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Danh sách huấn luyện viên
 */
router.get('/trainers', authenticateToken, PtController.getAvailableTrainers);

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
 *     summary: Tạo đơn PayOS mua gói PT (cần Membership ACTIVE)
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
 *       200:
 *         description: Trả về link và QR PayOS; gói được kích hoạt sau khi thanh toán
 *       403:
 *         description: Chưa có Membership
 */
router.post('/buy', authenticateToken, PaymentController.createPtCheckoutSession);

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
 *         description: Đã gửi yêu cầu; lịch ở trạng thái PENDING đến khi HLV xác nhận
 */
router.post('/booking', authenticateToken, PtController.createBooking);

/**
 * @swagger
 * /pt/booking/{id}/status:
 *   patch:
 *     summary: HLV xác nhận hoặc từ chối lịch tập
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
 *                 enum: [CONFIRMED, REJECTED]
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
router.get('/my-trainees', authenticateToken, authorizeRoles('COACH', 'TRAINER'), PtController.getMyTrainees);

/**
 * @swagger
 * /pt/booking/{id}/messages:
 *   get:
 *     summary: Xem tin nhắn của lịch PT đã xác nhận
 *     tags: [PersonalTrainer]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 *       - { in: query, name: beforeId, schema: { type: integer } }
 *       - { in: query, name: afterId, schema: { type: integer } }
 *       - { in: query, name: limit, schema: { type: integer, default: 30 } }
 *     responses:
 *       200: { description: Danh sách tin nhắn cũ đến mới }
 *   post:
 *     summary: Gửi tin nhắn cho PT hoặc hội viên trong lịch
 *     tags: [PersonalTrainer]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [content]
 *             properties:
 *               content: { type: string, maxLength: 1000 }
 *     responses:
 *       201: { description: Đã lưu và gửi tin nhắn }
 */
router.get('/booking/:id/messages', authenticateToken, listPtChatMessages);
router.post('/booking/:id/messages', authenticateToken, sendPtChatMessage);

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

/**
 * @swagger
 * /pt/booking/{id}/mark-absent:
 *   post:
 *     summary: Báo vắng/hủy lịch học (Hội viên/PT)
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
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Báo vắng thành công
 */
router.post('/booking/:id/mark-absent', authenticateToken, PtController.markAbsent);

/**
 * @swagger
 * /pt/booking/schedule-makeup:
 *   post:
 *     summary: Đặt lại lịch học bù cho buổi đã vắng có phép
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
 *               originalBookingId:
 *                 type: integer
 *               newBookingDate:
 *                 type: string
 *                 description: YYYY-MM-DDTHH:mm:ss.000Z
 *     responses:
 *       201:
 *         description: Đặt lịch bù thành công
 */
router.post('/booking/schedule-makeup', authenticateToken, PtController.scheduleMakeup);

export default router;
