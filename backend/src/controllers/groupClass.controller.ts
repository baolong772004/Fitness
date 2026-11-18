import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../config/prisma.js';
import { AuthRequest, isLockedAccountStatus } from '../middlewares/auth.middleware.js';
import jwt from 'jsonwebtoken';
import QRCode from 'qrcode';
import { refreshGymMembershipStates } from '../services/membership.service.js';
import { createUserNotification } from '../services/notification.service.js';
import { lockPtCalendar, lockPtCoach, lockPtMember } from '../services/ptBooking.service.js';
import {
  ACTIVE_GROUP_CLASS_SCHEDULE_STATUSES,
  buildRecurringGroupClassSlots,
  completeExpiredGroupClassSchedules,
  findMemberScheduleConflict,
  findTrainerScheduleConflict,
  type RepeatFrequency,
  validateGroupClassTimeWindow,
} from '../services/groupClass.service.js';

async function validateActiveGroupTrainer(db: Prisma.TransactionClient | typeof prisma, trainerId: number) {
  const trainer = await db.user.findUnique({
    where: { id: trainerId },
    select: {
      id: true,
      fullName: true,
      role: true,
      status: true,
      coachProfile: { select: { id: true, status: true } },
    },
  });
  if (!trainer) {
    return { ok: false as const, status: 404, message: `Không tìm thấy người dùng với trainerId=${trainerId}` };
  }
  if (trainer.role !== 'COACH') {
    return { ok: false as const, status: 400, message: 'Người dùng được chọn không phải là Huấn luyện viên.' };
  }
  if (isLockedAccountStatus(trainer.status) || trainer.status !== 'ACTIVE') {
    return { ok: false as const, status: 409, message: 'Tài khoản của HLV này đang bị khóa hoặc chưa kích hoạt.' };
  }
  if (!trainer.coachProfile || trainer.coachProfile.status !== 'ACTIVE') {
    return {
      ok: false as const,
      status: 409,
      message: 'HLV này đang tạm ngưng nhận lịch, không thể phân công dạy lớp học nhóm.',
    };
  }
  return { ok: true as const, trainer };
}



/**
 * API 1: Xem danh sách lớp học nhóm & Lịch học theo ngày
 * @route GET /api/group-classes/schedules?date=2026-10-06
 */
export const getGroupClassSchedules = async (req: AuthRequest, res: Response) => {
  try {
    const { date } = req.query;
    const all = req.query.all === 'true';
    if (all && !['ADMIN', 'STAFF'].includes(req.user?.role || '')) {
      return res.status(403).json({ success: false, message: 'Không có quyền xem toàn bộ lịch lớp học' });
    }
    const dateText = typeof date === 'string'
      ? date
      : new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
    if (!all && !/^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
      return res.status(400).json({ success: false, message: 'date phải có dạng YYYY-MM-DD' });
    }
    // Gym dùng giờ Việt Nam (UTC+07), độc lập múi giờ máy chủ.
    const startOfDay = new Date(`${dateText}T00:00:00+07:00`);
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
    if (!all && (Number.isNaN(startOfDay.getTime()) || new Date(`${dateText}T00:00:00.000Z`).toISOString().slice(0, 10) !== dateText)) {
      return res.status(400).json({ success: false, message: 'Ngày không hợp lệ' });
    }

    await completeExpiredGroupClassSchedules().catch(() => 0);

    const schedules = await prisma.groupClassSchedule.findMany({
      where: all ? {} : {
        startTime: {
          gte: startOfDay,
          lt: endOfDay,
        },
        status: { in: ACTIVE_GROUP_CLASS_SCHEDULE_STATUSES },
      },
      include: {
        groupClass: true,
        trainer: { select: { id: true, fullName: true, avatar: true } },
        room: true
      },
      orderBy: all ? { startTime: 'desc' } : { startTime: 'asc' },
    });

    return res.status(200).json({
      success: true,
      data: schedules,
    });
  } catch (error: any) {
    console.error('Lỗi lấy danh sách lớp học nhóm:', error);
    return res.status(500).json({ success: false, message: 'Lỗi lấy danh sách lớp học nhóm' });
  }
};

export const getAdminGroupClasses = async (_req: Request, res: Response) => {
  try {
    const classes = await prisma.groupClass.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json({ success: true, data: classes });
  } catch (error: any) {
    console.error('Lỗi lấy danh mục lớp học nhóm:', error);
    return res.status(500).json({ success: false, message: 'Lỗi lấy danh mục lớp học nhóm' });
  }
};

export const getAdminGroupClassSchedules = async (_req: Request, res: Response) => {
  try {
    await completeExpiredGroupClassSchedules().catch(() => 0);

    const schedules = await prisma.groupClassSchedule.findMany({
      include: {
        groupClass: true,
        trainer: { select: { id: true, fullName: true, avatar: true } },
        room: true,
      },
      orderBy: { startTime: 'asc' },
    });

    return res.status(200).json({ success: true, data: schedules });
  } catch (error: any) {
    console.error('Lỗi lấy toàn bộ lịch lớp học nhóm admin:', error);
    return res.status(500).json({ success: false, message: 'Lỗi lấy toàn bộ lịch lớp học nhóm' });
  }
};

/**
 * API: HLV xem danh sách tất cả các ca lớp học nhóm được phân công
 * @route GET /api/group-classes/coach/my-schedules?date=YYYY-MM-DD
 */
