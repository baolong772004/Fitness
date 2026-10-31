"""Reproducible real-video diagnostics. Edited fixtures are explicitly labeled, not GT."""
import argparse
import csv
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import cv2

ROOT=Path(__file__).resolve().parent
OUT=ROOT/'evaluation'/'private'/'pipeline-debug'
MANIFEST=ROOT/'evaluation'/'debug-video-manifest.json'


def build():
    import imageio_ffmpeg
    ffmpeg=imageio_ffmpeg.get_ffmpeg_exe()
    target=ROOT/'samples'/'debug'
    target.mkdir(exist_ok=True)
    source=ROOT/'samples'/'front-facing-squat-pexels-5034577.mp4'
    variants={
        'front-mid-rep':"trim=start=0.8,setpts=PTS-STARTPTS",
        'front-delayed':"tpad=start_duration=3:start_mode=clone",
        'front-short-gap':"drawbox=x=0:y=0:w=iw:h=ih:color=black:t=fill:enable='between(t,6.2,6.38)'",
        'front-long-gap':"drawbox=x=0:y=0:w=iw:h=ih:color=black:t=fill:enable='between(t,6.0,6.9)'",
        'front-static':"trim=start=2,trim=end_frame=1,loop=loop=149:size=1:start=0,setpts=N/(25*TB)",
        'front-vfr':"select='if(lt(t,8),not(mod(n,2)),1)'",
        'front-rotated-pixels':"transpose=1",
    }
    for name,transform in variants.items():
        cmd=[ffmpeg,'-v','error','-y','-i',str(source),'-an','-vf',transform+',scale=720:-2','-c:v','libx264','-crf','18','-preset','fast']
        cmd+=['-fps_mode','vfr'] if name=='front-vfr' else []
        cmd+=[str(target/(name+'.mp4'))]
        subprocess.run(cmd,check=True)
    subprocess.run([ffmpeg,'-v','error','-y','-display_rotation','90','-i',str(target/'front-rotated-pixels.mp4'),'-c','copy',str(target/'front-rotation-metadata.mp4')],check=True)
    real=[('side','github-side-squat.mp4'),('front','front-facing-squat-pexels-5034577.mp4'),
          ('barbell','barbell-back-squat.mp4'),('dumbbell','dumbbell-goblet-squat.mp4'),('kettlebell','kettlebell-goblet-squat.mp4'),
          ('oblique','oblique-squat-pexels-8837221.mp4'),('non-squat','hammer-curls-ymove.mp4')]
    cases=[{'id':k,'path':'samples/'+v,'sourceType':'REAL','coachGroundTruth':None} for k,v in real]
    for name,transform in variants.items():
        if name=='front-rotated-pixels': continue
        cases.append({'id':name,'path':'samples/debug/'+name+'.mp4','sourceType':'EDITED','parent':str(source.relative_to(ROOT)),
                      'transformation':transform,'coachGroundTruth':None})
    cases.append({'id':'front-rotation-metadata','path':'samples/debug/front-rotation-metadata.mp4','sourceType':'EDITED',
                  'parent':str(source.relative_to(ROOT)),'transformation':'clockwise pixels + rotate=90 display metadata','coachGroundTruth':None})
    cases.append({'id':'variable-depth','path':'samples/squat-variable-depth-test.mp4','sourceType':'EDITED','transformation':'Existing reversed/edited fixture; see build_sample_variant.py','coachGroundTruth':None})
    for name in ('first','second','third'):
        cases.append({'id':'legacy-'+name,'path':f'samples/squat_{name}_view-220k.mp4','sourceType':'REAL','coachGroundTruth':None})
    for case in cases:
        case['sha256']=hashlib.sha256((ROOT/case['path']).read_bytes()).hexdigest()
    MANIFEST.write_text(json.dumps(cases,ensure_ascii=False,indent=2),encoding='utf-8')


def run(baseline=False, only=None):
    if baseline:
        sys.path.insert(0,str(ROOT/'evaluation'/'private'/'baseline-v5'))
    from main import analyze_video
    OUT.mkdir(parents=True,exist_ok=True)
    tag='before-v5' if baseline else 'after-v6'
    for case in json.loads(MANIFEST.read_text(encoding='utf-8')):
        if only and case['id'] not in only: continue
        actual_hash=hashlib.sha256((ROOT/case['path']).read_bytes()).hexdigest()
        if actual_hash!=case['sha256']:
            raise ValueError('Fixture changed: rebuild manifest before running '+case['id'])
        result=analyze_video(str(ROOT/case['path']))
        result['testCase']=case
        (OUT/(case['id']+'.'+tag+'.json')).write_text(json.dumps(result,ensure_ascii=False,indent=2,allow_nan=False),encoding='utf-8')
        print(case['id'],result['status'],result['detectedRepetitions'],flush=True)
        if not baseline:
            diag=result['diagnostics']
            timeline={round(r['timeSeconds'],3):r for r in diag.get('timeline',[])}
            signals={round(r['timeSeconds'],3):r for r in diag.get('segmentation',{}).get('signal',[])}
            columns=['timeSeconds','sourceFrame','sourceTimestampMs','landmarkerTimestampMs','rejection','leftKneeAngle','rightKneeAngle','leftHipAngle','rightHipAngle','geometryValid','geometryRejection','missingLandmarks','raw','smoothed','state']
            with (OUT/(case['id']+'.timeline.csv')).open('w',encoding='utf-8',newline='') as file:
                writer=csv.DictWriter(file,fieldnames=columns,extrasaction='ignore'); writer.writeheader()
                for decoded in diag.get('decodeTimeline',[]):
                    t=round(decoded['timeSeconds'],3)
                    row={**decoded,**timeline.get(t,{}),**signals.get(t,{})}
                    row['missingLandmarks']=json.dumps(row.get('missingLandmarks',{}))
                    writer.writerow(row)


