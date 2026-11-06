import type { Response } from 'express';
import prisma from '../config/prisma.js';
import type { AuthRequest } from '../middlewares/auth.middleware.js';
import { emitCoachScheduleChanged } from '../sockets/ptChat.socket.js';
import { createUserNotification } from '../services/notification.service.js';
import { reportCoachAbsence } from '../services/ptCoachAbsence.service.js';
import { lockPtCalendar, lockPtCoach, lockPtMembership, PtBookingError, PT_BOOKING_HOLD_STATUSES } from '../services/ptBooking.service.js';
import { assertBookingsCovered, availableSlots, getCalendar, localInstant, masterSlots, minute, validDate, validateShifts, vietnamDate, type Shift } from '../services/ptCalendar.service.js';

const fail = (res: Response, error: unknown) => res.status(error instanceof Error ? 409 : 500)
  .json({ success: false, message: error instanceof Error ? error.message : 'Không thể cập nhật lịch' });
const log = (tx: any, userId: number, action: string, before: unknown, after: unknown) =>
  tx.actionLog.create({ data: { userId, action, details: JSON.stringify({ before, after }) } });

export async function getCoachAvailability(req: AuthRequest, res: Response) {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ success: false });
  const profile = await prisma.coachProfile.findUnique({ where: { userId }, include: {
    schedules: { orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }] },
    dateAvailability: { where: { date: { gte: vietnamDate(new Date()) } }, orderBy: { date: 'asc' }, take: 180 },
  } });
  if (!profile) return res.status(404).json({ success: false, message: 'Chưa có hồ sơ Coach' });
  const [calendar, closures, bookings] = await Promise.all([getCalendar(prisma), prisma.gymClosure.findMany({
    where: { endAt: { gt: new Date() } }, orderBy: { startAt: 'asc' }, take: 200,
  }), prisma.booking.findMany({ where: { coachId: userId, type: 'PT', status: { in: PT_BOOKING_HOLD_STATUSES }, endTime: { gt: new Date() } },
    select: { id: true, startTime: true, endTime: true, status: true }, orderBy: { startTime: 'asc' } })]);
  return res.json({ success: true, data: { calendar, slots: masterSlots(calendar), closures, bookings, schedules: profile.schedules,
    dates: profile.dateAvailability.map(row => ({ date: row.date, shifts: JSON.parse(row.shifts) })) } });
}

export async function putCoachWeekly(req: AuthRequest, res: Response) {
  const userId = req.user?.userId!;
  const rows = req.body?.schedules;
  if (!Array.isArray(rows) || rows.length > 168) return res.status(400).json({ success: false, message: 'Tối đa 168 ca/tuần.' });
  try {
    const result = await prisma.$transaction(async tx => {
      await lockPtCalendar(tx); await lockPtCoach(tx, userId);
      const profile = await tx.coachProfile.findUnique({ where: { userId } });
      if (!profile || profile.status !== 'ACTIVE') throw new Error('Coach không hoạt động.');
      const calendar = await getCalendar(tx);
      const weekly: Array<Shift & { dayOfWeek: number; isAvailable: boolean }> = rows.map(row => ({
        dayOfWeek: Number(row?.dayOfWeek), startTime: row?.startTime, endTime: row?.endTime, isAvailable: row?.isAvailable !== false,
      }));
      if (weekly.some(row => !Number.isInteger(row.dayOfWeek) || row.dayOfWeek < 1 || row.dayOfWeek > 7 ||
          typeof row.startTime !== 'string' || typeof row.endTime !== 'string')) {
        throw new Error('Lịch tuần cần thứ 2–Chủ nhật và giờ HH:mm hợp lệ.');
      }
      if (rows.some(row => row?.isAvailable !== undefined && typeof row.isAvailable !== 'boolean')) {
        throw new Error('isAvailable phải là true hoặc false.');
      }
      for (let day = 1; day <= 7; day++) validateShifts(weekly.filter(row => row.dayOfWeek === day && row.isAvailable), calendar);
      const before = await tx.coachSchedule.findMany({ where: { coachProfileId: profile.id } });
      await assertBookingsCovered(tx, userId, profile.id, { weekly });
      await tx.coachSchedule.deleteMany({ where: { coachProfileId: profile.id } });
      if (weekly.length) await tx.coachSchedule.createMany({ data: weekly.map(row => ({ ...row, coachProfileId: profile.id })) });
      await log(tx, userId, 'COACH_WEEKLY_AVAILABILITY', before, weekly);
      return weekly;
    }, { maxWait: 15000, timeout: 30000 });
    emitCoachScheduleChanged(userId);
    return res.json({ success: true, message: 'Đã công bố lịch tuần', data: result });
  } catch (error) { return fail(res, error); }
}