export const getCoachMyGroupClassSchedules = async (req: AuthRequest, res: Response) => {
  try {
    const trainerId = req.user?.userId;
    if (!trainerId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { date } = req.query;
    let timeFilter: { gte: Date; lt: Date } | undefined;
    if (typeof date === 'string' && date.trim()) {
      const dateText = date.trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
        return res.status(400).json({ success: false, message: 'date phải có dạng YYYY-MM-DD' });
      }
      const startOfDay = new Date(`${dateText}T00:00:00+07:00`);
      if (Number.isNaN(startOfDay.getTime())) {
        return res.status(400).json({ success: false, message: 'Ngày không hợp lệ' });
      }
      timeFilter = {
        gte: startOfDay,
        lt: new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000),
      };
    }

    await completeExpiredGroupClassSchedules().catch(() => 0);

    const schedules = await prisma.groupClassSchedule.findMany({
      where: {
        trainerId,
        status: { not: 'CANCELLED' },
        ...(timeFilter ? { startTime: timeFilter } : {}),
      },
      include: {
        groupClass: true,
        trainer: { select: { id: true, fullName: true, avatar: true } },
        room: true,
      },
      orderBy: { startTime: 'asc' },
    });

    return res.status(200).json({
      success: true,
      data: schedules,
    });
  } catch (error: any) {
    console.error('Lỗi lấy lớp học nhóm được phân công cho HLV:', error);
    return res.status(500).json({ success: false, message: 'Lỗi lấy lớp học nhóm được phân công' });
  }
};

/**
 * API 2: Member Đăng ký tham gia Lớp Group Class
 * @route POST /api/group-classes/book
 */
