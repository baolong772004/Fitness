import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middlewares/auth.middleware.js';
import {
  generateOrderCode,
  getPayOS,
  getPayOSRedirectUrls,
  markPaymentFailed,
} from '../services/payment.service.js';

const prisma = new PrismaClient();

export class SubscriptionController {
  static async createSubscription(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { packageId, startDate: inputStartDate, status: inputStatus } = req.body;
      const currentUserId = req.user?.userId;
      const currentUserRole = req.user?.role;

      if (!packageId) {
        return res.status(400).json({ success: false, message: 'packageId is required' });
      }

      // Determine the target user ID and status based on who is making the request
      let targetUserId = currentUserId;
      let targetStatus = 'PENDING';

      if (currentUserRole === 'ADMIN' || currentUserRole === 'STAFF') {
        const { userId } = req.body;
        if (userId) {
          targetUserId = parseInt(userId);
        }
        if (inputStatus) {
          targetStatus = inputStatus;
        } else {
          targetStatus = 'ACTIVE'; // Staff/Admin creating it usually implies immediate activation
        }
      }

      if (!targetUserId) {
         return res.status(400).json({ success: false, message: 'userId is required' });
      }

      // Fetch the package details
      const pkg = await prisma.package.findUnique({
        where: { id: parseInt(packageId) }
      });

      if (!pkg) {
        return res.status(404).json({ success: false, message: 'Package not found' });
      }

      if (!pkg.isActive && currentUserRole !== 'ADMIN' && currentUserRole !== 'STAFF') {
        return res.status(400).json({ success: false, message: 'This package is no longer available' });
      }

      if (pkg.type === 'PT') {
        const now = new Date();
        const activeGymMembership = await prisma.membership.findFirst({
          where: {
            userId: targetUserId,
            status: 'ACTIVE',
            startDate: { lte: now },
            endDate: { gte: now },
            package: { type: 'MEMBERSHIP' },
          },
          select: { id: true },
        });
        if (!activeGymMembership) {
          return res.status(403).json({
            success: false,
            message: 'Cần có gói hội viên gym còn hạn để đăng ký gói PT.',
          });
        }
      }

      // Calculate Dates
      const startDate = inputStartDate ? new Date(inputStartDate) : new Date();
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + pkg.durationDays);

      // Determine Remaining Sessions
      let remainingSessions = 0;
      if (pkg.type === 'MEMBERSHIP') {
        remainingSessions = pkg.trialPtSessions || 0;
      } else if (pkg.type === 'PT') {
        remainingSessions = pkg.totalPtSessions || 0;
      }

      // Create the Subscription (Mapped to the Membership table in DB)
      const subscription = await prisma.membership.create({
        data: {
          userId: targetUserId,
          packageId: pkg.id,
          startDate,
          endDate,
          remainingSessions,
          status: targetStatus
        },
        include: {
          package: true
        }
      });

      res.status(201).json({ success: true, message: 'Subscription created successfully', data: subscription });
    } catch (error) {
      next(error);
    }
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
        },
        orderBy: { createdAt: 'desc' }
      });

      res.status(200).json({ success: true, data: subscriptions });
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

      const skip = (page - 1) * limit;
      const where: any = {};

      if (status) where.status = status;

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

  static async updateSubscriptionStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const rawId = req.params.id;
      const id = Number.parseInt(typeof rawId === 'string' ? rawId : rawId[0] ?? '', 10);
      if (isNaN(id)) return res.status(400).json({ success: false, message: 'Invalid ID' });

      const { status } = req.body;
      if (!status) {
        return res.status(400).json({ success: false, message: 'Status is required' });
      }

      const validStatuses = ['PENDING', 'ACTIVE', 'EXPIRED', 'CANCELLED'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ success: false, message: 'Invalid status' });
      }

      const subscriptionExists = await prisma.membership.findUnique({ where: { id } });
      if (!subscriptionExists) return res.status(404).json({ success: false, message: 'Subscription not found' });

      const updatedSubscription = await prisma.membership.update({
        where: { id },
        data: { status }
      });

      res.status(200).json({ success: true, message: 'Status updated successfully', data: updatedSubscription });
    } catch (error) {
      next(error);
    }
  }

  static async renewSubscription(req: AuthRequest, res: Response, next: NextFunction) {
    let orderCode: bigint | null = null;
    let paymentCreated = false;
    try {
      const userId = req.user?.userId;
      const { subscriptionId, packageId } = req.body;

      if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
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
        where: { id: parsedSubscriptionId, userId },
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
      if (gymPackage.type === 'PT') {
        const now = new Date();
        const activeGymMembership = await prisma.membership.findFirst({
          where: {
            userId,
            status: 'ACTIVE',
            startDate: { lte: now },
            endDate: { gte: now },
            package: { type: 'MEMBERSHIP' },
          },
          select: { id: true },
        });
        if (!activeGymMembership) {
          return res.status(403).json({
            success: false,
            message: 'Cần có gói hội viên gym còn hạn để gia hạn gói PT.',
          });
        }
      }

      const amount = Number(gymPackage.price);
      if (!Number.isSafeInteger(amount) || amount <= 0) {
        return res.status(400).json({ success: false, message: 'Giá gói tập phải là số nguyên dương hợp lệ' });
      }

      const orderCodeNumber = generateOrderCode();
      orderCode = BigInt(orderCodeNumber);
      await prisma.payment.create({
        data: {
          userId,
          membershipId: currentSub.id,
          amount,
          method: 'PAYOS',
          status: 'PENDING',
          orderCode,
          transactionNo: `TXN-${orderCodeNumber}`,
          renewalDurationDays: gymPackage.durationDays,
        },
      });
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
