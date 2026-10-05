import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middlewares/auth.middleware.js';

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
          package: true
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
      const id = parseInt(req.params.id);
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
    try {
      const userId = req.user?.userId;
      const { subscriptionId, packageId, paymentMethod } = req.body; 

      if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
      if (!subscriptionId || !packageId) {
        return res.status(400).json({ success: false, message: 'Thiếu thông tin gia hạn' });
      }

      // 1. Kiểm tra gói tập hiện tại của Member
      const currentSub = await prisma.membership.findFirst({
        where: { id: Number(subscriptionId), userId: Number(userId) },
      });

      if (!currentSub) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy thông tin gói tập' });
      }

      // 2. Lấy thông tin gói cước gia hạn (để biết số ngày và giá)
      const gymPackage = await prisma.package.findUnique({
        where: { id: Number(packageId) },
      });

      if (!gymPackage) {
        return res.status(404).json({ success: false, message: 'Gói cước không hợp lệ' });
      }

      // 3. Tính toán ngày hết hạn mới (endDate)
      const now = new Date();
      let baseDate = new Date(currentSub.endDate);

      // Nếu gói cũ đã hết hạn thì tính từ thời điểm hiện tại
      if (baseDate < now) {
        baseDate = now;
      }

      // Cộng thêm số ngày gia hạn (Sử dụng durationDays theo Schema hiện tại)
      const newEndDate = new Date(baseDate);
      newEndDate.setDate(newEndDate.getDate() + gymPackage.durationDays);

      // 4. Thực hiện Transaction: Cập nhật hạn gói + Tạo bản ghi Thanh toán
      const result = await prisma.$transaction(async (tx) => {
        const updatedSub = await tx.membership.update({
          where: { id: currentSub.id },
          data: {
            endDate: newEndDate,
            status: 'ACTIVE',
          },
        });

        // Schema hiện tại của Payment: method, transactionNo, membershipId
        const payment = await tx.payment.create({
          data: {
            userId: Number(userId),
            membershipId: currentSub.id,
            amount: gymPackage.price,
            method: paymentMethod || 'VNPAY',
            status: 'SUCCESS',
            transactionNo: `RENEW_${Date.now()}`,
          },
        });

        return { updatedSub, payment };
      });

      return res.status(200).json({
        success: true,
        message: 'Gia hạn gói tập thành công!',
        data: {
          subscriptionId: result.updatedSub.id,
          oldEndDate: currentSub.endDate,
          newEndDate: result.updatedSub.endDate,
          amountPaid: gymPackage.price,
        },
      });
    } catch (error: any) {
      console.error('Lỗi renewSubscription:', error);
      next(error);
    }
  }
}
