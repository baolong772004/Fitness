import { Response } from 'express';
import { StaffService } from '../services/staff.service.js';
import { StaffShiftRequest } from '../middlewares/staff.middleware.js';

export class StaffController {
  // =========================================================================
  // GIAI ĐOẠN 1: ĐĂNG NHẬP & TỰ ĐỘNG CHẤM CÔNG (Clock-in)
  // =========================================================================

  /**
   * Đăng nhập lễ tân tại máy quầy được duyệt & Tự động Check-in (Clock-in)
   */
  static async login(req: StaffShiftRequest, res: Response) {
    try {
      const { email, password, deviceToken } = req.body;

      if (!email || !password || !deviceToken) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng cung cấp đầy đủ: email, password và deviceToken của máy quầy!'
        });
      }

      const result = await StaffService.staffLogin({
        email,
        password,
        deviceToken
      });

      return res.status(200).json({
        success: true,
        message: 'Đăng nhập thành công và đã tự động mở ca trực (Clock-in)!',
        data: result
      });
    } catch (error: any) {
      console.error('Lỗi đăng nhập Lễ tân:', error.message);
      return res.status(401).json({
        success: false,
        message: error.message || 'Đăng nhập thất bại.'
      });
    }
  }

  /**
   * Lấy danh sách máy quầy đã duyệt
   */
  static async getDeskDevices(req: StaffShiftRequest, res: Response) {
    try {
      await StaffService.seedDefaultDeskDeviceIfNone();
      const devices = await StaffService.getDeskDevices();
      return res.status(200).json({
        success: true,
        data: devices
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: 'Lỗi lấy danh sách máy quầy.',
        error: error.message
      });
    }
  }

  /**
   * Đăng ký thiết bị quầy mới (Dành cho Admin/Quản lý)
   */
  static async registerDeskDevice(req: StaffShiftRequest, res: Response) {
    try {
      const { deviceToken, deviceName, location } = req.body;
      if (!deviceToken || !deviceName) {
        return res.status(400).json({
          success: false,
          message: 'deviceToken và deviceName là bắt buộc.'
        });
      }

      const device = await StaffService.registerDeskDevice({
        deviceToken,
        deviceName,
        location
      });

      return res.status(201).json({
        success: true,
        message: 'Đăng ký thiết bị quầy thành công!',
        data: device
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: 'Lỗi đăng ký thiết bị quầy.',
        error: error.message
      });
    }
  }

  // =========================================================================
  // GIAI ĐOẠN 2: SOÁT VÉ VÀO CỔNG (Venue Check-in)
  // =========================================================================

  /**
   * Quét mã QR động (2-3s: Anti-Passback -> Soát gói -> Lịch PT -> Vào)
   */
  static async scanQrCheckIn(req: StaffShiftRequest, res: Response) {
    try {
      const { qrToken } = req.body;
      const staffId = req.user!.userId;
      const shiftId = req.shift?.id;

      if (!qrToken) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng truyền chuỗi mã quét qrToken từ camera quầy.'
        });
      }

      const result = await StaffService.scanQrCheckIn({
        qrToken,
        staffId,
        shiftId
      });

      // Nếu check-in hợp lệ -> trả 200, nếu hết hạn hoặc vi phạm anti-passback -> trả 403 hoặc 200 kèm cảnh báo màu đỏ
      if (!result.success) {
        return res.status(200).json(result);
      }

      return res.status(200).json(result);
    } catch (error: any) {
      console.error('Lỗi soát vé QR:', error);
      return res.status(500).json({
        success: false,
        status: 'SERVER_ERROR',
        color: 'RED',
        message: 'Lỗi hệ thống khi soát vé QR.',
        error: error.message
      });
    }
  }

  /**
   * Check-in thủ công: Tra cứu thông tin + ảnh chân dung đối chiếu khuôn mặt
   */
  static async lookupMember(req: StaffShiftRequest, res: Response) {
    try {
      const phone = req.query.phone as string;
      if (!phone) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng cung cấp số điện thoại của hội viên (?phone=...).'
        });
      }

      const result = await StaffService.lookupMemberByPhone(phone);
      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (error: any) {
      return res.status(404).json({
        success: false,
        message: error.message || 'Không tìm thấy hội viên.'
      });
    }
  }

  /**
   * Check-in thủ công: Xác nhận vào sau khi đã đối chiếu mặt
   */
  static async manualCheckIn(req: StaffShiftRequest, res: Response) {
    try {
      const { memberId, notes } = req.body;
      const staffId = req.user!.userId;
      const shiftId = req.shift?.id;

      if (!memberId) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng cung cấp memberId.'
        });
      }

      const result = await StaffService.manualCheckIn({
        memberId: Number(memberId),
        staffId,
        shiftId,
        notes
      });

      return res.status(200).json(result);
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: error.message || 'Check-in thủ công thất bại.'
      });
    }
  }

  // =========================================================================
  // GIAI ĐOẠN 3: HỖ TRỢ THANH TOÁN TẠI QUẦY (Offline POS Fallback)
  // =========================================================================

  /**
   * Khách Walk-in (khách mới chưa tải app): Tạo nhanh, chọn gói, thu tiền, gửi SMS
   */
  static async walkInRegistration(req: StaffShiftRequest, res: Response) {
    try {
      const {
        fullName,
        phone,
        email,
        packageId,
        consultantStaffId,
        paymentMethod,
        amountPaid,
        traceRefNo
      } = req.body;

      const staffId = req.user!.userId;
      const shiftId = req.shift!.id;

      if (!fullName || !phone || !packageId || !paymentMethod) {
        return res.status(400).json({
          success: false,
          message: 'Thiếu thông tin bắt buộc: fullName, phone, packageId, paymentMethod (CASH hoặc POS).'
        });
      }

      const result = await StaffService.processWalkInCustomer({
        fullName,
        phone,
        email,
        packageId: Number(packageId),
        consultantStaffId: consultantStaffId ? Number(consultantStaffId) : undefined,
        paymentMethod,
        amountPaid: amountPaid ? Number(amountPaid) : undefined,
        traceRefNo,
        staffId,
        shiftId
      });

      return res.status(201).json(result);
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: error.message || 'Xử lý khách Walk-in thất bại.'
      });
    }
  }

  /**
   * Tra cứu các hóa đơn đang chờ thanh toán theo SĐT
   */
  static async getPendingPayments(req: StaffShiftRequest, res: Response) {
    try {
      const phone = req.query.phone as string;
      if (!phone) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng cung cấp số điện thoại (?phone=...).'
        });
      }

      const result = await StaffService.getPendingPaymentsByPhone(phone);
      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (error: any) {
      return res.status(404).json({
        success: false,
        message: error.message || 'Không tìm thấy hóa đơn chờ thanh toán.'
      });
    }
  }

  /**
   * Thanh toán hóa đơn tại quầy (Tiền mặt hoặc POS ngân hàng)
   */
  static async processOfflinePayment(req: StaffShiftRequest, res: Response) {
    try {
      const { paymentId, paymentMethod, cashReceived, traceRefNo } = req.body;
      const staffId = req.user!.userId;
      const shiftId = req.shift!.id;

      if (!paymentId || !paymentMethod) {
        return res.status(400).json({
          success: false,
          message: 'paymentId và paymentMethod (CASH hoặc POS) là bắt buộc.'
        });
      }

      const result = await StaffService.processOfflinePayment({
        paymentId: Number(paymentId),
        paymentMethod,
        cashReceived: cashReceived ? Number(cashReceived) : undefined,
        traceRefNo,
        staffId,
        shiftId
      });

      return res.status(200).json(result);
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: error.message || 'Thanh toán tại quầy thất bại.'
      });
    }
  }

  /**
   * Hỗ trợ bảo lưu gói tại quầy
   */
  static async freezeMembership(req: StaffShiftRequest, res: Response) {
    try {
      const { membershipId, freezeDays, reason } = req.body;
      const staffId = req.user!.userId;
      const shiftId = req.shift?.id;

      if (!membershipId || !freezeDays || !reason) {
        return res.status(400).json({
          success: false,
          message: 'membershipId, freezeDays và reason là bắt buộc.'
        });
      }

      const result = await StaffService.freezeMembershipAtDesk({
        membershipId: Number(membershipId),
        freezeDays: Number(freezeDays),
        reason,
        staffId,
        shiftId
      });

      return res.status(200).json(result);
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: error.message || 'Bảo lưu gói thất bại.'
      });
    }
  }

  // =========================================================================
  // GIAI ĐOẠN 4: VẬN HÀNH THIẾT BỊ & TIẾP NHẬN YÊU CẦU
  // =========================================================================

  /**
   * Lấy danh sách máy tập
   */
  static async getEquipments(req: StaffShiftRequest, res: Response) {
    try {
      const roomId = req.query.roomId ? Number(req.query.roomId) : undefined;
      const list = await StaffService.getEquipmentsList(roomId);
      return res.status(200).json({
        success: true,
        data: list
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: 'Lỗi lấy danh sách thiết bị.',
        error: error.message
      });
    }
  }

  /**
   * Báo hỏng máy tập / Đổi trạng thái thiết bị sang Under Maintenance
   */
  static async updateEquipmentStatus(req: StaffShiftRequest, res: Response) {
    try {
      const equipmentId = Number(req.params.id);
      const { status, note } = req.body;
      const staffId = req.user!.userId;

      if (!status) {
        return res.status(400).json({
          success: false,
          message: 'Trạng thái (AVAILABLE hoặc UNDER_MAINTENANCE) là bắt buộc.'
        });
      }

      const result = await StaffService.updateEquipmentMaintenance({
        equipmentId,
        status,
        note,
        staffId
      });

      return res.status(200).json(result);
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: error.message || 'Cập nhật thiết bị thất bại.'
      });
    }
  }

  /**
   * Tiếp nhận khiếu nại / Ghi chú vận hành từ khách
   */
  static async createOperationalNote(req: StaffShiftRequest, res: Response) {
    try {
      const { memberId, memberName, memberPhone, category, content, priority } = req.body;
      const staffId = req.user!.userId;
      const shiftId = req.shift?.id;

      if (!content || !category) {
        return res.status(400).json({
          success: false,
          message: 'category (HYGIENE, EQUIPMENT, SERVICE, FACILITY, OTHER) và content là bắt buộc.'
        });
      }

      const result = await StaffService.createOperationalNote({
        staffId,
        shiftId,
        memberId: memberId ? Number(memberId) : undefined,
        memberName,
        memberPhone,
        category,
        content,
        priority
      });

      return res.status(201).json(result);
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: error.message || 'Tạo ghi chú vận hành thất bại.'
      });
    }
  }

  /**
   * Xem danh sách ghi chú vận hành
   */
  static async getOperationalNotes(req: StaffShiftRequest, res: Response) {
    try {
      const status = req.query.status as string;
      const page = req.query.page ? Number(req.query.page) : 1;
      const limit = req.query.limit ? Number(req.query.limit) : 20;

      const result = await StaffService.getOperationalNotes({ status, page, limit });
      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: 'Lỗi lấy danh sách ghi chú vận hành.',
        error: error.message
      });
    }
  }

  // =========================================================================
  // GIAI ĐOẠN 5: CHỐT CA & TỰ ĐỘNG CHẤM CÔNG RA (Clock-out)
  // =========================================================================

  /**
   * Lấy thông tin tóm tắt ca trực hiện tại để đối soát
   */
  static async getCurrentShift(req: StaffShiftRequest, res: Response) {
    try {
      const staffId = req.user!.userId;
      const summary = await StaffService.getCurrentShiftSummary(staffId);
      return res.status(200).json({
        success: true,
        data: summary
      });
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: error.message || 'Không thể lấy thông tin ca trực.'
      });
    }
  }

  /**
   * Chốt ca làm việc, đối soát tiền mặt X và Y, và tự động Clock-out
   */
  static async closeShift(req: StaffShiftRequest, res: Response) {
    try {
      const staffId = req.user!.userId;
      const { actualCashAmount, differenceReason } = req.body;

      if (actualCashAmount === undefined || actualCashAmount === null) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng nhập số tiền mặt thực tế kiểm đếm được trong ngăn kéo (actualCashAmount).'
        });
      }

      const result = await StaffService.closeShiftAndClockOut({
        staffId,
        actualCashAmount: Number(actualCashAmount),
        differenceReason
      });

      return res.status(200).json(result);
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: error.message || 'Đóng ca trực thất bại.'
      });
    }
  }
}