export async function putCoachDates(req: AuthRequest, res: Response) {
  const userId = req.user?.userId!;
  const dates = req.body?.dates;
  if (!Array.isArray(dates) || dates.length < 1 || dates.length > 31 || new Set(dates.map(row => row?.date)).size !== dates.length) {
    return res.status(400).json({ success: false, message: 'Chọn 1–31 ngày khác nhau.' });
  }
  try {
    const result = await prisma.$transaction(async tx => {
      await lockPtCalendar(tx); await lockPtCoach(tx, userId);
      const profile = await tx.coachProfile.findUnique({ where: { userId } });
      if (!profile || profile.status !== 'ACTIVE') throw new Error('Coach không hoạt động.');
      const calendar = await getCalendar(tx);
      const now = new Date();
      const output: Array<{ date: string; shifts: Shift[] }> = [];
      for (const item of dates) {
        if (!validDate(item?.date) || item.date < vietnamDate(now)) throw new Error('Không thể sửa lịch trong quá khứ.');
        const date = item.date as string;
        const shifts = validateShifts(item.shifts, calendar);
        const old = await tx.coachDateAvailability.findUnique({ where: { coachProfileId_date: { coachProfileId: profile.id, date } } });
        const oldSlots = await availableSlots(tx, profile.id, date);
        const newSlots = await availableSlots(tx, profile.id, date, { override: shifts });
        if (oldSlots.some(slot => slot.start < now && !newSlots.some(next => next.start.getTime() === slot.start.getTime()))) {
          throw new Error('Không thể sửa ca đã qua trong hôm nay.');
        }
        const closures = await tx.gymClosure.findMany({ where: { startAt: { lt: localInstant(date, 1440) }, endAt: { gt: localInstant(date, 0) } } });
        if (shifts.some(shift => closures.some(c => c.startAt < localInstant(date, minute(shift.endTime)) && c.endAt > localInstant(date, minute(shift.startTime))))) {
          throw new Error(`${date} có ngày đóng cửa hoặc thời gian bảo trì trong khung đã chọn.`);
        }
        await assertBookingsCovered(tx, userId, profile.id, { date, override: shifts });
        await tx.coachDateAvailability.upsert({ where: { coachProfileId_date: { coachProfileId: profile.id, date } },
          create: { coachProfileId: profile.id, date, shifts: JSON.stringify(shifts) }, update: { shifts: JSON.stringify(shifts) } });
        await log(tx, userId, 'COACH_DATE_AVAILABILITY', old ? JSON.parse(old.shifts) : null, { date, shifts });
        output.push({ date, shifts });
      }
      return output;
    }, { maxWait: 15000, timeout: 30000 });
    emitCoachScheduleChanged(userId);
    return res.json({ success: true, message: 'Đã công bố lịch theo ngày', data: result });
  } catch (error) { return fail(res, error); }
}

