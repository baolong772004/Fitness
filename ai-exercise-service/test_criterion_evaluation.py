"""Artificial release-artifact bookkeeping; these are not Coach approvals."""
from copy import deepcopy
import hashlib
import json
from pathlib import Path
import tempfile
import unittest

from criterion_evaluation import compare_measurement, default_candidate_policy, reference_digest, released_policy
from evaluate_technique import evaluate
from standard_registry import load_standard


class CriterionConditionTest(unittest.TestCase):
    def test_failed_pass_does_not_implicitly_mean_improvement(self):
        policy = {'passCondition': {'kind': 'NUMERIC_RANGE', 'observedKey': 'value', 'minimum': 1, 'maximum': 2}}
        self.assertEqual(compare_measurement({'value': 3}, {}, policy)[0], None)
        self.assertEqual(compare_measurement({'value': 1.5}, {}, policy)[0], 'MEETS_CRITERION')
        policy['improvementCondition'] = {'kind': 'COMPLEMENT_OF_PASS'}
        self.assertEqual(compare_measurement({'value': 3}, {}, policy)[0], 'NEEDS_IMPROVEMENT')

    def test_explicit_dead_band_and_overlapping_conditions_abstain(self):
        policy = {'passCondition': {'kind': 'NUMERIC_RANGE', 'observedKey': 'value', 'minimum': 1, 'maximum': 2},
                  'improvementCondition': {'kind': 'NUMERIC_RANGE', 'observedKey': 'value', 'minimum': 4, 'maximum': 5}}
        self.assertEqual(compare_measurement({'value': 3}, {}, policy)[2], 'OUTSIDE_APPROVED_DECISION_REGIONS')
        policy['improvementCondition']['minimum'] = 1
        self.assertEqual(compare_measurement({'value': 1.5}, {}, policy)[2], 'OVERLAPPING_APPROVED_CONDITIONS')

    def test_compound_and_default_candidate_policies_evaluate_squat_criteria(self):
        p01 = default_candidate_policy('SQUAT-01')
        self.assertEqual(compare_measurement(
            {'completedCycleObserved': True, 'totalSeconds': 1.5, 'descentSeconds': 0.7, 'ascentSeconds': 0.8},
            {}, p01)[0], 'MEETS_CRITERION')
        self.assertEqual(compare_measurement(
            {'completedCycleObserved': True, 'totalSeconds': 0.4, 'descentSeconds': 0.2, 'ascentSeconds': 0.2},
            {}, p01)[0], 'NEEDS_IMPROVEMENT')
        p04 = default_candidate_policy('SQUAT-04')
        self.assertEqual(compare_measurement(
            {'earlyAscentLeanChangeDegrees': 5.0, 'hipShoulderRiseDifferenceRatio': 0.03},
            {}, p04)[0], 'MEETS_CRITERION')
        self.assertEqual(compare_measurement(
            {'earlyAscentLeanChangeDegrees': 16.0, 'hipShoulderRiseDifferenceRatio': 0.18},
            {}, p04)[0], 'NEEDS_IMPROVEMENT')
        p05 = default_candidate_policy('SQUAT-05')
        self.assertEqual(compare_measurement(
            {'descentDifferenceFromClipMedianSeconds': 0.1, 'ascentDifferenceFromClipMedianSeconds': -0.1,
             'descentSeconds': 0.8, 'ascentSeconds': 0.9},
            {}, p05)[0], 'MEETS_CRITERION')
        self.assertEqual(compare_measurement(
            {'descentDifferenceFromClipMedianSeconds': 0.5, 'ascentDifferenceFromClipMedianSeconds': 0.0,
             'descentSeconds': 0.8, 'ascentSeconds': 0.9},
            {}, p05)[0], 'NEEDS_IMPROVEMENT')
        p08 = default_candidate_policy('SQUAT-08', protocol={'descentTargetSeconds': 2.0})
        self.assertEqual(compare_measurement(
            {'descentSeconds': 2.1}, {'descentTargetSeconds': 2.0}, p08)[0], 'MEETS_CRITERION')
        self.assertEqual(compare_measurement(
            {'descentSeconds': 1.2}, {'descentTargetSeconds': 2.0}, p08)[0], 'NEEDS_IMPROVEMENT')
        self.assertIsNone(default_candidate_policy('SQUAT-06'))
        self.assertIsNone(default_candidate_policy('SQUAT-07'))


