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

/**
 * Helper xây dựng các mốc dữ liệu biểu đồ doanh thu và checkin
 */
function buildChartPoints(
  range: string,
  payments: Array<{ createdAt: Date; amount: any }>,
  checkins: Array<{ checkInTime: Date }>,
  now: Date
) {
  if (range === 'today') {
    const slots = [
      { label: '06:00', startH: 0, endH: 8, rev: 0, checkins: 0 },
      { label: '09:00', startH: 8, endH: 11, rev: 0, checkins: 0 },
      { label: '12:00', startH: 11, endH: 14, rev: 0, checkins: 0 },
      { label: '15:00', startH: 14, endH: 17, rev: 0, checkins: 0 },
      { label: '18:00', startH: 17, endH: 20, rev: 0, checkins: 0 },
      { label: '21:00', startH: 20, endH: 24, rev: 0, checkins: 0 },
    ];
    for (const p of payments) {
      const h = new Date(p.createdAt).getHours();
      for (const s of slots) {
        if (h >= s.startH && h < s.endH) {
          s.rev += Number(p.amount);
          break;
        }
      }
    }
    for (const c of checkins) {
      const h = new Date(c.checkInTime).getHours();
      for (const s of slots) {
        if (h >= s.startH && h < s.endH) {
          s.checkins++;
          break;
        }
      }
    }
    return slots.map(s => ({
      label: s.label,
      rev: Number((s.rev / 1000000).toFixed(2)),
      checkins: s.checkins
    }));
  }

  if (range === '7days') {
    const days: Array<{ dateStr: string; label: string; rev: number; checkins: number }> = [];
    const dayNames = ['CN', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const label = `${dayNames[d.getDay()]} (${d.getDate()}/${d.getMonth() + 1})`;
      days.push({ dateStr, label, rev: 0, checkins: 0 });
    }
    for (const p of payments) {
      const pDate = new Date(p.createdAt).toISOString().slice(0, 10);
      const slot = days.find(d => d.dateStr === pDate);
      if (slot) slot.rev += Number(p.amount);
    }
    for (const c of checkins) {
      const cDate = new Date(c.checkInTime).toISOString().slice(0, 10);
      const slot = days.find(d => d.dateStr === cDate);
      if (slot) slot.checkins++;
    }
    return days.map(d => ({
      label: d.label,
      rev: Number((d.rev / 1000000).toFixed(2)),
      checkins: d.checkins
    }));
  }

  if (range === 'month') {
    const weeks = [
      { label: 'Tuần 1 (1-7)', startD: 1, endD: 7, rev: 0, checkins: 0 },
      { label: 'Tuần 2 (8-14)', startD: 8, endD: 14, rev: 0, checkins: 0 },
      { label: 'Tuần 3 (15-21)', startD: 15, endD: 21, rev: 0, checkins: 0 },
      { label: 'Tuần 4 (22+)', startD: 22, endD: 32, rev: 0, checkins: 0 },
    ];
    for (const p of payments) {
      const d = new Date(p.createdAt).getDate();
      for (const w of weeks) {
        if (d >= w.startD && d <= w.endD) {
          w.rev += Number(p.amount);
          break;
        }
      }
    }
    for (const c of checkins) {
      const d = new Date(c.checkInTime).getDate();
      for (const w of weeks) {
        if (d >= w.startD && d <= w.endD) {
          w.checkins++;
          break;
        }
      }
    }
    return weeks.map(w => ({
      label: w.label,
      rev: Number((w.rev / 1000000).toFixed(2)),
      checkins: w.checkins
    }));
  }

  if (range === 'quarter') {
    const curMonth = now.getMonth();
    const qStartMonth = Math.floor(curMonth / 3) * 3;
    const months = [
      { label: `Tháng ${qStartMonth + 1}`, monthIdx: qStartMonth, rev: 0, checkins: 0 },
      { label: `Tháng ${qStartMonth + 2}`, monthIdx: qStartMonth + 1, rev: 0, checkins: 0 },
      { label: `Tháng ${qStartMonth + 3}`, monthIdx: qStartMonth + 2, rev: 0, checkins: 0 },
    ];
    for (const p of payments) {
      const m = new Date(p.createdAt).getMonth();
      const slot = months.find(item => item.monthIdx === m);
      if (slot) slot.rev += Number(p.amount);
    }
    for (const c of checkins) {
      const m = new Date(c.checkInTime).getMonth();
      const slot = months.find(item => item.monthIdx === m);
      if (slot) slot.checkins++;
    }
    return months.map(m => ({
      label: m.label,
      rev: Number((m.rev / 1000000).toFixed(2)),
      checkins: m.checkins
    }));
  }

  // range === 'year'
  const quarters = [
    { label: 'Quý 1', qIdx: 0, rev: 0, checkins: 0 },
    { label: 'Quý 2', qIdx: 1, rev: 0, checkins: 0 },
    { label: 'Quý 3', qIdx: 2, rev: 0, checkins: 0 },
    { label: 'Quý 4', qIdx: 3, rev: 0, checkins: 0 },
  ];
  for (const p of payments) {
    const q = Math.floor(new Date(p.createdAt).getMonth() / 3);
    if (quarters[q]) quarters[q].rev += Number(p.amount);
  }
  for (const c of checkins) {
    const q = Math.floor(new Date(c.checkInTime).getMonth() / 3);
    if (quarters[q]) quarters[q].checkins++;
  }
  return quarters.map(q => ({
    label: q.label,
    rev: Number((q.rev / 1000000).toFixed(2)),
    checkins: q.checkins
  }));
}

