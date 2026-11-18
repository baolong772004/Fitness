import { Prisma, PrismaClient } from '@prisma/client';
import prisma from '../config/prisma.js';
import { PT_BOOKING_HOLD_STATUSES } from './ptBooking.service.js';
import { getCalendar, minute } from './ptCalendar.service.js';

export const ACTIVE_GROUP_CLASS_SCHEDULE_STATUSES = ['OPEN', 'FULL'];
export const ACTIVE_GROUP_CLASS_BOOKING_STATUSES = ['BOOKED', 'CHECKED_IN'];
export const MAX_RECURRING_CLASS_OCCURRENCES = 30;
const VIETNAM_OFFSET_MS = 7 * 3600000;
const DAY_MS = 24 * 3600000;

export type RepeatFrequency = 'NONE' | 'DAILY' | 'WEEKLY';

export function buildRecurringGroupClassSlots(
  firstStart: Date,
  durationMs: number,
  options?: {
    repeatCount?: number;
    repeatFrequency?: RepeatFrequency;
    repeatDays?: number[];
  },
): Array<{ startTime: Date; endTime: Date }> {
  const repeatCount = options?.repeatCount ?? 1;
  const repeatFrequency: RepeatFrequency =
    repeatCount <= 1 ? 'NONE' : (options?.repeatFrequency || 'WEEKLY');

  if (!Number.isInteger(repeatCount) || repeatCount < 1 || repeatCount > MAX_RECURRING_CLASS_OCCURRENCES) {
    throw new Error(`Số buổi lặp lại phải là số nguyên từ 1 đến ${MAX_RECURRING_CLASS_OCCURRENCES}.`);
  }

  if (repeatCount === 1 || repeatFrequency === 'NONE') {
    return [{ startTime: firstStart, endTime: new Date(firstStart.getTime() + durationMs) }];
  }

  if (repeatFrequency === 'DAILY') {
    return Array.from({ length: repeatCount }, (_, index) => {
      const startTime = new Date(firstStart.getTime() + index * DAY_MS);
      return { startTime, endTime: new Date(startTime.getTime() + durationMs) };
    });
  }

  if (repeatFrequency === 'WEEKLY') {
    const firstVnWeekday = new Date(firstStart.getTime() + VIETNAM_OFFSET_MS).getUTCDay() || 7;
    const rawDays = Array.isArray(options?.repeatDays) && options.repeatDays.length > 0
      ? options.repeatDays
      : [firstVnWeekday];

    const normalizedDays = [...new Set(rawDays.map(Number))];
    if (normalizedDays.some((d) => !Number.isInteger(d) || d < 1 || d > 7)) {
      throw new Error('Danh sách ngày lặp trong tuần không hợp lệ (chỉ nhận 1–7).');
    }
    if (!normalizedDays.includes(firstVnWeekday)) {
      throw new Error('Các thứ lặp lại trong tuần phải bao gồm thứ của ngày bắt đầu.');
    }

    const daySet = new Set(normalizedDays);
    const slots: Array<{ startTime: Date; endTime: Date }> = [];
    for (let dayOffset = 0; slots.length < repeatCount && dayOffset < 366; dayOffset++) {
      const candidateStart = new Date(firstStart.getTime() + dayOffset * DAY_MS);
      const weekday = new Date(candidateStart.getTime() + VIETNAM_OFFSET_MS).getUTCDay() || 7;
      if (daySet.has(weekday)) {
        slots.push({
          startTime: candidateStart,
          endTime: new Date(candidateStart.getTime() + durationMs),
        });
      }
    }
    return slots;
  }

  throw new Error('Chế độ lặp lại không hợp lệ.');
}

type DbClient = Prisma.TransactionClient | PrismaClient;

function toVietnamDateAndMinute(value: Date) {
  const shifted = new Date(value.getTime() + VIETNAM_OFFSET_MS);
  return {
    date: shifted.toISOString().slice(0, 10),
    minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  };
}

