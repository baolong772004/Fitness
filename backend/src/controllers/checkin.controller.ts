import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middlewares/auth.middleware.js';
import jwt from 'jsonwebtoken';
import QRCode from 'qrcode';

const prisma = new PrismaClient();

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

      // 2. Find an eligible gym membership by status and validity dates.
      const currentDate = new Date();
      const activeMembership = await prisma.membership.findFirst({
        where: {
          userId: userId,
          status: { in: ['ACTIVE', 'COMPLETED'] },
          startDate: { lte: currentDate },
          endDate: { gte: currentDate },
          package: { type: 'MEMBERSHIP' }
        },
        orderBy: { endDate: 'asc' },
        include: {
          package: true
        }
      });

      if (!activeMembership) {
        // Ghi lại lịch sử check-in THẤT BẠI
        await prisma.checkIn.create({
          data: {
            memberId: userId,
            status: 'FAILED',
            method: 'QR_CODE',
            rejectReason: 'Không có gói hội viên đang hoạt động hoặc gói đã hết hạn'
          }
        });
        return res.status(403).json({ message: 'Bạn không có gói hội viên đang hoạt động hoặc gói đã hết hạn' });
      }

      // Older PT flows could mark a gym membership COMPLETED after its last
      // included PT session. Restore that membership while recording entry.
      const result = await prisma.$transaction(async (tx) => {
        if (activeMembership.status === 'COMPLETED') {
          await tx.membership.updateMany({
            where: { id: activeMembership.id, status: 'COMPLETED' },
            data: { status: 'ACTIVE' }
          });
        }
        return tx.checkIn.create({
          data: {
            memberId: userId,
            membershipId: activeMembership.id,
            status: 'SUCCESS',
            method: 'QR_CODE'
          }
        });
      });

      // Remaining PT session balance is reported without changing it here.

      const remainingDays = Math.max(0, Math.ceil((activeMembership.endDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24)));

      return res.status(200).json({
        message: 'Check-in thành công! Chúc bạn tập luyện vui vẻ.',
        data: {
          checkInId: result.id,
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
          skip,
          take: limit,
          orderBy: { checkInTime: 'desc' },
          include: {
            membership: {
              include: { package: true }
            }
          }
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
