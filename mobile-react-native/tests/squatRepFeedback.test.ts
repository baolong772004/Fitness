import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSquatRepFeedback } from '../src/lib/squatRepFeedback';
import type { AnalysisResult, UnifiedAssessment } from '../src/lib/exerciseAnalysis';

test('Mobile never converts raw source labels into a second assessment', () => {
  const legacy = { exercise: 'SQUAT', provisionalEvaluation: { criteria: [{ criterionId: 'SQUAT-03', status: 'MEETS_CRITERION' }] },
    visionAnalysis: { status: 'COMPLETED', assessments: [{ repNumber: 1, criterionId: 'SQUAT-03', status: 'MEETS_CRITERION' }] } } as unknown as AnalysisResult;
  assert.deepEqual(buildSquatRepFeedback(legacy), []);
});

test('Mobile preserves the single Backend decision, including a local unresolved criterion', () => {
  const assessment: UnifiedAssessment = { version: 'squat-assessment-fusion-1', scope: 'PER_CRITERION_2D_ONLY', wholeExerciseStatus: 'NOT_CONFIRMED',
    reps: [{ repNumber: 2, status: 'NEEDS_IMPROVEMENT', headline: 'Cần điều chỉnh kỹ thuật', meets: 1, improves: 1, unable: 1, reviewRequired: true,
      criteria: [{ id: 'SQUAT-03', title: 'Hướng gối', status: 'NEEDS_IMPROVEMENT', validation: 'PROVISIONAL', explanation: 'Gối dịch vào trong.', correction: 'Kiểm soát hướng gối.', needsReview: false, reasonCode: 'STRONG_MEASUREMENT_ESTIMATE', details: [] },
        { id: 'SQUAT-02', title: 'Độ sâu', status: 'UNABLE_TO_ASSESS', validation: 'NOT_ASSESSED', explanation: 'Thiếu góc quay.', correction: '', needsReview: true, reasonCode: 'SOURCE_CONFLICT', details: [] }] }] };
  const result = { exercise: 'SQUAT', assessment } as AnalysisResult;
  assert.equal(buildSquatRepFeedback(result), assessment.reps);
  assert.equal(buildSquatRepFeedback(result)[0].criteria[1].status, 'UNABLE_TO_ASSESS');
  assert.equal(buildSquatRepFeedback(result)[0].improves, 1);
});
