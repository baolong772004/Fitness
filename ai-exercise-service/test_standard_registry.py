"""Registry provenance tests; fixtures are metadata, never real Coach approvals."""
from copy import deepcopy
import unittest

from standard_registry import approval_digest, list_standards, load_standard, standard_digest, validate_standard


class StandardRegistryTest(unittest.TestCase):
    def test_all_six_standards_are_source_informed_drafts(self):
        standards = list_standards()
        self.assertEqual(len(standards), 6)
        self.assertEqual({item['exerciseId'] for item in standards},
                         {'SQUAT', 'PUSH_UP', 'PLANK', 'LUNGE', 'BICEPS_CURL', 'SHOULDER_PRESS'})
        for summary in standards:
            item = load_standard(summary['exerciseId'], summary['exerciseVariant'])
            self.assertIsNone(item['approvedByCoach'])
            self.assertIsNone(item['approvedAt'])
            self.assertEqual(item['status'], 'EXPERIMENTAL')
            self.assertTrue(all(c['evaluationPolicy']['status'] != 'APPROVED_AND_VALIDATED' for c in item['criteria']))
            self.assertTrue(all(source['providesValidatedComputerVisionThresholds'] is False for source in item['referenceSources']))
            self.assertEqual(item['measurementConfiguration']['source'], 'IMPLEMENTATION_CONFIGURATION')
            self.assertEqual(item['algorithmThresholds']['source'], 'EXPERIMENTAL_ALGORITHM_CONFIGURATION')

    def test_squat_has_eight_independent_criteria_and_all_four_categories(self):
        standard = load_standard('SQUAT', 'BODYWEIGHT')
        self.assertEqual([criterion['criterionId'] for criterion in standard['criteria']],
                         [f'SQUAT-{number:02d}' for number in range(1, 9)])
        self.assertEqual({criterion['type'] for criterion in standard['criteria']}, {'A', 'B', 'C', 'D'})
        self.assertTrue(all(criterion['evidenceRequirements']['timestampSeconds'] for criterion in standard['criteria']))
        self.assertEqual(standard['criteria'][6]['evaluationPolicy']['status'], 'NOT_SUPPORTED')

    def test_unlisted_or_unspecified_variant_never_gets_bodyweight_policy(self):
        for variant in ('WEIGHTED', 'BARBELL_BACK', 'UNSPECIFIED', 'bodyweight'):
            with self.subTest(variant=variant), self.assertRaises(ValueError):
                load_standard('SQUAT', variant)
        with self.assertRaises(ValueError):
            load_standard('UNKNOWN')

    def test_returned_standards_are_independent_and_content_hashes_are_sensitive(self):
        standard = load_standard('SQUAT')
        untouched = deepcopy(standard)
        original = standard_digest(standard)
        standard['criteria'][0]['description'] = 'Changed meaning'
        self.assertNotEqual(standard_digest(standard), original)
        self.assertEqual(load_standard('SQUAT'), untouched)
        reordered = dict(reversed(list(untouched.items())))
        self.assertEqual(standard_digest(reordered), original)

    def test_approval_digest_excludes_its_envelope_but_includes_policy_conditions(self):
        standard = load_standard('SQUAT')
        before = approval_digest(standard)
        standard['approvedByCoach'] = {'reviewerId': 'METADATA_TEST_ONLY'}
        standard['approvedAt'] = '2026-10-31'
        standard['criteria'][0]['evaluationPolicy']['approvedStandardDigest'] = before
        standard['criteria'][0]['evaluationPolicy']['status'] = 'APPROVED_AND_VALIDATED'
        self.assertEqual(approval_digest(standard), before)
        standard['criteria'][0]['evaluationPolicy']['passCondition'] = {'kind': 'NUMERIC_RANGE', 'minimum': 1}
        self.assertNotEqual(approval_digest(standard), before)

    def test_claimed_approval_without_provenance_or_report_is_rejected(self):
        standard = load_standard('SQUAT')
        standard['criteria'][0]['evaluationPolicy']['status'] = 'APPROVED_AND_VALIDATED'
        with self.assertRaisesRegex(ValueError, 'provenance'):
            validate_standard(standard)
        standard['criteria'][0]['evaluationPolicy']['approvedByCoach'] = {
            'reviewerId': 'TEST_ONLY', 'qualification': 'TEST_ONLY', 'reviewRecordId': 'TEST_ONLY'}
        with self.assertRaisesRegex(ValueError, 'date and validation'):
            validate_standard(standard)

    def test_incomplete_or_supported_without_approval_is_rejected(self):
        standard = load_standard('SQUAT')
        standard['criteria'][0]['referenceSourceIds'] = ['NONEXISTENT']
        with self.assertRaisesRegex(ValueError, 'Unknown criterion reference'):
            validate_standard(standard)
        standard = load_standard('SQUAT')
        standard['status'] = 'SUPPORTED'
        with self.assertRaisesRegex(ValueError, 'Supported status'):
            validate_standard(standard)


if __name__ == '__main__':
    unittest.main()
