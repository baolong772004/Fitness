import assert from 'node:assert/strict';
import test from 'node:test';
import { attachSquatAssessment, buildSquatAssessment } from '../src/services/exerciseAssessmentFusion.service.js';
import { publicAnalysis, coachAnalysisSummary } from '../src/services/exerciseAnalysis.utils.js';

const point = { x: .4, y: .5, visibility: .9 };
const evidence = [1.2, 2, 2.8].map(timestampSeconds => ({ timestampSeconds, landmarks: {
  leftKnee: point, leftAnkle: { ...point, y: .8 }, rightKnee: { ...point, x: .6 }, rightAnkle: { ...point, x: .6, y: .8 },
} }));
const prediction = (status = 'MEETS_CRITERION', bodyPart = 'LEFT_KNEE') => ({ repNumber: 1, bodyPart, status, timestampSeconds: 2,
  observedValue: status === 'MEETS_CRITERION' ? .05 : .16, threshold: { maximum: .1 }, landmarkEvidence: evidence,
  measurementQuality: { sufficientForExperimentalComparison: true, continuousTracking: true, stableReference: true } });
function result(rule = 'MEETS_CRITERION', vision = rule) {
  return { exercise: 'SQUAT', exerciseVariant: 'BODYWEIGHT', status: 'COMPLETED', cameraView: { detected: 'FRONT' },
    protocol: { depthTarget: 'NONE', descentTargetSeconds: null },
    repetitions: [{ number: 1, startSeconds: 1, bottomSeconds: 2, endSeconds: 3, descentSeconds: 1, ascentSeconds: 1 }],
    provisionalEvaluation: { criteria: [{ criterionId: 'SQUAT-03', predictions: [prediction(rule), prediction(rule, 'RIGHT_KNEE')] }] },
    visionAnalysis: { status: 'COMPLETED', assessments: [{ repNumber: 1, criterionId: 'SQUAT-03', status: vision,
      sourceStatus: vision, timestampSeconds: 2, observation: vision === 'MEETS_CRITERION' ? 'Hướng gối ổn định trong phần quan sát.' : 'Gối dịch vào trong.', correction: vision === 'NEEDS_IMPROVEMENT' ? 'Giữ gối theo hướng bàn chân.' : '' }] } };
}
const criterion = (output, id = 'SQUAT-03') => output.assessment.reps[0].criteria.find(row => row.id === id);
function release(input) {
  input.techniqueEvaluation = { criteria: [{ criterionId: 'SQUAT-03', validation: 'APPROVED_AND_VIDEO_VALIDATED', approval: { reviewId: 1 },
    verdicts: input.provisionalEvaluation.criteria[0].predictions }] };
  return input;
}

test('agreement remains provisional and never produces a whole-exercise score', () => {
  const output = buildSquatAssessment(result());
  assert.equal(criterion(output).status, 'MEETS_CRITERION');
  assert.equal(criterion(output).validation, 'PROVISIONAL');
  assert.equal(output.assessment.reps[0].meets, 1, 'Two knees are one criterion');
  assert.equal(output.assessment.wholeExerciseStatus, 'NOT_CONFIRMED');
  assert.equal(output.assessment.score, undefined);
});

test('a validated rule with valid evidence decides independently and resolves weaker model conflict', () => {
  for (const vision of ['MEETS_CRITERION', 'UNABLE_TO_ASSESS']) {
    const output = buildSquatAssessment(release(result('NEEDS_IMPROVEMENT', vision)));
    assert.equal(criterion(output).status, 'NEEDS_IMPROVEMENT');
    assert.equal(criterion(output).validation, 'VERIFIED');
    assert.ok(criterion(output).correction);
  }
  const resolved = buildSquatAssessment(release(result('NEEDS_IMPROVEMENT', 'MEETS_CRITERION')));
  assert.equal(resolved.diagnostics[2].conflictResolved, true);
});

test('strong measured estimates do not require model agreement when the model abstains', () => {
  const input = result('NEEDS_IMPROVEMENT', 'UNABLE_TO_ASSESS');
  const row = criterion(buildSquatAssessment(input));
  assert.equal(row.status, 'NEEDS_IMPROVEMENT');
  assert.equal(row.validation, 'PROVISIONAL', 'Draft rules must not become verified');
  delete input.visionAnalysis;
  assert.equal(criterion(buildSquatAssessment(input)).status, 'NEEDS_IMPROVEMENT');
});

