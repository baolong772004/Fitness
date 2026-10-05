import { Router } from 'express';
import { getMySchedule, getBookingDetail } from '../controllers/member.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: MemberHub
 *   description: API Quản lý thông tin & Lịch tập cá nhân
 */

/**
 * @swagger
 * /member/my-schedule:
 *   get:
 *     summary: Lấy lịch tập tổng hợp (PT & Group Class)
 *     tags: [MemberHub]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: fromDate
 *         schema:
 *           type: string
 *         description: YYYY-MM-DD
 *       - in: query
 *         name: toDate
 *         schema:
 *           type: string
 *         description: YYYY-MM-DD
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [ALL, PT, GROUP]
 *         description: Phân loại lịch cần lấy
 *     responses:
 *       200:
 *         description: Lịch tập Unified Events
 */
router.get('/my-schedule', authenticateToken, getMySchedule);

/**
 * @swagger
 * /member/booking-detail/{type}/{id}:
 *   get:
 *     summary: Xem chi tiết 1 buổi tập
 *     tags: [MemberHub]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [PT, GROUP]
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Chi tiết buổi tập
 *       404:
 *         description: Không tìm thấy
 */
router.get('/booking-detail/:type/:id', authenticateToken, getBookingDetail);

export default router;
