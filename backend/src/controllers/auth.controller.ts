import { Request, Response } from 'express';
import { AuthError, AuthService } from '../services/auth.service.js';
import { z } from 'zod';
import { AuthRequest } from '../middlewares/auth.middleware.js';

const registerSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(6),
  fullName: z.string().trim().min(2),
  phone: z.string().optional(),
});

const emailSchema = z.object({
  email: z.string().trim().email(),
});

const verifyOtpSchema = z.object({
  email: z.string().trim().email(),
  otp: z.string().trim().regex(/^\d{6}$/, 'Mã OTP phải gồm 6 chữ số.'),
});

const resetPasswordSchema = z.object({
  resetToken: z.string().trim().min(1),
  newPassword: z.string().min(6),
});

function handleAuthError(res: Response, error: any) {
  if (error instanceof z.ZodError) {
    return res.status(400).json({
      success: false,
      code: 'VALIDATION_ERROR',
      message: error.issues[0]?.message || 'Validation failed',
      errors: error.issues,
    });
  }
  if (error instanceof AuthError) {
    return res.status(error.statusCode).json({
      success: false,
      code: error.code,
      message: error.message,
      ...(error.data ? { data: error.data } : {}),
    });
  }
  return res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: error?.message,
  });
}

export class AuthController {
  static async register(req: Request, res: Response) {
    try {
      const validatedData = registerSchema.parse(req.body) as {
        email: string;
        password: string;
        fullName: string;
        phone?: string;
      };
      const result = await AuthService.register(validatedData);

      return res.status(201).json({
        success: true,
        message: 'Đăng ký thành công. Vui lòng kiểm tra email để nhập mã OTP xác thực.',
        data: result,
      });
    } catch (error: any) {
      return handleAuthError(res, error);
    }
  }

  static async verifyRegisterOtp(req: Request, res: Response) {
    try {
      const { email, otp } = verifyOtpSchema.parse(req.body);
      const result = await AuthService.verifyRegisterOtp(email, otp);

      return res.status(200).json({
        success: true,
        message: 'Xác thực email thành công.',
        data: result,
      });
    } catch (error: any) {
      return handleAuthError(res, error);
    }
  }

  static async resendRegisterOtp(req: Request, res: Response) {
    try {
      const { email } = emailSchema.parse(req.body);
      const result = await AuthService.resendRegisterOtp(email);

      return res.status(200).json({
        success: true,
        message: 'Mã OTP mới đã được gửi về email của bạn.',
        data: result,
      });
    } catch (error: any) {
      return handleAuthError(res, error);
    }
  }

  static async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email and password are required' });
      }

      const result = await AuthService.login({ email, password });

      return res.status(200).json({
        success: true,
        message: 'Login successful',
        data: result,
      });
    } catch (error: any) {
      return handleAuthError(res, error);
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
        return res.status(400).json({ success: false, message: 'Mật khẩu mới cần ít nhất 6 ký tự.' });
      }

      await AuthService.changePassword(userId, oldPassword, newPassword);

      return res.status(200).json({ success: true, message: 'Password changed successfully' });
    } catch (error: any) {
      return handleAuthError(res, error);
    }
  }

  static async forgotPassword(req: Request, res: Response) {
    try {
      const { email } = emailSchema.parse(req.body);
      const result = await AuthService.forgotPassword(email);

      return res.status(200).json({
        success: true,
        message: 'Mã OTP đặt lại mật khẩu đã được gửi về email của bạn.',
        data: result,
      });
    } catch (error: any) {
      return handleAuthError(res, error);
    }
  }

  static async verifyForgotPasswordOtp(req: Request, res: Response) {
    try {
      const { email, otp } = verifyOtpSchema.parse(req.body);
      const result = await AuthService.verifyForgotPasswordOtp(email, otp);

      return res.status(200).json({
        success: true,
        message: 'Xác thực OTP thành công. Vui lòng nhập mật khẩu mới.',
        data: result,
      });
    } catch (error: any) {
      return handleAuthError(res, error);
    }
  }

  static async resetPassword(req: Request, res: Response) {
    try {
      const { resetToken, newPassword } = resetPasswordSchema.parse(req.body);
      await AuthService.resetPassword(resetToken, newPassword);

      return res.status(200).json({ success: true, message: 'Password reset successfully' });
    } catch (error: any) {
      return handleAuthError(res, error);
    }
  }

  static async googleLogin(req: Request, res: Response) {
    try {
      const { idToken } = req.body;
      if (!idToken) {
        return res.status(400).json({ success: false, message: 'Google idToken is required' });
      }

      const result = await AuthService.googleLogin(idToken);

      return res.status(200).json({
        success: true,
        message: 'Google login successful',
        data: result,
      });
    } catch (error: any) {
      return handleAuthError(res, error);
    }
  }
}
