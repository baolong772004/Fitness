import type { Response } from 'express';
import prisma from '../config/prisma.js';
import type { AuthRequest } from '../middlewares/auth.middleware.js';
import { PT_LEVELS, walletSummary } from '../services/ptWallet.service.js';
import { createWalletPtBookings, lockPtCalendar, lockPtCoach, lockPtMember, PtBookingError } from '../services/ptBooking.service.js';
import { createUserNotification } from '../services/notification.service.js';
import { emitCoachScheduleChanged } from '../sockets/ptChat.socket.js';

export async function getMyPtWallet(req: AuthRequest, res: Response) {
  if (!req.user?.userId) return res.status(401).json({ success: false });
  return res.json({ success: true, data: await walletSummary(prisma, req.user.userId) });
}

export async function getMyPtCreditHistory(req: AuthRequest, res: Response) {
  if (!req.user?.userId) return res.status(401).json({ success: false });
  const data = await prisma.ptCreditTransaction.findMany({ where: {
    batch: { wallet: { memberId: req.user.userId } },
  }, include: { batch: { select: { level: true, source: true, paymentId: true, membershipId: true,
    startAt: true, endAt: true, activatedAt: true,
    membership: { select: { startDate: true, endDate: true } } } } },
  orderBy: { createdAt: 'desc' }, take: 200 });
  return res.json({ success: true, data });
}

export async function getMyPtRenewalHistory(req: AuthRequest, res: Response) {
  if (!req.user?.userId) return res.status(401).json({ success: false });
  const data = await prisma.ptRenewalEvent.findMany({ where: {
    batch: { wallet: { memberId: req.user.userId } },
  }, include: { batch: { select: { level: true } },
    payment: { select: { amount: true, paidAt: true, status: true } } },
  orderBy: { createdAt: 'desc' }, take: 100 });
  return res.json({ success: true, data });
}

export async function listPtProducts(_req: AuthRequest, res: Response) {
  const data = await prisma.ptProduct.findMany({ where: { isActive: true, durationDays: { gt: 0 } }, orderBy: [{ level: 'asc' }, { sessionCount: 'asc' }] });
  return res.json({ success: true, data });
}

export async function listAllPtProducts(_req: AuthRequest, res: Response) {
  const data = await prisma.ptProduct.findMany({ orderBy: [{ level: 'asc' }, { sessionCount: 'asc' }] });
  return res.json({ success: true, data });
}

export async function listPtSingleOffers(_req: AuthRequest, res: Response) {
  const data = await prisma.ptSingleOffer.findMany({ where: { isActive: true }, orderBy: { level: 'asc' } });
  return res.json({ success: true, data });
}

export async function listAllPtSingleOffers(_req: AuthRequest, res: Response) {
  const data = await prisma.ptSingleOffer.findMany({ orderBy: { level: 'asc' } });
  return res.json({ success: true, data });
}

export async function savePtSingleOffer(req: AuthRequest, res: Response) {
  const level = String(req.params.level);
  const price = Number(req.body?.price), durationDays = Number(req.body?.durationDays);
  const maxQuantity = Number(req.body?.maxQuantity);
  const benefits = req.body?.benefits;
  if (!PT_LEVELS.slice(1).includes(level as typeof PT_LEVELS[number]) ||
    !Number.isSafeInteger(price) || price < 1 || price > 1000000000 ||
    !Number.isSafeInteger(durationDays) || durationDays < 1 || durationDays > 3650 ||
    !Number.isSafeInteger(maxQuantity) || maxQuantity < 1 || maxQuantity > 100 ||
    (benefits != null && (typeof benefits !== 'string' || benefits.length > 1000))) {
    return res.status(400).json({ success: false, message: 'Cấu hình buổi lẻ không hợp lệ.' });
  }
  const data = await prisma.ptSingleOffer.upsert({ where: { level },
    create: { level, price, durationDays, maxQuantity, benefits: benefits?.trim() || null },
    update: { price, durationDays, maxQuantity, benefits: benefits?.trim() || null } });
  return res.json({ success: true, data });
}

