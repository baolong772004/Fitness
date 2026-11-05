import { Prisma } from '@prisma/client';
import prisma from '../config/prisma.js';
import { lockGymMember } from './gymMembershipLock.service.js';
import { createUserNotification } from './notification.service.js';


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

    // 1. Kiểm tra xem hội viên có gói nào đang ACTIVE hoặc FROZEN (bảo lưu) không
    const activeOrFrozen = await tx.membership.findFirst({
      where: {
        userId,
        status: { in: ['ACTIVE', 'FROZEN'] },
        package: { type: 'MEMBERSHIP' },
        endDate: { gte: now },
      },
      select: { id: true, status: true },
    });
    // Nếu đang có gói ACTIVE hoặc đang có gói FROZEN thì KHÔNG tự động kích hoạt gói PENDING_ACTIVATION tiếp theo!
    if (activeOrFrozen) return;

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

/**
 * Tự động mở bảo lưu (Auto-Unfreeze) cho các gói FROZEN khi hết thời hạn bảo lưu đã đăng ký
 */
export async function autoUnfreezeExpiredFreezes() {
  const now = new Date();
  const frozenMemberships = await prisma.membership.findMany({
    where: {
      status: 'FROZEN',
      package: { type: 'MEMBERSHIP' },
    },
    include: { package: true, user: true },
  });

  for (const membership of frozenMemberships) {
    try {
      const log = await prisma.actionLog.findFirst({
        where: {
          action: 'MEMBERSHIP_FREEZE_BY_STAFF',
          details: { contains: `"membershipId":${membership.id}` },
        },
        orderBy: { createdAt: 'desc' },
      });

      let shouldUnfreeze = false;
      if (log?.details) {
        try {
          const parsed = JSON.parse(log.details);
          if (parsed.frozenAt && parsed.freezeDays) {
            const frozenAt = new Date(parsed.frozenAt);
            const freezeDurationMs = Number(parsed.freezeDays) * 86400000;
            if (now.getTime() >= frozenAt.getTime() + freezeDurationMs) {
              shouldUnfreeze = true;
            }
          }
        } catch {}
      } else {
        // Fallback: nếu không có log chi tiết thì khi chạm endDate tự động mở lại
        if (membership.endDate.getTime() <= now.getTime()) {
          shouldUnfreeze = true;
        }
      }

      if (shouldUnfreeze) {
        await prisma.membership.update({
          where: { id: membership.id },
          data: { status: 'ACTIVE' },
        });

        await prisma.actionLog.create({
          data: {
            userId: membership.userId,
            action: 'MEMBERSHIP_AUTO_UNFREEZE',
            details: JSON.stringify({
              type: 'AUTO_UNFREEZE',
              membershipId: membership.id,
              autoUnfrozenAt: now.toISOString(),
              reason: 'Thời gian bảo lưu đăng ký đã kết thúc',
            }),
          },
        });

        createUserNotification({
          userId: membership.userId,
          title: 'Gói tập đã tự động mở lại',
          message: `Gói tập [${membership.package.name}] của bạn đã kết thúc thời gian bảo lưu và tự động kích hoạt lại để bạn tiếp tục tập luyện!`,
        }).catch(() => {});
      }
    } catch (e) {
      console.error(`Lỗi autoUnfreeze cho membership ${membership.id}:`, e);
    }
  }
}

export function startGymMembershipWorker() {
  const scanIntervalMs = 60 * 1000;
  let running = false;

  const scan = async () => {
    if (running) return;
    running = true;
    try {
      // 1. Quét và tự động mở lại các gói bảo lưu đã hết hạn
      await autoUnfreezeExpiredFreezes();

      // 2. Quét đồng bộ kích hoạt / hết hạn gói Gym Access
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
  (timer as any)?.unref?.();
}
