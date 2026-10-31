import type { Server as HttpServer } from 'http';
import prisma from '../config/prisma.js';
import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import { checkPtChatPermission, getPtChatAccess, PtChatError } from '../services/ptChat.service.js';


let chatIo: Server | null = null;

export const ptChatRoom = (bookingId: number) => `pt-booking:${bookingId}`;
const ptChatPairRoom = (memberId: number, coachId: number) => `pt-pair:${memberId}:${coachId}`;

export function configurePtChatSocket(httpServer: HttpServer) {
  const io = new Server(httpServer, { cors: { origin: '*' } });
  chatIo = io;

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (typeof token !== 'string' || !token) throw new Error('Thiếu token đăng nhập.');
      const payload = jwt.verify(token, process.env.JWT_SECRET || 'default_secret') as { userId?: number };
      if (!Number.isSafeInteger(payload.userId) || !payload.userId) throw new Error('Token không hợp lệ.');
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { id: true, status: true },
      });
      if (!user || user.status !== 'ACTIVE') throw new Error('Tài khoản không còn hoạt động.');
      socket.data.userId = user.id;
      next();
    } catch {
      next(new Error('Phiên đăng nhập không hợp lệ.'));
    }
  });

  io.on('connection', (socket) => {
    void socket.join(`user:${socket.data.userId}`);
    socket.on('booking:join', async (bookingId: unknown, acknowledge?: (result: { ok: boolean; error?: string }) => void) => {
      try {
        const id = Number(bookingId);
        const access = await getPtChatAccess(id, socket.data.userId);
        await socket.join(ptChatRoom(id));
        await socket.join(ptChatPairRoom(access.pair.memberId, access.pair.coachId));
        acknowledge?.({ ok: true });
      } catch (error) {
        acknowledge?.({
          ok: false,
          error: error instanceof PtChatError ? error.message : 'Không thể mở cuộc trò chuyện.',
        });
      }
    });

    socket.on('booking:leave', async (bookingId: unknown) => {
      const id = Number(bookingId);
      if (!Number.isSafeInteger(id) || id <= 0) return;
      socket.leave(ptChatRoom(id));
      try {
        const access = await getPtChatAccess(id, socket.data.userId);
        socket.leave(ptChatPairRoom(access.pair.memberId, access.pair.coachId));
      } catch { /* Disconnect also clears joined rooms. */ }
    });

    socket.on('pair:join', async (data: unknown, acknowledge?: (result: { ok: boolean; error?: string }) => void) => {
      try {
        const payload = data as { memberId?: number; coachId?: number };
        const memberId = Number(payload?.memberId);
        const coachId = Number(payload?.coachId);
        if (!memberId || !coachId) throw new PtChatError(400, 'Thiếu thông tin cặp chat.');
        const permission = await checkPtChatPermission(memberId, coachId, socket.data.userId);
        if (!permission.canView) throw new PtChatError(403, permission.reason);
        await socket.join(ptChatPairRoom(memberId, coachId));
        acknowledge?.({ ok: true });
      } catch (error) {
        acknowledge?.({
          ok: false,
          error: error instanceof PtChatError ? error.message : 'Không thể mở cuộc trò chuyện.',
        });
      }
    });

    socket.on('pair:leave', (data: unknown) => {
      const payload = data as { memberId?: number; coachId?: number };
      const memberId = Number(payload?.memberId);
      const coachId = Number(payload?.coachId);
      if (memberId && coachId) {
        socket.leave(ptChatPairRoom(memberId, coachId));
      }
    });
  });

  return io;
}

export function emitPtChatMessage(memberId: number, coachId: number, message: unknown) {
  chatIo?.to(ptChatPairRoom(memberId, coachId)).emit('message:new', message);
}

export function emitPtChatRead(memberId: number, coachId: number, ids: number[], readAt: Date) {
  chatIo?.to(ptChatPairRoom(memberId, coachId)).emit('message:read', { ids, readAt });
}

export function emitCoachScheduleChanged(coachId: number) {
  chatIo?.emit('coach:schedule-changed', { coachId });
}

export function emitUserNotification(userId: number, notification: unknown) {
  chatIo?.to(`user:${userId}`).emit('notification:new', notification);
}

export function closePtChatRoom(bookingId: number) {
  const room = ptChatRoom(bookingId);
  chatIo?.to(room).emit('booking:chat-closed', { bookingId });
  chatIo?.in(room).socketsLeave(room);
}