export async function setPtSingleOfferActive(req: AuthRequest, res: Response) {
  const level = String(req.params.level);
  if (!PT_LEVELS.slice(1).includes(level as typeof PT_LEVELS[number]) || typeof req.body?.isActive !== 'boolean') {
    return res.status(400).json({ success: false });
  }
  const updated = await prisma.ptSingleOffer.updateMany({ where: { level }, data: { isActive: req.body.isActive } });
  return res.status(updated.count ? 200 : 404).json({ success: Boolean(updated.count) });
}

export async function listPtRenewalOptions(_req: AuthRequest, res: Response) {
  const data = await prisma.ptRenewalOption.findMany({ where: { isActive: true },
    orderBy: [{ level: 'asc' }, { durationDays: 'asc' }] });
  return res.json({ success: true, data });
}

export async function listAllPtRenewalOptions(_req: AuthRequest, res: Response) {
  const data = await prisma.ptRenewalOption.findMany({
    orderBy: [{ level: 'asc' }, { durationDays: 'asc' }] });
  return res.json({ success: true, data });
}

async function renewalOptionInput(body: unknown) {
  const value = body as Record<string, unknown> | null;
  const productId = Number(value?.productId), durationDays = Number(value?.durationDays), price = Number(value?.price);
  if (!Number.isSafeInteger(durationDays) || durationDays < 1 || durationDays > 3650 ||
    !Number.isSafeInteger(price) || price < 1 || price > 1000000000) return null;
  if (value?.purchaseMode === 'SINGLE') {
    const level = value?.level;
    if (typeof level !== 'string' || !PT_LEVELS.slice(1).includes(level as typeof PT_LEVELS[number])) return null;
    return { name: `PT ${level} buổi lẻ`, level, durationDays, price, ptProductId: null, purchaseMode: 'SINGLE' };
  }
  if (!Number.isSafeInteger(productId) || productId <= 0 || (value?.purchaseMode != null && value.purchaseMode !== 'PACKAGE')) return null;
  const product = await prisma.ptProduct.findFirst({ where: {
    id: productId, isActive: true, durationDays: { gt: 0 }, level: { in: PT_LEVELS.slice(1) },
  } });
  if (!product || !product.durationDays || product.durationDays > 3650) return null;
  return { name: product.name, level: product.level, durationDays, price, ptProductId: product.id,
    purchaseMode: value?.purchaseMode === 'PACKAGE' ? 'PACKAGE' : null };
}

export async function createPtRenewalOption(req: AuthRequest, res: Response) {
  const data = await renewalOptionInput(req.body);
  if (!data) return res.status(400).json({ success: false, message: 'Chọn gói PT đang bán, nhập số ngày và giá gia hạn hợp lệ.' });
  return res.status(201).json({ success: true, data: await prisma.ptRenewalOption.create({ data }) });
}

export async function updatePtRenewalOption(req: AuthRequest, res: Response) {
  const id = Number(req.params.id), data = await renewalOptionInput(req.body);
  if (!Number.isSafeInteger(id) || id <= 0 || !data) return res.status(400).json({ success: false, message: 'Chọn gói PT đang bán, nhập số ngày và giá gia hạn hợp lệ.' });
  const updated = await prisma.ptRenewalOption.updateMany({ where: { id }, data });
  if (!updated.count) return res.status(404).json({ success: false });
  return res.json({ success: true, data: await prisma.ptRenewalOption.findUnique({ where: { id } }) });
}

export async function archivePtRenewalOption(req: AuthRequest, res: Response) {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ success: false });
  const updated = await prisma.ptRenewalOption.updateMany({ where: { id, isActive: true }, data: { isActive: false } });
  return res.status(updated.count ? 200 : 404).json({ success: Boolean(updated.count) });
}

