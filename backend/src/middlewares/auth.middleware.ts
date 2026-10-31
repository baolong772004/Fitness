import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../config/prisma.js';

// Mở rộng Request để chứa thông tin user
export interface AuthRequest extends Request {
  user?: {
    userId: number;
    role: string;
  };
}

export const authenticateToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. No token provided.',
      code: 'UNAUTHORIZED',
      redirectTo: '/'
    });
  }

  let decoded: { userId: number; role: string };
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret') as { userId: number; role: string };
  } catch (error: any) {
    const expiredToken = error?.name === 'TokenExpiredError';
    const tokenPayload = jwt.decode(token) as { userId?: number; role?: string } | null;
    const tokenRole = tokenPayload?.role === 'RECEPTIONIST' ? 'STAFF' : tokenPayload?.role;
    const isStaff = tokenRole === 'STAFF';

    // Staff can finish shift reconciliation after their session expires.
    const requestPath = (req.baseUrl || '') + (req.path || '');
    const isShiftCashoutRequest = requestPath.includes('/shift/close') || requestPath.includes('/shift/current');
    if (expiredToken && isStaff && isShiftCashoutRequest && tokenPayload?.userId) {
      try {
        const user = await prisma.user.findUnique({
          where: { id: tokenPayload.userId },
          select: { role: true },
        });
        if (user && (user.role === 'STAFF' || user.role === 'RECEPTIONIST')) {
          req.user = { userId: tokenPayload.userId, role: 'STAFF' };
          return next();
        }
      } catch (lookupError) {
        return next(lookupError);
      }
    }

    if (expiredToken) {
      return res.status(401).json({
        success: false,
        message: 'Phiên đăng nhập đã hết hạn.',
        code: 'TOKEN_EXPIRED',
        role: tokenRole || null,
        requiresStaffCashout: isStaff,
        redirectTo: '/',
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Token không hợp lệ hoặc đã hết hạn.',
      code: 'INVALID_TOKEN',
      redirectTo: '/',
    });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { role: true, mustChangePassword: true },
    });
    if (!user) {
      return res.status(403).json({ success: false, message: 'Tài khoản không còn tồn tại.' });
    }
    if (user.mustChangePassword && !req.originalUrl.split('?')[0].endsWith('/auth/change-password')) {
      return res.status(403).json({
        success: false,
        code: 'PASSWORD_CHANGE_REQUIRED',
        message: 'Vui lòng đổi mật khẩu tạm thời trước khi tiếp tục.'
      });
    }

    req.user = {
      userId: decoded.userId,
      role: user.role === 'RECEPTIONIST' ? 'STAFF' : user.role,
    };
    return next();
  } catch (error) {
    return next(error);
  }
};

export const authorizeRoles = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Forbidden. You do not have permission to perform this action.' 
      });
    }
    next();
  };
};
