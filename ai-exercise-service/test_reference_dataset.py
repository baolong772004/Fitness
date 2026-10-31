"""Synthetic artifacts here test provenance gates; they are not Coach labels."""
import hashlib
import json
import tempfile
import unittest
from pathlib import Path

from reference_dataset import build_reference_bank, compare_rep_to_bank, reference_comparison_for_inference
from standard_registry import load_standard


def _write_json(path, data):
    path.write_text(json.dumps(data), encoding='utf-8')


class ReferenceDatasetTest(unittest.TestCase):
    def test_empty_real_development_manifest_blocks_comparison(self):
        bank = build_reference_bank('evaluation/reference-development-manifest.json')
        self.assertEqual(bank['status'], 'BLOCKED_NO_COMPARABLE_COACH_LABELED_REFERENCES')
        self.assertEqual(bank['examples'], [])
        self.assertFalse(bank['officialVerdictsEnabled'])
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            _write_json(root / 'bank.json', bank)
            inference = {'exercise': 'SQUAT', 'exerciseVariant': 'BODYWEIGHT',
                         'evaluationMode': 'EXPERIMENTAL',
                         'referenceStandardVersion': bank['standardVersion'],
                         'repetitions': [{'number': 1}]}
            comparison = reference_comparison_for_inference(inference, 'bank.json', root)
            self.assertEqual(comparison['status'], 'BLOCKED_NO_COMPARABLE_COACH_LABELED_REFERENCES')
            self.assertFalse(comparison['validatedForDecision'])
            self.assertEqual(comparison['repetitions'][0]['reason'], 'NO_QUALITY_GATED_QUERY_MEASUREMENT')

    def test_only_matching_confirmed_criterion_labels_create_reference_examples(self):
        version = load_standard('SQUAT')['standardVersion']
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            clips = []
            for index, outcome in enumerate(('MEETS', 'MEETS', 'IMPROVE', 'IMPROVE')):
                video = root / f'clip-{index}.mp4'
                video.write_bytes(f'test video {index}'.encode())
                digest = hashlib.sha256(video.read_bytes()).hexdigest()
                values = [(-.1 + .01 * rep) if outcome == 'MEETS' else (.2 + .01 * rep)
                          for rep in range(1, 4)]
                inference = {
                    'inputVideoSha256': digest, 'modelVersion': 'TEST_MODEL', 'ruleVersion': 'TEST_RULE',
                    'cameraView': {'detected': 'SIDE'},
                    'repetitions': [{'number': rep, 'startSeconds': rep - .4, 'endSeconds': rep + .4}
                                    for rep in range(1, 4)],
                    'techniqueEvaluation': {'referenceStandardVersion': version, 'criteria': [{
                        'criterionId': 'SQUAT-02', 'measurement': {'perRep': [
                            {'repNumber': rep, 'observedValue': {'hipAboveKneeRatio': value},
                             'landmarkEvidence': [{'timestampSeconds': rep}],
                             'measurementQuality': {'sufficientForExperimentalComparison': True}}
                            for rep, value in enumerate(values, 1)]}}]},
                }
                labels = {
                    'schemaVersion': 2, 'coachConfirmed': True, 'videoSha256': digest,
                    'sourceType': 'REAL', 'reviewer': 'TEST_COACH',
                    'approvedConditions': 'TEST_ONLY', 'reviewedAt': '2026-01-01T00:00:00Z',
                    'exercise': 'SQUAT', 'exerciseVariant': 'BODYWEIGHT',
                    'rubricVersion': version, 'cameraView': 'SIDE',
                    'segments': [{'repNumber': rep, 'criteria': {'SQUAT-02': {
                        'outcome': outcome, 'note': 'TEST_ONLY', 'reviewerId': 'TEST_COACH',
                        'timestampSeconds': rep, 'standardVersion': version}}} for rep in range(1, 4)],
                }
                _write_json(root / f'clip-{index}.inference.json', inference)
                _write_json(root / f'clip-{index}.labels.json', labels)
                clips.append({'id': f'clip-{index}', 'split': 'development', 'sourceType': 'REAL',
                              'exercise': 'SQUAT', 'exerciseVariant': 'BODYWEIGHT',
                              'subjectId': f'subject-{index}', 'sessionId': f'session-{index}',
                              'path': video.name, 'sha256': digest,
                              'resultPath': f'clip-{index}.inference.json',
                              'coachLabels': f'clip-{index}.labels.json'})
            _write_json(root / 'manifest.json', {'clips': clips})
            bank = build_reference_bank('manifest.json', root)
            self.assertEqual(bank['status'], 'REFERENCE_COMPARISON_READY')
            self.assertEqual(len(bank['examples']), 12)
            self.assertEqual(bank['coverage'][0]['meets'], 6)
            self.assertEqual(bank['coverage'][0]['improve'], 6)
            self.assertEqual(bank['coverage'][0]['subjectsByClass'], {'MEETS': 2, 'IMPROVE': 2})
            self.assertFalse(bank['officialVerdictsEnabled'])
            query = json.loads((root / 'clip-0.inference.json').read_text())
            query['inputVideoSha256'] = 'not-in-bank'
            result = compare_rep_to_bank(bank, query, 'SQUAT-02', 1)
            self.assertEqual(result['status'], 'REFERENCE_COMPARISON_ONLY')
            self.assertFalse(result['validatedForDecision'])
            self.assertEqual(result['nearestExamples'][0]['outcome'], 'MEETS')
            query['inputVideoSha256'] = clips[0]['sha256']
            self.assertEqual(compare_rep_to_bank(bank, query, 'SQUAT-02', 1)['reason'],
                             'QUERY_VIDEO_IS_IN_REFERENCE_DATA')
            labels = json.loads((root / 'clip-1.labels.json').read_text())
            labels['coachConfirmed'] = False
            _write_json(root / 'clip-1.labels.json', labels)
            blocked = build_reference_bank('manifest.json', root)
            self.assertEqual(blocked['status'], 'BLOCKED_NO_COMPARABLE_COACH_LABELED_REFERENCES')
            self.assertEqual(len(blocked['examples']), 9)
            clips[0]['split'] = 'holdout'
            _write_json(root / 'manifest.json', {'clips': clips})
            self.assertEqual(len(build_reference_bank('manifest.json', root)['examples']), 6)


if __name__ == '__main__':
    unittest.main()
