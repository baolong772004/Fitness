import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../config/prisma.js';
import { AuthRequest } from '../middlewares/auth.middleware.js';
import { lockGymMember } from '../services/gymMembershipLock.service.js';
import { reconcileGymMembershipStates } from '../services/membership.service.js';
import { verifiedGymPayment } from '../services/gymEntitlement.service.js';
import {
  generateOrderCode,
  getPayOS,
  getPayOSRedirectUrls,
  markPaymentFailed,
} from '../services/payment.service.js';



export class SubscriptionController {
  static async createSubscription(_req: AuthRequest, res: Response) {
    return res.status(409).json({ success: false, message: 'Gói tập chỉ được tạo qua PayOS. Dùng /api/payments/checkout để tạo đơn thanh toán.' });
  }

  static async getMySubscriptions(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

      const subscriptions = await prisma.membership.findMany({
        where: { userId },
        include: {
          package: true,
          coach: { select: { id: true, fullName: true } },
          payments: { where: verifiedGymPayment, select: { id: true }, take: 1 },
        },
        orderBy: { createdAt: 'desc' }
      });

      const now = new Date();
      const data = await Promise.all(subscriptions.map(async subscription => {
        const { payments, ...publicSubscription } = subscription;
        const isPtEntitlement = subscription.package.type === 'PT' ||
          (subscription.package.type === 'MEMBERSHIP' && subscription.package.trialPtSessions > 0);
        const batch = isPtEntitlement ? await prisma.ptCreditBatch.findFirst({ where: {
          membershipId: subscription.id,
        }, select: { level: true, initialCount: true, usedCount: true, heldCount: true } }) : null;
        const trialEnabled = subscription.package.type !== 'MEMBERSHIP' ||
          (['ACTIVE', 'PENDING_ACTIVATION'].includes(subscription.status) && subscription.endDate > now);
        return { ...publicSubscription, hasVerifiedPayment: payments.length > 0,
          ptCreditLevel: batch?.level ?? subscription.package.ptLevel,
          availableSessions: batch ? trialEnabled
            ? Math.max(0, batch.initialCount - batch.usedCount - batch.heldCount) : 0
            : 0 };
      }));
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async getAllSubscriptions(req: Request, res: Response, next: NextFunction) {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.max(1, parseInt(req.query.limit as string) || 10);
      const status = req.query.status as string;
      const search = req.query.search as string;
      const userId = req.query.userId ? Number(req.query.userId) : undefined;
      if (userId !== undefined && (!Number.isSafeInteger(userId) || userId <= 0)) {
        return res.status(400).json({ success: false, message: 'userId không hợp lệ' });
      }

      const skip = (page - 1) * limit;
      const where: any = {};

      if (status) where.status = status;
      if (userId) where.userId = userId;

      if (search) {
        where.user = {
          OR: [
            { fullName: { contains: search } },
            { email: { contains: search } }
          ]
        };
      }

      const [total, subscriptions] = await Promise.all([
        prisma.membership.count({ where }),
        prisma.membership.findMany({
          where,
          skip,
          take: limit,
          include: {
            user: { select: { id: true, fullName: true, email: true } },
            package: true
          },
          orderBy: { createdAt: 'desc' }
        })
      ]);

      const totalPages = Math.ceil(total / limit);

      res.status(200).json({
        success: true,
        data: subscriptions,
        pagination: {
          total,
          page,
          totalPages,
          limit
        }
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateSubscriptionStatus(_req: Request, res: Response) {
    return res.status(409).json({ success: false, message: 'Trạng thái gói Gym do PayOS và hệ thống xếp hàng quản lý; không thể đổi thủ công.' });
  }

  static async renewSubscription(req: AuthRequest, res: Response, next: NextFunction) {
    let orderCode: bigint | null = null;
    let paymentCreated = false;
    try {
      const userId = req.user?.userId;
      const { subscriptionId, packageId, memberId } = req.body;

      if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
      const actingForMember = memberId !== undefined && memberId !== null;
      if (actingForMember && !['ADMIN', 'STAFF'].includes(req.user?.role ?? '')) {
        return res.status(403).json({ success: false, message: 'Chỉ Admin/Staff được gia hạn cho hội viên khác.' });
      }
      const targetUserId = actingForMember ? Number(memberId) : userId;
      if (!Number.isSafeInteger(targetUserId) || targetUserId <= 0) {
        return res.status(400).json({ success: false, message: 'memberId không hợp lệ' });
      }
      const parsedSubscriptionId = Number(subscriptionId);
      const parsedPackageId = Number(packageId);
      if (!Number.isSafeInteger(parsedSubscriptionId) || parsedSubscriptionId <= 0 ||
          !Number.isSafeInteger(parsedPackageId) || parsedPackageId <= 0) {
        return res.status(400).json({ success: false, message: 'Thiếu thông tin gia hạn' });
      }

      const payos = getPayOS();
      if (!payos) {
        return res.status(503).json({ success: false, message: 'Cổng thanh toán chưa được cấu hình' });
      }

      // Make sure the current membership belongs to the caller.
      const currentSub = await prisma.membership.findFirst({
        where: { id: parsedSubscriptionId, userId: targetUserId },
      });

      if (!currentSub) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy thông tin gói tập' });
      }

      if (currentSub.packageId !== parsedPackageId) {
        return res.status(400).json({
          success: false,
          message: 'Chỉ có thể gia hạn đúng gói tập của membership này',
        });
      }

      const gymPackage = await prisma.package.findUnique({
        where: { id: parsedPackageId },
      });

      if (!gymPackage || !gymPackage.isActive) {
        return res.status(404).json({ success: false, message: 'Gói cước không hợp lệ' });
      }
      if (gymPackage.type !== 'MEMBERSHIP') {
        return res.status(400).json({ success: false, message: 'Gói PT không hỗ trợ gia hạn thời gian; hãy mua gói PT mới.' });
      }

      const amount = Number(gymPackage.price);
      if (!Number.isSafeInteger(amount) || amount <= 0) {
        return res.status(400).json({ success: false, message: 'Giá gói tập phải là số nguyên dương hợp lệ' });
      }

      const orderCodeNumber = generateOrderCode();
      orderCode = BigInt(orderCodeNumber);
      const renewalBlock = await prisma.$transaction(async tx => {
        await lockGymMember(tx, targetUserId);
        await reconcileGymMembershipStates(tx, targetUserId, new Date());
        const latest = await tx.membership.findFirst({ where: { id: currentSub.id, userId: targetUserId } });
        if (!latest || !['ACTIVE', 'EXPIRED'].includes(latest.status)) {
          return 'Chỉ có thể gia hạn gói Gym đang hoạt động hoặc đã hết hạn; gói chờ kích hoạt không được gia hạn.';
        }
        const pending = await tx.payment.findFirst({ where: {
          membershipId: latest.id, renewalDurationDays: { not: null }, status: 'PENDING',
        }, select: { id: true } });
        if (pending) return 'Gói này đã có đơn gia hạn chờ thanh toán.';
        await tx.payment.create({ data: {
          userId: targetUserId,
          membershipId: latest.id,
          amount,
          method: 'PAYOS',
          status: 'PENDING',
          orderCode,
          transactionNo: `TXN-${orderCodeNumber}`,
          renewalDurationDays: gymPackage.durationDays,
        } });
        return null;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10000, timeout: 30000 });
      if (renewalBlock) return res.status(409).json({ success: false, message: renewalBlock });
      paymentCreated = true;

      const description = `Renew ${gymPackage.name}`
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9 ]/g, '')
        .slice(0, 25);
      const paymentLink = await payos.createPaymentLink({
        orderCode: orderCodeNumber,
        amount,
        description,
        ...getPayOSRedirectUrls(),
      });

      return res.status(200).json({
        success: true,
        message: 'Tạo đơn thanh toán gia hạn thành công',
        data: {
          subscriptionId: currentSub.id,
          orderCode: orderCodeNumber,
          checkoutUrl: paymentLink.checkoutUrl,
          qrCode: paymentLink.qrCode,
        },
      });
    } catch (error: any) {
      if (orderCode !== null && paymentCreated) {
        try {
          await markPaymentFailed(orderCode);
        } catch (cleanupError) {
          console.error('Could not mark failed renewal payment:', cleanupError);
        }
      }
      console.error('Lỗi renewSubscription:', error);
      return res.status(orderCode === null || !paymentCreated ? 500 : 502).json({
        success: false,
        message: orderCode === null || !paymentCreated ? 'Không thể tạo đơn gia hạn' : 'Không thể tạo link thanh toán PayOS',
      });
    }
  }
}