test('same-frame disagreement with no validated stronger rule remains local to the criterion', () => {
  const output = buildSquatAssessment(result('NEEDS_IMPROVEMENT', 'MEETS_CRITERION'));
  assert.equal(criterion(output).status, 'UNABLE_TO_ASSESS');
  assert.equal(criterion(output).reasonCode, 'SOURCE_CONFLICT');
  assert.equal(criterion(output).correction, '');
  assert.equal(criterion(output).needsReview, true);
});

test('strong joint evidence may resolve a model claim from the wrong moment', () => {
  const input = result('NEEDS_IMPROVEMENT', 'MEETS_CRITERION');
  input.visionAnalysis.assessments[0].timestampSeconds = 2.9;
  const output = buildSquatAssessment(input);
  assert.equal(criterion(output).status, 'NEEDS_IMPROVEMENT');
  assert.equal(criterion(output).reasonCode, 'STRONG_MEASUREMENT_RESOLVES_UNALIGNED_VISION');
});

test('recomputed measurements outrank an inconsistent candidate label without fabricating a threshold', () => {
  const input = result('MEETS_CRITERION', 'NEEDS_IMPROVEMENT');
  input.provisionalEvaluation.criteria[0].predictions[0].observedValue = .16;
  const row = criterion(buildSquatAssessment(input));
  assert.equal(row.status, 'NEEDS_IMPROVEMENT');
  assert.match(row.details[0].measurement, /16%/);
});

test('vision alone, missing frames, poor tracking or stale timestamps never become technique errors', () => {
  for (const mutation of [
    input => { input.provisionalEvaluation.criteria[0].predictions = []; },
    input => { for (const row of input.provisionalEvaluation.criteria[0].predictions) row.landmarkEvidence = []; },
    input => { for (const row of input.provisionalEvaluation.criteria[0].predictions) row.measurementQuality = { sufficientForExperimentalComparison: false }; },
    input => { for (const row of input.provisionalEvaluation.criteria[0].predictions) row.timestampSeconds = 20; },
  ]) {
    const input = result('NEEDS_IMPROVEMENT'); mutation(input);
    const row = criterion(buildSquatAssessment(input));
    assert.equal(row.status, 'UNABLE_TO_ASSESS');
    assert.equal(row.correction, '');
  }
});

test('an identified knee issue survives missing depth and applies only to its own rep', () => {
  const input = result('NEEDS_IMPROVEMENT');
  input.repetitions.push({ ...input.repetitions[0], number: 2, startSeconds: 4, bottomSeconds: 5, endSeconds: 6 });
  const output = buildSquatAssessment(input);
  assert.equal(output.assessment.reps[0].status, 'NEEDS_IMPROVEMENT');
  assert.equal(criterion(output, 'SQUAT-02').status, 'UNABLE_TO_ASSESS');
  assert.equal(output.assessment.reps[1].improves, 0);
  assert.equal(criterion(output).details[0].timestampSeconds, 2);
});

test('front-view depth is always unavailable and one visible knee cannot establish a bilateral pass', () => {
  const input = result('NEEDS_IMPROVEMENT');
  input.provisionalEvaluation.criteria[0].criterionId = 'SQUAT-02';
  input.visionAnalysis.assessments[0].criterionId = 'SQUAT-02';
  assert.equal(criterion(buildSquatAssessment(input), 'SQUAT-02').reasonCode, 'SIDE_VIEW_REQUIRED');
  const single = result(); single.provisionalEvaluation.criteria[0].predictions.pop();
  assert.equal(criterion(buildSquatAssessment(single)).status, 'UNABLE_TO_ASSESS');
});

test('old records are fused on read without a provider call and diagnostics are limited to Coach views', () => {
  const input = result('NEEDS_IMPROVEMENT'); const before = JSON.stringify(input);
  const record = { id: 1, evaluationMode: 'OFFICIAL', createdAt: new Date(), resultJson: before };
  const member = publicAnalysis(record);
  assert.equal(member.result.assessment.reps[0].improves, 1);
  assert.equal(member.result.assessmentDiagnostics, undefined);
  assert.ok(coachAnalysisSummary(record).result.assessmentDiagnostics.length);
  assert.equal(JSON.stringify(input), before);
  assert.deepEqual(attachSquatAssessment(input).assessment, member.result.assessment);
});