export async function restorePtRenewalOption(req: AuthRequest, res: Response) {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ success: false });
  const updated = await prisma.ptRenewalOption.updateMany({ where: { id, isActive: false }, data: { isActive: true } });
  return res.status(updated.count ? 200 : 404).json({ success: Boolean(updated.count) });
}

export async function getAdminPtWallet(req: AuthRequest, res: Response) {
  const memberId = Number(req.params.memberId);
  if (!Number.isSafeInteger(memberId) || memberId <= 0) return res.status(400).json({ success: false });
  const [summary, batches, transactions, renewals] = await Promise.all([
    walletSummary(prisma, memberId),
    prisma.ptCreditBatch.findMany({ where: { wallet: { memberId } },
      orderBy: { grantedAt: 'desc' }, take: 100 }),
    prisma.ptCreditTransaction.findMany({ where: { batch: { wallet: { memberId } } },
      orderBy: { createdAt: 'desc' }, take: 100 }),
    prisma.ptRenewalEvent.findMany({ where: { batch: { wallet: { memberId } } },
      include: { payment: { select: { amount: true, paidAt: true } } },
      orderBy: { createdAt: 'desc' }, take: 100 }),
  ]);
  return res.json({ success: true, data: { summary, batches, transactions, renewals } });
}

export async function adjustPtWallet(req: AuthRequest, res: Response) {
  const memberId = Number(req.params.memberId), level = req.body?.level;
  const delta = Number(req.body?.delta), reason = String(req.body?.reason ?? '').trim();
  if (!Number.isSafeInteger(memberId) || memberId <= 0 || !PT_LEVELS.slice(1).includes(level) ||
    !Number.isSafeInteger(delta) || delta === 0 || Math.abs(delta) > 100 || !reason || reason.length > 500) {
    return res.status(400).json({ success: false, message: 'Cần hội viên, cấp độ trả phí, số buổi ±1..100 và lý do.' });
  }
  try {
    await prisma.$transaction(async tx => {
      await lockPtMember(tx, memberId);
      const member = await tx.user.findFirst({ where: { id: memberId, role: 'MEMBER' }, select: { id: true } });
      if (!member) throw new PtBookingError(404, 'Hội viên không tồn tại.');
      if (delta > 0) {
        const wallet = await tx.ptWallet.upsert({ where: { memberId }, create: { memberId }, update: {} });
        const batch = await tx.ptCreditBatch.create({ data: { walletId: wallet.id,
          level, source: 'ADMIN_ADJUSTMENT', initialCount: delta } });
        await tx.ptCreditTransaction.create({ data: { batchId: batch.id, kind: 'ADMIN_CREDIT',
          quantity: delta, actorId: req.user!.userId, note: reason } });
      } else {
        let needed = -delta;
        const now = new Date();
        const batches = await tx.ptCreditBatch.findMany({ where: { wallet: { memberId }, level,
          OR: [{ endAt: null }, { endAt: { gt: now } }],
          AND: [{ OR: [{ startAt: null }, { startAt: { lte: now } }] }] },
          orderBy: [{ grantedAt: 'asc' }, { id: 'asc' }] });
        batches.sort((a, b) => (a.endAt?.getTime() ?? Infinity) - (b.endAt?.getTime() ?? Infinity) ||
          a.grantedAt.getTime() - b.grantedAt.getTime() || a.id - b.id);
        if (batches.reduce((sum, batch) => sum + batch.initialCount - batch.usedCount - batch.heldCount, 0) < needed) {
          throw new PtBookingError(409, 'Không đủ credit khả dụng để điều chỉnh.');
        }
        for (const batch of batches) {
          const take = Math.min(needed, batch.initialCount - batch.usedCount - batch.heldCount);
          if (take <= 0) continue;
          const updated = await tx.ptCreditBatch.updateMany({ where: { id: batch.id,
            usedCount: batch.usedCount, heldCount: batch.heldCount },
            data: { usedCount: { increment: take } } });
          if (updated.count !== 1) throw new PtBookingError(409, 'Số dư PT vừa thay đổi.');
          await tx.ptCreditTransaction.create({ data: { batchId: batch.id, kind: 'ADMIN_DEBIT',
            quantity: take, actorId: req.user!.userId, note: reason } });
          needed -= take;
          if (!needed) break;
        }
      }
      await tx.actionLog.create({ data: { userId: req.user!.userId, action: 'PT_WALLET_ADJUST',
        details: JSON.stringify({ memberId, level, delta, reason }) } });
    });
    return res.json({ success: true, data: await walletSummary(prisma, memberId) });
  } catch (error) {
    if (error instanceof PtBookingError) return res.status(error.status).json({ success: false, message: error.message });
    throw error;
  }
}

