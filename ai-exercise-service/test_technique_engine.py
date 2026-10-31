"""Approval gates and measurement plumbing; synthetic joints are not Coach labels."""
import unittest

from exercise_catalog import EXERCISES, public_exercises
from technique_engine import _experimental_evaluation, evaluate_technique, measured_pose_result, member_provisional_evaluation
from squat_criteria import analyze_pose_frames
from test_squat_criteria import frames as squat_frames


def upper_body_frames():
    names = {'Shoulder': (.42, .28), 'Elbow': (.43, .43), 'Wrist': (.40, .60),
             'Hip': (.43, .65), 'Knee': (.44, .79), 'Ankle': (.45, .96)}
    return [{'timeSeconds': index * .1, 'landmarks': {
        side + joint: {'x': x + offset, 'y': y + (.005 * index if joint == 'Wrist' else 0), 'visibility': .99}
        for side, offset in [('left', 0), ('right', .13)] for joint, (x, y) in names.items()}}
        for index in range(12)]


class TechniqueEngineTest(unittest.TestCase):
    def test_six_exercises_have_distinct_documented_criteria(self):
        self.assertEqual(len(public_exercises()), 6)
        for code, spec in EXERCISES.items():
            self.assertGreaterEqual(len(spec['criteria']), 2, code)
            for criterion in spec['criteria']:
                self.assertTrue(criterion['title'] and criterion['description'])
                self.assertTrue(criterion['joints'] and criterion['views'] and criterion['improvement'])
            self.assertEqual(next(item for item in public_exercises() if item['code'] == code)['techniqueStatus'], 'NOT_COACH_VALIDATED')

    def test_unvalidated_exercises_measure_but_never_claim_pass(self):
        frames = upper_body_frames()
        for exercise in EXERCISES:
            movement = measured_pose_result(exercise, frames, 'SIDE')
            result = evaluate_technique(exercise, frames, movement, 800, 1000)
            self.assertEqual(result['headline'], 'Chưa đủ điều kiện đánh giá')
            self.assertTrue(all(item['status'] in ('MEASURED', 'UNABLE_TO_ASSESS', 'NOT_SUPPORTED') and item['approval'] is None for item in result['criteria']))
            if exercise in ('PUSH_UP', 'PLANK', 'LUNGE', 'BICEPS_CURL', 'SHOULDER_PRESS'):
                self.assertGreater(result['measuredCriteria'], 0)

    def test_missing_wrist_does_not_create_curl_measurement(self):
        frames = upper_body_frames()
        for frame in frames:
            frame['landmarks']['leftWrist']['visibility'] = .1
            frame['landmarks']['rightWrist']['visibility'] = .1
        result = evaluate_technique('BICEPS_CURL', frames, measured_pose_result('BICEPS_CURL', frames, 'SIDE'), 800, 1000)
        self.assertEqual(result['criteria'][0]['reasonCode'], 'MISSING_LANDMARKS')
        self.assertIsNone(result['criteria'][0]['measurement'])

    def test_squat_observation_is_not_promoted_to_approved_verdict(self):
        frames = squat_frames('FRONT')
        movement = analyze_pose_frames(frames, 800, 800)
        result = evaluate_technique('SQUAT', frames, movement, 800, 800)
        self.assertEqual(movement['detectedRepetitions'], 1)
        self.assertGreater(result['measuredCriteria'], 0)
        self.assertFalse(any(item['status'] in ('PASS', 'NEEDS_IMPROVEMENT') for item in result['criteria']))

    def test_experimental_evaluation_covers_assessable_squat_criteria(self):
        side_frames = squat_frames('SIDE', shallow=True, torso=True) + squat_frames('SIDE', shallow=True, torso=False)
        for index, frame in enumerate(side_frames):
            frame['timeSeconds'] = round(index * 0.1, 2)
        protocol = {'cameraView': 'SIDE', 'depthTarget': 'HIP_AT_KNEE', 'descentTargetSeconds': 2.0}
        movement = analyze_pose_frames(side_frames, 800, 800, protocol)
        official = evaluate_technique('SQUAT', side_frames, movement, 800, 800, variant='BODYWEIGHT')
        exp = _experimental_evaluation(official, movement)
        by_id = {item['criterionId']: item for item in exp['criteria']}
        self.assertEqual(by_id['SQUAT-01']['status'], 'MEETS_CRITERION')
        self.assertEqual(by_id['SQUAT-02']['status'], 'NEEDS_IMPROVEMENT')
        self.assertEqual(by_id['SQUAT-03']['status'], 'UNABLE_TO_ASSESS')
        self.assertEqual(by_id['SQUAT-03']['reasonCode'], 'VIEW_NOT_SUITABLE')
        self.assertEqual(by_id['SQUAT-04']['status'], 'NEEDS_IMPROVEMENT')
        self.assertEqual(by_id['SQUAT-04']['predictions'][0]['status'], 'NEEDS_IMPROVEMENT')
        self.assertEqual(by_id['SQUAT-04']['predictions'][1]['status'], 'MEETS_CRITERION')
        self.assertEqual(by_id['SQUAT-05']['status'], 'MEETS_CRITERION')
        self.assertEqual(by_id['SQUAT-06']['status'], 'UNABLE_TO_ASSESS')
        self.assertEqual(by_id['SQUAT-07']['status'], 'UNABLE_TO_ASSESS')
        self.assertEqual(by_id['SQUAT-08']['status'], 'NEEDS_IMPROVEMENT')
        member = member_provisional_evaluation(official, movement)
        self.assertEqual(member['screeningStatus'], 'NEEDS_IMPROVEMENT_DETECTED')
        self.assertEqual(member['wholeExerciseStatus'], 'UNABLE_TO_CONFIRM')
        self.assertEqual(member['correctionPriorities'][0]['criterionId'], 'SQUAT-02')
        self.assertGreaterEqual(member['correctionPriorities'][0]['evidenceFrames'], 1)
        self.assertIn('hông', member['correctionPriorities'][0]['feedback'])
        self.assertEqual(official['passedCriteria'], 0)

    def test_experimental_goal_does_not_exceed_reference_camera_scope(self):
        poses = squat_frames('SIDE')
        movement = analyze_pose_frames(poses, 800, 800, {
            'cameraView': 'SIDE', 'depthTarget': 'NONE', 'descentTargetSeconds': 2.0})
        movement['cameraView']['detected'] = 'OBLIQUE'
        official = evaluate_technique('SQUAT', poses, movement, 800, 800, variant='BODYWEIGHT')
        candidate = _experimental_evaluation(official, movement)
        goal = next(item for item in candidate['criteria'] if item['criterionId'] == 'SQUAT-08')
        self.assertEqual(goal['status'], 'UNABLE_TO_ASSESS')
        self.assertEqual(goal['reasonCode'], 'VIEW_NOT_SUITABLE')


if __name__ == '__main__':
    unittest.main()
