import { MongoClient, type Collection, type Document } from 'mongodb';

export interface PtChatMessageDocument extends Document {
  id: number;
  bookingId: number;
  senderId: number;
  content: string;
  createdAt: Date;
  readAt?: Date;
  legacySqlId?: number;
  pairKey?: string;
  memberId?: number;
  coachId?: number;
}

interface CounterDocument extends Document {
  _id: string;
  seq: number;
}

export class MongoStorageUnavailableError extends Error {
  constructor() {
    super('MongoDB chưa được cấu hình hoặc hiện không kết nối được.');
  }
}

let client: MongoClient | null = null;
let messageCollection: Collection<PtChatMessageDocument> | null = null;
let counterCollection: Collection<CounterDocument> | null = null;
let migrationCollection: Collection<Document & { _id: string }> | null = null;
let ready = false;

export async function connectMongoDB(): Promise<boolean> {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    console.warn('MONGODB_URI chưa được đặt; chức năng nhắn tin PT sẽ tạm không khả dụng.');
    return false;
  }

  const nextClient = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  try {
    await nextClient.connect();
    const dbName = process.env.MONGODB_DB?.trim();
    const db = nextClient.db(dbName || undefined);
    const nextMessageCollection = db.collection<PtChatMessageDocument>('pt_chat_messages');
    const nextCounterCollection = db.collection<CounterDocument>('counters');
    const nextMigrationCollection = db.collection<Document & { _id: string }>('app_migrations');

    await Promise.all([
      nextMessageCollection.createIndex({ id: 1 }, { unique: true }),
      nextMessageCollection.createIndex({ bookingId: 1, id: -1 }),
      nextMessageCollection.createIndex({ pairKey: 1, id: -1 }),
      nextMessageCollection.createIndex({ senderId: 1, id: -1 }),
      nextMessageCollection.createIndex({ legacySqlId: 1 }, { unique: true, sparse: true }),
    ]);

    client = nextClient;
    messageCollection = nextMessageCollection;
    counterCollection = nextCounterCollection;
    migrationCollection = nextMigrationCollection;
    ready = true;
    console.log('MongoDB connected; PT chat messages use MongoDB.');
    return true;
  } catch (error) {
    await nextClient.close().catch(() => undefined);
    console.error('MongoDB connection failed:', error instanceof Error ? error.message : error);
    return false;
  }
}

export function isMongoDBReady() {
  return ready;
}

export function getPtChatCollection() {
  if (!ready || !messageCollection) throw new MongoStorageUnavailableError();
  return messageCollection;
}

export function getCounterCollection() {
  if (!ready || !counterCollection) throw new MongoStorageUnavailableError();
  return counterCollection;
}

export function getMigrationCollection() {
  if (!ready || !migrationCollection) throw new MongoStorageUnavailableError();
  return migrationCollection;
}

export async function closeMongoDB() {
  ready = false;
  messageCollection = null;
  counterCollection = null;
  migrationCollection = null;
  if (client) await client.close();
  client = null;
}
