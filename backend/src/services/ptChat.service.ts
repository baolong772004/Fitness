import prisma from '../config/prisma.js';
import { isPaidPtSource } from './ptEntitlementPolicy.service.js';
import { MongoServerError, type Filter } from 'mongodb';
import {
  getCounterCollection,
  getMigrationCollection,
  getPtChatCollection,
  isMongoDBReady,
  type PtChatMessageDocument,
} from '../config/mongo.js';

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

  const collection = getPtChatCollection();
  const counter = getCounterCollection();
  const latestImported = await collection.findOne(
    { legacySqlId: { $exists: true } },
    { sort: { legacySqlId: -1 }, projection: { legacySqlId: 1 } },
  );
  const latestMessage = await collection.findOne({}, { sort: { id: -1 }, projection: { id: 1 } });
  let lastId = latestImported?.legacySqlId ?? 0;
  let migratedCount = 0;

  await counter.updateOne(
    { _id: 'pt-chat-message-id' },
    { $max: { seq: latestMessage?.id ?? 0 } },
    { upsert: true },
  );

  while (true) {
    const legacyMessages = await prisma.ptChatMessage.findMany({
      where: { id: { gt: lastId } },
      orderBy: { id: 'asc' },
      take: 500,
    });
    if (legacyMessages.length === 0) break;

    for (const message of legacyMessages) {
      const nextId = await counter.findOneAndUpdate(
        { _id: 'pt-chat-message-id' },
        { $inc: { seq: 1 } },
        { upsert: true, returnDocument: 'after' },
      );
      if (!nextId) throw new Error('Không tạo được mã tin nhắn PT để chuyển dữ liệu.');
      try {
        const result = await collection.updateOne(
          { legacySqlId: message.id },
          { $setOnInsert: {
            id: nextId.seq,
            bookingId: message.bookingId,
            senderId: message.senderId,
            content: message.content,
            createdAt: message.createdAt,
            legacySqlId: message.id,
          } },
          { upsert: true },
        );
        migratedCount += result.upsertedCount;
      } catch (error) {
        if (!(error instanceof MongoServerError && error.code === 11000 &&
          await collection.findOne({ legacySqlId: message.id }, { projection: { _id: 1 } }))) throw error;
      }
    }

    lastId = legacyMessages[legacyMessages.length - 1].id;
  }

  if (migratedCount) {
    await getMigrationCollection().updateOne(
      { _id: 'pt-chat-sql-messages-v1' },
      { $set: { completedAt: new Date(), lastImportedSqlId: lastId }, $inc: { migratedCount } },
      { upsert: true },
    );
    console.log(`Imported ${migratedCount} legacy PT chat messages into MongoDB.`);
  }
}

export type PtChatPermission = {
  canSend: boolean;
  canView: boolean;
  chatType: 'PAID' | 'TRIAL' | 'EXPIRED' | 'NONE';
  reason: string;
  memberId: number;
  coachId: number;
};

