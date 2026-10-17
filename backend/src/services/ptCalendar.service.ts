import { Prisma, PrismaClient } from '@prisma/client';

type Db = Prisma.TransactionClient | PrismaClient;
export type Shift = { startTime: string; endTime: string };
export type Calendar = { openTime: string; closeTime: string; slotMinutes: number; breakMinutes: number };
export const DEFAULT_CALENDAR: Calendar = { openTime: '06:00', closeTime: '22:00', slotMinutes: 60, breakMinutes: 0 };
const DAY = 86400000;
const OFFSET = 7 * 3600000; // Asia/Ho_Chi_Minh has no daylight saving time.
const missingTable = (error: unknown) => error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021';

export function minute(value: string): number {
  if (value === '24:00') return 1440;
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) return -1;
  const [hour, part] = value.split(':').map(Number);
  return hour * 60 + part;
}
export function vietnamDate(value: Date): string {
  return new Date(value.getTime() + OFFSET).toISOString().slice(0, 10);
}
export function localInstant(date: string, minutes: number): Date {
  return new Date(Date.parse(`${date}T00:00:00.000Z`) + minutes * 60000 - OFFSET);
}
export function validDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}
export function dayOfWeek(date: string): number { return new Date(`${date}T00:00:00Z`).getUTCDay() || 7; }
export function masterSlots(calendar: Calendar): Array<{ startTime: string; endTime: string; startMinute: number; endMinute: number }> {
  const open = minute(calendar.openTime), close = minute(calendar.closeTime);
  if (open < 0 || close <= open || calendar.slotMinutes <= 0 || calendar.breakMinutes < 0) return [];
  const format = (value: number) => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
  const result: Array<{ startTime: string; endTime: string; startMinute: number; endMinute: number }> = [];
  for (let startMinute = open; startMinute + calendar.slotMinutes <= close; startMinute += calendar.slotMinutes + calendar.breakMinutes) {
    const endMinute = startMinute + calendar.slotMinutes;
    result.push({ startTime: format(startMinute), endTime: format(endMinute), startMinute, endMinute });
  }
  return result;
}
export function validateShifts(shifts: Shift[], calendar: Calendar) {
  if (!Array.isArray(shifts) || shifts.length > 28) throw new Error('Tối đa 28 khung giờ mỗi ngày.');
  const sorted = [...shifts].sort((a, b) => String(a?.startTime).localeCompare(String(b?.startTime)));
  const cells = masterSlots(calendar);
  for (let i = 0; i < sorted.length; i++) {
    const start = minute(sorted[i]?.startTime), end = minute(sorted[i]?.endTime);
    if (!cells.some(cell => cell.startMinute === start) || !cells.some(cell => cell.endMinute === end && cell.startMinute >= start) ||
        (i > 0 && start < minute(sorted[i - 1].endTime) + calendar.breakMinutes)) {
      throw new Error('Chỉ được chọn các ca trong lịch chung của Gym và không được trùng giờ.');
    }
  }
  return sorted;
}
export async function getCalendar(db: Db): Promise<Calendar> {
  try { return (await db.gymCalendarConfig.findUnique({ where: { id: 1 } })) ?? DEFAULT_CALENDAR; }
  catch (error) { if (missingTable(error)) return DEFAULT_CALENDAR; throw error; }
}
export async function dayShifts(db: Db, coachProfileId: number, date: string, weekly?: Array<Shift & { dayOfWeek: number; isAvailable: boolean }>): Promise<Shift[]> {
  let override;
  try { override = await db.coachDateAvailability.findUnique({ where: { coachProfileId_date: { coachProfileId, date } } }); }
  catch (error) { if (!missingTable(error)) throw error; }
  if (override) return JSON.parse(override.shifts) as Shift[];
  const rows = weekly ?? await db.coachSchedule.findMany({ where: { coachProfileId } });
  return rows.filter(row => row.dayOfWeek === dayOfWeek(date) && row.isAvailable)
    .map(row => ({ startTime: row.startTime, endTime: row.endTime }));
}
export async function availableSlots(db: Db, coachProfileId: number, date: string, options?: {
  weekly?: Array<Shift & { dayOfWeek: number; isAvailable: boolean }>;
  override?: Shift[];
}): Promise<Array<{ start: Date; end: Date; startTime: string; endTime: string }>> {
  const calendar = await getCalendar(db);
  const shifts = options?.override ?? await dayShifts(db, coachProfileId, date, options?.weekly);
  const dayStart = localInstant(date, 0), dayEnd = new Date(dayStart.getTime() + DAY);
  let closures: Awaited<ReturnType<typeof db.gymClosure.findMany>> = [];
  try { closures = await db.gymClosure.findMany({ where: { startAt: { lt: dayEnd }, endAt: { gt: dayStart } } }); }
  catch (error) { if (!missingTable(error)) throw error; }
  return masterSlots(calendar).flatMap(cell => {
    if (!shifts.some(shift => minute(shift.startTime) <= cell.startMinute && minute(shift.endTime) >= cell.endMinute)) return [];
    const start = localInstant(date, cell.startMinute), end = localInstant(date, cell.endMinute);
    if (closures.some(c => c.startAt < end && c.endAt > start)) return [];
    return [{ start, end, startTime: cell.startTime, endTime: cell.endTime }];
  });
}
export async function assertBookingsCovered(db: Db, coachId: number, coachProfileId: number, options?: {
  weekly?: Array<Shift & { dayOfWeek: number; isAvailable: boolean }>;
  date?: string; override?: Shift[];
}) {
  const bookings = await db.booking.findMany({ where: {
    coachId, type: 'PT', status: { in: ['PENDING', 'UPCOMING', 'CONFIRMED', 'IN_PROGRESS'] },
    startTime: { gt: new Date() },
    ...(options?.date ? { startTime: { gte: localInstant(options.date, 0), lt: localInstant(options.date, 1440) } } : {}),
  }, select: { id: true, startTime: true, endTime: true } });
  const cache = new Map<string, Awaited<ReturnType<typeof availableSlots>>>();
  for (const booking of bookings) {
    const date = vietnamDate(booking.startTime);
    if (!cache.has(date)) cache.set(date, await availableSlots(db, coachProfileId, date, {
      weekly: options?.weekly,
      override: options?.date === date ? options.override : undefined,
    }));
    if (!cache.get(date)!.some(slot => slot.start.getTime() === booking.startTime.getTime() && slot.end.getTime() === booking.endTime.getTime())) {
      throw new Error(`Ca đã đặt #${booking.id} (${date}) sẽ bị ảnh hưởng. Vui lòng xử lý Booking trước.`);
    }
  }
}
