import assert from 'node:assert/strict';
import test from 'node:test';
import { analysisQuota, analysisSummary, buildHoldoutExportBundle, coachAnalysisSummary, compareAiAndCoachLabels, evaluateCandidateRep, isSupportedVideo, publicAnalysis, resolveCoachLabelHistory, videoAvailable, parseAnalysisOptions } from '../src/services/exerciseAnalysis.utils.js';
import { isExerciseType, publicExercises } from '../src/services/exerciseAnalysis.catalog.ts';

test('video signature validation rejects arbitrary bytes', () => {
  assert.equal(isSupportedVideo(Buffer.alloc(40)), false);
  const mp4 = Buffer.alloc(40);
  mp4.write('ftyp', 4, 'ascii');
  assert.equal(isSupportedVideo(mp4), true);
  const webm = Buffer.alloc(40);
  Buffer.from([0x1a, 0x45, 0xdf, 0xa3]).copy(webm);
  assert.equal(isSupportedVideo(webm), true);
});

test('public analysis never includes private storage key', () => {
  const result = publicAnalysis({ id: 1, mediaStorageKey: 'private.video', resultJson: '{"status":"COMPLETED"}' });
  assert.deepEqual(result, { id: 1, videoAvailable: false, result: { status: 'COMPLETED' } });
});

test('video access expires at seven days and rejects unsafe storage keys', () => {
  const now = Date.now();
  const row = { mediaStorageKey: '01234567-89ab-cdef-0123-456789abcdef.video', createdAt: new Date(now), mediaDeletedAt: null };
  assert.equal(videoAvailable(row, now), true);
  assert.equal(videoAvailable(row, now + 7 * 86400000), false);
  assert.equal(videoAvailable({ ...row, mediaDeletedAt: new Date() }, now), false);
  assert.equal(videoAvailable({ ...row, mediaStorageKey: '../secret.video' }, now), false);
  assert.equal(videoAvailable({ ...row, mediaStorageKey: null }, now), false);
});

test('history omits pose frames while detail preserves them', () => {
  const row = { resultJson: JSON.stringify({ poseFrames: [{ timeSeconds: 0 }], repetitions: [{ number: 1 }] }) };
  assert.equal(analysisSummary(row).result.poseFrames, undefined);
  assert.equal(publicAnalysis(row).result.poseFrames.length, 1);
  assert.equal(analysisSummary(row).result.repetitions.length, 1);
});

test('history keeps diagnostic counts but omits per-frame traces; detail retains both', () => {
  const diagnostics = { pose: { poseFrames: 100 }, timeline: [{ timeSeconds: 0 }], decodeTimeline: [{ sourceFrame: 0 }], segmentation: { transitionCount: 4, signal: [{ raw: 170 }] } };
  const row = { resultJson: JSON.stringify({ diagnostics, repetitions: [] }) };
  assert.deepEqual(analysisSummary(row).result.diagnostics, { pose: { poseFrames: 100 }, segmentation: { transitionCount: 4 } });
  assert.deepEqual(publicAnalysis(row).result.diagnostics, diagnostics);
});

test('Squat goals are explicit and validated before persisting or forwarding', () => {
  assert.deepEqual(parseAnalysisOptions(undefined), { cameraView: 'AUTO', depthTarget: 'NONE', descentTargetSeconds: null });
  assert.equal(parseAnalysisOptions('{"cameraView":"FRONT","descentTargetSeconds":2}').descentTargetSeconds, 2);
  for (const raw of ['bad JSON', '[]', 'null', '{"cameraView":"OBLIQUE"}', '{"descentTargetSeconds":true}', '{"descentTargetSeconds":7}', '{"unknown":1}']) assert.throws(() => parseAnalysisOptions(raw));
});