export async function checkPtChatPermission(
  memberId: number,
  coachId: number,
  currentUserId: number,
): Promise<PtChatPermission> {
  if (currentUserId !== memberId && currentUserId !== coachId) {
    const staff = await prisma.user.findUnique({
      where: { id: currentUserId },
      select: { role: true, status: true },
    });
    if (!staff || staff.status !== 'ACTIVE' || !['ADMIN', 'STAFF'].includes(staff.role)) {
      throw new PtChatError(403, 'Bạn không thuộc cuộc trò chuyện này.');
    }
  }

  const [member, coach] = await Promise.all([
    prisma.user.findUnique({ where: { id: memberId }, select: { id: true, status: true } }),
    prisma.user.findUnique({ where: { id: coachId }, select: { id: true, status: true } }),
  ]);

  if (!member || member.status !== 'ACTIVE') {
    throw new PtChatError(403, 'Tài khoản hội viên không còn hoạt động.');
  }
  if (!coach || coach.status !== 'ACTIVE') {
    throw new PtChatError(403, 'Tài khoản huấn luyện viên không còn hoạt động.');
  }

  const now = new Date();

  // 1. PT Paid eligibility (BR-04, BR-05, BR-06)
  const paidBatches = await prisma.ptCreditBatch.findMany({
    where: {
      wallet: { memberId },
      coachId: coachId,
      source: { in: ['PACKAGE_PURCHASE', 'SINGLE_PURCHASE', 'ADMIN_ADJUSTMENT', 'LEGACY_MIGRATION'] },
    },
    select: {
      id: true,
      initialCount: true,
      usedCount: true,
      startAt: true,
      endAt: true,
    },
  });

  const hasLivePaidBatch = paidBatches.some((batch) => {
    const hasRemaining = batch.initialCount > batch.usedCount;
    const isStarted = !batch.startAt || batch.startAt <= now;
    const notExpired = !batch.endAt || batch.endAt > now;
    return hasRemaining && isStarted && notExpired;
  });

  const livePtMembership = await prisma.membership.findFirst({
    where: {
      userId: memberId,
      coachId: coachId,
      status: 'ACTIVE',
      endDate: { gt: now },
      package: { type: 'PT' },
      remainingSessions: { gt: 0 },
    },
    select: { id: true },
  });

  const hasValidPaid = hasLivePaidBatch || Boolean(livePtMembership);

  // 2. PT Trial eligibility (BR-02, BR-03, BR-08)
  const trialCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const trialBookings = await prisma.booking.findMany({
    where: {
      type: 'PT',
      memberId,
      coachId,
      OR: [
        { ptCreditAllocation: { batch: { source: 'MEMBERSHIP_GIFT' } } },
        { ptCreditAllocation: { batch: { level: 'TRIAL' } } },
        { membership: { package: { type: 'GYM' } } },
      ],
    },
    select: {
      id: true,
      status: true,
      startTime: true,
      endTime: true,
    },
  });

  const hasValidTrial = trialBookings.some((booking) => {
    if (booking.status === 'CONFIRMED' || booking.status === 'IN_PROGRESS') {
      return true;
    }
    if (booking.status === 'COMPLETED' && booking.endTime && booking.endTime >= trialCutoff) {
      return true;
    }
    return false;
  });

  // History presence check (BR-07)
  const [historyBookingCount, historyBatchCount] = await Promise.all([
    prisma.booking.count({ where: { type: 'PT', memberId, coachId } }),
    prisma.ptCreditBatch.count({ where: { wallet: { memberId }, coachId } }),
  ]);
  const hasRelationship = historyBookingCount > 0 || historyBatchCount > 0 || paidBatches.length > 0;

  if (hasValidPaid) {
    return {
      canSend: true,
      canView: true,
      chatType: 'PAID',
      reason: 'Gói PT Paid đang hoạt động',
      memberId,
      coachId,
    };
  }

  if (hasValidTrial) {
    return {
      canSend: true,
      canView: true,
      chatType: 'TRIAL',
      reason: 'Buổi tập Trial (mở từ khi xác nhận đến 24h sau khi hoàn thành)',
      memberId,
      coachId,
    };
  }

  if (hasRelationship) {
    return {
      canSend: false,
      canView: true,
      chatType: 'EXPIRED',
      reason: 'Cuộc trò chuyện ở chế độ chỉ đọc. Buổi Trial đã kết thúc quá 24h hoặc gói PT đã hết hạn/hết số buổi.',
      memberId,
      coachId,
    };
  }

  return {
    canSend: false,
    canView: false,
    chatType: 'NONE',
    reason: 'Chưa có quan hệ PT hợp lệ giữa học viên và HLV.',
    memberId,
    coachId,
  };
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
  if (!booking.coachId) throw new PtChatError(404, 'Lịch PT chưa có Coach.');

  const pair = { memberId: booking.memberId, coachId: booking.coachId };
  const permission = await checkPtChatPermission(pair.memberId, pair.coachId, userId);

  const history = await prisma.booking.findMany({
    where: { type: 'PT', ...pair },
    select: { id: true },
  });

  return {
    booking,
    pair,
    bookingIds: history.map((item) => item.id),
    canSend: permission.canSend,
    chatType: permission.chatType,
    reason: permission.reason,
  };
}

