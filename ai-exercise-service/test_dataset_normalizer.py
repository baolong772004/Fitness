import unittest

from dataset_normalizer import (
    PUBLIC_DATASET_CATALOG,
    normalize_dataset_record,
    validate_split_independence,
)


class DatasetNormalizerTest(unittest.TestCase):
    def test_public_dataset_catalog_rejects_auto_criterion_mapping(self):
        self.assertGreaterEqual(len(PUBLIC_DATASET_CATALOG), 6)
        for ds in PUBLIC_DATASET_CATALOG:
            self.assertFalse(ds['canAutoConvertToCriterionTruth'])
            self.assertTrue(ds['rejectionReasonForAutoCriterionMapping'])

    def test_normalize_record_separates_coarse_label_from_criterion_labels(self):
        rec = normalize_dataset_record({
            'videoId': 'vid-01',
            'exercise': 'squat',
            'variant': 'bodyweight',
            'cameraView': 'side',
            'subjectId': 'subj-01',
            'sessionId': 'sess-01',
            'split': 'development',
            'coarseFormLabel': 'good',
            'criterionLabels': [
                {
                    'repNumber': 1,
                    'criterionId': 'SQUAT-02',
                    'outcome': 'MEETS',
                    'cameraView': 'SIDE',
                    'timestampSeconds': 2.1,
                    'startSeconds': 1.0,
                    'endSeconds': 3.2,
                    'reviewerId': 'coach-10',
                    'labeledAt': '2026-10-31T14:00:00Z',
                    'note': 'Hip crease below knee center at bottom.',
                }
            ],
        })
        self.assertEqual(rec['exercise'], 'SQUAT')
        self.assertEqual(rec['variant'], 'BODYWEIGHT')
        self.assertEqual(rec['cameraView'], 'SIDE')
        self.assertEqual(rec['coarseFormLabel'], 'GOOD')
        self.assertFalse(rec['coarseLabelUsableForCriterionValidation'])
        self.assertEqual(len(rec['criterionLabels']), 1)
        self.assertEqual(rec['criterionLabels'][0]['criterionId'], 'SQUAT-02')
        self.assertEqual(rec['criterionLabels'][0]['outcome'], 'MEETS')
        self.assertEqual(rec['criterionLabels'][0]['reviewerId'], 'coach-10')

    def test_prohibits_auto_converting_coarse_good_bad_into_criterion_truth(self):
        with self.assertRaises(ValueError) as ctx:
            normalize_dataset_record({
                'videoId': 'vid-02',
                'exercise': 'SQUAT',
                'variant': 'BODYWEIGHT',
                'cameraView': 'FRONT',
                'subjectId': 'subj-02',
                'sessionId': 'sess-02',
                'coarseFormLabel': 'BAD',
                'autoConvertCoarseLabelToCriteria': True,
            })
        self.assertIn('PROHIBITED', str(ctx.exception))

        with self.assertRaises(ValueError) as ctx2:
            normalize_dataset_record({
                'videoId': 'vid-03',
                'exercise': 'SQUAT',
                'variant': 'BODYWEIGHT',
                'cameraView': 'FRONT',
                'subjectId': 'subj-03',
                'sessionId': 'sess-03',
                'criterionLabels': [
                    {
                        'repNumber': 1,
                        'criterionId': 'SQUAT-03',
                        'outcome': 'BAD',
                        'reviewerId': 'coach-1',
                    }
                ],
            })
        self.assertIn('PROHIBITED', str(ctx2.exception))

    def test_split_independence_detects_subject_session_and_hash_leaks(self):
        clean = validate_split_independence([
            {'videoId': 'v1', 'split': 'development', 'subjectId': 's1', 'sessionId': 'ses1', 'sha256': 'h1'},
            {'videoId': 'v2', 'split': 'validation', 'subjectId': 's2', 'sessionId': 'ses2', 'sha256': 'h2'},
            {'videoId': 'v3', 'split': 'holdout', 'subjectId': 's3', 'sessionId': 'ses3', 'sha256': 'h3'},
        ])
        self.assertTrue(clean['independent'])
        self.assertEqual(clean['leaks'], [])

        leaked = validate_split_independence([
            {'videoId': 'v1', 'split': 'development', 'subjectId': 's1', 'sessionId': 'ses1', 'sha256': 'h1'},
            {'videoId': 'v2', 'split': 'holdout', 'subjectId': 's1', 'sessionId': 'ses9', 'sha256': 'h9'},
        ])
        self.assertFalse(leaked['independent'])
        self.assertEqual(len(leaked['leaks']), 1)
        self.assertEqual(leaked['leaks'][0]['field'], 'subjectId')


if __name__ == '__main__':
    unittest.main()

