import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ACTIVE_GROUP_CLASS_BOOKING_STATUSES,
  ACTIVE_GROUP_CLASS_SCHEDULE_STATUSES,
  buildRecurringGroupClassSlots,
  completeExpiredGroupClassSchedules,
  findGroupClassOutsideMasterHours,
  findMemberScheduleConflict,
  findTrainerScheduleConflict,
  validateGroupClassTimeWindow,
} from '../src/services/groupClass.service.js';
import { optionalAuthenticateToken } from '../src/middlewares/auth.middleware.js';

test('completeExpiredGroupClassSchedules updates expired OPEN/FULL schedules to COMPLETED', async () => {
  const now = new Date('2026-11-18T10:00:00.000Z');
  let capturedArgs: any = null;
  const fakeDb = {
    groupClassSchedule: {
      updateMany: async (args: any) => {
        capturedArgs = args;
        return { count: 3 };
      },
    },
  } as any;

  const updated = await completeExpiredGroupClassSchedules(fakeDb, now);
  assert.equal(updated, 3);
  assert.deepEqual(capturedArgs, {
    where: {
      status: { in: ACTIVE_GROUP_CLASS_SCHEDULE_STATUSES },
      endTime: { lte: now },
    },
    data: { status: 'COMPLETED' },
  });
});

test('findTrainerScheduleConflict detects overlapping GroupClass and PT bookings while respecting excludeScheduleId', async () => {
  const start = new Date('2026-11-20T09:00:00.000Z');
  const end = new Date('2026-11-20T10:00:00.000Z');
  let capturedClassWhere: any = null;

  const conflictClassDb = {
    groupClassSchedule: {
      findFirst: async ({ where }: any) => {
        capturedClassWhere = where;
        return { id: 12, groupClass: { name: 'Yoga Burn' } };
      },
    },
    booking: {
      findFirst: async () => null,
    },
  } as any;

  const classMsg = await findTrainerScheduleConflict(conflictClassDb, 7, start, end, 99);
  assert.ok(classMsg?.includes('Yoga Burn'));
  assert.deepEqual(capturedClassWhere.id, { not: 99 });

  const conflictPtDb = {
    groupClassSchedule: { findFirst: async () => null },
    booking: {
      findFirst: async () => ({ id: 44, member: { fullName: 'Nguyen Van A' } }),
    },
  } as any;

  const ptMsg = await findTrainerScheduleConflict(conflictPtDb, 7, start, end);
  assert.ok(ptMsg?.includes('PT 1-1'));
  assert.ok(ptMsg?.includes('Nguyen Van A'));

  const freeDb = {
    groupClassSchedule: { findFirst: async () => null },
    booking: { findFirst: async () => null },
  } as any;

  const freeMsg = await findTrainerScheduleConflict(freeDb, 7, start, end);
  assert.equal(freeMsg, null);
});

test('findMemberScheduleConflict detects overlapping GroupClassBooking and PT bookings', async () => {
  const start = new Date('2026-11-20T18:00:00.000Z');
  const end = new Date('2026-11-20T19:00:00.000Z');
  let capturedWhere: any = null;

  const classOverlapDb = {
    groupClassBooking: {
      findFirst: async ({ where }: any) => {
        capturedWhere = where;
        return { id: 5, schedule: { groupClass: { name: 'Boxing HIIT' } } };
      },
    },
    booking: { findFirst: async () => null },
  } as any;

  const msg = await findMemberScheduleConflict(classOverlapDb, 21, start, end, 33);
  assert.ok(msg?.includes('Boxing HIIT'));
  assert.deepEqual(capturedWhere.scheduleId, { not: 33 });
  assert.deepEqual(capturedWhere.status, { in: ACTIVE_GROUP_CLASS_BOOKING_STATUSES });

  const ptOverlapDb = {
    groupClassBooking: { findFirst: async () => null },
    booking: { findFirst: async () => ({ id: 88, coach: { fullName: 'Coach Minh' } }) },
  } as any;

  const ptMsg = await findMemberScheduleConflict(ptOverlapDb, 21, start, end, 33);
  assert.ok(ptMsg?.includes('Coach Minh'));
});

test('optionalAuthenticateToken allows anonymous requests when Authorization header is absent', async () => {
  let nextCalled = false;
  const req: any = { headers: {} };
  const res: any = {};
  await optionalAuthenticateToken(req, res, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, true);
  assert.equal(req.user, undefined);
});

