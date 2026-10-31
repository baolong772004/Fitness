/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { resultRepetitions, visibleProvisionalEvaluation } from '../src/lib/exerciseAnalysisData';
import type { AnalysisResult } from '../src/lib/exerciseAnalysis';

const legacy: AnalysisResult = {
  exercise: 'SQUAT', status: 'COMPLETED', quality: 'SUFFICIENT', detectedRepetitions: 2, limitations: [],
  repetitions: [
    { startSeconds: 0.8, bottomSeconds: 2.6, endSeconds: 3.6, minimumKneeAngle: 80, rangeDegrees: 86, maximumTorsoLeanDegrees: 34 },
    { startSeconds: 4.6, bottomSeconds: 5.2, endSeconds: 5.8, minimumKneeAngle: 123, rangeDegrees: 41, maximumTorsoLeanDegrees: 25 },
  ],
  observations: [{ code: 'VARIABLE_ROM', message: 'Smaller range', timestampSeconds: 5.2, confidence: 0.9, suggestion: 'Review with Coach' }],
};

test('v2 history has usable rep selection without inventing missing hip measurements', () => {
  const reps = resultRepetitions(legacy);
  assert.deepEqual(reps.map(rep => rep.number), [1, 2]);
  assert.equal(reps[0].descentSeconds, 1.8);
  assert.equal(reps[0].ascentSeconds, 1);
  assert.equal(reps[1].bottomHipAngleDegrees, null);
  assert.equal(reps[0].observations.length, 0);
  assert.equal(reps[1].observations[0], legacy.observations[0]);
  assert.equal(reps[0].notAssessed[0].code, 'LEGACY_RESULT');
  assert.equal(legacy.repetitions![0].number, undefined, 'Do not mutate API data');
});

test('v3 measurements and evidence are preserved; empty results remain empty', () => {
  const reps = resultRepetitions(legacy);
  reps[0].bottomHipAngleDegrees = 85;
  reps[0].notAssessed = [{ code: 'LEFT_RIGHT_SYMMETRY', reason: 'Side view' }];
  assert.deepEqual(resultRepetitions({ ...legacy, repetitions: reps }), reps);
  assert.deepEqual(resultRepetitions(null), []);
  assert.deepEqual(resultRepetitions({ ...legacy, repetitions: undefined }), []);
});

test('front v4 preserves null side angles and per-rep evidence', () => {
  const result: AnalysisResult = { ...legacy, observations: [], repetitions: [{
    number: 1, startSeconds: 0.5, bottomSeconds: 1.5, endSeconds: 2.5,
    minimumKneeAngle: null, rangeDegrees: null, maximumTorsoLeanDegrees: null,
    bottomHipAngleDegrees: null, cameraAngle: 'FRONT', hipTravelRatio: 0.3,
    descentSeconds: 1, ascentSeconds: 1, observations: [], notAssessed: [],
    criteria: [{ code: 'DEPTH_TARGET', status: 'NOT_ASSESSED', reason: 'Needs side view', formula: '', detectionRule: '', limitation: '2D' }],
  }] };
  const rep = resultRepetitions(result)[0];
  assert.equal(rep.minimumKneeAngle, null);
  assert.equal(rep.rangeDegrees, null);
  assert.equal(rep.cameraAngle, 'FRONT');
  assert.equal(rep.criteria?.[0].reason, 'Needs side view');
  assert.equal(rep.hipTravelRatio, 0.3);
});

test('Member provisional comparisons stay separate from official and Developer results', () => {
  const provisional = { mode: 'PROVISIONAL' as const, validation: 'UNVALIDATED' as const,
    decisionScope: 'PER_CRITERION_2D_ONLY' as const, warning: 'Chưa kiểm chứng',
    ruleVersion: 'technique-provisional-1', standardVersion: 'draft', passedCriteria: 1,
    needsImprovementCriteria: 0, unassessableCriteria: 7, criteria: [] };
  const analysis = { id: 18, status: 'COMPLETED', errorCode: null, createdAt: '', studentPlanId: null,
    evaluationMode: 'OFFICIAL' as const, result: { ...legacy, evaluationMode: 'OFFICIAL' as const,
      provisionalEvaluation: provisional } };
  assert.equal(visibleProvisionalEvaluation(analysis, false), provisional);
  assert.equal(visibleProvisionalEvaluation(analysis, true), null);
  assert.equal(visibleProvisionalEvaluation({ ...analysis, evaluationMode: 'EXPERIMENTAL' }, false), null);
  assert.equal(visibleProvisionalEvaluation({ ...analysis, result: { ...analysis.result,
    provisionalEvaluation: { ...provisional, validation: 'APPROVED' as never } } }, false), null);
});
