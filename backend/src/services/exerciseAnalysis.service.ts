import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import prisma from '../config/prisma.js';
import { parseAnalysisOptions } from './exerciseAnalysis.utils.js';
import { isExerciseType, type ExerciseType } from './exerciseAnalysis.catalog.js';
import { deriveVideoProvenance } from './exerciseAnalysis.provenance.js';
export { isSupportedVideo, publicAnalysis } from './exerciseAnalysis.utils.js';

const mediaDir = path.resolve(process.cwd(), 'private-exercise-media');
const maxAttempts = 2;
const experimentalRuleVersion = 'technique-experimental-4';
let busy = false;

export async function createExerciseAnalysis(memberId: number, bytes: Buffer, studentPlanId?: number, options = {}, exerciseType: ExerciseType = 'SQUAT', coachPlanContext?: object, exerciseVariant = 'UNSPECIFIED', evaluationMode: 'OFFICIAL' | 'EXPERIMENTAL' = 'OFFICIAL', provenanceInput: object = {}, preserveLegacy = false) {
  if (!isExerciseType(exerciseType)) throw new Error('Unsupported exercise');
  const analysisOptions = parseAnalysisOptions(options);
  const provenance = deriveVideoProvenance(bytes, provenanceInput, evaluationMode === 'EXPERIMENTAL', preserveLegacy);
  const key = `${randomUUID()}.video`;
  await mkdir(mediaDir, { recursive: true });
  await writeFile(path.join(mediaDir, key), bytes, { flag: 'wx' });
  try {
    return await prisma.exerciseAnalysis.create({ data: { memberId, exerciseType, mediaStorageKey: key, studentPlanId, evaluationMode,
      ...provenance, resultJson: JSON.stringify({ requestOptions: analysisOptions, exerciseVariant, coachPlanContext: coachPlanContext || null, evaluationMode,
        provenance: { ...provenance, uploaderId: memberId, performerIdentityVerified: false } }) } });
  } catch (error) {
    await unlink(path.join(mediaDir, key)).catch(() => undefined);
    throw error;
  }
}

export async function deleteExerciseAnalysis(id: number, memberId: number, evaluationMode: 'OFFICIAL' | 'EXPERIMENTAL' = 'OFFICIAL') {
  const row = await prisma.exerciseAnalysis.findFirst({ where: { id, memberId, evaluationMode } });
  if (!row) return false;
  await prisma.exerciseAnalysis.delete({ where: { id } });
  if (row.mediaStorageKey) await unlink(path.join(mediaDir, row.mediaStorageKey)).catch(() => undefined);
  return true;
}

export async function reanalyzeOwnExerciseVideo(id: number, ownerId: number, evaluationMode: 'OFFICIAL' | 'EXPERIMENTAL' = 'EXPERIMENTAL') {
  const source = await prisma.exerciseAnalysis.findFirst({ where: { id, memberId: ownerId, evaluationMode } });
  if (!source || !source.mediaStorageKey || source.mediaDeletedAt ||
      new Date(source.createdAt).getTime() <= Date.now() - 7 * 24 * 60 * 60_000) return null;
  if (!['COMPLETED', 'INSUFFICIENT_DATA', 'NEEDS_REVIEW'].includes(source.status)) return null;
  if (evaluationMode === 'OFFICIAL' && source.resultVersion === 'exercise-analysis-result-4') return null;
  if (!isExerciseType(source.exerciseType)) return null;
  const saved = source.resultJson ? JSON.parse(source.resultJson) : {};
  let bytes: Buffer;
  try { bytes = await readFile(path.join(mediaDir, source.mediaStorageKey)); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error; }
  return createExerciseAnalysis(ownerId, bytes, source.studentPlanId || undefined, saved.requestOptions || saved.protocol || {},
    source.exerciseType, saved.coachPlanContext || undefined, saved.exerciseVariant || 'UNSPECIFIED', evaluationMode,
    { videoOrigin: source.videoOrigin, captureMethodDeclared: source.captureMethodDeclared,
      performerDeclaration: source.performerDeclaration }, true);
}

