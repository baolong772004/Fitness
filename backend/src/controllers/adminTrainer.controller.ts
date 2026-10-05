import { Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { AuthRequest } from '../middlewares/auth.middleware.js';

const prisma = new PrismaClient();

/**
 * API 1: Lấy danh sách Coach (kèm bộ lọc)
 * @route GET /api/admin/trainers
 */
export const getTrainersList = async (req: AuthRequest, res: Response) => {
  try {
    const { search, specialization, status, page = 1, limit = 10 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    let whereCondition: Prisma.CoachProfileWhereInput = {};

    if (search) {
      whereCondition.user = {
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
 * API 2: Tạo mới hoặc Cập nhật Hồ sơ Coach (Gồm Chuyên môn, Giá, Lịch làm việc)
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
      workingSchedules, // Mảng lịch: [{ dayOfWeek: 1, startTime: "08:00", endTime: "17:00" }]
    } = req.body;

    if (!userId || hourlyRate === undefined) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập đầy đủ thông tin bắt buộc (userId, hourlyRate)' });
    }

    // Đảm bảo user có tồn tại và đang có role là COACH
    const user = await prisma.user.findUnique({ where: { id: Number(userId) } });
    if (!user) {
       return res.status(404).json({ success: false, message: 'Không tìm thấy User' });
    }
    // Nếu chưa là COACH thì update role cho họ luôn
    if (user.role !== 'COACH') {
       await prisma.user.update({ where: { id: Number(userId) }, data: { role: 'COACH' } });
    }

    const formattedSpecialties = Array.isArray(specialties) ? specialties.join(', ') : specialties;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Cập nhật hoặc Tạo CoachProfile
      const profile = await tx.coachProfile.upsert({
        where: { userId: Number(userId) },
        update: {
          bio,
          specialization: formattedSpecialties,
          hourlyRate: Number(hourlyRate),
          experience: Number(experienceYears || 1),
        },
        create: {
          userId: Number(userId),
          bio,
          specialization: formattedSpecialties,
          hourlyRate: Number(hourlyRate),
          experience: Number(experienceYears || 1),
          status: 'ACTIVE'
        },
      });

      // 2. Cập nhật Lịch làm việc
      if (workingSchedules && Array.isArray(workingSchedules)) {
        await tx.coachSchedule.deleteMany({
          where: { coachProfileId: profile.id },
        });

        const schedulesData = workingSchedules.map((schedule: any) => ({
          coachProfileId: profile.id,
          dayOfWeek: Number(schedule.dayOfWeek),
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          isAvailable: schedule.isAvailable ?? true,
        }));

        if (schedulesData.length > 0) {
            await tx.coachSchedule.createMany({
            data: schedulesData,
            });
        }
      }

      return profile;
    });

    return res.status(200).json({
      success: true,
      message: 'Thiết lập thông tin & Lịch làm việc cho Coach thành công!',
      data: result,
    });
  } catch (error: any) {
    console.error('Lỗi setupTrainerProfile:', error);
    return res.status(500).json({ success: false, message: 'Lỗi máy chủ khi thiết lập Coach' });
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
