import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../config/prisma.js';
import { AuthRequest } from '../middlewares/auth.middleware.js';
import { summarizePtBatches, walletSummary } from '../services/ptWallet.service.js';



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
          avatar: true,
          gender: true,
          dateOfBirth: true,
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
              ptCreditBatches: { select: { id: true } },
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
          memberBookings: { where: { type: 'PT', status: { in: ['CONFIRMED', 'IN_PROGRESS'] },
            endTime: { gt: now }, coachId: { not: null } },
            select: { coach: { select: { fullName: true } } }, orderBy: { startTime: 'asc' }, take: 1 },
          ptWallet: { select: { batches: { select: { id: true, level: true, source: true, initialCount: true,
            usedCount: true, heldCount: true, startAt: true, endAt: true, activatedAt: true,
            membership: { select: { status: true, startDate: true, endDate: true } } } } } },
          _count: {
            select: { checkIns: { where: { status: 'SUCCESS' } } },
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
      data: members.map(member => {
        const currentGymMembership = member.memberships.find(row => row.package.type === 'MEMBERSHIP') ?? null;
        const legacyPtMemberships = member.memberships.filter(row => row.package.type === 'PT' && !row.ptCreditBatches.length);
        const currentCoachName = member.memberBookings[0]?.coach?.fullName ??
          member.memberships.find(row => row.package.type === 'PT' && row.coach)?.coach?.fullName ?? null;
        const { memberships, memberBookings, ptWallet, _count, ...profile } = member;
        return { ...profile, currentGymMembership, currentCoachName,
          ptCredit: summarizePtBatches(ptWallet?.batches ?? [], now),
          legacyPtSessions: legacyPtMemberships.reduce((sum, row) => sum + Math.max(0, row.remainingSessions ?? 0), 0),
          checkInCount: _count.checkIns };
      }),
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
    const member = await prisma.user.findFirst({
      where: { id: memberId, role: 'MEMBER' },
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
    const [memberships, payments, ptBookings, groupBookings, checkIns, checkInTotal, ptWalletSummary] = await Promise.all([
      // Tất cả gói tập (Gym, Yoga chung và PT)
      prisma.membership.findMany({
        where: { userId: memberId },
        include: {
          package: true,
          ptCreditBatches: { select: { id: true } },
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
        where: { memberId: memberId, status: 'SUCCESS' },
        include: {
           room: { select: { name: true } },
           staff: { select: { fullName: true } }
        },
        orderBy: { checkInTime: 'desc' },
        take: 20,
      }),
      prisma.checkIn.count({ where: { memberId, status: 'SUCCESS' } }),
      walletSummary(prisma, memberId),
    ]);

    // Lọc ra các loại Membership để dễ hiển thị
    const membershipSubscriptions = memberships.filter(m => m.package.type === 'MEMBERSHIP');
    const ptSubscriptions = memberships.filter(m => m.package.type === 'PT');
    const legacyPtSessions = ptSubscriptions.filter(m => m.status === 'ACTIVE' &&
      !m.ptCreditBatches.length).reduce((sum, m) => sum + Math.max(0, m.remainingSessions ?? 0), 0);
    const now = new Date();
    const currentGymMembership = membershipSubscriptions.find(m => m.status === 'ACTIVE' &&
      m.startDate <= now && m.endDate >= now) ?? null;

    return res.status(200).json({
      success: true,
      data: {
        profile: member,
        currentGymMembership,
        membershipSubscriptions,
        ptSubscriptions,
        ptWalletSummary,
        legacyPtSessions,
        paymentHistory: payments,
        checkInHistory: checkIns,
        checkInTotal,
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