export const bookGroupClass = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { scheduleId } = req.body;

    if (!userId) {
       return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    if (!scheduleId) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp scheduleId' });
    }

    // 1. Kiểm tra lịch lớp học
    const schedule = await prisma.groupClassSchedule.findUnique({
      where: { id: Number(scheduleId) },
    });

    if (!schedule) {
      return res.status(404).json({ success: false, message: 'Lịch lớp học không tồn tại' });
    }

    if (schedule.status === 'CANCELLED') {
      return res.status(409).json({
        success: false,
        message: 'Lớp học này đã bị hủy, không thể đăng ký',
      });
    }

    // 2. Kiểm tra lớp đã bắt đầu hoặc đã kết thúc chưa
    const now = new Date();
    const scheduleStartTime = new Date(schedule.startTime);
    const scheduleEndTime = new Date(schedule.endTime);
    if (schedule.status === 'COMPLETED' || now >= scheduleEndTime) {
      return res.status(400).json({
        success: false,
        message: 'Lớp học đã kết thúc, không thể đăng ký',
      });
    }
    if (now >= scheduleStartTime) {
      return res.status(400).json({
        success: false,
        message: 'Lớp học đã bắt đầu hoặc đã kết thúc, không thể đăng ký',
      });
    }

    // 3. Tự động đồng bộ trạng thái gói tập gần nhất của hội viên
    try {
      await refreshGymMembershipStates(Number(userId));
    } catch {
      // Bỏ qua nếu có xung đột khóa đồng thời, tiếp tục truy vấn DB
    }

    // 4. Kiểm tra xem hội viên có gói tập nào đang BẢO LƯU (FROZEN) không
    const frozenMembership = await prisma.membership.findFirst({
      where: {
        userId: Number(userId),
        status: 'FROZEN',
        package: { type: 'MEMBERSHIP' }
      },
      include: { package: true }
    });
    if (frozenMembership) {
      return res.status(400).json({
        success: false,
        message: `Gói tập [${frozenMembership.package.name}] của bạn hiện đang ở trạng thái BẢO LƯU (đến ngày ${new Date(frozenMembership.endDate).toLocaleDateString('vi-VN')}). Vui lòng mở lại gói tập tại quầy trước khi đăng ký lớp học!`
      });
    }

    // 5. Kiểm tra điều kiện gói Gym ACTIVE còn hiệu lực tại thời điểm diễn ra lớp
    const activeGymMembership = await prisma.membership.findFirst({
      where: {
        userId: Number(userId),
        status: 'ACTIVE',
        startDate: { lte: scheduleStartTime },
        endDate: { gte: scheduleStartTime },
        package: { type: 'MEMBERSHIP' }
      },
      include: { package: true }
    });

    if (!activeGymMembership) {
      // Kiểm tra xem có gói ACTIVE nào nhưng sẽ hết hạn trước buổi học không
      const currentActive = await prisma.membership.findFirst({
        where: {
          userId: Number(userId),
          status: 'ACTIVE',
          package: { type: 'MEMBERSHIP' }
        },
        include: { package: true },
        orderBy: { endDate: 'desc' }
      });

      if (currentActive && new Date(currentActive.endDate) < scheduleStartTime) {
        return res.status(400).json({
          success: false,
          message: `Gói tập [${currentActive.package.name}] của bạn sẽ hết hạn vào ngày ${new Date(currentActive.endDate).toLocaleDateString('vi-VN')}, trước thời điểm diễn ra lớp học (${scheduleStartTime.toLocaleDateString('vi-VN')}). Vui lòng gia hạn gói tập để tham gia!`
        });
      }

      const expiredMembership = await prisma.membership.findFirst({
        where: {
          userId: Number(userId),
          status: 'EXPIRED',
          package: { type: 'MEMBERSHIP' }
        },
        include: { package: true },
        orderBy: { endDate: 'desc' }
      });

      if (expiredMembership) {
        return res.status(400).json({
          success: false,
          message: `Gói tập [${expiredMembership.package.name}] của bạn đã hết hạn vào ngày ${new Date(expiredMembership.endDate).toLocaleDateString('vi-VN')}. Vui lòng gia hạn gói tập trước khi đăng ký lớp học nhóm!`
        });
      }

      const pendingMembership = await prisma.membership.findFirst({
        where: {
          userId: Number(userId),
          status: 'PENDING_ACTIVATION',
          package: { type: 'MEMBERSHIP' }
        },
        include: { package: true }
      });

      if (pendingMembership) {
        return res.status(400).json({
          success: false,
          message: `Gói tập [${pendingMembership.package.name}] của bạn đang ở trạng thái CHỜ KÍCH HOẠT. Vui lòng check-in kích hoạt gói tại phòng tập trước khi đăng ký lớp!`
        });
      }

      return res.status(400).json({
        success: false,
        message: 'Bạn chưa có gói hội viên Gym đang hoạt động (ACTIVE). Vui lòng đăng ký gói tập để tham gia các lớp học nhóm!'
      });
    }

    // 3. Kiểm tra xem lớp đã HẾT CHỖ chưa
    if (schedule.bookedCount >= schedule.capacity || schedule.status === 'FULL') {
      return res.status(400).json({
        success: false,
        message: 'Rất tiếc! Lớp học này đã HẾT CHỖ (FULL)',
      });
    }

    // 4. Kiểm tra Member đã đăng ký buổi học này chưa
    const existingBooking = await prisma.groupClassBooking.findUnique({
      where: {
        scheduleId_userId: {
          scheduleId: Number(scheduleId),
          userId: Number(userId),
        },
      },
    });

    if (existingBooking && ['BOOKED', 'CHECKED_IN'].includes(existingBooking.status)) {
      return res.status(400).json({
        success: false,
        message: existingBooking.status === 'CHECKED_IN'
          ? 'Bạn đã điểm danh tham gia lớp học này rồi'
          : 'Bạn đã đăng ký lớp học này trước đó rồi',
      });
    }

    // 4b. Kiểm tra trùng khung giờ với lớp nhóm khác hoặc lịch PT 1-1 của hội viên
    const memberConflict = await findMemberScheduleConflict(
      prisma,
      Number(userId),
      scheduleStartTime,
      scheduleEndTime,
      Number(scheduleId),
    );
    if (memberConflict) {
      return res.status(409).json({
        success: false,
        message: memberConflict,
      });
    }

    // 5. Thực hiện Transaction chống Overbooking & trùng lịch:
    // Cập nhật có điều kiện bookedCount: { lt: schedule.capacity } và increment: 1
    const result = await prisma.$transaction(async (tx) => {
      await lockPtMember(tx, Number(userId));
      const txConflict = await findMemberScheduleConflict(
        tx,
        Number(userId),
        scheduleStartTime,
        scheduleEndTime,
        Number(scheduleId),
      );
      if (txConflict) {
        throw Object.assign(new Error(txConflict), { code: 'OVERLAP_CONFLICT' });
      }

      // 5a. Kiểm tra và tăng bookedCount có điều kiện nguyên tử (Atomic Conditional Update)
      const updateResult = await tx.groupClassSchedule.updateMany({
        where: {
          id: Number(scheduleId),
          bookedCount: { lt: schedule.capacity },
          status: 'OPEN',
        },
        data: {
          bookedCount: { increment: 1 },
        },
      });

      if (updateResult.count === 0) {
        const latestSchedule = await tx.groupClassSchedule.findUnique({
          where: { id: Number(scheduleId) },
          select: { status: true, endTime: true },
        });
        if (!latestSchedule) {
          throw new Error('SCHEDULE_NOT_FOUND');
        }
        if (latestSchedule.status === 'CANCELLED') {
          throw new Error('SCHEDULE_CANCELLED');
        }
        if (latestSchedule.status === 'COMPLETED' || latestSchedule.endTime <= new Date()) {
          throw new Error('SCHEDULE_COMPLETED');
        }
        throw new Error('OVERBOOKING_FULL');
      }

      // 5b. Tạo hoặc cập nhật lại bản ghi Booking
      let booking;
      if (existingBooking) {
        // Chỉ cập nhật lại nếu booking đang ở trạng thái CANCELLED
        const claimed = await tx.groupClassBooking.updateMany({
          where: { id: existingBooking.id, status: 'CANCELLED' },
          data: { status: 'BOOKED' },
        });
        if (claimed.count !== 1) {
          throw new Error('ALREADY_BOOKED');
        }
        booking = await tx.groupClassBooking.findUniqueOrThrow({ where: { id: existingBooking.id } });
      } else {
        // 5a. Tạo bản ghi Booking
        booking = await tx.groupClassBooking.create({
          data: {
            scheduleId: Number(scheduleId),
            userId: Number(userId),
            status: 'BOOKED',
          },
        });
      }

      // 5c. Lấy dữ liệu mới nhất sau khi tăng và cập nhật FULL nếu vừa chạm trần
      const updatedSchedule = await tx.groupClassSchedule.findUnique({
        where: { id: Number(scheduleId) },
      });

      if (updatedSchedule && updatedSchedule.bookedCount >= updatedSchedule.capacity) {
        await tx.groupClassSchedule.update({
          where: { id: Number(scheduleId) },
          data: { status: 'FULL' },
        });
        updatedSchedule.status = 'FULL';
      }

      return { booking, updatedSchedule };
    });

    return res.status(200).json({
      success: true,
      message: 'Đăng ký lớp học nhóm thành công!',
      data: result,
    });
  } catch (error: any) {
    if (error?.code === 'OVERLAP_CONFLICT') {
      return res.status(409).json({
        success: false,
        message: error.message,
      });
    }
    if (error?.message === 'SCHEDULE_NOT_FOUND') {
      return res.status(404).json({
        success: false,
        message: 'Lịch lớp học không tồn tại',
      });
    }
    if (error?.message === 'SCHEDULE_CANCELLED') {
      return res.status(409).json({
        success: false,
        message: 'Lớp học này đã bị hủy, không thể đăng ký',
      });
    }
    if (error?.message === 'SCHEDULE_COMPLETED') {
      return res.status(400).json({
        success: false,
        message: 'Lớp học đã kết thúc, không thể đăng ký',
      });
    }
    if (error?.message === 'ALREADY_BOOKED') {
      return res.status(409).json({
        success: false,
        message: 'Bạn đã đăng ký lớp học này trước đó rồi',
      });
    }
    if (error?.message === 'OVERBOOKING_FULL') {
      return res.status(400).json({
        success: false,
        message: 'Rất tiếc! Lớp học này vừa HẾT CHỖ (FULL)',
      });
    }
    console.error('Lỗi bookGroupClass:', error);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi đăng ký lớp' });
  }
};

