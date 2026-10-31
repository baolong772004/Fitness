import { Router } from 'express';
import { PtController } from '../controllers/pt.controller.js';
import { PaymentController } from '../controllers/payment.controller.js';
import { authenticateToken, authorizeRoles } from '../middlewares/auth.middleware.js';
import {
  listPairChatMessages,
  listPtChatMessages,
  listPtConversations,
  sendPairChatMessage,
  sendPtChatMessage,
} from '../controllers/ptChat.controller.js';
import { getCoachWorkspace, getCoachTrainees, getCoachPlans, createCoachPlan, generateCoachPlan } from '../controllers/coachWorkspace.controller.js';
import { assignCoachPlan, getStudentPlanRevisions, restoreStudentPlan, updateStudentPlan } from '../controllers/studentWorkoutPlan.controller.js';
import { deleteCoachDate, deleteCoachSlot, getCoachAvailability, listCoachChangeRequests, putCoachDates, putCoachWeekly, requestCoachScheduleChange } from '../controllers/ptAvailability.controller.js';
import { adjustPtWallet, archivePtProduct, archivePtRenewalOption, createPtProduct, createPtRenewalOption, createWalletBooking, getAdminPtWallet, getMyPtCreditHistory, getMyPtRenewalHistory, getMyPtWallet, listAllPtProducts, listAllPtRenewalOptions, listAllPtSingleOffers, listPtProducts, listPtRenewalOptions, listPtSingleOffers, restorePtProduct, restorePtRenewalOption, savePtSingleOffer, setCoachSpecializations, setPtSingleOfferActive, updatePtProduct, updatePtRenewalOption } from '../controllers/ptWallet.controller.js';
import { listMyCoachChanges, listPendingCoachChanges, requestCoachChange, resolveCoachChange } from '../controllers/ptCoachChange.controller.js';

const router = Router();
router.get('/wallet', authenticateToken, authorizeRoles('MEMBER'), getMyPtWallet);
router.get('/wallet/history', authenticateToken, authorizeRoles('MEMBER'), getMyPtCreditHistory);
router.get('/wallet/renewals', authenticateToken, authorizeRoles('MEMBER'), getMyPtRenewalHistory);
router.get('/products', listPtProducts);
router.get('/single-offers', listPtSingleOffers);
router.get('/single-offers/all', authenticateToken, authorizeRoles('ADMIN'), listAllPtSingleOffers);
router.put('/single-offers/:level', authenticateToken, authorizeRoles('ADMIN'), savePtSingleOffer);
router.patch('/single-offers/:level/active', authenticateToken, authorizeRoles('ADMIN'), setPtSingleOfferActive);
router.get('/products/manage', authenticateToken, authorizeRoles('ADMIN'), listAllPtProducts);
router.post('/products', authenticateToken, authorizeRoles('ADMIN'), createPtProduct);
router.put('/products/:id', authenticateToken, authorizeRoles('ADMIN'), updatePtProduct);
router.delete('/products/:id', authenticateToken, authorizeRoles('ADMIN'), archivePtProduct);
router.patch('/products/:id/restore', authenticateToken, authorizeRoles('ADMIN'), restorePtProduct);
router.get('/renewal-options', authenticateToken, authorizeRoles('MEMBER'), listPtRenewalOptions);
router.get('/renewal-options/manage', authenticateToken, authorizeRoles('ADMIN'), listAllPtRenewalOptions);
router.post('/renewal-options', authenticateToken, authorizeRoles('ADMIN'), createPtRenewalOption);
router.put('/renewal-options/:id', authenticateToken, authorizeRoles('ADMIN'), updatePtRenewalOption);
router.delete('/renewal-options/:id', authenticateToken, authorizeRoles('ADMIN'), archivePtRenewalOption);
router.patch('/renewal-options/:id/restore', authenticateToken, authorizeRoles('ADMIN'), restorePtRenewalOption);
router.put('/trainers/:coachId/specializations', authenticateToken, authorizeRoles('ADMIN'), setCoachSpecializations);
router.get('/admin/wallets/:memberId', authenticateToken, authorizeRoles('ADMIN', 'STAFF'), getAdminPtWallet);
router.post('/admin/wallets/:memberId/adjust', authenticateToken, authorizeRoles('ADMIN'), adjustPtWallet);
router.post('/wallet/bookings', authenticateToken, authorizeRoles('MEMBER'), createWalletBooking);
router.get('/coach-change-requests/mine', authenticateToken, authorizeRoles('MEMBER'), listMyCoachChanges);
router.post('/coach-change-requests', authenticateToken, authorizeRoles('MEMBER'), requestCoachChange);
router.get('/coach-change-requests/pending', authenticateToken, authorizeRoles('ADMIN', 'STAFF'), listPendingCoachChanges);
router.patch('/coach-change-requests/:id', authenticateToken, authorizeRoles('ADMIN'), resolveCoachChange);

