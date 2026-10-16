import { Prisma, PrismaClient } from '@prisma/client';
import { lockGymMember } from './gymMembershipLock.service.js';

const prisma = new PrismaClient();

export async function assertGymMembershipSafetyReady() {
  const indexes = await prisma.$queryRaw<Array<{ name: string }>>`
    SELECT name FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.Membership')
      AND name IN (N'UX_Membership_OneActiveGym', N'UX_Membership_GymActivationOrder')
  `;
  if (indexes.length !== 2) {
    throw new Error('Gym membership safety migration is missing. Run npx prisma migrate deploy before starting the backend.');
  }
}

export async function reconcileGymMembershipStates(tx: Prisma.TransactionClient, userId: number, now: Date) {
    await tx.membership.updateMany({
      where: {
        userId,
        status: { in: ['ACTIVE', 'PENDING_ACTIVATION'] },
        package: { type: 'MEMBERSHIP' },
        endDate: { lt: now },
      },
      data: { status: 'EXPIRED' },
    });

    const active = await tx.membership.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
        package: { type: 'MEMBERSHIP' },
        startDate: { lte: now },
        endDate: { gte: now },
      },
      select: { id: true },
    });
    if (active) return;

    const next = await tx.membership.findFirst({
      where: {
        userId,
        status: 'PENDING_ACTIVATION',
        package: { type: 'MEMBERSHIP' },
        endDate: { gte: now },
      },
      select: { id: true, startDate: true },
      orderBy: [{ activationOrder: 'asc' }, { startDate: 'asc' }, { id: 'asc' }],
    });
    if (next && next.startDate <= now) {
      await tx.membership.updateMany({
        where: { id: next.id, status: 'PENDING_ACTIVATION' },
        data: { status: 'ACTIVE', activatedAt: now },
      });
    }
}

export async function refreshGymMembershipStates(userId: number) {
  await prisma.$transaction(async tx => {
    await lockGymMember(tx, userId);
    await reconcileGymMembershipStates(tx, userId, new Date());
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10000, timeout: 30000 });
}

export function startGymMembershipWorker() {
  const scanIntervalMs = 60 * 1000;
  let running = false;

  const scan = async () => {
    if (running) return;
    running = true;
    try {
      let cursor = 0;
      while (true) {
        const candidates = await prisma.membership.groupBy({
          by: ['userId'],
          where: {
            userId: { gt: cursor },
            package: { type: 'MEMBERSHIP' },
            OR: [
              { status: 'ACTIVE', endDate: { lt: new Date() } },
              { status: 'PENDING_ACTIVATION', startDate: { lte: new Date() } },
            ],
          },
          orderBy: { userId: 'asc' },
          take: 100,
        });
        if (candidates.length === 0) break;
        cursor = candidates[candidates.length - 1].userId;
        for (const { userId } of candidates) {
          try {
            await refreshGymMembershipStates(userId);
          } catch (error) {
            console.error(`Could not refresh Gym memberships for user ${userId}:`, error);
          }
        }
        if (candidates.length < 100) break;
      }
    } catch (error) {
      console.error('Could not refresh Gym membership states:', error);
    } finally {
      running = false;
    }
  };

  void scan();
  const timer = setInterval(() => void scan(), scanIntervalMs);
  timer.unref?.();
}
