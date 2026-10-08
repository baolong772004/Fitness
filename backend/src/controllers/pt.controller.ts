import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middlewares/auth.middleware.js';
import jwt from 'jsonwebtoken';
import QRCode from 'qrcode';
import { createUserNotification } from '../services/notification.service.js';
import { closePtChatRoom } from '../sockets/ptChat.socket.js';

const prisma = new PrismaClient();
const PT_CHECKIN_EARLY_WINDOW_MS = 15 * 60 * 1000;

const getPtCheckInWindowError = (
  startTime: Date,
  endTime: Date,
  now = new Date(),
) => {
  if (now.getTime() < startTime.getTime() - PT_CHECKIN_EARLY_WINDOW_MS) {
    return 'Chỉ có thể tạo hoặc quét mã QR trong vòng 15 phút trước giờ tập.';
  }
  if (now.getTime() > endTime.getTime()) {
    return 'Đã qua giờ kết thúc buổi tập, không thể điểm danh.';
  }
  return null;
};

export class PtController {
  /** @route GET /api/pt/trainers */
  static async getAvailableTrainers(req: AuthRequest, res: Response) {
    try {
      const trainers = await prisma.coachProfile.findMany({
        where: {
          status: 'ACTIVE',
          user: { role: { in: ['COACH', 'TRAINER'] } },
        },
        select: {
          userId: true,
          bio: true,
          specialization: true,
          rating: true,
          hourlyRate: true,
          user: {
            select: { fullName: true, avatar: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return res.status(200).json({
        success: true,
        data: trainers.map(({ user, ...trainer }) => ({
          ...trainer,
          fullName: user.fullName,
          avatar: user.avatar,
        })),
      });
    } catch (error: any) {
      console.error('Lỗi lấy danh sách PT:', error);
      return res.status(500).json({
        success: false,
        message: 'Không thể tải danh sách huấn luyện viên',
      });
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

      if (!Number.isSafeInteger(trainerId) || trainerId <= 0 ||
          !dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return res.status(400).json({ success: false, message: 'Vui lòng cung cấp trainerId và date (YYYY-MM-DD)' });
      }

      const calendarDate = new Date(`${dateStr}T00:00:00.000Z`);
      if (Number.isNaN(calendarDate.getTime()) || calendarDate.toISOString().slice(0, 10) !== dateStr) {
        return res.status(400).json({ success: false, message: 'Ngày không hợp lệ' });
      }
      // CoachSchedule HH:mm values are gym local time (Vietnam, UTC+07).
      const startOfDay = new Date(`${dateStr}T00:00:00+07:00`);
      const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
      const coachProfile = await prisma.coachProfile.findUnique({
        where: { userId: trainerId },
        select: { id: true, status: true },
      });
      if (!coachProfile || coachProfile.status !== 'ACTIVE') {
        return res.status(404).json({ success: false, message: 'Không tìm thấy huấn luyện viên đang hoạt động' });
      }

      // Coach schedules use 1=Monday ... 7=Sunday (JavaScript UTC uses 0=Sunday).
      const jsWeekday = calendarDate.getUTCDay();
      const dayOfWeek = jsWeekday === 0 ? 7 : jsWeekday;
      const workingSchedules = await prisma.coachSchedule.findMany({
        where: { coachProfileId: coachProfile.id, dayOfWeek, isAvailable: true },
        select: { startTime: true, endTime: true },
      });

      const bookedSlots = await prisma.booking.findMany({
        where: {
          coachId: trainerId,
          status: { in: ['PENDING', 'UPCOMING', 'CONFIRMED', 'IN_PROGRESS'] },
          startTime: { lt: endOfDay },
          endTime: { gt: startOfDay },
        },
        select: { startTime: true, endTime: true },
      });

      const now = new Date();
      const slotsResult: { startTime: string; endTime: string; status: string; isAvailable: boolean }[] = [];
      for (const schedule of workingSchedules) {
        const toMinutes = (time: string) => {
          const match = /^(\d{2}):(\d{2})$/.exec(time);
          if (!match) return null;
          const hour = Number(match[1]);
          const minute = Number(match[2]);
          if (hour > 23 || minute > 59) return null;
          return hour * 60 + minute;
        };
        const startMinutes = toMinutes(schedule.startTime);
        const endMinutes = toMinutes(schedule.endTime);
        if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) continue;

        for (let start = startMinutes; start + 60 <= endMinutes; start += 60) {
          const end = start + 60;
          const startHour = Math.floor(start / 60);
          const endHour = Math.floor(end / 60);
          const startTime = `${String(startHour).padStart(2, '0')}:${String(start % 60).padStart(2, '0')}`;
          const endTime = `${String(endHour).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`;
          const slotStart = new Date(`${dateStr}T${startTime}:00+07:00`);
          const slotEnd = new Date(`${dateStr}T${endTime}:00+07:00`);
          const isBooked = bookedSlots.some((booking) =>
            booking.startTime < slotEnd && booking.endTime > slotStart,
          );
          const isPast = slotStart <= now;
          const status = isBooked ? 'BOOKED' : isPast ? 'EXPIRED' : 'AVAILABLE';

          slotsResult.push({
            startTime,
            endTime,
            status,
            isAvailable: status === 'AVAILABLE',
          });
        }
      }
      slotsResult.sort((a, b) => a.startTime.localeCompare(b.startTime));

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
          status: { in: ['PENDING', 'UPCOMING', 'CONFIRMED', 'IN_PROGRESS'] },
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
          status: 'PENDING',
          absenceReason: note || '',
        },
      });

      await createUserNotification({
        userId: ptSub.coachId,
        title: 'Yêu cầu lịch tập PT mới',
        message: `Hội viên #${userId} gửi yêu cầu tập lúc ${targetDate.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}. Vui lòng xác nhận hoặc từ chối.`,
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
  static async updateBookingStatus(req: AuthRequest, res: Response) {
    try {
      const bookingId = Number(req.params.id);
      const userId = req.user?.userId;
      const role = req.user?.role;
      const { status } = req.body;

      if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
      if (status !== 'CONFIRMED' && status !== 'REJECTED') {
        return res.status(400).json({ success: false, message: 'Trạng thái cần là CONFIRMED hoặc REJECTED' });
      }

      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: { membership: true },
      });

      if (!booking) {
        return res.status(404).json({ success: false, message: 'Lịch tập không tồn tại' });
      }

      if (!['COACH', 'TRAINER', 'ADMIN'].includes(role ?? '') ||
          (role !== 'ADMIN' && booking.coachId !== userId)) {
        return res.status(403).json({ success: false, message: 'Bạn không có quyền duyệt lịch hẹn này' });
      }
      if (!['PENDING', 'UPCOMING'].includes(booking.status)) {
        return res.status(409).json({ success: false, message: 'Lịch hẹn này đã được xử lý' });
      }

      const updated = await prisma.booking.update({
        where: { id: bookingId },
        data: { status },
      });

      await createUserNotification({
        userId: booking.memberId,
        title: status === 'CONFIRMED' ? 'Lịch tập PT đã được xác nhận' : 'Lịch tập PT bị từ chối',
        message: status === 'CONFIRMED'
          ? `HLV đã xác nhận lịch tập lúc ${booking.startTime.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}.`
          : `HLV không thể nhận lịch tập lúc ${booking.startTime.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}. Bạn có thể chọn ca khác.`,
      });

      return res.status(200).json({
        success: true,
        message: status === 'CONFIRMED' ? 'Đã xác nhận lịch tập' : 'Đã từ chối lịch tập',
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

      if (booking.status !== 'CONFIRMED') {
        return res.status(400).json({ success: false, message: `Không thể tạo mã QR cho lịch hẹn trạng thái: ${booking.status}` });
      }

      const timeError = getPtCheckInWindowError(booking.startTime, booking.endTime);
      if (timeError) return res.status(400).json({ success: false, message: timeError });

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

      if (booking.status !== 'CONFIRMED') {
        return res.status(400).json({ success: false, message: 'Lịch tập cần được PT xác nhận trước khi điểm danh' });
      }

      const timeError = getPtCheckInWindowError(booking.startTime, booking.endTime);
      if (timeError) return res.status(400).json({ success: false, message: timeError });

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

      closePtChatRoom(bookingId);

      await createUserNotification({
        userId: booking.memberId,
        title: 'Buổi tập PT hoàn thành',
        message: 'HLV đã hoàn tất buổi tập. Số buổi còn lại trong gói đã được cập nhật.',
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

  /**
   * 9. BÁO VẮNG / HỦY LỊCH (MEMBER XIN NGHỈ)
   * @route POST /api/pt/booking/:id/mark-absent
   */
  static async markAbsent(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const role = req.user?.role;
      const bookingId = Number(req.params.id);
      const { reason } = req.body;

      if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: { membership: true }
      });

      if (!booking) {
        return res.status(404).json({ success: false, message: 'Lịch tập không tồn tại' });
      }

      // Check quyền
      if (role === 'MEMBER' && booking.memberId !== userId) {
        return res.status(403).json({ success: false, message: 'Không có quyền thao tác trên lịch hẹn này' });
      }
      if (role === 'COACH' && booking.coachId !== userId) {
        return res.status(403).json({ success: false, message: 'Không có quyền thao tác trên lịch hẹn này' });
      }

      if (booking.status !== 'CONFIRMED') {
        return res.status(400).json({ success: false, message: 'Chỉ có thể báo vắng lịch hẹn sắp diễn ra' });
      }

      if (booking.isMakeup) {
         // Không cho vắng có phép nếu đang là buổi học bù -> Mất buổi
         const updated = await prisma.$transaction(async (tx) => {
           const b = await tx.booking.update({
             where: { id: bookingId },
             data: { 
               status: 'ABSENT_NO_REFUND', 
               absenceReason: reason || 'Vắng buổi học bù',
               absenceReportedAt: new Date(),
               cancelledBy: role
             }
           });
           
           if (booking.membershipId && booking.membership && booking.membership.remainingSessions !== null) {
              const newRemaining = booking.membership.remainingSessions - 1;
              await tx.membership.update({
                where: { id: booking.membershipId },
                data: {
                  remainingSessions: newRemaining,
                  status: newRemaining <= 0 ? 'COMPLETED' : 'ACTIVE',
                }
              });
           }
           return b;
         });
         return res.status(200).json({ success: true, message: 'Vắng buổi học bù. Đã trừ buổi tập.', data: updated });
      }

      const now = new Date();
      const bookingTime = new Date(booking.startTime);
      const diffMs = bookingTime.getTime() - now.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);

      // Điều kiện > 2h và còn lượt bù, chưa hết hạn
      const membership = booking.membership;
      if (!membership || membership.status !== 'ACTIVE' || membership.endDate < now) {
         // Hết hạn hoặc k có gói -> ABSENT_NO_REFUND
         const updated = await prisma.$transaction(async (tx) => {
           const b = await tx.booking.update({
             where: { id: bookingId },
             data: { status: 'ABSENT_NO_REFUND', absenceReason: reason, absenceReportedAt: now, cancelledBy: role }
           });
           if (membership && membership.remainingSessions !== null) {
              const newRemaining = membership.remainingSessions - 1;
              await tx.membership.update({
                where: { id: membership.id },
                data: { remainingSessions: newRemaining, status: newRemaining <= 0 ? 'COMPLETED' : 'ACTIVE' }
              });
           }
           return b;
         });
         return res.status(200).json({ success: true, message: 'Gói tập không hợp lệ (hết hạn). Đã trừ buổi.', data: updated });
      }

      // Check thời gian và lượt bù
      const isEligible = (diffHours >= 2) && (membership.usedMakeupCount < membership.maxMakeupAllowed);

      if (isEligible) {
        // Cho phép bù
        const updated = await prisma.$transaction(async (tx) => {
          const b = await tx.booking.update({
            where: { id: bookingId },
            data: { status: 'ABSENT_ELIGIBLE', absenceReason: reason, absenceReportedAt: now, cancelledBy: role }
          });
          
          await tx.membership.update({
             where: { id: membership.id },
             data: { usedMakeupCount: membership.usedMakeupCount + 1 }
          });
          
          // Cấp MakeUpRequest
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 7);
          
          await tx.makeUpRequest.create({
            data: {
              originalBookingId: bookingId,
              status: 'PENDING',
              expiresAt
            }
          });
          
          return b;
        });
        return res.status(200).json({ success: true, message: 'Xác nhận vắng hợp lệ. Đã cấp lượt đặt lịch học bù (hạn 7 ngày).', data: updated });
      } else {
        // Không hợp lệ (Trễ hoặc hết lượt bù)
        const message = diffHours < 2 ? 'Báo vắng quá trễ (<2 tiếng)' : 'Đã hết lượt học bù tối đa của gói';
        
        const updated = await prisma.$transaction(async (tx) => {
           const b = await tx.booking.update({
             where: { id: bookingId },
             data: { status: 'ABSENT_NO_REFUND', absenceReason: reason || message, absenceReportedAt: now, cancelledBy: role }
           });
           
           if (membership && membership.remainingSessions !== null) {
              const newRemaining = membership.remainingSessions - 1;
              await tx.membership.update({
                where: { id: membership.id },
                data: {
                  remainingSessions: newRemaining,
                  status: newRemaining <= 0 ? 'COMPLETED' : 'ACTIVE',
                }
              });
           }
           return b;
        });
        return res.status(200).json({ success: true, message: `${message}. Đã trừ 1 buổi tập.`, data: updated });
      }
    } catch (error: any) {
      console.error('Lỗi mark absent PT:', error);
      return res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
    }
  }

  /**
   * 10. ĐẶT LỊCH HỌC BÙ
   * @route POST /api/pt/booking/schedule-makeup
   */
  static async scheduleMakeup(req: AuthRequest, res: Response) {
     try {
       const userId = req.user?.userId;
       const { originalBookingId, newBookingDate } = req.body;
       
       if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
       if (!originalBookingId || !newBookingDate) {
          return res.status(400).json({ success: false, message: 'Vui lòng cung cấp originalBookingId và newBookingDate' });
       }
       
       const targetDate = new Date(newBookingDate);
       if (targetDate <= new Date()) {
         return res.status(400).json({ success: false, message: 'Không thể đặt lịch học bù trong quá khứ' });
       }

       // 1. Kiểm tra quyền và MakeUpRequest
       const makeUpReq = await prisma.makeUpRequest.findFirst({
         where: { originalBookingId: Number(originalBookingId), status: 'PENDING' },
         include: { originalBooking: true }
       });
       
       if (!makeUpReq || makeUpReq.originalBooking.memberId !== userId) {
         return res.status(404).json({ success: false, message: 'Không tìm thấy lượt học bù khả dụng cho buổi học này' });
       }
       
       if (new Date() > makeUpReq.expiresAt) {
         return res.status(400).json({ success: false, message: 'Lượt học bù đã hết hạn (quá 7 ngày kể từ lúc vắng)' });
       }
       
       // 2. Kiểm tra trùng lịch PT
       const coachId = makeUpReq.originalBooking.coachId;
       if (!coachId) return res.status(400).json({ success: false, message: 'Không xác định được HLV của buổi học này' });
       
       const startTimeWindow = new Date(targetDate.getTime() - 50 * 60 * 1000);
       const endTimeWindow = new Date(targetDate.getTime() + 50 * 60 * 1000);

       const existingBooking = await prisma.booking.findFirst({
         where: {
           coachId: coachId,
           status: { in: ['PENDING', 'UPCOMING', 'CONFIRMED', 'IN_PROGRESS'] },
           startTime: {
             gte: startTimeWindow,
             lte: endTimeWindow,
           },
         },
       });

       if (existingBooking) {
         return res.status(409).json({ success: false, message: 'Huấn luyện viên đã có lịch vào khung giờ này, vui lòng chọn giờ khác!' });
       }
       
       // 3. Tiến hành tạo Booking mới & update trạng thái
       const result = await prisma.$transaction(async (tx) => {
         const endDate = new Date(targetDate.getTime() + 60 * 60 * 1000);
         
         const newBooking = await tx.booking.create({
           data: {
             type: 'PT',
             memberId: userId,
             coachId: coachId,
             membershipId: makeUpReq.originalBooking.membershipId,
             startTime: targetDate,
             endTime: endDate,
             status: 'PENDING',
             isMakeup: true,
             makeupFromId: Number(originalBookingId)
           }
         });
         
         await tx.makeUpRequest.update({
           where: { id: makeUpReq.id },
           data: {
             status: 'APPROVED',
             newBookingId: newBooking.id
           }
         });
         
         await tx.booking.update({
           where: { id: Number(originalBookingId) },
           data: { status: 'MAKEUP_BOOKED' }
         });
         
         return newBooking;
       });

       await createUserNotification({
         userId: coachId,
         title: 'Yêu cầu lịch học bù PT mới',
         message: `Hội viên #${userId} gửi yêu cầu học bù lúc ${targetDate.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}. Vui lòng xác nhận hoặc từ chối.`,
       });
       
       return res.status(201).json({ success: true, message: 'Đặt lịch học bù thành công!', data: result });
       
     } catch (error: any) {
       console.error('Lỗi schedule makeup:', error);
       return res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
     }
  }
}
