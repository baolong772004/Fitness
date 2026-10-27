import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../config/prisma.js';
import { AuthRequest } from '../middlewares/auth.middleware.js';
import jwt from 'jsonwebtoken';
import QRCode from 'qrcode';
import { reconcileGymMembershipStates } from '../services/membership.service.js';
import { lockGymMember } from '../services/gymMembershipLock.service.js';


export class CheckInController {
  /**
   * @route POST /api/checkin
   * @desc Điểm danh tập Gym (Check-in) cho User
   * @access Private (Chỉ MEMBER, hoặc Lễ tân quẹt hộ)
   */
  static async checkIn(req: AuthRequest, res: Response) {
    try {
      // 1. Lấy userId
      let userId = req.user?.userId;
      const { checkinToken } = req.body;

      // Nếu có truyền mã QR (checkinToken) từ lễ tân quét, giải mã JWT để lấy ID của khách
      if (checkinToken) {
        try {
          const decoded: any = jwt.verify(checkinToken, process.env.JWT_SECRET as string);
          userId = decoded.checkInUserId;
        } catch (err) {
          return res.status(400).json({ message: 'Mã QR không hợp lệ hoặc đã hết hạn' });
        }
      }
      
      if (!userId) {
        return res.status(401).json({ message: 'Không xác định được người dùng (Unauthorized)' });
      }

      // Kiểm tra xem User có tồn tại không
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        return res.status(404).json({ message: 'Người dùng không tồn tại trong hệ thống' });
      }

      const currentDate = new Date();
      const result = await prisma.$transaction(async tx => {
        await lockGymMember(tx, userId);
        await reconcileGymMembershipStates(tx, userId, new Date());

        const membership = await tx.membership.findFirst({
          where: {
            userId,
            status: 'ACTIVE',
            startDate: { lte: currentDate },
            endDate: { gte: currentDate },
            package: { type: 'MEMBERSHIP' },
          },
          orderBy: { endDate: 'asc' },
          include: { package: true },
        });

        if (!membership) return null;
        const checkIn = await tx.checkIn.create({
          data: {
            memberId: userId,
            membershipId: membership.id,
            status: 'SUCCESS',
            method: 'QR_CODE',
          },
        });
        return { checkIn, membership };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10000, timeout: 30000 });

      if (!result) {
        await prisma.checkIn.create({
          data: {
            memberId: userId,
            status: 'FAILED',
            method: 'QR_CODE',
            rejectReason: 'Không có gói hội viên đang hoạt động hoặc gói đã hết hạn',
          },
        });
        return res.status(403).json({ message: 'Bạn không có gói hội viên đang hoạt động hoặc gói đã hết hạn' });
      }

      const activeMembership = result.membership;
      const remainingDays = Math.max(0, Math.ceil((activeMembership.endDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24)));
      return res.status(200).json({
        message: 'Check-in thành công! Chúc bạn tập luyện vui vẻ.',
        data: {
          checkInId: result.checkIn.id,
          fullName: user.fullName,
          packageName: activeMembership.package.name,
          remainingDays: remainingDays,
          remainingSessions: activeMembership.remainingSessions !== null ? activeMembership.remainingSessions : 'Không giới hạn'
        }
      });

    } catch (error: any) {
      console.error('Check-in Error:', error);
      return res.status(500).json({ message: 'Lỗi hệ thống khi check-in', error: error.message });
    }
  }

  /**
   * @route GET /api/checkin/history
   * @desc Lấy lịch sử check-in của User đang đăng nhập
   */
  static async getHistory(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) return res.status(401).json({ message: 'Unauthorized' });

      // Phân trang
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;

      const [history, total] = await Promise.all([
        prisma.checkIn.findMany({
          where: { memberId: userId },
          select: {
            id: true,
            membershipId: true,
            checkInTime: true,
            method: true,
            status: true,
            rejectReason: true,
            membership: {
              select: {
                package: { select: { name: true } },
              },
            },
          },
          skip,
          take: limit,
          orderBy: { checkInTime: 'desc' },
        }),
        prisma.checkIn.count({ where: { memberId: userId } })
      ]);

      return res.status(200).json({
        success: true,
        data: history,
        pagination: {
          total,
          page,
          totalPages: Math.ceil(total / limit),
          limit
        }
      });
    } catch (error: any) {
      console.error('Lỗi lấy lịch sử checkin:', error);
      return res.status(500).json({ message: 'Lỗi server', error: error.message });
    }
  }

  /**
   * @route GET /api/checkin/generate-qr
   * @desc Tạo mã QR chứa token sống trong 1 phút để đưa lễ tân quét
   */
  static async generateQR(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) return res.status(401).json({ message: 'Unauthorized' });

      // Tạo một JWT ngắn hạn (1 phút) chứa ID của người dùng
      const qrToken = jwt.sign(
        { checkInUserId: userId },
        process.env.JWT_SECRET as string,
        { expiresIn: '1m' }
      );

      // Tạo chuỗi base64 của ảnh QR code
      const qrImageBase64 = await QRCode.toDataURL(qrToken);

      return res.status(200).json({
        message: 'Tạo mã QR thành công',
        data: {
          token: qrToken,
          qrCodeImage: qrImageBase64
        }
      });
    } catch (error: any) {
      console.error('Lỗi tạo mã QR:', error);
      return res.status(500).json({ message: 'Lỗi server', error: error.message });
    }
  }
}
