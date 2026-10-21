import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../config/prisma.js';
import { AuthRequest } from '../middlewares/auth.middleware.js';
import { lockPtCalendar, lockPtCoach, PtBookingError } from '../services/ptBooking.service.js';
import { PT_LEVELS } from '../services/ptWallet.service.js';


/**
 * API 1: Lấy danh sách Coach (kèm bộ lọc)
 * @route GET /api/admin/trainers
 */
export const getTrainersList = async (req: AuthRequest, res: Response) => {
  try {
    const { search, specialization, status, page = 1, limit = 10 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const whereCondition: Prisma.CoachProfileWhereInput = { user: { role: 'COACH' } };

    if (search) {
      whereCondition.user = {
        role: 'COACH',
        OR: [
          { fullName: { contains: String(search) } },
          { email: { contains: String(search) } },
          { phone: { contains: String(search) } },
        ]
      };
    }

    if (specialization) {
      whereCondition.specialization = { contains: String(specialization) };
    }

    if (status) {
      whereCondition.status = String(status);
    }

    const [trainers, total] = await Promise.all([
      prisma.coachProfile.findMany({
        where: whereCondition,
        include: {
          specializations: { select: { level: true } },
          user: {
            select: { fullName: true, email: true, phone: true, avatar: true }
          }
        },
        skip: Number(skip),
        take: Number(limit),
        orderBy: { createdAt: 'desc' }
      }),
      prisma.coachProfile.count({ where: whereCondition })
    ]);

    return res.status(200).json({
      success: true,
      data: trainers,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      }
    });
  } catch (error: any) {
    console.error('Lỗi getTrainersList:', error);
    return res.status(500).json({ success: false, message: 'Lỗi lấy danh sách Coach' });
  }
}

/**
 * API 2: Tạo mới hoặc cập nhật hồ sơ Coach (chuyên môn và giá)
 * @route POST /api/admin/trainers/setup
 */
export const setupTrainerProfile = async (req: AuthRequest, res: Response) => {
  try {
    const {
      userId,
      bio,
      specialties, // Dạng mảng string hoặc string
      hourlyRate,
      experienceYears,
      workingSchedules,
    } = req.body;

    const targetUserId = Number(userId);
    const rate = Number(hourlyRate);
    if (!Number.isInteger(targetUserId) || targetUserId <= 0 || !Number.isFinite(rate) || rate < 0) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập đầy đủ thông tin bắt buộc (userId, hourlyRate)' });
    }
    if (workingSchedules !== undefined) {
      return res.status(400).json({ success: false, message: 'Coach tự đăng ký lịch qua /api/pt/coach/availability; Admin chỉ cấu hình hồ sơ và lịch chung.' });
    }

    const user = await prisma.user.findUnique({ where: { id: targetUserId }, select: { role: true } });
    if (!user) {
       return res.status(404).json({ success: false, message: 'Không tìm thấy User' });
    }
    if (user.role !== 'COACH') {
       return res.status(400).json({ success: false, message: 'Tài khoản này không phải HLV. Hãy cấp vai trò HLV trước khi tạo hồ sơ.' });
    }

    const formattedSpecialties = Array.isArray(specialties) ? specialties.join(', ') : specialties;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Cập nhật hoặc Tạo CoachProfile
      const profile = await tx.coachProfile.upsert({
        where: { userId: targetUserId },
        update: {
          ...(bio !== undefined ? { bio } : {}),
          ...(formattedSpecialties !== undefined ? { specialization: formattedSpecialties } : {}),
          hourlyRate: rate,
          ...(experienceYears !== undefined ? { experience: Number(experienceYears) } : {}),
        },
        create: {
          userId: targetUserId,
          bio,
          specialization: formattedSpecialties,
          hourlyRate: rate,
          experience: Number(experienceYears || 1),
          status: 'ACTIVE'
        },
      });

      return profile;
    });

    return res.status(200).json({
      success: true,
      message: 'Đã lưu hồ sơ Coach. Coach tự đăng ký lịch làm việc.',
      data: result,
    });
  } catch (error: any) {
    console.error('Lỗi setupTrainerProfile:', error);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi thiết lập Coach' });
  }
};

