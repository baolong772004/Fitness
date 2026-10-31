"""Checks on saved ACTUAL inference, not fabricated landmarks or Coach labels.

Generate with diagnose_videos.py --build --run first. These are metamorphic
regressions: edits with known effects must preserve/remove complete cycles.
"""
import json
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parent/'evaluation'/'private'/'pipeline-debug'


class RealVideoRegression(unittest.TestCase):
    def read(self,name):
        path=ROOT/(name+'.after-v6.json')
        if not path.exists(): self.skipTest('Actual inference artifact unavailable: '+name)
        return json.loads(path.read_text(encoding='utf-8'))

    def test_cut_start_excludes_one_partial_cycle(self):
        base=self.read('front'); cut=self.read('front-mid-rep')
        self.assertGreater(base['detectedRepetitions'],1)
        self.assertEqual(cut['detectedRepetitions'],base['detectedRepetitions']-1)

    def test_delay_short_gap_vfr_and_metadata_rotation_preserve_count(self):
        base=self.read('front')
        for name in ['front-delayed','front-short-gap','front-vfr','front-rotation-metadata']:
            with self.subTest(name=name):
                r=self.read(name)
                self.assertEqual(r['detectedRepetitions'],base['detectedRepetitions'])
                self.assertEqual(r['cameraView']['detected'],'FRONT')

    def test_long_gap_drops_affected_cycle(self):
        r=self.read('front-long-gap')
        self.assertEqual(r['detectedRepetitions'],self.read('front')['detectedRepetitions']-1)
        self.assertTrue(any(t['reason']=='TRACKING_GAP' for t in r['diagnostics']['segmentation']['transitions']))

    def test_real_curl_and_static_frame_do_not_count_squats(self):
        for name in ['non-squat','front-static']:
            r=self.read(name)
            self.assertEqual(r['repetitions'],[])
            self.assertEqual(r['status'],'INSUFFICIENT_DATA')
            self.assertFalse(any(c.get('outcome')=='PASS' for c in r['criteria']))

    def test_rotation_fixture_contains_real_metadata(self):
        v=self.read('front-rotation-metadata')['diagnostics']['video']
        self.assertEqual(v['rotationMetadataDegrees'],270)
        self.assertTrue(v['autoRotation'])
        self.assertGreater(v['displayWidth'],v['displayHeight'])

    def test_real_oblique_abstains_from_side_technique_without_changing_side_count(self):
        oblique=self.read('oblique')
        self.assertEqual(oblique['cameraView']['detected'],'OBLIQUE')
        self.assertTrue(oblique['cameraView']['obliqueFromSideConflict'])
        self.assertEqual(oblique['detectedRepetitions'],5)
        checks={c['code']:c for c in oblique['criteria']}
        self.assertEqual(checks['MOVEMENT_TIMING']['outcome'],'MEASURED')
        for code in ('DEPTH_TARGET','TORSO_ASCENT_CHANGE','KNEE_INWARD_LEFT','KNEE_INWARD_RIGHT'):
            self.assertEqual(checks[code]['status'],'NOT_ASSESSED')
            self.assertEqual(checks[code]['reasonCode'],'VIEW_NOT_SUITABLE')
        for name,count in [('side',2),('barbell',4),('dumbbell',5),('kettlebell',5)]:
            with self.subTest(name=name):
                actual=self.read(name)
                self.assertEqual(actual['cameraView']['detected'],'SIDE')
                self.assertEqual(actual['detectedRepetitions'],count)

    def test_real_traces_keep_monotonic_pts_and_count_rejections(self):
        for name in ['front','side','front-vfr','front-short-gap','oblique','non-squat']:
            d=self.read(name)['diagnostics']; pts=[e['landmarkerTimestampMs'] for e in d['decodeTimeline'] if 'landmarkerTimestampMs' in e]
            self.assertTrue(all(b>a for a,b in zip(pts,pts[1:])))
            self.assertEqual(len(d['decodeTimeline']),d['pose']['sampledFrames'])
            p=d['pose']
            self.assertEqual(p['poseFrames']+p['blurredFrames']+p['noPoseFrames']+p['multiplePersonFrames'],p['sampledFrames'])


if __name__=='__main__': unittest.main()