/**
 * Kiểm tra khung giờ ca lớp học nhóm nằm trong một ngày, trong giờ mở cửa của phòng tập
 * và không trùng vào lịch đóng cửa (GymClosure).
 */
export async function validateGroupClassTimeWindow(
  db: DbClient,
  startTime: Date,
  endTime: Date,
): Promise<{ ok: true; status?: undefined; message?: undefined } | { ok: false; status: number; message: string }> {
  const startInfo = toVietnamDateAndMinute(startTime);
  const endInfo = toVietnamDateAndMinute(endTime);
  const isExactMidnightEnd =
    endInfo.minutes === 0 &&
    endTime.getTime() > startTime.getTime() &&
    toVietnamDateAndMinute(new Date(endTime.getTime() - 1)).date === startInfo.date;
  const endMinutes = isExactMidnightEnd ? 1440 : endInfo.minutes;

  if (startInfo.date !== endInfo.date && !isExactMidnightEnd) {
    return {
      ok: false,
      status: 400,
      message: 'Ca lớp học phải bắt đầu và kết thúc trong cùng một ngày.',
    };
  }

  const calendar = await getCalendar(db);
  const openMin = minute(calendar.openTime);
  const closeMin = minute(calendar.closeTime);
  if (openMin >= 0 && closeMin > openMin && (startInfo.minutes < openMin || endMinutes > closeMin)) {
    return {
      ok: false,
      status: 400,
      message: `Ca lớp học phải nằm trong giờ hoạt động của phòng tập (${calendar.openTime}–${calendar.closeTime}).`,
    };
  }

  let closure: { id: number; reason: string } | null = null;
  try {
    closure = await db.gymClosure.findFirst({
      where: {
        startAt: { lt: endTime },
        endAt: { gt: startTime },
      },
      select: { id: true, reason: true },
    });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021')) {
      throw error;
    }
  }

  if (closure) {
    return {
      ok: false,
      status: 409,
      message: `Khung giờ này trùng lịch đóng cửa phòng tập${closure.reason ? ` (${closure.reason})` : ''}.`,
    };
  }

  return { ok: true };
}

/**
 * Kiểm tra xem có ca lớp học nhóm đang mở nào trong tương lai nằm ngoài khung giờ mở/đóng cửa mới hay không.
 */
export async function findGroupClassOutsideMasterHours(
  db: DbClient,
  openTime: string,
  closeTime: string,
  now = new Date(),
) {
  const openMin = minute(openTime);
  const closeMin = minute(closeTime);
  if (openMin < 0 || closeMin <= openMin) return null;

  const upcoming = await db.groupClassSchedule.findMany({
    where: {
      status: { in: ACTIVE_GROUP_CLASS_SCHEDULE_STATUSES },
      endTime: { gt: now },
    },
    select: {
      id: true,
      startTime: true,
      endTime: true,
      groupClass: { select: { name: true } },
    },
    orderBy: { startTime: 'asc' },
  });

  for (const gc of upcoming) {
    const startInfo = toVietnamDateAndMinute(gc.startTime);
    const endInfo = toVietnamDateAndMinute(gc.endTime);
    const isExactMidnightEnd =
      endInfo.minutes === 0 &&
      gc.endTime.getTime() > gc.startTime.getTime() &&
      toVietnamDateAndMinute(new Date(gc.endTime.getTime() - 1)).date === startInfo.date;
    const endMinutes = isExactMidnightEnd ? 1440 : endInfo.minutes;
    if ((startInfo.date !== endInfo.date && !isExactMidnightEnd) || startInfo.minutes < openMin || endMinutes > closeMin) {
      return gc;
    }
  }
  return null;
}

/**
 * Tự động chuyển các ca lớp học nhóm đã qua giờ kết thúc sang COMPLETED.
 */
export async function completeExpiredGroupClassSchedules(
  db: DbClient = prisma,
  now = new Date(),
): Promise<number> {
  const result = await db.groupClassSchedule.updateMany({
    where: {
      status: { in: ACTIVE_GROUP_CLASS_SCHEDULE_STATUSES },
      endTime: { lte: now },
    },
    data: { status: 'COMPLETED' },
  });
  return result.count;
}