/** Update pricing by CoachProfile ID, without changing any user's role. */
export const updateTrainerPricing = async (req: AuthRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    const hourlyRate = Number(req.body?.hourlyRate);
    const commissionPercent = Number(req.body?.commissionPercent);
    const rank = req.body?.rank;
    const levels = req.body?.levels;

    if (!Number.isInteger(id) || id <= 0 || !Number.isFinite(hourlyRate) || hourlyRate < 0 ||
        !Number.isInteger(commissionPercent) || commissionPercent < 0 || commissionPercent > 100 ||
        !['junior', 'senior', 'master'].includes(rank) ||
        (levels !== undefined && (!Array.isArray(levels) || levels.length > PT_LEVELS.length ||
          new Set(levels).size !== levels.length || levels.some(level => !PT_LEVELS.includes(level))))) {
      return res.status(400).json({ success: false, message: 'Giá, hoa hồng, cấp bậc hoặc cấp độ PT không hợp lệ.' });
    }

    const profile = await prisma.coachProfile.findUnique({
      where: { id },
      select: { id: true, userId: true, user: { select: { role: true } } }
    });
    if (!profile || profile.user.role !== 'COACH') {
      return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ HLV hợp lệ.' });
    }

    const updated = await prisma.$transaction(async tx => {
      if (levels !== undefined) {
        await lockPtCalendar(tx);
        await lockPtCoach(tx, profile.userId);
        const previous = await tx.coachSpecialization.findMany({ where: { coachProfileId: id },
          select: { level: true } });
        const removed = previous.map(row => row.level).filter(level => !levels.includes(level));
        const added = levels.filter((level: string) => !previous.some(row => row.level === level));
        if (removed.length) {
          const affected = await tx.booking.findFirst({ where: { coachId: profile.userId, type: 'PT',
            status: { in: ['PENDING', 'UPCOMING', 'CONFIRMED', 'IN_PROGRESS'] },
            startTime: { gt: new Date() },
            ptCreditAllocation: { is: { batch: { level: { in: removed } } } },
          }, select: { id: true } });
          if (affected) throw new PtBookingError(409, `Coach còn Booking #${affected.id} ở cấp độ đang xóa.`);
          await tx.coachSpecialization.deleteMany({ where: { coachProfileId: id,
            level: { in: removed } } });
        }
        if (added.length) await tx.coachSpecialization.createMany({ data: added.map((level: string) => ({
          coachProfileId: id, level,
        })) });
        if (removed.length || added.length) await tx.actionLog.create({ data: {
          userId: req.user!.userId, action: 'COACH_SPECIALIZATION_UPDATE',
          details: JSON.stringify({ coachId: profile.userId, levels }),
        } });
      }
      return tx.coachProfile.update({ where: { id }, data: { hourlyRate, commissionPercent, rank },
        include: { specializations: { select: { level: true } } } });
    });
    return res.status(200).json({ success: true, data: updated, message: 'Đã lưu cấu hình HLV.' });
  } catch (error) {
    if (error instanceof PtBookingError) return res.status(error.status).json({ success: false, message: error.message });
    console.error('Lỗi updateTrainerPricing:', error);
    return res.status(500).json({ success: false, message: 'Không thể cập nhật giá HLV.' });
  }
};

/**
 * API 3: Khóa / Mở khóa tài khoản Coach
 * @route PATCH /api/admin/trainers/:id/status
 */
export const toggleTrainerStatus = async (req: AuthRequest, res: Response) => {
  try {
    const trainerProfileId = Number(req.params.id);
    const { status } = req.body; // 'ACTIVE' | 'BLOCKED' | 'INACTIVE'

    if (!['ACTIVE', 'BLOCKED', 'INACTIVE'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Status không hợp lệ' });
    }

    const updatedProfile = await prisma.coachProfile.update({
      where: { id: trainerProfileId },
      data: { status },
    });

    return res.status(200).json({
      success: true,
      message: `Đã cập nhật trạng thái Coach thành ${status}`,
      data: updatedProfile,
    });
  } catch (error: any) {
    console.error('Lỗi toggleTrainerStatus:', error);
    return res.status(500).json({ success: false, message: 'Lỗi cập nhật trạng thái Coach' });
  }
};
