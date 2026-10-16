import { Prisma } from '@prisma/client';

// SQL Server application locks are shared by every backend instance and released
// automatically when the surrounding database transaction ends.
export async function lockGymMember(tx: Prisma.TransactionClient, userId: number) {
  const rows = await tx.$queryRaw<Array<{ result: number }>>`
    SET NOCOUNT ON;
    DECLARE @lockResult int;
    EXEC @lockResult = sp_getapplock
      @Resource = ${`gym-membership:${userId}`},
      @LockMode = 'Exclusive',
      @LockOwner = 'Transaction',
      @LockTimeout = 10000;
    SELECT @lockResult AS result;
  `;
  if (rows.length !== 1 || rows[0].result < 0) {
    throw new Error(`Could not lock Gym memberships for user ${userId}`);
  }
}