/**
 * API 3: Thống kê tổng hợp (Analytics) thời gian thực dành cho Admin Dashboard
 * @route GET /api/admin/analytics?range=today|7days|month|quarter|year
 */
export const getAdminAnalytics = async (req: AuthRequest, res: Response) => {
  try {
    const range = (req.query.range as string) || 'month';
    const now = new Date();

    let startDate: Date;
    let endDate: Date;
    let prevStartDate: Date;
    let prevEndDate: Date;
    let periodLabel: string;
    let subLabel: string;

    if (range === 'today') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      prevStartDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
      prevEndDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
      periodLabel = 'Hôm Nay';
      subLabel = 'Số liệu 24 giờ qua';
    } else if (range === '7days') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      prevStartDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 13, 0, 0, 0, 0);
      prevEndDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7, 23, 59, 59, 999);
      periodLabel = '7 Ngày Qua';
      subLabel = 'Tuần vận hành gần nhất';
    } else if (range === 'quarter') {
      const qStartMonth = Math.floor(now.getMonth() / 3) * 3;
      startDate = new Date(now.getFullYear(), qStartMonth, 1, 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), qStartMonth + 3, 0, 23, 59, 59, 999);
      prevStartDate = new Date(now.getFullYear(), qStartMonth - 3, 1, 0, 0, 0, 0);
      prevEndDate = new Date(now.getFullYear(), qStartMonth, 0, 23, 59, 59, 999);
      periodLabel = `Quý ${Math.floor(now.getMonth() / 3) + 1}`;
      subLabel = `Tháng ${qStartMonth + 1} - Tháng ${qStartMonth + 3}/${now.getFullYear()}`;
    } else if (range === 'year') {
      startDate = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      prevStartDate = new Date(now.getFullYear() - 1, 0, 1, 0, 0, 0, 0);
      prevEndDate = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
      periodLabel = `Năm ${now.getFullYear()}`;
      subLabel = 'Lũy kế cả năm tài chính';
    } else {
      // 'month' (default)
      startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      prevStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      prevEndDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      periodLabel = 'Tháng Này';
      subLabel = `Tháng ${now.getMonth() + 1}/${now.getFullYear()}`;
    }

    // Parallel queries
    const [
      periodPayments,
      prevPeriodPayments,
      allTimePaidPayments,
      periodCheckins,
      allTimeCheckins,
      totalMembers,
      activeMembers,
      totalCoaches,
      packagesCount,
      ptProductsCount,
      recentPaymentsRaw
    ] = await Promise.all([
      prisma.payment.findMany({
        where: { status: 'PAID', createdAt: { gte: startDate, lte: endDate } },
        include: { membership: { include: { package: true } }, ptProduct: true }
      }),
      prisma.payment.findMany({
        where: { status: 'PAID', createdAt: { gte: prevStartDate, lte: prevEndDate } },
        select: { amount: true }
      }),
      prisma.payment.findMany({
        where: { status: 'PAID' },
        include: { membership: { include: { package: true } }, ptProduct: true }
      }),
      prisma.checkIn.findMany({
        where: { status: 'SUCCESS', checkInTime: { gte: startDate, lte: endDate } }
      }),
      prisma.checkIn.findMany({
        where: { status: 'SUCCESS' }
      }),
      prisma.user.count({ where: { role: 'MEMBER' } }),
      prisma.user.count({
        where: {
          role: 'MEMBER',
          memberships: {
            some: {
              status: 'ACTIVE',
              endDate: { gte: now }
            }
          }
        }
      }),
      prisma.user.count({ where: { role: 'COACH' } }),
      prisma.package.count({ where: { isActive: true } }),
      prisma.ptProduct.count({ where: { isActive: true } }),
      prisma.payment.findMany({
        where: { status: 'PAID' },
        take: 20,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { fullName: true, phone: true } },
          membership: { include: { package: true } },
          ptProduct: true,
          ptRenewalProduct: true,
        }
      })
    ]);

    // Period Revenue & Growth
    const periodRevenue = periodPayments.reduce((sum, p) => sum + Number(p.amount), 0);
    const prevRevenue = prevPeriodPayments.reduce((sum, p) => sum + Number(p.amount), 0);
    let growth = '+0.0%';
    if (prevRevenue > 0) {
      const g = ((periodRevenue - prevRevenue) / prevRevenue) * 100;
      growth = `${g >= 0 ? '+' : ''}${g.toFixed(1)}%`;
    } else if (periodRevenue > 0) {
      growth = '+100%';
    }

    // Chart Data
    const chartData = buildChartPoints(range, periodPayments, periodCheckins, now);

    // Service Mix (use period payments if available, else all-time)
    const mixPayments = periodPayments.length > 0 ? periodPayments : allTimePaidPayments;
    let gymRev = 0;
    let ptRev = 0;
    let otherRev = 0;
    for (const p of mixPayments) {
      const amt = Number(p.amount);
      if (p.ptProductId || p.ptRenewalProductId || p.ptRenewalOptionId || p.membership?.package?.type === 'PT') {
        ptRev += amt;
      } else if (p.membershipId || p.membership?.package?.type === 'MEMBERSHIP') {
        gymRev += amt;
      } else {
        otherRev += amt;
      }
    }
    const mixTotal = gymRev + ptRev + otherRev;
    const serviceMix = [
      {
        name: 'Gói Hội Viên Gym Tiêu Chuẩn',
        amount: gymRev,
        percentage: mixTotal > 0 ? Math.round((gymRev / mixTotal) * 100) : 0
      },
      {
        name: 'Gói Tập PT 1:1 & Gia Hạn Buổi PT',
        amount: ptRev,
        percentage: mixTotal > 0 ? Math.round((ptRev / mixTotal) * 100) : 0
      },
      {
        name: 'Khóa Học & Dịch Vụ Khác',
        amount: otherRev,
        percentage: mixTotal > 0 ? Math.round((otherRev / mixTotal) * 100) : 0
      }
    ];

    // Peak hours (use all-time checkins if period checkins is low)
    const checkinsForPeak = allTimeCheckins.length > 0 ? allTimeCheckins : periodCheckins;
    const peakSlots = [
      { time: '06:00 - 08:00', startH: 6, endH: 8, count: 0 },
      { time: '08:00 - 11:00', startH: 8, endH: 11, count: 0 },
      { time: '11:30 - 13:30', startH: 11, endH: 14, count: 0 },
      { time: '14:00 - 17:00', startH: 14, endH: 17, count: 0 },
      { time: '17:30 - 20:30', startH: 17, endH: 21, count: 0 },
      { time: '20:30 - 22:00', startH: 20, endH: 23, count: 0 },
    ];
    for (const c of checkinsForPeak) {
      const h = new Date(c.checkInTime).getHours();
      for (const slot of peakSlots) {
        if (h >= slot.startH && h < slot.endH) {
          slot.count++;
          break;
        }
      }
    }
    const maxSlotCount = Math.max(...peakSlots.map(s => s.count), 0);
    const peakHours = peakSlots.map(s => {
      const density = maxSlotCount > 0 ? Math.round((s.count / maxSlotCount) * 100) : 0;
      return {
        time: s.time,
        count: s.count,
        density: `${density}%`,
        label: density >= 80 ? 'Rất Cao' : density >= 50 ? 'Cao' : density >= 20 ? 'Vừa' : 'Thấp',
        peak: maxSlotCount > 0 && s.count === maxSlotCount
      };
    });

    // KPI stats
    const renewalRate = totalMembers > 0
      ? `${Math.round((activeMembers / totalMembers) * 100)}%`
      : '0%';
    const avgMembersPerCoach = totalCoaches > 0
      ? (totalMembers / totalCoaches).toFixed(1)
      : '0';
    const ptRevenueShare = mixTotal > 0
      ? `${Math.round((ptRev / mixTotal) * 100)}%`
      : '0%';

    // Map recent payments safely converting BigInt
    const recentPayments = recentPaymentsRaw.map(p => {
      const itemName = p.ptProduct?.name ||
        p.ptRenewalProduct?.name ||
        p.membership?.package?.name ||
        (p.note || 'Thanh toán dịch vụ');
      const code = p.orderCode ? `INV-${p.orderCode.toString().slice(-6)}` : `INV-${1000 + p.id}`;
      return {
        id: `inv-${p.id}`,
        code,
        memberId: String(p.userId),
        memberName: p.user?.fullName || `Hội viên #${p.userId}`,
        memberPhone: p.user?.phone || '—',
        items: [{
          name: itemName,
          quantity: 1,
          unitPriceVND: Number(p.amount),
          amountVND: Number(p.amount)
        }],
        subtotalVND: Number(p.amount),
        discountVND: 0,
        totalVND: Number(p.amount),
        paymentMethod: (p.method || 'payos').toLowerCase(),
        status: p.status === 'PAID' ? 'paid' : p.status.toLowerCase(),
        staffName: 'Hệ thống PayOS',
        createdAt: p.paidAt ? p.paidAt.toISOString() : p.createdAt.toISOString()
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        timeFilter: range,
        label: periodLabel,
        subLabel,
        revenue: periodRevenue,
        growth,
        activeCheckIns: periodCheckins.length,
        totalMembers,
        activeMembers,
        renewalRate,
        totalCoaches,
        avgMembersPerCoach,
        catalogCount: packagesCount + ptProductsCount,
        ptRevenueShare,
        chartData,
        serviceMix,
        peakHours,
        recentPayments
      }
    });
  } catch (error: any) {
    console.error('Lỗi getAdminAnalytics:', error);
    return res.status(500).json({ success: false, message: 'Lỗi lấy thống kê analytics admin' });
  }
};