export async function createPtProduct(req: AuthRequest, res: Response) {
  const { name, level } = req.body ?? {};
  const sessionCount = Number(req.body?.sessionCount), price = Number(req.body?.price);
  const singleSessionPrice = req.body?.singleSessionPrice == null || req.body.singleSessionPrice === ''
    ? null : Number(req.body.singleSessionPrice);
  const durationDays = Number(req.body?.durationDays);
  const benefits = req.body?.benefits;
  if (typeof name !== 'string' || !name.trim() || name.length > 100 ||
    !PT_LEVELS.slice(1).includes(level) || !Number.isSafeInteger(sessionCount) || sessionCount < 1 || sessionCount > 100 ||
    !Number.isSafeInteger(price) || price <= 0 ||
    (singleSessionPrice !== null && (!Number.isSafeInteger(singleSessionPrice) || singleSessionPrice <= 0)) ||
    !Number.isSafeInteger(durationDays) || durationDays < 1 || durationDays > 3650 ||
    (benefits != null && (typeof benefits !== 'string' || benefits.length > 1000))) {
    return res.status(400).json({ success: false, message: 'Tên, cấp độ, số buổi hoặc giá không hợp lệ.' });
  }
  const data = await prisma.ptProduct.create({ data: { name: name.trim(), level, sessionCount, price, singleSessionPrice, durationDays, benefits: benefits?.trim() || null } });
  return res.status(201).json({ success: true, data });
}

export async function updatePtProduct(req: AuthRequest, res: Response) {
  const id = Number(req.params.id);
  const { name, level } = req.body ?? {};
  const sessionCount = Number(req.body?.sessionCount), price = Number(req.body?.price);
  const singleSessionPrice = req.body?.singleSessionPrice == null || req.body.singleSessionPrice === ''
    ? null : Number(req.body.singleSessionPrice);
  const durationDays = Number(req.body?.durationDays);
  const benefits = req.body?.benefits;
  if (!Number.isSafeInteger(id) || id <= 0 || typeof name !== 'string' || !name.trim() || name.length > 100 ||
    !PT_LEVELS.slice(1).includes(level) || !Number.isSafeInteger(sessionCount) || sessionCount < 1 || sessionCount > 100 ||
    !Number.isSafeInteger(price) || price <= 0 ||
    (singleSessionPrice !== null && (!Number.isSafeInteger(singleSessionPrice) || singleSessionPrice <= 0)) ||
    !Number.isSafeInteger(durationDays) ||
    durationDays < 1 || durationDays > 3650 ||
    (benefits != null && (typeof benefits !== 'string' || benefits.length > 1000))) return res.status(400).json({ success: false, message: 'Thông tin gói PT không hợp lệ.' });
  const result = await prisma.ptProduct.updateMany({ where: { id },
    data: { name: name.trim(), level, sessionCount, price, singleSessionPrice, durationDays, benefits: benefits?.trim() || null } });
  if (!result.count) return res.status(404).json({ success: false });
  return res.json({ success: true, data: await prisma.ptProduct.findUnique({ where: { id } }) });
}

