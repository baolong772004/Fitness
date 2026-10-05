import { Request, Response } from 'express';
import PayOS from '@payos/node';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middlewares/auth.middleware.js';

const prisma = new PrismaClient();

function getPayOS() {
  if (process.env.PAYOS_CLIENT_ID && process.env.PAYOS_API_KEY && process.env.PAYOS_CHECKSUM_KEY) {
    return new PayOS(
      process.env.PAYOS_CLIENT_ID.trim(),
      process.env.PAYOS_API_KEY.trim(),
      process.env.PAYOS_CHECKSUM_KEY.trim()
    );
  }
  return null;
}

export class PaymentController {
  static async createCheckoutSession(req: AuthRequest, res: Response) {
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

      // Tính ngày bắt đầu, kết thúc & số buổi PT
      const startDate = new Date();
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + gymPackage.durationDays);

      const remainingPtSessions =
        gymPackage.type === 'MEMBERSHIP'
          ? gymPackage.trialPtSessions
          : gymPackage.totalPtSessions || 0;

      // Tạo mã đơn hàng ngẫu nhiên (Số nguyên dương nhỏ hơn Max Safe Integer)
      const orderCodeNum = Number(String(Date.now()).slice(-6) + Math.floor(Math.random() * 1000));
      const orderCode = BigInt(orderCodeNum);

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
            amount: gymPackage.price,
            orderCode: orderCode,
            transactionNo: `TXN-${orderCodeNum}`,
            method: 'PAYOS',
            status: 'PENDING',
          },
        });

        return { subscription, payment };
      });

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
        amount: Number(gymPackage.price),
        description: description,
        cancelUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment-cancel`,
        returnUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment-success`,
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
      console.error('Checkout error:', error);
      return res.status(500).json({ message: 'Lỗi khởi tạo thanh toán', error: error.message });
    }
  }

  static async checkPaymentStatus(req: Request, res: Response) {
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
      const payment = await prisma.payment.findUnique({
        where: { orderCode: orderCodeBigInt },
      });

      if (!payment) {
        return res.status(404).json({ message: 'Không tìm thấy đơn thanh toán' });
      }

      const paymentLinkInfo = await payos.getPaymentLinkInformation(orderCodeNumber);

      if (paymentLinkInfo.status === 'PAID') {
        if (payment.status === 'PENDING') {
          await prisma.$transaction(async (tx) => {
            const updateResult = await tx.payment.updateMany({
              where: { id: payment.id, status: 'PENDING' },
              data: { status: 'PAID' },
            });

            if (updateResult.count > 0 && payment.membershipId !== null) {
              await tx.membership.update({
                where: { id: payment.membershipId },
                data: { status: 'ACTIVE' },
              });
            }
          });
        }

        return res.status(200).json({
          success: true,
          status: 'PAID',
          message: 'Thanh toán thành công',
        });
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
          const orderCodeStr = webhookData.orderCode;
          const orderCode = BigInt(orderCodeStr);

          // Tìm giao dịch thanh toán
          const payment = await prisma.payment.findUnique({
            where: { orderCode },
          });

          if (payment && payment.status === 'PENDING') {
            console.log(`🎉 [WEBHOOK] Đã nhận thanh toán thành công cho đơn hàng: ${orderCodeStr}`);
            
            // Cập nhật trạng thái Payment -> PAID và Membership -> ACTIVE
            await prisma.$transaction([
              prisma.payment.update({
                where: { id: payment.id },
                data: { status: 'PAID' },
              }),
              prisma.membership.update({
                where: { id: Number(payment.membershipId) },
                data: { status: 'ACTIVE' },
              }),
            ]);
          }
        }
      }

      // Luôn trả về 200 cho payOS để tránh lỗi trên webhook
      return res.status(200).json({ success: true, message: 'Nhận webhook thành công' });
    } catch (error: any) {
      console.error('Webhook error:', error.message);
      // Vẫn trả về 200 kèm success: false để payOS không báo lỗi ngắt kết nối
      return res.status(200).json({ success: false, message: error.message });
    }
  }
}
