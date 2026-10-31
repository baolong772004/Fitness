"""Logic fixtures verify instrumentation and boundaries, not CV accuracy."""
import copy
import json
import unittest
from diagnostics import FrameClock
from squat_criteria import analyze_pose_frames
from test_squat_criteria import frames


class DiagnosticsTest(unittest.TestCase):
    def test_pts_and_fallback_are_monotonic_and_explicit(self):
        clock=FrameClock(25)
        values=[clock.seconds(i,p) for i,p in enumerate([0,40,40,float('nan'),160])]
        self.assertEqual(values,[0,.04,.08,.12,.16])
        self.assertEqual(clock.fallbacks,2)

    def test_vfr_uses_pts_instead_of_assuming_constant_fps(self):
        clock=FrameClock(30)
        values=[clock.seconds(i,p) for i,p in enumerate([0,40,90,160,210])]
        self.assertEqual(values,[0,.04,.09,.16,.21])
        self.assertEqual(clock.fallbacks,0)

    def test_mid_rep_has_segment_measurement_without_passing_rep_criteria(self):
        result=analyze_pose_frames(frames('FRONT')[12:23],800,800)
        checks={c['code']:c for c in result['criteria']}
        self.assertEqual(result['status'],'INSUFFICIENT_DATA')
        self.assertEqual(result['analysisCoverage'],'VALID_SEGMENTS_ONLY')
        self.assertEqual(checks['JOINT_MOTION']['outcome'],'MEASURED')
        self.assertEqual(checks['MOVEMENT_TIMING']['status'],'NOT_ASSESSED')
        self.assertEqual(checks['DEPTH_TARGET']['reasonCode'],'VIEW_NOT_SUITABLE')
        self.assertEqual(checks['DESCENT_TARGET']['reasonCode'],'GOAL_NOT_SET')
        self.assertEqual(checks['BALANCE']['reasonCode'],'NOT_IMPLEMENTED')

    def test_diagnostic_angles_and_states_match_actual_input(self):
        result=analyze_pose_frames(frames(),800,800)
        d=result['diagnostics']
        self.assertEqual(len(d['timeline']),len(frames()))
        self.assertEqual(d['landmarks']['selectedSide'],'left')
        self.assertGreater(d['kinematics']['leftKneeAngle']['range'],35)
        self.assertGreater(d['segmentation']['transitionCount'],2)
        self.assertLessEqual(d['segmentation']['smoothedRange']['range'],d['segmentation']['rawRange']['range'])
        self.assertIsNone(d['rejection'])
        json.dumps(result,allow_nan=False)

    def test_short_gaps_preserve_count_long_gaps_never_join_rep(self):
        original=frames('FRONT')
        for removed,expected in [({14},1),({14,15},1),({12,13,14,15,16,17,18},None)]:
            result=analyze_pose_frames([f for i,f in enumerate(copy.deepcopy(original)) if i not in removed],800,800)
            self.assertEqual(result['detectedRepetitions'],expected)

    def test_missing_side_is_recorded_and_other_side_selected(self):
        poses=frames()
        for f in poses: f['landmarks']['leftAnkle']['visibility']=.1
        result=analyze_pose_frames(poses,800,800)
        self.assertEqual(result['diagnostics']['landmarks']['selectedSide'],'right')
        self.assertEqual(result['diagnostics']['landmarks']['rejectionsByLandmark']['leftAnkle:LOW_VISIBILITY'],len(poses))
        self.assertEqual(result['detectedRepetitions'],1)

    def test_nonfinite_landmarks_are_rejected_without_serializing_nan_angles(self):
        poses=frames()
        poses[14]['landmarks']['leftHip']['x']=float('nan')
        result=analyze_pose_frames(poses,800,800)
        self.assertIn('leftHip:NON_FINITE',result['diagnostics']['landmarks']['rejectionsByLandmark'])
        json.dumps(result,allow_nan=False)


if __name__=='__main__': unittest.main()
