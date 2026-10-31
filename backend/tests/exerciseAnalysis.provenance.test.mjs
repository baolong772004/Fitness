import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { deriveVideoProvenance } from '../src/services/exerciseAnalysis.provenance.js';
import { summarizeSquatSession } from '../src/services/exerciseAnalysis.session.js';

test('known Pexels sample cannot become a self-declared Member performance', async () => {
  const bytes = await readFile('../ai-exercise-service/samples/front-facing-squat-pexels-5034577.mp4');
  const provenance = deriveVideoProvenance(bytes, { videoOrigin: 'USER_UPLOAD',
    captureMethodDeclared: 'LIBRARY', performerDeclaration: 'SELF_DECLARED' });
  assert.equal(provenance.videoOrigin, 'SAMPLE');
  assert.equal(provenance.performerDeclaration, 'UNKNOWN');
  assert.equal(provenance.sourceReference, 'squat-front-pexels-5034577');
  const edited = deriveVideoProvenance(await readFile('../ai-exercise-service/samples/squat-variable-depth-test.mp4'),
    { videoOrigin: 'USER_UPLOAD', performerDeclaration: 'SELF_DECLARED' });
  assert.equal(edited.videoOrigin, 'SAMPLE');
  assert.equal(edited.performerDeclaration, 'UNKNOWN');
  assert.match(edited.sourceReference, /edited/);
  assert.throws(() => deriveVideoProvenance(Buffer.from('video'), { videoOrigin: 'DATASET' }), /INVALID_VIDEO_PROVENANCE/);
  assert.throws(() => deriveVideoProvenance(Buffer.from('video'), { videoOrigin: 'UNVERIFIED_LEGACY' }), /INVALID_VIDEO_PROVENANCE/);
  assert.equal(deriveVideoProvenance(Buffer.from('video'), { videoOrigin: 'UNVERIFIED_LEGACY' }, false, true).videoOrigin,
    'UNVERIFIED_LEGACY');
});

test('two-view summary preserves clip and rep evidence without whole-exercise pass', () => {
  const clip = (id, view, criterionId, status) => ({ id, status: 'COMPLETED', videoOrigin: 'USER_UPLOAD',
    captureMethodDeclared: 'CAMERA', performerDeclaration: 'SELF_DECLARED',
    resultJson: JSON.stringify({ cameraView: { detected: view }, modelVersion: 'test-model',
      ruleVersion: 'test-rule', referenceStandardVersion: 'test-draft', detectedRepetitions: 1,
      techniqueEvaluation: { criteria: [{ criterionId, status: 'MEASURED' }] },
      provisionalEvaluation: { criteria: [{ criterionId, title: criterionId, status, reasonCode: null,
        predictions: [{ criterionId, status, repNumber: 1, timestampSeconds: id,
          observedValue: id / 100, units: 'ratio', bodyPart: 'KNEE', feedback: 'test correction',
          landmarkEvidence: [{ timestampSeconds: id }] }] }] } }) });
  const summary = summarizeSquatSession([
    clip(101, 'FRONT', 'SQUAT-03', 'MEETS_CRITERION'),
    clip(102, 'SIDE', 'SQUAT-02', 'NEEDS_IMPROVEMENT'),
  ]);
  assert.equal(summary.status, 'READY_FOR_PER_CLIP_REVIEW');
  assert.equal(summary.wholeExerciseStatus, 'UNABLE_TO_CONFIRM');
  assert.equal(summary.repSynchronization, 'NONE');
  assert.equal(summary.measuredMeets[0].analysisId, 101);
  assert.equal(summary.measuredNeedsImprovement[0].analysisId, 102);
  assert.equal(summary.measuredNeedsImprovement[0].timestampSeconds, 102);
  assert.equal(summary.clips[0].result, undefined);
});