/**
 * API 3: Hủy đăng ký Lớp Group Class (Báo vắng)
 * @route POST /api/group-classes/cancel/:bookingId
 */
export const cancelGroupClass = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const bookingId = Number(req.params.bookingId);

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const booking = await prisma.groupClassBooking.findUnique({
      where: { id: bookingId },
      include: { schedule: true },
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy thông tin đăng ký' });
    }

    if (booking.userId !== userId) {
      return res.status(403).json({ success: false, message: 'Không có quyền hủy lịch của người khác' });
    }

    if (booking.status !== 'BOOKED') {
      return res.status(400).json({ success: false, message: `Không thể hủy lớp học đang ở trạng thái: ${booking.status}` });
    }

    if (booking.schedule.status === 'CANCELLED' || booking.schedule.status === 'COMPLETED') {
      return res.status(400).json({ success: false, message: 'Lớp học này đã bị hủy hoặc đã kết thúc, không thể hủy đặt chỗ.' });
    }

    // Thời điểm hủy phải cách giờ học ít nhất 2 tiếng
    const now = new Date();
    const startTime = new Date(booking.schedule.startTime);
    const diffMs = startTime.getTime() - now.getTime();
    
    if (diffMs < 2 * 60 * 60 * 1000) {
      return res.status(400).json({ 
        success: false, 
        message: 'Không thể hủy lịch do quá trễ (Phải hủy trước giờ học ít nhất 2 tiếng)' 
      });
    }

    // Thực hiện Transaction chống Race Condition: Cập nhật Cancelled có điều kiện nguyên tử + Giảm bookedCount + Cập nhật OPEN
    const result = await prisma.$transaction(async (tx) => {
      // 1. Chỉ cập nhật CANCELLED nếu booking đang ở trạng thái BOOKED
      const claimed = await tx.groupClassBooking.updateMany({
        where: { id: bookingId, status: 'BOOKED', userId },
        data: { status: 'CANCELLED' },
      });
      if (claimed.count !== 1) {
        throw new Error('ALREADY_CANCELLED_OR_PROCESSED');
      }

      const scheduleId = booking.schedule.id;

      // 2. Giảm bookedCount có điều kiện: chỉ giảm nếu ca học đang mở và bookedCount > 0
      await tx.groupClassSchedule.updateMany({
        where: {
          id: scheduleId,
          bookedCount: { gt: 0 },
          status: { in: ACTIVE_GROUP_CLASS_SCHEDULE_STATUSES },
        },
        data: {
          bookedCount: { decrement: 1 },
          status: 'OPEN', // Chắc chắn mở lại trạng thái OPEN khi có chỗ trống
        },
      });

      const updatedBooking = await tx.groupClassBooking.findUniqueOrThrow({ where: { id: bookingId } });
      const updatedSchedule = await tx.groupClassSchedule.findUnique({
        where: { id: scheduleId },
      });

      return { updatedBooking, updatedSchedule };
    });

    return res.status(200).json({
      success: true,
      message: 'Hủy lịch học nhóm thành công! Đã nhường slot cho người khác.',
      data: result,
    });
  } catch (error: any) {
    if (error?.message === 'ALREADY_CANCELLED_OR_PROCESSED') {
      return res.status(409).json({ success: false, message: 'Lịch học đã được hủy hoặc xử lý trước đó.' });
    }
    console.error('Lỗi cancelGroupClass:', error);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi hủy lịch' });
  }
};

/**
 * Coach QR and attendance list for an assigned group class schedule.
 */
export const getGroupClassCheckInQr = async (req: AuthRequest, res: Response) => {
  try {
    const scheduleId = Number(req.params.scheduleId);
    const actorId = req.user?.userId;
    if (!Number.isSafeInteger(scheduleId) || scheduleId <= 0 || !actorId) {
      return res.status(400).json({ success: false, message: 'Lịch lớp học không hợp lệ' });
    }
    const schedule = await prisma.groupClassSchedule.findUnique({ where: { id: scheduleId } });
    if (!schedule) return res.status(404).json({ success: false, message: 'Không tìm thấy lịch lớp học' });
    if (schedule.trainerId !== actorId && !['ADMIN', 'STAFF'].includes(req.user?.role || '')) {
      return res.status(403).json({ success: false, message: 'Bạn không phụ trách lớp học này' });
    }
    const now = Date.now();
    if (!['OPEN', 'FULL'].includes(schedule.status) || now < schedule.startTime.getTime() - 15 * 60 * 1000 || now > schedule.endTime.getTime()) {
      return res.status(400).json({ success: false, message: 'QR điểm danh chỉ mở từ 15 phút trước giờ học đến hết ca' });
    }
    const token = jwt.sign(
      { type: 'GROUP_CLASS_CHECKIN', scheduleId },
      process.env.JWT_SECRET as string,
      { expiresIn: '90s' },
    );
    return res.status(200).json({
      success: true,
      data: { token, qrCodeImage: await QRCode.toDataURL(token), expiresInSeconds: 90 },
    });
  } catch (error) {
    console.error('Lỗi tạo QR lớp học nhóm:', error);
    return res.status(500).json({ success: false, message: 'Không thể tạo QR điểm danh lớp học' });
  }
};

