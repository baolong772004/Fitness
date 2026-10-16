import type { Server as HttpServer } from 'http';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import { getPtChatAccess, PtChatError } from '../services/ptChat.service.js';

const prisma = new PrismaClient();
let chatIo: Server | null = null;

export const ptChatRoom = (memberId: number, coachId: number) => `pt-pair:${memberId}:${coachId}`;

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
    socket.on('coach:watch', (coachId: unknown) => {
      const id = Number(coachId);
      if (Number.isSafeInteger(id) && id > 0) socket.join(`coach-schedule:${id}`);
    });
    socket.on('coach:unwatch', (coachId: unknown) => {
      const id = Number(coachId);
      if (Number.isSafeInteger(id) && id > 0) socket.leave(`coach-schedule:${id}`);
    });
    socket.on('booking:join', async (bookingId: unknown, acknowledge?: (result: { ok: boolean; error?: string }) => void) => {
      try {
        const id = Number(bookingId);
        const access = await getPtChatAccess(id, socket.data.userId);
        await socket.join(ptChatRoom(access.pair.memberId, access.pair.coachId));
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
      try {
        const access = await getPtChatAccess(id, socket.data.userId);
        socket.leave(ptChatRoom(access.pair.memberId, access.pair.coachId));
      } catch { /* The socket disconnects when the screen closes. */ }
    });
  });

  return io;
}

export function emitPtChatMessage(memberId: number, coachId: number, message: unknown) {
  chatIo?.to(ptChatRoom(memberId, coachId)).emit('message:new', message);
}

export function emitPtChatRead(memberId: number, coachId: number, ids: number[], readAt: Date) {
  chatIo?.to(ptChatRoom(memberId, coachId)).emit('message:read', { ids, readAt });
}

export function emitUserNotification(userId: number, notification: unknown) {
  chatIo?.to(`user:${userId}`).emit('notification:new', notification);
}

export function emitCoachScheduleChanged(coachId: number) {
  chatIo?.to(`coach-schedule:${coachId}`).emit('coach:schedule-changed', { coachId });
}
