import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { createUserNotification } from './notification.service.js';
import { grantPtCredit, releasePtCredit } from './ptWallet.service.js';
import { closePtChatRoom, emitCoachScheduleChanged } from '../sockets/ptChat.socket.js';
import { lockGymMember } from './gymMembershipLock.service.js';
import { reconcileGymMembershipStates } from './membership.service.js';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'default_secret';

export class StaffService {
  // =========================================================================
  // GIAI ĐOẠN 1: ĐĂNG NHẬP & TỰ ĐỘNG CHẤM CÔNG (Clock-in)
  // =========================================================================

  /**
   * Khởi tạo máy quầy mẫu nếu hệ thống chưa có thiết bị nào
   */
  static async seedDefaultDeskDeviceIfNone() {
    const count = await prisma.deskDevice.count();
    if (count === 0) {
      return prisma.deskDevice.create({
        data: {
          deviceToken: 'DESK-POS-DEFAULT-001',
          deviceName: 'Quầy Lễ Tân Số 1 (Front Desk 01)',
          location: 'Tầng 1 - Cổng chính',
          isActive: true
        }
      });
    }
    return null;
  }

  /**
   * Đăng ký hoặc duyệt thiết bị quầy lễ tân mới (Dành cho Admin/Manager)
   */
  static async registerDeskDevice(data: { deviceToken: string; deviceName: string; location?: string }) {
    const existing = await prisma.deskDevice.findUnique({
      where: { deviceToken: data.deviceToken }
    });
    if (existing) {
      return prisma.deskDevice.update({
        where: { deviceToken: data.deviceToken },
        data: {
          deviceName: data.deviceName,
          location: data.location,
          isActive: true
        }
      });
    }
    return prisma.deskDevice.create({
      data: {
        deviceToken: data.deviceToken,
        deviceName: data.deviceName,
        location: data.location,
        isActive: true
      }
    });
  }

  /**
   * Lấy danh sách máy quầy đã duyệt
   */
  static async getDeskDevices() {
    return prisma.deskDevice.findMany({
      orderBy: { createdAt: 'desc' }
    });
  }

  /**
   * Đăng nhập lễ tân kèm đối soát Device Token quầy và Tự động Clock-in
   */
  static async staffLogin(data: { email: string; password: string; deviceToken: string }) {
    await this.seedDefaultDeskDeviceIfNone();

    // 1. Xác thực Device Token máy quầy
    const deskDevice = await prisma.deskDevice.findUnique({
      where: { deviceToken: data.deviceToken }
    });

    if (!deskDevice || !deskDevice.isActive) {
      throw new Error(
        'Thiết bị chưa được cấp phép hoặc không thuộc quầy lễ tân được phê duyệt. Vui lòng liên hệ Quản lý cơ sở để cấp quyền cho máy này.'
      );
    }

    // 2. Tìm tài khoản lễ tân
    const user = await prisma.user.findUnique({
      where: { email: data.email }
    });

    if (!user) {
      throw new Error('Email hoặc mật khẩu không chính xác.');
    }

    if (user.role !== 'STAFF' && user.role !== 'ADMIN') {
      throw new Error('Tài khoản không có quyền truy cập vào phân hệ Lễ tân (Staff Portal).');
    }

    if (user.status === 'SUSPENDED' || user.status === 'INACTIVE') {
      throw new Error('Tài khoản lễ tân đã bị tạm khóa hoặc ngừng hoạt động.');
    }

    const isMatch = await bcrypt.compare(data.password, user.password);
    if (!isMatch) {
      throw new Error('Email hoặc mật khẩu không chính xác.');
    }

    // 3. Kích hoạt ca làm việc & Tự động Check-in (Clock-in)
    // Kiểm tra xem staff này đã có ca trực nào đang OPEN chưa
    let activeShift = await prisma.staffShift.findFirst({
      where: {
        staffId: user.id,
        status: 'OPEN'
      },
      include: { deskDevice: true }
    });

    if (!activeShift) {
      // Khởi tạo ca trực mới
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const shiftCode = `SHF-${dateStr}-${randomSuffix}`;

      activeShift = await prisma.staffShift.create({
        data: {
          shiftCode,
          staffId: user.id,
          deskDeviceId: deskDevice.id,
          deviceToken: deskDevice.deviceToken,
          clockIn: new Date(),
          status: 'OPEN',
          systemCashAmount: 0
        },
        include: { deskDevice: true }
      });

      // Lưu log kiểm toán
      await prisma.actionLog.create({
        data: {
          userId: user.id,
          action: 'STAFF_CLOCK_IN',
          details: `Lễ tân ${user.fullName} đã mở ca trực [${shiftCode}] tại ${deskDevice.deviceName} (${deskDevice.deviceToken}).`
        }
      });
    }

    // 4. Tạo JWT Token có chứa shiftId và shiftCode
    const accessToken = jwt.sign(
      {
        userId: user.id,
        role: user.role,
        shiftId: activeShift.id,
        shiftCode: activeShift.shiftCode
      },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    const { password, ...safeUser } = user;

    return {
      user: safeUser,
      device: {
        id: deskDevice.id,
        deviceName: deskDevice.deviceName,
        location: deskDevice.location
      },
      shift: {
        shiftId: activeShift.id,
        shiftCode: activeShift.shiftCode,
        clockIn: activeShift.clockIn,
        systemCashAmount: Number(activeShift.systemCashAmount),
        status: activeShift.status
      },
      accessToken
    };
  }

  // =========================================================================
  // GIAI ĐOẠN 2: SOÁT VÉ VÀO CỔNG (Venue Check-in)
  // =========================================================================

  /**
   * Quét mã QR tiêu chuẩn (Mục tiêu 2-3s: Anti-Passback -> Soát gói Gym -> Báo lịch PT -> Mời vào)
   */
  static async scanQrCheckIn(params: { qrToken: string; staffId: number; shiftId?: number }) {
    const { qrToken, staffId, shiftId } = params;

    // 1. Giải mã Dynamic QR token
    let memberId: number;
    try {
      const decoded: any = jwt.verify(qrToken, JWT_SECRET);
      memberId = decoded.checkInUserId || decoded.userId;
      if (!memberId) throw new Error('Token không chứa ID hội viên');
    } catch (err: any) {
      return {
        success: false,
        status: 'INVALID_QR',
        color: 'RED',
        message: 'Mã QR không hợp lệ hoặc đã hết hạn (Mã tự đổi mỗi 30-60 giây). Vui lòng yêu cầu khách mở lại trên App.',
        data: null
      };
    }

    // 2. Tra cứu hồ sơ hội viên
    const member = await prisma.user.findUnique({
      where: { id: memberId },
      select: {
        id: true,
        fullName: true,
        phone: true,
        avatar: true,
        gender: true,
        status: true
      }
    });

    if (!member) {
      return {
        success: false,
        status: 'NOT_FOUND',
        color: 'RED',
        message: 'Không tìm thấy thông tin hội viên trong cơ sở dữ liệu.',
        data: null
      };
    }

    if (member.status === 'SUSPENDED' || member.status === 'INACTIVE') {
      return {
        success: false,
        status: 'BLOCKED',
        color: 'RED',
        message: 'Tài khoản hội viên này đã bị tạm khóa do vi phạm quy chế hoặc yêu cầu từ quản lý.',
        data: { member }
      };
    }

    const now = new Date();

    // 3. Cơ chế chống quay vòng thẻ (Anti-Passback) - Ngăn quẹt 2 lần trong vòng 30 phút
    const antiPassbackWindowMinutes = 30;
    const antiPassbackThreshold = new Date(now.getTime() - antiPassbackWindowMinutes * 60 * 1000);

    const recentSuccessCheckIn = await prisma.checkIn.findFirst({
      where: {
        memberId: member.id,
        status: 'SUCCESS',
        checkInTime: { gte: antiPassbackThreshold }
      },
      orderBy: { checkInTime: 'desc' }
    });

    if (recentSuccessCheckIn) {
      // Kiểm tra xem hội viên có vừa được mở bảo lưu SAU thời điểm check-in gần nhất không
      const memberMemberships = await prisma.membership.findMany({
        where: { userId: member.id },
        select: { id: true }
      });
      const mIds = memberMemberships.map((m) => m.id);

      const recentUnfreezeLog = await prisma.actionLog.findFirst({
        where: {
          action: 'MEMBERSHIP_UNFREEZE_BY_STAFF',
          createdAt: { gt: recentSuccessCheckIn.checkInTime },
          OR: [
            { details: { contains: `"memberId":${member.id}` } },
            ...mIds.map((id) => ({ details: { contains: `"membershipId":${id}` } }))
          ]
        }
      });

      // Nếu không có sự kiện mở bảo lưu sau lần check-in thì mới áp dụng chặn Anti-Passback
      if (!recentUnfreezeLog) {
        const minutesAgo = Math.floor((now.getTime() - recentSuccessCheckIn.checkInTime.getTime()) / 60000);
        const waitRemaining = antiPassbackWindowMinutes - minutesAgo;

        // Ghi nhận lần vi phạm Anti-Passback
        await prisma.checkIn.create({
          data: {
            memberId: member.id,
            staffId,
            shiftId,
            method: 'QR_CODE',
            status: 'FAILED',
            rejectReason: `Cảnh báo Anti-Passback: Khách vừa check-in lúc ${recentSuccessCheckIn.checkInTime.toLocaleTimeString('vi-VN')} (cách đây ${minutesAgo} phút)`
          }
        });

        return {
          success: false,
          status: 'ANTI_PASSBACK',
          color: 'RED',
          message: `CẢNH BÁO ANTI-PASSBACK: Thẻ/Mã đã được check-in lúc ${recentSuccessCheckIn.checkInTime.toLocaleTimeString('vi-VN')} (cách đây ${minutesAgo} phút). Vui lòng đợi ${waitRemaining} phút nữa hoặc xác minh khuôn mặt.`,
          data: {
            member,
            recentCheckInTime: recentSuccessCheckIn.checkInTime,
            minutesAgo,
            waitRemaining
          }
        };
      }
    }

    // 4. Soát gói Gym Access còn hạn
    const activeMembership = await prisma.membership.findFirst({
      where: {
        userId: member.id,
        status: { in: ['ACTIVE', 'COMPLETED'] },
        startDate: { lte: now },
        endDate: { gte: now },
        package: { type: 'MEMBERSHIP' }
      },
      orderBy: { endDate: 'asc' },
      include: { package: true }
    });

    if (!activeMembership) {
      // 4.1 Kiểm tra xem có phải gói đang BẢO LƯU không
      const frozenMembership = await prisma.membership.findFirst({
        where: {
          userId: member.id,
          status: 'FROZEN',
          package: { type: 'MEMBERSHIP' }
        },
        orderBy: { endDate: 'desc' },
        include: { package: true }
      });

      if (frozenMembership) {
        await prisma.checkIn.create({
          data: {
            memberId: member.id,
            staffId,
            shiftId,
            method: 'QR_CODE',
            status: 'FAILED',
            rejectReason: `Gói tập ${frozenMembership.package.name} đang trong trạng thái BẢO LƯU`
          }
        });

        // Bắn thông báo Push riêng biệt cho trường hợp FROZEN
        createUserNotification({
          userId: member.id,
          title: 'Điểm danh từ chối - Gói đang bảo lưu',
          message: `Lượt quét mã QR lúc ${now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} bị từ chối do gói [${frozenMembership.package.name}] đang trong thời gian BẢO LƯU (đến ngày ${frozenMembership.endDate.toLocaleDateString('vi-VN')}). Vui lòng liên hệ quầy lễ tân để mở lại gói trước khi vào phòng tập!`,
        }).catch((e) => console.error('Lỗi gửi push cho user:', e));

        const remainingFrozenDays = Math.max(0, Math.ceil((frozenMembership.endDate.getTime() - now.getTime()) / 86400000));
        return {
          success: false,
          status: 'FROZEN',
          color: 'YELLOW',
          message: `Gói [${frozenMembership.package.name}] đang trong thời gian BẢO LƯU đến ngày ${frozenMembership.endDate.toLocaleDateString('vi-VN')}. Từ chối vào cổng!`,
          data: {
            member,
            membership: {
              packageName: frozenMembership.package.name,
              endDate: frozenMembership.endDate,
              remainingDays: remainingFrozenDays,
              status: 'FROZEN'
            },
            frozenMembership: {
              id: frozenMembership.id,
              packageName: frozenMembership.package.name,
              endDate: frozenMembership.endDate,
              remainingDays: remainingFrozenDays
            },
            suggestion: 'Hội viên cần mở lại gói bảo lưu tại quầy lễ tân nếu muốn tập luyện.'
          }
        };
      }

      // Tìm gói gần nhất xem đã hết hạn bao lâu
      const expiredMembership = await prisma.membership.findFirst({
        where: {
          userId: member.id,
          package: { type: 'MEMBERSHIP' }
        },
        orderBy: { endDate: 'desc' },
        include: { package: true }
      });

      await prisma.checkIn.create({
        data: {
          memberId: member.id,
          staffId,
          shiftId,
          method: 'QR_CODE',
          status: 'FAILED',
          rejectReason: expiredMembership
            ? `Gói tập ${expiredMembership.package.name} đã hết hạn vào ${expiredMembership.endDate.toLocaleDateString('vi-VN')}`
            : 'Chưa có gói hội viên hợp lệ'
        }
      });

      return {
        success: false,
        status: 'EXPIRED',
        color: 'RED',
        message: expiredMembership
          ? `Gói [${expiredMembership.package.name}] đã hết hạn vào ngày ${expiredMembership.endDate.toLocaleDateString('vi-VN')}. Từ chối vào cổng!`
          : 'Hội viên chưa có gói tập Gym hợp lệ. Từ chối vào cổng!',
        data: {
          member,
          expiredMembership: expiredMembership
            ? {
                packageName: expiredMembership.package.name,
                endDate: expiredMembership.endDate
              }
            : null,
          suggestion: 'Hướng dẫn khách tự gia hạn trên App hoặc hỗ trợ gia hạn tại quầy.'
        }
      };
    }

    // Khôi phục trạng thái ACTIVE nếu trước đó gói ở trạng thái COMPLETED
    if (activeMembership.status === 'COMPLETED') {
      await prisma.membership.update({
        where: { id: activeMembership.id },
        data: { status: 'ACTIVE' }
      });
    }

    // 5. Kiểm tra lịch PT hôm nay & Tự động bắn Notification cho Coach
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    const ptBookingToday = await prisma.booking.findFirst({
      where: {
        memberId: member.id,
        type: 'PT',
        status: { in: ['UPCOMING', 'CONFIRMED'] },
        startTime: { gte: startOfDay, lte: endOfDay }
      },
      include: {
        coach: { select: { id: true, fullName: true, phone: true } }
      },
      orderBy: { startTime: 'asc' }
    });

    let ptNote = null;
    if (ptBookingToday && ptBookingToday.coach) {
      const timeStr = ptBookingToday.startTime.toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit'
      });
      ptNote = {
        hasPtToday: true,
        coachName: ptBookingToday.coach.fullName,
        coachId: ptBookingToday.coach.id,
        sessionTime: timeStr,
        displayAlert: `Có lịch PT với Coach ${ptBookingToday.coach.fullName} lúc ${timeStr}`
      };

      // Tự động bắn thông báo Push Notification đến App của Coach
      createUserNotification({
        userId: ptBookingToday.coach.id,
        title: 'Học viên đã vào phòng tập',
        message: `Học viên ${member.fullName} đã check-in vào phòng tập lúc ${now.toLocaleTimeString('vi-VN')}. Chuẩn bị cho buổi tập lúc ${timeStr} nhé Coach!`
      }).catch((e) => console.error('Lỗi gửi push cho Coach:', e));
    }

