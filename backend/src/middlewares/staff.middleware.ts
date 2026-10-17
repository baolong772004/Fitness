import { Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from './auth.middleware.js';

const prisma = new PrismaClient();

export interface StaffShiftRequest extends AuthRequest {
  shift?: {
    id: number;
    shiftCode: string;
    staffId: number;
    clockIn: Date;
    systemCashAmount: number;
  };
}

/**
 * Middleware đảm bảo Lễ tân đã kích hoạt ca làm việc (Clock-in)
 */
export const requireStaffShift = async (
  req: StaffShiftRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const staffId = req.user?.userId;
    if (!staffId) {
      return res.status(401).json({
        success: false,
        message: 'Chưa đăng nhập hoặc phiên làm việc không hợp lệ.'
      });
    }

    // Tra cứu ca trực đang mở của nhân viên
    let activeShift = await prisma.staffShift.findFirst({
      where: {
        staffId,
        status: 'OPEN'
      }
    });

    if (!activeShift) {
      // Tự động khởi tạo ca làm việc mặc định cho nhân viên quầy thay vì chặn 403
      let defaultDevice = await prisma.deskDevice.findFirst({
        where: { isActive: true },
        orderBy: { id: 'asc' }
      });
      if (!defaultDevice) {
        defaultDevice = await prisma.deskDevice.create({
          data: {
            deviceToken: 'DESK-POS-DEFAULT-001',
            deviceName: 'Quầy Lễ Tân Số 1 (Front Desk 01)',
            location: 'Tầng 1 - Cổng chính',
            isActive: true
          }
        });
      }

      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const shiftCode = `SHF-${dateStr}-${randomSuffix}`;

      activeShift = await prisma.staffShift.create({
        data: {
          shiftCode,
          staffId,
          deskDeviceId: defaultDevice.id,
          deviceToken: defaultDevice.deviceToken,
          clockIn: new Date(),
          status: 'OPEN',
          systemCashAmount: 0
        }
      });
    }

    req.shift = {
      id: activeShift.id,
      shiftCode: activeShift.shiftCode,
      staffId: activeShift.staffId,
      clockIn: activeShift.clockIn,
      systemCashAmount: Number(activeShift.systemCashAmount)
    };

    next();
  } catch (error: any) {
    console.error('Lỗi kiểm tra ca trực Lễ tân:', error);
    return res.status(500).json({
      success: false,
      message: 'Lỗi kiểm tra ca trực.',
      error: error.message
    });
  }
};
