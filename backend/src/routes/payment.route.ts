import { Router } from 'express';
import { PaymentController } from '../controllers/payment.controller.js';
import { authenticateToken, authorizeRoles } from '../middlewares/auth.middleware.js';

const router = Router();
router.post('/pt-credit/checkout', authenticateToken, authorizeRoles('MEMBER'), PaymentController.createPtCreditCheckout);
router.post('/pt-renewal/checkout', authenticateToken, authorizeRoles('MEMBER'), PaymentController.createPtRenewalCheckout);

/**
 * @swagger
 * /payments/history:
 *   get:
 *     summary: Lấy lịch sử thanh toán của người dùng đang đăng nhập
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Danh sách giao dịch và thông tin phân trang
 *       401:
 *         description: Chưa đăng nhập
 */
router.get('/history', authenticateToken, PaymentController.getPaymentHistory);

/**
 * @swagger
 * /payments/checkout:
 *   post:
 *     summary: Tạo đơn hàng và mã QR thanh toán PayOS
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               packageId:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Trả về link checkout và mã QR
 */
router.post('/checkout', authenticateToken, PaymentController.createCheckoutSession);

/**
 * @swagger
 * /payments/check-status/{orderCode}:
 *   get:
 *     summary: Kiểm tra trạng thái thanh toán PayOS
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: orderCode
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Trạng thái thanh toán hiện tại
 *       404:
 *         description: Không tìm thấy đơn thanh toán
 */
router.get('/check-status/:orderCode', authenticateToken, PaymentController.checkPaymentStatus);

/**
 * @swagger
 * /payments/webhook:
 *   post:
 *     summary: Webhook nhận phản hồi từ PayOS (Không dùng cho Frontend)
 *     tags: [Payments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Thành công
 */
router.post('/webhook', PaymentController.handlePayOSWebhook);

export default router;
