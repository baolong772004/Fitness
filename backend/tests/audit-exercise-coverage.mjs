/** Read-only real-video audit of every currently listed exercise and key Squat view/variant paths. */
import 'dotenv/config';
import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const service = process.env.AI_SERVICE_URL || 'http://127.0.0.1:8001';
const key = process.env.AI_SERVICE_KEY;
if (!key) throw new Error('AI_SERVICE_KEY is required');
const cases = [
  ['squat_front_bodyweight', 'SQUAT', 'BODYWEIGHT', 'FRONT', 'front-facing-squat-pexels-5034577.mp4'],
  ['squat_pexels_8402111', 'SQUAT', 'BODYWEIGHT', 'AUTO', 'pexels-squat-8402111.mp4'],
  ['squat_pexels_6525519', 'SQUAT', 'BODYWEIGHT', 'AUTO', 'pexels-squat-6525519.mp4'],
  ['squat_pexels_6525519_depth', 'SQUAT', 'BODYWEIGHT', 'SIDE', 'pexels-squat-6525519.mp4', 'HIP_AT_KNEE'],
  ['squat_pexels_7117541', 'SQUAT', 'BODYWEIGHT', 'AUTO', 'pexels-squat-7117541.mp4'],
  ['squat_pexels_7117541_depth', 'SQUAT', 'BODYWEIGHT', 'SIDE', 'pexels-squat-7117541.mp4', 'HIP_AT_KNEE'],
  ['squat_front_unspecified', 'SQUAT', 'UNSPECIFIED', 'FRONT', 'front-facing-squat-pexels-5034577.mp4'],
  ['squat_side_bodyweight', 'SQUAT', 'BODYWEIGHT', 'SIDE', 'github-side-squat.mp4'],
  ['squat_side_explicit_depth', 'SQUAT', 'BODYWEIGHT', 'SIDE', 'github-side-squat.mp4', 'HIP_AT_KNEE'],
  ['squat_first_depth', 'SQUAT', 'BODYWEIGHT', 'SIDE', 'squat_first_view-220k.mp4', 'HIP_AT_KNEE'],
  ['squat_second_depth', 'SQUAT', 'BODYWEIGHT', 'SIDE', 'squat_second_view-220k.mp4', 'HIP_AT_KNEE'],
  ['squat_third_depth', 'SQUAT', 'BODYWEIGHT', 'SIDE', 'squat_third_view-220k.mp4', 'HIP_AT_KNEE'],
  ['squat_variable_depth', 'SQUAT', 'BODYWEIGHT', 'SIDE', 'squat-variable-depth-test.mp4', 'HIP_AT_KNEE'],
  ['squat_oblique_bodyweight', 'SQUAT', 'BODYWEIGHT', 'AUTO', 'oblique-squat-pexels-8837221.mp4'],
  ['squat_weighted_front', 'SQUAT', 'WEIGHTED', 'AUTO', 'barbell-back-squat.mp4'],
  ['push_up', 'PUSH_UP', 'STANDARD', 'SIDE', 'push-up-pexels-4964649.mp4'],
  ['plank', 'PLANK', 'FRONT', 'SIDE', 'plank-pexels-6525496.mp4'],
  ['lunge', 'LUNGE', 'FORWARD_BODYWEIGHT', 'SIDE', 'lunge-pexels-6525491.mp4'],
  ['biceps_curl', 'BICEPS_CURL', 'DUMBBELL_STANDING', 'FRONT', 'hammer-curls-ymove.mp4'],
  ['shoulder_press', 'SHOULDER_PRESS', 'DUMBBELL_SEATED', 'FRONT', 'shoulder-press-pexels-5837705.mp4'],
];
const healthResponse = await fetch(`${service}/health`);
if (!healthResponse.ok) throw new Error(`AI health returned ${healthResponse.status}`);
const health = await healthResponse.json();
if (!health.ready || !health.experimentalEvaluationEnabled) throw new Error('Updated experimental AI service is not ready');
const rows = [];
for (const [caseName, exercise, variant, view, filename, depthTarget = 'NONE'] of cases.filter(row => !process.argv.includes('--case') || process.argv.includes(row[0]))) {
  const video = await readFile(path.resolve('../ai-exercise-service/samples', filename));
  const form = new FormData();
  form.append('file', new Blob([video]), filename);
  form.append('options', JSON.stringify({ cameraView: view, depthTarget, descentTargetSeconds: null }));
  form.append('exercise_variant', variant);
  form.append('evaluation_mode', 'EXPERIMENTAL');
  const response = await fetch(`${service}/analyze/${exercise.toLowerCase()}`, {
    method: 'POST', headers: { 'x-ai-service-key': key }, body: form,
    signal: AbortSignal.timeout(150_000),
  });
  if (!response.ok) throw new Error(`${caseName}: HTTP ${response.status} ${(await response.text()).slice(0, 200)}`);
  const result = await response.json();
  const evaluation = result.techniqueEvaluation || {};
  const experimental = result.experimentalEvaluation || {};
  rows.push({ caseName, exercise, variant, requestedView: view, depthTarget, detectedView: result.cameraView?.detected,
    videoSha256: createHash('sha256').update(video).digest('hex'), status: result.status,
    poseFrames: result.poseFrames?.length || 0, repetitions: result.detectedRepetitions,
    repQuality: (result.repetitions || []).map(rep => ({ repNumber: rep.number,
      trackingCoverage: rep.trackingCoverage, techniqueTrackingSufficient: rep.techniqueTrackingSufficient,
      qualityEvidence: rep.qualityEvidence })),
    official: { passed: evaluation.passedCriteria, improved: evaluation.needsImprovementCriteria,
      measured: evaluation.measuredCriteria,
      criteria: (evaluation.criteria || []).map(item => ({ id: item.criterionId, status: item.status,
        reasonCode: item.reasonCode, measurementPreview: item.measurement?.perRep?.slice(0, 2).map(rep => ({
          repNumber: rep.repNumber, timestampSeconds: rep.timestampSeconds,
          observedValue: rep.observedValue, measurementQuality: rep.measurementQuality,
          evidenceFrames: rep.landmarkEvidence?.length || 0 })) || [] })) },
    experimental: { passed: experimental.passedCriteria, improved: experimental.needsImprovementCriteria,
      predictionCount: (experimental.criteria || []).flatMap(item => item.predictions || []).length,
      criteria: (experimental.criteria || []).map(item => ({ id: item.criterionId, status: item.status,
        reasonCode: item.reasonCode, missingRequirements: item.missingRequirements,
        measurementAvailable: item.measurementAvailable,
        predictions: item.predictions?.length || 0 })) },
  });
  console.log(JSON.stringify({ caseName, status: result.status, view: result.cameraView?.detected,
    poseFrames: rows.at(-1).poseFrames, reps: result.detectedRepetitions,
    official: { passed: evaluation.passedCriteria, improved: evaluation.needsImprovementCriteria,
      measured: evaluation.measuredCriteria }, experimental: { passed: experimental.passedCriteria,
      improved: experimental.needsImprovementCriteria, predictions: rows.at(-1).experimental.predictionCount } }));
}
const output = { auditedAt: new Date().toISOString(), health: {
  ruleVersion: health.ruleVersion, techniqueEngineVersion: health.techniqueEngineVersion,
  experimentalEvaluationEnabled: health.experimentalEvaluationEnabled,
}, cases: rows };
await mkdir('tests/artifacts', { recursive: true });
await writeFile(process.argv.includes('--case') ? 'tests/artifacts/exercise-coverage-targeted.json'
  : 'tests/artifacts/exercise-coverage-audit.json', JSON.stringify(output, null, 2));