/**
 * API 4: Lấy danh sách giao dịch / hóa đơn thực tế của Admin
 * @route GET /api/admin/payments?limit=20
 */
export const getAdminPayments = async (req: AuthRequest, res: Response) => {
  try {
    const limit = Math.max(1, parseInt(req.query.limit as string) || 20);
    const payments = await prisma.payment.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { fullName: true, phone: true } },
        membership: { include: { package: true } },
        ptProduct: true,
        ptRenewalProduct: true,
      }
    });

    const mapped = payments.map(p => {
      const itemName = p.ptProduct?.name ||
        p.ptRenewalProduct?.name ||
        p.membership?.package?.name ||
        (p.note || 'Thanh toán dịch vụ');
      const code = p.orderCode ? `INV-${p.orderCode.toString().slice(-6)}` : `INV-${1000 + p.id}`;
      return {
        id: `inv-${p.id}`,
        code,
        memberId: String(p.userId),
        memberName: p.user?.fullName || `Hội viên #${p.userId}`,
        memberPhone: p.user?.phone || '—',
        items: [{
          name: itemName,
          quantity: 1,
          unitPriceVND: Number(p.amount),
          amountVND: Number(p.amount)
        }],
        subtotalVND: Number(p.amount),
        discountVND: 0,
        totalVND: Number(p.amount),
        paymentMethod: (p.method || 'payos').toLowerCase(),
        status: p.status === 'PAID' ? 'paid' : p.status.toLowerCase(),
        staffName: 'Hệ thống PayOS',
        createdAt: p.paidAt ? p.paidAt.toISOString() : p.createdAt.toISOString()
      };
    });

    return res.status(200).json({ success: true, data: mapped });
  } catch (error: any) {
    console.error('Lỗi getAdminPayments:', error);
    return res.status(500).json({ success: false, message: 'Lỗi lấy danh sách hóa đơn admin' });
  }
};
