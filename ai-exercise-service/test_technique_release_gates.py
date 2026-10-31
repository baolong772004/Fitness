"""Engine gate bookkeeping with artificial measurements, not Coach validation.

Where a release is simulated below, only the dependency boundary is patched;
no actual standard approval, Coach label or release artifact is manufactured.
"""
from copy import deepcopy
import unittest
from unittest.mock import patch

import technique_engine as engine
from standard_registry import load_standard, standard_digest


class TechniqueReleaseGateTest(unittest.TestCase):
    def setUp(self):
        self.standard = load_standard('SQUAT')
        self.row = {
            'repNumber': 1, 'startSeconds': 1, 'endSeconds': 3,
            'timestampSeconds': 2, 'observedValue': {'descentSeconds': 1},
            'units': {'descentSeconds': 'seconds'}, 'validFrames': 21,
            'landmarkEvidence': [{'timestampSeconds': 2,
                                  'landmarks': {'leftHip': {'x': .4, 'y': .5, 'visibility': .99}}}],
            'measurementQuality': {'sufficientForExperimentalComparison': True},
            'confidenceOfObservation': .99,
            'confidenceBasis': 'minimum_landmark_visibility_not_technique_accuracy',
        }
        self.measurements = {'SQUAT-01': {'perRep': [self.row], 'sampleCount': 21}}
        self.movement = {'cameraView': {'detected': 'SIDE'}, 'protocol': {},
                         'repetitions': [{'number': 1}], 'modelVersion': 'UNIT_MODEL', 'ruleVersion': 'UNIT_RULE'}
        self.extract = patch.object(engine, 'extract_squat_measurements', return_value=self.measurements)
        self.extract.start()
        self.addCleanup(self.extract.stop)
        self.policy = {'approvedByCoach': {'reviewerId': 'UNIT_TEST_DEPENDENCY_ONLY'},
                       'validationReport': {'scope': {'exerciseVariant': 'BODYWEIGHT', 'cameraViews': ['SIDE'],
                                                       'modelVersion': 'UNIT_MODEL', 'ruleVersion': 'UNIT_RULE'}},
                       'improvementCondition': {'kind': 'COMPLEMENT_OF_PASS'},
                       'passCondition': {'kind': 'NUMERIC_RANGE', 'observedKey': 'descentSeconds',
                                         'minimum': .5, 'maximum': 1.5}}

    def result(self, variant='BODYWEIGHT', **kwargs):
        return engine.evaluate_technique('SQUAT', [], self.movement, 800, 800,
                                         variant=variant, **kwargs)

    def simulated_release(self, standard, criterion):
        return (self.policy, None) if criterion['criterionId'] == 'SQUAT-01' else (None, 'NOT_COACH_VALIDATED')

    def test_actual_draft_measurements_never_become_definitive(self):
        result = self.result()
        item = result['criteria'][0]
        self.assertEqual(item['status'], 'MEASURED')
        self.assertEqual(item['reasonCode'], 'NOT_COACH_VALIDATED')
        self.assertEqual(item['measurement']['perRep'][0]['observedValue']['descentSeconds'], 1)
        self.assertFalse(any(row['status'] in engine.DECISIVE for row in result['criteria']))

    def test_missing_explicit_variant_refuses_even_a_simulated_release(self):
        with patch.object(engine, 'released_policy', side_effect=self.simulated_release):
            result = self.result('UNSPECIFIED')
        self.assertEqual(result['criteria'][0]['reasonCode'], 'VARIANT_NOT_SPECIFIED')
        self.assertEqual(result['passedCriteria'], 0)

    def test_wrong_variant_refuses_even_a_simulated_release(self):
        with patch.object(engine, 'released_policy', side_effect=self.simulated_release):
            result = self.result('BARBELL_BACK')
        self.assertEqual(result['criteria'][0]['reasonCode'], 'VARIANT_NOT_SUPPORTED')
        self.assertEqual(result['passedCriteria'], 0)

    def test_changed_model_or_rule_cannot_reuse_a_simulated_validation_release(self):
        with patch.object(engine, 'released_policy', side_effect=self.simulated_release):
            self.movement['modelVersion'] = 'DIFFERENT_MODEL'
            self.assertEqual(self.result()['criteria'][0]['reasonCode'], 'VALIDATION_SCOPE_MISMATCH')
            self.movement['modelVersion'] = 'UNIT_MODEL'
            self.movement['ruleVersion'] = 'DIFFERENT_RULE'
            self.assertEqual(self.result()['criteria'][0]['reasonCode'], 'VALIDATION_SCOPE_MISMATCH')

    def test_camera_quality_and_joint_evidence_are_independent_gates(self):
        with patch.object(engine, 'released_policy', side_effect=self.simulated_release):
            self.movement['cameraView']['detected'] = 'UNKNOWN'
            self.assertEqual(self.result()['criteria'][0]['reasonCode'], 'CAMERA_VIEW_NOT_VERIFIED')
            self.movement['cameraView']['detected'] = 'SIDE'
            self.row['measurementQuality']['sufficientForExperimentalComparison'] = False
            self.assertEqual(self.result()['criteria'][0]['verdicts'][0]['reasonCode'], 'TRACKING_OR_REFERENCE_UNVERIFIED')
            self.row['measurementQuality']['sufficientForExperimentalComparison'] = True
            self.row['landmarkEvidence'] = []
            self.assertEqual(self.result()['criteria'][0]['verdicts'][0]['reasonCode'], 'MISSING_LANDMARK_EVIDENCE')

    def test_simulated_released_condition_produces_scoped_decision_and_evidence(self):
        with patch.object(engine, 'released_policy', side_effect=self.simulated_release):
            result = self.result()
        item = result['criteria'][0]
        self.assertEqual(item['status'], 'MEETS_CRITERION')
        self.assertEqual(result['headline'], 'Đạt các tiêu chí đã kiểm tra')
        self.assertEqual(result['passedCriteria'], 1)
        self.assertEqual(result['unassessedCriteria'], 7)
        self.assertEqual(item['verdicts'][0]['landmarkEvidence'], self.row['landmarkEvidence'])
        self.assertEqual(item['verdicts'][0]['referenceStandardVersion'], self.standard['standardVersion'])

    def test_simulated_improvement_contains_issue_value_time_and_sourced_advice(self):
        self.row['observedValue']['descentSeconds'] = 3
        with patch.object(engine, 'released_policy', side_effect=self.simulated_release):
            result = self.result()
        item = result['criteria'][0]
        self.assertEqual(item['status'], 'NEEDS_IMPROVEMENT')
        feedback = item['verdicts'][0]['feedback']
        self.assertEqual(feedback['repNumber'], 1)
        self.assertEqual(feedback['timestampSeconds'], 2)
        self.assertEqual(feedback['observedValue']['descentSeconds'], 3)
        self.assertTrue(feedback['bodyPart'] and feedback['adjustments'] and feedback['source'])

    def test_individual_target_requires_provenance_without_blocking_measurement(self):
        self.policy['passCondition'] = {'kind': 'TARGET_TOLERANCE', 'observedKey': 'descentSeconds',
                                        'targetKey': 'descentTargetSeconds', 'tolerance': .3}
        with patch.object(engine, 'released_policy', side_effect=self.simulated_release):
            missing = self.result()
            self.assertEqual(missing['criteria'][0]['reasonCode'], 'GOAL_NOT_SET')
            self.movement['protocol']['descentTargetSeconds'] = 1
            unproven = self.result()
            self.assertEqual(unproven['criteria'][0]['reasonCode'], 'TARGET_PROVENANCE_REQUIRED')
            target = {'descentTargetSeconds': {'value': 1, 'units': 'seconds',
                                               'exerciseVariant': 'BODYWEIGHT',
                                               'source': 'UNIT_TEST_ONLY', 'configuredBy': 'UNIT_TEST',
                                               'configuredAt': '2026-10-31T00:00:00Z'}}
            result = self.result(individual_targets=target)
        self.assertEqual(result['criteria'][0]['status'], 'MEETS_CRITERION')
        self.assertIsNotNone(missing['criteria'][0]['measurement'])

    def test_raw_unsupported_heel_measurement_cannot_gain_a_verdict(self):
        self.measurements['SQUAT-07'] = {'perRep': [deepcopy(self.row)], 'sampleCount': 21,
                                        'evaluationSupported': False}
        with patch.object(engine, 'released_policy', return_value=(self.policy, None)):
            result = self.result()
        heel = next(item for item in result['criteria'] if item['code'] == 'SQUAT-07')
        self.assertEqual(heel['status'], 'NOT_SUPPORTED')
        self.assertTrue(heel['measurement'])
        self.assertEqual(heel['verdicts'], [])

    def test_result_snapshot_is_exact_independent_and_client_cannot_approve(self):
        self.movement['protocol']['approvedByCoach'] = 'CLIENT_CANNOT_APPROVE'
        result = self.result(plan_context={'approvedByCoach': 'CLIENT_CANNOT_APPROVE'})
        self.assertEqual(result['referenceStandardDigest'], standard_digest(result['standardSnapshot']))
        result['standardSnapshot']['exerciseName'] = 'ALTERED_LOCAL_COPY'
        self.assertNotEqual(load_standard('SQUAT')['exerciseName'], 'ALTERED_LOCAL_COPY')
        self.assertEqual(result['passedCriteria'], 0)
        self.assertIsNone(result['criteria'][0]['approval'])

    def test_single_approved_criterion_unlocks_per_rep_member_verdicts_without_unlocking_others(self):
        from criterion_evaluation import default_candidate_policy
        from squat_criteria import analyze_pose_frames
        from test_squat_criteria import frames as squat_frames
        self.extract.stop()
        poses = squat_frames('FRONT')
        movement = analyze_pose_frames(poses, 800, 800)
        movement.update(modelVersion='UNIT_MODEL', ruleVersion='UNIT_RULE')
        candidate_03 = default_candidate_policy('SQUAT-03')
        policy_03 = {
            'approvedByCoach': {'reviewerId': 'UNIT_TEST_DEPENDENCY_ONLY', 'qualification': 'UNIT_FIXTURE', 'reviewRecordId': 'UNIT_FIXTURE'},
            'validationReport': {'scope': {'exerciseVariant': 'BODYWEIGHT', 'cameraViews': ['FRONT'],
                                           'modelVersion': 'UNIT_MODEL', 'ruleVersion': 'UNIT_RULE'}},
            **candidate_03,
        }
        def selective_release(standard, criterion):
            return (policy_03, None) if criterion['criterionId'] == 'SQUAT-03' else (None, 'NOT_COACH_VALIDATED')

        with patch.object(engine, 'released_policy', side_effect=selective_release):
            official = engine.evaluate_technique('SQUAT', poses, movement, 800, 800, variant='BODYWEIGHT')
        by_id = {row['criterionId']: row for row in official['criteria']}
        self.assertEqual(by_id['SQUAT-03']['status'], 'NEEDS_IMPROVEMENT')
        self.assertEqual(official['needsImprovementCriteria'], 1)
        self.assertEqual(official['passedCriteria'], 0)
        self.assertEqual(len(by_id['SQUAT-03']['verdicts']), 2)
        for verdict in by_id['SQUAT-03']['verdicts']:
            self.assertEqual(verdict['status'], 'NEEDS_IMPROVEMENT')
            self.assertIsNotNone(verdict['timestampSeconds'])
            self.assertIsNotNone(verdict['targetValue'])
            self.assertTrue(verdict['feedback']['adjustments'])
        for code in ('SQUAT-01', 'SQUAT-02', 'SQUAT-04', 'SQUAT-05', 'SQUAT-06', 'SQUAT-07', 'SQUAT-08'):
            self.assertNotIn(by_id[code]['status'], engine.DECISIVE)
            self.assertIsNone(by_id[code]['approval'])


if __name__ == '__main__':
    unittest.main()
