import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaMssql } from '@prisma/adapter-mssql';

const databaseUrl = process.env.DATABASE_URL || '';
const connectionValue = (name) => new RegExp(`(?:^|;)${name}=([^;]+)`, 'i').exec(databaseUrl)?.[1];
const address = databaseUrl.replace(/^sqlserver:\/\//i, '').split(';', 1)[0];
const [server = '127.0.0.1', rawPort] = address.split(':');

if (!databaseUrl) throw new Error('DATABASE_URL chưa được cấu hình.');

const adapter = new PrismaMssql({
  server,
  port: Number(rawPort) || 1433,
  database: connectionValue('database') || 'master',
  user: connectionValue('user') || connectionValue('username'),
  password: connectionValue('password'),
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
});

const prisma = new PrismaClient({ adapter });

export default prisma;
