import assert from 'node:assert/strict';
import test from 'node:test';
import { reconcileVisionAssessments, reconcileVisionFindings } from '../src/services/geminiSquatPilot.core.js';
import { analyzeSquatVideoWithGemini, hasExternalVideoConsent } from '../src/services/geminiSquatVideo.service.js';

const analysis = {
  video: { durationSeconds: 8 },
  cameraView: { detected: 'FRONT' },
  repetitions: [{ number: 1, startSeconds: 1, endSeconds: 3 }, { number: 2, startSeconds: 4, endSeconds: 6 }],
  experimentalEvaluation: { criteria: [
    { id: 'SQUAT-03', predictions: [{ rep: 1, timestampSeconds: 2, status: 'NEEDS_IMPROVEMENT' }, { rep: 2, timestampSeconds: 5, status: 'MEETS_CRITERION' }] },
  ] },
};
const finding = { repNumber: 1, criterionId: 'SQUAT-03', timestampSeconds: 2, observation: 'Gối đi vào trong', correction: 'Giữ gối theo hướng mũi chân' };

test('corroborates only the same rep and criterion with a matching rule prediction', () => {
  const [accepted] = reconcileVisionFindings({ findings: [finding] }, analysis);
  assert.equal(accepted.reviewStatus, 'RULE_CORROBORATED_COACH_REVIEW');
  assert.equal(accepted.reason, 'MATCHING_RULE_PREDICTION');
  const [unsupported] = reconcileVisionFindings({ findings: [{ ...finding, repNumber: 2, timestampSeconds: 5 }] }, analysis);
  assert.equal(unsupported.reviewStatus, 'UNSUPPORTED_COACH_REVIEW');
});

test('does not accept invented reps or timestamps as corroborated findings', () => {
  const [invented] = reconcileVisionFindings({ findings: [{ ...finding, repNumber: 9 }] }, analysis);
  assert.equal(invented.reviewStatus, 'UNSUPPORTED_COACH_REVIEW');
  assert.equal(invented.reason, 'REP_OR_TIME_MISMATCH');
  const [wrongTime] = reconcileVisionFindings({ findings: [{ ...finding, timestampSeconds: 7 }] }, analysis);
  assert.equal(wrongTime.reviewStatus, 'UNSUPPORTED_COACH_REVIEW');
});

test('does not corroborate depth from a front view even if a rule row is malformed', () => {
  const [depth] = reconcileVisionFindings({ findings: [{ ...finding, criterionId: 'SQUAT-02' }] }, {
    ...analysis, experimentalEvaluation: { criteria: [{ id: 'SQUAT-02', predictions: [{ rep: 1, timestampSeconds: 2, status: 'NEEDS_IMPROVEMENT' }] }] },
  });
  assert.equal(depth.reviewStatus, 'UNSUPPORTED_COACH_REVIEW');
  assert.equal(depth.reason, 'VIEW_OR_TARGET_NOT_SUPPORTED');
});

test('rejects malformed or unbounded model output and accepts an empty review', () => {
  assert.deepEqual(reconcileVisionFindings({ findings: [] }, analysis), []);
  assert.throws(() => reconcileVisionFindings({ findings: [{ ...finding, criterionId: 'UNKNOWN' }] }, analysis), /VISION_INVALID_RESPONSE/);
  assert.throws(() => reconcileVisionFindings({ findings: Array(6).fill(finding) }, analysis), /VISION_INVALID_RESPONSE/);
});

const evidence = [{ timestampSeconds: 2, landmarks: { leftKnee: { x: 0.4, y: 0.5, visibility: 0.9 } } }];
const memberResult = { ...analysis, experimentalEvaluation: undefined, provisionalEvaluation: { criteria: [
  { criterionId: 'SQUAT-03', predictions: [{ repNumber: 1, timestampSeconds: 2, status: 'NEEDS_IMPROVEMENT', observedValue: 0.15, landmarkEvidence: evidence }] },
] } };
const assessment = { ...finding, status: 'NEEDS_IMPROVEMENT' };

test('Member Gemini feedback requires explicit external consent and corroborating per-rep evidence', () => {
  assert.equal(hasExternalVideoConsent({ consent: 'true' }), false);
  assert.equal(hasExternalVideoConsent({ externalVideoConsent: 'false' }), false);
  assert.equal(hasExternalVideoConsent({ externalVideoConsent: true }), true);
  assert.equal(hasExternalVideoConsent({ externalVideoConsent: 'true' }), true);
  const [supported] = reconcileVisionAssessments({ assessments: [assessment] }, memberResult);
  assert.equal(supported.status, 'NEEDS_IMPROVEMENT');
  assert.equal(supported.reviewStatus, 'RULE_CORROBORATED');
  const [depth] = reconcileVisionAssessments({ assessments: [{ ...assessment, criterionId: 'SQUAT-02' }] }, memberResult);
  assert.equal(depth.status, 'UNABLE_TO_ASSESS');
  assert.equal(depth.correction, '');
  assert.throws(() => reconcileVisionAssessments({ assessments: [assessment, assessment] }, memberResult), /VISION_INVALID_RESPONSE/);
  assert.throws(() => reconcileVisionAssessments({ assessments: [{ ...assessment, repNumber: 99 }] }, memberResult), /VISION_INVALID_RESPONSE/);
});

test('Gemini receives actual video bytes, validates structured feedback and propagates service failure', async () => {
  const previous = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'unit-test-only';
  try {
    const bytes = Buffer.alloc(32); bytes.write('ftyp', 4);
    const fetcher: typeof fetch = async (url, options) => {
      assert.equal(String(url).includes('unit-test-only'), false);
      const body = JSON.parse(String(options?.body));
      assert.equal(body.contents[0].parts[1].inlineData.data, bytes.toString('base64'));
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ assessments: [assessment] }) }] } }] }), { status: 200 });
    };
    const feedback = await analyzeSquatVideoWithGemini(bytes, memberResult, fetcher);
    assert.equal(feedback.status, 'COMPLETED');
    assert.equal(feedback.assessments[0].observation, finding.observation);
    await assert.rejects(analyzeSquatVideoWithGemini(bytes, memberResult, async () => new Response('', { status: 429 })), /VISION_HTTP_429/);
  } finally { if (previous === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = previous; }
});
