import type { Response } from 'express';
import type { AuthRequest } from '../middlewares/auth.middleware.js';
import { createUserNotification } from '../services/notification.service.js';
import {
  createPtChatMessage,
  getPtChatAccess,
  getPtChatMessages,
  PtChatError,
} from '../services/ptChat.service.js';
import { emitPtChatMessage } from '../sockets/ptChat.socket.js';

function handleError(res: Response, error: unknown) {
  if (error instanceof PtChatError) {
    return res.status(error.status).json({ success: false, message: error.message });
  }
  console.error('PT chat error:', error);
  return res.status(500).json({ success: false, message: 'Không thể xử lý tin nhắn PT.' });
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
    const result = await getPtChatMessages(bookingId, beforeId, afterId, limit);
    return res.status(200).json({ success: true, data: result.messages, hasMore: result.hasMore, canSend: access.canSend });
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
      return res.status(403).json({ success: false, message: 'Cuộc trò chuyện đã đóng sau giờ tập.' });
    }
    if (typeof req.body?.content !== 'string') {
      return res.status(400).json({ success: false, message: 'Nội dung tin nhắn không hợp lệ.' });
    }
    const content = req.body.content.trim();
    if (!content || content.length > 1000) {
      return res.status(400).json({ success: false, message: 'Tin nhắn cần từ 1 đến 1000 ký tự.' });
    }

    const message = await createPtChatMessage(bookingId, userId, content);
    emitPtChatMessage(bookingId, message);
    const recipientId = userId === access.booking.memberId
      ? access.booking.coachId
      : access.booking.memberId;
    if (recipientId) {
      await createUserNotification({
        userId: recipientId,
        title: `Tin nhắn mới từ ${message.sender.fullName}`,
        message: `Lịch PT #${bookingId}: ${content.length > 100 ? `${content.slice(0, 100)}…` : content}`,
      });
    }
    return res.status(201).json({ success: true, data: message });
  } catch (error) {
    return handleError(res, error);
  }
}