export async function getPtChatConversations(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, status: true },
  });
  if (!user || user.status !== 'ACTIVE') {
    throw new PtChatError(403, 'Tài khoản không còn hoạt động.');
  }

  const isCoach = ['COACH', 'TRAINER'].includes(user.role);
  const pairsMap = new Map<string, { memberId: number; coachId: number }>();

  if (isCoach) {
    const [batches, bookings, memberships] = await Promise.all([
      prisma.ptCreditBatch.findMany({
        where: { coachId: userId },
        select: { wallet: { select: { memberId: true } } },
      }),
      prisma.booking.findMany({
        where: { type: 'PT', coachId: userId },
        select: { memberId: true },
      }),
      prisma.membership.findMany({
        where: { coachId: userId, package: { type: 'PT' } },
        select: { userId: true },
      }),
    ]);

    for (const b of batches) {
      if (b.wallet?.memberId) {
        pairsMap.set(`${b.wallet.memberId}:${userId}`, { memberId: b.wallet.memberId, coachId: userId });
      }
    }
    for (const b of bookings) {
      pairsMap.set(`${b.memberId}:${userId}`, { memberId: b.memberId, coachId: userId });
    }
    for (const m of memberships) {
      pairsMap.set(`${m.userId}:${userId}`, { memberId: m.userId, coachId: userId });
    }
  } else {
    const [batches, bookings, memberships] = await Promise.all([
      prisma.ptCreditBatch.findMany({
        where: { wallet: { memberId: userId }, coachId: { not: null } },
        select: { coachId: true },
      }),
      prisma.booking.findMany({
        where: { type: 'PT', memberId: userId, coachId: { not: null } },
        select: { coachId: true },
      }),
      prisma.membership.findMany({
        where: { userId: userId, coachId: { not: null }, package: { type: 'PT' } },
        select: { coachId: true },
      }),
    ]);

    for (const b of batches) {
      if (b.coachId) pairsMap.set(`${userId}:${b.coachId}`, { memberId: userId, coachId: b.coachId });
    }
    for (const b of bookings) {
      if (b.coachId) pairsMap.set(`${userId}:${b.coachId}`, { memberId: userId, coachId: b.coachId });
    }
    for (const m of memberships) {
      if (m.coachId) pairsMap.set(`${userId}:${m.coachId}`, { memberId: userId, coachId: m.coachId });
    }
  }

  if (isMongoDBReady()) {
    try {
      const mongo = getPtChatCollection();
      const distinctKeys = await mongo.distinct('pairKey', isCoach ? { coachId: userId } : { memberId: userId });
      for (const key of distinctKeys) {
        if (typeof key === 'string' && key.includes(':')) {
          const [mId, cId] = key.split(':').map(Number);
          if (mId && cId) pairsMap.set(`${mId}:${cId}`, { memberId: mId, coachId: cId });
        }
      }
    } catch { /* Mongo optional */ }
  }

  const pairs = Array.from(pairsMap.values());
  if (pairs.length === 0) return [];

  const partnerUserIds = pairs.map((p) => (isCoach ? p.memberId : p.coachId));
  const partnerUsers = await prisma.user.findMany({
    where: { id: { in: partnerUserIds } },
    select: { id: true, fullName: true, role: true, phone: true, avatar: true },
  });
  const partnerMap = new Map(partnerUsers.map((u) => [u.id, u]));

  const conversations = await Promise.all(
    pairs.map(async ({ memberId, coachId }) => {
      const partnerId = isCoach ? memberId : coachId;
      const partner = partnerMap.get(partnerId) || {
        id: partnerId,
        fullName: isCoach ? 'Hội viên' : 'Huấn luyện viên',
        role: isCoach ? 'MEMBER' : 'COACH',
      };

      const permission = await checkPtChatPermission(memberId, coachId, userId).catch(() => ({
        canSend: false,
        canView: false,
        chatType: 'NONE' as const,
        reason: 'Không có quyền truy cập.',
        memberId,
        coachId,
      }));

      const latestBooking = await prisma.booking.findFirst({
        where: { type: 'PT', memberId, coachId },
        orderBy: { startTime: 'desc' },
        select: { id: true, startTime: true, status: true },
      });

      let lastMessage: { id: number; content: string; createdAt: Date; senderId: number; readAt?: Date | null } | null = null;
      let unreadCount = 0;

      if (isMongoDBReady()) {
        try {
          const mongo = getPtChatCollection();
          const filter: Filter<PtChatMessageDocument> = {
            $or: [
              { pairKey: `${memberId}:${coachId}` },
              { memberId, coachId },
              ...(latestBooking ? [{ bookingId: latestBooking.id }] : []),
            ],
          };
          const lastDoc = await mongo.findOne(filter, { sort: { id: -1 } });
          if (lastDoc) {
            lastMessage = {
              id: lastDoc.id,
              content: lastDoc.content,
              createdAt: lastDoc.createdAt,
              senderId: lastDoc.senderId,
              readAt: lastDoc.readAt || null,
            };
          }
          unreadCount = await mongo.countDocuments({
            ...filter,
            senderId: { $ne: userId },
            readAt: { $exists: false },
          });
        } catch { /* Mongo optional */ }
      }

      return {
        key: `${memberId}:${coachId}`,
        memberId,
        coachId,
        partner,
        canSend: permission.canSend,
        canView: permission.canView,
        chatType: permission.chatType,
        reason: permission.reason,
        latestBookingId: latestBooking?.id || null,
        latestBookingTime: latestBooking?.startTime || null,
        lastMessage,
        unreadCount,
      };
    }),
  );

  return conversations
    .filter((c) => c.chatType !== 'NONE')
    .sort((a, b) => {
      const timeA = a.lastMessage?.createdAt
        ? new Date(a.lastMessage.createdAt).getTime()
        : a.latestBookingTime
        ? new Date(a.latestBookingTime).getTime()
        : 0;
      const timeB = b.lastMessage?.createdAt
        ? new Date(b.lastMessage.createdAt).getTime()
        : b.latestBookingTime
        ? new Date(b.latestBookingTime).getTime()
        : 0;
      return timeB - timeA;
    });
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

