import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middlewares/auth.middleware.js';
import jwt from 'jsonwebtoken';
import QRCode from 'qrcode';
import { createUserNotification } from '../services/notification.service.js';
import { emitCoachScheduleChanged } from '../sockets/ptChat.socket.js';
import { resolveAutomaticPtNoShow } from '../services/ptNoShow.service.js';
import { createConfirmedPtBooking, createConfirmedPtBookings, lockPtMembership, PtBookingError } from '../services/ptBooking.service.js';
import { availableSlots, localInstant, validDate } from '../services/ptCalendar.service.js';
import { requestCoachScheduleChange } from './ptAvailability.controller.js';

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
          user: { role: { in: ['COACH', 'TRAINER'] }, status: 'ACTIVE' },
        },
        select: {
          id: true,
          userId: true,
          bio: true,
          specialization: true,
          rating: true,
          hourlyRate: true,
          user: {
            select: { fullName: true, email: true, phone: true, avatar: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return res.status(200).json({
        success: true,
        data: trainers.map(({ user, ...trainer }) => ({
          ...trainer,
          fullName: user.fullName,
          email: user.email,
          phone: user.phone,
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

      if (!Number.isSafeInteger(trainerId) || trainerId <= 0 || !validDate(dateStr)) {
        return res.status(400).json({ success: false, message: 'Vui lòng cung cấp trainerId và date (YYYY-MM-DD)' });
      }

      const startOfDay = localInstant(dateStr, 0);
      const endOfDay = localInstant(dateStr, 1440);
      const coachProfile = await prisma.coachProfile.findUnique({
        where: { userId: trainerId },
        select: { id: true, status: true, user: { select: { status: true } } },
      });
      if (!coachProfile || coachProfile.status !== 'ACTIVE' || coachProfile.user.status !== 'ACTIVE') {
        return res.status(404).json({ success: false, message: 'Không tìm thấy huấn luyện viên đang hoạt động' });
      }

      const workingSlots = await availableSlots(prisma, coachProfile.id, dateStr);

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
      for (const { start: slotStart, end: slotEnd, startTime, endTime } of workingSlots) {
          const isBooked = bookedSlots.some((booking) =>
            booking.startTime < slotEnd && booking.endTime > slotStart,
          );
          const isPast = slotStart.getTime() < now.getTime() + 2 * 60 * 60 * 1000;
          const status = isBooked ? 'BOOKED' : isPast ? 'EXPIRED' : 'AVAILABLE';

        slotsResult.push({ startTime, endTime, status, isAvailable: status === 'AVAILABLE' });
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
    const memberId = req.user?.userId;
    const membershipId = Number(req.body?.ptSubscriptionId);
    const start = new Date(req.body?.bookingDate);
    if (!memberId) return res.status(401).json({ success: false, message: 'Chưa đăng nhập.' });
    if (!Number.isSafeInteger(membershipId) || membershipId <= 0 || Number.isNaN(start.getTime())) {
      return res.status(400).json({ success: false, message: 'Gói PT hoặc ca tập không hợp lệ.' });
    }
    try {
      const booking = await createConfirmedPtBooking({
        memberId, membershipId, start,
        note: typeof req.body?.note === 'string' ? req.body.note : undefined,
        coachId: Number(req.body?.coachId),
      });
      emitCoachScheduleChanged(booking.coachId!);
      await Promise.all([
        createUserNotification({ userId: booking.coachId!, title: 'Lịch PT mới đã xác nhận', message: `Hội viên #${memberId} đặt ca ${start.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}.` }),
        createUserNotification({ userId: memberId, title: 'Đặt lịch PT thành công', message: `Ca tập ${start.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })} đã được xác nhận.` }),
      ]);
      return res.status(201).json({ success: true, message: 'Đặt lịch PT thành công, đã tự động xác nhận.', data: booking });
    } catch (error) {
      if (error instanceof PtBookingError) return res.status(error.status).json({ success: false, message: error.message });
      console.error('PT booking failed:', error);
      return res.status(500).json({ success: false, message: 'Không thể đặt lịch PT.' });
    }
  }

  /** @route POST /api/pt/booking/batch */
  static async createBookingsBatch(req: AuthRequest, res: Response) {
    const memberId = req.user?.userId;
    const membershipId = Number(req.body?.ptSubscriptionId);
    const dates = req.body?.bookingDates;
    if (!memberId) return res.status(401).json({ success: false, message: 'Chưa đăng nhập.' });
    if (!Number.isSafeInteger(membershipId) || membershipId <= 0 || !Array.isArray(dates) ||
        dates.length < 1 || dates.length > 20 || dates.some(value => typeof value !== 'string' || Number.isNaN(new Date(value).getTime()))) {
      return res.status(400).json({ success: false, message: 'Chọn từ 1 đến 20 ca PT hợp lệ.' });
    }
    try {
      const bookings = await createConfirmedPtBookings({
        memberId, membershipId, starts: dates.map(value => new Date(value)), coachId: Number(req.body?.coachId),
      });
      const coachId = bookings[0].coachId!;
      try { emitCoachScheduleChanged(coachId); }
      catch (notificationError) { console.error('PT batch schedule notification failed:', notificationError); }
      const firstTime = bookings[0].startTime.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
      await Promise.allSettled([
        createUserNotification({ userId: coachId, title: 'Lịch PT mới đã xác nhận', message: `Hội viên #${memberId} đã đặt ${bookings.length} buổi PT, bắt đầu ${firstTime}.` }),
        createUserNotification({ userId: memberId, title: 'Đặt lịch PT thành công', message: `${bookings.length} buổi PT đã được xác nhận, bắt đầu ${firstTime}.` }),
      ]);
      return res.status(201).json({ success: true, message: `Đã xác nhận ${bookings.length} buổi PT.`, data: bookings });
    } catch (error) {
      if (error instanceof PtBookingError) return res.status(error.status).json({ success: false, message: error.message });
      console.error('PT batch booking failed:', error);
      return res.status(500).json({ success: false, message: 'Không thể đặt các buổi PT.' });
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
      if (status === 'CONFIRMED' && booking.startTime <= new Date()) {
        return res.status(409).json({ success: false, message: 'Buổi tập đã bắt đầu, không thể xác nhận lịch' });
      }

      const claimed = await prisma.booking.updateMany({
        where: { id: bookingId, status: { in: ['PENDING', 'UPCOMING'] } },
        data: { status },
      });
      if (claimed.count !== 1) return res.status(409).json({ success: false, message: 'Lịch PT đã được xử lý.' });
      const updated = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
      if (booking.coachId) emitCoachScheduleChanged(booking.coachId);

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
          member: { select: { id: true, fullName: true, email: true, phone: true, avatar: true } },
          coach: { select: { fullName: true, phone: true } },
          membership: { include: { package: { select: { name: true } } } },
          makeUpRequests: { select: { status: true, expiresAt: true, newBookingId: true }, orderBy: { id: 'desc' } },
          sessionResult: { include: { exercises: true } },
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
   * Lấy hồ sơ các học viên có gói PT đang được Coach hiện tại phụ trách.
   * @route GET /api/pt/my-trainees
   */
  static async getMyTrainees(req: AuthRequest, res: Response) {
    try {
      const coachId = req.user?.userId;
      if (!coachId) return res.status(401).json({ success: false, message: 'Unauthorized' });

      const memberships = await prisma.membership.findMany({
        where: {
          coachId,
          status: 'ACTIVE',
          package: { type: 'PT' },
        },
        select: {
          id: true,
          userId: true,
          startDate: true,
          endDate: true,
          remainingSessions: true,
          package: { select: { id: true, name: true, totalPtSessions: true } },
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              phone: true,
              avatar: true,
              gender: true,
              dateOfBirth: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      const membershipsByUser = new Map<number, typeof memberships>();
      for (const membership of memberships) {
        const userMemberships = membershipsByUser.get(membership.userId) ?? [];
        userMemberships.push(membership);
        membershipsByUser.set(membership.userId, userMemberships);
      }

      const trainees = Array.from(membershipsByUser.values(), (userMemberships) => ({
        ...userMemberships[0].user,
        memberships: userMemberships.map(({ id, startDate, endDate, remainingSessions, package: pkg }) => ({
          id,
          startDate,
          endDate,
          remainingSessions,
          package: pkg,
        })),
      }));

      return res.status(200).json({ success: true, data: trainees });
    } catch (error: any) {
      console.error('Lỗi tải hồ sơ học viên của Coach:', error);
      return res.status(500).json({ success: false, message: 'Lỗi tải hồ sơ học viên' });
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

      const now = new Date();
      const activeGymMembership = await prisma.membership.findFirst({
        where: {
          userId: memberId,
          status: { in: ['ACTIVE', 'PENDING_ACTIVATION'] },
          startDate: { lte: now },
          endDate: { gte: now },
          package: { type: 'MEMBERSHIP' },
        },
        select: { id: true },
      });
      if (!activeGymMembership) {
        return res.status(403).json({
          success: false,
          message: 'Cần có gói hội viên gym còn hạn để bắt đầu buổi PT.',
        });
      }

      // Check replay attack or token matching
      if (booking.sessionQrToken !== qrToken) {
        return res.status(400).json({ success: false, message: 'Mã QR cũ đã không còn hiệu lực' });
      }

      // Đổi trạng thái -> IN_PROGRESS
      const claimed = await prisma.booking.updateMany({
        where: { id: bookingId, status: 'CONFIRMED', sessionQrToken: qrToken },
        data: { 
          status: 'IN_PROGRESS',
          sessionQrToken: null // Xóa token để tránh quét lại
        }
      });
      if (claimed.count !== 1) return res.status(409).json({ success: false, message: 'Mã QR đã được sử dụng hoặc lịch đã thay đổi.' });
      const updated = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });

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
        include: { membership: { include: { package: true } } }
      });

      if (!booking || booking.coachId !== trainerId) {
        return res.status(403).json({ success: false, message: 'Bạn không có quyền thao tác trên lịch hẹn này' });
      }

      if (booking.status !== 'IN_PROGRESS') {
        return res.status(400).json({ success: false, message: 'Chỉ có thể kết thúc lịch hẹn đang trong trạng thái IN_PROGRESS (Đang tập)' });
      }
      if (new Date() < booking.endTime) {
        return res.status(409).json({ success: false, message: 'Chỉ có thể hoàn thành sau khi buổi PT kết thúc.' });
      }

      const result = await prisma.$transaction(async (tx) => {
        if (!booking.membershipId) throw new Error('PT_SESSION_BALANCE_MISSING');
        await lockPtMembership(tx, booking.membershipId);
        const claimed = await tx.booking.updateMany({
          where: { id: bookingId, status: 'IN_PROGRESS', endTime: { lte: new Date() } },
          data: { status: 'COMPLETED' },
        });
        if (claimed.count !== 1) return null;

        if (booking.membershipId === null) {
          throw new Error('PT_SESSION_BALANCE_MISSING');
        }
        const debited = await tx.membership.updateMany({
          where: { id: booking.membershipId, remainingSessions: { gt: 0 } },
          data: { remainingSessions: { decrement: 1 } },
        });
        if (debited.count !== 1) throw new Error('PT_SESSION_BALANCE_MISSING');

        let updatedSub = await tx.membership.findUniqueOrThrow({
          where: { id: booking.membershipId },
        });
        if (updatedSub.remainingSessions === 0 && booking.membership?.package.type === 'PT') {
          updatedSub = await tx.membership.update({
            where: { id: booking.membershipId },
            data: { status: 'COMPLETED' },
          });
        }
        const updatedBooking = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
        return { updatedBooking, updatedSub };
      }, { maxWait: 15000, timeout: 20000 });

      if (!result) {
        return res.status(409).json({ success: false, message: 'Buổi tập đã được kết thúc trước đó' });
      }

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
      if (error?.message === 'PT_SESSION_BALANCE_MISSING') {
        return res.status(409).json({ success: false, message: 'Gói PT không còn buổi để trừ; vui lòng liên hệ lễ tân' });
      }
      console.error('Lỗi complete session PT:', error);
      return res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
    }
  }

  static async resolveNoShow(req: AuthRequest, res: Response) {
    const bookingId = Number(req.params.id);
    const staffId = req.user?.userId;
    const resolution = req.body?.resolution;
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';

    if (!staffId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    if (!Number.isSafeInteger(bookingId) || bookingId <= 0 ||
        !['ATTENDED', 'EXCUSED'].includes(resolution) || !reason || reason.length > 500) {
      return res.status(400).json({ success: false, message: 'Cần bookingId, resolution (ATTENDED/EXCUSED) và lý do từ 1 đến 500 ký tự' });
    }

    try {
      const booking = await resolveAutomaticPtNoShow(bookingId, staffId, resolution, reason);
      if (!booking) {
        return res.status(409).json({ success: false, message: 'Buổi tập này không phải no-show tự động còn chờ điều chỉnh' });
      }
      return res.status(200).json({
        success: true,
        message: resolution === 'ATTENDED' ? 'Đã ghi nhận hội viên có tập' : 'Đã hoàn lại 1 buổi PT',
        data: booking,
      });
    } catch (error) {
      console.error('Lỗi điều chỉnh PT no-show:', error);
      return res.status(500).json({ success: false, message: 'Không thể điều chỉnh buổi PT vắng' });
    }
  }

  /**
   * 9. BÁO VẮNG / HỦY LỊCH (MEMBER XIN NGHỈ)
   * @route POST /api/pt/booking/:id/mark-absent
   */
  static async markAbsent(req: AuthRequest, res: Response) {
    const actorId = req.user?.userId;
    const role = req.user?.role;
    const bookingId = Number(req.params.id);
    if (!actorId) return res.status(401).json({ success: false, message: 'Chưa đăng nhập.' });
    if (!Number.isSafeInteger(bookingId) || bookingId <= 0) return res.status(400).json({ success: false, message: 'Lịch PT không hợp lệ.' });
    const isCoach = role === 'COACH' || role === 'TRAINER';
    if (!isCoach && role !== 'MEMBER') return res.status(403).json({ success: false, message: 'Không có quyền báo vắng.' });
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 500) : '';
    if (isCoach) {
      req.body = { bookingId, reason: reason || 'Coach báo vắng buổi PT' };
      return requestCoachScheduleChange(req, res);
    }
    try {
      const outcome = await prisma.$transaction(async (tx) => {
        const current = await tx.booking.findUnique({ where: { id: bookingId } });
        if (!current || current.type !== 'PT' || !current.membershipId) throw new PtBookingError(404, 'Không tìm thấy lịch PT.');
        if ((isCoach && current.coachId !== actorId) || (!isCoach && current.memberId !== actorId)) {
          throw new PtBookingError(403, 'Không có quyền báo vắng lịch này.');
        }
        await lockPtMembership(tx, current.membershipId);
        const booking = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
        const now = new Date();
        if (booking.status !== 'CONFIRMED' || now >= booking.startTime) {
          throw new PtBookingError(409, 'Chỉ được báo vắng trước khi buổi PT bắt đầu.');
        }
        const membership = await tx.membership.findUniqueOrThrow({ where: { id: booking.membershipId! }, include: { package: true } });
        const eligible = isCoach || (!booking.isMakeup && booking.startTime.getTime() - now.getTime() >= 2 * 60 * 60 * 1000 && membership.usedMakeupCount < membership.maxMakeupAllowed);
        const claimed = await tx.booking.updateMany({ where: { id: bookingId, status: 'CONFIRMED' }, data: {
          status: eligible ? 'ABSENT_ELIGIBLE' : 'ABSENT_NO_REFUND',
          absenceReason: reason || (isCoach ? 'Coach báo vắng' : 'Hội viên báo vắng'),
          absenceReportedAt: now, cancelledBy: role,
        } });
        if (claimed.count !== 1) throw new PtBookingError(409, 'Lịch đã được xử lý trước đó.');
        if (eligible) {
          if (!isCoach) await tx.membership.update({ where: { id: membership.id }, data: { usedMakeupCount: { increment: 1 } } });
          await tx.makeUpRequest.create({ data: {
            originalBookingId: bookingId, status: 'PENDING',
            expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
          } });
        } else {
          const debited = await tx.membership.updateMany({ where: { id: membership.id, remainingSessions: { gt: 0 } }, data: { remainingSessions: { decrement: 1 } } });
          if (debited.count !== 1) throw new PtBookingError(409, 'Không còn buổi PT để trừ; cần nhân viên kiểm tra.');
          if (membership.remainingSessions === 1 && membership.package.type === 'PT') await tx.membership.update({ where: { id: membership.id }, data: { status: 'COMPLETED' } });
        }
        return { booking: await tx.booking.findUniqueOrThrow({ where: { id: bookingId } }), eligible };
      }, { maxWait: 15000, timeout: 20000 });
      if (outcome.booking.coachId) emitCoachScheduleChanged(outcome.booking.coachId);
      const recipientId = isCoach ? outcome.booking.memberId : outcome.booking.coachId;
      if (recipientId) await createUserNotification({ userId: recipientId,
        title: isCoach ? 'Coach báo vắng buổi PT' : 'Hội viên báo vắng buổi PT',
        message: outcome.eligible ? 'Buổi này được học bù trong 7 ngày, không trừ lượt PT.' : 'Buổi này đã bị trừ 1 lượt PT.',
      });
      return res.status(200).json({ success: true,
        message: outcome.eligible ? 'Đã cấp quyền học bù trong 7 ngày, không trừ buổi.' : 'Đã báo vắng và trừ 1 buổi PT.',
        data: outcome.booking });
    } catch (error) {
      if (error instanceof PtBookingError) return res.status(error.status).json({ success: false, message: error.message });
      console.error('PT absence failed:', error);
      return res.status(500).json({ success: false, message: 'Không thể xử lý báo vắng.' });
    }
  }

  /**
   * 10. ĐẶT LỊCH HỌC BÙ
   * @route POST /api/pt/booking/schedule-makeup
   */
  static async scheduleMakeup(req: AuthRequest, res: Response) {
    const memberId = req.user?.userId;
    const originalBookingId = Number(req.body?.originalBookingId);
    const start = new Date(req.body?.newBookingDate);
    if (!memberId) return res.status(401).json({ success: false, message: 'Chưa đăng nhập.' });
    if (!Number.isSafeInteger(originalBookingId) || originalBookingId <= 0 || Number.isNaN(start.getTime())) {
      return res.status(400).json({ success: false, message: 'Lịch học bù không hợp lệ.' });
    }
    const original = await prisma.booking.findFirst({ where: { id: originalBookingId, memberId, type: 'PT' }, select: { membershipId: true, coachId: true } });
    if (!original?.membershipId) return res.status(404).json({ success: false, message: 'Không tìm thấy quyền học bù.' });
    try {
      const booking = await createConfirmedPtBooking({ memberId, membershipId: original.membershipId, start, makeupOriginalId: originalBookingId, coachId: original.coachId ?? undefined });
      emitCoachScheduleChanged(booking.coachId!);
      await Promise.all([
        createUserNotification({ userId: booking.coachId!, title: 'Lịch học bù PT đã xác nhận', message: `Hội viên #${memberId} đặt học bù lúc ${start.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}.` }),
        createUserNotification({ userId: memberId, title: 'Đặt học bù thành công', message: 'Lịch học bù đã tự động xác nhận.' }),
      ]);
      return res.status(201).json({ success: true, message: 'Đặt học bù thành công, đã tự động xác nhận.', data: booking });
    } catch (error) {
      if (error instanceof PtBookingError) return res.status(error.status).json({ success: false, message: error.message });
      console.error('PT makeup failed:', error);
      return res.status(500).json({ success: false, message: 'Không thể đặt lịch học bù.' });
    }
  }
}