export const getGroupClassAttendees = async (req: AuthRequest, res: Response) => {
  try {
    const scheduleId = Number(req.params.scheduleId);
    const actorId = req.user?.userId;
    if (!Number.isSafeInteger(scheduleId) || scheduleId <= 0 || !actorId) {
      return res.status(400).json({ success: false, message: 'Lịch lớp học không hợp lệ' });
    }
    const schedule = await prisma.groupClassSchedule.findUnique({ where: { id: scheduleId } });
    if (!schedule) return res.status(404).json({ success: false, message: 'Không tìm thấy lịch lớp học' });
    if (schedule.trainerId !== actorId && !['ADMIN', 'STAFF'].includes(req.user?.role || '')) {
      return res.status(403).json({ success: false, message: 'Bạn không phụ trách lớp học này' });
    }
    const bookings = await prisma.groupClassBooking.findMany({
      where: { scheduleId, status: { in: ['BOOKED', 'CHECKED_IN'] } },
      select: { id: true, status: true, user: { select: { id: true, fullName: true } } },
      orderBy: { id: 'asc' },
    });
    return res.status(200).json({ success: true, data: bookings });
  } catch (error) {
    console.error('Lỗi tải danh sách lớp học nhóm:', error);
    return res.status(500).json({ success: false, message: 'Không thể tải danh sách lớp học' });
  }
};

export const checkInGroupClass = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const bookingId = Number(req.params.bookingId);
    const qrToken = req.body?.qrToken;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const booking = await prisma.groupClassBooking.findUnique({
      where: { id: bookingId },
      include: { schedule: true },
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy thông tin đăng ký' });
    }

    if (booking.userId !== userId) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền check-in lịch này' });
    }

    if (booking.status !== 'BOOKED') {
      return res.status(400).json({ success: false, message: `Không thể check-in, trạng thái hiện tại: ${booking.status}` });
    }

    if (typeof qrToken !== 'string' || !qrToken.trim()) {
      return res.status(400).json({ success: false, message: 'Vui lòng quét mã QR của lớp học để check-in' });
    }
    try {
      const payload = jwt.verify(qrToken.trim(), process.env.JWT_SECRET as string);
      if (typeof payload === 'string' || payload.type !== 'GROUP_CLASS_CHECKIN' || payload.scheduleId !== booking.scheduleId) {
        return res.status(400).json({ success: false, message: 'Mã QR không thuộc lớp học đã đăng ký' });
      }
    } catch {
      return res.status(400).json({ success: false, message: 'Mã QR lớp học không hợp lệ hoặc đã hết hạn' });
    }

    const now = new Date();
    const startTime = new Date(booking.schedule.startTime);
    const endTime = new Date(booking.schedule.endTime);

    if (booking.schedule.status === 'CANCELLED' || booking.schedule.status === 'COMPLETED') {
      return res.status(400).json({ success: false, message: 'Lớp học không còn mở điểm danh' });
    }
    if (now.getTime() < startTime.getTime() - 15 * 60 * 1000) {
      return res.status(400).json({ success: false, message: 'Chỉ được check-in từ 15 phút trước giờ học' });
    }
    if (now > endTime) {
       return res.status(400).json({ success: false, message: 'Lớp học đã kết thúc, không thể check-in' });
    }

    try {
      await refreshGymMembershipStates(userId);
    } catch {
      // Bỏ qua xung đột khóa đồng thời và truy vấn trạng thái hiện hành
    }

    const frozenGym = await prisma.membership.findFirst({
      where: {
        userId,
        status: 'FROZEN',
        package: { type: 'MEMBERSHIP' },
      },
      include: { package: true },
    });
    if (frozenGym) {
      return res.status(403).json({
        success: false,
        message: `Gói tập [${frozenGym.package.name}] của bạn đang ở trạng thái BẢO LƯU, không thể điểm danh lớp học.`,
      });
    }

    const activeGym = await prisma.membership.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
        startDate: { lte: startTime },
        endDate: { gte: startTime },
        package: { type: 'MEMBERSHIP' },
      },
      select: { id: true },
    });
    if (!activeGym) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có gói hội viên Gym đang hoạt động (ACTIVE) còn hiệu lực cho buổi học này.',
      });
    }

    const claimed = await prisma.groupClassBooking.updateMany({
      where: { id: bookingId, userId, status: 'BOOKED' },
      data: { status: 'CHECKED_IN' }
    });
    if (claimed.count !== 1) return res.status(409).json({ success: false, message: 'Lớp học đã được check-in trước đó' });
    const updatedBooking = await prisma.groupClassBooking.findUniqueOrThrow({ where: { id: bookingId } });

    return res.status(200).json({
      success: true,
      message: 'Check-in thành công! Chúc bạn tập luyện vui vẻ.',
      data: updatedBooking
    });
  } catch (error: any) {
    console.error('Lỗi checkInGroupClass:', error);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi check-in' });
  }
};

/**
 * API 5: Admin Tạo Lớp học nhóm (Master Data)
 * @route POST /api/group-classes
 */
export const createGroupClass = async (req: Request, res: Response) => {
  try {
    const { name, description, imageUrl, durationMin } = req.body;

    const trimmedName = typeof name === 'string' ? name.trim() : '';
    if (!trimmedName) {
      return res.status(400).json({ success: false, message: 'Tên lớp là bắt buộc' });
    }

    const parsedDurationMin =
      durationMin === undefined || durationMin === null || durationMin === ''
        ? 60
        : Number(durationMin);
    if (!Number.isInteger(parsedDurationMin) || parsedDurationMin < 15 || parsedDurationMin > 180) {
      return res.status(400).json({
        success: false,
        message: 'Thời lượng lớp học phải là số nguyên từ 15 đến 180 phút',
      });
    }

    const newClass = await prisma.groupClass.create({
      data: {
        name: trimmedName,
        description: typeof description === 'string' && description.trim() ? description.trim() : null,
        imageUrl: typeof imageUrl === 'string' && imageUrl.trim() ? imageUrl.trim() : null,
        durationMin: parsedDurationMin,
      }
    });

    return res.status(201).json({ success: true, message: 'Tạo lớp thành công', data: newClass });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Lỗi tạo lớp học' });
  }
};

/**
 * API 6: Admin Lên Lịch cho Lớp học nhóm
 * @route POST /api/group-classes/schedules
 */
