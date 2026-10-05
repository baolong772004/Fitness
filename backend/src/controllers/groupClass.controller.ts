import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middlewares/auth.middleware.js';

const prisma = new PrismaClient();

/**
 * API 1: Xem danh sách lớp học nhóm & Lịch học theo ngày
 * @route GET /api/group-classes/schedules?date=2026-10-06
 */
export const getGroupClassSchedules = async (req: Request, res: Response) => {
  try {
    const { date } = req.query;
    const targetDate = date ? new Date(date as string) : new Date();

    // Lấy danh sách lịch học trong ngày được chọn
    const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

    const schedules = await prisma.groupClassSchedule.findMany({
      where: {
        startTime: {
          gte: startOfDay,
          lte: endOfDay,
        },
        status: { in: ['OPEN', 'FULL'] },
      },
      include: {
        groupClass: true,
        trainer: { select: { id: true, fullName: true, avatar: true } },
        room: true
      },
      orderBy: { startTime: 'asc' },
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
    if (new Date() >= new Date(schedule.startTime)) {
      return res.status(400).json({
        success: false,
        message: 'Lớp học đã bắt đầu hoặc đã kết thúc, không thể đăng ký',
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

    if (existingBooking && existingBooking.status === 'BOOKED') {
      return res.status(400).json({
        success: false,
        message: 'Bạn đã đăng ký lớp học này trước đó rồi',
      });
    }

    // 5. Thực hiện Transaction: Đăng ký + Tăng bookedCount + Cập nhật FULL nếu chạm trần
    const result = await prisma.$transaction(async (tx) => {
      let booking;
      if (existingBooking) {
         // Nếu đã hủy trước đó thì cập nhật lại trạng thái
         booking = await tx.groupClassBooking.update({
            where: { id: existingBooking.id },
            data: { status: 'BOOKED' }
         });
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

      // 5b. Tăng số người đã đăng ký
      const newBookedCount = schedule.bookedCount + 1;
      const isFull = newBookedCount >= schedule.capacity;

      const updatedSchedule = await tx.groupClassSchedule.update({
        where: { id: Number(scheduleId) },
        data: {
          bookedCount: newBookedCount,
          status: isFull ? 'FULL' : 'OPEN',
        },
      });

      return { booking, updatedSchedule };
    });

    return res.status(200).json({
      success: true,
      message: 'Đăng ký lớp học nhóm thành công!',
      data: result,
    });
  } catch (error: any) {
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

    // Thực hiện Transaction: Cập nhật Cancelled + Giảm bookedCount + Cập nhật OPEN
    const result = await prisma.$transaction(async (tx) => {
      const updatedBooking = await tx.groupClassBooking.update({
        where: { id: bookingId },
        data: { status: 'CANCELLED' },
      });

      const schedule = booking.schedule;
      const newBookedCount = Math.max(0, schedule.bookedCount - 1);
      
      const updatedSchedule = await tx.groupClassSchedule.update({
        where: { id: schedule.id },
        data: {
          bookedCount: newBookedCount,
          status: 'OPEN', // Chắc chắn mở lại trạng thái OPEN
        },
      });

      return { updatedBooking, updatedSchedule };
    });

    return res.status(200).json({
      success: true,
      message: 'Hủy lịch học nhóm thành công! Đã nhường slot cho người khác.',
      data: result,
    });
  } catch (error: any) {
    console.error('Lỗi cancelGroupClass:', error);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi hủy lịch' });
  }
};

/**
 * API 4: Member Check-in Lớp Group Class
 * @route POST /api/group-classes/check-in/:bookingId
 */
export const checkInGroupClass = async (req: AuthRequest, res: Response) => {
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
      return res.status(403).json({ success: false, message: 'Bạn không có quyền check-in lịch này' });
    }

    if (booking.status !== 'BOOKED') {
      return res.status(400).json({ success: false, message: `Không thể check-in, trạng thái hiện tại: ${booking.status}` });
    }

    // Optional: Có thể check điều kiện thời gian check-in (VD: trước giờ học 30p, sau giờ học không cho check-in)
    const now = new Date();
    const startTime = new Date(booking.schedule.startTime);
    const endTime = new Date(booking.schedule.endTime);

    if (now > endTime) {
       return res.status(400).json({ success: false, message: 'Lớp học đã kết thúc, không thể check-in' });
    }

    const updatedBooking = await prisma.groupClassBooking.update({
      where: { id: bookingId },
      data: { status: 'CHECKED_IN' }
    });

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

    if (!classId || !trainerId || !startTime || !endTime) {
       return res.status(400).json({ success: false, message: 'Thiếu thông tin bắt buộc' });
    }

    const schedule = await prisma.groupClassSchedule.create({
      data: {
        classId: Number(classId),
        trainerId: Number(trainerId),
        roomId: roomId ? Number(roomId) : null,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        capacity: Number(capacity || 20),
        status: 'OPEN'
      }
    });

    return res.status(201).json({ success: true, message: 'Lên lịch thành công', data: schedule });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Lỗi lên lịch lớp học' });
  }
};