export async function archivePtProduct(req: AuthRequest, res: Response) {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ success: false });
  const updated = await prisma.ptProduct.updateMany({ where: { id, isActive: true }, data: { isActive: false } });
  return res.status(updated.count ? 200 : 404).json({ success: Boolean(updated.count) });
}

export async function restorePtProduct(req: AuthRequest, res: Response) {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ success: false });
  const updated = await prisma.ptProduct.updateMany({ where: { id, isActive: false }, data: { isActive: true } });
  return res.status(updated.count ? 200 : 404).json({ success: Boolean(updated.count) });
}

export async function setCoachSpecializations(req: AuthRequest, res: Response) {
  const coachId = Number(req.params.coachId), levels = req.body?.levels;
  if (!Number.isSafeInteger(coachId) || coachId <= 0 || !Array.isArray(levels) ||
    levels.length > 4 || new Set(levels).size !== levels.length || levels.some(level => !PT_LEVELS.includes(level))) {
    return res.status(400).json({ success: false, message: 'Danh sách cấp độ không hợp lệ.' });
  }
  const data = await prisma.$transaction(async tx => {
    await lockPtCalendar(tx);
    await lockPtCoach(tx, coachId);
    const profile = await tx.coachProfile.findUnique({ where: { userId: coachId } });
    if (!profile) throw new PtBookingError(404, 'Coach không tồn tại.');
    const previous = await tx.coachSpecialization.findMany({ where: { coachProfileId: profile.id },
      select: { level: true } });
    const removed = previous.map(row => row.level).filter(level => !levels.includes(level));
    if (removed.length) {
      const affected = await tx.booking.findFirst({ where: { coachId, type: 'PT',
        status: { in: ['PENDING', 'UPCOMING', 'CONFIRMED', 'IN_PROGRESS'] }, startTime: { gt: new Date() },
        ptCreditAllocation: { is: { batch: { level: { in: removed } } } },
      }, select: { id: true } });
      if (affected) throw new PtBookingError(409, `Coach còn Booking #${affected.id} ở cấp độ đang xóa.`);
    }
    await tx.coachSpecialization.deleteMany({ where: { coachProfileId: profile.id } });
    if (levels.length) await tx.coachSpecialization.createMany({ data: levels.map(level => ({ coachProfileId: profile.id, level })) });
    await tx.actionLog.create({ data: { userId: req.user!.userId, action: 'COACH_SPECIALIZATION_UPDATE',
      details: JSON.stringify({ coachId, levels }) } });
    return levels;
  });
  return res.json({ success: true, data });
}

export async function createWalletBooking(req: AuthRequest, res: Response) {
  const memberId = req.user?.userId;
  if (!memberId) return res.status(401).json({ success: false });
  const raw = req.body?.bookingDates ?? (req.body?.bookingDate ? [req.body.bookingDate] : null);
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 20 || raw.some(value => typeof value !== 'string')) {
    return res.status(400).json({ success: false, message: 'Chọn 1–20 ca tập hợp lệ.' });
  }
  try {
    const bookings = await createWalletPtBookings({ memberId, coachId: Number(req.body?.coachId),
      level: req.body?.level, starts: raw.map(value => new Date(value)) });
    emitCoachScheduleChanged(Number(req.body.coachId));
    void createUserNotification({ userId: Number(req.body.coachId), title: 'Lịch tập PT mới',
      message: `Hội viên #${memberId} đã đặt ${bookings.length} ca PT ${req.body.level}.` })
      .catch(error => console.error('PT notification failed:', error));
    return res.status(201).json({ success: true, data: bookings });
  } catch (error) {
    if (error instanceof PtBookingError) return res.status(error.status).json({ success: false, message: error.message });
    console.error('Wallet booking failed:', error);
    return res.status(500).json({ success: false, message: 'Không thể đặt lịch PT.' });
  }
}
