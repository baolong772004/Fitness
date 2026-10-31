"""Real-video smoke matrix. No model output becomes a Coach label."""
import argparse
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
MANIFEST = ROOT / 'evaluation' / 'technique-video-manifest.json'
OUT = ROOT / 'evaluation' / 'private' / 'technique-smoke'
REPORT = ROOT / 'evaluation' / 'TECHNIQUE_SMOKE.md'
SOURCES = [
    ('SQUAT', 'samples/front-facing-squat-pexels-5034577.mp4', 'https://www.pexels.com/video/woman-doing-squat-exercise-5034577/'),
    ('PUSH_UP', 'samples/push-up-pexels-4964649.mp4', 'https://www.pexels.com/video/man-doing-push-ups-4964649/'),
    ('PLANK', 'samples/plank-pexels-6525496.mp4', 'https://www.pexels.com/video/young-woman-doing-planks-6525496/'),
    ('LUNGE', 'samples/lunge-pexels-6525491.mp4', 'https://www.pexels.com/video/side-view-of-woman-exercising-legs-6525491/'),
    ('BICEPS_CURL', 'samples/hammer-curls-ymove.mp4', 'https://ymove.app/free-exercise-videos'),
    ('SHOULDER_PRESS', 'samples/shoulder-press-pexels-5837705.mp4', 'https://www.pexels.com/video/man-lifting-weights-5837705/'),
]


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def build_manifest():
    from standard_registry import load_standard
    if MANIFEST.exists() and any(item.get('coachLabels') for item in json.loads(MANIFEST.read_text(encoding='utf-8'))):
        raise ValueError('Refusing to overwrite a manifest with Coach labels')
    rows = [{'exercise': exercise, 'path': path, 'source': source,
             'sourceType': 'REAL', 'split': 'development',
             'exerciseVariant': load_standard(exercise)['exerciseVariant'],
             'variantSource': 'DEVELOPMENT_SELECTION_NOT_COACH_LABEL',
             'referenceStandardVersion': load_standard(exercise)['standardVersion'],
             'criterionIds': [item['criterionId'] for item in load_standard(exercise)['criteria']],
             'resultPath': 'evaluation/private/technique-smoke/' + exercise.lower() + '.json',
             'coachLabels': None, 'coachGroundTruth': None,
             'sha256': sha(ROOT / path)} for exercise, path, source in SOURCES]
    MANIFEST.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding='utf-8')
    (ROOT / 'evaluation' / 'technique-criteria.json').write_text(
        json.dumps({code: {'name': load_standard(code)['exerciseName'], 'phase': 'HOLD' if code == 'PLANK' else 'REPETITIONS',
                           'standardVersion': load_standard(code)['standardVersion'],
                           'exerciseVariant': load_standard(code)['exerciseVariant'],
                           'criteria': [{'code': item['criterionId'], 'title': item['criterionName'], 'description': item['description'],
                                         'joints': item['requiredLandmarks'], 'views': item['requiredCameraAngles']}
                                        for item in load_standard(code)['criteria']]}
                    for code, _, _ in SOURCES}, ensure_ascii=False, indent=2), encoding='utf-8')


def run():
    from main import analyze_video
    OUT.mkdir(parents=True, exist_ok=True)
    for item in json.loads(MANIFEST.read_text(encoding='utf-8')):
        video = ROOT / item['path']
        if sha(video) != item['sha256']:
            raise ValueError('Video hash mismatch: ' + str(video))
        result = analyze_video(str(video), exercise_type=item['exercise'], exercise_variant=item.get('exerciseVariant', 'UNSPECIFIED'))
        result['testCase'] = item
        (OUT / (item['exercise'].lower() + '.json')).write_text(json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False), encoding='utf-8')
        print(item['exercise'], result['status'], result['qualityDetails']['poseFrames'], result['techniqueEvaluation']['measuredCriteria'], flush=True)


def report():
    lines = ['# Real-video technique smoke results', '',
             'All clips are real footage and remain UNLABELED by a Coach. Counts and measurements below are software smoke results, not technique accuracy. No PASS/NEEDS_IMPROVEMENT was enabled.', '',
             '| Exercise | FPS | Decoded / sampled / pose | Pose rate | Rep count | Measured criteria | Technique verdict |',
             '|---|---:|---:|---:|---:|---|---|']
    details = []
    for item in json.loads(MANIFEST.read_text(encoding='utf-8')):
        result_path = OUT / (item['exercise'].lower() + '.json')
        if not result_path.exists():
            continue
        r = json.loads(result_path.read_text(encoding='utf-8'))
        d, t = r['diagnostics'], r['techniqueEvaluation']
        v, p = d['video'], d['pose']
        measured = ', '.join(c['code'] for c in t['criteria'] if c['measurement']) or 'none'
        lines.append(f"| {item['exercise']} | {v.get('fps',0):.3f} | {v.get('decodedFrames',0)} / {p.get('sampledFrames',0)} / {p.get('poseFrames',0)} | {p.get('detectionRate',0):.1%} | {r['detectedRepetitions']} | {measured} | {t['headline']} |")
        details += ['',f"## {item['exercise']}",'',f"Source: {item['source']}",f"SHA-256: `{item['sha256']}`. Coach label: **not available**.",
                    f"[Full inference result](private/technique-smoke/{item['exercise'].lower()}.json)",'',
                    '| Criterion | Measurement | Side / valid samples | Range | Reason |','|---|---|---|---|---|']
        for c in t['criteria']:
            m=c['measurement'] or {}
            details.append(f"| {c['code']} | {m.get('unit','—')} | {m.get('side','—')} / {m.get('sampleCount','—')} | {json.dumps(m.get('range'),ensure_ascii=False) if m.get('range') else '—'} | {c['reasonCode']} |")
    REPORT.write_text('\n'.join(lines+details)+'\n',encoding='utf-8')


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--build-manifest',action='store_true')
    parser.add_argument('--run',action='store_true')
    parser.add_argument('--report',action='store_true')
    options=parser.parse_args()
    if options.build_manifest: build_manifest()
    if options.run: run()
    if options.report: report()
