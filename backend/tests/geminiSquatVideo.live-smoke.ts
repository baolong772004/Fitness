import 'dotenv/config';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { analyzeSquatVideoWithGemini } from '../src/services/geminiSquatVideo.service.js';
import { buildSquatRepFeedback } from '../../mobile-react-native/src/lib/squatRepFeedback.js';
import { attachSquatAssessment } from '../src/services/exerciseAssessmentFusion.service.js';

test('public Squat sample passes through MediaPipe, actual Gemini video and Member feedback projection', { skip: process.env.RUN_GEMINI_VIDEO_SMOKE !== 'true' }, async t => {
  const bytes = await readFile('../ai-exercise-service/samples/front-facing-squat-pexels-5034577.mp4');
  const form = new FormData();
  form.append('file', new Blob([bytes]), 'public-squat-sample.mp4');
  form.append('exercise_variant', 'BODYWEIGHT'); form.append('evaluation_mode', 'OFFICIAL');
  form.append('options', JSON.stringify({ cameraView: 'FRONT', depthTarget: 'NONE', descentTargetSeconds: null }));
  const pose = await fetch(`${process.env.AI_SERVICE_URL || 'http://127.0.0.1:8001'}/analyze/squat`, {
    method: 'POST', headers: { 'x-ai-service-key': process.env.AI_SERVICE_KEY || '' }, body: form, signal: AbortSignal.timeout(120000) });
  assert.equal(pose.status, 200);
  let result: any = await pose.json();
  assert.ok(result.repetitions.length > 0);
  result.visionAnalysis = await analyzeSquatVideoWithGemini(bytes, result);
  result = attachSquatAssessment(result);
  const feedback = buildSquatRepFeedback(result);
  assert.equal(feedback.length, result.repetitions.length);
  for (const rep of feedback) {
    assert.equal(rep.criteria.find(item => item.id === 'SQUAT-02')?.status, 'UNABLE_TO_ASSESS');
    assert.ok(rep.criteria.some(item => item.details.length > 0));
  }
  t.diagnostic(JSON.stringify({ sample: 'public-front-squat', reps: feedback.length, model: result.visionAnalysis.model,
    assessments: result.visionAnalysis.assessments.length, resolvedConflicts: result.assessmentDiagnostics.filter((row: any) => row.conflictResolved).length,
    perRep: feedback.map(row => ({ rep: row.repNumber, meets: row.meets, improves: row.improves, unable: row.unable })) }));
});
