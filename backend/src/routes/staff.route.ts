import { Router } from 'express';
import { StaffController } from '../controllers/staff.controller.js';
import { authenticateToken, authorizeRoles } from '../middlewares/auth.middleware.js';
import { requireStaffShift } from '../middlewares/staff.middleware.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Staff
 *   description: Phân hệ Nghiệp vụ Dành Riêng Cho Quầy Lễ Tân (5 Giai đoạn khép kín)
 */

// =========================================================================
// GIAI ĐOẠN 1: ĐĂNG NHẬP & TỰ ĐỘNG CHẤM CÔNG (Clock-in)
// =========================================================================

/**
 * @swagger
 * /staff/login:
 *   post:
 *     summary: Giai đoạn 1 - Lễ tân đăng nhập từ máy quầy và Tự động Clock-in
 *     tags: [Staff]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - deviceToken
 *             properties:
 *               email:
 *                 type: string
 *                 example: staff@fitness.com
 *               password:
 *                 type: string
 *                 example: "123456"
 *               deviceToken:
 *                 type: string
 *                 description: Token định danh máy quầy đã duyệt (mặc định DESK-POS-DEFAULT-001)
 *                 example: "DESK-POS-DEFAULT-001"
 *     responses:
 *       200:
 *         description: Đăng nhập thành công, khởi tạo phiên ca trực Shift_ID và trả về Access Token
 *       401:
 *         description: Sai thông tin đăng nhập hoặc thiết bị quầy chưa được cấp phép
 */
router.post('/login', StaffController.login);

/**
 * @swagger
 * /staff/devices:
 *   get:
 *     summary: Xem danh sách thiết bị máy quầy đã đăng ký
 *     tags: [Staff]
 *     responses:
 *       200:
 *         description: Danh sách các máy quầy
 */
router.get('/devices', StaffController.getDeskDevices);

/**
 * @swagger
 * /staff/devices:
 *   post:
 *     summary: Đăng ký / Duyệt thiết bị quầy lễ tân mới (Admin/Manager)
 *     tags: [Staff]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - deviceToken
 *               - deviceName
 *             properties:
 *               deviceToken:
 *                 type: string
 *                 example: "DESK-POS-02"
 *               deviceName:
 *                 type: string
 *                 example: "Quầy Lễ Tân Số 2 (Tầng Trệt)"
 *               location:
 *                 type: string
 *                 example: "Cơ sở 1 - 123 Nguyễn Thị Minh Khai"
 *     responses:
 *       201:
 *         description: Thiết bị đã được duyệt
 */
router.post(
  '/devices',
  authenticateToken,
  authorizeRoles('ADMIN', 'STAFF'),
  StaffController.registerDeskDevice
);

// =========================================================================
// GIAI ĐOẠN 2: SOÁT VÉ VÀO CỔNG (Venue Check-in)
// =========================================================================

/**
 * @swagger
 * /staff/checkin/scan-qr:
 *   post:
 *     summary: Giai đoạn 2.1 - Quét QR động (2-3s, Anti-Passback 30p, soát gói Gym, nhận diện PT & bắn Push Coach)
 *     tags: [Staff]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - qrToken
 *             properties:
 *               qrToken:
 *                 type: string
 *                 description: Chuỗi token lấy từ camera quét QR động trên App của khách
 *     responses:
 *       200:
 *         description: Trả về trạng thái Xanh (GREEN - Hợp lệ) hoặc Đỏ (RED - Hết hạn/Anti-Passback)
 */
router.post(
  '/checkin/scan-qr',
  authenticateToken,
  authorizeRoles('STAFF', 'ADMIN'),
  requireStaffShift,
  StaffController.scanQrCheckIn
);

/**
 * @swagger
 * /staff/checkin/lookup-member:
 *   get:
 *     summary: Giai đoạn 2.2 - Tra cứu SĐT hội viên (Hiện ảnh chân dung đối chiếu khuôn mặt khi khách hết pin)
 *     tags: [Staff]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: phone
 *         required: true
 *         schema:
 *           type: string
 *         description: Số điện thoại hội viên
 *     responses:
 *       200:
 *         description: Trả về hồ sơ hội viên và ảnh chân dung
 */
router.get(
  '/checkin/lookup-member',
  authenticateToken,
  authorizeRoles('STAFF', 'ADMIN'),
  requireStaffShift,
  StaffController.lookupMember
);

/**
 * @swagger
 * /staff/checkin/manual:
 *   post:
 *     summary: Giai đoạn 2.3 - Xác nhận vào cổng thủ công sau khi đã đối chiếu mặt
 *     tags: [Staff]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - memberId
 *             properties:
 *               memberId:
 *                 type: integer
 *               notes:
 *                 type: string
 *                 example: "Khách hết pin, đã đối chiếu ảnh đại diện khớp"
 *     responses:
 *       200:
 *         description: Check-in thủ công thành công
 */
