"""Reproducible Lite/Full/Heavy inference comparison on identical local clips.

Each model runs in a separate CLI process. MODEL_PATH is overridden only inside
that process; the running API and its model configuration are never modified.
No Coach labels are available, so this is a measurement/runtime benchmark only.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import platform
from statistics import median
import subprocess
import sys
from time import perf_counter


ROOT = Path(__file__).resolve().parent
CASES = {
    'side': ('SQUAT', 'UNSPECIFIED', 'samples/github-side-squat.mp4'),
    'front': ('SQUAT', 'BODYWEIGHT', 'samples/front-facing-squat-pexels-5034577.mp4'),
    'push_up': ('PUSH_UP', 'STANDARD', 'samples/push-up-pexels-4964649.mp4'),
    'plank': ('PLANK', 'FRONT', 'samples/plank-pexels-6525496.mp4'),
    'lunge': ('LUNGE', 'FORWARD_BODYWEIGHT', 'samples/lunge-pexels-6525491.mp4'),
    'biceps_curl': ('BICEPS_CURL', 'UNSPECIFIED', 'samples/hammer-curls-ymove.mp4'),
    'shoulder_press': ('SHOULDER_PRESS', 'UNSPECIFIED', 'samples/shoulder-press-pexels-5837705.mp4'),
}


def file_hash(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def pipeline_hashes():
    names = ('main.py', 'diagnostics.py', 'video_io.py', 'rules.py', 'squat_config.py',
             'squat_criteria.py', 'squat_measurements.py', 'technique_engine.py',
             'exercise_catalog.py', 'standard_registry.py')
    return {name: file_hash(ROOT / name) for name in names if (ROOT / name).is_file()}


def peak_memory_mib():
    """Peak process working set, never a fabricated GPU/RAM estimate."""
    if sys.platform == 'win32':
        try:
            import ctypes
            from ctypes import wintypes
            class Counters(ctypes.Structure):
                _fields_ = [('cb', wintypes.DWORD), ('PageFaultCount', wintypes.DWORD)] + [
                    (name, ctypes.c_size_t) for name in (
                        'PeakWorkingSetSize', 'WorkingSetSize', 'QuotaPeakPagedPoolUsage',
                        'QuotaPagedPoolUsage', 'QuotaPeakNonPagedPoolUsage', 'QuotaNonPagedPoolUsage',
                        'PagefileUsage', 'PeakPagefileUsage')]
            kernel = ctypes.WinDLL('kernel32', use_last_error=True)
            psapi = ctypes.WinDLL('psapi', use_last_error=True)
            kernel.GetCurrentProcess.restype = wintypes.HANDLE
            psapi.GetProcessMemoryInfo.argtypes = [wintypes.HANDLE, ctypes.POINTER(Counters), wintypes.DWORD]
            counter = Counters()
            counter.cb = ctypes.sizeof(counter)
            if psapi.GetProcessMemoryInfo(kernel.GetCurrentProcess(), ctypes.byref(counter), counter.cb):
                return round(counter.PeakWorkingSetSize / 1024 / 1024, 2)
        except (OSError, AttributeError):
            return None
        return None
    try:
        import resource
        value = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        return round(value / (1024 * 1024 if sys.platform == 'darwin' else 1024), 2)
    except (ImportError, OSError):
        return None


def summarize(result, elapsed):
    diagnostics = result.get('diagnostics', {})
    pose = diagnostics.get('pose', {})
    landmarks = diagnostics.get('landmarks', {})
    counts = landmarks.get('coreValidFrames', {})
    poses, sampled = pose.get('poseFrames', 0), pose.get('sampledFrames', 0)
    side = max(('left', 'right'), key=lambda candidate: counts.get(candidate, 0))
    valid = counts.get(side, 0)
    timeline = diagnostics.get('timeline', [])
    differences = [abs(second[side + 'KneeAngle'] - first[side + 'KneeAngle'])
                   for first, second in zip(timeline, timeline[1:])
                   if first.get(side + 'KneeAngle') is not None and second.get(side + 'KneeAngle') is not None
                   and second['timeSeconds'] - first['timeSeconds'] <= .31]
    technique = result.get('techniqueEvaluation', {})
    return {'status': result.get('status'), 'reportedFps': diagnostics.get('video', {}).get('fps'),
            'decodedFrames': diagnostics.get('video', {}).get('decodedFrames', 0),
            'sampledFrames': sampled, 'poseFrames': poses,
            'poseDetectionRate': poses / sampled if sampled else None,
            'bestCoreSide': side, 'validCoreFrames': valid,
            'coreValidRateAmongPoseFrames': valid / poses if poses else None,
            'coreValidRateAmongSampledFrames': valid / sampled if sampled else None,
            'bilateralCoreValidFrames': counts.get('bilateral', 0),
            'medianAbsoluteProjectedKneeStepDegrees': round(median(differences), 4) if differences else None,
            'projectedKneeStepPairs': len(differences),
            'repetitions': result.get('detectedRepetitions'),
            'repCountAccuracy': None, 'techniqueAccuracy': None,
            'cameraView': result.get('cameraView', {}).get('detected', 'UNKNOWN'),
            'measuredCriteria': technique.get('measuredCriteria'),
            'techniqueStatus': technique.get('status'),
            'processingSeconds': round(elapsed, 4),
            'processPeakWorkingSetMiBAfterClip': peak_memory_mib(),
            'peakMemoryScope': 'cumulative_process_high_water_mark_after_this_clip',
            'modelVersion': result.get('modelVersion'),
            'ruleVersion': result.get('ruleVersion')}


def worker(model_name, cases, output):
    model = ROOT / 'models' / f'pose_landmarker_{model_name}.task'
    if not model.is_file():
        raise FileNotFoundError(f'Model not installed: {model}')
    os.environ.setdefault('MPLCONFIGDIR', str(ROOT / '.venv' / 'mplconfig'))
    import main
    main.MODEL_PATH = model
    rows = []
    for case in cases:
        exercise, variant, relative_path = CASES[case]
        video = ROOT / relative_path
        started = perf_counter()
        result = main.analyze_video(str(video), exercise_type=exercise, exercise_variant=variant)
        elapsed = perf_counter() - started
        summary = {'case': case, 'exercise': exercise, 'requestedVariant': variant,
                   'videoPath': relative_path, 'videoSha256': file_hash(video),
                   **summarize(result, elapsed)}
        rows.append(summary)
        (output / f'{model_name}.{case}.inference.json').write_text(
            json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False), encoding='utf-8')
        print(model_name, case, 'pose', summary['poseFrames'], '/', summary['sampledFrames'],
              'reps', summary['repetitions'], 'seconds', summary['processingSeconds'], flush=True)
    report = {'model': model_name, 'modelPath': str(model.relative_to(ROOT)),
              'modelBytes': model.stat().st_size, 'modelSha256': file_hash(model),
              'source': f'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_{model_name}/float16/1/pose_landmarker_{model_name}.task',
              'processPeakWorkingSetMiB': peak_memory_mib(), 'pipelineSha256': pipeline_hashes(), 'results': rows}
    (output / f'{model_name}.summary.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')


def ratio(value):
    return f'{value:.1%}' if value is not None else 'unavailable'


def write_report(reports, output):
    data = {'schemaVersion': 1, 'createdAt': datetime.now(timezone.utc).isoformat(),
            'platform': platform.platform(), 'processor': platform.processor(),
            'python': platform.python_version(), 'sourceType': 'REAL_DEVELOPMENT_UNLABELED',
            'coachGroundTruth': None, 'accuracyReported': False,
            'sampleRateHz': 10, 'modelOrder': [report['model'] for report in reports],
            'clipOrder': [row['case'] for row in reports[0]['results']],
            'warmup': 'No explicit warm-up; model initialization included in each inference.',
            'repeats': 1, 'pipelineSha256AtReport': pipeline_hashes(), 'reports': reports}
    (output / 'benchmark.json').write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
    relative = output.relative_to(ROOT / 'evaluation')
    lines = ['# Pose model benchmark — Lite / Full / Heavy', '',
             'Local software benchmark on identical real development videos. No Coach-confirmed labels are available; rep-count and technique accuracy are **not reported**. The active service model has not been changed.', '',
             f"Platform: `{data['platform']}`. Processor: `{data['processor']}`. Python: `{data['python']}`.",
             'Protocol: VIDEO mode, 10 Hz samples, existing visibility/quality gates and movement rules; one run per model/clip, no explicit warm-up. Model initialization and video decoding are included in wall time. Each model uses its own subprocess, clips run sequentially in the same order.', '',
             '**The projected-knee step metric includes actual exercise movement and camera effects. It is a motion-sensitive proxy, not a validated landmark-jitter/stability score. Lower is not automatically better.**', '',
             '**Peak RAM is the process high-water working set after each clip**, including Python, OpenCV, MediaPipe and data already loaded in that model process. It is not isolated model memory or per-clip allocation. No GPU resource claim is made.', '',
             f'[Full benchmark JSON]({relative.as_posix()}/benchmark.json)', '',
             '| Model | Clip | FPS | Decoded / sampled / pose | Pose rate | Valid core / pose | Valid core / sample | Rep output | Measured criteria | Median projected knee step (°) | Time (s) | Process peak RAM (MiB) |',
             '|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|']
    for report in reports:
        for row in report['results']:
            lines.append(f"| {report['model']} | {row['case']} | {row['reportedFps']:.3f} | {row['decodedFrames']} / {row['sampledFrames']} / {row['poseFrames']} | {ratio(row['poseDetectionRate'])} | {ratio(row['coreValidRateAmongPoseFrames'])} | {ratio(row['coreValidRateAmongSampledFrames'])} | {row['repetitions']} | {row['measuredCriteria']} | {row['medianAbsoluteProjectedKneeStepDegrees']} | {row['processingSeconds']:.3f} | {row['processPeakWorkingSetMiBAfterClip']} |")
    lines += ['', '## Aggregate observations', '',
              '| Model | Pose / samples | Valid core / samples | Total wall time (s) | Process peak RAM (MiB) |',
              '|---|---:|---:|---:|---:|']
    for report in reports:
        sampled = sum(row['sampledFrames'] for row in report['results'])
        poses = sum(row['poseFrames'] for row in report['results'])
        valid = sum(row['validCoreFrames'] for row in report['results'])
        seconds = sum(row['processingSeconds'] for row in report['results'])
        lines.append(f"| {report['model']} | {poses} / {sampled} ({ratio(poses/sampled if sampled else None)}) | {valid} / {sampled} ({ratio(valid/sampled if sampled else None)}) | {seconds:.3f} | {report['processPeakWorkingSetMiB']} |")
    lines += ['', '## Model artifacts', '', '| Model | Bytes | SHA-256 | Source |', '|---|---:|---|---|']
    for report in reports:
        lines.append(f"| {report['model']} | {report['modelBytes']} | `{report['modelSha256']}` | [Official Google task bundle]({report['source']}) |")
    lines += ['', 'Core-valid means shoulder, hip, knee and ankle on the better-tracked fixed side satisfy visibility and in-frame checks. It is reported against both pose frames and all sampled frames; it does not prove correct exercise technique. Whole-body core validity is conservative for upper-body exercises: elbow/wrist measurements can remain available even when ankles are cropped or low confidence. Per-criterion evidence and valid sample counts are in each full inference JSON. All outputs and video hashes are retained in the linked directory.', '',
              'For reference: [official MediaPipe Pose Landmarker model documentation](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker#models).', '',
              '## Limits and interpretation', '',
              '- Small development sample, one run, no participant-independent holdout labels or confidence intervals.',
              '- Segmentation differences are raw output differences, not measured counting errors.',
              '- A model with better detection coverage or a larger task bundle has not thereby shown more accurate technique evaluation.',
              '- The running Lite model stays selected until a separately reviewed deployment/configuration decision.', '',
              'Re-run from `ai-exercise-service`: `python benchmark_pose_models.py`. New timestamped private artifacts are created; prior runs are preserved.']
    (ROOT / 'evaluation' / 'POSE_BENCHMARK.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--models', nargs='+', choices=['lite', 'full', 'heavy'], default=['lite', 'full', 'heavy'])
    parser.add_argument('--cases', nargs='+', choices=list(CASES), default=list(CASES))
    parser.add_argument('--output-dir', type=Path)
    parser.add_argument('--worker', choices=['lite', 'full', 'heavy'])
    args = parser.parse_args()
    os.chdir(ROOT)
    if args.worker:
        if args.output_dir is None:
            parser.error('--worker requires --output-dir')
        worker(args.worker, args.cases, args.output_dir)
        return
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    output = args.output_dir or ROOT / 'evaluation' / 'private' / 'pose-benchmark' / stamp
    output = output.resolve()
    if output.exists():
        raise FileExistsError('A benchmark run directory must be new to preserve prior results')
    output.mkdir(parents=True)
    reports = []
    for model in args.models:
        command = [sys.executable, str(Path(__file__).resolve()), '--worker', model,
                   '--output-dir', str(output), '--cases', *args.cases]
        subprocess.run(command, check=True)
        reports.append(json.loads((output / f'{model}.summary.json').read_text(encoding='utf-8')))
    write_report(reports, output)
    print('Benchmark report:', ROOT / 'evaluation' / 'POSE_BENCHMARK.md', flush=True)


if __name__ == '__main__':
    main()