/** @swagger
 * /pt/coach/me:
 *   get:
 *     summary: Coach xem hồ sơ PT và lịch rảnh của chính mình
 *     tags: [PersonalTrainer]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Hồ sơ Coach }
 */
router.get('/coach/me', authenticateToken, authorizeRoles('COACH', 'TRAINER'), getCoachWorkspace);

/** @swagger
 * /pt/coach/trainees:
 *   get:
 *     summary: Coach xem các học viên có gói PT được phân cho mình
 *     tags: [PersonalTrainer]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Danh sách gói PT và học viên }
 */
router.get('/coach/trainees', authenticateToken, authorizeRoles('COACH', 'TRAINER'), getCoachTrainees);

/** @swagger
 * /pt/coach/availability:
 *   put:
 *     summary: Coach cập nhật lịch rảnh hàng tuần của chính mình
 *     tags: [PersonalTrainer]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [schedules]
 *             properties:
 *               schedules:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [dayOfWeek, startTime, endTime]
 *                   properties:
 *                     dayOfWeek: { type: integer, minimum: 1, maximum: 7 }
 *                     startTime: { type: string, example: '08:00' }
 *                     endTime: { type: string, example: '12:00' }
 *                     isAvailable: { type: boolean }
 *     responses:
 *       200: { description: Đã lưu lịch rảnh }
 */
router.get('/coach/availability', authenticateToken, authorizeRoles('COACH', 'TRAINER'), getCoachAvailability);
router.put('/coach/availability', authenticateToken, authorizeRoles('COACH', 'TRAINER'), putCoachWeekly);
router.put('/coach/availability/dates', authenticateToken, authorizeRoles('COACH', 'TRAINER'), putCoachDates);
router.delete('/coach/availability/dates/:date', authenticateToken, authorizeRoles('COACH', 'TRAINER'), deleteCoachDate);
router.delete('/coach/availability/slots', authenticateToken, authorizeRoles('COACH', 'TRAINER'), deleteCoachSlot);
router.get('/coach/availability/change-requests', authenticateToken, authorizeRoles('COACH', 'TRAINER'), listCoachChangeRequests);
router.post('/coach/availability/change-requests', authenticateToken, authorizeRoles('COACH', 'TRAINER'), requestCoachScheduleChange);

/** @swagger
 * /pt/coach/plans:
 *   get:
 *     summary: Coach xem giáo án đã lưu của mình
 *     tags: [PersonalTrainer]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Danh sách giáo án }
 *   post:
 *     summary: Coach lưu giáo án theo buổi và thực đơn theo ngày cho học viên được phân công
 *     tags: [PersonalTrainer]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title]
 *             properties:
 *               memberId: { type: integer, nullable: true, description: 'Tùy chọn; có thể gán sau khi học viên chốt lịch' }
 *               title: { type: string }
 *               description: { type: string }
 *               sessions:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [dayOfWeek, title, exercises]
 *                   properties:
 *                     dayOfWeek: { type: integer, minimum: 1, maximum: 7, description: '1 = Thứ Hai' }
 *                     title: { type: string }
 *                     notes: { type: string }
 *                     exercises:
 *                       type: array
 *                       items:
 *                         type: object
 *                         required: [exerciseName, sets, reps]
 *                         properties:
 *                           exerciseName: { type: string }
 *                           sets: { type: integer }
 *                           reps: { type: integer }
 *                           weightKg: { type: number, nullable: true }
 *                           notes: { type: string }
 *               mealDays:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [dayOfWeek, meals]
 *                   properties:
 *                     dayOfWeek: { type: integer, minimum: 1, maximum: 7 }
 *                     notes: { type: string }
 *                     meals:
 *                       type: array
 *                       items:
 *                         type: object
 *                         required: [mealType, food, portion]
 *                         properties:
 *                           mealType: { type: string, enum: [BREAKFAST, LUNCH, DINNER, SNACK] }
 *                           time: { type: string, example: '07:00' }
 *                           food: { type: string }
 *                           portion: { type: string }
 *                           calories: { type: integer, nullable: true }
 *                           notes: { type: string }
 *     responses:
 *       201: { description: Đã lưu giáo án }
 */
