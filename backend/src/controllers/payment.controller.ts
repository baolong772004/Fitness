import { Request, Response } from 'express';
import { Prisma, PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middlewares/auth.middleware.js';
import {
  generateOrderCode,
  getPayOS,
  getPayOSRedirectUrls,
  markPaymentFailed,
  markPaymentPaid,
} from '../services/payment.service.js';
import { reconcileGymMembershipStates, refreshGymMembershipStates } from '../services/membership.service.js';
import { lockGymMember } from '../services/gymMembershipLock.service.js';

const prisma = new PrismaClient();

export class PaymentController {
  static async createPtCheckoutSession(req: AuthRequest, res: Response) {
    req.body = {
      packageId: req.body?.ptPackageId,
      trainerId: req.body?.trainerId,
    };
    return PaymentController.createCheckoutSession(req, res);
  }

  static async createCheckoutSession(req: AuthRequest, res: Response) {
    let orderCode: bigint | null = null;
    let paymentCreated = false;
    try {
      const userId = req.user?.userId;
      const { packageId, trainerId } = req.body;

      if (!userId) return res.status(401).json({ message: 'Unauthorized' });
      if (!packageId) return res.status(400).json({ message: 'packageId is required' });

      const payos = getPayOS();
      if (!payos) {
        return res.status(500).json({ message: 'Cổng thanh toán chưa được cấu hình (Thiếu ENV)' });
      }

      // Lấy thông tin Package
      const gymPackage = await prisma.package.findUnique({
        where: { id: Number(packageId) },
      });

      if (!gymPackage || !gymPackage.isActive) {
        return res.status(404).json({ message: 'Gói tập không tồn tại hoặc đã ngừng bán' });
      }

      let ptCoachId: number | null = null;
      if (gymPackage.type === 'PT') {
        await refreshGymMembershipStates(userId);
        const parsedTrainerId = Number(trainerId);
        if (!Number.isSafeInteger(parsedTrainerId) || parsedTrainerId <= 0) {
          return res.status(400).json({ message: 'trainerId is required for a PT package' });
        }
        if (!Number.isSafeInteger(gymPackage.totalPtSessions) || (gymPackage.totalPtSessions ?? 0) <= 0) {
          return res.status(400).json({ message: 'PT package is missing a valid totalPtSessions value' });
        }

        const activeMembership = await prisma.membership.findFirst({
          where: {
            userId,
            status: 'ACTIVE',
            startDate: { lte: new Date() },
            endDate: { gte: new Date() },
            package: { type: 'MEMBERSHIP' },
          },
          select: { id: true },
        });
        if (!activeMembership) {
          return res.status(403).json({ message: 'An active membership is required to buy a PT package' });
        }

        const coach = await prisma.user.findFirst({
          where: {
            id: parsedTrainerId,
            role: { in: ['COACH', 'TRAINER'] },
            coachProfile: { is: { status: 'ACTIVE' } },
          },
          select: { id: true },
        });
        if (!coach) return res.status(404).json({ message: 'Active PT trainer was not found' });
        ptCoachId = coach.id;
      } else if (trainerId !== undefined && trainerId !== null) {
        return res.status(400).json({ message: 'trainerId can only be used with a PT package' });
      }

      const amount = Number(gymPackage.price);
      if (!Number.isSafeInteger(amount) || amount <= 0) {
        return res.status(400).json({ message: 'Giá gói tập phải là số nguyên dương hợp lệ' });
      }

      // Tính ngày bắt đầu, kết thúc & số buổi PT
      const startDate = new Date();
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + gymPackage.durationDays);

      const remainingPtSessions =
        gymPackage.type === 'MEMBERSHIP'
          ? gymPackage.trialPtSessions
          : gymPackage.totalPtSessions!;

      // Tạo mã đơn hàng ngẫu nhiên (Số nguyên dương nhỏ hơn Max Safe Integer)
      const orderCodeNum = generateOrderCode();
      orderCode = BigInt(orderCodeNum);

      // Dùng Prisma Transaction để đảm bảo tính toàn vẹn dữ liệu
      const result = await prisma.$transaction(async (tx) => {
        await lockGymMember(tx, userId);
        await reconcileGymMembershipStates(tx, userId, new Date());
        const matchingMemberships = await tx.membership.findMany({
          where: {
            userId,
            packageId: gymPackage.id,
            status: { in: ['ACTIVE', 'PENDING', 'PENDING_ACTIVATION', 'EXPIRED'] },
          },
          select: { id: true, status: true, remainingSessions: true },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        });
        const existingMembership = matchingMemberships.find(item => item.status === 'PENDING')
          ?? matchingMemberships.find(item => item.status === 'PENDING_ACTIVATION')
          ?? matchingMemberships[0];
        const blocksPurchase = existingMembership &&
          (gymPackage.type !== 'PT' || existingMembership.status === 'PENDING');
        if (blocksPurchase) return { blocked: existingMembership, subscription: null };

        // a. Tạo Membership (Tương đương Subscription) PENDING
        const subscription = await tx.membership.create({
          data: {
            userId,
            packageId: gymPackage.id,
            isGymMembership: gymPackage.type === 'MEMBERSHIP',
            coachId: ptCoachId,
            startDate,
            endDate,
            remainingSessions: remainingPtSessions,
            status: 'PENDING',
          },
        });

        // b. Tạo Payment PENDING
        const payment = await tx.payment.create({
          data: {
            membershipId: subscription.id,
            userId,
            amount,
            orderCode,
            transactionNo: `TXN-${orderCodeNum}`,
            method: 'PAYOS',
            status: 'PENDING',
          },
        });

        return { blocked: null, subscription, payment };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10000, timeout: 30000 });
      if (result.blocked) {
        return res.status(409).json({
          message: result.blocked.status === 'PENDING_ACTIVATION'
            ? `Bạn đã sở hữu gói ${gymPackage.name} đang chờ kích hoạt. Gói này sẽ tự động kích hoạt khi đến lượt sử dụng.`
            : result.blocked.status === 'PENDING'
              ? `Bạn đã có đơn mua gói ${gymPackage.name} đang chờ thanh toán. Vui lòng hoàn tất đơn đó hoặc liên hệ hỗ trợ để hủy.`
            : 'Bạn đã có gói tập này. Vui lòng gia hạn membership hiện tại.',
          subscriptionId: result.blocked.id,
          status: result.blocked.status,
        });
      }
      if (!result.subscription) throw new Error('Checkout membership was not created');
      paymentCreated = true;

      // Chuẩn hoá description theo chuẩn PayOS (Không dấu, không đặc biệt, max 25 ký tự)
      const rawDescription = `Gym ${gymPackage.name}`;
      const description = rawDescription
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9 ]/g, '')
        .slice(0, 25);

      // Tạo Link/QR thanh toán PayOS
      const paymentData = {
        orderCode: orderCodeNum,
        amount,
        description: description,
        ...getPayOSRedirectUrls(),
      };

      const payOsResponse = await payos.createPaymentLink(paymentData);

      return res.status(200).json({
        message: 'Tạo đơn thanh toán thành công',
        subscriptionId: result.subscription.id,
        orderCode: orderCodeNum,
        checkoutUrl: payOsResponse.checkoutUrl,
        qrCode: payOsResponse.qrCode,
      });
    } catch (error: any) {
      if (orderCode !== null && paymentCreated) {
        try {
          await markPaymentFailed(orderCode);
        } catch (cleanupError) {
          console.error('Could not mark failed checkout:', cleanupError);
        }
      }
      console.error('Checkout error:', error);
      return res.status(500).json({ message: 'Lỗi khởi tạo thanh toán', error: error.message });
    }
  }

  static async checkPaymentStatus(req: AuthRequest, res: Response) {
    try {
      const orderCode = req.params.orderCode;
      if (typeof orderCode !== 'string' || !/^\d+$/.test(orderCode)) {
        return res.status(400).json({ message: 'orderCode không hợp lệ' });
      }

      const orderCodeNumber = Number(orderCode);
      if (!Number.isSafeInteger(orderCodeNumber) || orderCodeNumber <= 0) {
        return res.status(400).json({ message: 'orderCode không hợp lệ' });
      }

      const payos = getPayOS();
      if (!payos) {
        return res.status(500).json({ message: 'Cổng thanh toán chưa được cấu hình' });
      }

      const orderCodeBigInt = BigInt(orderCode);
      const userId = req.user?.userId;
      if (!userId) return res.status(401).json({ message: 'Unauthorized' });

      const payment = await prisma.payment.findFirst({
        where: { orderCode: orderCodeBigInt, userId },
      });

      if (!payment) {
        return res.status(404).json({ message: 'Không tìm thấy đơn thanh toán' });
      }

      const paymentLinkInfo = await payos.getPaymentLinkInformation(orderCodeNumber);

      if (paymentLinkInfo.status === 'PAID') {
        const result = await markPaymentPaid(orderCodeBigInt, paymentLinkInfo.amountPaid);
        if (result.result === 'AMOUNT_MISMATCH') {
          console.error(`PayOS amount mismatch for order ${orderCode}`);
          return res.status(409).json({ message: 'Số tiền thanh toán không khớp với đơn hàng' });
        }
        if (result.result === 'NOT_FOUND') return res.status(404).json({ message: 'Không tìm thấy đơn thanh toán' });

        if (result.result === 'PAID_REVIEW' || result.result === 'ALREADY_PAID_REVIEW') {
          return res.status(200).json({
            success: false,
            status: 'PAID_REVIEW',
            message: 'Đã nhận tiền nhưng đơn gia hạn không còn hợp lệ. Gói tập chưa được gia hạn; vui lòng liên hệ hỗ trợ để xử lý hoàn tiền.',
          });
        }

        return res.status(200).json({
          success: true,
          status: 'PAID',
          message: 'Thanh toán thành công',
        });
      }

      if (paymentLinkInfo.status === 'CANCELLED') {
        await markPaymentFailed(orderCodeBigInt);
      }

      return res.status(200).json({
        success: false,
        status: paymentLinkInfo.status,
        message: 'Đơn hàng chưa được thanh toán',
      });
    } catch (error: any) {
      console.error('Check payment status error:', error);
      return res.status(500).json({
        message: 'Lỗi kiểm tra thanh toán',
        error: error.message,
      });
    }
  }

  static async handlePayOSWebhook(req: Request, res: Response) {
    try {
      const payos = getPayOS();
      if (!payos) {
         return res.status(500).json({ message: 'Cổng thanh toán chưa được cấu hình' });
      }

      if (req.body) {
        // Trường hợp payOS gửi request ping/test xác thực URL từ Dashboard
        if (req.body.code === '00' && req.body.desc === 'success') {
          return res.status(200).json({ success: true, message: 'Webhook URL verified' });
        }
        
        if (req.body.data && req.body.data.description === 'Ma test Webhook') {
          return res.status(200).json({ success: true, message: 'Webhook URL verified' });
        }

        // Xác thực dữ liệu thanh toán thực tế từ payOS
        const webhookData = payos.verifyPaymentWebhookData(req.body);

        if (webhookData && req.body.code === '00') {
          if (!Number.isSafeInteger(webhookData.orderCode) || !Number.isFinite(webhookData.amount)) {
            return res.status(400).json({ success: false, message: 'Dữ liệu webhook không hợp lệ' });
          }

          const result = await markPaymentPaid(BigInt(webhookData.orderCode), webhookData.amount);
          if (result.result === 'AMOUNT_MISMATCH') {
            console.error(`PayOS webhook amount mismatch for order ${webhookData.orderCode}`);
            return res.status(400).json({ success: false, message: 'Số tiền webhook không khớp đơn hàng' });
          }
          if (result.result === 'NOT_FOUND') {
            return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });
          }
          if (result.result === 'PAID_REVIEW') {
            console.error(`Paid Gym renewal requires refund review for order ${webhookData.orderCode}`);
          }
        }
      }

      return res.status(200).json({ success: true, message: 'Nhận webhook thành công' });
    } catch (error: any) {
      console.error('Webhook error:', error.message);
      return res.status(500).json({ success: false, message: 'Không thể xử lý webhook' });
    }
  }
}