    // 6. Ghi nhận lượt Check-in thành công
    const checkInRecord = await prisma.checkIn.create({
      data: {
        memberId: member.id,
        membershipId: activeMembership.id,
        staffId,
        shiftId,
        method: 'QR_CODE',
        status: 'SUCCESS'
      }
    });

    const remainingDays = Math.max(
      0,
      Math.ceil((activeMembership.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    );

    // Tự động bắn thông báo Push Notification xác nhận check-in thành công cho Hội viên
    createUserNotification({
      userId: member.id,
      title: 'Điểm danh vào cổng thành công',
      message: `Chào mừng ${member.fullName}! Bạn đã check-in thành công lúc ${now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}. Gói [${activeMembership.package.name}] còn lại ${remainingDays} ngày tập. Chúc bạn có buổi tập tràn đầy năng lượng!`,
    }).catch((e) => console.error('Lỗi gửi push cho member:', e));

    return {
      success: true,
      status: 'SUCCESS',
      color: 'GREEN',
      message: `Chào mừng ${member.fullName} đến với phòng tập!`,
      data: {
        checkInId: checkInRecord.id,
        member,
        membership: {
          id: activeMembership.id,
          packageName: activeMembership.package.name,
          endDate: activeMembership.endDate,
          remainingDays
        },
        ptSessionToday: ptNote
      }
    };
  }

  /**
   * Tra cứu hội viên theo số điện thoại (Check-in thủ công dự phòng khi khách hết pin)
   */
  static async lookupMemberByPhone(phone: string) {
    const selectFields = {
      id: true,
      fullName: true,
      phone: true,
      email: true,
      avatar: true,
      gender: true,
      dateOfBirth: true,
      status: true,
      memberships: {
        orderBy: { endDate: 'desc' as const },
        take: 3,
        include: { package: true }
      }
    };

    let member = await prisma.user.findFirst({
      where: { phone: phone.trim(), role: 'MEMBER' },
      select: selectFields
    });

    if (!member) {
      member = await prisma.user.findFirst({
        where: { phone: phone.trim() },
        select: selectFields
      });
    }

    if (!member) {
      throw new Error(`Không tìm thấy hội viên nào có số điện thoại [${phone}].`);
    }

    const now = new Date();
    const activeMembership = member.memberships.find(
      (m) =>
        m.package.type === 'MEMBERSHIP' &&
        ['ACTIVE', 'COMPLETED'].includes(m.status) &&
        m.startDate <= now &&
        m.endDate >= now
    );

    const frozenMembership = member.memberships.find(
      (m) =>
        m.package.type === 'MEMBERSHIP' &&
        m.status === 'FROZEN'
    );

    // Kiểm tra lượt check-in thành công trong vòng 30 phút gần nhất (Anti-Passback)
    const antiPassbackWindowMinutes = 30;
    const antiPassbackThreshold = new Date(now.getTime() - antiPassbackWindowMinutes * 60 * 1000);
    const recentSuccessCheckIn = await prisma.checkIn.findFirst({
      where: {
        memberId: member.id,
        status: 'SUCCESS',
        checkInTime: { gte: antiPassbackThreshold }
      },
      orderBy: { checkInTime: 'desc' }
    });

    let recentCheckIn = null;
    if (recentSuccessCheckIn) {
      // Bỏ qua cảnh báo nếu hội viên vừa được mở bảo lưu SAU lần check-in gần nhất
      const memberMemberships = await prisma.membership.findMany({
        where: { userId: member.id },
        select: { id: true }
      });
      const mIds = memberMemberships.map((m) => m.id);

      const recentUnfreezeLog = await prisma.actionLog.findFirst({
        where: {
          action: 'MEMBERSHIP_UNFREEZE_BY_STAFF',
          createdAt: { gt: recentSuccessCheckIn.checkInTime },
          OR: [
            { details: { contains: `"memberId":${member.id}` } },
            ...mIds.map((id) => ({ details: { contains: `"membershipId":${id}` } }))
          ]
        }
      });

      if (!recentUnfreezeLog) {
        const minutesAgo = Math.floor((now.getTime() - recentSuccessCheckIn.checkInTime.getTime()) / 60000);
        recentCheckIn = {
          checkInTime: recentSuccessCheckIn.checkInTime.toISOString(),
          timeDisplay: recentSuccessCheckIn.checkInTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          minutesAgo,
          waitRemaining: Math.max(1, antiPassbackWindowMinutes - minutesAgo)
        };
      }
    }

    return {
      member: {
        id: member.id,
        fullName: member.fullName,
        phone: member.phone,
        email: member.email,
        avatar: member.avatar,
        gender: member.gender,
        dateOfBirth: member.dateOfBirth,
        status: member.status
      },
      hasActiveGymAccess: !!activeMembership,
      isFrozen: !!frozenMembership,
      recentCheckIn,
      frozenMembership: frozenMembership
        ? {
            id: frozenMembership.id,
            packageName: frozenMembership.package.name,
            endDate: frozenMembership.endDate,
            remainingDays: Math.max(
              0,
              Math.ceil((frozenMembership.endDate.getTime() - now.getTime()) / 86400000)
            ),
            status: frozenMembership.status
          }
        : null,
      activeMembership: activeMembership
        ? {
            id: activeMembership.id,
            packageName: activeMembership.package.name,
            endDate: activeMembership.endDate,
            remainingDays: Math.max(
              0,
              Math.ceil((activeMembership.endDate.getTime() - now.getTime()) / 86400000)
            ),
            status: activeMembership.status
          }
        : null
    };
  }

  /**
   * Xác nhận Check-in thủ công tại quầy (Sau khi đã đối chiếu mặt qua ảnh chân dung)
   */
  static async manualCheckIn(params: {
    memberId: number;
    staffId: number;
    shiftId?: number;
    notes?: string;
    overrideAntiPassback?: boolean;
  }) {
    const { memberId, staffId, shiftId, notes, overrideAntiPassback } = params;

    const member = await prisma.user.findUnique({
      where: { id: memberId },
      select: { id: true, fullName: true, phone: true, avatar: true, status: true }
    });

    if (!member) {
      throw new Error('Hội viên không tồn tại.');
    }

    const now = new Date();

    // Check Anti-Passback 30 phút
    const antiPassbackThreshold = new Date(now.getTime() - 30 * 60 * 1000);
    const recent = await prisma.checkIn.findFirst({
      where: {
        memberId: member.id,
        status: 'SUCCESS',
        checkInTime: { gte: antiPassbackThreshold }
      },
      orderBy: { checkInTime: 'desc' }
    });

    let antiPassbackOverrideNote: string | null = null;
    if (recent) {
      // Bỏ qua cảnh báo nếu hội viên vừa được mở bảo lưu SAU lần check-in gần nhất
      const memberMemberships = await prisma.membership.findMany({
        where: { userId: member.id },
        select: { id: true }
      });
      const mIds = memberMemberships.map((m) => m.id);

      const recentUnfreezeLog = await prisma.actionLog.findFirst({
        where: {
          action: 'MEMBERSHIP_UNFREEZE_BY_STAFF',
          createdAt: { gt: recent.checkInTime },
          OR: [
            { details: { contains: `"memberId":${member.id}` } },
            ...mIds.map((id) => ({ details: { contains: `"membershipId":${id}` } }))
          ]
        }
      });

      if (!recentUnfreezeLog) {
        const minutesAgo = Math.floor((now.getTime() - recent.checkInTime.getTime()) / 60000);
        const waitRemaining = Math.max(1, 30 - minutesAgo);

        // Nếu không có xác nhận ghi đè từ lễ tân -> Chặn Anti-Passback và yêu cầu xác nhận
        if (!overrideAntiPassback) {
          throw new Error(
            `Cảnh báo Anti-Passback: Hội viên đã check-in lúc ${recent.checkInTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} (cách đây ${minutesAgo} phút). Vui lòng đợi ${waitRemaining} phút nữa hoặc tích chọn 'Ghi đè Anti-Passback' sau khi đối chiếu ảnh chân dung!`
          );
        }

        antiPassbackOverrideNote = `[Ghi đè Anti-Passback: Khách vừa check-in ${minutesAgo} phút trước lúc ${recent.checkInTime.toLocaleTimeString('vi-VN')}, lễ tân xác thực ảnh chân dung]`;
      }
    }

    // Kiểm tra gói
    const activeMembership = await prisma.membership.findFirst({
      where: {
        userId: member.id,
        status: { in: ['ACTIVE', 'COMPLETED'] },
        startDate: { lte: now },
        endDate: { gte: now },
        package: { type: 'MEMBERSHIP' }
      },
      include: { package: true }
    });

    if (!activeMembership) {
      const frozenMembership = await prisma.membership.findFirst({
        where: {
          userId: member.id,
          status: 'FROZEN',
          package: { type: 'MEMBERSHIP' }
        },
        include: { package: true }
      });

      if (frozenMembership) {
        await prisma.checkIn.create({
          data: {
            memberId: member.id,
            staffId,
            shiftId,
            method: 'MANUAL',
            status: 'FAILED',
            rejectReason: `Gói [${frozenMembership.package.name}] đang trong thời gian BẢO LƯU.`
          }
        });

        // Bắn thông báo Push riêng biệt cho trường hợp FROZEN khi check-in thủ công
        createUserNotification({
          userId: member.id,
          title: 'Điểm danh từ chối - Gói đang bảo lưu',
          message: `Lượt check-in tại quầy lúc ${now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} bị từ chối do gói [${frozenMembership.package.name}] đang BẢO LƯU (đến ngày ${frozenMembership.endDate.toLocaleDateString('vi-VN')}). Lễ tân cần thao tác Mở lại gói bảo lưu trước khi check-in!`,
        }).catch((e) => console.error('Lỗi gửi push cho user:', e));

        throw new Error(`Gói tập [${frozenMembership.package.name}] đang BẢO LƯU đến ngày ${frozenMembership.endDate.toLocaleDateString('vi-VN')}. Vui lòng kích hoạt/mở lại gói bảo lưu trước khi check-in.`);
      }

      await prisma.checkIn.create({
        data: {
          memberId: member.id,
          staffId,
          shiftId,
          method: 'MANUAL',
          status: 'FAILED',
          rejectReason: 'Check-in thủ công thất bại: Không có gói hội viên còn hiệu lực.'
        }
      });
      throw new Error('Hội viên không có gói tập đang hoạt động hoặc gói đã hết hạn.');
    }

    // Nhận diện lịch PT hôm nay
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    const ptBookingToday = await prisma.booking.findFirst({
      where: {
        memberId: member.id,
        type: 'PT',
        status: { in: ['UPCOMING', 'CONFIRMED'] },
        startTime: { gte: startOfDay, lte: endOfDay }
      },
      include: {
        coach: { select: { id: true, fullName: true } }
      }
    });

    let ptNote = null;
    if (ptBookingToday && ptBookingToday.coach) {
      const timeStr = ptBookingToday.startTime.toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit'
      });
      ptNote = `Có lịch PT với Coach ${ptBookingToday.coach.fullName} lúc ${timeStr}`;

      createUserNotification({
        userId: ptBookingToday.coach.id,
        title: 'Học viên đã vào phòng tập',
        message: `Học viên ${member.fullName} đã check-in thủ công lúc ${now.toLocaleTimeString('vi-VN')}. Chuẩn bị cho buổi tập lúc ${timeStr} nhé Coach!`
      }).catch((e) => console.error('Lỗi gửi push cho Coach:', e));
    }