async function processOne() {
  const stale = new Date(Date.now() - 3 * 60_000);
  const row = await prisma.exerciseAnalysis.findFirst({ where: { OR: [{ status: 'PENDING' }, { status: 'PROCESSING', startedAt: { lt: stale } }] }, orderBy: { createdAt: 'asc' } });
  if (!row) return;
  const claim = await prisma.exerciseAnalysis.updateMany({ where: { id: row.id, status: row.status, attempts: row.attempts }, data: { status: 'PROCESSING', startedAt: new Date(), attempts: { increment: 1 } } });
  if (!claim.count) return;
  if (row.attempts >= maxAttempts) {
    await prisma.exerciseAnalysis.update({ where: { id: row.id }, data: { status: 'FAILED', errorCode: 'AI_TIMEOUT', completedAt: new Date() } });
    return;
  }
  try {
    if (!row.mediaStorageKey) throw new Error('MEDIA_DELETED');
    const bytes = await readFile(path.join(mediaDir, row.mediaStorageKey));
    const form = new FormData();
    if (!isExerciseType(row.exerciseType)) throw new Error('UNSUPPORTED_EXERCISE');
    form.append('file', new Blob([bytes]), `${row.exerciseType.toLowerCase()}.video`);
    const saved = row.resultJson ? JSON.parse(row.resultJson) : {};
    form.append('options', JSON.stringify(parseAnalysisOptions(saved.requestOptions || saved.protocol || {})));
    form.append('exercise_variant', saved.exerciseVariant || 'UNSPECIFIED');
    form.append('evaluation_mode', row.evaluationMode);
    const response = await fetch(`${process.env.AI_SERVICE_URL || 'http://127.0.0.1:8001'}/analyze/${row.exerciseType.toLowerCase()}`, { method: 'POST', headers: { 'x-ai-service-key': process.env.AI_SERVICE_KEY || '' }, body: form, signal: AbortSignal.timeout(120_000) });
    if (!response.ok) throw new Error(`AI_HTTP_${response.status}`);
    const result = await response.json() as any;
    result.provenance = { videoOrigin: row.videoOrigin, captureMethodDeclared: row.captureMethodDeclared,
      performerDeclaration: row.performerDeclaration, videoSha256: row.videoSha256,
      sourceReference: row.sourceReference, uploaderId: row.memberId, performerIdentityVerified: false,
      sessionGroupId: row.sessionGroupId, samePersonSessionConfirmed: row.samePersonSessionConfirmed };
    if (!['COMPLETED', 'INSUFFICIENT_DATA', 'NEEDS_REVIEW'].includes(result.status)) throw new Error('AI_INVALID_RESULT');
    if (result.exercise !== row.exerciseType) throw new Error('AI_EXERCISE_MISMATCH');
    if (result.exerciseVariant && result.exerciseVariant !== (saved.exerciseVariant || 'UNSPECIFIED')) throw new Error('AI_VARIANT_MISMATCH');
    if (result.evaluationMode !== row.evaluationMode) throw new Error('AI_EVALUATION_MODE_MISMATCH');
    if (row.evaluationMode === 'EXPERIMENTAL' && result.experimentalEvaluation?.mode !== 'EXPERIMENTAL') throw new Error('AI_EXPERIMENTAL_RESULT_MISSING');
    if (row.evaluationMode === 'EXPERIMENTAL' && result.experimentalEvaluation?.ruleVersion !== experimentalRuleVersion) throw new Error('AI_EXPERIMENTAL_RULE_VERSION_MISMATCH');
    if (row.evaluationMode === 'OFFICIAL' && result.experimentalEvaluation) throw new Error('AI_UNEXPECTED_EXPERIMENTAL_RESULT');
    if (row.evaluationMode === 'OFFICIAL' && result.exercise === 'SQUAT' && result.exerciseVariant === 'BODYWEIGHT' &&
        (result.provisionalEvaluation?.mode !== 'PROVISIONAL' || result.provisionalEvaluation?.validation !== 'UNVALIDATED' ||
         result.provisionalEvaluation?.decisionScope !== 'PER_CRITERION_2D_ONLY')) throw new Error('AI_PROVISIONAL_RESULT_INVALID');
    if (row.evaluationMode === 'EXPERIMENTAL' && result.provisionalEvaluation) throw new Error('AI_UNEXPECTED_PROVISIONAL_RESULT');
    if (!result.resultVersion || !result.ruleVersion) throw new Error('AI_RESULT_VERSION_MISSING');
    result.coachPlanContext = saved.coachPlanContext || null;
    if (result.techniqueEvaluation) result.techniqueEvaluation.planContext = saved.coachPlanContext || null;
    await prisma.exerciseAnalysis.updateMany({ where: { id: row.id, status: 'PROCESSING', attempts: row.attempts + 1 }, data: { status: result.status, resultJson: JSON.stringify(result), modelVersion: String(result.modelVersion || '').slice(0, 100), ruleVersion: String(result.ruleVersion).slice(0, 30), resultVersion: String(result.resultVersion).slice(0, 30), completedAt: new Date(), errorCode: null } });
  } catch (error) {
    const code = error instanceof Error && error.name === 'TimeoutError' ? 'AI_TIMEOUT'
      : error instanceof Error && /^AI_[A-Z0-9_]{1,55}$/.test(error.message) ? error.message : 'AI_UNAVAILABLE';
    await prisma.exerciseAnalysis.updateMany({ where: { id: row.id, status: 'PROCESSING', attempts: row.attempts + 1 }, data: { status: row.attempts + 1 >= maxAttempts ? 'FAILED' : 'PENDING', errorCode: code, startedAt: null, completedAt: row.attempts + 1 >= maxAttempts ? new Date() : null } });
  }
}

export function startExerciseAnalysisWorker() {
  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      await processOne();
      const expiry = new Date(Date.now() - 7 * 24 * 60 * 60_000);
      const old = await prisma.exerciseAnalysis.findMany({ where: { createdAt: { lt: expiry }, mediaStorageKey: { not: null }, status: { in: ['COMPLETED', 'INSUFFICIENT_DATA', 'NEEDS_REVIEW', 'FAILED'] } }, select: { id: true, mediaStorageKey: true } });
      for (const row of old) {
        if (!row.mediaStorageKey) continue;
        await unlink(path.join(mediaDir, row.mediaStorageKey)).catch(error => { if (error?.code !== 'ENOENT') throw error; });
        await prisma.exerciseAnalysis.updateMany({ where: { id: row.id, mediaStorageKey: row.mediaStorageKey }, data: { mediaStorageKey: null, mediaDeletedAt: new Date() } });
      }
    } catch (error) { console.error('Exercise analysis worker error:', error instanceof Error ? error.message : 'unknown'); }
    finally { busy = false; }
  };
  void tick();
  (setInterval(() => void tick(), 5000) as unknown as NodeJS.Timeout).unref();
}
