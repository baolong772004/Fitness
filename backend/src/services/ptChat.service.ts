import prisma from '../config/prisma.js';



export class PtChatError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const readableStatuses = ['CONFIRMED', 'IN_PROGRESS'];
const completedMessage = 'Lịch PT đã hoàn thành, cuộc trò chuyện đã đóng.';

export async function getPtChatAccess(bookingId: number, userId: number) {
  if (!Number.isSafeInteger(bookingId) || bookingId <= 0) {
    throw new PtChatError(400, 'Mã lịch tập không hợp lệ.');
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { status: true },
  });
  if (!user || user.status !== 'ACTIVE') {
    throw new PtChatError(403, 'Tài khoản không còn hoạt động.');
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      type: true,
      memberId: true,
      coachId: true,
      status: true,
      endTime: true,
    },
  });
  if (!booking || booking.type !== 'PT') {
    throw new PtChatError(404, 'Không tìm thấy lịch tập PT.');
  }
  if (booking.memberId !== userId && booking.coachId !== userId) {
    throw new PtChatError(403, 'Bạn không thuộc lịch tập này.');
  }
  if (booking.status === 'COMPLETED') {
    throw new PtChatError(403, completedMessage);
  }
  if (!readableStatuses.includes(booking.status)) {
    throw new PtChatError(403, 'Chỉ có thể nhắn tin khi lịch PT đã được xác nhận.');
  }

  const canSend = ['CONFIRMED', 'IN_PROGRESS'].includes(booking.status) &&
    Date.now() < booking.endTime.getTime();
  return { booking, canSend };
}

export async function getPtChatMessages(bookingId: number, beforeId?: number, afterId?: number, limit = 30) {
  const loadingNewer = afterId !== undefined;
  const rows = await prisma.ptChatMessage.findMany({
    where: {
      bookingId,
      ...(beforeId ? { id: { lt: beforeId } } : {}),
      ...(afterId ? { id: { gt: afterId } } : {}),
    },
    orderBy: { id: loadingNewer ? 'asc' : 'desc' },
    take: limit + 1,
    include: { sender: { select: { id: true, fullName: true } } },
  });
  const hasMore = rows.length > limit;
  if (hasMore) rows.pop();
  return { messages: loadingNewer ? rows : rows.reverse(), hasMore };
}

export async function createPtChatMessage(bookingId: number, senderId: number, content: string) {
  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      select: { memberId: true, coachId: true, status: true, endTime: true },
    });
    if (!booking || (booking.memberId !== senderId && booking.coachId !== senderId)) {
      throw new PtChatError(403, 'Bạn không thuộc lịch tập này.');
    }
    if (booking.status === 'COMPLETED') {
      throw new PtChatError(403, completedMessage);
    }
    if (!readableStatuses.includes(booking.status) ||
        Date.now() >= booking.endTime.getTime()) {
      throw new PtChatError(403, 'Cuộc trò chuyện đã đóng sau giờ tập.');
    }
    return tx.ptChatMessage.create({
      data: { bookingId, senderId, content },
      include: { sender: { select: { id: true, fullName: true } } },
    });
  }, { isolationLevel: 'Serializable' });
}
