import { PrismaClient } from '@prisma/client';
import type { Filter } from 'mongodb';
import {
  getCounterCollection,
  getMigrationCollection,
  getPtChatCollection,
  isMongoDBReady,
  type PtChatMessageDocument,
} from '../config/mongo.js';

const prisma = new PrismaClient();

export class PtChatError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function requireMongoMessageCollection() {
  try {
    return getPtChatCollection();
  } catch {
    throw new PtChatError(503, 'Dịch vụ chat chưa kết nối MongoDB. Hãy cấu hình MONGODB_URI.');
  }
}

function requireMongoCounterCollection() {
  try {
    return getCounterCollection();
  } catch {
    throw new PtChatError(503, 'Dịch vụ chat chưa kết nối MongoDB. Hãy cấu hình MONGODB_URI.');
  }
}

export async function migrateLegacyPtChatMessages() {
  if (!isMongoDBReady()) return;

  const migrations = getMigrationCollection();
  const migrationId = 'pt-chat-sql-messages-v1';
  if (await migrations.findOne({ _id: migrationId })) return;

  const collection = getPtChatCollection();
  let lastId = 0;
  let migratedCount = 0;

  while (true) {
    const legacyMessages = await prisma.ptChatMessage.findMany({
      where: { id: { gt: lastId } },
      orderBy: { id: 'asc' },
      take: 500,
    });
    if (legacyMessages.length === 0) break;

    await collection.bulkWrite(legacyMessages.map((message) => ({
      updateOne: {
        filter: { legacySqlId: message.id },
        update: {
          $setOnInsert: {
            id: message.id,
            bookingId: message.bookingId,
            senderId: message.senderId,
            content: message.content,
            createdAt: message.createdAt,
            legacySqlId: message.id,
          },
        },
        upsert: true,
      },
    })), { ordered: false });

    lastId = legacyMessages[legacyMessages.length - 1].id;
    migratedCount += legacyMessages.length;
  }

  await getCounterCollection().updateOne(
    { _id: 'pt-chat-message-id' },
    { $max: { seq: lastId } },
    { upsert: true },
  );
  await migrations.insertOne({ _id: migrationId, completedAt: new Date(), migratedCount });
  console.log(`Imported ${migratedCount} legacy PT chat messages into MongoDB.`);
}

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
  if (!booking.coachId) throw new PtChatError(404, 'Lịch PT chưa có Coach.');
  const pair = { memberId: booking.memberId, coachId: booking.coachId };
  const history = await prisma.booking.findMany({
    where: { type: 'PT', ...pair }, select: { id: true, membershipId: true },
  });
  const now = new Date();
  const [liveBooking, liveMembership] = await Promise.all([
    prisma.booking.findFirst({ where: {
      type: 'PT', ...pair, status: { in: ['CONFIRMED', 'IN_PROGRESS'] }, endTime: { gt: now },
    }, select: { id: true } }),
    prisma.membership.findFirst({ where: {
      userId: booking.memberId, status: 'ACTIVE', endDate: { gt: now },
      OR: [
        { coachId: booking.coachId, package: { type: 'PT' } },
        { id: { in: history.flatMap((item) => item.membershipId === null ? [] : [item.membershipId]) }, package: { type: 'MEMBERSHIP' }, remainingSessions: { gt: 0 } },
      ],
    }, select: { id: true } }),
  ]);
  return { booking, pair, bookingIds: history.map((item) => item.id), canSend: !!(liveBooking || liveMembership) };
}

export async function getPtChatMessages(bookingIds: number[], userId: number, beforeId?: number, afterId?: number, limit = 30) {
  const loadingNewer = afterId !== undefined;
  const filter: Filter<PtChatMessageDocument> = { bookingId: { $in: bookingIds } };
  if (beforeId !== undefined) filter.id = { $lt: beforeId };
  if (afterId !== undefined) filter.id = { $gt: afterId };

  const rows = await requireMongoMessageCollection()
    .find(filter)
    .sort({ id: loadingNewer ? 1 : -1 })
    .limit(limit + 1)
    .toArray();
  const hasMore = rows.length > limit;
  if (hasMore) rows.pop();
  const orderedRows = loadingNewer ? rows : rows.reverse();
  const unreadIds = orderedRows.filter((row) => row.senderId !== userId && !row.readAt).map((row) => row.id);
  if (unreadIds.length) {
    const readAt = new Date();
    await requireMongoMessageCollection().updateMany({ id: { $in: unreadIds }, readAt: { $exists: false } }, { $set: { readAt } });
    for (const row of orderedRows) if (unreadIds.includes(row.id)) row.readAt = readAt;
  }
  const senderIds = [...new Set(orderedRows.map((row) => row.senderId))];
  const senders = senderIds.length > 0
    ? await prisma.user.findMany({ where: { id: { in: senderIds } }, select: { id: true, fullName: true } })
    : [];
  const senderById = new Map(senders.map((sender) => [sender.id, sender]));
  const messages = orderedRows.map((row) => ({
    id: row.id,
    bookingId: row.bookingId,
    senderId: row.senderId,
    content: row.content,
    createdAt: row.createdAt,
    readAt: row.readAt ?? null,
    sender: senderById.get(row.senderId) ?? { id: row.senderId, fullName: 'Người dùng' },
  }));
  return { messages, hasMore, readIds: unreadIds };
}

export async function createPtChatMessage(bookingId: number, senderId: number, content: string) {
  const { canSend } = await getPtChatAccess(bookingId, senderId);
  if (!canSend) throw new PtChatError(403, 'Quan hệ tập PT đã kết thúc; cuộc trò chuyện chỉ đọc.');

  const sender = await prisma.user.findUnique({
    where: { id: senderId },
    select: { id: true, fullName: true },
  });
  if (!sender) throw new PtChatError(403, 'Tài khoản không còn hoạt động.');

  const counter = requireMongoCounterCollection();
  const nextId = await counter.findOneAndUpdate(
    { _id: 'pt-chat-message-id' },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' },
  );
  if (!nextId) throw new Error('Không tạo được mã tin nhắn PT.');

  const message: PtChatMessageDocument = {
    id: nextId.seq,
    bookingId,
    senderId,
    content,
    createdAt: new Date(),
  };
  await requireMongoMessageCollection().insertOne({ ...message });
  return { ...message, sender };
}
