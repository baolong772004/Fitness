import { randomBytes } from 'node:crypto';
import bcrypt from 'bcrypt';
import prisma from '../src/config/prisma.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const DEMO_MEMBERS = [
  'Nguyễn An Nhi', 'Trần Quốc Bảo', 'Lê Gia Hân', 'Phạm Minh Khang',
  'Võ Thảo Vy', 'Đặng Hoàng Long', 'Bùi Khánh Linh', 'Đỗ Đức Anh',
  'Hoàng Ngọc Mai', 'Phan Nhật Minh', 'Vũ Thanh Tâm', 'Đinh Tuấn Kiệt',
  'Nguyễn Khánh Chi', 'Trần Minh Đức', 'Lê Phương Anh', 'Phạm Gia Bảo',
  'Võ Ngọc Trâm', 'Đặng Hải Nam', 'Bùi Quỳnh Như', 'Đỗ Minh Triết',
  'Hoàng Bảo Ngọc', 'Phan Tiến Dũng', 'Vũ Yến Nhi', 'Đinh Khôi Nguyên',
];
const PT_LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];
const CHECK_IN_COUNTS = [0, 3, 1, 6, 4, 2, 8, 5, 7, 0, 9, 3, 5, 2, 10, 4, 6, 1, 8, 3, 0, 7, 2, 5];

function assertLocalDatabase() {
  const connection = process.env.DATABASE_URL ?? '';
  const authority = connection.match(/^[a-z]+:\/\/([^;?]+)/i)?.[1] ?? '';
  const hostPart = authority.includes('@') ? authority.split('@').at(-1) : authority;
  const host = hostPart.split(/[\\/:]/)[0].toLowerCase();
  if (!['localhost', '127.0.0.1', '.'].includes(host)) {
    throw new Error('Display-only member seed is restricted to a local SQL Server.');
  }
}

const addDays = (date, days) => new Date(date.getTime() + days * DAY_MS);

async function getGymPackages() {
  const existing = await prisma.package.findMany({
    where: { type: 'MEMBERSHIP', isActive: true }, orderBy: { durationDays: 'asc' },
  });
  if (existing.length) return existing;

  const name = '[DISPLAY ONLY] Gói Member';
  const fallback = await prisma.package.findFirst({ where: { name, type: 'MEMBERSHIP' } });
  if (fallback) return [fallback];
  return [await prisma.package.create({ data: {
    name, description: 'Gói chỉ dùng cho dữ liệu hiển thị demo.', type: 'MEMBERSHIP',
    price: 0, durationDays: 30, trialPtSessions: 0, isActive: false,
  } })];
}

async function getPtPackage(level) {
  const existing = await prisma.package.findFirst({
    where: { type: 'PT', ptLevel: level, isActive: true }, orderBy: { createdAt: 'asc' },
  });
  if (existing) return existing;

  const name = `[DISPLAY ONLY] PT ${level}`;
  const fallback = await prisma.package.findFirst({ where: { name, type: 'PT' } });
  if (fallback) return fallback;
  return prisma.package.create({ data: {
    name, description: 'Gói chỉ dùng cho dữ liệu hiển thị demo.', type: 'PT',
    price: 0, durationDays: 60, totalPtSessions: 12, ptLevel: level, isActive: false,
  } });
}