test('six exercise types are explicit and disclose unvalidated technique status', () => {
  assert.deepEqual(publicExercises.map(item => item.code), ['SQUAT', 'PUSH_UP', 'PLANK', 'LUNGE', 'BICEPS_CURL', 'SHOULDER_PRESS']);
  assert.ok(publicExercises.every(item => item.techniqueStatus === 'NOT_COACH_VALIDATED'));
  assert.equal(isExerciseType('BICEPS_CURL'), true);
  assert.equal(isExerciseType('UNKNOWN'), false);
});

test('analysis quota follows member, trial and paid tiers', () => {
  assert.equal(analysisQuota({ paid: false, trial: false }).limit, 3);
  assert.equal(analysisQuota({ paid: false, trial: true }).limit, 5);
  assert.equal(analysisQuota({ paid: true, trial: true }).limit, 10);
  assert.equal(analysisQuota({ paid: true, trial: false, configured: '12' }).limit, 12);
  assert.equal(analysisQuota({ paid: false, trial: false, configured: '0' }).limit, 3);
});

test('coach summary retains per-rep measurements, compares AI vs Coach labels and exports holdout bundle', () => {
  const repRow = {
    repNumber: 1,
    startSeconds: 0.5,
    endSeconds: 2.0,
    timestampSeconds: 1.2,
    observedValue: { inwardChangeStanceRatio: 0.04, completedCycleObserved: true, totalSeconds: 1.5, descentSeconds: 0.7, ascentSeconds: 0.8 },
    landmarkEvidence: [{ timestampSeconds: 1.2, landmarks: { leftKnee: { x: 0.4, y: 0.6, visibility: 0.98 } } }],
    measurementQuality: { sufficientForExperimentalComparison: true },
  };
  assert.equal(evaluateCandidateRep('SQUAT-01', repRow, {}, 'FRONT'), 'MEETS_CRITERION');
  assert.equal(evaluateCandidateRep('SQUAT-03', repRow, {}, 'FRONT'), 'MEETS_CRITERION');
  assert.equal(evaluateCandidateRep('SQUAT-06', repRow, {}, 'FRONT'), 'UNABLE_TO_ASSESS');

  const resultPayload = {
    exercise: 'SQUAT',
    exerciseVariant: 'BODYWEIGHT',
    inputVideoSha256: 'a'.repeat(64),
    cameraView: { detected: 'FRONT' },
    protocol: { cameraView: 'FRONT', depthTarget: 'NONE', descentTargetSeconds: null },
    video: { durationSeconds: 10 },
    poseFrames: [{ timeSeconds: 0 }],
    repetitions: [{ number: 1, startSeconds: 0.5, bottomSeconds: 1.2, endSeconds: 2.0 }],
    techniqueEvaluation: {
      exercise: 'SQUAT',
      exerciseVariant: 'BODYWEIGHT',
      referenceStandardVersion: 'bodyweight-squat-1.0.0-draft',
      criteria: [
        { criterionId: 'SQUAT-01', status: 'MEASURED', measurement: { sampleCount: 15, perRep: [repRow] }, verdicts: [] },
        { criterionId: 'SQUAT-03', status: 'MEASURED', measurement: { sampleCount: 15, perRep: [repRow] }, verdicts: [] },
      ],
    },
  };
  const coachSummary = coachAnalysisSummary({ id: 99, mediaStorageKey: 'secret.video', resultJson: JSON.stringify(resultPayload) });
  assert.equal(coachSummary.mediaStorageKey, undefined);
  assert.equal(coachSummary.result.poseFrames, undefined);
  assert.equal(coachSummary.result.techniqueEvaluation.criteria[0].measurement.perRep.length, 1);

  const labels = [
    { id: 1, coachId: 12, standardVersion: 'bodyweight-squat-1.0.0-draft', criterionId: 'SQUAT-03', repNumber: 1, startSeconds: 0.5, endSeconds: 2.0, timestampSeconds: 1.2, outcome: 'MEETS', reviewerNotes: 'Good knee alignment', evidenceJson: JSON.stringify({ cameraView: 'FRONT' }) },
    { id: 2, coachId: 12, standardVersion: 'bodyweight-squat-1.0.0-draft', criterionId: 'SQUAT-01', repNumber: 1, startSeconds: 0.5, endSeconds: 2.0, timestampSeconds: 1.2, outcome: 'IMPROVE', reviewerNotes: 'Incomplete lockout', evidenceJson: JSON.stringify({ cameraView: 'FRONT' }) },
  ];
  const comparison = compareAiAndCoachLabels(resultPayload, labels);
  assert.equal(comparison.totalLabels, 2);
  assert.equal(comparison.agreeCount, 1);
  assert.equal(comparison.disagreeFalseNegativeCount, 1);

  const bundle = buildHoldoutExportBundle({ id: 99, memberId: 7, exerciseType: 'SQUAT' }, resultPayload, [labels[0]], 'Coach Test');
  assert.equal(bundle.coachLabelsDocument.schemaVersion, 2);
  assert.equal(bundle.coachLabelsDocument.videoSha256, 'a'.repeat(64));
  assert.equal(bundle.coachLabelsDocument.segments.length, 1);
  assert.equal(bundle.coachLabelsDocument.segments[0].criteria['SQUAT-03'].outcome, 'MEETS');
  assert.equal(bundle.coachLabelsDocument.segments[0].criteria['SQUAT-03'].cameraView, 'FRONT');
  assert.equal(bundle.coachLabelsDocument.segments[0].criteria['SQUAT-03'].reviewerId, 12);
  assert.equal(bundle.exportStatus, 'DRAFT_REQUIRES_COACH_CONFIRMATION_AND_SPLIT_REVIEW');
  assert.equal(bundle.coachLabelsDocument.coachConfirmed, false);
  assert.equal(bundle.manifestEntry.split, 'UNASSIGNED');
  assert.equal(bundle.manifestEntry.sourceType, 'UNVERIFIED');
  assert.equal(bundle.manifestEntry.subjectId, null);
});

