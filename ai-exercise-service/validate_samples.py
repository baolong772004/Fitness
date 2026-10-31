"""Development smoke checks only; expected counts are regression snapshots, NOT Coach GT."""
import json
import tempfile
from pathlib import Path
import cv2
import numpy as np
from main import analyze_video
from rules import RULE_VERSION


def main():
    report=[]
    cases=[('github-side-squat.mp4',2,'REAL_UNLABELED'),('barbell-back-squat.mp4',4,'REAL_UNLABELED'),('squat-variable-depth-test.mp4',2,'EDITED'),('front-facing-squat-pexels-5034577.mp4',5,'REAL_UNLABELED'),('dumbbell-goblet-squat.mp4',5,'REAL_UNLABELED'),('kettlebell-goblet-squat.mp4',5,'REAL_UNLABELED')]
    protocol={'depthTarget':'HIP_AT_KNEE','descentTargetSeconds':2}
    for filename,reps,source in cases:
        path=Path('samples')/filename
        if not path.is_file(): raise FileNotFoundError(f'{path}: see VALIDATION.md')
        result=analyze_video(str(path),protocol)
        assert result['status']=='COMPLETED', (filename,result['status'])
        assert result['detectedRepetitions']==reps, (filename,result['detectedRepetitions'])
        assert result['ruleVersion']==RULE_VERSION
        assert result['protocol']['descentTargetSeconds']==2
        assert all(0<=f['timeSeconds']<=result['video']['durationSeconds'] for f in result['poseFrames'])
        for rep in result['repetitions']:
            assert rep['startSeconds']<rep['bottomSeconds']<rep['endSeconds']
            checks={c['code']:c for c in rep['criteria']}
            for obs in rep['observations']:
                assert rep['startSeconds']<=obs['timestampSeconds']<=rep['endSeconds']
                if obs['kind']=='OBSERVABLE_SIGNAL':
                    assert checks[obs['code']]['outcome']=='SIGNAL'
                    assert obs['evidence'] and obs['suggestion']
            assert all(checks[c]['status']=='NOT_ASSESSED' for c in ['LUMBAR_CURVATURE','HEEL_LIFT','BALANCE','LEFT_RIGHT_SYMMETRY'])
        # An edited clip exercises a detection branch; never proves real error detection.
        if source=='EDITED': assert 'DEPTH_TARGET' in {o['code'] for o in result['observations']}
        if filename.startswith('front-facing'):
            assert result['cameraView']['detected']=='FRONT'
            assessed={c['code'] for c in result['criteria'] if c['status']=='ASSESSED'}
            assert {'MOVEMENT_TIMING','KNEE_INWARD_LEFT','KNEE_INWARD_RIGHT'} <= assessed
            assert 'DEPTH_TARGET' not in assessed
        path.with_suffix('.mp4.v6.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
        report.append({'file':filename,'sourceType':source,'status':result['status'],'reps':reps,'view':result['cameraView']['detected'],'codes':[o['code'] for o in result['observations']],'groundTruth':None})
        print(filename, result['status'], reps, flush=True)
    with tempfile.TemporaryDirectory() as directory:
        path=str(Path(directory)/'no-person.mp4')
        writer=cv2.VideoWriter(path,cv2.VideoWriter_fourcc(*'mp4v'),10,(320,240))
        assert writer.isOpened()
        try:
            for _ in range(40): writer.write(np.full((240,320,3),110,dtype=np.uint8))
        finally: writer.release()
        result=analyze_video(path)
        assert result['status']=='INSUFFICIENT_DATA' and result['detectedRepetitions'] is None
        assert not result['observations'] and not result['poseFrames']
        assert all(c['status']=='NOT_ASSESSED' for c in result['criteria'])
        report.append({'file':'generated blank 4 seconds','sourceType':'SYNTHETIC','status':result['status']})
    Path('samples/validation-report-v6.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    for row in report: print(row)


if __name__=='__main__': main()
