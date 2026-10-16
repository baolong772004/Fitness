import 'dotenv/config';
import { normalizeWorkoutPlanContent, presentWorkoutPlan } from './workoutPlan.service.js';

type MemberContext = {
  fullName: string;
  gender: string | null;
  dateOfBirth: Date | null;
  height: number | null;
  weight: number | null;
};

const MAX_REQUEST_LENGTH = 2000;

const ageFromDate = (date: Date | null) => {
  if (!date) return null;
  const today = new Date();
  let age = today.getUTCFullYear() - date.getUTCFullYear();
  const monthDifference = today.getUTCMonth() - date.getUTCMonth();
  if (monthDifference < 0 || (monthDifference === 0 && today.getUTCDate() < date.getUTCDate())) age--;
  return age >= 0 && age < 120 ? age : null;
};

const readGeminiText = (payload: any) => {
  const text = payload?.candidates?.[0]?.content?.parts
    ?.map((part: any) => typeof part?.text === 'string' ? part.text : '')
    .join('')
    .trim();
  if (!text) throw new Error('AI không trả về nội dung giáo án.');
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('AI trả về dữ liệu không đúng định dạng. Hãy thử lại.');
  }
};

export async function generateCoachPlanWithGemini(member: MemberContext | null, request: string) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error('Chưa cấu hình GEMINI_API_KEY trên máy chủ.');
  if (typeof request !== 'string' || request.trim().length > MAX_REQUEST_LENGTH) {
    throw new Error(`Yêu cầu cho AI tối đa ${MAX_REQUEST_LENGTH} ký tự.`);
  }

  const model = process.env.GEMINI_MODEL?.trim() || 'gemini-3.5-flash-lite';
  const profile = {
    name: member?.fullName || 'chưa chọn học viên (giáo án mẫu)',
    gender: member?.gender || 'chưa cung cấp',
    age: ageFromDate(member?.dateOfBirth || null) ?? 'chưa cung cấp',
    heightCm: member?.height ?? 'chưa cung cấp',
    weightKg: member?.weight ?? 'chưa cung cấp',
  };
  const prompt = `Bạn là trợ lý lập giáo án cho huấn luyện viên thể hình tại Việt Nam. Tạo một bản nháp an toàn để PT chuyên môn duyệt trước khi giao cho học viên. Không đưa ra chẩn đoán y khoa; với đau/chấn thương/bệnh nền, luôn ghi chú tham vấn chuyên gia.

Thông tin học viên: ${JSON.stringify(profile)}
Yêu cầu từ PT: ${request.trim() || 'Lập giáo án cân bằng trong 1 tuần.'}

Chỉ trả về JSON hợp lệ, không markdown, theo đúng cấu trúc:
{
  "title": "string (tối đa 200 ký tự)",
  "description": "string", 
  "sessions": [{"dayOfWeek": 1, "title": "string", "notes": "string", "exercises": [{"exerciseName":"string","sets":3,"reps":10,"weightKg":null,"notes":"string"}]}],
  "mealDays": [{"dayOfWeek":1,"notes":"string","meals":[{"mealType":"BREAKFAST|LUNCH|DINNER|SNACK","time":"HH:mm","food":"string","portion":"string","calories":0,"notes":"string"}]}]
}
dayOfWeek: 1 là Thứ Hai, 7 là Chủ Nhật. Tối đa 7 buổi, mỗi buổi 1-12 bài; mealDays không trùng ngày, tối đa 7 ngày và mỗi ngày 3-5 bữa. Dùng tiếng Việt, khẩu phần thực tế, không bịa mức tạ khi chưa có dữ liệu (weightKg: null).`;

  let response: globalThis.Response;
  try {
    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.35, maxOutputTokens: 8192 },
      }),
      signal: AbortSignal.timeout(45000),
    });
  } catch (error) {
    throw new Error(error instanceof Error && error.name === 'TimeoutError' ? 'AI mất quá lâu để phản hồi. Hãy thử lại.' : 'Không thể kết nối dịch vụ AI.');
  }
  const responseBody = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error('Gemini API error:', response.status, responseBody?.error?.message);
    throw new Error(response.status === 401 || response.status === 403 ? 'API key Gemini không hợp lệ hoặc chưa được cấp quyền.' : 'AI chưa thể tạo giáo án. Hãy thử lại sau.');
  }

  const draft = readGeminiText(responseBody);
  const title = typeof draft?.title === 'string' ? draft.title.trim() : '';
  const description = typeof draft?.description === 'string' ? draft.description.trim() : '';
  if (!title || title.length > 200 || description.length > 5000) throw new Error('AI trả về tiêu đề hoặc mô tả không hợp lệ.');
  if (!Array.isArray(draft?.sessions) || draft.sessions.length === 0 || !Array.isArray(draft?.mealDays) || draft.mealDays.length === 0) {
    throw new Error('AI chưa tạo đủ buổi tập và thực đơn. Hãy thử lại với yêu cầu cụ thể hơn.');
  }
  const normalized = normalizeWorkoutPlanContent(draft);
  return presentWorkoutPlan({ title, description, ...normalized });
}
