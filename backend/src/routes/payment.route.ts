import { Router } from 'express';
import { PaymentController } from '../controllers/payment.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';

const router = Router();

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
