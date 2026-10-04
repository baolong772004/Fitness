import { Router } from 'express';
import { PackageController } from '../controllers/package.controller.js';
import { authenticateToken, authorizeRoles } from '../middlewares/auth.middleware.js';

const router = Router();

/**
 * @swagger
 * /packages:
 *   post:
 *     summary: Tạo gói tập mới (Chỉ ADMIN, STAFF)
 *     tags: [Packages]
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
 *               type:
 *                 type: string
 *                 enum: [MEMBERSHIP, PT]
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *               durationDays:
 *                 type: integer
 *               trialPtSessions:
 *                 type: integer
 *               totalPtSessions:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Tạo thành công
 */
router.post('/', authenticateToken, authorizeRoles('ADMIN', 'STAFF'), PackageController.createPackage);

/**
 * @swagger
 * /packages:
 *   get:
 *     summary: Lấy danh sách gói tập
 *     tags: [Packages]
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [MEMBERSHIP, PT]
 *         description: Lọc theo loại gói
 *       - in: query
 *         name: includeInactive
 *         schema:
 *           type: boolean
 *         description: Trả về cả gói đã ẩn (Mặc định false)
 *     responses:
 *       200:
 *         description: Thành công
 */
router.get('/', PackageController.getPackages);

/**
 * @swagger
 * /packages/{id}:
 *   get:
 *     summary: Lấy chi tiết gói tập
 *     tags: [Packages]
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
 *         description: Không tìm thấy
 */
router.get('/:id', PackageController.getPackageById);

/**
 * @swagger
 * /packages/{id}:
 *   put:
 *     summary: Cập nhật gói tập (Chỉ ADMIN, STAFF)
 *     tags: [Packages]
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
 *               name:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [MEMBERSHIP, PT]
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *               durationDays:
 *                 type: integer
 *               trialPtSessions:
 *                 type: integer
 *               totalPtSessions:
 *                 type: integer
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Thành công
 */
router.put('/:id', authenticateToken, authorizeRoles('ADMIN', 'STAFF'), PackageController.updatePackage);

/**
 * @swagger
 * /packages/{id}:
 *   delete:
 *     summary: Xóa mềm gói tập (Chỉ ADMIN)
 *     tags: [Packages]
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
router.delete('/:id', authenticateToken, authorizeRoles('ADMIN'), PackageController.deletePackage);

export default router;
