import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

// Prisma's built-in SQL Server engine supports Windows integrated security.
// Do not pass a driver adapter here: @prisma/adapter-mssql uses node-mssql/Tedious,
// which cannot authenticate with the current Windows account.
const prisma = new PrismaClient();

export default prisma;
