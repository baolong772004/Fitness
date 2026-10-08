import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthRequest } from '../middlewares/auth.middleware.js';

const prisma = new PrismaClient();

export const getMyNotifications = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    const requestedPage = Number(req.query.page);
    const requestedLimit = Number(req.query.limit);
    const page = Number.isSafeInteger(requestedPage) && requestedPage > 0
      ? requestedPage
      : 1;
    const limit = Number.isSafeInteger(requestedLimit) && requestedLimit > 0
      ? Math.min(100, requestedLimit)
      : 20;
    const where = { userId };
    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    return res.status(200).json({
      success: true,
      data: notifications,
      unreadCount,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    return res.status(500).json({ success: false, message: 'Không thể tải thông báo' });
  }
};

export const getUnreadNotificationCount = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const count = await prisma.notification.count({ where: { userId, isRead: false } });
    return res.status(200).json({ success: true, data: { unreadCount: count } });
  } catch (error) {
    console.error('Get unread notifications count error:', error);
    return res.status(500).json({ success: false, message: 'Không thể tải số lượng thông báo chưa đọc' });
  }
};

export const markNotificationRead = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const notificationId = Number(req.params.id);
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    if (!Number.isSafeInteger(notificationId) || notificationId <= 0) {
      return res.status(400).json({ success: false, message: 'Notification ID không hợp lệ' });
    }

    const result = await prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true },
    });
    if (result.count === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy thông báo' });
    }
    return res.status(200).json({ success: true, message: 'Đã đánh dấu thông báo đã đọc' });
  } catch (error) {
    console.error('Mark notification read error:', error);
    return res.status(500).json({ success: false, message: 'Không thể cập nhật thông báo' });
  }
};

export const markAllNotificationsRead = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const result = await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return res.status(200).json({
      success: true,
      message: 'Đã đánh dấu tất cả thông báo đã đọc',
      data: { updatedCount: result.count },
    });
  } catch (error) {
    console.error('Mark all notifications read error:', error);
    return res.status(500).json({ success: false, message: 'Không thể cập nhật thông báo' });
  }
};

export const createAnnouncement = async (req: AuthRequest, res: Response) => {
  try {
    const { title, message, userId: targetUserId } = req.body ?? {};
    if (typeof title !== 'string' || !title.trim() || title.trim().length > 200 ||
        typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ success: false, message: 'title (tối đa 200 ký tự) và message là bắt buộc' });
    }

    if (targetUserId !== undefined && targetUserId !== null) {
      const parsedUserId = Number(targetUserId);
      if (!Number.isSafeInteger(parsedUserId) || parsedUserId <= 0) {
        return res.status(400).json({ success: false, message: 'userId không hợp lệ' });
      }
      const user = await prisma.user.findUnique({ where: { id: parsedUserId }, select: { id: true } });
      if (!user) return res.status(404).json({ success: false, message: 'Không tìm thấy người nhận' });
      const notification = await prisma.notification.create({
        data: { userId: user.id, title: title.trim(), message: message.trim() },
      });
      return res.status(201).json({ success: true, data: notification });
    }

    const recipients = await prisma.user.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true },
    });
    if (recipients.length === 0) {
      return res.status(200).json({ success: true, message: 'Không có tài khoản ACTIVE để gửi', data: { sentCount: 0 } });
    }
    const result = await prisma.notification.createMany({
      data: recipients.map(({ id }) => ({
        userId: id,
        title: title.trim(),
        message: message.trim(),
      })),
    });
    return res.status(201).json({
      success: true,
      message: 'Đã gửi thông báo',
      data: { sentCount: result.count },
    });
  } catch (error) {
    console.error('Create announcement error:', error);
    return res.status(500).json({ success: false, message: 'Không thể gửi thông báo' });
  }
};
