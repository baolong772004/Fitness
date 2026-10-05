import { Router } from 'express';
import { createTicket, replyTicket, getTickets } from '../controllers/support.controller.js';
import { authenticateToken, authorizeRoles } from '../middlewares/auth.middleware.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Support
 *   description: Quản lý Yêu cầu hỗ trợ (Helpdesk/Ticket)
 */

/**
 * @swagger
 * /support:
 *   post:
 *     summary: Gửi yêu cầu hỗ trợ mới (Member)
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               subject:
 *                 type: string
 *               message:
 *                 type: string
 *     responses:
 *       201:
 *         description: Gửi thành công
 */
router.post('/', authenticateToken, createTicket);

/**
 * @swagger
 * /support:
 *   get:
 *     summary: Lấy danh sách Ticket
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Trả về danh sách Ticket (Member chỉ thấy của mình, Staff thấy tất cả)
 */
router.get('/', authenticateToken, getTickets);

/**
 * @swagger
 * /support/{id}/reply:
 *   patch:
 *     summary: Phản hồi Yêu cầu hỗ trợ (Staff/Admin)
 *     tags: [Support]
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
 *               reply:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [IN_PROGRESS, RESOLVED, CLOSED]
 *     responses:
 *       200:
 *         description: Phản hồi thành công
 */
router.patch('/:id/reply', authenticateToken, authorizeRoles('STAFF', 'ADMIN'), replyTicket);

export default router;
