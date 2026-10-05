import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middlewares/auth.middleware.js';
import jwt from 'jsonwebtoken';
import QRCode from 'qrcode';

const prisma = new PrismaClient();

export class PtController {
  /**
   * 1. Mua gói PT (Yêu cầu phải có Membership ACTIVE)
   * @route POST /api/pt/buy
   */
  static async buyPtPackage(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const { ptPackageId, trainerId } = req.body;

      if (!ptPackageId || !trainerId) {
        return res.status(400).json({ success: false, message: 'Vui lòng cung cấp ptPackageId và trainerId' });
      }

      if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

      const now = new Date();

      // BƯỚC 1: Kiểm tra Membership ACTIVE (ĐIỀU KIỆN TIÊN QUYẾT)
      const activeMembership = await prisma.membership.findFirst({
        where: {
          userId,
          status: 'ACTIVE',
          startDate: { lte: now },
          endDate: { gte: now },
        },
      });

      if (!activeMembership) {
        return res.status(403).json({
          success: false,
          message: 'Bạn phải có gói tập hội viên (Membership) còn hiệu lực mới được phép mua dịch vụ PT!',
        });
      }

      // BƯỚC 2: Kiểm tra Gói PT & PT có tồn tại không
      const ptPackage = await prisma.package.findUnique({
        where: { id: Number(ptPackageId) },
      });

      if (!ptPackage || ptPackage.type !== 'PT') {
        return res.status(404).json({ success: false, message: 'Gói PT không tồn tại' });
      }

      const trainer = await prisma.user.findFirst({
        where: { id: Number(trainerId) }, // Có thể kiểm tra role TRAINER/COACH ở đây
      });

      if (!trainer) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy Huấn luyện viên' });
      }

