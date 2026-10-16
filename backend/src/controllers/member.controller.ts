import { Request, Response } from 'express';
import prisma from '../config/prisma.js';
import { AuthRequest } from '../middlewares/auth.middleware.js';



/**
 * API: Lấy danh sách lịch tập tổng hợp của Member (Gồm PT Booking & Group Class Booking)
 * @route GET /api/member/my-schedule?fromDate=...&toDate=...&type=ALL
 */
export const getMySchedule = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { fromDate, toDate, type } = req.query; // type: 'ALL' | 'PT' | 'GROUP'

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const start = fromDate ? new Date(fromDate as string) : new Date();
    // Default end date is +30 days
    const end = toDate ? new Date(toDate as string) : new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);

    let ptBookings: any[] = [];
    let groupBookings: any[] = [];

    // 1. Lấy lịch PT
    if (!type || type === 'ALL' || type === 'PT') {
      ptBookings = await prisma.booking.findMany({
        where: {
          memberId: Number(userId),
          type: 'PT',
          startTime: { gte: start, lte: end },
        },
        include: {
          coach: { select: { id: true, fullName: true, avatar: true, phone: true } },
          membership: { include: { package: { select: { name: true } } } },
        },
        orderBy: { startTime: 'asc' },
      });
    }

    // 2. Lấy lịch Group Class
    if (!type || type === 'ALL' || type === 'GROUP') {
      groupBookings = await prisma.groupClassBooking.findMany({
        where: {
          userId: Number(userId),
          schedule: {
            startTime: { gte: start, lte: end },
          },
        },
        include: {
          schedule: {
            include: {
              groupClass: true,
              trainer: { select: { id: true, fullName: true, avatar: true } },
              room: { select: { name: true } }
            },
          },
        },
        orderBy: { schedule: { startTime: 'asc' } },
      });
    }

    // 3. Chuẩn hóa Unified Calendar Events
    const nowMs = new Date().getTime();

    const normalizedPtEvents = ptBookings.map((item) => ({
      id: item.id,
      bookingType: 'PERSONAL_TRAINING',
      title: `Tập PT với ${item.coach?.fullName || 'HLV'}`,
      startTime: item.startTime,
      endTime: item.endTime,
      status: item.status, 
      trainerName: item.coach?.fullName,
      trainerAvatar: item.coach?.avatar,
      location: 'Khu vực PT / Gym Floor',
      canCancel: (item.status === 'UPCOMING' || item.status === 'CONFIRMED') && 
                 (new Date(item.startTime).getTime() - nowMs >= 2 * 60 * 60 * 1000),
    }));

    const normalizedGroupEvents = groupBookings.map((item) => ({
      id: item.id,
      scheduleId: item.scheduleId,
      bookingType: 'GROUP_CLASS',
      title: item.schedule.groupClass.name,
      startTime: item.schedule.startTime,
      endTime: item.schedule.endTime,
      status: item.status, 
      trainerName: item.schedule.trainer.fullName,
      trainerAvatar: item.schedule.trainer.avatar,
      location: item.schedule.room?.name || 'Phòng tập nhóm',
      canCancel: item.status === 'BOOKED' && 
                 (new Date(item.schedule.startTime).getTime() - nowMs >= 2 * 60 * 60 * 1000),
    }));

    // Gom và sắp xếp
    const allEvents = [...normalizedPtEvents, ...normalizedGroupEvents].sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );

    return res.status(200).json({
      success: true,
      data: allEvents,
    });
  } catch (error: any) {
    console.error('Lỗi getMySchedule:', error);
    return res.status(500).json({ success: false, message: 'Lỗi lấy thông tin lịch tập' });
  }
};

/**
 * API: Chi tiết 1 buổi tập
 * @route GET /api/member/booking-detail/:type/:id
 */
export const getBookingDetail = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { type, id } = req.params; // type: 'PT' hoặc 'GROUP'

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const nowMs = new Date().getTime();

    if (type === 'PT') {
      const booking = await prisma.booking.findUnique({
        where: { id: Number(id) },
        include: {
          coach: { select: { id: true, fullName: true, avatar: true, phone: true } },
          membership: { include: { package: true } },
        }
      });

      if (!booking || booking.memberId !== userId) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy lịch PT' });
      }

      return res.status(200).json({
        success: true,
        data: {
          ...booking,
          canCancel: (booking.status === 'UPCOMING' || booking.status === 'CONFIRMED') && 
                     (new Date(booking.startTime).getTime() - nowMs >= 2 * 60 * 60 * 1000)
        }
      });

    } else if (type === 'GROUP') {
      const booking = await prisma.groupClassBooking.findUnique({
        where: { id: Number(id) },
        include: {
          schedule: {
            include: {
              groupClass: true,
              trainer: { select: { id: true, fullName: true, avatar: true, phone: true } },
              room: true
            }
          }
        }
      });

      if (!booking || booking.userId !== userId) {
         return res.status(404).json({ success: false, message: 'Không tìm thấy lịch Group Class' });
      }

      return res.status(200).json({
        success: true,
        data: {
          ...booking,
          canCancel: booking.status === 'BOOKED' && 
                     (new Date(booking.schedule.startTime).getTime() - nowMs >= 2 * 60 * 60 * 1000)
        }
      });
    }

    return res.status(400).json({ success: false, message: 'Loại lịch tập (type) không hợp lệ, phải là PT hoặc GROUP' });
  } catch (error: any) {
    console.error('Lỗi getBookingDetail:', error);
    return res.status(500).json({ success: false, message: 'Lỗi lấy chi tiết lịch tập' });
  }
};
