/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';
import { poseOverlayToleranceSeconds, resultRepetitions, screenSquatReps, visibleProvisionalEvaluation } from '../src/lib/exerciseAnalysisData';
import type { AnalysisResult, ProvisionalEvaluation } from '../src/lib/exerciseAnalysis';

const legacy: AnalysisResult = {
  exercise: 'SQUAT', status: 'COMPLETED', quality: 'SUFFICIENT', detectedRepetitions: 2, limitations: [],
  repetitions: [
    { startSeconds: 0.8, bottomSeconds: 2.6, endSeconds: 3.6, minimumKneeAngle: 80, rangeDegrees: 86, maximumTorsoLeanDegrees: 34 },
    { startSeconds: 4.6, bottomSeconds: 5.2, endSeconds: 5.8, minimumKneeAngle: 123, rangeDegrees: 41, maximumTorsoLeanDegrees: 25 },
  ],
  observations: [{ code: 'VARIABLE_ROM', message: 'Smaller range', timestampSeconds: 5.2, confidence: 0.9, suggestion: 'Review with Coach' }],
};

test('pose overlay stays close to video playback and covers the last decoded sample', () => {
  assert.equal(poseOverlayToleranceSeconds(2, 4, 2, 5, 10), 0.1);
  assert.ok(Math.abs(poseOverlayToleranceSeconds(4, 4, 4.1, 4.1, 10) - 0.15) < 1e-9);
  assert.equal(poseOverlayToleranceSeconds(4, 4, 4.3, 4.1, 10), 0.1);
});

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

test('per-rep Squat screening requires observed form and never treats rep count as correct form', () => {
  const reps = resultRepetitions({ ...legacy, repetitions: [...legacy.repetitions!, {
    startSeconds: 6, bottomSeconds: 7, endSeconds: 8, minimumKneeAngle: null,
    rangeDegrees: null, maximumTorsoLeanDegrees: null,
  }] });
  const comparison = { mode: 'PROVISIONAL', validation: 'UNVALIDATED',
    criteria: [
      { criterionId: 'SQUAT-01', title: 'Chu kỳ', predictions: [1, 2, 3].map(repNumber => ({
        repNumber, status: 'MEETS_CRITERION', timestampSeconds: repNumber, feedback: '' })) },
      { criterionId: 'SQUAT-03', title: 'Hướng gối', predictions: [
        { repNumber: 1, status: 'MEETS_CRITERION', timestampSeconds: 1, feedback: '' },
        { repNumber: 2, status: 'MEETS_CRITERION', timestampSeconds: 2, feedback: '' },
        { repNumber: 2, status: 'NEEDS_IMPROVEMENT', timestampSeconds: 2.2, feedback: 'Xem lại gối trái' },
      ] },
    ] } as unknown as ProvisionalEvaluation;
  const screened = screenSquatReps(comparison, reps, 'FRONT');
  assert.deepEqual(screened.map(item => item.status), [
    'MEETS_OBSERVED_CRITERIA', 'NEEDS_IMPROVEMENT', 'UNABLE_TO_ASSESS',
  ]);
  assert.equal(screened[1].firstIssue?.feedback, 'Xem lại gối trái');
  assert.match(screened[2].unableReason || '', /Gối hoặc bàn chân/);
  assert.match(screened[2].retryAdvice || '', /Quay chính diện/);
  assert.deepEqual(screenSquatReps(null, reps), []);
});

test('unassessable Squat gives a specific reason and a way to retry', () => {
  const reps = resultRepetitions(legacy).slice(0, 1);
  const noDepthGoal = { criteria: [{ criterionId: 'SQUAT-02', title: 'Độ sâu',
    reasonCode: 'NO_EXPLICIT_DEPTH_TARGET', predictions: [] }] } as unknown as ProvisionalEvaluation;
  const side = screenSquatReps(noDepthGoal, reps, 'SIDE')[0];
  assert.equal(side.status, 'UNABLE_TO_ASSESS');
  assert.match(side.unableReason || '', /mục tiêu độ sâu/);
  assert.match(side.retryAdvice || '', /hông gần ngang gối/);
  const unknown = screenSquatReps(noDepthGoal, reps, 'UNKNOWN')[0];
  assert.match(unknown.unableReason || '', /Góc quay/);
  assert.match(unknown.retryAdvice || '', /giữ máy cố định/);
  const noRule = { criteria: [{ criterionId: 'SQUAT-03', title: 'Hướng gối',
    reasonCode: 'NO_EXPERIMENTAL_DECISION_RULE', predictions: [] }] } as unknown as ProvisionalEvaluation;
  const unsupported = screenSquatReps(noRule, reps, 'FRONT')[0];
  assert.match(unsupported.unableReason || '', /chưa có quy tắc/);
  assert.match(unsupported.retryAdvice || '', /Coach nhận xét/);
});
