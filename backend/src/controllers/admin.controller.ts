import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../config/prisma.js';
import { AuthRequest } from '../middlewares/auth.middleware.js';



/**
 * API 1: Tìm kiếm & Phân trang danh sách Member
 * @route GET /api/admin/members?search=Nguyen&page=1&limit=10
 */
export const getMembersList = async (req: AuthRequest, res: Response) => {
  try {
    const { search, page = 1, limit = 10 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const now = new Date();

    // Điều kiện tìm kiếm theo Tên, Email hoặc Số điện thoại
    let whereCondition: Prisma.UserWhereInput = { role: 'MEMBER' };

    if (search) {
      whereCondition.OR = [
        { fullName: { contains: String(search) } },
        { email: { contains: String(search) } },
        { phone: { contains: String(search) } },
      ];
    }

    const [members, total] = await Promise.all([
      prisma.user.findMany({
        where: whereCondition,
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          avatar: true, // avatar, not avatarUrl in DB
          status: true, // PENDING | ACTIVE | INACTIVE | BLOCKED
          createdAt: true,
          memberships: {
            where: {
              OR: [
                {
                  status: 'ACTIVE',
                  startDate: { lte: now },
                  endDate: { gte: now },
                },
                {
                  status: 'FROZEN',
                }
              ]
            },
            include: {
              package: true,
              coach: {
                select: {
                  id: true,
                  fullName: true,
                  email: true,
                  phone: true,
                },
              },
            },
            orderBy: [{ endDate: 'desc' }, { createdAt: 'desc' }],
          },
          _count: {
            select: { checkIns: true },
          },
        },
        skip: Number(skip),
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where: whereCondition }),
    ]);

    return res.status(200).json({
      success: true,
      data: members,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error: any) {
    console.error('Lỗi getMembersList:', error);
    return res.status(500).json({ success: false, message: 'Lỗi lấy danh sách Member' });
  }
};

/**
 * API 2: Xem Hồ sơ 360° Chi tiết của Member
 * @route GET /api/admin/members/:id/profile
 */
export const getMemberDetailProfile = async (req: AuthRequest, res: Response) => {
  try {
    const memberId = Number(req.params.id);

    // 1. Kiểm tra Member có tồn tại không
    const member = await prisma.user.findUnique({
      where: { id: memberId },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        avatar: true,
        status: true,
        createdAt: true,
      },
    });

    if (!member) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy Member' });
    }

    // 2. Truy vấn đồng thời các thông tin liên quan (Parallel Queries)
    const [memberships, payments, ptBookings, groupBookings, checkIns] = await Promise.all([
      // Tất cả gói tập (Gym, Yoga chung và PT)
      prisma.membership.findMany({
        where: { userId: memberId },
        include: {
          package: true,
          coach: { select: { fullName: true } }
        },
        orderBy: { createdAt: 'desc' },
      }),
      // Lịch sử thanh toán/Hóa đơn
      prisma.payment.findMany({
        where: { userId: memberId },
        orderBy: { createdAt: 'desc' },
      }),
      // Lịch sử tập với PT
      prisma.booking.findMany({
        where: { memberId: memberId, type: 'PT' },
        include: { coach: { select: { fullName: true } } },
        orderBy: { startTime: 'desc' },
        take: 20, // Lấy 20 buổi gần nhất
      }),
      // Lịch sử tập Lớp Group Class
      prisma.groupClassBooking.findMany({
        where: { userId: memberId },
        include: {
          schedule: {
            include: { groupClass: true, room: true, trainer: { select: { fullName: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      // Lịch sử Check-in
      prisma.checkIn.findMany({
        where: { memberId: memberId },
        include: {
           room: { select: { name: true } },
           staff: { select: { fullName: true } }
        },
        orderBy: { checkInTime: 'desc' },
        take: 20,
      })
    ]);

    // Lọc ra các loại Membership để dễ hiển thị
    const membershipSubscriptions = memberships.filter(m => m.package.type === 'MEMBERSHIP');
    const ptSubscriptions = memberships.filter(m => m.package.type === 'PT' || m.coachId !== null);

    return res.status(200).json({
      success: true,
      data: {
        profile: member,
        membershipSubscriptions,
        ptSubscriptions,
        paymentHistory: payments,
        checkInHistory: checkIns,
        trainingHistory: {
          ptSessions: ptBookings,
          groupClasses: groupBookings,
        },
      },
    });
  } catch (error: any) {
    console.error('Lỗi getMemberDetailProfile:', error);
    return res.status(500).json({ success: false, message: 'Lỗi lấy hồ sơ chi tiết Member' });
  }
};
