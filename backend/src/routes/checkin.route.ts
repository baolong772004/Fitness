import { Router } from 'express';
import { CheckInController } from '../controllers/checkin.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: CheckIn
 *   description: API Quản lý điểm danh phòng tập
 */

/**
 * @swagger
 * /checkin:
 *   post:
 *     summary: Điểm danh vào phòng tập (Check-in)
 *     tags: [CheckIn]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               checkinToken:
 *                 type: string
 *                 description: Mã JWT lấy từ QR Code (Dành cho lễ tân quét mã khách hàng)
 *     responses:
 *       200:
 *         description: Check-in thành công
 *       401:
 *         description: Chưa đăng nhập
 *       403:
 *         description: Gói tập đã hết hạn hoặc hết số buổi
 *       429:
 *         description: Check-in quá nhanh (Spam)
 *       500:
 *         description: Lỗi server
 */
router.post('/', authenticateToken, CheckInController.checkIn);

/**
 * @swagger
 * /checkin/generate-qr:
 *   get:
 *     summary: Tạo mã QR để điểm danh (dành cho người dùng mở trên App)
 *     tags: [CheckIn]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Trả về ảnh QR Base64 và token
 *       401:
 *         description: Chưa đăng nhập
 *       500:
 *         description: Lỗi server
 */
router.get('/generate-qr', authenticateToken, CheckInController.generateQR);

/**
 * @swagger
 * /checkin/history:
 *   get:
 *     summary: Xem lịch sử điểm danh của bản thân
 *     tags: [CheckIn]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Số trang
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Số lượng kết quả mỗi trang
 *     responses:
 *       200:
 *         description: Thành công
 *       401:
 *         description: Chưa đăng nhập
 *       500:
 *         description: Lỗi server
 */
router.get('/history', authenticateToken, CheckInController.getHistory);

export default router;