def report():
    lines=['# Pipeline diagnostic results','',
           'Actual inference outputs. REAL clips have no Coach-confirmed labels; EDITED fixtures are reproducible edits of real footage, not independent accuracy evidence. No PASS labels or accuracy percentages are inferred from model output.','',
           'Sources: [Pexels front](https://www.pexels.com/video/woman-doing-squat-exercise-5034577/), [Pexels oblique](https://www.pexels.com/video/a-woman-in-activewear-doing-squats-at-home-8837221/), [YMove free clips](https://ymove.app/free-exercise-videos).','',
           '| Case | Type | FPS | Decoded / sampled / pose / valid geometry | Pose rate | Valid rate of samples | Before reps | After reps | Status / view | Transitions |',
           '|---|---|---:|---|---:|---:|---:|---:|---|---:|']
    details=[]
    for case in json.loads(MANIFEST.read_text(encoding='utf-8')):
        path=OUT/(case['id']+'.after-v6.json')
        if not path.exists(): continue
        result=json.loads(path.read_text(encoding='utf-8')); d=result['diagnostics']; v=d['video']; p=d.get('pose',{}); l=d.get('landmarks',{})
        before_path=OUT/(case['id']+'.before-v5.json')
        before=json.loads(before_path.read_text(encoding='utf-8')) if before_path.exists() else {}
        sampled=p.get('sampledFrames',0); valid=l.get('geometryValidFrames',0)
        lines.append(f"| {case['id']} | {case['sourceType']} | {v.get('fps',0):.3f} | {v.get('decodedFrames',0)} / {sampled} / {p.get('poseFrames',0)} / {valid} | {p.get('detectionRate',0):.1%} | {valid/sampled if sampled else 0:.1%} | {before.get('detectedRepetitions')} | {result['detectedRepetitions']} | {result['status']} / {result.get('cameraView',{}).get('detected','UNKNOWN')} | {d.get('segmentation',{}).get('transitionCount',0)} |")
        details += ['',f"## {case['id']}",'',f"Input: `{case['path']}` ({case['sourceType']}). Coach ground truth: unavailable.",
                    f"Transformation: {case.get('transformation','none')}",
                    f"[Full result](private/pipeline-debug/{case['id']}.after-v6.json) · [Angle / state / frame timeline CSV](private/pipeline-debug/{case['id']}.timeline.csv)",
                    '',f"Before: {before.get('status','not run')}, {before.get('detectedRepetitions')} reps. After: {result['status']}, {result['detectedRepetitions']} reps.",
                    f"Rejection: {json.dumps(d.get('rejection'),ensure_ascii=False)}",
                    f"Orientation: {v.get('rotationMetadataDegrees')}°, auto={v.get('autoRotation')}, displayed size={v.get('displayWidth')}×{v.get('displayHeight')}; timestamp fallbacks={v.get('timestampFallbacks')}.",
                    f"Selected side: {l.get('selectedSide')}; rejection counts: `{json.dumps(l.get('rejectionsByLandmark',{}),ensure_ascii=False)}`.",
                    f"Projected angle ranges: `{json.dumps(d.get('kinematics',{}),ensure_ascii=False)}`.",
                    f"Raw/smoothed signal ranges: `{json.dumps({k:d.get('segmentation',{}).get(k) for k in ('signalUnits','rawRange','smoothedRange')},ensure_ascii=False)}`.",
                    '', '| Criterion | Scope | Outcome | Reason code | Reason |','|---|---|---|---|---|']
        for c in result.get('criteria',[]):
            details.append(f"| {c['code']} | {c.get('requirements',{}).get('scope','')} | {c.get('outcome',c['status'])} | {c.get('reasonCode') or ''} | {c.get('reason') or ''} |")
    (ROOT/'evaluation'/'PIPELINE_DIAGNOSTICS.md').write_text('\n'.join(lines+details)+'\n',encoding='utf-8')


if __name__=='__main__':
    parser=argparse.ArgumentParser(); parser.add_argument('--build',action='store_true'); parser.add_argument('--run',action='store_true'); parser.add_argument('--baseline',action='store_true'); parser.add_argument('--report',action='store_true'); parser.add_argument('--case',action='append')
    args=parser.parse_args(); os.chdir(ROOT)
    if args.build: build()
    if args.run: run(args.baseline,args.case)
    if args.report: report()