export async function getPtPairMessages(
  memberId: number,
  coachId: number,
  userId: number,
  beforeId?: number,
  afterId?: number,
  limit = 30,
) {
  const permission = await checkPtChatPermission(memberId, coachId, userId);
  if (!permission.canView) {
    throw new PtChatError(403, permission.reason);
  }

  const bookings = await prisma.booking.findMany({
    where: { type: 'PT', memberId, coachId },
    select: { id: true },
  });
  const bookingIds = bookings.map((b) => b.id);

  const filter: Filter<PtChatMessageDocument> = {
    $or: [
      { pairKey: `${memberId}:${coachId}` },
      { memberId, coachId },
      ...(bookingIds.length > 0 ? [{ bookingId: { $in: bookingIds } }] : []),
    ],
  };

  const loadingNewer = afterId !== undefined;
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

  return {
    messages,
    hasMore,
    readIds: unreadIds,
    canSend: permission.canSend,
    chatType: permission.chatType,
    reason: permission.reason,
  };
}

export async function createPtPairChatMessage(
  memberId: number,
  coachId: number,
  senderId: number,
  content: string,
  explicitBookingId?: number,
) {
  const permission = await checkPtChatPermission(memberId, coachId, senderId);
  if (!permission.canSend) {
    throw new PtChatError(403, permission.reason);
  }

  const sender = await prisma.user.findUnique({
    where: { id: senderId },
    select: { id: true, fullName: true },
  });
  if (!sender) throw new PtChatError(403, 'Tài khoản không còn hoạt động.');

  let bookingId = explicitBookingId;
  if (!bookingId) {
    const latestBooking = await prisma.booking.findFirst({
      where: { type: 'PT', memberId, coachId },
      orderBy: { startTime: 'desc' },
      select: { id: true },
    });
    bookingId = latestBooking?.id || 0;
  }

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
    memberId,
    coachId,
    pairKey: `${memberId}:${coachId}`,
    senderId,
    content,
    createdAt: new Date(),
  };

  await requireMongoMessageCollection().insertOne({ ...message });
  return { ...message, sender };
}

export async function createPtChatMessage(bookingId: number, senderId: number, content: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { memberId: true, coachId: true },
  });
  if (!booking || !booking.coachId) {
    throw new PtChatError(404, 'Không tìm thấy lịch tập PT.');
  }

  return createPtPairChatMessage(booking.memberId, booking.coachId, senderId, content, bookingId);
}
