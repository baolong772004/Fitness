"""The release command must fail closed without a signed, verified holdout."""
import hashlib
import json
import unittest
from unittest.mock import patch

import criterion_release
import standard_registry
import test_criterion_evaluation as release_fixtures


class CriterionReleaseTests(unittest.TestCase):
    def setUp(self):
        self.standard = standard_registry.load_standard('SQUAT', 'BODYWEIGHT')
        self.payload = {
            'exerciseVariant': 'BODYWEIGHT',
            'criterionId': 'SQUAT-03',
            'standardVersion': self.standard['standardVersion'],
            'standardDigest': standard_registry.standard_digest(self.standard),
        }
        self.active_file = standard_registry.ACTIVE_ROOT / 'squat-bodyweight.json'
        self.before = self.active_file.read_bytes() if self.active_file.exists() else None

    def tearDown(self):
        after = self.active_file.read_bytes() if self.active_file.exists() else None
        self.assertEqual(after, self.before, 'A rejected release modified the active standard')

    def test_unsigned_release_is_rejected(self):
        with self.assertRaisesRegex(ValueError, 'COACH_SIGNED_REVIEW_REQUIRED'):
            criterion_release.commit_release('SQUAT', self.payload)

    def test_signed_request_without_real_report_is_rejected(self):
        payload = dict(self.payload)
        payload.update({
            'reviewer': {'reviewerId': '2', 'qualification': 'Coach', 'reviewRecordId': 'test',
                         'reviewedAt': '2026-10-31T00:00:00+00:00'},
            'signedAt': '2026-11-01T00:00:00+00:00',
            'approvalSignatureSha256': hashlib.sha256(b'test').hexdigest(),
            'conditions': {'passCondition': {'kind': 'BOOLEAN_EQUALS', 'observedKey': 'x', 'expected': True},
                           'improvementCondition': {'kind': 'BOOLEAN_EQUALS', 'observedKey': 'x', 'expected': False}},
            'validationReport': {'path': 'evaluation/private/missing-holdout.json',
                                 'sha256': '0' * 64, 'standardVersion': self.standard['standardVersion'],
                                 'criterionId': 'SQUAT-03', 'scope': {'exerciseVariant': 'BODYWEIGHT',
                                 'modelVersion': 'test', 'ruleVersion': 'test', 'cameraViews': ['FRONT']},
                                 'acceptanceCriteriaId': 'test'},
        })
        with self.assertRaisesRegex(ValueError, 'VALIDATION_REPORT_UNAVAILABLE'):
            criterion_release.commit_release('SQUAT', payload)

    def test_artificial_evidence_can_activate_only_a_temporary_registry(self):
        # All media/labels below are artificial bookkeeping fixtures. This
        # never writes into the service's real active standard directory.
        fixture = release_fixtures.CriterionReleaseArtifactTest('test_artificial_complete_fixture_exercises_actual_release_gate')
        fixture.setUp()
        self.addCleanup(fixture.doCleanups)
        private = fixture.root / 'evaluation' / 'private'
        private.mkdir(parents=True)
        report = private / 'unit-report.json'
        report.write_text(json.dumps(fixture.report), encoding='utf-8')
        payload = {
            **self.payload,
            'criterionId': 'SQUAT-01',
            'reviewer': fixture.standard['approvedByCoach'],
            'signedAt': fixture.standard['approvedAt'],
            'approvalSignatureSha256': hashlib.sha256(b'artificial-signature').hexdigest(),
            'conditions': {'passCondition': fixture.policy['passCondition'],
                           'improvementCondition': fixture.policy['improvementCondition']},
            'validationReport': {**fixture.policy['validationReport'],
                                 'path': 'evaluation/private/unit-report.json',
                                 'sha256': hashlib.sha256(report.read_bytes()).hexdigest()},
        }
        with patch.object(standard_registry, 'ACTIVE_ROOT', fixture.root / 'active'):
            result = criterion_release.commit_release('SQUAT', payload, fixture.root)
            self.assertEqual(result['status'], 'APPROVED_AND_VALIDATED')
            active = standard_registry.load_standard('SQUAT', 'BODYWEIGHT')
            self.assertEqual(active['criteria'][0]['evaluationPolicy']['status'], 'APPROVED_AND_VALIDATED')


if __name__ == '__main__':
    unittest.main()
