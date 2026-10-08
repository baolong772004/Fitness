import type { Server as HttpServer } from 'http';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';
import { getPtChatAccess, PtChatError } from '../services/ptChat.service.js';

const prisma = new PrismaClient();
let chatIo: Server | null = null;

export const ptChatRoom = (bookingId: number) => `pt-booking:${bookingId}`;

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
    socket.on('booking:join', async (bookingId: unknown, acknowledge?: (result: { ok: boolean; error?: string }) => void) => {
      try {
        const id = Number(bookingId);
        await getPtChatAccess(id, socket.data.userId);
        await socket.join(ptChatRoom(id));
        acknowledge?.({ ok: true });
      } catch (error) {
        acknowledge?.({
          ok: false,
          error: error instanceof PtChatError ? error.message : 'Không thể mở cuộc trò chuyện.',
        });
      }
    });

    socket.on('booking:leave', (bookingId: unknown) => {
      const id = Number(bookingId);
      if (Number.isSafeInteger(id) && id > 0) socket.leave(ptChatRoom(id));
    });
  });

  return io;
}

export function emitPtChatMessage(bookingId: number, message: unknown) {
  chatIo?.to(ptChatRoom(bookingId)).emit('message:new', message);
}

export function closePtChatRoom(bookingId: number) {
  const room = ptChatRoom(bookingId);
  chatIo?.to(room).emit('booking:chat-closed', { bookingId });
  chatIo?.in(room).socketsLeave(room);
}