    const checkInRecord = await prisma.checkIn.create({
      data: {
        memberId: member.id,
        membershipId: activeMembership.id,
        staffId,
        shiftId,
        method: 'MANUAL',
        status: 'SUCCESS',
        rejectReason: [notes ? `Ghi chú: ${notes}` : null, antiPassbackOverrideNote].filter(Boolean).join(' | ') || null
      }
    });

    const manualRemainingDays = Math.max(
      0,
      Math.ceil((activeMembership.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    );

    // Bắn thông báo xác nhận Check-in thủ công cho Hội viên
    createUserNotification({
      userId: member.id,
      title: 'Điểm danh vào cổng thành công',
      message: `Quầy lễ tân đã xác nhận check-in thủ công cho bạn lúc ${now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}. Gói [${activeMembership.package.name}] còn lại ${manualRemainingDays} ngày tập. Chúc bạn tập luyện vui vẻ!`,
    }).catch((e) => console.error('Lỗi gửi push cho member:', e));

    return {
      success: true,
      status: 'SUCCESS',
      color: 'GREEN',
      message: `Xác nhận vào thành công cho hội viên ${member.fullName}!${antiPassbackOverrideNote ? ' (Đã xác minh đối chiếu ảnh chân dung)' : ''}`,
      data: {
        checkInId: checkInRecord.id,
        member,
        packageName: activeMembership.package.name,
        ptNote
      }
    };
  }

  // =========================================================================
  // GIAI ĐOẠN 3: HỖ TRỢ THANH TOÁN TẠI QUẦY (Offline POS Fallback)
  // =========================================================================

  static async createMemberAccount(params: { fullName: string; phone: string; email?: string; staffId: number }) {
    const fullName = params.fullName.trim();
    const raw = params.phone.trim();
    const digits = raw.replace(/\D/g, '');
    const phone = digits.startsWith('84') && digits.length === 11 ? `0${digits.slice(2)}` : digits;
    const email = params.email?.trim().toLowerCase() || `walkin_${phone.replace(/\D/g, '')}@gymfitness.local`;
    if (fullName.length < 2) {
      throw new Error('Vui lòng nhập họ tên và số điện thoại hợp lệ.');
    }
    const [phoneOwner, emailOwner] = await Promise.all([
      prisma.user.findFirst({ where: { phone: { in: [phone, params.phone.trim()] } }, select: { id: true } }),
      prisma.user.findUnique({ where: { email }, select: { id: true } })
    ]);
    if (phoneOwner || emailOwner) {
      throw new Error('Số điện thoại hoặc email đã có tài khoản. Không tạo trùng hoặc đặt lại mật khẩu.');
    }

    const password = await bcrypt.hash('123456', 10);
    const member = await prisma.$transaction(async tx => {
      const created = await tx.user.create({ data: {
        fullName, phone, email, password,
        mustChangePassword: true, role: 'MEMBER', status: 'ACTIVE'
      } });
      await tx.actionLog.create({ data: {
        userId: params.staffId,
        action: 'STAFF_CREATE_MEMBER_ACCOUNT',
        details: `Lễ tân ID ${params.staffId} tạo tài khoản hội viên ${created.fullName} (${created.phone}).`
      } });
      return created;
    });

    return {
      success: true,
      message: 'Tạo tài khoản hội viên thành công.',
      data: {
        member: { id: member.id, fullName: member.fullName, phone: member.phone, email: member.email },
        account: { created: true, loginEmail: member.email, temporaryPassword: '123456', mustChangePassword: true }
      }
    };
  }

  /**
   * Tạo và kích hoạt nhanh cho khách Walk-in chưa tải App
   */
  static async processWalkInCustomer(params: {
    fullName: string;
    phone: string;
    email?: string;
    packageId: number;
    consultantStaffId?: number;
    paymentMethod: 'CASH' | 'POS';
    amountPaid?: number;
    traceRefNo?: string;
    staffId: number;
    shiftId: number;
  }) {
    const {
      fullName,
      phone,
      email,
      packageId,
      consultantStaffId,
      paymentMethod,
      amountPaid,
      traceRefNo,
      staffId,
      shiftId
    } = params;

    // 1. Kiểm tra gói tập
    const pkg = await prisma.package.findUnique({
      where: { id: packageId }
    });

    if (!pkg || !pkg.isActive) {
      throw new Error('Gói tập không tồn tại hoặc đã ngừng cung cấp.');
    }
    if (pkg.type === 'PT') throw new Error('Gói PT cũ đã ngừng bán. Hội viên mua PT Credit qua PayOS.');

    const packagePrice = Number(pkg.price);

    // 2. Validate thanh toán
    if (paymentMethod === 'POS' && (!traceRefNo || traceRefNo.trim() === '')) {
      throw new Error('Thanh toán qua POS quẹt thẻ ngân hàng bắt buộc phải nhập Mã chuẩn chi (Trace / Ref No.).');
    }

    let cashReceived = null;
    let cashChange = 0;
    if (paymentMethod === 'CASH') {
      cashReceived = amountPaid ? Number(amountPaid) : packagePrice;
      if (cashReceived < packagePrice) {
        throw new Error(
          `Số tiền khách đưa (${cashReceived.toLocaleString('vi-VN')} đ) nhỏ hơn giá gói (${packagePrice.toLocaleString('vi-VN')} đ).`
        );
      }
      cashChange = cashReceived - packagePrice;
    }

    // 3. Tìm hoặc tạo tài khoản Member
    const normalizedPhone = phone.trim();
    let member = await prisma.user.findFirst({
      where: { phone: normalizedPhone }
    });

    if (!member) {
      const generatedEmail = email?.trim() || `walkin_${normalizedPhone}@gymfitness.local`;
      const defaultPassword = await bcrypt.hash('Gym@123456', 10);

      member = await prisma.user.create({
        data: {
          fullName: fullName.trim(),
          phone: normalizedPhone,
          email: generatedEmail,
          password: defaultPassword,
          role: 'MEMBER',
          status: 'ACTIVE'
        }
      });
    }

    // 4. Ghi nhận giao dịch Payment & Kích hoạt/Xếp hàng Membership
    const generatedOrderCode = BigInt(Date.now() + Math.floor(Math.random() * 1000));
    const transactionNo = paymentMethod === 'POS'
      ? traceRefNo!.trim()
      : `CASH-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

    const { membership, payment, isQueued } = await prisma.$transaction(async tx => {
      // 4a. Khóa an toàn đồng thời cho user
      await lockGymMember(tx, member!.id);

      // 4b. Đồng bộ trạng thái các gói tập gym hiện tại
      const now = new Date();
      await reconcileGymMembershipStates(tx, member!.id, now);

      // 4c. Tính toán xếp hàng PENDING_ACTIVATION nếu khách đã có gói active hoặc bảo lưu
      const isGym = pkg.type === 'MEMBERSHIP';
      let startDate = now;
      let status = 'ACTIVE';
      let activationOrder: number | null = null;
      let activatedAt: Date | null = now;
      let isQueued = false;

      if (isGym) {
        const lastOrder = await tx.membership.aggregate({
          where: { userId: member!.id, isGymMembership: true },
          _max: { activationOrder: true },
        });
        activationOrder = (lastOrder._max.activationOrder ?? 0) + 1;

        const existingGymMemberships = await tx.membership.findMany({
          where: {
            userId: member!.id,
            package: { type: 'MEMBERSHIP' },
            status: { in: ['ACTIVE', 'PENDING_ACTIVATION', 'FROZEN'] },
            endDate: { gte: now },
          },
          select: { endDate: true },
        });

        const latestEnd = existingGymMemberships.reduce((latest, item) => (item.endDate > latest ? item.endDate : latest), now);
        if (latestEnd > now) {
          startDate = new Date(latestEnd.getTime() + 1);
          status = 'PENDING_ACTIVATION';
          activatedAt = null;
          isQueued = true;
        }
      }

      const endDate = new Date(startDate.getTime() + pkg.durationDays * 86400000);

      // 4d. Tạo bản ghi Membership
      const membership = await tx.membership.create({
        data: {
          userId: member!.id,
          packageId: pkg.id,
          startDate,
          endDate,
          remainingSessions: null,
          status,
          isGymMembership: isGym,
          activationOrder,
          activatedAt,
          coachId: consultantStaffId || null,
        }
      });

      // 4e. Tạo bản ghi Payment
      const payment = await tx.payment.create({
        data: {
          userId: member!.id,
          membershipId: membership.id,
          amount: pkg.price,
          method: paymentMethod === 'CASH' ? 'CASH' : 'POS_CARD',
          status: 'COMPLETED',
          orderCode: generatedOrderCode,
          transactionNo,
          staffId,
          shiftId,
          consultantId: consultantStaffId || null,
          traceRefNo: paymentMethod === 'POS' ? traceRefNo!.trim() : null,
          cashReceived: cashReceived ? cashReceived : null,
          cashChange: cashChange > 0 ? cashChange : null,
          note: `Đăng ký gói Walk-in tại quầy [${pkg.name}]`,
        }
      });

      // 4f. Tặng Trial PT sessions nếu gói có quyền lợi
      if (pkg.trialPtSessions > 0) {
        await grantPtCredit(tx, {
          memberId: member!.id,
          level: 'TRIAL',
          source: 'MEMBERSHIP_GIFT',
          count: pkg.trialPtSessions,
          membershipId: membership.id,
          startAt: startDate,
          endAt: endDate,
          activatedAt: status === 'ACTIVE' ? now : null
        });
      }

      // 4g. Ghi nhận tiền mặt vào quỹ ca
      if (paymentMethod === 'CASH') {
        await tx.staffShift.update({
          where: { id: shiftId },
          data: { systemCashAmount: { increment: pkg.price } }
        });
      }

      // 4h. Ghi action log
      await tx.actionLog.create({
        data: {
          userId: staffId,
          action: 'WALK_IN_REGISTRATION',
          details: `Lễ tân ID ${staffId} đăng ký gói [${pkg.name}] cho khách Walk-in ${member!.fullName} (${member!.phone}). Trạng thái: ${status}${isQueued ? ' (Xếp hàng chờ kích hoạt)' : ''}. Hình thức: ${paymentMethod}. Số tiền: ${packagePrice.toLocaleString('vi-VN')} đ.`,
        }
      });

      return { membership, payment, isQueued };
    });

    // 5. Sinh link SMS hướng dẫn tải App
    const smsLink = `https://gymfitness.app/download?phone=${encodeURIComponent(normalizedPhone)}&welcome=1`;

    const successMessage = isQueued
      ? `Đăng ký gói Walk-in [${pkg.name}] thành công! Do khách đã có gói tập đang hoạt động, gói mới được xếp hàng chờ kích hoạt từ ngày ${new Date(membership.startDate).toLocaleDateString('vi-VN')}.`
      : `Kích hoạt gói Walk-in [${pkg.name}] thành công!`;

    return {
      success: true,
      message: successMessage,
      data: {
        member: {
          id: member.id,
          fullName: member.fullName,
          phone: member.phone,
          email: member.email
        },
        membership: {
          id: membership.id,
          packageName: pkg.name,
          startDate: membership.startDate,
          endDate: membership.endDate,
          status: membership.status,
          isQueued
        },
        payment: {
          id: payment.id,
          amount: Number(payment.amount),
          method: payment.method,
          transactionNo: payment.transactionNo,
          cashReceived,
          cashChange
        },
        smsInvitation: {
          messageText: `Chuc mung ${member.fullName} da tro thanh hoi vien cua Gym Fitness! Tai app tai day de check-in vao phong: ${smsLink}. Mat khau tam thoi: Gym@123456`,
          smsLink
        }
      }
    };
  }

  /**
   * Tra cứu hóa đơn chờ thanh toán của Member theo SĐT
   */
  static async getPendingPaymentsByPhone(phone: string) {
    const member = await prisma.user.findFirst({
      where: { phone: phone.trim() },
      select: { id: true, fullName: true, phone: true, email: true }
    });

    if (!member) {
      throw new Error(`Không tìm thấy khách hàng có số điện thoại [${phone}].`);
    }

    const pendingPayments = await prisma.payment.findMany({
      where: {
        userId: member.id,
        status: 'PENDING'
      },
      include: {
        membership: {
          include: { package: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return {
      member,
      pendingPayments: pendingPayments.map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        method: p.method,
        createdAt: p.createdAt,
        membership: p.membership
          ? {
              id: p.membership.id,
              packageName: p.membership.package.name,
              durationDays: p.membership.package.durationDays,
              type: p.membership.package.type
            }
          : null
      }))
    };
  }

  /**
   * Xử lý thanh toán tại quầy bằng Tiền mặt hoặc Cà thẻ POS (Offline POS Fallback)
   */
  static async processOfflinePayment(params: {
    paymentId: number;
    paymentMethod: 'CASH' | 'POS';
    cashReceived?: number;
    traceRefNo?: string;
    staffId: number;
    shiftId: number;
  }) {
    const { paymentId, paymentMethod, cashReceived, traceRefNo, staffId, shiftId } = params;

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        membership: {
          include: { package: true }
        },
        user: true
      }
    });

    if (!payment) {
      throw new Error('Không tìm thấy hóa đơn thanh toán.');
    }

    if (payment.status === 'COMPLETED') {
      throw new Error('Hóa đơn này đã được thanh toán trước đó.');
    }
    if (payment.membership?.package.type === 'PT') {
      throw new Error('Gói PT cũ đã ngừng bán. Không thể kích hoạt bằng thanh toán tại quầy.');
    }

    const amount = Number(payment.amount);

    if (paymentMethod === 'POS' && (!traceRefNo || traceRefNo.trim() === '')) {
      throw new Error('Thanh toán cà thẻ POS bắt buộc phải nhập Mã chuẩn chi (Trace/Ref No.) của máy cà thẻ.');
    }

    let change = 0;
    let actualCashReceived = null;
    if (paymentMethod === 'CASH') {
      actualCashReceived = cashReceived ? Number(cashReceived) : amount;
      if (actualCashReceived < amount) {
        throw new Error(
          `Tiền mặt nhận (${actualCashReceived.toLocaleString('vi-VN')} đ) không đủ để thanh toán hóa đơn (${amount.toLocaleString('vi-VN')} đ).`
        );
      }
      change = actualCashReceived - amount;
    }

    const now = new Date();

    // Cập nhật Payment và kích hoạt / xếp hàng Membership
    const { updatedPayment, isQueued, membershipStartDate } = await prisma.$transaction(async (tx) => {
      // 1. Khóa an toàn đồng thời cho user
      await lockGymMember(tx, payment.userId);

      // 2. Đồng bộ trạng thái các gói tập gym hiện tại
      const now = new Date();
      await reconcileGymMembershipStates(tx, payment.userId, now);

      let isQueued = false;
      let membershipStartDate = now;

      // 3. Kích hoạt hoặc Xếp hàng Membership PENDING_ACTIVATION
      if (payment.membershipId && payment.membership) {
        const pkg = payment.membership.package;
        const isGym = pkg?.type === 'MEMBERSHIP';
        const durationDays = pkg?.durationDays || 30;

        let startDate = now;
        let status = 'ACTIVE';
        let activationOrder: number | null = null;
        let activatedAt: Date | null = now;

        if (isGym) {
          const lastOrder = await tx.membership.aggregate({
            where: { userId: payment.userId, isGymMembership: true },
            _max: { activationOrder: true },
          });
          activationOrder = (lastOrder._max.activationOrder ?? 0) + 1;

          const existingGymMemberships = await tx.membership.findMany({
            where: {
              userId: payment.userId,
              id: { not: payment.membershipId },
              package: { type: 'MEMBERSHIP' },
              status: { in: ['ACTIVE', 'PENDING_ACTIVATION', 'FROZEN'] },
              endDate: { gte: now },
            },
            select: { endDate: true },
          });

          const latestEnd = existingGymMemberships.reduce((latest, item) => (item.endDate > latest ? item.endDate : latest), now);
          if (latestEnd > now) {
            startDate = new Date(latestEnd.getTime() + 1);
            status = 'PENDING_ACTIVATION';
            activatedAt = null;
            isQueued = true;
          }
        }

        const endDate = new Date(startDate.getTime() + durationDays * 86400000);
        membershipStartDate = startDate;

        await tx.membership.update({
          where: { id: payment.membershipId },
          data: {
            status,
            startDate,
            endDate,
            isGymMembership: isGym,
            activationOrder,
            activatedAt,
          }
        });

        if (pkg && pkg.trialPtSessions > 0) {
          await grantPtCredit(tx, {
            memberId: payment.userId,
            level: 'TRIAL',
            source: 'MEMBERSHIP_GIFT',
            count: pkg.trialPtSessions,
            membershipId: payment.membershipId,
            startAt: startDate,
            endAt: endDate,
            activatedAt: status === 'ACTIVE' ? now : null
          });
        }
      }

      // 4. Cập nhật Payment
      const p = await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: 'COMPLETED',
          method: paymentMethod === 'CASH' ? 'CASH' : 'POS_CARD',
          staffId,
          shiftId,
          traceRefNo: paymentMethod === 'POS' ? traceRefNo!.trim() : null,
          cashReceived: actualCashReceived,
          cashChange: change > 0 ? change : null,
          transactionNo:
            paymentMethod === 'POS'
              ? traceRefNo!.trim()
              : `CASH-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`
        }
      });