export async function deleteCoachDate(req: AuthRequest, res: Response) {
  const userId = req.user?.userId!;
  const date = req.params.date;
  if (!validDate(date) || date < vietnamDate(new Date())) return res.status(400).json({ success: false, message: 'Ngày không hợp lệ.' });
  try {
    await prisma.$transaction(async tx => {
      await lockPtCalendar(tx); await lockPtCoach(tx, userId);
      const profile = await tx.coachProfile.findUniqueOrThrow({ where: { userId } });
      const current = await tx.coachDateAvailability.findUnique({ where: { coachProfileId_date: { coachProfileId: profile.id, date } } });
      if (!current) throw new Error('Ngày này chưa có lịch riêng.');
      const oldSlots = await availableSlots(tx, profile.id, date);
      await tx.coachDateAvailability.delete({ where: { id: current.id } });
      const replacement = await availableSlots(tx, profile.id, date);
      if (oldSlots.some(slot => slot.start < new Date() && !replacement.some(next => next.start.getTime() === slot.start.getTime()))) {
        throw new Error('Không thể sửa ca đã qua trong hôm nay.');
      }
      await assertBookingsCovered(tx, userId, profile.id, { date });
      await log(tx, userId, 'COACH_DATE_RESET', { date, shifts: JSON.parse(current.shifts) }, null);
    });
    emitCoachScheduleChanged(userId);
    return res.json({ success: true, message: 'Đã trở về lịch tuần.' });
  } catch (error) { return fail(res, error); }
}

export async function deleteCoachSlot(req: AuthRequest, res: Response) {
  const coachId = req.user?.userId!;
  const date = req.query.date, startTime = req.query.startTime;
  if (!validDate(date) || typeof startTime !== 'string' || minute(startTime) < 0) {
    return res.status(400).json({ success: false, message: 'Cần ngày và giờ bắt đầu ca hợp lệ.' });
  }
  try {
    await prisma.$transaction(async tx => {
      await lockPtCalendar(tx); await lockPtCoach(tx, coachId);
      const profile = await tx.coachProfile.findUniqueOrThrow({ where: { userId: coachId } });
      const slots = await availableSlots(tx, profile.id, date);
      const slot = slots.find(row => row.startTime === startTime);
      if (!slot || slot.start <= new Date()) throw new Error('Ca không tồn tại hoặc đã qua.');
      const booked = await tx.booking.findFirst({ where: { coachId, type: 'PT', status: { in: PT_BOOKING_HOLD_STATUSES }, startTime: { lt: slot.end }, endTime: { gt: slot.start } }, select: { id: true } });
      if (booked) throw new Error(`Ca đã có Booking #${booked.id}; vui lòng gửi yêu cầu cho Admin.`);
      const remaining = slots.filter(row => row.start.getTime() !== slot.start.getTime())
        .map(row => ({ startTime: row.startTime, endTime: row.endTime }));
      const old = await tx.coachDateAvailability.findUnique({ where: { coachProfileId_date: { coachProfileId: profile.id, date } } });
      await tx.coachDateAvailability.upsert({ where: { coachProfileId_date: { coachProfileId: profile.id, date } },
        create: { coachProfileId: profile.id, date, shifts: JSON.stringify(remaining) }, update: { shifts: JSON.stringify(remaining) } });
      await assertBookingsCovered(tx, coachId, profile.id, { date, override: remaining });
      await log(tx, coachId, 'COACH_DATE_AVAILABILITY', old ? JSON.parse(old.shifts) : null, { date, shifts: remaining });
    });
    emitCoachScheduleChanged(coachId);
    return res.json({ success: true, message: 'Đã hủy ca trống.' });
  } catch (error) { return fail(res, error); }
}

export async function getMasterCalendar(_req: AuthRequest, res: Response) {
  const [calendar, closures] = await Promise.all([getCalendar(prisma), prisma.gymClosure.findMany({ where: { endAt: { gt: new Date() } }, orderBy: { startAt: 'asc' }, take: 300 })]);
  return res.json({ success: true, data: { calendar, slots: masterSlots(calendar), closures } });
}

