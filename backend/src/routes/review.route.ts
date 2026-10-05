import { Router } from 'express';
import { createReview, getCoachReviews } from '../controllers/review.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Reviews
 *   description: Đánh giá chất lượng Huấn luyện viên
 */

/**
 * @swagger
 * /reviews:
 *   post:
 *     summary: Member viết đánh giá & chấm sao cho PT
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               coachProfileId:
 *                 type: integer
 *               rating:
 *                 type: integer
 *                 description: Từ 1 đến 5 sao
 *               comment:
 *                 type: string
 *     responses:
 *       201:
 *         description: Đánh giá thành công
 */
router.post('/', authenticateToken, createReview);

/**
 * @swagger
 * /reviews/coach/{coachProfileId}:
 *   get:
 *     summary: Lấy danh sách đánh giá của 1 PT
 *     tags: [Reviews]
 *     parameters:
 *       - in: path
 *         name: coachProfileId
 *         required: true
 *         schema:
 *           type: integer
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
 *         description: Trả về danh sách review
 */
router.get('/coach/:coachProfileId', getCoachReviews);

export default router;