      // 5. Nếu là Tiền mặt: ghi nhận vào quỹ ca trực
      if (paymentMethod === 'CASH') {
        await tx.staffShift.update({
          where: { id: shiftId },
          data: {
            systemCashAmount: { increment: payment.amount }
          }
        });
      }

      // 6. Ghi action log
      await tx.actionLog.create({
        data: {
          userId: staffId,
          action: 'OFFLINE_PAYMENT_PROCESSED',
          details: `Lễ tân ID ${staffId} thu tiền hóa đơn ID ${payment.id} cho khách ${payment.user.fullName} (${payment.user.phone}). Hình thức: ${paymentMethod}. Số tiền: ${amount.toLocaleString('vi-VN')} đ.${isQueued ? ' Gói xếp hàng PENDING_ACTIVATION.' : ''}`
        }
      });

      return { updatedPayment: p, isQueued, membershipStartDate };
    });

    // Bắn thông báo cho Member
    const pkgName = payment.membership?.package?.name || 'Tập gym';
    const notifyMessage = isQueued
      ? `Hóa đơn ${amount.toLocaleString('vi-VN')} đ cho gói [${pkgName}] đã được thanh toán tại quầy! Do bạn đang có gói tập hoạt động, gói mới đã được xếp hàng chờ kích hoạt từ ngày ${membershipStartDate.toLocaleDateString('vi-VN')}.`
      : `Hóa đơn ${amount.toLocaleString('vi-VN')} đ cho gói [${pkgName}] đã được thanh toán thành công tại quầy lễ tân!`;

    createUserNotification({
      userId: payment.userId,
      title: 'Thanh toán tại quầy thành công',
      message: notifyMessage
    }).catch((e) => console.error('Lỗi gửi push cho user:', e));

    return {
      success: true,
      message: isQueued
        ? `Thanh toán thành công! Khách đã có gói hoạt động, gói mới [${pkgName}] được xếp hàng chờ kích hoạt từ ngày ${membershipStartDate.toLocaleDateString('vi-VN')}.`
        : 'Thanh toán thành công và gói tập đã được kích hoạt trên App!',
      data: {
        paymentId: updatedPayment.id,
        amount,
        method: updatedPayment.method,
        cashReceived: actualCashReceived,
        cashChange: change,
        traceRefNo: updatedPayment.traceRefNo,
        transactionNo: updatedPayment.transactionNo,
        isQueued
      }
    };
  }

  /**
   * Bảo lưu gói tại quầy (Hỗ trợ hội viên không rành công nghệ)
   */
  static async freezeMembershipAtDesk(params: {
    membershipId: number;
    freezeDays: number;
    reason: string;
    staffId: number;
    shiftId?: number;
  }) {
    const { membershipId, freezeDays, reason, staffId, shiftId } = params;

    if (freezeDays <= 0 || freezeDays > 365) {
      throw new Error('Số ngày bảo lưu không hợp lệ (từ 1 đến 365 ngày).');
    }

    const membership = await prisma.membership.findUnique({
      where: { id: membershipId },
      include: {
        package: true,
        user: true
      }
    });

    if (!membership) {
      throw new Error('Không tìm thấy gói hội viên.');
    }

    if (membership.status === 'FROZEN') {
      throw new Error('Gói tập này hiện đang ở trạng thái BẢO LƯU (FROZEN), không thể bảo lưu lại!');
    }

    if (membership.status !== 'ACTIVE') {
      throw new Error('Chỉ có thể bảo lưu gói tập đang ở trạng thái ACTIVE.');
    }

    const currentEndDate = new Date(membership.endDate);
    const newEndDate = new Date(currentEndDate.getTime() + freezeDays * 86400000);
    const now = new Date();
    const freezeUntil = new Date(now.getTime() + freezeDays * 86400000);

    // Dùng Transaction để đảm bảo tính toàn vẹn: Cập nhật FROZEN + Tự động hoàn hủy các buổi PT & lớp nhóm trong kỳ bảo lưu
    const { updated, cancelledPtBookings, cancelledClassBookings } = await prisma.$transaction(async (tx) => {
      // 1. Cập nhật trạng thái Membership sang FROZEN và lùi ngày kết thúc
      const updated = await tx.membership.update({
        where: { id: membership.id },
        data: {
          status: 'FROZEN',
          endDate: newEndDate,
        },
      });

      // 2. Quét các buổi PT sắp tới của hội viên rơi vào thời gian bảo lưu (từ now đến freezeUntil)
      const upcomingPtBookings = await tx.booking.findMany({
        where: {
          memberId: membership.userId,
          type: 'PT',
          status: { in: ['CONFIRMED', 'UPCOMING', 'PENDING'] },
          startTime: { gte: now, lte: freezeUntil },
        },
        include: {
          ptCreditAllocation: true,
        },
      });

      // Hủy từng buổi PT và giải phóng Credit giữ chỗ (hoàn lại cho ví hội viên)
      for (const pt of upcomingPtBookings) {
        await tx.booking.update({
          where: { id: pt.id },
          data: {
            status: 'CANCELLED',
            cancelledBy: 'SYSTEM_FREEZE',
            absenceReason: `Hệ thống tự động hủy do hội viên bảo lưu gói tập [${membership.package.name}] (${freezeDays} ngày)`,
            sessionQrToken: null,
          },
        });

        // Nếu buổi PT này giữ chỗ Credit từ ví (Wallet), giải phóng credit về lại ví
        if (pt.ptCreditAllocation?.status === 'HELD') {
          await releasePtCredit(tx, pt.id, {
            kind: 'PROTECTED_CANCEL',
            actorId: staffId,
            note: `Hội viên bảo lưu gói tập [${membership.package.name}] ${freezeDays} ngày`,
          });
        }
      }

      // 3. Quét các buổi Lớp học nhóm (Group Class) sắp tới của hội viên rơi vào thời gian bảo lưu
      const upcomingClassBookings = await tx.groupClassBooking.findMany({
        where: {
          userId: membership.userId,
          status: 'BOOKED',
          schedule: {
            startTime: { gte: now, lte: freezeUntil },
          },
        },
        include: {
          schedule: {
            include: { groupClass: true },
          },
        },
      });

      // Hủy từng lượt đăng ký lớp nhóm và hoàn trả slot cho lịch học
      for (const cb of upcomingClassBookings) {
        await tx.groupClassBooking.update({
          where: { id: cb.id },
          data: { status: 'CANCELLED' },
        });

        await tx.groupClassSchedule.update({
          where: { id: cb.scheduleId },
          data: {
            bookedCount: { decrement: 1 },
            status: 'OPEN',
          },
        });
      }

      // 4. Lùi ngày startDate và endDate của các gói PENDING_ACTIVATION đang xếp hàng phía sau
      const queuedMemberships = await tx.membership.findMany({
        where: {
          userId: membership.userId,
          id: { not: membership.id },
          package: { type: 'MEMBERSHIP' },
          status: 'PENDING_ACTIVATION',
        },
        select: { id: true, startDate: true, endDate: true },
      });
      for (const q of queuedMemberships) {
        await tx.membership.update({
          where: { id: q.id },
          data: {
            startDate: new Date(q.startDate.getTime() + freezeDays * 86400000),
            endDate: new Date(q.endDate.getTime() + freezeDays * 86400000),
          },
        });
      }

      // 5. Cập nhật lùi hạn endAt của các lô PT Credit gắn liền với gói bảo lưu
      const ptBatches = await tx.ptCreditBatch.findMany({
        where: {
          membershipId: membership.id,
          endAt: { not: null },
        },
        select: { id: true, endAt: true },
      });
      for (const batch of ptBatches) {
        if (batch.endAt) {
          await tx.ptCreditBatch.update({
            where: { id: batch.id },
            data: {
              endAt: new Date(batch.endAt.getTime() + freezeDays * 86400000),
            },
          });
        }
      }

      // 6. Ghi log kiểm toán dạng JSON có cấu trúc để phục vụ tự động unfreeze và truy vết
      const freezePayload = {
        type: 'FREEZE',
        membershipId: membership.id,
        userId: membership.userId,
        freezeDays,
        frozenAt: now.toISOString(),
        originalEndDate: currentEndDate.toISOString(),
        projectedEndDate: newEndDate.toISOString(),
        cancelledPtBookingsCount: upcomingPtBookings.length,
        cancelledPtBookingIds: upcomingPtBookings.map((b) => b.id),
        cancelledClassBookingsCount: upcomingClassBookings.length,
        cancelledClassBookingIds: upcomingClassBookings.map((b) => b.id),
        reason,
      };

      await tx.actionLog.create({
        data: {
          userId: staffId,
          action: 'MEMBERSHIP_FREEZE_BY_STAFF',
          details: JSON.stringify(freezePayload),
        },
      });

      return {
        updated,
        cancelledPtBookings: upcomingPtBookings,
        cancelledClassBookings: upcomingClassBookings,
      };
    });

    // 5. Bên ngoài transaction: Bắn socket cập nhật lịch cho HLV và gửi push notification
    for (const pt of cancelledPtBookings) {
      if (pt.coachId) {
        closePtChatRoom(pt.id);
        emitCoachScheduleChanged(pt.coachId);
        createUserNotification({
          userId: pt.coachId,
          title: 'Lịch PT đã hủy (Hội viên bảo lưu)',
          message: `Buổi PT lúc ${pt.startTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ngày ${pt.startTime.toLocaleDateString('vi-VN')} với hội viên ${membership.user.fullName} đã tự động hủy do hội viên bảo lưu gói tập.`,
        }).catch((e) => console.error('Lỗi gửi push cho Coach:', e));
      }
    }

    // Tạo thông báo chi tiết cho Member
    let cancellationNotice = '';
    if (cancelledPtBookings.length > 0 || cancelledClassBookings.length > 0) {
      const parts: string[] = [];
      if (cancelledPtBookings.length > 0) parts.push(`hoàn lại ${cancelledPtBookings.length} ca PT`);
      if (cancelledClassBookings.length > 0) parts.push(`hủy ${cancelledClassBookings.length} lớp học nhóm`);
      cancellationNotice = ` Hệ thống đã tự động ${parts.join(' và ')} trong thời gian bảo lưu để tránh trừ lượt vắng.`;
    }

    createUserNotification({
      userId: membership.userId,
      title: 'Gói tập đã được bảo lưu thành công',
      message: `Quầy lễ tân đã hỗ trợ bảo lưu ${freezeDays} ngày cho gói [${membership.package.name}] của bạn. Trạng thái hiện tại: Đang bảo lưu (FROZEN). Hạn sử dụng dự kiến đến ngày ${newEndDate.toLocaleDateString('vi-VN')}.${cancellationNotice}`,
    }).catch((e) => console.error('Lỗi gửi push cho user:', e));

    return {
      success: true,
      message: `Đã chuyển trạng thái sang BẢO LƯU thành công cho hội viên ${membership.user.fullName} (${freezeDays} ngày)!${
        cancelledPtBookings.length > 0 || cancelledClassBookings.length > 0
          ? ` (Đã tự động hoàn trả ${cancelledPtBookings.length} ca PT & ${cancelledClassBookings.length} lớp nhóm trong kỳ bảo lưu)`
          : ''
      }`,
      data: {
        membershipId: updated.id,
        packageName: membership.package.name,
        previousEndDate: currentEndDate,
        newEndDate: updated.endDate,
        freezeDays,
        status: 'FROZEN',
        cancelledPtCount: cancelledPtBookings.length,
        cancelledClassCount: cancelledClassBookings.length,
        reason,
      },
    };
  }

  /**
   * Kích hoạt lại / Mở bảo lưu gói tập tại quầy
   * Tính toán lại ngày kết thúc chính xác theo số ngày thực tế đã dừng (thu hồi ngày dư thừa nếu mở sớm)
   */
  static async unfreezeMembershipAtDesk(params: {
    membershipId: number;
    staffId: number;
    shiftId?: number;
    notes?: string;
  }) {
    const { membershipId, staffId, shiftId, notes } = params;

    const membership = await prisma.membership.findUnique({
      where: { id: membershipId },
      include: {
        package: true,
        user: true
      }
    });

    if (!membership) {
      throw new Error('Không tìm thấy gói hội viên.');
    }

    if (membership.status !== 'FROZEN') {
      throw new Error('Chỉ có thể kích hoạt lại gói đang ở trạng thái BẢO LƯU (FROZEN).');
    }

    // Tra cứu log bảo lưu gần nhất để tính toán số ngày thực tế hội viên đã dừng
    const lastFreezeLog = await prisma.actionLog.findFirst({
      where: {
        action: 'MEMBERSHIP_FREEZE_BY_STAFF',
        details: { contains: `"membershipId":${membership.id}` }
      },
      orderBy: { createdAt: 'desc' }
    });

    let adjustedEndDate = new Date(membership.endDate);
    let actualFrozenDays = 0;
    let unusedDays = 0;

    if (lastFreezeLog?.details) {
      try {
        const parsed = JSON.parse(lastFreezeLog.details);
        if (parsed.frozenAt && parsed.freezeDays) {
          const frozenAt = new Date(parsed.frozenAt);
          const now = new Date();
          const totalFreezeDays = Number(parsed.freezeDays);

          // Tính số ngày lịch thực tế đã trôi qua theo múi giờ Việt Nam (UTC+7)
          const vnStart = new Date(frozenAt.getTime() + 7 * 3600000).toISOString().slice(0, 10);
          const vnNow = new Date(now.getTime() + 7 * 3600000).toISOString().slice(0, 10);
          const calendarDays = Math.max(0, Math.round((Date.parse(vnNow) - Date.parse(vnStart)) / 86400000));

          // Số ngày thực tế tính từ 0 (nếu mở trong cùng ngày thì tính 0 ngày, không cộng dôi ngày vào hạn)
          actualFrozenDays = Math.min(totalFreezeDays, calendarDays);
          unusedDays = Math.max(0, totalFreezeDays - actualFrozenDays);

          if (parsed.originalEndDate) {
            const orig = new Date(parsed.originalEndDate);
            adjustedEndDate = new Date(orig.getTime() + actualFrozenDays * 86400000);
          } else {
            // Fallback nếu không có originalEndDate trong log cũ
            adjustedEndDate = new Date(membership.endDate.getTime() - unusedDays * 86400000);
          }
        }
      } catch (err) {
        console.error('Lỗi phân tích log bảo lưu:', err);
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updated = await tx.membership.update({
        where: { id: membership.id },
        data: {
          status: 'ACTIVE',
          endDate: adjustedEndDate
        }
      });

      // Nếu mở bảo lưu sớm hơn dự kiến (unusedDays > 0), tịnh tiến sớm lại cho các gói PENDING_ACTIVATION
      if (unusedDays > 0) {
        const queuedMemberships = await tx.membership.findMany({
          where: {
            userId: membership.userId,
            id: { not: membership.id },
            package: { type: 'MEMBERSHIP' },
            status: 'PENDING_ACTIVATION',
          },
          select: { id: true, startDate: true, endDate: true },
        });
        for (const q of queuedMemberships) {
          await tx.membership.update({
            where: { id: q.id },
            data: {
              startDate: new Date(q.startDate.getTime() - unusedDays * 86400000),
              endDate: new Date(q.endDate.getTime() - unusedDays * 86400000),
            },
          });
        }

        // Tịnh tiến lại endAt cho các lô PT Credit của gói này
        const ptBatches = await tx.ptCreditBatch.findMany({
          where: {
            membershipId: membership.id,
            endAt: { not: null },
          },
          select: { id: true, endAt: true },
        });
        for (const batch of ptBatches) {
          if (batch.endAt) {
            await tx.ptCreditBatch.update({
              where: { id: batch.id },
              data: {
                endAt: new Date(batch.endAt.getTime() - unusedDays * 86400000),
              },
            });
          }
        }
      }

      await tx.actionLog.create({
        data: {
          userId: staffId,
          action: 'MEMBERSHIP_UNFREEZE_BY_STAFF',
          details: JSON.stringify({
            type: 'UNFREEZE',
            membershipId: membership.id,
            memberId: membership.userId,
            actualFrozenDays,
            unusedDaysRecovered: unusedDays,
            adjustedEndDate: adjustedEndDate.toISOString(),
            notes: notes || null
          })
        }
      });

      return updated;
    });

    createUserNotification({
      userId: membership.userId,
      title: 'Gói tập đã được kích hoạt lại',
      message: `Quầy lễ tân đã mở lại gói tập [${membership.package.name}] của bạn${
        actualFrozenDays > 0 ? ` (Thực tế đã bảo lưu ${actualFrozenDays} ngày)` : ' (Mở lại trong ngày, hạn dùng giữ nguyên)'
      }. Hạn dùng mới: ${adjustedEndDate.toLocaleDateString('vi-VN')}.`
    }).catch((e) => console.error('Lỗi gửi push cho user:', e));

    return {
      success: true,
      message: actualFrozenDays === 0
        ? `Đã mở lại gói bảo lưu cho hội viên ${membership.user.fullName}! (Mở lại trong ngày: Bảo lưu thực tế 0 ngày, thu hồi ${unusedDays} ngày dư, hạn dùng giữ nguyên: ${adjustedEndDate.toLocaleDateString('vi-VN')})`
        : unusedDays > 0
        ? `Đã mở lại gói bảo lưu cho hội viên ${membership.user.fullName}! (Mở sớm: Bảo lưu thực tế ${actualFrozenDays} ngày, thu hồi ${unusedDays} ngày dư, hạn mới: ${adjustedEndDate.toLocaleDateString('vi-VN')})`
        : `Đã mở lại gói bảo lưu và kích hoạt lại trạng thái hoạt động cho hội viên ${membership.user.fullName}! Hạn dùng: ${adjustedEndDate.toLocaleDateString('vi-VN')}`,
      data: {
        membershipId: updated.id,
        packageName: membership.package.name,
        status: 'ACTIVE',
        actualFrozenDays,
        unusedDaysRecovered: unusedDays,
        endDate: updated.endDate
      }
    };
  }

  // =========================================================================
  // GIAI ĐOẠN 4: VẬN HÀNH THIẾT BỊ & TIẾP NHẬN YÊU CẦU
  // =========================================================================

  /**
   * Lấy danh sách máy tập trong phòng để cập nhật trạng thái
   */
  static async getEquipmentsList(roomId?: number) {
    return prisma.equipment.findMany({
      where: roomId ? { roomId } : undefined,
      include: {
        room: { select: { id: true, name: true, type: true } }
      },
      orderBy: { id: 'asc' }
    });
  }

  /**
   * Cập nhật trạng thái máy tập (Báo hỏng / Chuyển sang Under Maintenance)
   */
  static async updateEquipmentMaintenance(params: {
    equipmentId: number;
    status: 'AVAILABLE' | 'UNDER_MAINTENANCE' | 'MAINTENANCE';
    note?: string;
    staffId: number;
  }) {
    const { equipmentId, status, note, staffId } = params;

    const equipment = await prisma.equipment.findUnique({
      where: { id: equipmentId },
      include: { room: true }
    });

    if (!equipment) {
      throw new Error('Không tìm thấy thiết bị phòng tập.');
    }

    const updated = await prisma.equipment.update({
      where: { id: equipmentId },
      data: {
        status,
        note: note ? note.trim() : equipment.note
      },
      include: { room: true }
    });

    // Nếu chuyển sang bảo trì: Tự động gửi Notification cảnh báo cho Center Manager / Admin
    if (status === 'UNDER_MAINTENANCE' || status === 'MAINTENANCE') {
      const managers = await prisma.user.findMany({
        where: { role: 'ADMIN' },
        select: { id: true }
      });

      for (const mgr of managers) {
        createUserNotification({
          userId: mgr.id,
          title: 'Cảnh báo thiết bị cần bảo trì',
          message: `Lễ tân đã báo hỏng thiết bị [${equipment.name}] (Mã: ${equipment.code}) tại phòng [${equipment.room.name}]. Ghi chú: ${note || 'Cần kiểm tra kỹ thuật'}.`
        }).catch((e) => console.error('Lỗi gửi push cho admin:', e));
      }
    }

    // Ghi log kiểm toán
    await prisma.actionLog.create({
      data: {
        userId: staffId,
        action: 'EQUIPMENT_STATUS_UPDATE',
        details: `Lễ tân ID ${staffId} đã chuyển trạng thái thiết bị [${equipment.name}] sang ${status}. Ghi chú: ${note || 'None'}`
      }
    });

    return {
      success: true,
      message: `Cập nhật trạng thái thiết bị [${updated.name}] thành công!`,
      data: updated
    };
  }

  /**
   * Tiếp nhận khiếu nại / Ghi chú vận hành từ khách chuyển Manager xem xét
   */
  static async createOperationalNote(params: {
    staffId: number;
    shiftId?: number;
    memberId?: number;
    memberName?: string;
    memberPhone?: string;
    category: string; // HYGIENE, EQUIPMENT, SERVICE, FACILITY, OTHER
    content: string;
    priority?: string; // LOW, MEDIUM, HIGH, URGENT
  }) {
    const { staffId, shiftId, memberId, memberName, memberPhone, category, content, priority } = params;

    if (!content || content.trim() === '') {
      throw new Error('Nội dung phản ánh không được để trống.');
    }

    const staff = await prisma.user.findUnique({
      where: { id: staffId },
      select: { fullName: true }
    });

    const opNote = await prisma.operationalNote.create({
      data: {
        staffId,
        shiftId,
        memberId: memberId || null,
        memberName: memberName?.trim() || null,
        memberPhone: memberPhone?.trim() || null,
        category: category || 'OTHER',
        content: content.trim(),
        priority: priority || 'MEDIUM',
        status: 'PENDING_REVIEW'
      }
    });

    // Bắn thông báo đến Center Manager / Admin
    const managers = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { id: true }
    });

    for (const mgr of managers) {
      createUserNotification({
        userId: mgr.id,
        title: `[Quầy Lễ Tân] Phản ánh vận hành mới (${opNote.category})`,
        message: `Lễ tân ${staff?.fullName || 'Lễ tân'} ghi nhận phản ánh từ khách [${opNote.memberName || 'Khách trực tiếp'}]: "${opNote.content}". Mức độ: ${opNote.priority}.`
      }).catch((e) => console.error('Lỗi gửi push cho admin:', e));
    }

    return {
      success: true,
      message: 'Ghi nhận phản ánh vận hành thành công và đã chuyển tới Center Manager!',
      data: opNote
    };
  }

  /**
   * Xem danh sách các ghi chú vận hành
   */
  static async getOperationalNotes(params: { status?: string; page?: number; limit?: number }) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const skip = (page - 1) * limit;

    const where = params.status ? { status: params.status } : {};

    const [items, total] = await Promise.all([
      prisma.operationalNote.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          staff: { select: { id: true, fullName: true } }
        }
      }),
      prisma.operationalNote.count({ where })
    ]);

    return {
      items,
      pagination: {
        total,
        page,
        totalPages: Math.ceil(total / limit),
        limit
      }
    };
  }

  // =========================================================================
  // GIAI ĐOẠN 5: CHỐT CA & TỰ ĐỘNG CHẤM CÔNG RA (Clock-out)
  // =========================================================================

  /**
   * Lấy tóm tắt ca trực hiện tại của Lễ tân để chuẩn bị đóng ca
   */
  static async getCurrentShiftSummary(staffId: number) {
    let shift = await prisma.staffShift.findFirst({
      where: {
        staffId,
        status: 'OPEN'
      },
      include: {
        deskDevice: true,
        payments: {
          include: {
            user: { select: { fullName: true, phone: true } }
          },
          orderBy: { createdAt: 'desc' }
        },
        checkIns: {
          include: {
            member: { select: { fullName: true, phone: true } },
            membership: { include: { package: { select: { name: true } } } }
          },
          orderBy: { checkInTime: 'desc' },
          take: 30
        },
        _count: {
          select: {
            checkIns: true,
            payments: true,
            operationalNotes: true
          }
        }
      }
    });

    if (!shift) {
      // Tự động kích hoạt ca làm việc mặc định cho nhân viên/lễ tân nếu chưa có ca mở (đăng nhập thông thường)
      await this.seedDefaultDeskDeviceIfNone();
      let defaultDevice = await prisma.deskDevice.findFirst({
        where: { isActive: true },
        orderBy: { id: 'asc' }
      });
      if (!defaultDevice) {
        defaultDevice = await prisma.deskDevice.create({
          data: {
            deviceToken: 'DESK-POS-DEFAULT-001',
            deviceName: 'Quầy Lễ Tân Số 1 (Front Desk 01)',
            location: 'Tầng 1 - Cổng chính',
            isActive: true
          }
        });
      }

      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const shiftCode = `SHF-${dateStr}-${randomSuffix}`;

      shift = await prisma.staffShift.create({
        data: {
          shiftCode,
          staffId,
          deskDeviceId: defaultDevice.id,
          deviceToken: defaultDevice.deviceToken,
          clockIn: new Date(),
          status: 'OPEN',
          systemCashAmount: 0
        },
        include: {
          deskDevice: true,
          payments: {
            include: {
              user: { select: { fullName: true, phone: true } }
            },
            orderBy: { createdAt: 'desc' }
          },
          checkIns: {
            include: {
              member: { select: { fullName: true, phone: true } },
              membership: { include: { package: { select: { name: true } } } }
            },
            orderBy: { checkInTime: 'desc' },
            take: 30
          },
          _count: {
            select: {
              checkIns: true,
              payments: true,
              operationalNotes: true
            }
          }
        }
      });
    }

    // Tính tổng tiền mặt và tiền thẻ POS trong ca
    let totalCash = 0;
    let totalPos = 0;

    for (const p of shift.payments) {
      if (p.status === 'COMPLETED') {
        const val = Number(p.amount);
        if (p.method === 'CASH') totalCash += val;
        else if (p.method === 'POS_CARD') totalPos += val;
      }
    }

    return {
      shiftId: shift.id,
      shiftCode: shift.shiftCode,
      clockIn: shift.clockIn,
      deviceName: shift.deskDevice?.deviceName || 'Quầy Lễ Tân',
      systemCashAmount: totalCash,
      totalPosAmount: totalPos,
      totalRevenue: totalCash + totalPos,
      stats: {
        totalCheckIns: shift._count.checkIns,
        totalPayments: shift._count.payments,
        totalOperationalNotes: shift._count.operationalNotes
      },
      payments: shift.payments.map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        method: p.method,
        status: p.status,
        customerName: p.user.fullName,
        customerPhone: p.user.phone,
        createdAt: p.createdAt
      })),
      checkIns: shift.checkIns.map((c) => ({
        id: c.id,
        name: c.member?.fullName || 'Hội viên',
        packageName: c.membership?.package?.name || (c.method === 'QR_CODE' ? 'Gói Tập (QR)' : 'Thủ công'),
        time: c.checkInTime.toLocaleTimeString('vi-VN'),
        status: c.status,
        color: c.status === 'SUCCESS' ? 'GREEN' : 'RED',
        method: c.method
      }))
    };
  }

  /**
   * Chốt ca làm việc, Đối soát doanh thu tiền mặt và Tự động Clock-out
   */
  static async closeShiftAndClockOut(params: {
    staffId: number;
    actualCashAmount: number;
    differenceReason?: string;
  }) {
    const { staffId, actualCashAmount, differenceReason } = params;

    const shift = await prisma.staffShift.findFirst({
      where: {
        staffId,
        status: 'OPEN'
      },
      include: {
        staff: { select: { fullName: true } }
      }
    });

    if (!shift) {
      throw new Error('Không tìm thấy ca trực đang mở để đóng ca.');
    }

    const systemCash = Number(shift.systemCashAmount);
    const actualCash = Number(actualCashAmount);
    const difference = actualCash - systemCash;

    // Nếu X != Y: Bắt buộc phải nhập lý do chênh lệch
    if (difference !== 0) {
      if (!differenceReason || differenceReason.trim() === '') {
        throw new Error(
          `Phát hiện chênh lệch doanh thu tiền mặt! Tiền hệ thống ghi nhận: ${systemCash.toLocaleString('vi-VN')} đ, Tiền thực tế kiểm đếm: ${actualCash.toLocaleString('vi-VN')} đ (Chênh lệch: ${difference.toLocaleString('vi-VN')} đ). Bắt buộc phải nhập lý do chênh lệch trước khi chốt ca!`
        );
      }
    }

    const now = new Date();

    const closedShift = await prisma.staffShift.update({
      where: { id: shift.id },
      data: {
        actualCashAmount: actualCash,
        differenceAmount: difference,
        differenceReason: differenceReason ? differenceReason.trim() : null,
        clockOut: now,
        status: 'CLOSED'
      }
    });

    // Ghi log kiểm toán chấm công ra
    await prisma.actionLog.create({
      data: {
        userId: staffId,
        action: 'STAFF_CLOCK_OUT',
        details: `Lễ tân ${shift.staff.fullName} đã đóng ca [${shift.shiftCode}] lúc ${now.toLocaleTimeString('vi-VN')}. Hệ thống: ${systemCash.toLocaleString('vi-VN')} đ, Thực tế: ${actualCash.toLocaleString('vi-VN')} đ, Chênh lệch: ${difference.toLocaleString('vi-VN')} đ.${differenceReason ? ' Lý do: ' + differenceReason : ''}`
      }
    });

    return {
      success: true,
      message: 'Chốt ca làm việc và chấm công ra (Clock-out) thành công!',
      data: {
        shiftCode: closedShift.shiftCode,
        clockIn: closedShift.clockIn,
        clockOut: closedShift.clockOut,
        systemCashAmount: systemCash,
        actualCashAmount: actualCash,
        differenceAmount: difference,
        differenceReason: closedShift.differenceReason,
        autoLogout: true
      }
    };
  }
}