test('resolveCoachLabelHistory tracks revisions per rep and criterion without double-counting edited labels', () => {
  const revisions = [
    {
      id: 10,
      coachId: 42,
      criterionId: 'SQUAT-02',
      repNumber: 1,
      startSeconds: 1.0,
      endSeconds: 3.0,
      timestampSeconds: 2.0,
      outcome: 'MEETS',
      standardVersion: 'bodyweight-squat-1.0.0-draft',
      reviewerNotes: 'Initial pass',
      createdAt: '2026-10-31T10:00:00.000Z',
      evidenceJson: JSON.stringify({ cameraView: 'SIDE', observation: 'Hip near knee' }),
    },
    {
      id: 11,
      coachId: 42,
      criterionId: 'SQUAT-02',
      repNumber: 1,
      startSeconds: 1.0,
      endSeconds: 3.0,
      timestampSeconds: 2.1,
      outcome: 'IMPROVE',
      standardVersion: 'bodyweight-squat-1.0.0-draft',
      reviewerNotes: 'Updated after frame-by-frame check: hip stayed above parallel',
      createdAt: '2026-10-31T10:05:00.000Z',
      evidenceJson: JSON.stringify({ cameraView: 'SIDE', observation: 'Hip above knee at bottom' }),
    },
  ];
  const resolved = resolveCoachLabelHistory(revisions, 'UNKNOWN');
  assert.equal(resolved.totalRevisions, 2);
  assert.equal(resolved.activeLabels.length, 1);
  assert.equal(resolved.activeLabels[0].outcome, 'IMPROVE');
  assert.equal(resolved.activeLabels[0].cameraView, 'SIDE');
  assert.equal(resolved.activeLabels[0].reviewerId, 42);
  assert.equal(resolved.activeLabels[0].revision, 2);
  assert.equal(resolved.activeLabels[0].editHistory.length, 2);
  assert.equal(resolved.activeLabels[0].editHistory[0].outcome, 'MEETS');
  assert.equal(resolved.activeLabels[0].editHistory[1].outcome, 'IMPROVE');
});
