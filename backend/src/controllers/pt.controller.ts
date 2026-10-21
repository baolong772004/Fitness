import { Request, Response } from 'express';
import prisma from '../config/prisma.js';
import { AuthRequest } from '../middlewares/auth.middleware.js';
import jwt from 'jsonwebtoken';
import QRCode from 'qrcode';
import { createUserNotification } from '../services/notification.service.js';
import { closePtChatRoom, emitCoachScheduleChanged } from '../sockets/ptChat.socket.js';
import { resolveAutomaticPtNoShow } from '../services/ptNoShow.service.js';
import { availableSlots, localInstant, validDate } from '../services/ptCalendar.service.js';
import { createConfirmedPtBooking, createWalletPtBookings, createWalletPtMakeup, debitPtSession, lockPtCalendar, lockPtCoach, lockPtMember, lockPtMembership, PtBookingError, PT_BOOKING_HOLD_STATUSES } from '../services/ptBooking.service.js';
import { isPtLevel } from '../services/ptWallet.service.js';
import { verifiedGymPayment } from '../services/gymEntitlement.service.js';
import { settlePtCredit, releasePtCredit } from '../services/ptWallet.service.js';
import { lockGymMember } from '../services/gymMembershipLock.service.js';


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
      const level = req.query.level;
      if (level !== undefined && !['TRIAL', 'BEGINNER', 'INTERMEDIATE', 'ADVANCED'].includes(String(level))) {
        return res.status(400).json({ success: false, message: 'Cấp độ PT không hợp lệ.' });
      }
      const trainers = await prisma.coachProfile.findMany({
        where: {
          status: 'ACTIVE',
          user: { role: { in: ['COACH', 'TRAINER'] }, status: 'ACTIVE' },
          ...(level ? { specializations: { some: { level: String(level) } } } : {}),
        },
        select: {
          id: true,
          userId: true,
          bio: true,
          specialization: true,
          specializations: { select: { level: true } },
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
      const coachProfile = await prisma.coachProfile.findUnique({
        where: { userId: trainerId },
        select: { id: true, status: true },
      });
      if (!coachProfile || coachProfile.status !== 'ACTIVE') {
        return res.status(404).json({ success: false, message: 'Không tìm thấy huấn luyện viên đang hoạt động' });
      }

      const [calendarSlots, bookedSlots] = await Promise.all([
        availableSlots(prisma, coachProfile.id, dateStr),
        prisma.booking.findMany({ where: {
          coachId: trainerId, type: 'PT', status: { in: PT_BOOKING_HOLD_STATUSES },
          startTime: { lt: localInstant(dateStr, 1440) }, endTime: { gt: localInstant(dateStr, 0) },
        }, select: { startTime: true, endTime: true } }),
      ]);
      const now = new Date();
      const slotsResult = calendarSlots.map(slot => {
        const booked = bookedSlots.some(booking => booking.startTime < slot.end && booking.endTime > slot.start);
        const status = booked ? 'BOOKED' : slot.start.getTime() < now.getTime() + 2 * 3600000 ? 'TOO_LATE' : 'AVAILABLE';
        return { startTime: slot.startTime, endTime: slot.endTime, status, isAvailable: status === 'AVAILABLE' };
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
      const { ptSubscriptionId, bookingDate, note, coachId } = req.body;
      const membershipId = Number(ptSubscriptionId);
      const start = new Date(bookingDate);
      if (!userId || !Number.isSafeInteger(membershipId) || membershipId <= 0 || Number.isNaN(start.getTime())) {
        return res.status(400).json({ success: false, message: 'Vui lòng cung cấp gói PT và thời gian đặt lịch' });
      }
      const selectedCoachId = coachId == null ? undefined : Number(coachId);
      if (selectedCoachId !== undefined && (!Number.isSafeInteger(selectedCoachId) || selectedCoachId <= 0)) {
        return res.status(400).json({ success: false, message: 'Coach không hợp lệ' });
      }
      const legacy = await prisma.membership.findFirst({ where: { id: membershipId, userId },
        include: { package: true } });
      const level = legacy?.package.type === 'MEMBERSHIP' ? 'TRIAL' : legacy?.package.ptLevel;
      const trainerId = legacy?.package.type === 'PT' ? legacy.coachId : selectedCoachId;
      if (!legacy || !isPtLevel(level) || !trainerId) {
        return res.status(409).json({ success: false, message: 'Gói PT cũ chưa được chuyển sang credit hoặc chưa chọn Coach.' });
      }
      const [booking] = await createWalletPtBookings({ memberId: userId, coachId: trainerId, level, starts: [start] });
      if (booking.coachId) emitCoachScheduleChanged(booking.coachId);
      if (booking.coachId) {
        void createUserNotification({
          userId: booking.coachId,
          title: 'Lịch tập PT mới',
          message: `Hội viên #${userId} đã đặt ca ${start.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}.`,
        }).catch(error => console.error('Không thể gửi thông báo lịch PT:', error));
      }
      return res.status(201).json({ success: true, message: 'Đặt lịch PT thành công, lịch đã được xác nhận.', data: booking });
    } catch (error: any) {
      console.error('Lỗi đặt lịch:', error);
      if (error instanceof PtBookingError) return res.status(error.status).json({ success: false, message: error.message });
      return res.status(500).json({ success: false, message: 'Lỗi máy chủ' });
    }
  }

  /** @route POST /api/pt/booking/batch */
  static async createBookingBatch(req: AuthRequest, res: Response) {
    try {
      const memberId = req.user?.userId;
      const membershipId = Number(req.body?.ptSubscriptionId);
      const rawDates = req.body?.bookingDates;
      const coachId = req.body?.coachId == null ? undefined : Number(req.body.coachId);
      if (!memberId || !Number.isSafeInteger(membershipId) || membershipId <= 0 ||
          !Array.isArray(rawDates) || rawDates.length < 1 || rawDates.length > 20 ||
          rawDates.some(value => typeof value !== 'string' || !value.trim()) ||
          (coachId !== undefined && (!Number.isSafeInteger(coachId) || coachId <= 0))) {
        return res.status(400).json({ success: false, message: 'Cần gói PT, Coach hợp lệ và từ 1 đến 20 ca tập.' });
      }
      const starts = rawDates.map(value => new Date(value));
      const legacy = await prisma.membership.findFirst({ where: { id: membershipId, userId: memberId },
        include: { package: true } });
      const level = legacy?.package.type === 'MEMBERSHIP' ? 'TRIAL' : legacy?.package.ptLevel;
      const trainerId = legacy?.package.type === 'PT' ? legacy.coachId : coachId;
      if (!legacy || !isPtLevel(level) || !trainerId) {
        return res.status(409).json({ success: false, message: 'Gói PT cũ chưa được chuyển sang credit hoặc chưa chọn Coach.' });
      }
      const bookings = await createWalletPtBookings({ memberId, coachId: trainerId, level, starts });
      if (bookings[0]?.coachId) emitCoachScheduleChanged(bookings[0].coachId);
      if (bookings[0]?.coachId) {
        void createUserNotification({
          userId: bookings[0].coachId,
          title: 'Lịch tập PT mới',
          message: `Hội viên #${memberId} đã đặt ${bookings.length} ca PT.`,
        }).catch(error => console.error('Không thể gửi thông báo lịch PT:', error));
      }
      return res.status(201).json({ success: true, message: `${bookings.length} lịch PT đã được xác nhận.`, data: bookings });
    } catch (error: any) {
      if (error instanceof PtBookingError) return res.status(error.status).json({ success: false, message: error.message });
      console.error('Lỗi đặt nhiều lịch PT:', error);
      return res.status(500).json({ success: false, message: 'Không thể đặt các lịch PT đã chọn.' });
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
          member: { select: { id: true, fullName: true, email: true, phone: true, avatar: true } },
          coach: { select: { fullName: true, phone: true } },
          membership: { include: { package: { select: { name: true } } } },
          sessionResult: { include: { exercises: true } },
          makeUpRequests: { select: { id: true, status: true, expiresAt: true, newBookingId: true } },
          ptCreditAllocation: { include: { batch: { select: { level: true, source: true } } } },
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

      const walletBookings = await prisma.booking.findMany({
        where: { coachId, type: 'PT', ptCreditAllocation: { isNot: null },
          status: { in: ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'] } },
        select: { memberId: true, startTime: true,
          member: { select: { id: true, fullName: true, email: true, phone: true,
            avatar: true, gender: true, dateOfBirth: true } } },
        orderBy: { startTime: 'desc' },
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
      const traineeIds = new Set(trainees.map(row => row.id));
      for (const booking of walletBookings) {
        if (traineeIds.has(booking.memberId)) continue;
        traineeIds.add(booking.memberId);
        trainees.push({ ...booking.member, memberships: [] });
      }

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

      if (!booking || booking.memberId !== memberId || booking.coachId !== trainerId) {
        return res.status(403).json({ success: false, message: 'Mã QR này không dành cho lịch hẹn của bạn' });
      }

      if (booking.status !== 'CONFIRMED') {
        return res.status(400).json({ success: false, message: 'Lịch PT không còn ở trạng thái đã xác nhận.' });
      }

      const timeError = getPtCheckInWindowError(booking.startTime, booking.endTime);
      if (timeError) return res.status(400).json({ success: false, message: timeError });

      const now = new Date();
      const activeGymMembership = await prisma.membership.findFirst({
        where: {
          userId: memberId,
          status: 'ACTIVE',
          startDate: { lte: now },
          endDate: { gte: booking.endTime },
          package: { type: 'MEMBERSHIP' },
          payments: { some: verifiedGymPayment },
        },
        select: { id: true },
      });
      if (!activeGymMembership) {
        return res.status(403).json({
          success: false,
          message: 'Cần có gói hội viên gym còn hạn để bắt đầu buổi PT.',
        });
      }
      const allocation = await prisma.ptBookingCreditAllocation.findUnique({ where: { bookingId },
        include: { batch: { include: { membership: true } } } });
      if (allocation?.batch.level === 'TRIAL') {
        const gift = allocation.batch.membership;
        if (!gift || gift.status !== 'ACTIVE' || gift.startDate > now || gift.endDate < booking.endTime) {
          return res.status(403).json({ success: false, message: 'Quyền Trial của Membership đã hết hiệu lực.' });
        }
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
      if (claimed.count !== 1) return res.status(409).json({ success: false, message: 'Mã QR đã được sử dụng.' });
      const updated = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
      if (updated.coachId) await createUserNotification({ userId: updated.coachId,
        title: 'Hội viên đã check-in PT', message: `Hội viên #${memberId} đã bắt đầu buổi PT #${bookingId}.` });

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

  /** Staff/Admin exception for a QR failure; always records the actor and reason. */
  static async manualCheckIn(req: AuthRequest, res: Response) {
    const bookingId = Number(req.params.id);
    const actorId = req.user?.userId;
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
    if (!actorId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    if (!Number.isSafeInteger(bookingId) || bookingId <= 0 || !reason || reason.length > 500) {
      return res.status(400).json({ success: false, message: 'Cần booking và lý do xử lý QR.' });
    }
    try {
      const result = await prisma.$transaction(async tx => {
        const booking = await tx.booking.findUnique({ where: { id: bookingId }, include: {
          ptCreditAllocation: { include: { batch: { include: { membership: true } } } },
        } });
        if (!booking || booking.type !== 'PT' || !booking.coachId) throw new PtBookingError(404, 'Không tìm thấy buổi PT.');
        await lockPtMember(tx, booking.memberId);
        await lockGymMember(tx, booking.memberId);
        if (booking.status !== 'CONFIRMED') throw new PtBookingError(409, 'Buổi PT đã được xử lý.');
        const windowError = getPtCheckInWindowError(booking.startTime, booking.endTime);
        if (windowError) throw new PtBookingError(409, windowError);
        const now = new Date();
        const gym = await tx.membership.findFirst({ where: {
          userId: booking.memberId, status: 'ACTIVE', startDate: { lte: now },
          endDate: { gte: booking.endTime }, package: { type: 'MEMBERSHIP' },
          payments: { some: verifiedGymPayment },
        }, select: { id: true } });
        if (!gym) throw new PtBookingError(403, 'Quyền Gym không bao phủ buổi PT.');
        const batch = booking.ptCreditAllocation?.batch;
        if (batch?.level === 'TRIAL' && (!batch.membership || batch.membership.status !== 'ACTIVE' ||
          batch.membership.startDate > now || batch.membership.endDate < booking.endTime)) {
          throw new PtBookingError(403, 'Quyền Trial không còn hiệu lực.');
        }
        const claimed = await tx.booking.updateMany({ where: { id: bookingId, status: 'CONFIRMED' },
          data: { status: 'IN_PROGRESS', sessionQrToken: null } });
        if (claimed.count !== 1) throw new PtBookingError(409, 'Buổi PT đã được xử lý.');
        await tx.actionLog.create({ data: { userId: actorId, action: 'PT_MANUAL_CHECKIN',
          details: `Booking #${bookingId}: ${reason}` } });
        return booking;
      });
      await Promise.all([result.memberId, result.coachId!].map(userId => createUserNotification({
        userId, title: 'Check-in PT thủ công', message: `Buổi PT #${bookingId} đã được nhân viên xác nhận check-in.`,
      })));
      return res.status(200).json({ success: true, data: { bookingId, status: 'IN_PROGRESS' } });
    } catch (error) {
      if (error instanceof PtBookingError) return res.status(error.status).json({ success: false, message: error.message });
      console.error('PT manual check-in failed:', error);
      return res.status(500).json({ success: false, message: 'Không thể check-in thủ công.' });
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

      const result = await prisma.$transaction(async (tx) => {
        await lockPtMember(tx, booking.memberId);
        if (booking.membershipId !== null) await lockPtMembership(tx, booking.membershipId);
        const claimed = await tx.booking.updateMany({
          where: { id: bookingId, status: 'IN_PROGRESS' },
          data: { status: 'COMPLETED' },
        });
        if (claimed.count !== 1) return null;

        const allocation = await tx.ptBookingCreditAllocation.findUnique({ where: { bookingId } });
        const updatedSub = allocation ? await settlePtCredit(tx, bookingId)
          : booking.membershipId !== null ? await debitPtSession(tx, booking.membershipId)
          : (() => { throw new Error('PT_SESSION_BALANCE_MISSING'); })();
        const updatedBooking = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
        return { updatedBooking, updatedSub };
      });

      if (!result) {
        return res.status(409).json({ success: false, message: 'Buổi tập đã được kết thúc trước đó' });
      }

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
      if (error?.message === 'PT_SESSION_BALANCE_MISSING' || error instanceof PtBookingError) {
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
    const userId = req.user?.userId;
    const role = req.user?.role;
    const bookingId = Number(req.params.id);
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 500) : '';
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    if (!Number.isSafeInteger(bookingId) || bookingId <= 0) {
      return res.status(400).json({ success: false, message: 'Mã lịch PT không hợp lệ.' });
    }
    try {
      const initial = await prisma.booking.findUnique({
        where: { id: bookingId },
        select: { memberId: true, coachId: true, membershipId: true, type: true },
      });
      if (!initial || initial.type !== 'PT') {
        return res.status(404).json({ success: false, message: 'Lịch PT không tồn tại.' });
      }
      const isCoach = role === 'COACH' || role === 'TRAINER';
      if (!(role === 'MEMBER' && initial.memberId === userId) &&
          !(isCoach && initial.coachId === userId) &&
          !['ADMIN', 'STAFF'].includes(role ?? '')) {
        return res.status(403).json({ success: false, message: 'Không có quyền báo vắng buổi PT này.' });
      }
      if (!initial.coachId) {
        return res.status(409).json({ success: false, message: 'Lịch PT thiếu Coach.' });
      }
      const result = await prisma.$transaction(async tx => {
        await lockPtCalendar(tx);
        await lockPtCoach(tx, initial.coachId!);
        await lockPtMember(tx, initial.memberId);
        if (initial.membershipId) await lockPtMembership(tx, initial.membershipId);
        const booking = await tx.booking.findUniqueOrThrow({
          where: { id: bookingId }, include: { membership: { include: { package: true } } },
        });
        const now = new Date();
        if (booking.status !== 'CONFIRMED' || booking.startTime <= now) {
          throw new PtBookingError(409, 'Buổi PT đã bắt đầu hoặc đã được xử lý.');
        }
        const membership = booking.membership;
        const allocation = await tx.ptBookingCreditAllocation.findUnique({ where: { bookingId } });
        if (!membership && !allocation) throw new PtBookingError(409, 'Lịch PT không có credit để xử lý.');
        const coachAbsence = isCoach;
        const batch = allocation ? await tx.ptCreditBatch.findUniqueOrThrow({ where: { id: allocation.batchId } }) : null;
        const walletMakeupUsed = batch && !coachAbsence ? await tx.ptCreditTransaction.count({
          where: { batchId: batch.id, kind: 'MEMBER_MAKEUP' },
        }) : 0;
        const walletMakeupEligible = Boolean(batch && batch.level !== 'TRIAL' && walletMakeupUsed < 3);
        const canMakeup = coachAbsence || (!booking.isMakeup &&
          booking.startTime.getTime() - now.getTime() >= 2 * 60 * 60 * 1000 &&
          (allocation ? walletMakeupEligible : Boolean(membership?.status === 'ACTIVE' && membership.endDate >= now &&
            membership.usedMakeupCount < membership.maxMakeupAllowed)));
        const claimed = await tx.booking.updateMany({
          where: { id: bookingId, status: 'CONFIRMED' },
          data: {
            status: canMakeup ? 'ABSENT_ELIGIBLE' : 'ABSENT_NO_REFUND',
            absenceReason: reason || (coachAbsence ? 'Coach báo vắng' : 'Hội viên báo vắng'),
            absenceReportedAt: now,
            cancelledBy: role,
            sessionQrToken: null,
          },
        });
        if (claimed.count !== 1) throw new PtBookingError(409, 'Buổi PT đã được xử lý.');
        if (canMakeup) {
          if (!coachAbsence && !allocation && membership) {
            const quota = await tx.membership.updateMany({
              where: { id: membership.id, usedMakeupCount: { lt: membership.maxMakeupAllowed } },
              data: { usedMakeupCount: { increment: 1 } },
            });
            if (quota.count !== 1) throw new PtBookingError(409, 'Gói đã hết quyền học bù.');
          }
          await tx.makeUpRequest.create({
            data: { originalBookingId: bookingId, status: 'PENDING',
              expiresAt: new Date(now.getTime() + 7 * 86400000) },
          });
          if (!coachAbsence && batch) await tx.ptCreditTransaction.create({ data: {
            batchId: batch.id, bookingId, kind: 'MEMBER_MAKEUP', quantity: 1,
            note: 'Member absence makeup quota',
          } });
        } else {
          if (allocation) await settlePtCredit(tx, bookingId);
          else await debitPtSession(tx, membership!.id);
        }
        return { booking: await tx.booking.findUniqueOrThrow({ where: { id: bookingId } }), canMakeup };
      }, { maxWait: 15000, timeout: 30000 });
      closePtChatRoom(bookingId);
      emitCoachScheduleChanged(initial.coachId);
      await createUserNotification({
        userId: isCoach ? initial.memberId : initial.coachId,
        title: 'Lịch PT đã được báo vắng',
        message: result.canMakeup ? 'Buổi PT được cấp quyền đặt học bù trong 7 ngày.'
          : 'Buổi PT đã bị hủy và trừ một buổi trong gói.',
      });
      return res.status(200).json({
        success: true,
        message: result.canMakeup ? 'Đã cấp quyền đặt học bù trong 7 ngày.' : 'Đã báo vắng và trừ một buổi PT.',
        data: result.booking,
      });
    } catch (error: any) {
      if (error instanceof PtBookingError) return res.status(error.status).json({ success: false, message: error.message });
      console.error('Lỗi mark absent PT:', error);
      return res.status(500).json({ success: false, message: 'Không thể xử lý báo vắng PT.' });
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
    if (!memberId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    if (!Number.isSafeInteger(originalBookingId) || originalBookingId <= 0 || Number.isNaN(start.getTime())) {
      return res.status(400).json({ success: false, message: 'Cần buổi gốc và ca học bù hợp lệ.' });
    }
    try {
      const original = await prisma.booking.findFirst({
        where: { id: originalBookingId, memberId, type: 'PT' },
        select: { membershipId: true, coachId: true },
      });
      if (!original?.coachId) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy quyền học bù của bạn.' });
      }
      const allocation = await prisma.ptBookingCreditAllocation.findUnique({ where: { bookingId: originalBookingId } });
      const booking = allocation
        ? await createWalletPtMakeup({ memberId, originalBookingId, start })
        : original.membershipId
          ? await createConfirmedPtBooking({ memberId, membershipId: original.membershipId,
              coachId: original.coachId, start, makeupOriginalId: originalBookingId })
          : null;
      if (!booking) return res.status(409).json({ success: false, message: 'Quyền học bù không có credit.' });
      emitCoachScheduleChanged(original.coachId);
      void createUserNotification({
        userId: original.coachId,
        title: 'Lịch học bù PT mới',
        message: 'Hội viên #' + memberId + ' đã đặt học bù lúc ' +
          start.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) + '.',
      }).catch(error => console.error('Không thể gửi thông báo học bù:', error));
      return res.status(201).json({ success: true, message: 'Lịch học bù đã được xác nhận.', data: booking });
    } catch (error: any) {
      if (error instanceof PtBookingError) return res.status(error.status).json({ success: false, message: error.message });
      console.error('Lỗi schedule makeup:', error);
      return res.status(500).json({ success: false, message: 'Không thể đặt lịch học bù.' });
    }
  }
}
