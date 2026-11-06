import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import prisma from '../config/prisma.js';
import { videoAvailable } from './exerciseAnalysis.utils.js';
import { analyzeSquatVideoWithGemini } from './geminiSquatVideo.service.js';
import { attachSquatAssessment } from './exerciseAssessmentFusion.service.js';

const inflight = new Map<string, Promise<any>>();
export const runGeminiSquatPilot = (id: number, actorId: number) => runGeminiSquatAnalysis(id, actorId, 'EXPERIMENTAL');

export async function runGeminiSquatAnalysis(id: number, actorId: number, mode: 'OFFICIAL' | 'EXPERIMENTAL' = 'OFFICIAL') {
  const requestKey = `${actorId}:${id}:${mode}`;
  const existing = inflight.get(requestKey);
  if (existing) return existing;
  const work = run(id, actorId, mode);
  inflight.set(requestKey, work);
  try { return await work; } finally { inflight.delete(requestKey); }
}

async function run(id: number, actorId: number, evaluationMode: 'OFFICIAL' | 'EXPERIMENTAL') {
  const row = await prisma.exerciseAnalysis.findFirst({ where: { id, memberId: actorId, evaluationMode } });
  if (!row) throw new Error('VISION_NOT_FOUND');
  if (row.status !== 'COMPLETED' || row.exerciseType !== 'SQUAT') throw new Error('VISION_NOT_READY');
  const result = JSON.parse(row.resultJson || '{}');
  if (result.exerciseVariant !== 'BODYWEIGHT') throw new Error('VISION_UNSUPPORTED_EXERCISE');
  if (result.visionAnalysis?.status === 'COMPLETED') return result.visionAnalysis;
  if (!videoAvailable(row)) throw new Error('VISION_VIDEO_EXPIRED');
  const dailyRuns = await prisma.actionLog.count({ where: { userId: actorId, action: { in: ['GEMINI_SQUAT_PILOT', 'GEMINI_VIDEO_ANALYSIS'] },
    createdAt: { gte: new Date(Date.now() - 24 * 60 * 60_000) } } });
  if (dailyRuns >= 20) throw new Error('VISION_DAILY_LIMIT');
  let bytes: Buffer;
  try { bytes = await readFile(path.resolve(process.cwd(), 'private-exercise-media', row.mediaStorageKey!)); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new Error('VISION_VIDEO_EXPIRED'); throw error; }
  if (createHash('sha256').update(bytes).digest('hex') !== row.videoSha256) throw new Error('VISION_VIDEO_HASH_MISMATCH');
  const visionAnalysis = await analyzeSquatVideoWithGemini(bytes, result);
  const saved = await prisma.$transaction(async tx => {
    const updated = await tx.exerciseAnalysis.updateMany({ where: { id, memberId: actorId, evaluationMode, resultJson: row.resultJson },
      data: { resultJson: JSON.stringify(attachSquatAssessment({ ...result, externalVideoConsent: true, visionAnalysis })) } });
    if (updated.count) await tx.actionLog.create({ data: { userId: actorId, action: 'GEMINI_VIDEO_ANALYSIS',
      details: JSON.stringify({ analysisId: id, consent: true, model: visionAnalysis.model, usage: visionAnalysis.usage }) } });
    return updated;
  });
  if (!saved.count) {
    const current = await prisma.exerciseAnalysis.findFirst({ where: { id, memberId: actorId, evaluationMode }, select: { resultJson: true } });
    const cached = JSON.parse(current?.resultJson || '{}').visionAnalysis;
    if (cached?.status === 'COMPLETED') return cached;
    throw new Error('VISION_RESULT_CHANGED');
  }
  return visionAnalysis;
}
