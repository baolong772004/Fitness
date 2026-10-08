import { Router } from 'express';
import {
  createAnnouncement,
  getMyNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
} from '../controllers/notification.controller.js';
import { authenticateToken, authorizeRoles } from '../middlewares/auth.middleware.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Notifications
 *   description: Thông báo lịch tập và thông báo chung trong ứng dụng
 */

/**
 * @swagger
 * /notifications:
 *   get:
 *     summary: Lấy thông báo của tài khoản đang đăng nhập
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *     responses:
 *       200:
 *         description: Danh sách thông báo, số chưa đọc và phân trang
 */
router.get('/', authenticateToken, getMyNotifications);

/** @swagger
 * /notifications/unread-count:
 *   get:
 *     summary: Đếm thông báo chưa đọc
 *     tags: [Notifications]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Số thông báo chưa đọc }
 */
router.get('/unread-count', authenticateToken, getUnreadNotificationCount);

/** @swagger
 * /notifications/read-all:
 *   patch:
 *     summary: Đánh dấu tất cả thông báo đã đọc
 *     tags: [Notifications]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Đã cập nhật }
 */
router.patch('/read-all', authenticateToken, markAllNotificationsRead);

/** @swagger
 * /notifications/{id}/read:
 *   patch:
 *     summary: Đánh dấu một thông báo đã đọc
 *     tags: [Notifications]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Đã cập nhật }
 *       404: { description: Không tìm thấy thông báo thuộc tài khoản }
 */
router.patch('/:id/read', authenticateToken, markNotificationRead);

/** @swagger
 * /notifications/announcement:
 *   post:
 *     summary: Gửi thông báo chung hoặc thông báo đến một tài khoản (Admin/Staff)
 *     tags: [Notifications]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, message]
 *             properties:
 *               title: { type: string }
 *               message: { type: string }
 *               userId: { type: integer, description: Bỏ trống để gửi mọi tài khoản ACTIVE }
 *     responses:
 *       201: { description: Đã gửi thông báo }
 */
router.post('/announcement', authenticateToken, authorizeRoles('ADMIN', 'STAFF'), createAnnouncement);

export default router;