export async function putMasterCalendar(req: AuthRequest, res: Response) {
  const { openTime, closeTime, breakMinutes } = req.body ?? {};
  if (minute(openTime) < 0 || minute(closeTime) <= minute(openTime) ||
      minute(closeTime) - minute(openTime) < 60 || !Number.isInteger(breakMinutes) || breakMinutes < 0 || breakMinutes > 60 ||
      (req.body?.slotMinutes !== undefined && req.body.slotMinutes !== 60)) {
    return res.status(400).json({ success: false, message: 'Giờ mở/đóng không hợp lệ; ca PT cố định 60 phút, nghỉ 0–60 phút.' });
  }
  try {
    const data = await prisma.$transaction(async tx => {
      await lockPtCalendar(tx);
      const before = await getCalendar(tx);
      const next = { openTime, closeTime, slotMinutes: 60, breakMinutes };
      const profiles = await tx.coachProfile.findMany({ where: { user: { coachBookings: { some: {
        type: 'PT', status: { in: PT_BOOKING_HOLD_STATUSES }, startTime: { gt: new Date() },
      } } } }, select: { id: true, userId: true } });
      await tx.gymCalendarConfig.upsert({ where: { id: 1 }, update: next, create: { id: 1, ...next } });
      for (const p of profiles) await assertBookingsCovered(tx, p.userId, p.id);
      await log(tx, req.user!.userId, 'GYM_CALENDAR_UPDATE', before, next);
      return next;
    }, { maxWait: 15000, timeout: 30000 });
    return res.json({ success: true, data });
  } catch (error) { return fail(res, error); }
}

export async function addClosure(req: AuthRequest, res: Response) {
  const { startAt, endAt, kind, reason } = req.body ?? {};
  const start = new Date(startAt), end = new Date(endAt);
  if (!['HOLIDAY', 'CLOSED', 'MAINTENANCE'].includes(kind) || !reason?.trim() || reason.length > 500 ||
      Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end || start < new Date()) {
    return res.status(400).json({ success: false, message: 'Thời gian, loại hoặc lý do đóng cửa không hợp lệ.' });
  }
  try {
    const data = await prisma.$transaction(async tx => {
      await lockPtCalendar(tx);
      const booking = await tx.booking.findFirst({ where: { type: 'PT', status: { in: PT_BOOKING_HOLD_STATUSES }, startTime: { lt: end }, endTime: { gt: start } }, select: { id: true } });
      if (booking) throw new Error(`Có Booking PT #${booking.id} trong thời gian này. Vui lòng xử lý trước.`);
      const closure = await tx.gymClosure.create({ data: { startAt: start, endAt: end, kind, reason: reason.trim() } });
      await log(tx, req.user!.userId, 'GYM_CLOSURE_ADD', null, closure);
      return closure;
    });
    return res.status(201).json({ success: true, data });
  } catch (error) { return fail(res, error); }
}

export async function removeClosure(req: AuthRequest, res: Response) {
  try {
    const data = await prisma.$transaction(async tx => {
      await lockPtCalendar(tx);
      const old = await tx.gymClosure.delete({ where: { id: Number(req.params.id) } });
      await log(tx, req.user!.userId, 'GYM_CLOSURE_REMOVE', old, null);
      return old;
    });
    return res.json({ success: true, data });
  } catch (error) { return fail(res, error); }
}

export async function getCoachCalendarOverview(req: AuthRequest, res: Response) {
  const date = req.query.date;
  if (!validDate(date)) return res.status(400).json({ success: false, message: 'Cần ngày YYYY-MM-DD.' });
  const profiles = await prisma.coachProfile.findMany({ include: { user: { select: { fullName: true, id: true } } } });
  const data = await Promise.all(profiles.map(async profile => {
    const [slots, bookings] = await Promise.all([availableSlots(prisma, profile.id, date), prisma.booking.findMany({ where: {
      coachId: profile.userId, type: 'PT', status: { in: PT_BOOKING_HOLD_STATUSES }, startTime: { gte: localInstant(date, 0), lt: localInstant(date, 1440) },
    }, select: { id: true, startTime: true, endTime: true, member: { select: { fullName: true } } } })]);
    return { coachId: profile.userId, coachName: profile.user.fullName, coachStatus: profile.status,
      bookings: bookings.map(b => ({ id: b.id, startTime: b.startTime, endTime: b.endTime, memberName: b.member.fullName })),
      slots: slots.map(slot => ({ startTime: slot.startTime, endTime: slot.endTime,
        booking: bookings.find(b => b.startTime < slot.end && b.endTime > slot.start) ?? null })) };
  }));
  return res.json({ success: true, data });
}

