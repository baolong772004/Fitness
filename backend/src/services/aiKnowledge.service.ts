type KnowledgeDocument = { id: string; title: string; category: string; content: string };

const VECTOR_SIZE = 768;
const GEMINI_EMBED_MODEL = 'gemini-embedding-001';

const DEFAULT_DOCUMENTS: KnowledgeDocument[] = [
  { id: 'freeze-policy', title: 'Chính sách bảo lưu gói tập', category: 'policy', content: 'Hội viên muốn bảo lưu Membership gym cần liên hệ quầy lễ tân. Chỉ lễ tân hoặc nhân viên được phân quyền mới được xử lý bảo lưu; người dùng không tự kích hoạt bảo lưu trong ứng dụng.' },
  { id: 'coach-change', title: 'Chính sách đổi huấn luyện viên', category: 'trainer', content: 'Hội viên PT có thể gửi yêu cầu đổi huấn luyện viên phù hợp theo quy trình của phòng gym. Khi đổi Coach, phải xem tình trạng số buổi còn lại, cấp độ PT và lịch học của Coach mới. Hội viên liên hệ lễ tân nếu cần hỗ trợ xác nhận.' },
  { id: 'pt-required-membership', title: 'Điều kiện mua gói PT', category: 'pt', content: 'Hội viên cần có Membership Gym đang hoạt động trước khi mua hoặc sử dụng gói PT theo quy trình hiện tại của hệ thống. Sau khi mua, hội viên chọn cấp độ, số buổi và huấn luyện viên phù hợp.' },
  { id: 'package-advice', title: 'Hướng dẫn chọn gói tập', category: 'package', content: 'Nếu khách chủ yếu tự tập tại phòng gym, nên xem các gói Membership. Nếu khách muốn được hướng dẫn kỹ thuật, lên chương trình và tập 1 kèm 1, nên xem gói PT hoặc buổi PT lẻ. Giá, thời hạn và số buổi phải luôn lấy từ dữ liệu gói mới nhất.' },
  { id: 'opening-hours', title: 'Hướng dẫn giờ mở cửa', category: 'facility', content: 'Giờ mở cửa, giờ đóng cửa và lịch nghỉ được quản lý trong hệ thống AURA Fitness. AI phải ưu tiên dữ liệu GymCalendarConfig và GymClosure mới nhất thay vì mô tả cứng trong tài liệu.' },
];

// Docker Compose sets QDRANT_URL to its Qdrant service. Without it, local
// development keeps the small built-in knowledge set in process memory.
const configuredQdrantUrl = () => process.env.QDRANT_URL?.trim() || '';
const usesQdrant = () => Boolean(configuredQdrantUrl());
const qdrantUrl = () => configuredQdrantUrl().replace(/\/$/, '');

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
type LocalKnowledgePoint = { vector: number[]; payload: KnowledgeDocument };
let localKnowledgePoints: LocalKnowledgePoint[] = [];
let localKnowledgeSeedPromise: Promise<void> | null = null;

async function qdrantFetch(path: string, init: RequestInit = {}, timeoutMs = 10_000) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await fetch(`${qdrantUrl()}${path}`, {
        ...init,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      lastError = error;
      if (attempt < 4) await delay(500 * (attempt + 1));
    }
  }

  const reason = lastError instanceof Error ? lastError.message : String(lastError);
  let endpoint = qdrantUrl();
  try { endpoint = new URL(endpoint).host; } catch { endpoint = 'invalid QDRANT_URL'; }
  throw new Error(`Qdrant request failed at ${endpoint}: ${reason}`);
}

