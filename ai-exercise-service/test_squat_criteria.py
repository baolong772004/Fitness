"""Synthetic geometry tests exercise logic only; NOT evidence of video accuracy."""
import copy
import math
import unittest
from dataclasses import replace
from squat_config import SquatConfig, parse_protocol
from squat_criteria import analyze_pose_frames


def frames(view='SIDE', shallow=False, torso=False):
    poses=[]
    values=[0]*7+[i/10 for i in range(1,11)]+[1]*3+[1-i/15 for i in range(1,16)]+[0]*6
    for i,value in enumerate(values):
        d=value*(.55 if shallow else 1)
        landmarks={}
        if view=='SIDE':
            for s,offset in [('left',0),('right',10)]:
                hip=(300-100*d+offset,300+150*d)
                sh=(hip[0]+70*d,hip[1]-150)
                if torso and 20<=i<=27:
                    sh=(sh[0]+70,sh[1]+45)
                points={'Shoulder':sh,'Hip':hip,'Knee':(310+40*d+offset,450+10*d),'Ankle':(310+offset,600),'Heel':(290+offset,615),'Toe':(360+offset,615)}
                for j,p in points.items(): landmarks[s+j]={'x':p[0]/800,'y':p[1]/800,'visibility':.95}
        else:
            for s,sgn in [('left',1),('right',-1)]:
                ankle_x=300 if s=='left' else 500
                points={'Shoulder':(260 if s=='left' else 540,170+120*d),'Hip':(320 if s=='left' else 480,330+130*d),'Knee':(ankle_x+sgn*(10+40*d),480+70*d),'Ankle':(ankle_x,650),'Heel':(ankle_x-10,655),'Toe':(ankle_x+10,655)}
                for j,p in points.items(): landmarks[s+j]={'x':p[0]/800,'y':p[1]/800,'visibility':.95}
        poses.append({'timeSeconds':round(i*.1,2),'landmarks':landmarks})
    return poses