class CriterionReleaseArtifactTest(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.standard = load_standard('SQUAT')
        self.criterion = self.standard['criteria'][0]
        reviewer = {'reviewerId': 'UNIT_FIXTURE_NOT_COACH', 'qualification': 'UNIT_FIXTURE',
                    'reviewRecordId': 'UNIT_FIXTURE', 'reviewedAt': '2026-10-31T07:00:00Z'}
        self.standard['approvedByCoach'] = reviewer
        self.standard['approvedAt'] = '2026-10-31T10:00:00Z'
        self.policy = self.criterion['evaluationPolicy']
        self.policy.update(status='APPROVED_AND_VALIDATED', approvedByCoach=reviewer,
                           approvedAt='2026-10-31T10:00:00Z',
                           passCondition={'kind': 'NUMERIC_RANGE', 'observedKey': 'testValue', 'minimum': 1, 'maximum': 2},
                           improvementCondition={'kind': 'COMPLEMENT_OF_PASS'})
        self.policy['approvedStandardDigest'] = reference_digest(self.standard)
        video = self.root / 'UNIT_TEST_NOT_VIDEO.mp4'
        video.write_bytes(b'ARTIFICIAL_RELEASE_BOOKKEEPING_NOT_VIDEO')
        digest = hashlib.sha256(video.read_bytes()).hexdigest()
        self.scope = {'exerciseVariant': 'BODYWEIGHT', 'cameraViews': ['SIDE'],
                      'modelVersion': 'UNIT_MODEL', 'ruleVersion': 'UNIT_RULE'}
        self.labels = {'schemaVersion': 2, 'exercise': 'SQUAT', 'exerciseVariant': 'BODYWEIGHT',
                       'sourceType': 'REAL', 'videoSha256': digest, 'durationSeconds': 10,
                       'coachConfirmed': True, 'reviewer': 'UNIT_FIXTURE_NOT_COACH',
                       'rubricVersion': self.standard['standardVersion'], 'approvedConditions': 'UNIT TEST ONLY',
                       'reviewedAt': '2026-10-31T09:00:00Z', 'cameraView': 'SIDE', 'expectedStatus': 'ANALYZABLE',
                       'segments': [{'startSeconds': i * 2, 'endSeconds': i * 2 + 2,
                                     'criteria': {'SQUAT-01': {'outcome': outcome, 'timestampSeconds': i * 2 + 1,
                                                               'note': 'Artificial unit fixture'}}}
                                    for i, outcome in enumerate(('IMPROVE', 'MEETS'))]}
        self.inference = {'exercise': 'SQUAT', 'inputVideoSha256': digest, 'detectedRepetitions': 2,
                          'modelVersion': 'UNIT_MODEL', 'ruleVersion': 'UNIT_RULE',
                          'techniqueEvaluation': {'exerciseVariant': 'BODYWEIGHT',
                            'referenceStandardVersion': self.standard['standardVersion'],
                            'criteria': [{'criterionId': 'SQUAT-01', 'verdicts': [
                              {'startSeconds': i * 2, 'endSeconds': i * 2 + 2,
                               'timestampSeconds': i * 2 + 1, 'status': outcome}
                              for i, outcome in enumerate(('NEEDS_IMPROVEMENT', 'MEETS_CRITERION'))]}]}}
        self.item = {'exercise': 'SQUAT', 'path': video.name, 'sha256': digest,
                     'sourceType': 'REAL', 'split': 'holdout', 'subjectId': 'UNIT_TEST_SUBJECT', 'sessionId': 'UNIT_TEST_SESSION',
                     'coachLabels': 'unit-labels.json', 'resultPath': 'unit-result.json',
                     'referenceStandardVersion': self.standard['standardVersion'], 'criterionIds': ['SQUAT-01']}
        self.write_json('unit-labels.json', self.labels)
        self.write_json('unit-result.json', self.inference)
        self.write_json('unit-manifest.json', [self.item])
        self.report = evaluate(self.root / 'unit-manifest.json', root=self.root)
        self.report['releaseEvidence'] = {'SQUAT-01': {
            'criterionId': 'SQUAT-01', 'standardVersion': self.standard['standardVersion'],
            'reviewedStandardDigest': reference_digest(self.standard), 'independentCoachReview': True,
            'scope': self.scope, 'holdoutStartedAt': '2026-10-31T08:00:00Z', 'evaluatedAt': '2026-10-31T09:30:00Z',
            'acceptanceCriteria': {'id': 'UNIT_TEST_ACCEPTANCE', 'declaredAt': '2026-10-30T00:00:00Z',
                                   'minimumPrecision': .8, 'minimumRecall': .8, 'maximumAbstentionRate': .1,
                                   'minimumPositiveLabels': 1, 'minimumNegativeLabels': 1, 'minimumVideos': 1}}}
        self.bind_report()

    def write_json(self, name, value):
        (self.root / name).write_text(json.dumps(value), encoding='utf-8')

    def bind_report(self):
        self.write_json('unit-report.json', self.report)
        self.policy['validationReport'] = {'path': 'unit-report.json',
            'sha256': hashlib.sha256((self.root / 'unit-report.json').read_bytes()).hexdigest(),
            'standardVersion': self.standard['standardVersion'], 'criterionId': 'SQUAT-01',
            'scope': self.scope, 'acceptanceCriteriaId': 'UNIT_TEST_ACCEPTANCE'}

    def release(self):
        return released_policy(self.standard, self.criterion, self.root)

    def test_artificial_complete_fixture_exercises_actual_release_gate(self):
        policy, reason = self.release()
        self.assertIsNone(reason)
        self.assertEqual(policy['status'], 'APPROVED_AND_VALIDATED')

    def test_rule_review_after_holdout_cannot_be_released(self):
        self.policy['approvedByCoach']['reviewedAt'] = '2026-10-31T08:01:00Z'
        self.assertEqual(self.release()[1], 'COACH_RULE_REVIEW_AFTER_HOLDOUT')

    def test_claimed_acceptance_flags_cannot_replace_numeric_targets(self):
        evidence = self.report['releaseEvidence']['SQUAT-01']
        evidence.update(acceptanceMet=True, acceptancePredeclared=True)
        evidence.pop('acceptanceCriteria')
        self.bind_report()
        self.assertEqual(self.release()[1], 'VALIDATION_ACCEPTANCE_NOT_MET')

    def test_late_or_impossible_acceptance_and_inadequate_support_fail(self):
        acceptance = self.report['releaseEvidence']['SQUAT-01']['acceptanceCriteria']
        for key, value in [('declaredAt', '2026-11-01T00:00:00Z'), ('minimumPositiveLabels', 10), ('minimumNegativeLabels', 10)]:
            original = acceptance[key]
            acceptance[key] = value
            self.bind_report()
            self.assertEqual(self.release()[1], 'VALIDATION_ACCEPTANCE_NOT_MET')
            acceptance[key] = original

    def test_edited_counts_and_changed_inference_are_detected(self):
        self.report['metrics']['SQUAT:SQUAT-01']['precision'] = .99
        self.bind_report()
        self.assertEqual(self.release()[1], 'VALIDATION_ACCEPTANCE_NOT_MET')
        self.report['metrics']['SQUAT:SQUAT-01']['precision'] = 1
        self.bind_report()
        changed = deepcopy(self.inference)
        changed['inputVideoSha256'] = '0' * 64
        self.write_json('unit-result.json', changed)
        self.assertEqual(self.release()[1], 'VALIDATION_ACCEPTANCE_NOT_MET')

    def test_wrong_model_variant_and_changed_standard_fail(self):
        changed = deepcopy(self.inference)
        changed['modelVersion'] = 'OTHER_MODEL'
        self.write_json('unit-result.json', changed)
        refreshed = evaluate(self.root / 'unit-manifest.json', root=self.root)
        self.report['clips'] = refreshed['clips']
        self.bind_report()
        self.assertEqual(self.release()[1], 'VALIDATION_SCOPE_MISMATCH')
        self.standard['exerciseName'] = 'CHANGED_AFTER_APPROVAL'
        self.assertEqual(self.release()[1], 'STANDARD_CHANGED_AFTER_APPROVAL')


if __name__ == '__main__':
    unittest.main()
