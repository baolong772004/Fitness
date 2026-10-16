import { Request, Response } from 'express';
import prisma from '../config/prisma.js';
import { AuthRequest } from '../middlewares/auth.middleware.js';



/**
 * API: Tạo Yêu cầu hỗ trợ (Member)
 * @route POST /api/support
 */
export const createTicket = async (req: AuthRequest, res: Response) => {
  try {
    const memberId = req.user?.userId;
    const { subject, message } = req.body;

    if (!memberId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    if (!subject || !message) {
      return res.status(400).json({ success: false, message: 'Thiếu tiêu đề hoặc nội dung' });
    }

    const ticket = await prisma.supportRequest.create({
      data: {
        memberId: memberId,
        subject,
        message,
        status: 'OPEN'
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Đã gửi yêu cầu hỗ trợ thành công. Chúng tôi sẽ phản hồi sớm nhất.',
      data: ticket
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Lỗi tạo yêu cầu hỗ trợ' });
  }
};

/**
 * API: Phản hồi Yêu cầu hỗ trợ (Staff/Admin)
 * @route PATCH /api/support/:id/reply
 */
export const replyTicket = async (req: AuthRequest, res: Response) => {
  try {
    const staffId = req.user?.userId;
    const ticketId = Number(req.params.id);
    const { reply, status } = req.body; // status: 'IN_PROGRESS', 'RESOLVED', 'CLOSED'

    if (!reply) return res.status(400).json({ success: false, message: 'Thiếu nội dung phản hồi' });

    const ticket = await prisma.supportRequest.update({
      where: { id: ticketId },
      data: {
        reply,
        staffId,
        status: status || 'RESOLVED'
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Đã phản hồi yêu cầu hỗ trợ',
      data: ticket
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Lỗi phản hồi yêu cầu' });
  }
};

/**
 * API: Lấy danh sách Yêu cầu (Member xem của mình, Staff xem tất cả)
 * @route GET /api/support
 */
export const getTickets = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const role = req.user?.role;

    let whereClause = {};
    if (role === 'MEMBER') {
      whereClause = { memberId: userId };
    }

    const tickets = await prisma.supportRequest.findMany({
      where: whereClause,
      include: {
        member: { select: { fullName: true, email: true } },
        staff: { select: { fullName: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.status(200).json({
      success: true,
      data: tickets
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Lỗi lấy danh sách yêu cầu' });
  }
};
