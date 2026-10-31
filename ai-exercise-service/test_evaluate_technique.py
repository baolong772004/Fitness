"""Artificial JSON/files test evaluator bookkeeping, not video AI accuracy.

The reviewer and labels below are explicit unit fixtures. They must never be
included in a real Coach benchmark or copied into development report metrics.
"""
import copy
import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import evaluate_technique as evaluator


class TechniqueEvaluationMetricsTest(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.root_patch = patch.object(evaluator, 'ROOT', self.root)
        self.root_patch.start()
        self.addCleanup(self.root_patch.stop)
        self.item, self.labels, self.result = self.fixture('a')

    def fixture(self, identity, outcomes=('IMPROVE', 'MEETS')):
        # These bytes deliberately are not a real video. Only hash binding is
        # under test; no inference or Coach quality is being claimed.
        video = self.root / f'{identity}.mp4'
        video.write_bytes(('UNIT_FIXTURE_ONLY_' + identity).encode())
        digest = hashlib.sha256(video.read_bytes()).hexdigest()
        item = {'id': identity, 'exercise': 'SQUAT', 'path': video.name,
                'sourceType': 'REAL', 'split': 'holdout', 'subjectId': identity,
                'sessionId': 'session-' + identity, 'sha256': digest,
                'coachLabels': identity + '.labels.json',
                'resultPath': identity + '.inference.json',
                'referenceStandardVersion': 'UNIT_FIXTURE_RUBRIC',
                'criterionIds': ['SQUAT-01']}
        segments = [{'startSeconds': index * 2, 'endSeconds': index * 2 + 2,
                     'criteria': {'SQUAT-01': {'outcome': outcome,
                                              'timestampSeconds': index * 2 + 1,
                                              'note': 'Artificial evaluator bookkeeping fixture'}}}
                    for index, outcome in enumerate(outcomes)]
        labels = {'schemaVersion': 2, 'exercise': 'SQUAT', 'sourceType': 'REAL',
                  'videoSha256': digest, 'durationSeconds': 10,
                  'coachConfirmed': True, 'reviewer': 'UNIT_FIXTURE_NOT_A_COACH',
                  'rubricVersion': 'UNIT_FIXTURE_RUBRIC',
                  'approvedConditions': 'TEST ONLY: arbitrary condition for bookkeeping',
                  'reviewedAt': '2026-10-31T00:00:00Z', 'cameraView': 'SIDE',
                  'expectedStatus': 'ANALYZABLE', 'segments': segments}
        result = {'exercise': 'SQUAT', 'inputVideoSha256': digest,
                  'detectedRepetitions': len(segments),
                  'techniqueEvaluation': {'referenceStandardVersion': 'UNIT_FIXTURE_RUBRIC',
                                          'criteria': [{'criterionId': 'SQUAT-01', 'verdicts': []}]}}
        return item, labels, result

    def verdict(self, start, end, status):
        return {'startSeconds': start, 'endSeconds': end, 'timestampSeconds': (start + end) / 2,
                'resultStatus': status, 'referenceStandardVersion': 'UNIT_FIXTURE_RUBRIC'}

    def write_fixture(self, item, labels, result):
        (self.root / item['coachLabels']).write_text(json.dumps(labels), encoding='utf-8')
        (self.root / item['resultPath']).write_text(json.dumps(result), encoding='utf-8')

    def write_manifest(self, entries):
        path = self.root / 'manifest.json'
        path.write_text(json.dumps(entries), encoding='utf-8')
        return path

    def test_missing_coach_labels_produces_no_accuracy_numbers(self):
        item = {**self.item, 'coachLabels': None, 'split': 'development'}
        report = evaluator.evaluate(self.write_manifest([item]))
        self.assertEqual(report['status'], 'INSUFFICIENT_GROUND_TRUTH')
        self.assertEqual(report['metrics'], {})
        self.assertIsNone(report['repCountMAE'])

    def test_abstention_on_improvement_is_a_miss_not_a_pass(self):
        counts = evaluator.score(self.item, self.labels, self.result)['SQUAT-01']
        self.assertEqual(counts['fn'], 1)
        self.assertEqual(counts['abstained'], 2)
        self.assertEqual(counts['tn'], 0)

    def test_duplicate_prediction_cannot_create_two_true_positives(self):
        labels = copy.deepcopy(self.labels)
        labels['segments'][1]['criteria']['SQUAT-01']['outcome'] = 'IMPROVE'
        self.result['techniqueEvaluation']['criteria'][0]['verdicts'] = [
            self.verdict(0, 2, 'NEEDS_IMPROVEMENT'), self.verdict(0, 2, 'NEEDS_IMPROVEMENT')]
        counts = evaluator.score(self.item, labels, self.result)['SQUAT-01']
        self.assertEqual(counts['tp'], 1)
        self.assertEqual(counts['fp'], 1)
        self.assertEqual(counts['fn'], 1)
        self.assertEqual(counts['unmatchedPredictions'], 1)

    def test_false_pass_is_recorded_as_false_acceptance(self):
        self.result['techniqueEvaluation']['criteria'][0]['verdicts'] = [self.verdict(0, 2, 'MEETS_CRITERION')]
        counts = evaluator.score(self.item, self.labels, self.result)['SQUAT-01']
        self.assertEqual(counts['fn'], 1)
        self.assertEqual(counts['falseAcceptance'], 1)

    def test_inference_hash_and_standard_version_are_bound(self):
        wrong = copy.deepcopy(self.result)
        wrong['inputVideoSha256'] = '0' * 64
        with self.assertRaisesRegex(ValueError, 'SHA-256'):
            evaluator.score(self.item, self.labels, wrong)
        wrong = copy.deepcopy(self.result)
        wrong['techniqueEvaluation']['referenceStandardVersion'] = 'OTHER_RUBRIC'
        with self.assertRaisesRegex(ValueError, 'version mismatch'):
            evaluator.score(self.item, self.labels, wrong)
        scoped = {**self.item, 'exerciseVariant': 'BODYWEIGHT'}
        with self.assertRaisesRegex(ValueError, 'variant mismatch'):
            evaluator.score(scoped, self.labels, self.result)
        scoped_labels = {**self.labels, 'exerciseVariant': 'BODYWEIGHT'}
        with self.assertRaisesRegex(ValueError, 'variant mismatch'):
            evaluator.score(scoped, scoped_labels, self.result)

    def test_two_clips_of_same_exercise_use_separate_results(self):
        self.result['techniqueEvaluation']['criteria'][0]['verdicts'] = [
            self.verdict(0, 2, 'NEEDS_IMPROVEMENT'), self.verdict(2, 4, 'MEETS_CRITERION')]
        self.write_fixture(self.item, self.labels, self.result)
        item2, labels2, result2 = self.fixture('b')
        result2['detectedRepetitions'] = 0
        self.write_fixture(item2, labels2, result2)
        report = evaluator.evaluate(self.write_manifest([self.item, item2]))
        self.assertEqual(report['includedRealHoldoutVideos'], 2)
        self.assertEqual(report['metrics']['SQUAT:SQUAT-01']['tp'], 1)
        self.assertEqual(report['metrics']['SQUAT:SQUAT-01']['fn'], 1)
        self.assertEqual(report['metrics']['SQUAT:SQUAT-01']['abstentionRate'], .5)
        self.assertEqual(report['repCountMAE'], 1)

    def test_one_criterion_holdout_accepts_full_standard_inference(self):
        self.result['techniqueEvaluation']['criteria'].append(
            {'criterionId': 'SQUAT-02', 'verdicts': []})
        self.result['techniqueEvaluation']['criteria'][0]['verdicts'] = [
            self.verdict(0, 2, 'NEEDS_IMPROVEMENT'),
            self.verdict(2, 4, 'MEETS_CRITERION')]
        self.write_fixture(self.item, self.labels, self.result)
        report = evaluator.evaluate(self.write_manifest([self.item]))
        self.assertEqual(report['includedRealHoldoutVideos'], 1)
        self.assertEqual(set(report['metrics']), {'SQUAT:SQUAT-01'})
        self.assertEqual(report['metrics']['SQUAT:SQUAT-01']['tp'], 1)

    def test_holdout_subject_session_and_hash_overlap_are_rejected(self):
        self.write_fixture(self.item, self.labels, self.result)
        development = {**self.item, 'split': 'development', 'coachLabels': None}
        report = evaluator.evaluate(self.write_manifest([development, self.item]))
        self.assertEqual(report['includedRealHoldoutVideos'], 0)
        self.assertEqual(report['excluded'][1]['reason'], 'HOLDOUT_OVERLAPS_DEVELOPMENT')

    def test_standalone_holdout_manifest_checks_existing_development_catalog(self):
        self.write_fixture(self.item, self.labels, self.result)
        catalog = self.root / 'evaluation'
        catalog.mkdir()
        (catalog / 'SQUAT_DEV_VALIDATION_REPORT.json').write_text(json.dumps({
            'videos': [{'sha256': self.item['sha256'], 'subjectId': 'original-subject',
                        'sessionId': 'original-session'}],
        }), encoding='utf-8')
        disguised = {**self.item, 'subjectId': 'new-name', 'sessionId': 'new-session'}
        report = evaluator.evaluate(self.write_manifest([disguised]))
        self.assertEqual(report['includedRealHoldoutVideos'], 0)
        self.assertEqual(report['excluded'][0]['reason'], 'HOLDOUT_OVERLAPS_DEVELOPMENT')

    def test_no_exercise_named_fallback_or_duplicate_hash_scoring(self):
        self.write_fixture(self.item, self.labels, self.result)
        missing = {**self.item, 'resultPath': None}
        report = evaluator.evaluate(self.write_manifest([missing]))
        self.assertEqual(report['excluded'][0]['reason'], 'EXPLICIT_PER_CLIP_RESULT_PATH_REQUIRED')
        report = evaluator.evaluate(self.write_manifest([self.item, self.item]))
        self.assertEqual(report['includedRealHoldoutVideos'], 1)
        self.assertEqual(report['excluded'][0]['reason'], 'DUPLICATE_VIDEO_HASH')

    def test_decisive_label_requires_bounded_timestamp_and_actual_rubric(self):
        bad = copy.deepcopy(self.labels)
        bad['segments'][0]['criteria']['SQUAT-01']['timestampSeconds'] = 9
        with self.assertRaisesRegex(ValueError, 'within segment'):
            evaluator.checked_labels(self.item, bad)
        bad = copy.deepcopy(self.item)
        del bad['referenceStandardVersion']
        with self.assertRaisesRegex(ValueError, 'exact referenceStandardVersion'):
            evaluator.checked_labels(bad, self.labels)

    def test_offline_candidate_does_not_overwrite_runtime_decisions(self):
        self.result['techniqueEvaluation'].update(exerciseVariant='UNIT_VARIANT')
        self.result['cameraView'] = {'detected': 'SIDE'}
        self.result['techniqueEvaluation']['criteria'][0]['measurement'] = {'perRep': [{
            'startSeconds': 0, 'endSeconds': 2, 'timestampSeconds': 1,
            'observedValue': {'unitValue': 2}, 'landmarkEvidence': [{'unitFixture': True}],
            'measurementQuality': {'sufficientForExperimentalComparison': True}}]}
        standard = {'exerciseId': 'SQUAT', 'exerciseVariant': 'UNIT_VARIANT', 'standardVersion': 'UNIT_FIXTURE_RUBRIC',
                    'criteria': [{'criterionId': 'SQUAT-01', 'type': 'A', 'requiredCameraAngles': ['SIDE'],
                                  'evaluationPolicy': {'status': 'EXPERIMENTAL',
                                      'passCondition': {'kind': 'NUMERIC_RANGE', 'observedKey': 'unitValue', 'minimum': 1, 'maximum': 3},
                                      'improvementCondition': {'kind': 'COMPLEMENT_OF_PASS'}}}]}
        candidate = evaluator.build_offline_candidate(self.result, standard)
        self.assertEqual(candidate['techniqueEvaluation'], self.result['techniqueEvaluation'])
        dry_run = candidate['candidateTechniqueEvaluation']
        self.assertTrue(dry_run['offlineOnly'])
        self.assertEqual(dry_run['criteria'][0]['verdicts'][0]['resultStatus'], 'MEETS_CRITERION')

    def test_label_template_and_release_readiness_never_fabricate_coach_approval(self):
        from standard_registry import load_standard
        inference = {
            'exercise': 'SQUAT',
            'inputVideoSha256': self.item['sha256'],
            'video': {'durationSeconds': 10},
            'cameraView': {'detected': 'SIDE'},
            'repetitions': [{'number': 1, 'startSeconds': 0.5, 'bottomSeconds': 1.2, 'endSeconds': 2.0}],
            'techniqueEvaluation': {
                'exerciseVariant': 'BODYWEIGHT',
                'referenceStandardVersion': 'bodyweight-squat-1.0.0-draft',
                'criteria': [{'criterionId': 'SQUAT-01'}, {'criterionId': 'SQUAT-02'}],
            },
        }
        template = evaluator.generate_coach_label_template(inference)
        self.assertFalse(template['coachConfirmed'])
        self.assertEqual(template['reviewer'], '')
        self.assertEqual(len(template['segments']), 1)
        self.assertEqual(template['segments'][0]['criteria']['SQUAT-01']['outcome'], 'UNASSESSABLE')
        report = {'status': 'INSUFFICIENT_GROUND_TRUTH', 'includedRealHoldoutVideos': 0, 'metrics': {}}
        readiness = evaluator.check_release_readiness(load_standard('SQUAT'), report)
        self.assertTrue(all(not row['readyForApprovedAndValidated'] for row in readiness['criteria']))
        self.assertTrue(any(row['candidatePolicyAvailable'] for row in readiness['criteria']))


if __name__ == '__main__':
    unittest.main()
