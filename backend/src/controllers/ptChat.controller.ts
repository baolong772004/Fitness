import type { Response } from 'express';
import type { AuthRequest } from '../middlewares/auth.middleware.js';
import { createUserNotification } from '../services/notification.service.js';
import {
  checkPtChatPermission,
  createPtChatMessage,
  createPtPairChatMessage,
  getPtChatAccess,
  getPtChatConversations,
  getPtChatMessages,
  getPtPairMessages,
  PtChatError,
} from '../services/ptChat.service.js';
import { emitPtChatMessage, emitPtChatRead } from '../sockets/ptChat.socket.js';
import prisma from '../config/prisma.js';

function handleError(res: Response, error: unknown) {
  if (error instanceof PtChatError) {
    return res.status(error.status).json({ success: false, message: error.message });
  }
  console.error('PT chat error:', error);
  return res.status(500).json({ success: false, message: 'Không thể xử lý tin nhắn PT.' });
}

export async function listPtConversations(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, message: 'Chưa đăng nhập.' });
    const conversations = await getPtChatConversations(userId);
    return res.status(200).json({ success: true, data: conversations });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function listPairChatMessages(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, message: 'Chưa đăng nhập.' });
    const partnerId = Number(req.params.partnerId);
    if (!Number.isSafeInteger(partnerId) || partnerId <= 0) {
      return res.status(400).json({ success: false, message: 'Mã đối tác không hợp lệ.' });
    }

    const partner = await prisma.user.findUnique({
      where: { id: partnerId },
      select: { role: true },
    });
    if (!partner) return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });

    const isCoachPartner = ['COACH', 'TRAINER'].includes(partner.role);
    const memberId = isCoachPartner ? userId : partnerId;
    const coachId = isCoachPartner ? partnerId : userId;

    const beforeId = req.query.beforeId === undefined ? undefined : Number(req.query.beforeId);
    const afterId = req.query.afterId === undefined ? undefined : Number(req.query.afterId);
    const requestedLimit = Number(req.query.limit ?? 30);
    const limit = Number.isSafeInteger(requestedLimit) && requestedLimit > 0
      ? Math.min(requestedLimit, 50)
      : 30;

    const result = await getPtPairMessages(memberId, coachId, userId, beforeId, afterId, limit);
    if (result.readIds.length) emitPtChatRead(memberId, coachId, result.readIds, new Date());

    return res.status(200).json({
      success: true,
      data: result.messages,
      hasMore: result.hasMore,
      canSend: result.canSend,
      chatType: result.chatType,
      reason: result.reason,
    });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function sendPairChatMessage(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, message: 'Chưa đăng nhập.' });
    const partnerId = Number(req.params.partnerId);
    if (!Number.isSafeInteger(partnerId) || partnerId <= 0) {
      return res.status(400).json({ success: false, message: 'Mã đối tác không hợp lệ.' });
    }

    const partner = await prisma.user.findUnique({
      where: { id: partnerId },
      select: { role: true },
    });
    if (!partner) return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng.' });

    const isCoachPartner = ['COACH', 'TRAINER'].includes(partner.role);
    const memberId = isCoachPartner ? userId : partnerId;
    const coachId = isCoachPartner ? partnerId : userId;

    if (typeof req.body?.content !== 'string') {
      return res.status(400).json({ success: false, message: 'Nội dung tin nhắn không hợp lệ.' });
    }
    const content = req.body.content.trim();
    if (!content || content.length > 1000) {
      return res.status(400).json({ success: false, message: 'Tin nhắn cần từ 1 đến 1000 ký tự.' });
    }

    const explicitBookingId = req.body?.bookingId ? Number(req.body.bookingId) : undefined;
    const message = await createPtPairChatMessage(memberId, coachId, userId, content, explicitBookingId);
    emitPtChatMessage(memberId, coachId, message);

    await createUserNotification({
      userId: partnerId,
      title: `Tin nhắn mới từ ${message.sender.fullName}`,
      message: content.length > 100 ? `${content.slice(0, 100)}…` : content,
    });

    return res.status(201).json({ success: true, data: message });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function listPtChatMessages(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, message: 'Chưa đăng nhập.' });
    const bookingId = Number(req.params.id);
    const access = await getPtChatAccess(bookingId, userId);
    const beforeId = req.query.beforeId === undefined ? undefined : Number(req.query.beforeId);
    const afterId = req.query.afterId === undefined ? undefined : Number(req.query.afterId);
    if (beforeId !== undefined && (!Number.isSafeInteger(beforeId) || beforeId <= 0)) {
      return res.status(400).json({ success: false, message: 'beforeId không hợp lệ.' });
    }
    if (afterId !== undefined && (!Number.isSafeInteger(afterId) || afterId <= 0)) {
      return res.status(400).json({ success: false, message: 'afterId không hợp lệ.' });
    }
    if (beforeId !== undefined && afterId !== undefined) {
      return res.status(400).json({ success: false, message: 'Chỉ dùng beforeId hoặc afterId.' });
    }
    const requestedLimit = Number(req.query.limit ?? 30);
    const limit = Number.isSafeInteger(requestedLimit) && requestedLimit > 0
      ? Math.min(requestedLimit, 50)
      : 30;
    const result = await getPtPairMessages(access.pair.memberId, access.pair.coachId, userId, beforeId, afterId, limit);
    if (result.readIds.length) emitPtChatRead(access.pair.memberId, access.pair.coachId, result.readIds, new Date());
    return res.status(200).json({
      success: true,
      data: result.messages,
      hasMore: result.hasMore,
      canSend: access.canSend,
      chatType: access.chatType,
      reason: access.reason,
    });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function sendPtChatMessage(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, message: 'Chưa đăng nhập.' });
    const bookingId = Number(req.params.id);
    const access = await getPtChatAccess(bookingId, userId);
    if (!access.canSend) {
      return res.status(403).json({ success: false, message: access.reason || 'Cuộc trò chuyện đã đóng sau giờ tập.' });
    }
    if (typeof req.body?.content !== 'string') {
      return res.status(400).json({ success: false, message: 'Nội dung tin nhắn không hợp lệ.' });
    }
    const content = req.body.content.trim();
    if (!content || content.length > 1000) {
      return res.status(400).json({ success: false, message: 'Tin nhắn cần từ 1 đến 1000 ký tự.' });
    }

    const message = await createPtChatMessage(bookingId, userId, content);
    emitPtChatMessage(access.pair.memberId, access.pair.coachId, message);
    const recipientId = userId === access.booking.memberId
      ? access.booking.coachId
      : access.booking.memberId;
    if (recipientId) {
      await createUserNotification({
        userId: recipientId,
        title: `Tin nhắn mới từ ${message.sender.fullName}`,
        message: content.length > 100 ? `${content.slice(0, 100)}…` : content,
      });
    }
    return res.status(201).json({ success: true, data: message });
  } catch (error) {
    return handleError(res, error);
  }
}
