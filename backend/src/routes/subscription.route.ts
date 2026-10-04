import { Router } from 'express';
import { SubscriptionController } from '../controllers/subscription.controller.js';
import { authenticateToken, authorizeRoles } from '../middlewares/auth.middleware.js';

const router = Router();

/**
 * @swagger
 * /subscriptions:
 *   post:
 *     summary: Đăng ký mua gói tập
 *     tags: [Subscriptions]
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
 *               startDate:
 *                 type: string
 *                 format: date-time
 *               userId:
 *                 type: integer
 *                 description: Chỉ Admin/Staff mới được truyền userId để tạo cho người khác
 *               status:
 *                 type: string
 *                 description: Trạng thái (Chỉ Admin/Staff)
 *     responses:
 *       201:
 *         description: Đăng ký thành công
 */
router.post('/', authenticateToken, SubscriptionController.createSubscription);

/**
 * @swagger
 * /subscriptions/my-subscriptions:
 *   get:
 *     summary: Lấy danh sách gói tập của tôi
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Thành công
 */
router.get('/my-subscriptions', authenticateToken, SubscriptionController.getMySubscriptions);

/**
 * @swagger
 * /subscriptions:
 *   get:
 *     summary: Lấy toàn bộ danh sách đăng ký gói tập (Admin/Staff)
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *           description: Tìm theo tên hoặc email
 *     responses:
 *       200:
 *         description: Thành công
 */
router.get('/', authenticateToken, authorizeRoles('ADMIN', 'STAFF'), SubscriptionController.getAllSubscriptions);

/**
 * @swagger
 * /subscriptions/{id}/status:
 *   patch:
 *     summary: Đổi trạng thái gói đăng ký (Admin/Staff)
 *     tags: [Subscriptions]
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
 *                 enum: [PENDING, ACTIVE, EXPIRED, CANCELLED]
 *     responses:
 *       200:
 *         description: Thành công
 */
router.patch('/:id/status', authenticateToken, authorizeRoles('ADMIN', 'STAFF'), SubscriptionController.updateSubscriptionStatus);

export default router;
