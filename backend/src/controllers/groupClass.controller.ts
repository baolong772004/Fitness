import { Request, Response } from 'express';
import prisma from '../config/prisma.js';
import { AuthRequest } from '../middlewares/auth.middleware.js';
import jwt from 'jsonwebtoken';
import QRCode from 'qrcode';
import { refreshGymMembershipStates } from '../services/membership.service.js';



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

    const schedules = await prisma.groupClassSchedule.findMany({
      where: all ? {} : {
        startTime: {
          gte: startOfDay,
          lt: endOfDay,
        },
        status: { in: ['OPEN', 'FULL'] },
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

    // 2. Kiểm tra lớp đã bắt đầu hoặc đã qua thời gian đăng ký chưa
    const now = new Date();
    const scheduleStartTime = new Date(schedule.startTime);
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

    // 5. Thực hiện Transaction chống Overbooking:
    // Cập nhật có điều kiện bookedCount: { lt: schedule.capacity } và increment: 1
    const result = await prisma.$transaction(async (tx) => {
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
    if (error.message === 'OVERBOOKING_FULL') {
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

      // 2. Giảm bookedCount có điều kiện: chỉ giảm nếu bookedCount > 0 và mở lại OPEN
      await tx.groupClassSchedule.updateMany({
        where: {
          id: scheduleId,
          bookedCount: { gt: 0 },
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
    
    if (!name) return res.status(400).json({ success: false, message: 'Tên lớp là bắt buộc' });

    const newClass = await prisma.groupClass.create({
      data: { name, description, imageUrl, durationMin: Number(durationMin || 60) }
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
    const { classId, trainerId, roomId, startTime, endTime, capacity } = req.body;

    const parsedClassId = Number(classId);
    const parsedTrainerId = Number(trainerId);
    const parsedRoomId = roomId === undefined || roomId === null || roomId === '' ? null : Number(roomId);
    const parsedCapacity = capacity === undefined || capacity === null || capacity === '' ? 20 : Number(capacity);
    const parsedStartTime = new Date(startTime);
    const parsedEndTime = new Date(endTime);

    if (!Number.isSafeInteger(parsedClassId) || parsedClassId <= 0 ||
        !Number.isSafeInteger(parsedTrainerId) || parsedTrainerId <= 0 ||
        !startTime || !endTime) {
       return res.status(400).json({ success: false, message: 'classId, trainerId, startTime và endTime là bắt buộc và phải hợp lệ' });
    }

    if (parsedRoomId !== null && (!Number.isSafeInteger(parsedRoomId) || parsedRoomId <= 0)) {
      return res.status(400).json({ success: false, message: 'roomId phải là số nguyên dương' });
    }
    if (!Number.isSafeInteger(parsedCapacity) || parsedCapacity <= 0) {
      return res.status(400).json({ success: false, message: 'capacity phải là số nguyên dương' });
    }
    if (Number.isNaN(parsedStartTime.getTime()) || Number.isNaN(parsedEndTime.getTime()) || parsedEndTime <= parsedStartTime) {
      return res.status(400).json({ success: false, message: 'startTime và endTime không hợp lệ hoặc endTime không sau startTime' });
    }

    const [groupClass, trainer, room] = await Promise.all([
      prisma.groupClass.findUnique({ where: { id: parsedClassId }, select: { id: true } }),
      prisma.user.findUnique({ where: { id: parsedTrainerId }, select: { id: true } }),
      parsedRoomId === null
        ? Promise.resolve({ id: null })
        : prisma.room.findUnique({ where: { id: parsedRoomId }, select: { id: true } })
    ]);

    if (!groupClass) return res.status(404).json({ success: false, message: `Không tìm thấy lớp học với classId=${parsedClassId}` });
    if (!trainer) return res.status(404).json({ success: false, message: `Không tìm thấy người dùng với trainerId=${parsedTrainerId}` });
    if (!room) return res.status(404).json({ success: false, message: `Không tìm thấy phòng với roomId=${parsedRoomId}` });

    const schedule = await prisma.groupClassSchedule.create({
      data: {
        classId: parsedClassId,
        trainerId: parsedTrainerId,
        roomId: parsedRoomId,
        startTime: parsedStartTime,
        endTime: parsedEndTime,
        capacity: parsedCapacity,
        status: 'OPEN'
      }
    });

    return res.status(201).json({ success: true, message: 'Lên lịch thành công', data: schedule });
  } catch (error: any) {
    console.error('Lỗi createGroupClassSchedule:', error);
    return res.status(500).json({ success: false, message: 'Lỗi lên lịch lớp học' });
  }
};