test('a rep retains useful rhythm feedback when knee evidence conflicts and depth is missing', () => {
  const input = result('NEEDS_IMPROVEMENT', 'MEETS_CRITERION');
  input.provisionalEvaluation.criteria.push({ criterionId: 'SQUAT-05', predictions: [{ ...prediction(), bodyPart: 'WHOLE_BODY', observedValue: .1, threshold: { maximum: .3 } }] });
  const rep = buildSquatAssessment(input).assessment.reps[0];
  assert.equal(rep.meets, 1);
  assert.equal(rep.criteria.find(row => row.id === 'SQUAT-03').needsReview, true);
  assert.equal(rep.criteria.find(row => row.id === 'SQUAT-02').status, 'UNABLE_TO_ASSESS');
  assert.equal(rep.status, 'PARTIALLY_ASSESSED');
});

test('a scoped positive rep requires the defined observable criteria and never certifies unobservable technique', () => {
  const input = result();
  input.provisionalEvaluation.criteria.push(
    { criterionId: 'SQUAT-01', predictions: [{ ...prediction(), bodyPart: 'WHOLE_BODY', observedValue: 2, threshold: { minimum: .6, maximum: 15 } }] },
    { criterionId: 'SQUAT-05', predictions: [{ ...prediction(), bodyPart: 'WHOLE_BODY', observedValue: .1, threshold: { maximum: .3 } }] });
  const output = buildSquatAssessment(input);
  assert.equal(output.assessment.reps[0].status, 'MEETS_OBSERVED_CRITERIA');
  assert.equal(output.assessment.reps[0].unable, 5);
  assert.equal(output.assessment.wholeExerciseStatus, 'NOT_CONFIRMED');
});

test('agreement without a defined measured comparison cannot establish correct form', () => {
  const input = result();
  for (const row of input.provisionalEvaluation.criteria[0].predictions) delete row.threshold;
  assert.equal(criterion(buildSquatAssessment(input)).status, 'UNABLE_TO_ASSESS');
  assert.equal(criterion(buildSquatAssessment(input)).reasonCode, 'COMPARISON_DEFINITION_MISSING');
});

test('combined personal targets require both tempo and depth, even if the displayed tempo meets its target', () => {
  const input = result();
  input.cameraView.detected = 'SIDE';
  input.protocol = { depthTarget: 'HIP_AT_KNEE', descentTargetSeconds: 1 };
  input.provisionalEvaluation.criteria = [{ criterionId: 'SQUAT-08', predictions: [{ ...prediction('NEEDS_IMPROVEMENT'),
    observedValue: 1, threshold: { minimum: .7, maximum: 1.3 }, units: 'seconds' }] }];
  input.techniqueEvaluation = { criteria: [{ criterionId: 'SQUAT-08', measurement: { perRep: [{ repNumber: 1, observedValue: { hipAboveKneeRatio: .2 } }] } }] };
  delete input.visionAnalysis;
  assert.equal(criterion(buildSquatAssessment(input), 'SQUAT-08').status, 'NEEDS_IMPROVEMENT');
});

test('a knee issue includes an actionable next-rep plan rather than only a verdict', () => {
  const rep = buildSquatAssessment(result('NEEDS_IMPROVEMENT')).assessment.reps[0];
  const plan = rep.improvementPlan.items[0];
  assert.equal(plan.criterionId, 'SQUAT-03');
  assert.equal(plan.title, 'Hướng di chuyển đầu gối');
  assert.equal(plan.kind, 'CORRECT');
  assert.equal(plan.steps.length, 2);
  assert.match(plan.steps[0], /bàn chân/);
  assert.match(plan.steps[1], /chậm|chính diện/);
});

test('passing criteria have maintenance advice while missing depth gives capture advice without inventing a technique fault', () => {
  const output = buildSquatAssessment(result());
  assert.equal(criterion(output).guidance.kind, 'MAINTAIN');
  assert.ok(criterion(output).guidance.steps.length);
  const depth = criterion(output, 'SQUAT-02');
  assert.equal(depth.correction, '');
  assert.equal(depth.guidance.kind, 'RECORD_AGAIN');
  assert.match(depth.guidance.steps[0], /góc ngang/);
  assert.ok(output.assessment.reps[0].improvementPlan.items.some(item => item.kind === 'RECORD_AGAIN'));
});

test('unresolved evidence recommends review rather than prescribing a correction for an unconfirmed fault', () => {
  const row = criterion(buildSquatAssessment(result('NEEDS_IMPROVEMENT', 'MEETS_CRITERION')));
  assert.equal(row.status, 'UNABLE_TO_ASSESS');
  assert.equal(row.guidance.kind, 'REVIEW');
  assert.equal(row.correction, '');
  assert.match(row.guidance.steps[0], /chưa coi/);
});
