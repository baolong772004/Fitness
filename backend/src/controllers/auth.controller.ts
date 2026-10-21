import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service.js';
import { z } from 'zod';
import { AuthRequest } from '../middlewares/auth.middleware.js';

// Validation Schemas
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  fullName: z.string().min(2),
  phone: z.string().optional()
});

export class AuthController {
  static async register(req: Request, res: Response) {
    try {
      const validatedData = registerSchema.parse(req.body);
      const user = await AuthService.register(validatedData);
      
      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: user
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation failed', errors: error.issues });
      }
      if (error.message === 'Email already exists') {
        return res.status(400).json({ success: false, message: error.message });
      }
      res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
  }

  static async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email and password are required' });
      }

      const result = await AuthService.login({ email, password });
      
      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: result
      });
    } catch (error: any) {
      if (error.message === 'Invalid email or password' || error.message === 'Account is suspended') {
        return res.status(401).json({ success: false, message: error.message });
      }
      res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
  }

  static async changePassword(req: AuthRequest, res: Response) {
    try {
      const { oldPassword, newPassword } = req.body;
      const userId = req.user?.userId;

      if (!userId || !oldPassword || !newPassword) {
        return res.status(400).json({ success: false, message: 'Missing required fields' });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
      }

      await AuthService.changePassword(userId, oldPassword, newPassword);
      
      res.status(200).json({ success: true, message: 'Password changed successfully' });
    } catch (error: any) {
      if (error.message === 'Incorrect old password') {
        return res.status(400).json({ success: false, message: error.message });
      }
      res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
  }

  static async forgotPassword(req: Request, res: Response) {
    try {
      const { email } = req.body;
      if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

      const resetToken = await AuthService.forgotPassword(email);
      
      res.status(200).json({ 
        success: true, 
        message: 'Reset token generated (simulating email sent)', 
        data: { resetToken } // Trong thực tế không trả token về client mà gửi qua email
      });
    } catch (error: any) {
      if (error.message === 'User with this email does not exist') {
        return res.status(404).json({ success: false, message: error.message });
      }
      res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
  }

  static async resetPassword(req: Request, res: Response) {
    try {
      const { resetToken, newPassword } = req.body;
      if (!resetToken || !newPassword || newPassword.length < 6) {
        return res.status(400).json({ success: false, message: 'Invalid input data' });
      }

      await AuthService.resetPassword(resetToken, newPassword);
      
      res.status(200).json({ success: true, message: 'Password reset successfully' });
    } catch (error: any) {
      return res.status(400).json({ success: false, message: error.message });
    }
  }

  static async googleLogin(req: Request, res: Response) {
    try {
      const { idToken } = req.body;
      if (!idToken) {
        return res.status(400).json({ success: false, message: 'Google idToken is required' });
      }

      const result = await AuthService.googleLogin(idToken);
      
      res.status(200).json({
        success: true,
        message: 'Google login successful',
        data: result
      });
    } catch (error: any) {
      if (error.message === 'Invalid Google Token' || error.message.includes('suspended')) {
        return res.status(401).json({ success: false, message: error.message });
      }
      res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
  }
}
