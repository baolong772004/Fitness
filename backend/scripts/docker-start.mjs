import { PrismaClient } from '@prisma/client';
import { spawnSync } from 'node:child_process';

const targetUrl = process.env.DATABASE_URL;
if (!targetUrl) throw new Error('DATABASE_URL is required');

const masterUrl = targetUrl.replace(/database=[^;]+/i, 'database=master');
const prisma = new PrismaClient({ datasources: { db: { url: masterUrl } } });

await prisma.$executeRawUnsafe("IF DB_ID(N'fitness_db') IS NULL EXEC(N'CREATE DATABASE [fitness_db]')");
await prisma.$disconnect();

const migrate = spawnSync('npx', ['prisma', 'migrate', 'deploy'], { stdio: 'inherit', env: process.env });
if (migrate.status !== 0) process.exit(migrate.status ?? 1);

const server = spawnSync('npm', ['start'], { stdio: 'inherit', env: process.env });
process.exit(server.status ?? 1);
