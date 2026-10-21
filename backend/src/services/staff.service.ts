import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { createUserNotification } from './notification.service.js';
import { grantPtCredit } from './ptWallet.service.js';

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

        return {
          success: false,
          status: 'FROZEN',
          color: 'YELLOW',
          message: `Gói [${frozenMembership.package.name}] đang trong thời gian BẢO LƯU đến ngày ${frozenMembership.endDate.toLocaleDateString('vi-VN')}. Từ chối vào cổng!`,
          data: {
            member,
            frozenMembership: {
              packageName: frozenMembership.package.name,
              endDate: frozenMembership.endDate
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
  }) {
    const { memberId, staffId, shiftId, notes } = params;

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

    if (recent) {
      const minutesAgo = Math.floor((now.getTime() - recent.checkInTime.getTime()) / 60000);
      throw new Error(
        `Cảnh báo Anti-Passback: Hội viên đã check-in cách đây ${minutesAgo} phút (lúc ${recent.checkInTime.toLocaleTimeString('vi-VN')}).`
      );
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
        rejectReason: notes ? `Ghi chú: ${notes}` : null
      }
    });

    return {
      success: true,
      status: 'SUCCESS',
      color: 'GREEN',
      message: `Xác nhận vào thành công cho hội viên ${member.fullName}!`,
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

    // 4. Kích hoạt Membership ngay lập tức
    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + pkg.durationDays * 86400000);

    // 5. Ghi nhận giao dịch Payment
    const generatedOrderCode = BigInt(Date.now() + Math.floor(Math.random() * 1000));
    const transactionNo = paymentMethod === 'POS'
      ? traceRefNo!.trim()
      : `CASH-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

    const { membership, payment } = await prisma.$transaction(async tx => {
      const membership = await tx.membership.create({ data: {
        userId: member!.id, packageId: pkg.id, startDate, endDate,
        remainingSessions: null, status: 'ACTIVE', coachId: consultantStaffId || null,
      } });
      const payment = await tx.payment.create({ data: {
        userId: member!.id, membershipId: membership.id, amount: pkg.price,
        method: paymentMethod === 'CASH' ? 'CASH' : 'POS_CARD', status: 'COMPLETED',
        orderCode: generatedOrderCode, transactionNo, staffId, shiftId,
        consultantId: consultantStaffId || null,
        traceRefNo: paymentMethod === 'POS' ? traceRefNo!.trim() : null,
        cashReceived: cashReceived ? cashReceived : null,
        cashChange: cashChange > 0 ? cashChange : null,
        note: `Đăng ký gói Walk-in tại quầy [${pkg.name}]`,
      } });
      if (pkg.trialPtSessions > 0) await grantPtCredit(tx, { memberId: member!.id,
        level: 'TRIAL', source: 'MEMBERSHIP_GIFT', count: pkg.trialPtSessions,
        membershipId: membership.id });
      if (paymentMethod === 'CASH') await tx.staffShift.update({ where: { id: shiftId },
        data: { systemCashAmount: { increment: pkg.price } } });
      await tx.actionLog.create({ data: {
        userId: staffId, action: 'WALK_IN_REGISTRATION',
        details: `Lễ tân ID ${staffId} đăng ký gói [${pkg.name}] cho khách Walk-in ${member!.fullName} (${member!.phone}). Hình thức: ${paymentMethod}. Số tiền: ${packagePrice.toLocaleString('vi-VN')} đ.`,
      } });
      return { membership, payment };
    });

    // 8. Sinh link SMS hướng dẫn tải App
    const smsLink = `https://gymfitness.app/download?phone=${encodeURIComponent(normalizedPhone)}&welcome=1`;

    return {
      success: true,
      message: 'Kích hoạt gói Walk-in thành công!',
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
          startDate,
          endDate,
          status: membership.status
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

    // Cập nhật Payment và kích hoạt Membership
    const updatedPayment = await prisma.$transaction(async (tx) => {
      // 1. Cập nhật Payment
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

      // 2. Kích hoạt Membership
      if (payment.membershipId && payment.membership) {
        const durationDays = payment.membership.package?.durationDays || 30;
        const startDate = now;
        const endDate = new Date(now.getTime() + durationDays * 86400000);

        await tx.membership.update({
          where: { id: payment.membershipId },
          data: {
            status: 'ACTIVE',
            startDate,
            endDate
          }
        });
        if (payment.membership.package.trialPtSessions > 0) {
          await grantPtCredit(tx, { memberId: payment.userId, level: 'TRIAL',
            source: 'MEMBERSHIP_GIFT', count: payment.membership.package.trialPtSessions,
            membershipId: payment.membershipId });
        }
      }

      // 3. Nếu là Tiền mặt: ghi nhận vào quỹ ca trực
      if (paymentMethod === 'CASH') {
        await tx.staffShift.update({
          where: { id: shiftId },
          data: {
            systemCashAmount: { increment: payment.amount }
          }
        });
      }

      return p;
    });

    // Bắn thông báo cho Member
    createUserNotification({
      userId: payment.userId,
      title: 'Thanh toán tại quầy thành công',
      message: `Hóa đơn ${amount.toLocaleString('vi-VN')} đ cho gói [${payment.membership?.package?.name || 'Tập gym'}] đã được thanh toán thành công tại quầy lễ tân!`
    }).catch((e) => console.error('Lỗi gửi push cho user:', e));

    return {
      success: true,
      message: 'Thanh toán thành công và gói tập đã được kích hoạt trên App!',
      data: {
        paymentId: updatedPayment.id,
        amount,
        method: updatedPayment.method,
        cashReceived: actualCashReceived,
        cashChange: change,
        traceRefNo: updatedPayment.traceRefNo,
        transactionNo: updatedPayment.transactionNo
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

    const updated = await prisma.membership.update({
      where: { id: membership.id },
      data: {
        status: 'FROZEN',
        endDate: newEndDate
      }
    });

    // Ghi log kiểm toán
    await prisma.actionLog.create({
      data: {
        userId: staffId,
        action: 'MEMBERSHIP_FREEZE_BY_STAFF',
        details: `Lễ tân ID ${staffId} đã hỗ trợ bảo lưu gói [${membership.package.name}] cho hội viên ${membership.user.fullName} thêm ${freezeDays} ngày. Trạng thái chuyển sang BẢO LƯU (FROZEN). Hạn mới: ${newEndDate.toLocaleDateString('vi-VN')}. Lý do: ${reason}`
      }
    });

    // Bắn thông báo cho Member
    createUserNotification({
      userId: membership.userId,
      title: 'Gói tập đã được bảo lưu thành công',
      message: `Quầy lễ tân đã hỗ trợ bảo lưu thêm ${freezeDays} ngày cho gói [${membership.package.name}] của bạn. Trạng thái hiện tại: Đang bảo lưu (FROZEN). Hạn sử dụng mới đến ngày ${newEndDate.toLocaleDateString('vi-VN')}.`
    }).catch((e) => console.error('Lỗi gửi push cho user:', e));

    return {
      success: true,
      message: `Đã chuyển trạng thái sang BẢO LƯU thành công và cộng thêm ${freezeDays} ngày cho hội viên ${membership.user.fullName}!`,
      data: {
        membershipId: updated.id,
        packageName: membership.package.name,
        previousEndDate: currentEndDate,
        newEndDate: updated.endDate,
        freezeDays,
        status: 'FROZEN',
        reason
      }
    };
  }

  /**
   * Kích hoạt lại / Mở bảo lưu gói tập tại quầy
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

    const updated = await prisma.membership.update({
      where: { id: membership.id },
      data: {
        status: 'ACTIVE'
      }
    });

    await prisma.actionLog.create({
      data: {
        userId: staffId,
        action: 'MEMBERSHIP_UNFREEZE_BY_STAFF',
        details: `Lễ tân ID ${staffId} đã mở lại gói bảo lưu [${membership.package.name}] cho hội viên ${membership.user.fullName}.${notes ? ` Ghi chú: ${notes}` : ''}`
      }
    });

    createUserNotification({
      userId: membership.userId,
      title: 'Gói tập đã được kích hoạt lại',
      message: `Quầy lễ tân đã mở lại gói tập [${membership.package.name}] của bạn. Trạng thái hiện tại: Đang hoạt động (ACTIVE).`
    }).catch((e) => console.error('Lỗi gửi push cho user:', e));

    return {
      success: true,
      message: `Đã mở lại gói bảo lưu và kích hoạt lại trạng thái hoạt động cho hội viên ${membership.user.fullName}!`,
      data: {
        membershipId: updated.id,
        packageName: membership.package.name,
        status: 'ACTIVE',
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