/**
 * Worker định kỳ đóng các ca lớp học nhóm đã kết thúc.
 */
export function startGroupClassWorker(scanIntervalMs = 60_000) {
  let running = false;

  const scan = async () => {
    if (running) return;
    running = true;
    try {
      await completeExpiredGroupClassSchedules();
    } catch (error) {
      console.error('Could not complete expired group class schedules:', error);
    } finally {
      running = false;
    }
  };

  void scan();
  const timer = setInterval(() => void scan(), scanIntervalMs);
  (timer as any)?.unref?.();
  return () => clearInterval(timer);
}

/**
 * Kiểm tra HLV có bị trùng lịch dạy lớp nhóm khác hoặc lịch PT 1-1 trong khung giờ [startTime, endTime] hay không.
 */
export async function findTrainerScheduleConflict(
  db: DbClient,
  trainerId: number,
  startTime: Date,
  endTime: Date,
  excludeScheduleId?: number,
): Promise<string | null> {
  const [classConflict, ptConflict] = await Promise.all([
    db.groupClassSchedule.findFirst({
      where: {
        trainerId,
        ...(excludeScheduleId ? { id: { not: excludeScheduleId } } : {}),
        status: { in: ACTIVE_GROUP_CLASS_SCHEDULE_STATUSES },
        startTime: { lt: endTime },
        endTime: { gt: startTime },
      },
      select: {
        id: true,
        groupClass: { select: { name: true } },
      },
    }),
    db.booking.findFirst({
      where: {
        coachId: trainerId,
        type: 'PT',
        status: { in: PT_BOOKING_HOLD_STATUSES },
        startTime: { lt: endTime },
        endTime: { gt: startTime },
      },
      select: {
        id: true,
        member: { select: { fullName: true } },
      },
    }),
  ]);

  if (classConflict) {
    return `HLV đã được phân công dạy lớp "${classConflict.groupClass.name}" trong khung giờ này.`;
  }
  if (ptConflict) {
    return `HLV đã có lịch dạy PT 1-1${ptConflict.member?.fullName ? ` với ${ptConflict.member.fullName}` : ''} trong khung giờ này.`;
  }
  return null;
}

/**
 * Kiểm tra hội viên có bị trùng giờ với lớp nhóm khác hoặc lịch PT 1-1 đang giữ chỗ hay không.
 */
export async function findMemberScheduleConflict(
  db: DbClient,
  memberId: number,
  startTime: Date,
  endTime: Date,
  excludeScheduleId?: number,
): Promise<string | null> {
  const [classConflict, ptConflict] = await Promise.all([
    db.groupClassBooking.findFirst({
      where: {
        userId: memberId,
        ...(excludeScheduleId ? { scheduleId: { not: excludeScheduleId } } : {}),
        status: { in: ACTIVE_GROUP_CLASS_BOOKING_STATUSES },
        schedule: {
          status: { in: ACTIVE_GROUP_CLASS_SCHEDULE_STATUSES },
          startTime: { lt: endTime },
          endTime: { gt: startTime },
        },
      },
      select: {
        id: true,
        schedule: {
          select: {
            groupClass: { select: { name: true } },
          },
        },
      },
    }),
    db.booking.findFirst({
      where: {
        memberId,
        type: 'PT',
        status: { in: PT_BOOKING_HOLD_STATUSES },
        startTime: { lt: endTime },
        endTime: { gt: startTime },
      },
      select: {
        id: true,
        coach: { select: { fullName: true } },
      },
    }),
  ]);

  if (classConflict) {
    return `Bạn đã đăng ký lớp "${classConflict.schedule.groupClass.name}" bị trùng khung giờ với lớp học này.`;
  }
  if (ptConflict) {
    return `Bạn đã có lịch tập PT 1-1${ptConflict.coach?.fullName ? ` với ${ptConflict.coach.fullName}` : ''} bị trùng khung giờ với lớp học này.`;
  }
  return null;
}
