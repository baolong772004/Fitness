import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middlewares/auth.middleware.js';
import {
  generateOrderCode,
  getPayOS,
  getPayOSRedirectUrls,
  markPaymentFailed,
  markPaymentPaid,
} from '../services/payment.service.js';

const prisma = new PrismaClient();

export class PaymentController {
  static async createCheckoutSession(req: AuthRequest, res: Response) {
    let orderCode: bigint | null = null;
    let paymentCreated = false;
    try {
      const userId = req.user?.userId;
      const { packageId } = req.body;

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
          : gymPackage.totalPtSessions || 0;

      // Tạo mã đơn hàng ngẫu nhiên (Số nguyên dương nhỏ hơn Max Safe Integer)
      const orderCodeNum = generateOrderCode();
      orderCode = BigInt(orderCodeNum);

      // Dùng Prisma Transaction để đảm bảo tính toàn vẹn dữ liệu
      const result = await prisma.$transaction(async (tx) => {
        // a. Tạo Membership (Tương đương Subscription) PENDING
        const subscription = await tx.membership.create({
          data: {
            userId,
            packageId: gymPackage.id,
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

        return { subscription, payment };
      });
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
        }
      }

      return res.status(200).json({ success: true, message: 'Nhận webhook thành công' });
    } catch (error: any) {
      console.error('Webhook error:', error.message);
      return res.status(500).json({ success: false, message: 'Không thể xử lý webhook' });
    }
  }
}
