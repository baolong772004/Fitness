import { Router } from 'express';
import { UserController } from '../controllers/user.controller.js';
import { authenticateToken, authorizeRoles } from '../middlewares/auth.middleware.js';

const router = Router();

/**
 * @swagger
 * /users:
 *   get:
 *     summary: Lấy danh sách người dùng (Phân trang)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Số trang
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Số lượng trên một trang
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *         description: Lọc theo Role
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Tìm theo tên hoặc email
 *     responses:
 *       200:
 *         description: Thành công
 */
router.get('/', authenticateToken, authorizeRoles('ADMIN', 'STAFF'), UserController.getUsers);

/**
 * @swagger
 * /users/{id}:
 *   get:
 *     summary: Lấy thông tin user theo ID
 *     tags: [Users]
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
 *       404:
 *         description: Không tìm thấy user
 */
router.get('/:id', authenticateToken, UserController.getUserById);

/**
 * @swagger
 * /users/{id}:
 *   put:
 *     summary: Cập nhật thông tin User (Profile)
 *     tags: [Users]
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
 *               fullName:
 *                 type: string
 *               phone:
 *                 type: string
 *               avatar:
 *                 type: string
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *       403:
 *         description: Không có quyền
 */
router.put('/:id', authenticateToken, UserController.updateUser);

/**
 * @swagger
 * /users/{id}/role:
 *   patch:
 *     summary: Cập nhật quyền (Role) của user (Chỉ ADMIN)
 *     tags: [Users]
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
 *               role:
 *                 type: string
 *                 enum: [ADMIN, STAFF, COACH, MEMBER]
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *       403:
 *         description: Chỉ Admin mới có quyền
 */
router.patch('/:id/role', authenticateToken, authorizeRoles('ADMIN'), UserController.updateUserRole);

/**
 * @swagger
 * /users/{id}/status:
 *   patch:
 *     summary: Khóa/Mở khóa hoặc Vô hiệu hóa tài khoản (Chỉ ADMIN)
 *     tags: [Users]
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
 *                 enum: [ACTIVE, INACTIVE, BANNED]
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *       403:
 *         description: Không có quyền hoặc tự khóa chính mình
 */
router.patch('/:id/status', authenticateToken, authorizeRoles('ADMIN'), UserController.updateUserStatus);

export default router;