async function main() {
  assertLocalDatabase();
  await prisma.$connect();

  const [gymPackages, coaches] = await Promise.all([
    getGymPackages(),
    prisma.coachProfile.findMany({
      where: { status: 'ACTIVE', user: { status: 'ACTIVE', role: { in: ['COACH', 'TRAINER'] } } },
      select: { userId: true, specializations: { select: { level: true } } },
      orderBy: { userId: 'asc' },
    }),
  ]);
  const ptPackages = new Map(await Promise.all(PT_LEVELS.map(async level => [level, await getPtPackage(level)])));
  const displayPasswordHash = await bcrypt.hash(randomBytes(32).toString('hex'), 10);
  const today = new Date();
  today.setUTCHours(4, 0, 0, 0);
  const room = await prisma.room.findFirst({ where: { isActive: true }, select: { id: true } });

  let gymMembershipCount = 0;
  let ptWalletCount = 0;
  let checkInCount = 0;

  for (let index = 0; index < DEMO_MEMBERS.length; index++) {
    const number = index + 1;
    const email = `display.member.${String(number).padStart(2, '0')}@example.invalid`;
    const name = DEMO_MEMBERS[index];
    const phone = `000000${String(number).padStart(4, '0')}`;
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        fullName: name, phone, gender: index % 2 === 0 ? 'female' : 'male',
        dateOfBirth: new Date(Date.UTC(1980 + (index * 7) % 24, (index * 5) % 12, 1 + (index * 3) % 27)),
        height: 150 + (index * 7) % 38, weight: 48 + (index * 5) % 42,
        role: 'MEMBER', status: 'ACTIVE', mustChangePassword: true, password: displayPasswordHash,
      },
      create: {
        email, password: displayPasswordHash, mustChangePassword: true,
        fullName: name, phone, gender: index % 2 === 0 ? 'female' : 'male',
        dateOfBirth: new Date(Date.UTC(1980 + (index * 7) % 24, (index * 5) % 12, 1 + (index * 3) % 27)),
        height: 150 + (index * 7) % 38, weight: 48 + (index * 5) % 42,
        role: 'MEMBER', status: 'ACTIVE',
      },
    });

    let gymMembership = null;
    if (index % 6 !== 5) {
      const targetDuration = [30, 90, 180, 365][index % 4];
      const gymPackage = gymPackages.reduce((best, candidate) =>
        Math.abs(candidate.durationDays - targetDuration) < Math.abs(best.durationDays - targetDuration) ? candidate : best);
      const elapsedDays = index % 5 === 0
        ? Math.max(0, gymPackage.durationDays - 2)
        : Math.min(gymPackage.durationDays - 1, [8, 20, 45, 80, 120][index % 5]);
      const startDate = addDays(today, -elapsedDays);
      const endDate = addDays(startDate, gymPackage.durationDays);
      const membershipData = {
        userId: user.id, packageId: gymPackage.id, startDate, endDate,
        isGymMembership: true, status: index === 10 ? 'FROZEN' : 'ACTIVE',
        activationOrder: 1, activatedAt: startDate,
      };
      const existing = await prisma.membership.findFirst({
        where: { userId: user.id, isGymMembership: true }, orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      gymMembership = existing
        ? await prisma.membership.update({ where: { id: existing.id }, data: membershipData,
          select: { id: true, startDate: true, endDate: true } })
        : await prisma.membership.create({ data: membershipData,
          select: { id: true, startDate: true, endDate: true } });
      gymMembershipCount++;

      const desiredCheckIns = CHECK_IN_COUNTS[index];
      for (let check = 0; check < desiredCheckIns; check++) {
        const checkInTime = new Date(today.getTime() - (check + 1) * DAY_MS + number * 1000);
        const existingCheckIn = await prisma.checkIn.findFirst({
          where: { memberId: user.id, checkInTime }, select: { id: true },
        });
        if (!existingCheckIn) {
          await prisma.checkIn.create({ data: {
            memberId: user.id, membershipId: gymMembership.id, roomId: room?.id,
            checkInTime, method: 'MANUAL', status: 'SUCCESS',
          } });
          checkInCount++;
        }
      }
    }

    if (index % 4 !== 3) {
      const level = PT_LEVELS[index % PT_LEVELS.length];
      const ptPackage = ptPackages.get(level);
      const qualifiedCoaches = coaches.filter(coach => coach.specializations.some(row => row.level === level));
      const coachId = qualifiedCoaches.length ? qualifiedCoaches[index % qualifiedCoaches.length].userId : null;
      const ptStart = addDays(today, -5);
      const ptEnd = addDays(today, 55);
      const membershipData = {
        userId: user.id, packageId: ptPackage.id, startDate: ptStart, endDate: ptEnd,
        isGymMembership: false, status: 'ACTIVE', activationOrder: 2, activatedAt: ptStart,
        coachId, remainingSessions: null,
      };
      const existingPtMembership = await prisma.membership.findFirst({
        where: { userId: user.id, isGymMembership: false, package: { type: 'PT' } },
        orderBy: { createdAt: 'asc' }, select: { id: true },
      });
      const ptMembership = existingPtMembership
        ? await prisma.membership.update({ where: { id: existingPtMembership.id }, data: membershipData,
          select: { id: true } })
        : await prisma.membership.create({ data: membershipData, select: { id: true } });
      const wallet = await prisma.ptWallet.upsert({
        where: { memberId: user.id }, update: {}, create: { memberId: user.id },
      });
      const initialCount = [12, 10, 8, 16][index % 4];
      const usedCount = [0, 0, 2, 5, 1, 3, 0, 4][index % 8];
      const batchData = {
        walletId: wallet.id, membershipId: ptMembership.id, level,
        source: 'PACKAGE_PURCHASE', initialCount, usedCount, heldCount: 0,
        coachId, startAt: ptStart, endAt: ptEnd, activatedAt: ptStart,
        benefitsSnapshot: 'DISPLAY ONLY — dữ liệu hội viên demo, không có giao dịch thanh toán.',
      };
      const batch = await prisma.ptCreditBatch.findFirst({
        where: { walletId: wallet.id, membershipId: ptMembership.id, source: 'PACKAGE_PURCHASE', level },
        select: { id: true },
      });
      if (batch) await prisma.ptCreditBatch.update({ where: { id: batch.id }, data: batchData });
      else await prisma.ptCreditBatch.create({ data: batchData });
      ptWalletCount++;
    }
  }

  console.log(`Seeded ${DEMO_MEMBERS.length} display-only members (${gymMembershipCount} Gym memberships, ${ptWalletCount} PT wallets, ${checkInCount} new check-ins).`);
}

main().catch(error => {
  console.error('Display-only member seed failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