router.post(
  '/checkin/manual',
  authenticateToken,
  authorizeRoles('STAFF', 'ADMIN'),
  requireStaffShift,
  StaffController.manualCheckIn
);

// =========================================================================
// GIAI ĐOẠN 3: HỖ TRỢ THANH TOÁN TẠI QUẦY (Offline POS Fallback)
// =========================================================================

/**
 * @swagger
 * /staff/members:
 *   post:
 *     summary: Staff tạo tài khoản hội viên mới, mật khẩu tạm 123456 và buộc đổi khi đăng nhập
 *     tags: [Staff]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Tạo tài khoản mới thành công
 */
router.post('/members', authenticateToken, authorizeRoles('STAFF', 'ADMIN'), requireStaffShift, StaffController.createMemberAccount);

/**
 * @swagger
 * /staff/pos/walk-in:
 *   post:
 *     summary: Giai đoạn 3.1 - Đăng ký khách Walk-in mới chưa tải App (Tạo nhanh, chọn gói, gán tư vấn, thu tiền, gửi SMS)
 *     tags: [Staff]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fullName
 *               - phone
 *               - packageId
 *               - paymentMethod
 *             properties:
 *               fullName:
 *                 type: string
 *                 example: "Trần Văn A"
 *               phone:
 *                 type: string
 *                 example: "0987654321"
 *               email:
 *                 type: string
 *                 example: "tranvana@gmail.com"
 *               packageId:
 *                 type: integer
 *                 example: 1
 *               consultantStaffId:
 *                 type: integer
 *                 description: ID nhân viên tư vấn tính hoa hồng
 *                 example: 2
 *               paymentMethod:
 *                 type: string
 *                 enum: [CASH, POS]
 *                 example: "CASH"
 *               amountPaid:
 *                 type: number
 *                 description: Số tiền khách đưa (nếu là CASH để tính tiền thừa)
 *                 example: 1000000
 *               traceRefNo:
 *                 type: string
 *                 description: Mã chuẩn chi máy quẹt thẻ POS ngoài (bắt buộc nếu chọn POS)
 *     responses:
 *       201:
 *         description: Kích hoạt gói thành công và sinh tin nhắn SMS kèm link tải app
 */
router.post(
  '/pos/walk-in',
  authenticateToken,
  authorizeRoles('STAFF', 'ADMIN'),
  requireStaffShift,
  StaffController.walkInRegistration
);

/**
 * @swagger
 * /staff/pos/pending-payments:
 *   get:
 *     summary: Giai đoạn 3.2 - Tìm hóa đơn đang chờ thanh toán tại quầy theo SĐT
 *     tags: [Staff]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: phone
 *         required: true
 *         schema:
 *           type: string
 *         description: Số điện thoại của hội viên
 *     responses:
 *       200:
 *         description: Danh sách hóa đơn PENDING
 */
router.get(
  '/pos/pending-payments',
  authenticateToken,
  authorizeRoles('STAFF', 'ADMIN'),
  requireStaffShift,
  StaffController.getPendingPayments
);

/**
 * @swagger
 * /staff/pos/pay:
 *   post:
 *     summary: Giai đoạn 3.3 - Thu tiền mặt hoặc Cà thẻ POS cho hóa đơn chờ (Kích hoạt gói trên App)
 *     tags: [Staff]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - paymentId
 *               - paymentMethod
 *             properties:
 *               paymentId:
 *                 type: integer
 *               paymentMethod:
 *                 type: string
 *                 enum: [CASH, POS]
 *               cashReceived:
 *                 type: number
 *                 description: Số tiền mặt khách đưa (để tính tiền thối)
 *               traceRefNo:
 *                 type: string
 *                 description: Mã chuẩn chi cà thẻ (bắt buộc nếu POS)
 *     responses:
 *       200:
 *         description: Thanh toán thành công và kích hoạt gói ngay
 */
router.post(
  '/pos/pay',
  authenticateToken,
  authorizeRoles('STAFF', 'ADMIN'),
  requireStaffShift,
  StaffController.processOfflinePayment
);

/**
 * @swagger
 * /staff/pos/freeze:
 *   post:
 *     summary: Giai đoạn 3.4 - Hỗ trợ bảo lưu gói tại quầy cho hội viên không rành công nghệ
 *     tags: [Staff]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - membershipId
 *               - freezeDays
 *               - reason
 *             properties:
 *               membershipId:
 *                 type: integer
 *               freezeDays:
 *                 type: integer
 *                 example: 30
 *               reason:
 *                 type: string
 *                 example: "Khách đi công tác nước ngoài"
 *     responses:
 *       200:
 *         description: Bảo lưu gói thành công
 */
router.post(
  '/pos/freeze',
  authenticateToken,
  authorizeRoles('STAFF', 'ADMIN'),
  requireStaffShift,
  StaffController.freezeMembership
);