test('validateGroupClassTimeWindow enforces same-day gym opening hours and closures', async () => {
  const baseDb = {
    gymCalendarConfig: {
      findUnique: async () => ({ openTime: '06:00', closeTime: '22:00', slotMinutes: 60, breakMinutes: 0 }),
    },
    gymClosure: {
      findFirst: async () => null,
    },
  } as any;

  const valid = await validateGroupClassTimeWindow(
    baseDb,
    new Date('2026-11-20T09:00:00+07:00'),
    new Date('2026-11-20T10:00:00+07:00'),
  );
  assert.deepEqual(valid, { ok: true });

  const outsideHours = await validateGroupClassTimeWindow(
    baseDb,
    new Date('2026-11-20T21:30:00+07:00'),
    new Date('2026-11-20T22:30:00+07:00'),
  );
  assert.equal(outsideHours.ok, false);
  if (!outsideHours.ok) assert.ok(outsideHours.message.includes('06:00–22:00'));

  const overnight = await validateGroupClassTimeWindow(
    baseDb,
    new Date('2026-11-20T23:30:00+07:00'),
    new Date('2026-11-21T00:30:00+07:00'),
  );
  assert.equal(overnight.ok, false);

  const closedDb = {
    gymCalendarConfig: baseDb.gymCalendarConfig,
    gymClosure: {
      findFirst: async () => ({ id: 2, reason: 'Bảo trì điện' }),
    },
  } as any;
  const duringClosure = await validateGroupClassTimeWindow(
    closedDb,
    new Date('2026-11-20T09:00:00+07:00'),
    new Date('2026-11-20T10:00:00+07:00'),
  );
  assert.equal(duringClosure.ok, false);
  if (!duringClosure.ok) assert.equal(duringClosure.status, 409);
});

test('buildRecurringGroupClassSlots generates daily and weekly multi-day schedules accurately', () => {
  // 2026-11-20 is Friday (weekday = 5)
  const firstStart = new Date('2026-11-20T18:00:00+07:00');
  const durationMs = 60 * 60_000;

  const daily = buildRecurringGroupClassSlots(firstStart, durationMs, {
    repeatCount: 3,
    repeatFrequency: 'DAILY',
  });
  assert.equal(daily.length, 3);
  assert.equal(daily[1].startTime.toISOString(), new Date('2026-11-21T18:00:00+07:00').toISOString());
  assert.equal(daily[2].endTime.toISOString(), new Date('2026-11-22T19:00:00+07:00').toISOString());

  // Mon (1), Wed (3), Fri (5) starting on Fri 2026-11-20 -> Fri 20, Mon 23, Wed 25, Fri 27
  const weekly = buildRecurringGroupClassSlots(firstStart, durationMs, {
    repeatCount: 4,
    repeatFrequency: 'WEEKLY',
    repeatDays: [1, 3, 5],
  });
  assert.deepEqual(
    weekly.map((s) => new Date(s.startTime.getTime() + 7 * 3600000).toISOString().slice(0, 10)),
    ['2026-11-20', '2026-11-23', '2026-11-25', '2026-11-27'],
  );

  assert.throws(
    () => buildRecurringGroupClassSlots(firstStart, durationMs, {
      repeatCount: 2,
      repeatFrequency: 'WEEKLY',
      repeatDays: [1, 3], // missing Fri (5)
    }),
  );
  assert.throws(
    () => buildRecurringGroupClassSlots(firstStart, durationMs, {
      repeatCount: 31,
      repeatFrequency: 'DAILY',
    }),
  );
});

test('findGroupClassOutsideMasterHours flags active schedules outside narrowed gym hours', async () => {
  const db = {
    groupClassSchedule: {
      findMany: async () => [
        {
          id: 51,
          startTime: new Date('2026-11-20T07:00:00+07:00'),
          endTime: new Date('2026-11-20T08:00:00+07:00'),
          groupClass: { name: 'Morning Yoga' },
        },
      ],
    },
  } as any;

  const ok = await findGroupClassOutsideMasterHours(db, '06:00', '22:00');
  assert.equal(ok, null);

  const conflict = await findGroupClassOutsideMasterHours(db, '08:00', '21:00');
  assert.equal(conflict?.id, 51);
});
