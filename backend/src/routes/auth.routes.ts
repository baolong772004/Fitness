import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { AuthController } from '../controllers/auth.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';

const router = Router();

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               fullName:
 *                 type: string
 *               phone:
 *                 type: string
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Validation failed or email exists
 */
router.post('/register', AuthController.register);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login to get access token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', AuthController.login);

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     summary: Request password reset token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Reset token generated
 */
router.post('/forgot-password', AuthController.forgotPassword);

/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     summary: Reset password with token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               resetToken:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password reset successfully
 */
router.post('/reset-password', AuthController.resetPassword);

/**
 * @swagger
 * /auth/change-password:
 *   post:
 *     summary: Change password for logged in user
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               oldPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password changed successfully
 */
router.post('/change-password', authenticateToken, AuthController.changePassword);

/**
 * @swagger
 * /auth/google:
 *   post:
 *     summary: Login with Google idToken
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               idToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Google login successful
 *       400:
 *         description: Missing idToken
 *       401:
 *         description: Invalid Token or Account suspended
 */
router.post('/google', AuthController.googleLogin);

/**
 * @swagger
 * /auth/verify-session:
 *   get:
 *     summary: Kiểm tra tính hợp lệ và thời hạn phiên đăng nhập hiện tại
 *     tags: [Auth]
 */
router.get('/verify-session', (req: Request, res: Response) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Không tìm thấy phiên đăng nhập.',
      code: 'NO_TOKEN',
      redirectTo: '/'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret') as { userId: number; role: string; exp?: number };
    const role = decoded.role === 'RECEPTIONIST' ? 'STAFF' : decoded.role;
    return res.status(200).json({
      success: true,
      data: {
        userId: decoded.userId,
        role: role,
        expiresIn: decoded.exp ? decoded.exp - Math.floor(Date.now() / 1000) : null
      }
    });
  } catch (error: any) {
    const decoded = jwt.decode(token) as { userId: number; role: string } | null;
    const role = decoded?.role === 'RECEPTIONIST' ? 'STAFF' : decoded?.role;
    const isStaff = role === 'STAFF';

    return res.status(401).json({
      success: false,
      message: 'Phiên đăng nhập đã hết hạn.',
      code: 'TOKEN_EXPIRED',
      role: role || null,
      requiresStaffCashout: isStaff,
      redirectTo: '/'
    });
  }
});

export default router;
