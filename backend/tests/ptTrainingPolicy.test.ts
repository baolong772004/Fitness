import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeAssessment, PtAssessmentError, ptTrainingPolicy } from '../src/services/ptTraining.service.js';

const base = { kind: 'BASELINE', goal: 'Tăng thể lực', nextSteps: 'Tập theo kế hoạch tuần tới' };

test('mỗi cấp PT đòi hỏi dữ liệu đánh giá khác nhau', () => {
  assert.equal(normalizeAssessment({ ...base, level: 'BEGINNER', movementNotes: 'Cần sửa tư thế squat' }).level, 'BEGINNER');
  assert.throws(() => normalizeAssessment({ ...base, level: 'BEGINNER' }), PtAssessmentError);

  assert.equal(normalizeAssessment({ ...base, level: 'INTERMEDIATE', metricName: 'Squat kg', metricValue: 40 }).metricValue, 40);
  assert.throws(() => normalizeAssessment({ ...base, level: 'INTERMEDIATE' }), PtAssessmentError);

  assert.equal(normalizeAssessment({ ...base, level: 'ADVANCED', metricName: 'Squat kg', metricValue: 80, phaseName: 'Tăng sức mạnh' }).phaseName, 'Tăng sức mạnh');
  assert.throws(() => normalizeAssessment({ ...base, level: 'ADVANCED', metricName: 'Squat kg', metricValue: 80 }), PtAssessmentError);
});

test('đánh giá tiến bộ cần dữ liệu theo cấp và mốc theo dõi riêng', () => {
  assert.equal(ptTrainingPolicy.BEGINNER.reviewEverySessions, 4);
  assert.equal(ptTrainingPolicy.INTERMEDIATE.reviewEverySessions, 3);
  assert.equal(ptTrainingPolicy.ADVANCED.reviewEverySessions, 2);
  assert.equal(normalizeAssessment({ kind: 'REVIEW', level: 'BEGINNER', movementNotes: 'Động tác ổn định hơn', nextSteps: 'Tăng số lần tập' }).kind, 'REVIEW');
  assert.throws(() => normalizeAssessment({ kind: 'REVIEW', level: 'ADVANCED', phaseName: 'Duy trì', nextSteps: 'Tiếp tục' }), PtAssessmentError);
});