class CriteriaLogicTest(unittest.TestCase):
    def test_front_video_can_start_moving_without_initial_calibration_pause(self):
        poses=frames('FRONT')[6:]
        for i,f in enumerate(poses): f['timeSeconds']=round(i*.1,2)
        result=analyze_pose_frames(poses,800,800)
        self.assertEqual(result['status'],'COMPLETED')
        self.assertEqual(result['detectedRepetitions'],1)
        self.assertEqual(next(c for c in result['criteria'] if c['code']=='MOVEMENT_TIMING')['outcome'],'MEASURED')

    def test_partial_first_rep_is_skipped_but_later_complete_rep_is_analyzed(self):
        poses=frames('FRONT')[12:]+frames('FRONT')
        for i,f in enumerate(poses): f['timeSeconds']=round(i*.1,2)
        result=analyze_pose_frames(poses,800,800)
        self.assertEqual(result['detectedRepetitions'],1)
        self.assertGreater(result['repetitions'][0]['startSeconds'],2)

    def test_front_borderline_orientation_keeps_the_ascent_frames(self):
        poses=frames('FRONT')
        for f in poses[26:31]:
            f['landmarks']['leftShoulder']['x']=345/800
            f['landmarks']['rightShoulder']['x']=455/800
        result=analyze_pose_frames(poses,800,800)
        self.assertEqual(result['cameraView']['detected'],'FRONT')
        self.assertEqual(result['detectedRepetitions'],1)

    def test_side_view_is_not_changed_by_torso_projection_at_bottom(self):
        poses=frames()
        for f in poses[10:28]:
            for joint in ('Shoulder','Hip'):
                f['landmarks']['right'+joint]['x']=f['landmarks']['left'+joint]['x']+.3
        result=analyze_pose_frames(poses,800,800)
        self.assertEqual(result['cameraView']['detected'],'SIDE')
        self.assertEqual(result['detectedRepetitions'],1)

    def test_actual_view_change_is_not_joined_into_a_single_view(self):
        poses=frames()+frames('FRONT')
        for i,f in enumerate(poses): f['timeSeconds']=round(i*.1,2)
        result=analyze_pose_frames(poses,800,800)
        self.assertEqual(result['status'],'INSUFFICIENT_DATA')
        self.assertEqual(result['cameraView']['detected'],'UNKNOWN')

    def test_short_opposite_view_is_rejected_even_with_a_dominant_view(self):
        poses=frames()+frames()+frames()+frames('FRONT')[:7]
        for i,f in enumerate(poses): f['timeSeconds']=round(i*.1,2)
        result=analyze_pose_frames(poses,800,800)
        self.assertEqual(result['status'],'INSUFFICIENT_DATA')

    def test_collapsed_front_joints_do_not_raise_or_create_reps(self):
        poses=frames('FRONT')
        for f in poses:
            f['landmarks']['leftHip']=dict(f['landmarks']['leftKnee'])
        result=analyze_pose_frames(poses,800,800)
        self.assertEqual(result['status'],'INSUFFICIENT_DATA')

    def test_oblique_view_measures_cycles_without_front_or_side_technique_claims(self):
        poses=frames('FRONT')
        for f in poses:
            f['landmarks']['leftShoulder']['x']=345/800
            f['landmarks']['rightShoulder']['x']=455/800
        result=analyze_pose_frames(poses,800,800,{'depthTarget':'HIP_AT_KNEE','descentTargetSeconds':2})
        self.assertEqual(result['cameraView']['detected'],'OBLIQUE')
        self.assertEqual(result['detectedRepetitions'],1)
        for c in result['criteria']:
            if c['code'] in ('DEPTH_TARGET','TORSO_ASCENT_CHANGE','KNEE_INWARD_LEFT','KNEE_INWARD_RIGHT'):
                self.assertEqual(c['status'],'NOT_ASSESSED')

    def test_missing_joints_outside_complete_rep_do_not_reject_the_whole_clip(self):
        poses=frames('FRONT')
        for i in range(60):
            poses.append({'timeSeconds':round(4.2+i*.1,2),'landmarks':{}})
        result=analyze_pose_frames(poses,800,800)
        self.assertEqual(result['detectedRepetitions'],1)

    def test_front_tracking_gap_cannot_complete_a_rep(self):
        poses=[f for f in frames('FRONT') if not 1.2<f['timeSeconds']<2.1]
        result=analyze_pose_frames(poses,800,800)
        self.assertEqual(result['status'],'INSUFFICIENT_DATA')

    def test_front_static_and_incomplete_motion_are_not_repetitions(self):
        for poses in (frames('FRONT')[:7],frames('FRONT')[:20]):
            result=analyze_pose_frames(poses,800,800)
            self.assertEqual(result['status'],'INSUFFICIENT_DATA')

    def test_single_rep_depth_compares_selected_target_not_other_reps(self):
        result=analyze_pose_frames(frames(shallow=True),800,800,{'depthTarget':'HIP_AT_KNEE'})
        self.assertEqual(result['detectedRepetitions'],1)
        signals=[o for o in result['observations'] if o['code']=='DEPTH_TARGET']
        self.assertEqual(len(signals),1)
        self.assertEqual(signals[0]['bodyPart'],'HIP')
        self.assertIn('hipAboveKneeRatio',signals[0]['evidence'])
        rep=result['repetitions'][0]
        self.assertLessEqual(rep['startSeconds'],signals[0]['timestampSeconds'])
        self.assertLessEqual(signals[0]['timestampSeconds'],rep['endSeconds'])

    def test_no_goal_means_no_depth_or_tempo_judgment(self):
        result=analyze_pose_frames(frames(shallow=True),800,800)
        for code in ('DEPTH_TARGET','DESCENT_TARGET'):
            self.assertEqual(next(c for c in result['criteria'] if c['code']==code)['status'],'NOT_ASSESSED')
        self.assertFalse(any(o['code'] in ('DEPTH_TARGET','DESCENT_TARGET') for o in result['observations']))

    def test_front_knee_projection_requires_visible_feet(self):
        result=analyze_pose_frames(frames('FRONT'),800,800)
        self.assertEqual(result['cameraView']['detected'],'FRONT')
        self.assertEqual(result['detectedRepetitions'],1)
        self.assertTrue({'KNEE_INWARD_LEFT','KNEE_INWARD_RIGHT'} <= {o['code'] for o in result['observations']})
        self.assertIsNone(result['repetitions'][0]['minimumKneeAngle'])
        missing=frames('FRONT')
        for f in missing: del f['landmarks']['leftToe']
        result=analyze_pose_frames(missing,800,800)
        checks={c['code']:c for c in result['criteria']}
        self.assertEqual(checks['KNEE_INWARD_LEFT']['status'],'NOT_ASSESSED')
        self.assertEqual(checks['KNEE_INWARD_LEFT']['reasonCode'],'MISSING_FOOT_LANDMARKS')
        self.assertEqual(checks['KNEE_INWARD_RIGHT']['status'],'ASSESSED')

    def test_view_mismatch_abstains_and_side_never_labels_front_knee(self):
        result=analyze_pose_frames(frames('FRONT'),800,800,{'cameraView':'SIDE'})
        self.assertEqual(result['status'],'INSUFFICIENT_DATA')
        result=analyze_pose_frames(frames(),800,800)
        self.assertFalse(any(o['code'].startswith('KNEE_INWARD') for o in result['observations']))

    def test_hip_before_shoulder_signal_is_within_one_rep(self):
        result=analyze_pose_frames(frames(torso=True),800,800)
        self.assertIn('TORSO_ASCENT_CHANGE',{o['code'] for o in result['observations']})

    def test_joint_gap_does_not_join_reps(self):
        poses=[f for f in frames() if not 1.5<f['timeSeconds']<2.2]
        result=analyze_pose_frames(poses,800,800)
        self.assertEqual(result['status'],'INSUFFICIENT_DATA')

    def test_targets_and_thresholds_are_validated(self):
        for value in ([], '', False):
            with self.assertRaises(ValueError): parse_protocol(value)
        for value in [True,float('nan'),0,7,'2']:
            with self.assertRaises(ValueError): parse_protocol({'descentTargetSeconds':value})
        with self.assertRaises(ValueError): replace(SquatConfig(),visibility=2)
        self.assertNotEqual(SquatConfig().snapshot()['id'],replace(SquatConfig(),knee_inward_ratio=.15).snapshot()['id'])

    def test_missing_support_never_reports_unsupported_diagnoses(self):
        result=analyze_pose_frames(frames(),800,800)
        for code in ('LUMBAR_CURVATURE','HEEL_LIFT','BALANCE','LEFT_RIGHT_SYMMETRY'):
            self.assertEqual(next(c for c in result['criteria'] if c['code']==code)['status'],'NOT_ASSESSED')
        self.assertTrue(all('criteria' in rep and 'bodyParts' in rep for rep in result['repetitions']))

    def test_front_at_five_hz_can_use_standing_reference(self):
        result=analyze_pose_frames(frames('FRONT')[::2],800,800,config=replace(SquatConfig(),sample_hz=5))
        self.assertEqual(result['detectedRepetitions'],1)

    def test_single_frame_knee_spike_is_not_a_sustained_signal(self):
        poses=frames('FRONT')
        for i,f in enumerate(poses):
            for side,x in [('left',310),('right',490)]:
                f['landmarks'][side+'Knee']['x']=(x+(45 if side=='left' and i==18 else 0))/800
        result=analyze_pose_frames(poses,800,800)
        self.assertEqual(result['detectedRepetitions'],1)
        self.assertFalse(any(o['code'].startswith('KNEE_INWARD') for o in result['observations']))

    def test_front_moving_feet_abstains_and_missing_standing_reference_fails(self):
        poses=frames('FRONT')
        for i,f in enumerate(poses):
            if i>=12:
                for side in ('left','right'):
                    for joint in ('Ankle','Heel','Toe'):
                        f['landmarks'][side+joint]['x']+=.08
        result=analyze_pose_frames(poses,800,800)
        self.assertFalse(any(o['code'].startswith('KNEE_INWARD') for o in result['observations']))
        result=analyze_pose_frames(frames('FRONT')[10:],800,800)
        self.assertEqual(result['status'],'INSUFFICIENT_DATA')

    def test_non_monotonic_time_is_refused(self):
        poses=frames(); poses[5]['timeSeconds']=poses[4]['timeSeconds']
        self.assertEqual(analyze_pose_frames(poses,800,800)['status'],'INSUFFICIENT_DATA')


if __name__=='__main__': unittest.main()
