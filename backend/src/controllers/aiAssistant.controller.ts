import type { Request, Response } from 'express';
import prisma from '../config/prisma.js';
import { searchBusinessKnowledge } from '../services/aiKnowledge.service.js';

const MAX_MESSAGE_LENGTH = 2000;
const MAX_HISTORY_LENGTH = 12;

async function loadBusinessContext() {
  const [packages, trainers, ptProducts, singleOffers, gymCalendarConfig, gymClosures] = await Promise.all([
    prisma.package.findMany({
      where: { isActive: true },
      select: { name: true, description: true, price: true, durationDays: true, trialPtSessions: true, type: true },
      orderBy: { price: 'asc' },
    }),
    prisma.coachProfile.findMany({
      where: { status: 'ACTIVE', user: { role: { in: ['COACH', 'TRAINER'] }, status: 'ACTIVE' } },
      select: {
        bio: true, specialization: true, specializations: { select: { level: true } }, experience: true,
        certifications: true, rating: true, hourlyRate: true, user: { select: { fullName: true } },
      },
      orderBy: [{ rating: 'desc' }, { hourlyRate: 'asc' }],
      take: 50,
    }),
    prisma.ptProduct.findMany({
      where: { isActive: true },
      select: { name: true, level: true, sessionCount: true, durationDays: true, price: true, benefits: true },
      orderBy: [{ level: 'asc' }, { sessionCount: 'asc' }],
    }),
    prisma.ptSingleOffer.findMany({
      where: { isActive: true },
      select: { level: true, price: true, durationDays: true, maxQuantity: true, benefits: true },
      orderBy: { level: 'asc' },
    }),
    prisma.gymCalendarConfig.findUnique({
      where: { id: 1 },
      select: { openTime: true, closeTime: true, slotMinutes: true, breakMinutes: true },
    }),
    prisma.gymClosure.findMany({
      where: { startAt: { gte: new Date() } },
      select: { startAt: true, endAt: true, reason: true },
      orderBy: { startAt: 'asc' },
      take: 30,
    }),
  ]);

  return { packages, trainers, ptProducts, singleOffers, gymCalendarConfig, gymClosures };
}

function readGeminiText(payload: any) {
  return payload?.candidates?.[0]?.content?.parts
    ?.map((part: any) => typeof part?.text === 'string' ? part.text : '')
    .join('')
    .trim();
}

function cleanAssistantText(text: string) {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/(^|\n)\s*#{1,6}\s+/g, '$1')
    .replace(/\*+/g, '')
    .replace(/(^|\n)\s*-\s+/g, '$1• ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function chatWithBusinessAssistant(req: Request, res: Response) {
  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  const history = Array.isArray(req.body?.history)
    ? req.body.history.filter((item: any) => ['user', 'assistant'].includes(item?.role) && typeof item?.text === 'string')
      .slice(-MAX_HISTORY_LENGTH).map((item: any) => ({ role: item.role, text: item.text.slice(0, 500) }))
    : [];

  if (!message) return res.status(400).json({ success: false, message: 'Vui lòng nhập câu hỏi.' });
  if (message.length > MAX_MESSAGE_LENGTH) return res.status(400).json({ success: false, message: 'Câu hỏi tối đa 2000 ký tự.' });

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return res.status(503).json({ success: false, message: 'Máy chủ chưa cấu hình GEMINI_API_KEY.' });

  try {
    const [context, knowledge] = await Promise.all([
      loadBusinessContext(),
      searchBusinessKnowledge(message),
    ]);
    const prompt = `Bạn là AURA Fitness AI, tư vấn viên nghiệp vụ của phòng gym AURA Fitness tại Việt Nam.
Chỉ trả lời dựa trên dữ liệu thực tế trong phần NGỮ CẢNH. Không bịa tên, giá, chính sách, khuyến mãi hoặc thông tin chưa có.
Nếu dữ liệu không có câu trả lời, hãy nói rõ và hướng dẫn khách liên hệ quầy lễ tân. Không tư vấn sức khỏe chẩn đoán bệnh. Có thể so sánh, gợi ý gói/HLV phù hợp dựa trên ngân sách và mục tiêu đã được người dùng cung cấp.

NGỮ CẢNH:
${JSON.stringify(context)}

TÀI LIỆU NGHIỆP VỤ LIÊN QUAN ĐƯỢC TÌM TỪ VECTOR DATABASE:
${JSON.stringify(knowledge)}

LỊCH SỬ HỘI THOẠI:
${JSON.stringify(history)}

Câu hỏi mới của khách: ${message}

Trả lời bằng tiếng Việt, ngắn gọn, thân thiện, có phân mục khi cần. Không dùng JSON hay markdown bảng. Tuyệt đối không dùng dấu sao (*), dấu gạch đầu dòng Markdown hoặc ký hiệu ** để định dạng. Được dùng xuống dòng, tiêu đề ngắn không dấu #, và ký hiệu • cho danh sách. Bọc giá bằng định dạng dễ đọc, ví dụ 500.000 VNĐ.`;

    const model = process.env.GEMINI_MODEL?.trim() || 'gemini-3.5-flash-lite';
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(45_000),
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 1200 },
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return res.status(502).json({ success: false, message: 'Dịch vụ AI đang bận. Vui lòng thử lại sau.' });

    const answer = readGeminiText(body);
    if (!answer) return res.status(502).json({ success: false, message: 'AI chưa thể tạo câu trả lời.' });
    return res.json({ success: true, data: { message: cleanAssistantText(answer) } });
  } catch (error: any) {
    console.error('AI assistant error:', error);
    const messageText = error?.name === 'TimeoutError' ? 'AI phản hồi quá lâu. Vui lòng thử lại.' : 'Không thể kết nối dịch vụ AI.';
    return res.status(502).json({ success: false, message: messageText });
  }
}