async function geminiEmbed(text: string): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error('Chưa cấu hình GEMINI_API_KEY');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_EMBED_MODEL}:embedContent?key=${encodeURIComponent(apiKey)}`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(30_000),
      body: JSON.stringify({ content: { parts: [{ text }] }, outputDimensionality: VECTOR_SIZE }),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Gemini embedding request failed: ${reason}`);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || 'Không thể tạo vector embedding.');
  const vector = data?.embedding?.values;
  if (!Array.isArray(vector) || vector.length !== VECTOR_SIZE) {
    throw new Error(`Vector embedding không có kích thước ${VECTOR_SIZE}.`);
  }
  return vector;
}

async function ensureLocalKnowledgeSeeded() {
  if (!localKnowledgeSeedPromise) {
    localKnowledgeSeedPromise = (async () => {
      const points: LocalKnowledgePoint[] = [];
      for (const document of DEFAULT_DOCUMENTS) {
        const vector = await geminiEmbed(`${document.title}\n${document.content}`);
        points.push({ vector, payload: document });
      }
      localKnowledgePoints = points;
    })().catch((error) => {
      localKnowledgeSeedPromise = null;
      throw error;
    });
  }
  await localKnowledgeSeedPromise;
}

async function ensureCollection() {
  const existing = await qdrantFetch('/collections/aura_business_knowledge', {}, 5_000);
  if (existing.ok) return;
  if (existing.status !== 404) {
    throw new Error(`Cannot check Qdrant collection: ${existing.status}`);
  }
  const response = await qdrantFetch('/collections/aura_business_knowledge', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vectors: { size: VECTOR_SIZE, distance: 'Cosine' } }),
  }, 10_000);
  if (!response.ok) throw new Error(`Không thể tạo Qdrant collection: ${response.status}`);
}

export async function seedBusinessKnowledge() {
  if (!usesQdrant()) {
    await ensureLocalKnowledgeSeeded();
    return;
  }

  await ensureCollection();
  const points = [];
  for (const document of DEFAULT_DOCUMENTS) {
    const vector = await geminiEmbed(`${document.title}\n${document.content}`);
    points.push({ id: stableId(document.id), vector, payload: document });
  }
  const response = await qdrantFetch('/collections/aura_business_knowledge/points?wait=true', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ points }),
  }, 30_000);
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Không thể lưu kiến thức vector: ${response.status} ${detail}`);
  }
}

export async function searchBusinessKnowledge(query: string, limit = 5) {
  try {
    if (!usesQdrant()) {
      await ensureLocalKnowledgeSeeded();
      const vector = await geminiEmbed(query);
      return localKnowledgePoints
        .map(point => ({
          score: cosineSimilarity(vector, point.vector),
          title: point.payload.title,
          category: point.payload.category,
          content: point.payload.content,
        }))
        .filter(point => point.score >= 0.55)
        .sort((left, right) => right.score - left.score)
        .slice(0, Math.max(0, limit));
    }

    await ensureCollection();
    const vector = await geminiEmbed(query);
    const response = await qdrantFetch('/collections/aura_business_knowledge/points/query', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: vector, limit, with_payload: true, score_threshold: 0.55 }),
    }, 10_000);
    if (!response.ok) return [];
    const result = await response.json();
    return (result?.result?.points || []).map((point: any) => ({
      score: point.score,
      title: point.payload?.title,
      category: point.payload?.category,
      content: point.payload?.content,
    }));
  } catch (error) {
    console.warn('Vector knowledge unavailable:', error instanceof Error ? error.message : error);
    return [];
  }
}

function cosineSimilarity(left: number[], right: number[]) {
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (let index = 0; index < Math.min(left.length, right.length); index++) {
    dot += left[index] * right[index];
    leftMagnitude += left[index] * left[index];
    rightMagnitude += right[index] * right[index];
  }
  if (leftMagnitude === 0 || rightMagnitude === 0) return 0;
  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}

function stableId(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) hash ^= value.charCodeAt(i), hash = Math.imul(hash, 16777619);
  const hex = (hash >>> 0).toString(16).padStart(8, '0');
  return `00000000-0000-4000-8000-${hex.padEnd(12, '0').slice(0, 12)}`;
}
