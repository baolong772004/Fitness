import { Request, Response } from 'express';
import prisma from '../config/prisma.js';
import { AuthRequest } from '../middlewares/auth.middleware.js';



/**
 * API: Tạo đánh giá (Review) cho PT
 * @route POST /api/reviews
 */
export const createReview = async (req: AuthRequest, res: Response) => {
  try {
    const memberId = req.user?.userId;
    const { coachProfileId, rating, comment } = req.body;

    if (!memberId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    if (!coachProfileId || !rating) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin đánh giá (coachProfileId, rating)' });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Rating phải từ 1 đến 5 sao' });
    }

    // Kiểm tra xem Member này đã từng học PT này chưa? (Phải học rồi mới được đánh giá)
    const hasTrained = await prisma.booking.findFirst({
      where: {
        memberId: memberId,
        coach: {
          coachProfile: { id: Number(coachProfileId) }
        },
        status: 'COMPLETED'
      }
    });

    if (!hasTrained) {
       return res.status(403).json({ success: false, message: 'Bạn chưa từng hoàn thành buổi tập nào với PT này nên không thể đánh giá.' });
    }

    // Bắt đầu Transaction: Vừa tạo Review, Vừa tính toán lại Average Rating cho PT
    const result = await prisma.$transaction(async (tx) => {
      // 1. Tạo Review
      const review = await tx.review.create({
        data: {
          memberId: memberId,
          coachProfileId: Number(coachProfileId),
          rating: Number(rating),
          comment: comment || null,
        }
      });

      // 2. Tính lại điểm trung bình
      const allReviews = await tx.review.findMany({
        where: { coachProfileId: Number(coachProfileId) },
        select: { rating: true }
      });

      const totalRating = allReviews.reduce((sum, rev) => sum + rev.rating, 0);
      const averageRating = totalRating / allReviews.length;

      // 3. Cập nhật vào CoachProfile
      await tx.coachProfile.update({
        where: { id: Number(coachProfileId) },
        data: { rating: averageRating }
      });

      return { review, averageRating };
    });

    return res.status(201).json({
      success: true,
      message: 'Cảm ơn bạn đã đánh giá PT!',
      data: result
    });
  } catch (error: any) {
    console.error('Lỗi createReview:', error);
    return res.status(500).json({ success: false, message: 'Lỗi hệ thống khi gửi đánh giá' });
  }
};

/**
 * API: Lấy danh sách đánh giá của 1 PT
 * @route GET /api/reviews/coach/{coachProfileId}
 */
export const getCoachReviews = async (req: Request, res: Response) => {
  try {
    const coachProfileId = Number(req.params.coachProfileId);
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where: { coachProfileId },
        include: {
          member: { select: { fullName: true, avatar: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.review.count({ where: { coachProfileId } })
    ]);

    return res.status(200).json({
      success: true,
      data: reviews,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error: any) {
    console.error('Lỗi getCoachReviews:', error);
    return res.status(500).json({ success: false, message: 'Lỗi lấy danh sách đánh giá' });
  }
};