export async function getCalendarAudit(_req: AuthRequest, res: Response) {
  const data = await prisma.actionLog.findMany({ where: { action: { in: ['COACH_WEEKLY_AVAILABILITY', 'COACH_DATE_AVAILABILITY', 'COACH_DATE_RESET', 'GYM_CALENDAR_UPDATE', 'GYM_CLOSURE_ADD', 'GYM_CLOSURE_REMOVE', 'COACH_BOOKING_CHANGE_REQUEST', 'COACH_BOOKING_CHANGE_RESOLVED'] } },
    include: { user: { select: { fullName: true } } }, orderBy: { createdAt: 'desc' }, take: 100 });
  return res.json({ success: true, data });
}

export async function requestCoachScheduleChange(req: AuthRequest, res: Response) {
  const coachId = req.user?.userId!;
  const bookingId = Number(req.body?.bookingId);
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
  if (!Number.isSafeInteger(bookingId) || bookingId <= 0 || !reason || reason.length > 500) {
    return res.status(400).json({ success: false, message: 'Cần Booking và lý do (tối đa 500 ký tự).' });
  }
  try {
    const result = await reportCoachAbsence({ bookingId, coachId, actorId: coachId, reason });
    return res.status(201).json({ success: true,
      message: 'Đã báo vắng; hội viên được cấp quyền học bù ngay.', data: result.right });
  } catch (error) { return fail(res, error); }
}

export async function listCoachChangeRequests(req: AuthRequest, res: Response) {
  const where = req.user?.role === 'ADMIN' || req.user?.role === 'STAFF' ? {} : { coachId: req.user!.userId };
  const rows = await prisma.coachScheduleChangeRequest.findMany({ where, orderBy: { createdAt: 'desc' }, take: 100 });
  const [coaches, bookings] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: rows.map(row => row.coachId) } }, select: { id: true, fullName: true } }),
    prisma.booking.findMany({ where: { id: { in: rows.map(row => row.bookingId) } }, select: { id: true, startTime: true, member: { select: { fullName: true } } } }),
  ]);
  const data = rows.map(row => ({ ...row, coachName: coaches.find(c => c.id === row.coachId)?.fullName,
    memberName: bookings.find(b => b.id === row.bookingId)?.member.fullName,
    startTime: bookings.find(b => b.id === row.bookingId)?.startTime }));
  return res.json({ success: true, data });
}

export async function resolveCoachScheduleChange(req: AuthRequest, res: Response) {
  const id = Number(req.params.id);
  const decision = req.body?.decision;
  const adminNote = typeof req.body?.adminNote === 'string' ? req.body.adminNote.trim() : '';
  if (!Number.isSafeInteger(id) || id <= 0 || !['APPROVED', 'REJECTED'].includes(decision) || adminNote.length > 500) {
    return res.status(400).json({ success: false, message: 'Quyết định hoặc ghi chú không hợp lệ.' });
  }
  try {
    const pending = await prisma.coachScheduleChangeRequest.findUnique({ where: { id } });
    if (!pending || pending.status !== 'PENDING') throw new PtBookingError(409, 'Yêu cầu đã được xử lý.');
    if (decision === 'APPROVED') {
      const result = await reportCoachAbsence({ bookingId: pending.bookingId, coachId: pending.coachId,
        actorId: req.user!.userId, reason: pending.reason, pendingRequestId: id });
      return res.json({ success: true, data: result.right });
    }
    const updated = await prisma.coachScheduleChangeRequest.updateMany({ where: { id, status: 'PENDING' },
      data: { status: 'REJECTED', handledById: req.user!.userId, handledAt: new Date(), adminNote } });
    if (updated.count !== 1) throw new PtBookingError(409, 'Yêu cầu đã được xử lý.');
    await prisma.actionLog.create({ data: { userId: req.user!.userId, action: 'COACH_BOOKING_CHANGE_REJECTED',
      details: JSON.stringify({ requestId: id, adminNote }) } });
    return res.json({ success: true, data: { id, status: 'REJECTED' } });
  } catch (error) { return fail(res, error); }
}
