import unittest

from rules import Sample, analyze_samples, angle, image_point


class SquatRulesTest(unittest.TestCase):
    def sequence(self, values, start=0, step=0.2, travel=None, lean=10):
        return [Sample(start + i * step, value, 120, 0.9, lean, travel) for i, value in enumerate(values)]

    def test_angles_use_image_aspect_ratio(self):
        points = [image_point(x, y, 400, 200) for x, y in [(0, 0), (0.25, 0.5), (0.5, 0.5)]]
        self.assertAlmostEqual(angle(*points), 135)

    def test_each_rep_has_timing_and_observation_evidence(self):
        first = [170, 170, 155, 140, 110, 80, 80, 110, 140, 160, 170]
        second = [170, 170, 155, 145, 130, 115, 115, 130, 145, 160, 170]
        result = analyze_samples(self.sequence(first, travel=0.2) + self.sequence(second, start=2.2, travel=0.5, lean=25))
        self.assertEqual(result['detectedRepetitions'], 2)
        codes = {item['code'] for item in result['observations']}
        self.assertTrue({'VARIABLE_ROM', 'INCREASING_TORSO_LEAN', 'VARIABLE_KNEE_TRAVEL'} <= codes)
        for item in result['observations']:
            rep = result['repetitions'][item['repNumber'] - 1]
            self.assertIn(item, rep['observations'])
            self.assertLessEqual(rep['startSeconds'], item['timestampSeconds'])
            self.assertLessEqual(item['timestampSeconds'], rep['endSeconds'])
            self.assertTrue(item['evidence'])
            self.assertTrue(item['limitation'])
        self.assertTrue(all(rep['descentSeconds'] > 0 and rep['ascentSeconds'] > 0 for rep in result['repetitions']))

    def test_missing_tracking_does_not_join_a_rep_across_a_gap(self):
        result = analyze_samples(self.sequence([170, 170, 155, 140, 120, 90]) + self.sequence([90, 110, 140, 160, 170], start=5))
        self.assertEqual(result['status'], 'INSUFFICIENT_DATA')

    def test_low_visibility_samples_are_not_counted(self):
        result = analyze_samples([Sample(i * 0.2, value, 120, 0.2) for i, value in enumerate([170, 170, 155, 140, 120, 90, 90, 120, 140, 160, 170])])
        self.assertEqual(result['status'], 'INSUFFICIENT_DATA')

    def test_tempo_difference_is_descriptive_and_symmetry_is_unassessed(self):
        values = [170, 170, 155, 140, 120, 90, 90, 120, 140, 160, 170]
        result = analyze_samples(self.sequence(values) + self.sequence(values, start=2.2, step=0.4))
        self.assertIn('VARIABLE_TEMPO', [item['code'] for item in result['observations']])
        symmetry = next(item for item in result['criteria'] if item['code'] == 'LEFT_RIGHT_SYMMETRY')
        self.assertEqual(symmetry['status'], 'NOT_ASSESSED')

    def test_angle(self):
        self.assertAlmostEqual(angle((0, 1), (0, 0), (1, 0)), 90)
        self.assertIsNone(angle((0, 0), (0, 0), (1, 0)))

    def test_repetition_detected_without_fake_observation(self):
        values = [170, 168, 155, 140, 120, 105, 105, 118, 135, 155, 168, 170]
        samples = [Sample(i * 0.2, value, 120, 0.9) for i, value in enumerate(values)]
        result = analyze_samples(samples)
        self.assertEqual(result["status"], "COMPLETED")
        self.assertEqual(result["detectedRepetitions"], 1)
        self.assertEqual(result["observations"], [])

    def test_no_motion_is_insufficient(self):
        result = analyze_samples([Sample(i * 0.2, 170, 170, 0.9) for i in range(15)])
        self.assertEqual(result["status"], "INSUFFICIENT_DATA")
        self.assertIsNone(result["detectedRepetitions"])

    def test_missing_landmarks_is_insufficient(self):
        self.assertEqual(analyze_samples([])["status"], "INSUFFICIENT_DATA")

    def test_partial_rep_is_not_counted(self):
        values = [170, 170, 155, 140, 120, 90, 90, 110]
        self.assertEqual(analyze_samples(self.sequence(values))['status'], 'INSUFFICIENT_DATA')

    def test_one_rep_does_not_claim_comparisons(self):
        result = analyze_samples(self.sequence([170, 170, 155, 140, 120, 90, 90, 120, 140, 160, 170]))
        self.assertTrue(all(item['status'] == 'NOT_ASSESSED' for item in result['criteria']))
        self.assertEqual(len(result['repetitions'][0]['notAssessed']), 5)

    def test_out_of_order_timestamps_are_rejected(self):
        samples = self.sequence([170, 170, 155, 140, 120, 90, 90, 120, 140, 160, 170])
        samples[5].time = samples[4].time
        self.assertEqual(analyze_samples(samples)['status'], 'INSUFFICIENT_DATA')


if __name__ == "__main__":
    unittest.main()
