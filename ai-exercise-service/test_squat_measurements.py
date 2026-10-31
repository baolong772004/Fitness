"""Measurement tests use explicit geometry or saved actual inference, never Coach labels."""
import json
from pathlib import Path
import unittest

from squat_criteria import analyze_pose_frames
from squat_measurements import extract_squat_measurements
from test_squat_criteria import frames


class SquatMeasurementsTest(unittest.TestCase):
    def fixture(self, view='SIDE'):
        poses = frames(view)
        movement = analyze_pose_frames(poses, 800, 800)
        return poses, movement, extract_squat_measurements(poses, movement, 800, 800)

    def test_no_targets_still_measures_depth_timing_and_torso(self):
        _, movement, measured = self.fixture()
        self.assertEqual(next(c for c in movement['criteria'] if c['code'] == 'DEPTH_TARGET')['reasonCode'], 'GOAL_NOT_SET')
        self.assertEqual(next(c for c in movement['criteria'] if c['code'] == 'DESCENT_TARGET')['reasonCode'], 'GOAL_NOT_SET')
        self.assertAlmostEqual(measured['SQUAT-02']['perRep'][0]['observedValue']['hipAboveKneeRatio'], .0665, places=4)
        self.assertEqual(measured['SQUAT-01']['perRep'][0]['observedValue']['descentSeconds'], .8)
        self.assertEqual(measured['SQUAT-05']['perRep'][0]['observedValue']['ascentSeconds'], 1.5)
        self.assertGreater(measured['SQUAT-04']['perRep'][0]['observedValue']['maximumProjectedLeanDegrees'], 20)
        self.assertEqual(measured['SQUAT-08']['reasonCode'], 'NO_INDIVIDUAL_TARGET')
        self.assertTrue(measured['SQUAT-08']['perRep'])
        self.assertFalse(any('status' in row for result in measured.values() for row in result['perRep']))

    def test_front_does_not_measure_side_depth_or_torso(self):
        _, _, measured = self.fixture('FRONT')
        for code in ('SQUAT-02', 'SQUAT-04'):
            self.assertEqual(measured[code]['reasonCode'], 'VIEW_NOT_SUITABLE')
            self.assertEqual(measured[code]['perRep'], [])
        self.assertEqual(len(measured['SQUAT-03']['perRep']), 2)
        self.assertEqual(measured['SQUAT-03']['perRep'][0]['observedValue']['inwardChangeStanceRatio'], .18)
        self.assertFalse(measured['SQUAT-06']['evaluationSupported'])
        self.assertEqual(measured['SQUAT-06']['perRep'][0]['observedValue']['maximumProjectedKneeDifferenceDegrees'], 0)

    def test_missing_left_toe_preserves_right_knee_measurement(self):
        poses = frames('FRONT')
        for frame in poses:
            frame['landmarks']['leftToe']['visibility'] = .1
        movement = analyze_pose_frames(poses, 800, 800)
        measured = extract_squat_measurements(poses, movement, 800, 800)
        knees = measured['SQUAT-03']['perRep']
        self.assertEqual([row['side'] for row in knees], ['RIGHT'])
        self.assertNotIn('leftToe', knees[0]['landmarkEvidence'][0]['landmarks'])

    def test_tracking_gap_does_not_satisfy_quality_gate(self):
        poses, movement, _ = self.fixture()
        poses = [frame for index, frame in enumerate(poses) if index not in range(10, 19)]
        measured = extract_squat_measurements(poses, movement, 800, 800)
        timing = measured['SQUAT-01']['perRep'][0]
        self.assertFalse(timing['measurementQuality']['continuousTracking'])
        self.assertFalse(timing['measurementQuality']['sufficientForExperimentalComparison'])
        self.assertEqual(timing['measurementQuality']['reasonCode'], 'INSUFFICIENT_REP_TRACKING')
        self.assertEqual(timing['observedValue']['completedCycleObserved'], True)

    def test_unstable_spatial_reference_does_not_erase_continuous_timing(self):
        poses, movement, _ = self.fixture()
        movement['protocol']['depthTarget'] = 'HIP_AT_KNEE'
        for rep in movement['repetitions']:
            rep['techniqueTrackingSufficient'] = False
            rep['referenceQualityReasonCode'] = 'FOOT_REFERENCE_SCALE_UNVERIFIED'
        measured = extract_squat_measurements(poses, movement, 800, 800)
        for code in ('SQUAT-01', 'SQUAT-05'):
            quality = measured[code]['perRep'][0]['measurementQuality']
            self.assertTrue(quality['continuousTracking'])
            self.assertFalse(quality['referenceRequired'])
            self.assertTrue(quality['sufficientForExperimentalComparison'])
        for code in ('SQUAT-02', 'SQUAT-04', 'SQUAT-08'):
            quality = measured[code]['perRep'][0]['measurementQuality']
            self.assertTrue(quality['referenceRequired'])
            self.assertFalse(quality['sufficientForExperimentalComparison'])
            self.assertEqual(quality['reasonCode'], 'FOOT_REFERENCE_SCALE_UNVERIFIED')

    def test_invalid_timestamp_order_refuses_all_measurements(self):
        poses, movement, _ = self.fixture()
        poses[13]['timeSeconds'] = poses[12]['timeSeconds']
        measured = extract_squat_measurements(poses, movement, 800, 800)
        self.assertTrue(all(result['reasonCode'] == 'INVALID_DIMENSIONS_OR_TIMESTAMPS' for result in measured.values()))
        self.assertFalse(any(result['perRep'] for result in measured.values()))

    def test_heel_projection_cannot_assert_floor_contact(self):
        _, _, measured = self.fixture()
        heel = measured['SQUAT-07']
        self.assertEqual(heel['perRep'][0]['observedValue']['heelToeProjectedAngleChangeDegrees'], 0)
        self.assertFalse(heel['evaluationSupported'])
        self.assertEqual(heel['reasonCode'], 'NO_FLOOR_CALIBRATION')

    def test_joint_evidence_preserves_actual_coordinates_and_visibility(self):
        poses, _, measured = self.fixture()
        row = measured['SQUAT-02']['perRep'][0]
        for evidence in row['landmarkEvidence']:
            frame = next(frame for frame in poses if frame['timeSeconds'] == evidence['timestampSeconds'])
            for name, point in evidence['landmarks'].items():
                self.assertEqual(point, frame['landmarks'][name])
        self.assertEqual(row['confidenceOfObservation'], .95)
        self.assertIn('not_technique_accuracy', row['confidenceBasis'])
        json.dumps(measured, allow_nan=False)

    def test_saved_real_side_video_has_depth_without_selected_depth_goal(self):
        path = Path(__file__).resolve().parent / 'evaluation' / 'private' / 'pipeline-debug' / 'side.after-v6.json'
        if not path.exists():
            self.skipTest('Actual inference artifact unavailable; no synthetic substitute used')
        movement = json.loads(path.read_text(encoding='utf-8'))
        measured = extract_squat_measurements(movement['poseFrames'], movement, movement['video']['width'], movement['video']['height'])
        self.assertEqual(movement['protocol']['depthTarget'], 'NONE')
        self.assertEqual(measured['SQUAT-01']['validRepCount'], len(movement['repetitions']))
        self.assertEqual(measured['SQUAT-02']['validRepCount'], len(movement['repetitions']))
        self.assertGreater(measured['SQUAT-02']['sampleCount'], 0)
        self.assertTrue(all(row['side'] == 'RIGHT' for row in measured['SQUAT-02']['perRep']))
        self.assertFalse(any(result.get('status') in ('PASS', 'MEETS_CRITERION') for result in measured.values()))

    def test_saved_real_front_video_has_timing_without_selected_targets(self):
        path = Path(__file__).resolve().parent / 'evaluation' / 'private' / 'pipeline-debug' / 'front.after-v6.json'
        if not path.exists():
            self.skipTest('Actual front inference unavailable; no synthetic substitute used')
        movement = json.loads(path.read_text(encoding='utf-8'))
        measured = extract_squat_measurements(movement['poseFrames'], movement, movement['video']['width'], movement['video']['height'])
        self.assertEqual(movement['protocol']['depthTarget'], 'NONE')
        self.assertIsNone(movement['protocol']['descentTargetSeconds'])
        self.assertEqual(measured['SQUAT-05']['validRepCount'], len(movement['repetitions']))
        self.assertEqual(measured['SQUAT-02']['perRep'], [])
        for actual, rep in zip(measured['SQUAT-05']['perRep'], movement['repetitions']):
            self.assertAlmostEqual(actual['observedValue']['descentSeconds'], rep['bottomSeconds'] - rep['startSeconds'], places=3)
            self.assertAlmostEqual(actual['observedValue']['ascentSeconds'], rep['endSeconds'] - rep['bottomSeconds'], places=3)

    def test_configured_coverage_and_visibility_use_result_snapshot(self):
        poses, movement, _ = self.fixture()
        movement['thresholdConfig']['values']['sample_hz'] = 5
        movement['thresholdConfig']['values']['visibility'] = .96
        measured = extract_squat_measurements(poses, movement, 800, 800)
        self.assertFalse(measured['SQUAT-01']['perRep'])
        movement['thresholdConfig']['values']['visibility'] = .94
        measured = extract_squat_measurements(poses, movement, 800, 800)
        row = measured['SQUAT-01']['perRep'][0]
        self.assertAlmostEqual(row['requiredFrames'], (row['endSeconds'] - row['startSeconds']) * 5 + 1, places=2)


if __name__ == '__main__':
    unittest.main()