export const createGroupClassSchedule = async (req: Request, res: Response) => {
  try {
    const {
      classId,
      trainerId,
      roomId,
      startTime,
      endTime,
      capacity,
      repeatCount,
      repeatFrequency,
      repeatDays,
    } = req.body;

    const parsedClassId = Number(classId);
    const parsedTrainerId = Number(trainerId);
    const parsedRoomId = roomId === undefined || roomId === null || roomId === '' ? null : Number(roomId);
    const parsedCapacity = capacity === undefined || capacity === null || capacity === '' ? 20 : Number(capacity);
    const parsedRepeatCount = repeatCount === undefined || repeatCount === null || repeatCount === '' ? 1 : Number(repeatCount);
    const parsedRepeatFrequency = (repeatFrequency || (parsedRepeatCount > 1 ? 'WEEKLY' : 'NONE')) as RepeatFrequency;
    const parsedStartTime = new Date(startTime);

    if (!Number.isSafeInteger(parsedClassId) || parsedClassId <= 0 ||
        !Number.isSafeInteger(parsedTrainerId) || parsedTrainerId <= 0 ||
        !startTime) {
       return res.status(400).json({ success: false, message: 'classId, trainerId và startTime là bắt buộc và phải hợp lệ' });
    }

    if (parsedRoomId !== null && (!Number.isSafeInteger(parsedRoomId) || parsedRoomId <= 0)) {
      return res.status(400).json({ success: false, message: 'roomId phải là số nguyên dương' });
    }
    if (!Number.isSafeInteger(parsedCapacity) || parsedCapacity <= 0) {
      return res.status(400).json({ success: false, message: 'capacity phải là số nguyên dương' });
    }
    if (Number.isNaN(parsedStartTime.getTime())) {
      return res.status(400).json({ success: false, message: 'startTime không hợp lệ' });
    }
    if (parsedStartTime <= new Date()) {
      return res.status(400).json({ success: false, message: 'Không thể tạo lịch lớp học cho thời điểm trong quá khứ.' });
    }
    if (!['NONE', 'DAILY', 'WEEKLY'].includes(parsedRepeatFrequency)) {
      return res.status(400).json({ success: false, message: 'Chế độ lặp lại chỉ hỗ trợ NONE, DAILY hoặc WEEKLY.' });
    }

    const groupClass = await prisma.groupClass.findUnique({
      where: { id: parsedClassId },
      select: { id: true, name: true, durationMin: true },
    });
    if (!groupClass) {
      return res.status(404).json({ success: false, message: `Không tìm thấy lớp học với classId=${parsedClassId}` });
    }

    const durationMs = groupClass.durationMin * 60_000;
    const expectedEndTime = new Date(parsedStartTime.getTime() + durationMs);
    if (endTime !== undefined && endTime !== null && String(endTime).trim() !== '') {
      const providedEndTime = new Date(endTime);
      if (Number.isNaN(providedEndTime.getTime()) || providedEndTime <= parsedStartTime) {
        return res.status(400).json({ success: false, message: 'endTime không hợp lệ hoặc không sau startTime' });
      }
      if (Math.abs(providedEndTime.getTime() - expectedEndTime.getTime()) > 60_000) {
        return res.status(400).json({
          success: false,
          message: `Thời lượng ca tập phải khớp với thời lượng của lớp "${groupClass.name}" (${groupClass.durationMin} phút).`,
        });
      }
    }

    let slots: Array<{ startTime: Date; endTime: Date }>;
    try {
      slots = buildRecurringGroupClassSlots(parsedStartTime, durationMs, {
        repeatCount: parsedRepeatCount,
        repeatFrequency: parsedRepeatFrequency,
        repeatDays: Array.isArray(repeatDays) ? repeatDays : undefined,
      });
    } catch (slotError: any) {
      return res.status(400).json({ success: false, message: slotError?.message || 'Cấu hình lặp lại không hợp lệ.' });
    }

    const [trainerCheck, room] = await Promise.all([
      validateActiveGroupTrainer(prisma, parsedTrainerId),
      parsedRoomId === null
        ? Promise.resolve<{ id: null; name?: string | null; isActive?: boolean; capacity?: number }>({ id: null, name: null })
        : prisma.room.findUnique({ where: { id: parsedRoomId }, select: { id: true, name: true, isActive: true, capacity: true } })
    ]);

    if (!trainerCheck.ok) return res.status(trainerCheck.status).json({ success: false, message: trainerCheck.message });
    if (!room) return res.status(404).json({ success: false, message: `Không tìm thấy phòng với roomId=${parsedRoomId}` });
    if (parsedRoomId !== null) {
      if (room.isActive === false) {
        return res.status(409).json({ success: false, message: `Phòng "${room.name}" đang tạm ngưng hoạt động, không thể xếp lịch.` });
      }
      if (typeof room.capacity === 'number' && parsedCapacity > room.capacity) {
        return res.status(400).json({
          success: false,
          message: `Sức chứa ca tập (${parsedCapacity}) vượt quá sức chứa tối đa của phòng (${room.capacity} người).`,
        });
      }
    }

    const formatSlotPrefix = (slot: { startTime: Date; endTime: Date }) => {
      if (slots.length === 1) return '';
      const d = slot.startTime.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
      const s = slot.startTime.toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' });
      const e = slot.endTime.toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' });
      return `Buổi ngày ${d} (${s}–${e}): `;
    };

    const createdSchedules = await prisma.$transaction(async (tx) => {
      await lockPtCalendar(tx);
      await lockPtCoach(tx, parsedTrainerId);
      const savedList = [];
      for (const slot of slots) {
        const prefix = formatSlotPrefix(slot);
        const timeWindowCheck = await validateGroupClassTimeWindow(tx, slot.startTime, slot.endTime);
        if (!timeWindowCheck.ok) {
          throw Object.assign(new Error(`${prefix}${timeWindowCheck.message}`), { statusCode: timeWindowCheck.status });
        }

        const trainerConflict = await findTrainerScheduleConflict(tx, parsedTrainerId, slot.startTime, slot.endTime);
        if (trainerConflict) {
          throw Object.assign(new Error(`${prefix}${trainerConflict}`), { statusCode: 409 });
        }

        if (parsedRoomId !== null) {
          const conflictingRoomSchedule = await tx.groupClassSchedule.findFirst({
            where: {
              roomId: parsedRoomId,
              status: { in: ACTIVE_GROUP_CLASS_SCHEDULE_STATUSES },
              startTime: { lt: slot.endTime },
              endTime: { gt: slot.startTime },
            },
            select: { id: true, groupClass: { select: { name: true } } },
          });
          if (conflictingRoomSchedule) {
            throw Object.assign(
              new Error(`${prefix}Phòng "${room.name}" đã có lớp "${conflictingRoomSchedule.groupClass.name}" trong khung giờ này.`),
              { statusCode: 409 },
            );
          }
        }

        const created = await tx.groupClassSchedule.create({
          data: {
            classId: parsedClassId,
            trainerId: parsedTrainerId,
            roomId: parsedRoomId,
            startTime: slot.startTime,
            endTime: slot.endTime,
            capacity: parsedCapacity,
            status: 'OPEN',
          },
        });
        savedList.push(created);
      }
      return savedList;
    });

    const firstSlot = slots[0];
    const lastSlot = slots[slots.length - 1];
    const startDateLabel = firstSlot.startTime.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
    const endDateLabel = lastSlot.startTime.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
    const startLabel = firstSlot.startTime.toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' });
    const endLabel = firstSlot.endTime.toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' });

    await createUserNotification({
      userId: parsedTrainerId,
      title: createdSchedules.length === 1
        ? 'Phân công lớp học nhóm mới'
        : `Phân công ${createdSchedules.length} buổi lớp học nhóm mới`,
      message: createdSchedules.length === 1
        ? `Bạn được phân công dạy lớp "${groupClass.name}" vào ${startDateLabel} (${startLabel}–${endLabel})${room.name ? ` tại ${room.name}` : ''}.`
        : `Bạn được phân công dạy ${createdSchedules.length} buổi lớp "${groupClass.name}" (${startLabel}–${endLabel}, từ ${startDateLabel} đến ${endDateLabel})${room.name ? ` tại ${room.name}` : ''}.`,
    });

    return res.status(201).json({
      success: true,
      message: createdSchedules.length === 1
        ? 'Lên lịch thành công'
        : `Đã mở thành công ${createdSchedules.length} ca lịch cho lớp "${groupClass.name}".`,
      data: createdSchedules[0],
      schedules: createdSchedules,
      createdCount: createdSchedules.length,
    });
  } catch (error: any) {
    if (error?.statusCode === 400 || error?.statusCode === 409) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    console.error('Lỗi createGroupClassSchedule:', error);
    return res.status(500).json({ success: false, message: 'Lỗi lên lịch lớp học' });
  }
};