router.post(
  '/pos/unfreeze',
  authenticateToken,
  authorizeRoles('STAFF', 'ADMIN'),
  requireStaffShift,
  StaffController.unfreezeMembership
);

// =========================================================================
// GIAI ĐOẠN 4: VẬN HÀNH THIẾT BỊ & TIẾP NHẬN YÊU CẦU
// =========================================================================

/**
 * @swagger
 * /staff/equipment:
 *   get:
 *     summary: Giai đoạn 4.1 - Xem danh sách máy tập tại phòng
 *     tags: [Staff]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: roomId
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Danh sách máy tập
 */
router.get(
  '/equipment',
  authenticateToken,
  authorizeRoles('STAFF', 'ADMIN'),
  StaffController.getEquipments
);

/**
 * @swagger
 * /staff/equipment/{id}/status:
 *   patch:
 *     summary: Giai đoạn 4.2 - Báo hỏng thiết bị (Đổi trạng thái sang UNDER_MAINTENANCE & Cảnh báo Manager)
 *     tags: [Staff]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [AVAILABLE, UNDER_MAINTENANCE]
 *                 example: "UNDER_MAINTENANCE"
 *               note:
 *                 type: string
 *                 example: "Đứt dây cáp kéo tạ xô số 2, cần kỹ thuật thay mới"
 *     responses:
 *       200:
 *         description: Cập nhật bảo trì thành công
 */
router.patch(
  '/equipment/:id/status',
  authenticateToken,
  authorizeRoles('STAFF', 'ADMIN'),
  StaffController.updateEquipmentStatus
);

/**
 * @swagger
 * /staff/support-notes:
 *   post:
 *     summary: Giai đoạn 4.3 - Tiếp nhận khiếu nại / Ghi chú vận hành (Vệ sinh, nhiệt độ phòng, dịch vụ -> Chuyển Manager)
 *     tags: [Staff]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - category
 *               - content
 *             properties:
 *               category:
 *                 type: string
 *                 enum: [HYGIENE, EQUIPMENT, SERVICE, FACILITY, OTHER]
 *                 example: "HYGIENE"
 *               content:
 *                 type: string
 *                 example: "Khách phản ánh phòng thay đồ nam sàn trơn và hết khăn lau"
 *               priority:
 *                 type: string
 *                 enum: [LOW, MEDIUM, HIGH, URGENT]
 *                 example: "HIGH"
 *               memberName:
 *                 type: string
 *                 example: "Nguyễn Văn B"
 *               memberPhone:
 *                 type: string
 *                 example: "0912345678"
 *     responses:
 *       201:
 *         description: Đã lưu ghi chú và bắn thông báo cho Center Manager
 */
router.post(
  '/support-notes',
  authenticateToken,
  authorizeRoles('STAFF', 'ADMIN'),
  StaffController.createOperationalNote
);

/**
 * @swagger
 * /staff/support-notes:
 *   get:
 *     summary: Xem danh sách ghi chú vận hành
 *     tags: [Staff]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Danh sách ghi chú
 */
router.get(
  '/support-notes',
  authenticateToken,
  authorizeRoles('STAFF', 'ADMIN'),
  StaffController.getOperationalNotes
);

// =========================================================================
// GIAI ĐOẠN 5: CHỐT CA & TỰ ĐỘNG CHẤM CÔNG RA (Clock-out)
// =========================================================================

/**
 * @swagger
 * /staff/shift/current:
 *   get:
 *     summary: Giai đoạn 5.1 - Khởi tạo Đóng ca (Xem tổng tiền mặt X hệ thống ghi nhận, POS và lượt checkin)
 *     tags: [Staff]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Trả về tóm tắt doanh thu và dữ liệu đối soát ca trực
 */
router.get(
  '/shift/current',
  authenticateToken,
  authorizeRoles('STAFF', 'ADMIN'),
  StaffController.getCurrentShift
);

/**
 * @swagger
 * /staff/shift/close:
 *   post:
 *     summary: Giai đoạn 5.2 & 5.3 - Đối soát tiền thực tế Y với X, nếu X != Y bắt buộc nhập lý do, Chấm công ra và Tự động đăng xuất
 *     tags: [Staff]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - actualCashAmount
 *             properties:
 *               actualCashAmount:
 *                 type: number
 *                 description: Số tiền mặt thực tế kiểm đếm được trong ngăn kéo (Y)
 *                 example: 2500000
 *               differenceReason:
 *                 type: string
 *                 description: Bắt buộc nếu thực tế Y khác hệ thống X
 *                 example: "Đổi tiền lẻ cho khách thừa 10.000đ"
 *     responses:
 *       200:
 *         description: Đóng ca thành công, ghi nhận Clock-out và trả về cờ autoLogout = true
 *       400:
 *         description: Chênh lệch tiền mà không nhập lý do
 */
router.post(
  '/shift/close',
  authenticateToken,
  authorizeRoles('STAFF', 'ADMIN'),
  StaffController.closeShift
);

export default router;
