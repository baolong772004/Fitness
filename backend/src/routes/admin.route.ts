import { Router } from 'express';
import { getMembersList, getMemberDetailProfile } from '../controllers/admin.controller.js';
import { authenticateToken, authorizeRoles } from '../middlewares/auth.middleware.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: AdminMember
 *   description: API Quản lý Hội viên dành cho Admin/Staff
 */

/**
 * @swagger
 * /admin/members:
 *   get:
 *     summary: Tìm kiếm & Phân trang danh sách Member
 *     tags: [AdminMember]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Tìm theo tên, email hoặc số điện thoại
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
 *         description: Danh sách Member
 */
// Chỉ ADMIN hoặc STAFF mới được xem danh sách này
router.get('/members', authenticateToken, authorizeRoles('ADMIN', 'STAFF'), getMembersList);

/**
 * @swagger
 * /admin/members/{id}/profile:
 *   get:
 *     summary: Xem Hồ sơ 360° Chi tiết của Member
 *     tags: [AdminMember]
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
 *         description: Hồ sơ chi tiết (Profile, Subscriptions, History...)
 *       404:
 *         description: Không tìm thấy
 */
// Chỉ ADMIN hoặc STAFF mới được xem hồ sơ chi tiết
router.get('/members/:id/profile', authenticateToken, authorizeRoles('ADMIN', 'STAFF'), getMemberDetailProfile);

export default router;