/**
 * Đổi HLV phụ trách ca lớp học nhóm sắp diễn ra
 * @route PATCH /api/group-classes/schedules/:scheduleId/trainer
 */
export const reassignGroupClassScheduleTrainer = async (req: AuthRequest, res: Response) => {
  try {
    const scheduleId = Number(req.params.scheduleId);
    const nextTrainerId = Number(req.body?.trainerId);
    if (!Number.isSafeInteger(scheduleId) || scheduleId <= 0 || !Number.isSafeInteger(nextTrainerId) || nextTrainerId <= 0) {
      return res.status(400).json({ success: false, message: 'scheduleId và trainerId không hợp lệ.' });
    }

    const schedule = await prisma.groupClassSchedule.findUnique({
      where: { id: scheduleId },
      include: {
        groupClass: { select: { name: true } },
        room: { select: { name: true } },
        bookings: { where: { status: { in: ['BOOKED', 'CHECKED_IN'] } }, select: { userId: true } },
      },
    });
    if (!schedule) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy ca lớp học nhóm.' });
    }
    if (!['OPEN', 'FULL'].includes(schedule.status) || schedule.endTime <= new Date()) {
      return res.status(409).json({ success: false, message: 'Chỉ có thể đổi HLV cho ca lớp nhóm chưa kết thúc và đang mở.' });
    }
    if (schedule.trainerId === nextTrainerId) {
      return res.status(400).json({ success: false, message: 'HLV mới trùng với HLV hiện tại.' });
    }

    const trainerCheck = await validateActiveGroupTrainer(prisma, nextTrainerId);
    if (!trainerCheck.ok) {
      return res.status(trainerCheck.status).json({ success: false, message: trainerCheck.message });
    }

    const trainerConflict = await findTrainerScheduleConflict(
      prisma,
      nextTrainerId,
      schedule.startTime,
      schedule.endTime,
      scheduleId,
    );
    if (trainerConflict) {
      return res.status(409).json({ success: false, message: trainerConflict });
    }

    const updated = await prisma.$transaction(async (tx) => {
      await lockPtCalendar(tx);
      for (const id of [...new Set([schedule.trainerId, nextTrainerId])].sort((a, b) => a - b)) {
        await lockPtCoach(tx, id);
      }
      const currentSchedule = await tx.groupClassSchedule.findUnique({
        where: { id: scheduleId },
        select: { status: true, startTime: true, endTime: true, trainerId: true },
      });
      if (!currentSchedule || !ACTIVE_GROUP_CLASS_SCHEDULE_STATUSES.includes(currentSchedule.status) || currentSchedule.endTime <= new Date()) {
        throw Object.assign(new Error('Chỉ có thể đổi HLV cho ca lớp nhóm chưa kết thúc và đang mở.'), { statusCode: 409 });
      }
      if (currentSchedule.trainerId !== schedule.trainerId) {
        throw Object.assign(new Error('HLV phụ trách ca lớp này vừa thay đổi, vui lòng thử lại.'), { statusCode: 409 });
      }
      const txConflict = await findTrainerScheduleConflict(
        tx,
        nextTrainerId,
        currentSchedule.startTime,
        currentSchedule.endTime,
        scheduleId,
      );
      if (txConflict) {
        throw Object.assign(new Error(txConflict), { statusCode: 409 });
      }

      const saved = await tx.groupClassSchedule.update({
        where: { id: scheduleId },
        data: { trainerId: nextTrainerId },
        include: {
          groupClass: true,
          trainer: { select: { id: true, fullName: true, avatar: true } },
          room: true,
        },
      });

      await tx.actionLog.create({
        data: {
          userId: req.user!.userId,
          action: 'GROUP_CLASS_TRAINER_REASSIGN',
          details: JSON.stringify({
            scheduleId,
            className: schedule.groupClass.name,
            oldTrainerId: schedule.trainerId,
            newTrainerId: nextTrainerId,
          }),
        },
      });

      return saved;
    });

    const dateLabel = schedule.startTime.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
    const startLabel = schedule.startTime.toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' });
    const endLabel = schedule.endTime.toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' });
    const timeText = `${dateLabel} (${startLabel}–${endLabel})${schedule.room?.name ? ` tại ${schedule.room.name}` : ''}`;

    const notifyTasks: Promise<unknown>[] = [
      createUserNotification({
        userId: nextTrainerId,
        title: 'Phân công dạy thay lớp nhóm',
        message: `Bạn được phân công phụ trách lớp "${schedule.groupClass.name}" vào ${timeText}.`,
      }),
      createUserNotification({
        userId: schedule.trainerId,
        title: 'Thay đổi phân công lớp nhóm',
        message: `Lớp "${schedule.groupClass.name}" vào ${timeText} đã được chuyển cho HLV ${trainerCheck.trainer.fullName}.`,
      }),
    ];
    for (const b of schedule.bookings) {
      notifyTasks.push(
        createUserNotification({
          userId: b.userId,
          title: 'Cập nhật HLV lớp học nhóm',
          message: `Lớp "${schedule.groupClass.name}" vào ${timeText} sẽ do HLV ${trainerCheck.trainer.fullName} phụ trách.`,
        })
      );
    }
    await Promise.allSettled(notifyTasks);

    return res.status(200).json({ success: true, message: 'Đã chuyển HLV phụ trách lớp học nhóm.', data: updated });
  } catch (error: any) {
    if (error?.statusCode === 409) {
      return res.status(409).json({ success: false, message: error.message });
    }
    console.error('Lỗi reassignGroupClassScheduleTrainer:', error);
    return res.status(500).json({ success: false, message: 'Không thể đổi HLV lớp học nhóm.' });
  }
};

