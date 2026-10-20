import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Mở rộng Request để chứa thông tin user
export interface AuthRequest extends Request {
  user?: {
    userId: number;
    role: string;
  };
}

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
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

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret') as { userId: number, role: string };
    if (decoded.role === 'RECEPTIONIST') {
      decoded.role = 'STAFF';
    }
    req.user = decoded;
    next();
  } catch (error: any) {
    const decoded = jwt.decode(token) as { userId: number; role: string } | null;
    if (decoded && decoded.role === 'RECEPTIONIST') {
      decoded.role = 'STAFF';
    }
    const isStaff = decoded?.role === 'STAFF';

    // Cho phép staff thực hiện đối soát và đóng ca ngay cả khi token vừa hết hạn
    const requestPath = (req.baseUrl || '') + (req.path || '');
    if (error.name === 'TokenExpiredError' && isStaff && (requestPath.includes('/shift/close') || requestPath.includes('/shift/current'))) {
      if (decoded && decoded.userId) {
        req.user = decoded;
        return next();
      }
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Phiên đăng nhập đã hết hạn.',
        code: 'TOKEN_EXPIRED',
        role: decoded?.role || null,
        requiresStaffCashout: isStaff,
        redirectTo: '/'
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Token không hợp lệ hoặc đã hết hạn.',
      code: 'INVALID_TOKEN',
      redirectTo: '/'
    });
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
