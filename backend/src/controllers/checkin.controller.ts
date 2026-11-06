import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../config/prisma.js';
import { AuthRequest } from '../middlewares/auth.middleware.js';
import jwt from 'jsonwebtoken';
import QRCode from 'qrcode';
import { reconcileGymMembershipStates } from '../services/membership.service.js';
import { lockGymMember } from '../services/gymMembershipLock.service.js';
import { createUserNotification } from '../services/notification.service.js';


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

      // Kiểm tra Anti-Passback (mặc định 30 phút giữa các lần check-in thành công để chống quẹt trùng / chia sẻ thẻ)
      const antiPassbackMinutes = 30;
      const antiPassbackCutoff = new Date(currentDate.getTime() - antiPassbackMinutes * 60 * 1000);
      const recentCheckIn = await prisma.checkIn.findFirst({
        where: {
          memberId: userId,
          status: 'SUCCESS',
          checkInTime: { gte: antiPassbackCutoff },
        },
        orderBy: { checkInTime: 'desc' },
      });

      // Bỏ qua Anti-Passback nếu hội viên vừa được quầy lễ tân mở bảo lưu hôm nay
      let isRecentlyUnfrozen = false;
      if (recentCheckIn) {
        const todayStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
        const unfreezeLog = await prisma.actionLog.findFirst({
          where: {
            action: { in: ['MEMBERSHIP_UNFREEZE_BY_STAFF', 'MEMBERSHIP_AUTO_UNFREEZE'] },
            details: { contains: `"memberId":${userId}` },
            createdAt: { gte: todayStart },
          },
          orderBy: { createdAt: 'desc' },
        });
        if (unfreezeLog) isRecentlyUnfrozen = true;
      }

      if (recentCheckIn && !isRecentlyUnfrozen) {
        const diffMinutes = Math.max(1, Math.ceil((currentDate.getTime() - recentCheckIn.checkInTime.getTime()) / 60000));
        const waitRemaining = Math.max(1, antiPassbackMinutes - diffMinutes);

        await prisma.checkIn.create({
          data: {
            memberId: userId,
            status: 'FAILED',
            method: 'QR_CODE',
            rejectReason: `Anti-Passback: Đã check-in lúc ${recentCheckIn.checkInTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} (cách đây ${diffMinutes} phút)`,
          },
        });

        createUserNotification({
          userId,
          title: 'Điểm danh bị từ chối - Anti-Passback',
          message: `Bạn vừa check-in lúc ${recentCheckIn.checkInTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}. Vui lòng đợi thêm ${waitRemaining} phút nữa trước khi quét lại để đảm bảo an toàn thẻ!`,
        }).catch((e) => console.error('Lỗi gửi push cho user:', e));

        return res.status(429).json({
          success: false,
          status: 'ANTI_PASSBACK',
          message: `Bạn vừa check-in lúc ${recentCheckIn.checkInTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}. Vui lòng đợi thêm ${waitRemaining} phút nữa trước khi quét lại!`,
          data: {
            lastCheckInTime: recentCheckIn.checkInTime,
            waitMinutesRemaining: waitRemaining,
          },
        });
      }

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

        if (!membership) {
          const frozen = await tx.membership.findFirst({
            where: {
              userId,
              status: 'FROZEN',
              package: { type: 'MEMBERSHIP' },
            },
            orderBy: { endDate: 'desc' },
            include: { package: true },
          });
          if (frozen) {
            return { frozenMembership: frozen, checkIn: null, membership: null };
          }
          return null;
        }

        const checkIn = await tx.checkIn.create({
          data: {
            memberId: userId,
            membershipId: membership.id,
            status: 'SUCCESS',
            method: 'QR_CODE',
          },
        });
        return { checkIn, membership, frozenMembership: null };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10000, timeout: 30000 });

      if (result?.frozenMembership) {
        const frozen = result.frozenMembership;
        await prisma.checkIn.create({
          data: {
            memberId: userId,
            status: 'FAILED',
            method: 'QR_CODE',
            rejectReason: `Gói [${frozen.package.name}] đang trong trạng thái BẢO LƯU`,
          },
        });

        // Bắn thông báo Push riêng biệt cho trường hợp FROZEN
        createUserNotification({
          userId,
          title: 'Điểm danh từ chối - Gói đang bảo lưu',
          message: `Lượt check-in lúc ${currentDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} không thành công do gói tập [${frozen.package.name}] của bạn đang trong thời gian BẢO LƯU (đến ngày ${frozen.endDate.toLocaleDateString('vi-VN')}). Vui lòng liên hệ quầy lễ tân để mở lại gói trước khi vào phòng tập!`,
        }).catch((e) => console.error('Lỗi gửi push cho user:', e));

        return res.status(403).json({
          success: false,
          status: 'FROZEN',
          message: `Gói tập [${frozen.package.name}] của bạn hiện đang ở trạng thái BẢO LƯU (đến ngày ${frozen.endDate.toLocaleDateString('vi-VN')}). Vui lòng liên hệ quầy lễ tân để mở lại gói trước khi check-in!`,
          data: {
            isFrozen: true,
            packageName: frozen.package.name,
            endDate: frozen.endDate,
            remainingDays: Math.max(0, Math.ceil((frozen.endDate.getTime() - currentDate.getTime()) / 86400000)),
          },
        });
      }

      if (!result || !result.membership || !result.checkIn) {
        await prisma.checkIn.create({
          data: {
            memberId: userId,
            status: 'FAILED',
            method: 'QR_CODE',
            rejectReason: 'Không có gói hội viên đang hoạt động hoặc gói đã hết hạn',
          },
        });
        return res.status(403).json({
          success: false,
          status: 'NO_ACTIVE_MEMBERSHIP',
          message: 'Bạn không có gói hội viên đang hoạt động hoặc gói đã hết hạn',
        });
      }

      const activeMembership = result.membership;
      const remainingDays = Math.max(0, Math.ceil((activeMembership.endDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24)));

      // Bắn thông báo xác nhận Check-in cho Hội viên
      createUserNotification({
        userId,
        title: 'Điểm danh vào cổng thành công',
        message: `Chào mừng ${user.fullName}! Bạn đã check-in thành công lúc ${currentDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} với gói [${activeMembership.package.name}] (còn ${remainingDays} ngày). Chúc bạn có buổi tập tràn đầy năng lượng!`,
      }).catch((e) => console.error('Lỗi gửi push cho user:', e));

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

      // Tra cứu gói tập hiện tại của hội viên để hiển thị trạng thái tương ứng (ACTIVE, FROZEN)
      const now = new Date();
      const currentMembership = await prisma.membership.findFirst({
        where: {
          userId,
          package: { type: 'MEMBERSHIP' },
          status: { in: ['ACTIVE', 'FROZEN'] },
        },
        orderBy: [{ status: 'asc' }, { endDate: 'desc' }],
        include: { package: true },
      });

      return res.status(200).json({
        message: 'Tạo mã QR thành công',
        data: {
          token: qrToken,
          qrCodeImage: qrImageBase64,
          membership: currentMembership ? {
            id: currentMembership.id,
            packageName: currentMembership.package.name,
            status: currentMembership.status,
            endDate: currentMembership.endDate,
            remainingDays: Math.max(0, Math.ceil((currentMembership.endDate.getTime() - now.getTime()) / 86400000)),
          } : null,
        }
      });
    } catch (error: any) {
      console.error('Lỗi tạo mã QR:', error);
      return res.status(500).json({ message: 'Lỗi server', error: error.message });
    }
  }
}