router.get('/coach/plans', authenticateToken, authorizeRoles('COACH', 'TRAINER'), getCoachPlans);
router.post('/coach/plans/generate', authenticateToken, authorizeRoles('COACH', 'TRAINER'), generateCoachPlan);
router.post('/coach/plans', authenticateToken, authorizeRoles('COACH', 'TRAINER'), createCoachPlan);
router.post('/coach/plans/:id/assign', authenticateToken, authorizeRoles('COACH', 'TRAINER'), assignCoachPlan);
router.put('/coach/assigned-plans/:id', authenticateToken, authorizeRoles('COACH', 'TRAINER', 'ADMIN'), updateStudentPlan);
router.post('/coach/assigned-plans/:id/restore', authenticateToken, authorizeRoles('COACH', 'TRAINER', 'ADMIN'), restoreStudentPlan);
router.get('/coach/assigned-plans/:id/revisions', authenticateToken, authorizeRoles('COACH', 'TRAINER', 'ADMIN'), getStudentPlanRevisions);

/**
 * @swagger
 * /pt/trainers:
 *   get:
 *     summary: Lấy danh sách huấn luyện viên đang hoạt động
 *     tags: [PersonalTrainer]
 *     responses:
 *       200:
 *         description: Danh sách huấn luyện viên
 */
router.get('/trainers', PtController.getAvailableTrainers);

/**
 * @swagger
 * tags:
 *   name: PersonalTrainer
 *   description: API Quản lý Gói tập PT và Đặt lịch PT
 */

/**
 * @swagger
 * /pt/buy:
 *   post:
 *     summary: Tạo đơn PayOS mua gói PT (cần Membership ACTIVE)
 *     tags: [PersonalTrainer]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               ptPackageId:
 *                 type: integer
 *               trainerId:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Trả về link và QR PayOS; gói được kích hoạt sau khi thanh toán
 *       403:
 *         description: Chưa có Membership
 */
router.post('/buy', authenticateToken, PaymentController.createPtCheckoutSession);

/**
 * @swagger
 * /pt/trainers/{trainerId}/slots:
 *   get:
 *     summary: Lấy danh sách lịch trống của PT theo ngày
 *     tags: [PersonalTrainer]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: trainerId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: date
 *         required: true
 *         schema:
 *           type: string
 *         description: YYYY-MM-DD
 *     responses:
 *       200:
 *         description: Danh sách ca tập
 */
router.get('/trainers/:trainerId/slots', authenticateToken, PtController.getTrainerSchedule);

/**
 * @swagger
 * /pt/booking:
 *   post:
 *     summary: Đặt lịch tập với PT
 *     tags: [PersonalTrainer]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               ptSubscriptionId:
 *                 type: integer
 *               bookingDate:
 *                 type: string
 *                 description: YYYY-MM-DDTHH:mm:ss.000Z
 *               coachId:
 *                 type: integer
 *                 description: Bắt buộc khi dùng buổi PT tặng kèm gói Gym
 *               note:
 *                 type: string
 *     responses:
 *       201:
 *         description: Ca hợp lệ được xác nhận ngay (CONFIRMED)
 */
router.post('/booking', authenticateToken, authorizeRoles('MEMBER'), PtController.createBooking);

/**
 * @swagger
 * /pt/booking/batch:
 *   post:
 *     summary: Đặt cùng lúc 1–20 ca PT, tất cả thành công hoặc không ca nào được tạo
 *     tags: [PersonalTrainer]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [ptSubscriptionId, bookingDates]
 *             properties:
 *               ptSubscriptionId: { type: integer }
 *               coachId: { type: integer, description: Bắt buộc cho PT tặng kèm Gym }
 *               bookingDates:
 *                 type: array
 *                 minItems: 1
 *                 maxItems: 20
 *                 items: { type: string, format: date-time }
 *     responses:
 *       201: { description: Tất cả ca được xác nhận (CONFIRMED) }
 *       409: { description: Có ca trùng lịch hoặc vượt số buổi khả dụng }
 */
router.post('/booking/batch', authenticateToken, authorizeRoles('MEMBER'), PtController.createBookingBatch);

/**
 * @swagger
 * /pt/booking/{id}/status:
 *   patch:
 *     summary: HLV xác nhận hoặc từ chối lịch tập
 *     tags: [PersonalTrainer]
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
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [CONFIRMED, REJECTED]
 *     responses:
 *       200:
 *         description: Thành công
 */
router.patch('/booking/:id/status', authenticateToken, PtController.updateBookingStatus);

