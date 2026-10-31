import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
try {
  const ids = process.argv.slice(2).map(Number).filter(Number.isSafeInteger);
  if (ids.length === 0) {
    const groups = await prisma.exerciseAnalysis.groupBy({ by: ['videoOrigin', 'performerDeclaration'], _count: { _all: true } });
    console.log(JSON.stringify(groups, null, 2));
  } else {
  const rows = await prisma.exerciseAnalysis.findMany({ where: { id: { in: ids } },
    select: { id: true, memberId: true, videoOrigin: true, captureMethodDeclared: true,
      performerDeclaration: true, sourceReference: true, videoSha256: true,
      sessionGroupId: true, samePersonSessionConfirmed: true } });
  console.log(JSON.stringify(rows, null, 2));
  }
} finally { await prisma.$disconnect(); }