      // BƯỚC 3: Kích hoạt Gói PT (Tạo Membership mới với type PT và gán coachId)
      // Thời hạn gói PT tính từ bây giờ + durationDays
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + ptPackage.durationDays);

      const newPtSub = await prisma.membership.create({
        data: {
          userId,
          packageId: Number(ptPackageId),
          coachId: Number(trainerId),
          startDate: now,
          endDate,
          remainingSessions: ptPackage.totalPtSessions || 0,
          status: 'ACTIVE',
        },
        include: {
          package: true,
          coach: { select: { fullName: true, email: true } },
        },
      });

      return res.status(201).json({
        success: true,
        message: 'Đăng ký gói PT thành công!',
        data: newPtSub,
      });
    } catch (error: any) {
      console.error('Lỗi mua gói PT:', error);
      return res.status(500).json({ success: false, message: 'Lỗi máy chủ', error: error.message });
    }
  }

  /**
   * 2. Lấy danh sách Lịch Trống / Đã Đặt của PT trong ngày
   * @route GET /api/pt/trainers/:trainerId/slots?date=YYYY-MM-DD
   */
  static async getTrainerSchedule(req: Request, res: Response) {
    try {
      const trainerId = Number(req.params.trainerId);
      const dateStr = req.query.date as string;

      if (!trainerId || !dateStr) {
        return res.status(400).json({ success: false, message: 'Vui lòng cung cấp trainerId và date (YYYY-MM-DD)' });
      }

      const startOfDay = new Date(`${dateStr}T00:00:00.000Z`);
      const endOfDay = new Date(`${dateStr}T23:59:59.999Z`);

      // Lấy tất cả lịch đã đặt của Trainer trong ngày đó
      const bookedSlots = await prisma.booking.findMany({
        where: {
          coachId: trainerId,
          status: { in: ['UPCOMING', 'CONFIRMED'] },
          startTime: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
        select: { startTime: true },
      });

      const bookedHours = bookedSlots.map((b) => {
        const h = new Date(b.startTime).getUTCHours();
        return `${h < 10 ? '0' : ''}${h}:00`;
      });

      const fixedTimeSlots = [
        '08:00', '09:00', '10:00', '11:00',
        '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'
      ];

      const now = new Date();

      const slotsResult = fixedTimeSlots.map((time) => {
        const slotDateTime = new Date(`${dateStr}T${time}:00.000Z`);
        const isBooked = bookedHours.includes(time);
        const isPast = slotDateTime < now;

        let status = 'AVAILABLE';
        let isAvailable = true;

        if (isBooked) {
          status = 'BOOKED';
          isAvailable = false;
        } else if (isPast) {
          status = 'EXPIRED';
          isAvailable = false;
        }

        return {
          startTime: time,
          endTime: `${Number(time.split(':')[0]) + 1}:00`,
          status: status,
          isAvailable: isAvailable,
        };
      });

      return res.status(200).json({
        success: true,
        date: dateStr,
        trainerId,
        slots: slotsResult,
      });
    } catch (error: any) {
      console.error('Lỗi lấy lịch PT:', error);
      return res.status(500).json({ success: false, message: 'Lỗi tải thời gian biểu' });
    }
  }

  /**
   * 3. Đặt lịch tập với PT
   * @route POST /api/pt/booking
   */
  static async createBooking(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const { ptSubscriptionId, bookingDate, note } = req.body;

      if (!ptSubscriptionId || !bookingDate || !userId) {
        return res.status(400).json({ success: false, message: 'Vui lòng cung cấp gói PT và thời gian đặt lịch' });
      }

      const targetDate = new Date(bookingDate);
      if (targetDate <= new Date()) {
        return res.status(400).json({ success: false, message: 'Không thể đặt lịch trong quá khứ' });
      }

      // BƯỚC 1: Kiểm tra Gói PT của User
      const ptSub = await prisma.membership.findFirst({
        where: {
          id: Number(ptSubscriptionId),
          userId,
          status: 'ACTIVE',
          coachId: { not: null }
        },
      });

      if (!ptSub || !ptSub.coachId) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy gói PT còn hiệu lực' });
      }

      if (ptSub.remainingSessions !== null && ptSub.remainingSessions <= 0) {
        return res.status(400).json({ success: false, message: 'Gói PT của bạn đã hết số buổi khả dụng' });
      }

      // BƯỚC 2: Kiểm tra chống Trùng lịch ca tập (+/- 50 phút)
      const startTimeWindow = new Date(targetDate.getTime() - 50 * 60 * 1000);
      const endTimeWindow = new Date(targetDate.getTime() + 50 * 60 * 1000);

      const existingBooking = await prisma.booking.findFirst({
        where: {
          coachId: ptSub.coachId,
          status: { in: ['UPCOMING', 'CONFIRMED'] },
          startTime: {
            gte: startTimeWindow,
            lte: endTimeWindow,
          },
        },
      });

      if (existingBooking) {
        return res.status(409).json({ success: false, message: 'Huấn luyện viên đã có lịch tập vào khung giờ này!' });
      }

      // BƯỚC 3: Lưu Lịch hẹn Booking
      const endDate = new Date(targetDate.getTime() + 60 * 60 * 1000); // Mặc định tập 60 phút
      const booking = await prisma.booking.create({
        data: {
          type: 'PT',
          memberId: userId,
          coachId: ptSub.coachId,
          membershipId: ptSub.id,
          startTime: targetDate,
          endTime: endDate,
          status: 'UPCOMING',
          absenceReason: note || '',
        },
      });

      return res.status(201).json({
        success: true,
        message: 'Đặt lịch thành công! Vui lòng chờ PT xác nhận.',
        data: booking,
      });
    } catch (error: any) {
      console.error('Lỗi đặt lịch:', error);
      return res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
    }
  }

  /**
   * 4. PT/Admin Cập nhật Trạng thái Lịch
   * @route PATCH /api/pt/booking/:id/status
   */
  static async updateBookingStatus(req: Request, res: Response) {
    try {
      const bookingId = Number(req.params.id);
      const { status } = req.body; // 'CONFIRMED' | 'CANCELLED' | 'COMPLETED'

      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: { membership: true },
      });

      if (!booking) {
        return res.status(404).json({ success: false, message: 'Lịch tập không tồn tại' });
      }

      // Nếu xác nhận HOÀN THÀNH buổi tập -> Trừ 1 lượt tập
      if (status === 'COMPLETED' && booking.status !== 'COMPLETED') {
        const result = await prisma.$transaction(async (tx) => {
          const updatedBooking = await tx.booking.update({
            where: { id: bookingId },
            data: { status: 'COMPLETED' },
          });

          if (booking.membership && booking.membership.remainingSessions !== null) {
            const newRemaining = booking.membership.remainingSessions - 1;
            const updatedSub = await tx.membership.update({
              where: { id: booking.membershipId! },
              data: {
                remainingSessions: newRemaining,
                status: newRemaining <= 0 ? 'COMPLETED' : 'ACTIVE',
              },
            });
            return { updatedBooking, updatedSub };
          }
          return { updatedBooking };
        });

        return res.status(200).json({
          success: true,
          message: 'Hoàn thành buổi tập! Đã tự động trừ 1 lượt trong gói PT.',
          data: result,
        });
      }

      // Cập nhật trạng thái thông thường
      const updated = await prisma.booking.update({
        where: { id: bookingId },
        data: { status },
      });

      return res.status(200).json({
        success: true,
        message: `Đã cập nhật trạng thái lịch tập thành: ${status}`,
        data: updated,
      });
    } catch (error: any) {
      console.error('Lỗi cập nhật booking:', error);
      return res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
    }
  }

  /**
   * 5. Xem danh sách Lịch tập của tôi
   * @route GET /api/pt/my-bookings
   */
  static async getMyBookings(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
      
      const role = req.user?.role; // 'MEMBER' hoặc 'COACH' / 'ADMIN'

      const whereCondition = (role === 'COACH' || role === 'TRAINER') 
        ? { coachId: Number(userId), type: 'PT' } 
        : { memberId: Number(userId), type: 'PT' };

      const bookings = await prisma.booking.findMany({
        where: whereCondition,
        include: {
          member: { select: { fullName: true, phone: true } },
          coach: { select: { fullName: true, phone: true } },
          membership: { include: { package: { select: { name: true } } } },
        },
        orderBy: { startTime: 'desc' },
      });

      return res.status(200).json({ success: true, data: bookings });
    } catch (error: any) {
      console.error('Lỗi tải danh sách lịch:', error);
      return res.status(500).json({ success: false, message: 'Lỗi tải danh sách lịch hẹn' });
    }
  }

  /**
   * 6. PT TẠO MÃ QR CHECK-IN CHO BUỔI TẬP
   * @route POST /api/pt/booking/:id/generate-session-qr
   */
  static async generateSessionQr(req: AuthRequest, res: Response) {
    try {
      const trainerId = req.user?.userId;
      const bookingId = Number(req.params.id);

      if (!trainerId) return res.status(401).json({ success: false, message: 'Unauthorized' });

      const booking = await prisma.booking.findUnique({
        where: { id: bookingId }
      });

      if (!booking || booking.coachId !== trainerId) {
        return res.status(403).json({ success: false, message: 'Bạn không có quyền thao tác trên lịch hẹn này' });
      }

      if (booking.status !== 'UPCOMING' && booking.status !== 'CONFIRMED') {
        return res.status(400).json({ success: false, message: `Không thể tạo mã QR cho lịch hẹn trạng thái: ${booking.status}` });
      }

      // Có thể thêm điều kiện thời gian: chỉ cho phép tạo trước/sau 15 phút. (Bỏ qua để dễ test)

      const qrToken = jwt.sign(
        { bookingId, trainerId },
        process.env.JWT_SECRET as string,
        { expiresIn: '90s' }
      );

      // Lưu vào DB
      await prisma.booking.update({
        where: { id: bookingId },
        data: { sessionQrToken: qrToken }
      });

      const qrImageBase64 = await QRCode.toDataURL(qrToken);

      return res.status(200).json({
        success: true,
        message: 'Tạo mã QR thành công (Hiệu lực 90 giây)',
        data: { token: qrToken, qrCodeImage: qrImageBase64 }
      });
    } catch (error: any) {
      console.error('Lỗi tạo QR PT:', error);
      return res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
    }
  }

  /**
   * 7. HỘI VIÊN QUÉT QR BẮT ĐẦU BUỔI TẬP
   * @route POST /api/pt/booking/start-session
   */
  static async startSessionWithQr(req: AuthRequest, res: Response) {
    try {
      const memberId = req.user?.userId;
      const { qrToken } = req.body;

      if (!memberId) return res.status(401).json({ success: false, message: 'Unauthorized' });
      if (!qrToken) return res.status(400).json({ success: false, message: 'Thiếu qrToken' });

      // Giải mã token
      let decoded: any;
      try {
        decoded = jwt.verify(qrToken, process.env.JWT_SECRET as string);
      } catch (err) {
        return res.status(400).json({ success: false, message: 'Mã QR không hợp lệ hoặc đã hết hạn' });
      }

      const { bookingId, trainerId } = decoded;

      const booking = await prisma.booking.findUnique({
        where: { id: bookingId }
      });

      if (!booking || booking.memberId !== memberId) {
        return res.status(403).json({ success: false, message: 'Mã QR này không dành cho lịch hẹn của bạn' });
      }

      // Check replay attack or token matching
      if (booking.sessionQrToken !== qrToken) {
        return res.status(400).json({ success: false, message: 'Mã QR cũ đã không còn hiệu lực' });
      }

      // Đổi trạng thái -> IN_PROGRESS
      const updated = await prisma.booking.update({
        where: { id: bookingId },
        data: { 
          status: 'IN_PROGRESS',
          sessionQrToken: null // Xóa token để tránh quét lại
        }
      });

      return res.status(200).json({
        success: true,
        message: 'Quét mã thành công! Buổi tập đã bắt đầu.',
        data: updated
      });
    } catch (error: any) {
      console.error('Lỗi quét QR PT:', error);
      return res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
    }
  }

  /**
   * 8. PT KẾT THÚC BUỔI TẬP & TRỪ SỐ BUỔI
   * @route POST /api/pt/booking/:id/complete-session
   */
  static async completeSession(req: AuthRequest, res: Response) {
    try {
      const trainerId = req.user?.userId;
      const bookingId = Number(req.params.id);

      if (!trainerId) return res.status(401).json({ success: false, message: 'Unauthorized' });

      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: { membership: true }
      });

      if (!booking || booking.coachId !== trainerId) {
        return res.status(403).json({ success: false, message: 'Bạn không có quyền thao tác trên lịch hẹn này' });
      }

      if (booking.status !== 'IN_PROGRESS') {
        return res.status(400).json({ success: false, message: 'Chỉ có thể kết thúc lịch hẹn đang trong trạng thái IN_PROGRESS (Đang tập)' });
      }

      const result = await prisma.$transaction(async (tx) => {
        const updatedBooking = await tx.booking.update({
          where: { id: bookingId },
          data: { status: 'COMPLETED' },
        });

        if (booking.membership && booking.membership.remainingSessions !== null) {
          const newRemaining = booking.membership.remainingSessions - 1;
          const updatedSub = await tx.membership.update({
            where: { id: booking.membershipId! },
            data: {
              remainingSessions: newRemaining,
              status: newRemaining <= 0 ? 'COMPLETED' : 'ACTIVE',
            },
          });
          return { updatedBooking, updatedSub };
        }
        return { updatedBooking };
      });

      return res.status(200).json({
        success: true,
        message: 'Hoàn thành buổi tập! Đã tự động trừ 1 lượt trong gói PT.',
        data: result,
      });

    } catch (error: any) {
      console.error('Lỗi complete session PT:', error);
      return res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
    }
  }
}
