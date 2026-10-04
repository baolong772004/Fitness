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

      // 2. Chống Spam: Kiểm tra xem user có check-in thành công trong vòng 5 phút gần nhất không
      const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000);
      const recentCheckIn = await prisma.checkIn.findFirst({
        where: {
          memberId: userId,
          status: 'SUCCESS',
          checkInTime: {
            gte: fiveMinsAgo
          }
        }
      });

      if (recentCheckIn) {
        return res.status(429).json({ message: 'Bạn vừa check-in gần đây, vui lòng thử lại sau ít phút!' });
      }

      // 3. Tìm gói tập (Subscription/Membership) đang ACTIVE và còn hạn
      const currentDate = new Date();
      const activeMembership = await prisma.membership.findFirst({
        where: {
          userId: userId,
          status: 'ACTIVE',
          startDate: { lte: currentDate },
          endDate: { gte: currentDate }
        },
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
            rejectReason: 'Không có gói tập nào đang hoạt động hoặc đã hết hạn'
          }
        });
        return res.status(403).json({ message: 'Bạn không có gói tập nào đang hoạt động hoặc đã hết hạn' });
      }

      // 4. Nếu gói tập tính theo số buổi (Ví dụ gói PT) thì phải còn buổi
      if (activeMembership.remainingSessions !== null) {
        if (activeMembership.remainingSessions <= 0) {
          await prisma.checkIn.create({
            data: {
              memberId: userId,
              status: 'FAILED',
              method: 'QR_CODE',
              rejectReason: 'Đã hết số buổi tập'
            }
          });
          return res.status(403).json({ message: 'Gói tập của bạn đã hết số buổi' });
        }
      }

      // 5. Nếu hợp lệ -> Tạo CheckIn SUCCESS & Trừ số buổi (Nếu có)
      const result = await prisma.$transaction(async (tx) => {
        // Trừ 1 buổi nếu gói đó giới hạn số buổi
        if (activeMembership.remainingSessions !== null && activeMembership.remainingSessions > 0) {
          await tx.membership.update({
            where: { id: activeMembership.id },
            data: { remainingSessions: activeMembership.remainingSessions - 1 }
          });
        }

        // Tạo bản ghi CheckIn
        const newCheckIn = await tx.checkIn.create({
          data: {
            memberId: userId,
            membershipId: activeMembership.id,
            status: 'SUCCESS',
            method: 'QR_CODE'
          }
        });

        return newCheckIn;
      });

      // Tính số ngày còn lại
      const remainingDays = Math.max(0, Math.ceil((activeMembership.endDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24)));

      return res.status(200).json({
        message: 'Check-in thành công! Chúc bạn tập luyện vui vẻ.',
        data: {
          checkInId: result.id,
          fullName: user.fullName,
          packageName: activeMembership.package.name,
          remainingDays: remainingDays,
          remainingSessions: activeMembership.remainingSessions !== null ? activeMembership.remainingSessions - 1 : 'Không giới hạn'
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