/**
 * @swagger
 * /pt/my-bookings:
 *   get:
 *     summary: Xem danh sách lịch đặt PT của tôi
 *     tags: [PersonalTrainer]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Danh sách lịch đặt PT
 */
router.get('/my-bookings', authenticateToken, PtController.getMyBookings);
router.get('/my-trainees', authenticateToken, authorizeRoles('COACH', 'TRAINER'), PtController.getMyTrainees);

/**
 * @swagger
 * /pt/booking/{id}/messages:
 *   get:
 *     summary: Xem tin nhắn của lịch PT đã xác nhận
 *     tags: [PersonalTrainer]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 *       - { in: query, name: beforeId, schema: { type: integer } }
 *       - { in: query, name: afterId, schema: { type: integer } }
 *       - { in: query, name: limit, schema: { type: integer, default: 30 } }
 *     responses:
 *       200: { description: Danh sách tin nhắn cũ đến mới }
 *   post:
 *     summary: Gửi tin nhắn cho PT hoặc hội viên trong lịch
 *     tags: [PersonalTrainer]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [content]
 *             properties:
 *               content: { type: string, maxLength: 1000 }
 *     responses:
 *       201: { description: Đã lưu và gửi tin nhắn }
 */
router.get('/conversations', authenticateToken, listPtConversations);
router.get('/conversations/:partnerId/messages', authenticateToken, listPairChatMessages);
router.post('/conversations/:partnerId/messages', authenticateToken, sendPairChatMessage);
router.get('/booking/:id/messages', authenticateToken, listPtChatMessages);
router.post('/booking/:id/messages', authenticateToken, sendPtChatMessage);

/**
 * @swagger
 * /pt/booking/{id}/generate-session-qr:
 *   post:
 *     summary: PT tạo mã QR cho buổi tập (Hiệu lực 90s)
 *     tags: [PersonalTrainer]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Thành công
 *       400:
 *         description: Lịch hẹn không đúng trạng thái
 */
router.post('/booking/:id/generate-session-qr', authenticateToken, authorizeRoles('COACH', 'TRAINER'), PtController.generateSessionQr);

/**
 * @swagger
 * /pt/booking/start-session:
 *   post:
 *     summary: Hội viên quét mã QR để bắt đầu buổi tập
 *     tags: [PersonalTrainer]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               qrToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Buổi tập đã bắt đầu
 */
router.post('/booking/start-session', authenticateToken, authorizeRoles('MEMBER'), PtController.startSessionWithQr);
router.post('/booking/:id/manual-check-in', authenticateToken, authorizeRoles('ADMIN', 'STAFF'), PtController.manualCheckIn);

/**
 * @swagger
 * /pt/booking/{id}/complete-session:
 *   post:
 *     summary: PT kết thúc buổi tập và tự động trừ số buổi
 *     tags: [PersonalTrainer]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Thành công
 */
router.post('/booking/:id/complete-session', authenticateToken, authorizeRoles('COACH', 'TRAINER'), PtController.completeSession);

/**
 * @swagger
 * /pt/booking/{id}/mark-absent:
 *   post:
 *     summary: Báo vắng/hủy lịch học (Hội viên/PT)
 *     tags: [PersonalTrainer]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Báo vắng thành công
 */
router.get('/booking/:id/absence-policy', authenticateToken, PtController.getAbsencePolicy);
router.post('/booking/:id/mark-absent', authenticateToken, PtController.markAbsent);

/**
 * @swagger
 * /pt/booking/{id}/resolve-no-show:
 *   post:
 *     summary: Admin/Staff điều chỉnh buổi PT tự động ghi nhận vắng
 *     tags: [PersonalTrainer]
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
 *             required: [resolution, reason]
 *             properties:
 *               resolution:
 *                 type: string
 *                 enum: [ATTENDED, EXCUSED]
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Đã điều chỉnh buổi PT
 */
router.post('/booking/:id/resolve-no-show', authenticateToken, authorizeRoles('ADMIN', 'STAFF'), PtController.resolveNoShow);

/**
 * @swagger
 * /pt/booking/schedule-makeup:
 *   post:
 *     summary: Đặt lại lịch học bù cho buổi đã vắng có phép
 *     tags: [PersonalTrainer]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               originalBookingId:
 *                 type: integer
 *               newBookingDate:
 *                 type: string
 *                 description: YYYY-MM-DDTHH:mm:ss.000Z
 *     responses:
 *       201:
 *         description: Đặt lịch bù thành công
 */
router.post('/booking/schedule-makeup', authenticateToken, authorizeRoles('MEMBER'), PtController.scheduleMakeup);

export default router;
