import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

// Read-only inventory. Run before deploying the expiry migration against an existing database.
const prisma = new PrismaClient();
try {
  const columns = await prisma.$queryRaw<Array<{ tableName: string; columnName: string }>>`
    SELECT OBJECT_NAME(object_id) AS tableName, name AS columnName FROM sys.columns
    WHERE (object_id = OBJECT_ID(N'dbo.PtCreditBatch') AND name = N'endAt')
       OR (object_id = OBJECT_ID(N'dbo.PtProduct') AND name = N'durationDays')
  `;
  const hasBatchExpiry = columns.some(row => row.tableName === 'PtCreditBatch' && row.columnName === 'endAt');
  const hasProductDuration = columns.some(row => row.tableName === 'PtProduct' && row.columnName === 'durationDays');
  const batches = hasBatchExpiry
    ? await prisma.$queryRaw<Array<{ source: string; batches: number; unexpiredLegacy: number; remaining: number }>>`
        SELECT source, COUNT(*) AS batches,
          SUM(CASE WHEN endAt IS NULL THEN 1 ELSE 0 END) AS unexpiredLegacy,
          SUM(initialCount - usedCount - heldCount) AS remaining
        FROM dbo.PtCreditBatch GROUP BY source`
    : await prisma.$queryRaw<Array<{ source: string; batches: number; unexpiredLegacy: number; remaining: number }>>`
        SELECT source, COUNT(*) AS batches, COUNT(*) AS unexpiredLegacy,
          SUM(initialCount - usedCount - heldCount) AS remaining
        FROM dbo.PtCreditBatch GROUP BY source`;
  const products = hasProductDuration
    ? await prisma.$queryRaw<Array<{ total: number; missingDuration: number }>>`
        SELECT COUNT(*) AS total, SUM(CASE WHEN durationDays IS NULL THEN 1 ELSE 0 END) AS missingDuration
        FROM dbo.PtProduct`
    : await prisma.$queryRaw<Array<{ total: number; missingDuration: number }>>`
        SELECT COUNT(*) AS total, COUNT(*) AS missingDuration FROM dbo.PtProduct`;
  const legacyMemberships = await prisma.$queryRaw<Array<{ missingLevel: number }>>`
    SELECT COUNT(*) AS missingLevel FROM dbo.Membership m
    JOIN dbo.Package p ON p.id = m.packageId
    WHERE p.type = N'PT' AND p.ptLevel IS NULL`;
  console.log(JSON.stringify({ hasBatchExpiry, hasProductDuration, batches,
    products: products[0], legacyPtMembershipsMissingLevel: legacyMemberships[0]?.missingLevel ?? 0 }, null, 2));
} finally {
  await prisma.$disconnect();
}