/**
 * Hủy ca lớp học nhóm sắp diễn ra
 * @route PATCH /api/group-classes/schedules/:scheduleId/cancel
 */
export const cancelGroupClassSchedule = async (req: AuthRequest, res: Response) => {
  try {
    const scheduleId = Number(req.params.scheduleId);
    if (!Number.isSafeInteger(scheduleId) || scheduleId <= 0) {
      return res.status(400).json({ success: false, message: 'scheduleId không hợp lệ.' });
    }

    const schedule = await prisma.groupClassSchedule.findUnique({
      where: { id: scheduleId },
      include: {
        groupClass: { select: { name: true } },
        bookings: { where: { status: { in: ['BOOKED', 'CHECKED_IN'] } }, select: { userId: true } },
      },
    });
    if (!schedule) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy ca lớp học nhóm.' });
    }
    if (!['OPEN', 'FULL'].includes(schedule.status) || schedule.endTime <= new Date()) {
      return res.status(409).json({ success: false, message: 'Chỉ có thể hủy ca lớp nhóm đang mở và chưa kết thúc.' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.groupClassBooking.updateMany({
        where: { scheduleId, status: { in: ['BOOKED', 'CHECKED_IN'] } },
        data: { status: 'CANCELLED' },
      });

      const saved = await tx.groupClassSchedule.update({
        where: { id: scheduleId },
        data: { status: 'CANCELLED', bookedCount: 0 },
      });

      await tx.actionLog.create({
        data: {
          userId: req.user!.userId,
          action: 'GROUP_CLASS_CANCELLED',
          details: JSON.stringify({
            scheduleId,
            className: schedule.groupClass.name,
            trainerId: schedule.trainerId,
            cancelledBookingsCount: schedule.bookings.length,
          }),
        },
      });

      return saved;
    });

    const dateLabel = schedule.startTime.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
    const startLabel = schedule.startTime.toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' });
    const notifyTasks: Promise<unknown>[] = [
      createUserNotification({
        userId: schedule.trainerId,
        title: 'Hủy ca lớp học nhóm',
        message: `Ca lớp "${schedule.groupClass.name}" lúc ${startLabel} ngày ${dateLabel} đã được hủy bởi Quản lý.`,
      }),
    ];
    for (const b of schedule.bookings) {
      notifyTasks.push(
        createUserNotification({
          userId: b.userId,
          title: 'Thông báo hủy lớp học nhóm',
          message: `Ca lớp "${schedule.groupClass.name}" lúc ${startLabel} ngày ${dateLabel} đã được hủy. Mong bạn thông cảm!`,
        })
      );
    }
    await Promise.allSettled(notifyTasks);

    return res.status(200).json({ success: true, message: 'Đã hủy ca lớp học nhóm.', data: updated });
  } catch (error: any) {
    console.error('Lỗi cancelGroupClassSchedule:', error);
    return res.status(500).json({ success: false, message: 'Không thể hủy ca lớp học nhóm.' });
  }
};
