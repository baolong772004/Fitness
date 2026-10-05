import { Router } from 'express';
import { upsertRoom, getRooms, updateEquipmentStatus, createEquipment, deleteEquipment } from '../controllers/facility.controller.js';
import { authenticateToken, authorizeRoles } from '../middlewares/auth.middleware.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Facility
 *   description: Quản lý Cơ sở vật chất (Phòng tập, Thiết bị)
 */

/**
 * @swagger
 * /facility/rooms:
 *   post:
 *     summary: Thêm hoặc Cập nhật Phòng tập (Admin/Staff)
 *     tags: [Facility]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: integer
 *                 description: Để trống nếu muốn tạo mới
 *               name:
 *                 type: string
 *               type:
 *                 type: string
 *               capacity:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Lưu thành công
 */
router.post('/rooms', authenticateToken, authorizeRoles('ADMIN', 'STAFF'), upsertRoom);

/**
 * @swagger
 * /facility/rooms:
 *   get:
 *     summary: Lấy danh sách các Phòng tập & Thiết bị
 *     tags: [Facility]
 *     responses:
 *       200:
 *         description: Thành công
 */
router.get('/rooms', getRooms);

/**
 * @swagger
 * /facility/equipment/{id}/status:
 *   patch:
 *     summary: Báo cáo bảo trì thiết bị (Admin/Staff)
 *     tags: [Facility]
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
 *                 enum: [AVAILABLE, MAINTENANCE, BROKEN]
 *               note:
 *                 type: string
 *     responses:
 *       200:
 *         description: Đã đổi trạng thái
 */
router.patch('/equipment/:id/status', authenticateToken, authorizeRoles('ADMIN', 'STAFF'), updateEquipmentStatus);

/**
 * @swagger
 * /facility/equipment:
 *   post:
 *     summary: Thêm thiết bị mới (Admin)
 *     tags: [Facility]
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
 *               code:
 *                 type: string
 *               roomId:
 *                 type: integer
 *               note:
 *                 type: string
 *     responses:
 *       201:
 *         description: Thêm thành công
 */
router.post('/equipment', authenticateToken, authorizeRoles('ADMIN'), createEquipment);

/**
 * @swagger
 * /facility/equipment/{id}:
 *   delete:
 *     summary: Xóa thiết bị (Admin)
 *     tags: [Facility]
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
 *         description: Xóa thành công
 */
router.delete('/equipment/:id', authenticateToken, authorizeRoles('ADMIN'), deleteEquipment);

export default router;
