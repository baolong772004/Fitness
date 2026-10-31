import argparse
import hashlib
import json
import sys
from pathlib import Path

from criterion_evaluation import default_candidate_policy
from squat_config import load_config, parse_protocol
from squat_criteria import analyze_pose_frames
from standard_registry import load_standard
from technique_engine import _experimental_evaluation, evaluate_technique

VALID_EXERCISES = {
    'SQUAT',
    'PUSH_UP',
    'PLANK',
    'LUNGE',
    'BICEPS_CURL',
    'SHOULDER_PRESS',
}

VALID_VARIANTS = {
    'BODYWEIGHT',
    'BARBELL_BACK_SQUAT',
    'DUMBBELL_GOBLET_SQUAT',
    'KETTLEBELL_GOBLET_SQUAT',
    'WEIGHTED',
    'STANDARD',
    'FOREARM_PLANK',
    'FORWARD_LUNGE',
    'DUMBBELL_CURL',
    'OVERHEAD_PRESS',
    'UNSPECIFIED',
}

VALID_CAMERA_VIEWS = {'SIDE', 'FRONT', 'OBLIQUE', 'UNKNOWN'}
VALID_SPLITS = {'development', 'validation', 'holdout'}
VALID_CRITERION_OUTCOMES = {'MEETS', 'IMPROVE', 'UNASSESSABLE'}
COARSE_MOVEMENT_LABELS = {'GOOD', 'BAD', 'CORRECT', 'INCORRECT', 'PASS', 'FAIL'}

PUBLIC_DATASET_CATALOG = [
    {
        'datasetId': 'fitness-aqa-2022',
        'name': 'Fitness-AQA (Action Quality Assessment)',
        'exercisesCovered': ['SQUAT', 'BARBELL_ROW', 'OVERHEAD_PRESS'],
        'license': 'Academic / Non-Commercial Research Only (requires dataset request agreement)',
        'commercialUseAllowed': False,
        'accessMethod': 'MANUAL_REQUEST_OR_ACADEMIC_DOWNLOAD',
        'rawLabelGranularity': 'COARSE_ERROR_FLAGS_AND_AQA_SCORE (knees inward, shallow squat, waist bend)',
        'canAutoConvertToCriterionTruth': False,
        'rejectionReasonForAutoCriterionMapping': (
            'Restricted to non-commercial academic use; labels do not include per-rep start/bottom/end timestamps '
            'verified against our 8-criterion Squat rubric (SQUAT-01..08) or camera-view calibration.'
        ),
    },
    {
        'datasetId': 'ui-prmd-2018',
        'name': 'UI-PRMD (University of Idaho Physical Rehabilitation Movements Dataset)',
        'exercisesCovered': ['SQUAT', 'INLINE_LUNGE', 'SIT_TO_STAND', 'SHOULDER_ABDUCTION', 'SHOULDER_FLEXION'],
        'license': 'Open Data Commons Public Domain Dedication and License (PDDL v1.0)',
        'commercialUseAllowed': True,
        'accessMethod': 'EXTERNAL_SKELETON_ARCHIVE (Vicon optical + Kinect 3D joint angles/positions, no standard RGB smartphone clips)',
        'rawLabelGranularity': 'WHOLE_TRIAL_CORRECT_VS_INCORRECT_MOVEMENT',
        'canAutoConvertToCriterionTruth': False,
        'rejectionReasonForAutoCriterionMapping': (
            'Provides Vicon/Kinect 3D skeleton CSVs with whole-trial Correct/Incorrect labels rather than RGB video '
            'with per-criterion (SQUAT-01..08) Coach labels; whole-trial Correct/Incorrect cannot be mapped to '
            'specific knee/hip/back errors.'
        ),
    },
    {
        'datasetId': 'mm-fit-2020',
        'name': 'MM-Fit Multimodal Fitness Dataset',
        'exercisesCovered': ['SQUAT', 'PUSH_UP', 'LUNGE', 'BICEPS_CURL', 'SHOULDER_PRESS'],
        'license': 'CC BY-NC-SA 4.0 (Non-Commercial ShareAlike)',
        'commercialUseAllowed': False,
        'accessMethod': 'MANUAL_ACADEMIC_DOWNLOAD',
        'rawLabelGranularity': 'EXERCISE_CLASS_AND_REP_COUNT_BOUNDARIES_ONLY',
        'canAutoConvertToCriterionTruth': False,
        'rejectionReasonForAutoCriterionMapping': (
            'CC BY-NC-SA 4.0 prohibits commercial deployment, and annotations only contain exercise classification '
            'and repetition counts without form/technique error labels.'
        ),
    },
    {
        'datasetId': 'repcount-cvpr2022',
        'name': 'RepCount (Repetition Counting Dataset)',
        'exercisesCovered': ['SQUAT', 'PUSH_UP', 'PULL_UP', 'SIT_UP', 'JUMPING_JACK'],
        'license': 'Non-Commercial Research Only',
        'commercialUseAllowed': False,
        'accessMethod': 'MANUAL_ACADEMIC_DOWNLOAD',
        'rawLabelGranularity': 'REP_START_END_TIMESTAMPS_ONLY',
        'canAutoConvertToCriterionTruth': False,
        'rejectionReasonForAutoCriterionMapping': (
            'Contains YouTube clips with repetition start/end timestamps only; no technique quality or criterion '
            'verdict annotations exist.'
        ),
    },
    {
        'datasetId': 'penn-action',
        'name': 'Penn Action Dataset',
        'exercisesCovered': ['SQUAT', 'PUSH_UP', 'PULL_UP', 'BENCH_PRESS', 'CLEAN_AND_JERK'],
        'license': 'Academic Research Use',
        'commercialUseAllowed': False,
        'accessMethod': 'MANUAL_ACADEMIC_DOWNLOAD',
        'rawLabelGranularity': '2D_JOINT_KEYPOINTS_AND_VIEWPOINT_ONLY',
        'canAutoConvertToCriterionTruth': False,
        'rejectionReasonForAutoCriterionMapping': (
            'Provides 2D joint bounding/keypoint annotations and coarse viewpoint labels, with zero biomechanical '
            'form or criterion quality labels.'
        ),
    },
    {
        'datasetId': 'posetrainer-2020',
        'name': 'PoseTrainer Exercise Dataset',
        'exercisesCovered': ['SQUAT', 'BICEPS_CURL', 'SHOULDER_PRESS', 'FRONT_RAISE'],
        'license': 'Academic / Research Reference',
        'commercialUseAllowed': False,
        'accessMethod': 'EXTERNAL_GIT_REPO_EXTRACTED_KEYPOINTS',
        'rawLabelGranularity': 'COARSE_GOOD_VS_BAD_CLIP_CLASSIFICATION',
        'canAutoConvertToCriterionTruth': False,
        'rejectionReasonForAutoCriterionMapping': (
            'Uses coarse clip-level good/bad labels; automatically converting coarse good/bad into specific knee, '
            'hip, or spine criterion verdicts is prohibited.'
        ),
    },
]


def normalize_dataset_record(raw: dict) -> dict:
    """
    Normalize a video/rep dataset record into the canonical schema while strictly
    separating coarse good/bad movement labels from Coach-verified per-criterion labels.
    """
    video_id = str(raw.get('videoId') or raw.get('id') or '').strip()
    if not video_id:
        raise ValueError('videoId is required')

    exercise = str(raw.get('exercise') or 'SQUAT').strip().upper()
    if exercise not in VALID_EXERCISES:
        raise ValueError(f'Unsupported exercise: {exercise}')

    variant = str(raw.get('variant') or raw.get('exerciseVariant') or 'BODYWEIGHT').strip().upper()
    if variant not in VALID_VARIANTS:
        raise ValueError(f'Unsupported exercise variant: {variant}')

    camera_view = str(raw.get('cameraView') or 'UNKNOWN').strip().upper()
    if camera_view not in VALID_CAMERA_VIEWS:
        raise ValueError(f'Unsupported cameraView: {camera_view}')

    subject_id = str(raw.get('subjectId') or '').strip()
    session_id = str(raw.get('sessionId') or '').strip()
    if not subject_id or not session_id:
        raise ValueError('subjectId and sessionId are required for split independence')

    split = str(raw.get('split') or 'development').strip().lower()
    if split not in VALID_SPLITS:
        raise ValueError(f'Unsupported split: {split}')

    coarse_label = raw.get('coarseFormLabel')
    if coarse_label is not None:
        coarse_label = str(coarse_label).strip().upper()
        if coarse_label not in COARSE_MOVEMENT_LABELS:
            raise ValueError(f'Invalid coarseFormLabel: {coarse_label}')

    if raw.get('autoConvertCoarseLabelToCriteria'):
        raise ValueError(
            'PROHIBITED: Cannot automatically convert coarse good/bad movement labels '
            'into specific knee, hip, or back criterion labels (SQUAT-01..SQUAT-08).'
        )

    standard = load_standard(exercise)
    valid_criteria = {c['criterionId'] for c in standard.get('criteria', [])}

    normalized_rep_labels = []
    for item in raw.get('criterionLabels') or []:
        cid = str(item.get('criterionId') or '').strip().upper()
        if cid not in valid_criteria:
            raise ValueError(f'Unknown criterionId {cid} for {exercise}')
        outcome = str(item.get('outcome') or '').strip().upper()
        if outcome in COARSE_MOVEMENT_LABELS:
            raise ValueError(
                f'PROHIBITED: Coarse label {outcome} cannot be used as a criterion verdict for {cid}; '
                'must be Coach-verified MEETS, IMPROVE, or UNASSESSABLE.'
            )
        if outcome not in VALID_CRITERION_OUTCOMES:
            raise ValueError(f'Invalid criterion outcome: {outcome}')
        rep_number = item.get('repNumber')
        if rep_number is None or not isinstance(rep_number, int) or rep_number < 1:
            raise ValueError(f'Invalid repNumber for {cid}: {rep_number}')
        reviewer_id = str(item.get('reviewerId') or '').strip()
        if not reviewer_id:
            raise ValueError(f'reviewerId is required for criterion label {cid} rep {rep_number}')
        normalized_rep_labels.append({
            'repNumber': rep_number,
            'criterionId': cid,
            'outcome': outcome,
            'cameraView': str(item.get('cameraView') or camera_view).strip().upper(),
            'timestampSeconds': item.get('timestampSeconds'),
            'startSeconds': item.get('startSeconds'),
            'endSeconds': item.get('endSeconds'),
            'reviewerId': reviewer_id,
            'labeledAt': item.get('labeledAt'),
            'standardVersion': item.get('standardVersion') or standard.get('standardVersion'),
            'note': str(item.get('note') or '').strip(),
        })

    return {
        'videoId': video_id,
        'exercise': exercise,
        'variant': variant,
        'cameraView': camera_view,
        'subjectId': subject_id,
        'sessionId': session_id,
        'split': split,
        'sha256': raw.get('sha256'),
        'path': raw.get('path'),
        'sourceDataset': raw.get('sourceDataset', 'LOCAL_SAMPLES'),
        'license': raw.get('license', 'Royalty-Free / Repository Sample'),
        'commercialUseAllowed': bool(raw.get('commercialUseAllowed', True)),
        'coarseFormLabel': coarse_label,
        'coarseLabelUsableForCriterionValidation': False,
        'criterionLabels': normalized_rep_labels,
    }


def validate_split_independence(records: list[dict]) -> dict:
    """
    Verify that development, validation, and holdout splits do not share
    any video sha256, subjectId, or sessionId.
    """
    by_split = {'development': [], 'validation': [], 'holdout': []}
    for rec in records:
        split = rec.get('split', 'development')
        if split not in by_split:
            raise ValueError(f'Invalid split {split}')
        by_split[split].append(rec)

    leaks = []
    split_pairs = [
        ('development', 'validation'),
        ('development', 'holdout'),
        ('validation', 'holdout'),
    ]
    for left, right in split_pairs:
        for key in ('sha256', 'subjectId', 'sessionId'):
            left_vals = {r.get(key) for r in by_split[left] if r.get(key)}
            right_vals = {r.get(key) for r in by_split[right] if r.get(key)}
            overlap = sorted(left_vals & right_vals)
            if overlap:
                leaks.append({
                    'splits': f'{left}<->{right}',
                    'field': key,
                    'overlappingValues': overlap,
                })

    return {
        'independent': len(leaks) == 0,
        'countsBySplit': {k: len(v) for k, v in by_split.items()},
        'uniqueSubjectsBySplit': {
            k: len({r.get('subjectId') for r in v if r.get('subjectId')})
            for k, v in by_split.items()
        },
        'leaks': leaks,
    }


LOCAL_VIDEO_METADATA = [
    {
        'videoId': 'squat-side-github-01',
        'debugJson': 'evaluation/private/pipeline-debug/side.after-v6.json',
        'path': 'samples/github-side-squat.mp4',
        'exercise': 'SQUAT',
        'variant': 'BODYWEIGHT',
        'expectedView': 'SIDE',
        'subjectId': 'subj-github-side-01',
        'sessionId': 'sess-github-side-01',
        'split': 'development',
        'sourceType': 'REAL',
        'sourceDataset': 'GitHub Open Squat Sample',
    },
    {
        'videoId': 'squat-front-pexels-5034577',
        'debugJson': 'evaluation/private/pipeline-debug/front.after-v6.json',
        'path': 'samples/front-facing-squat-pexels-5034577.mp4',
        'exercise': 'SQUAT',
        'variant': 'BODYWEIGHT',
        'expectedView': 'FRONT',
        'subjectId': 'subj-pexels-5034577',
        'sessionId': 'sess-pexels-5034577',
        'split': 'development',
        'sourceType': 'REAL',
        'sourceDataset': 'Pexels Free License (5034577)',
    },
    {
        'videoId': 'squat-oblique-pexels-8837221',
        'debugJson': 'evaluation/private/pipeline-debug/oblique.after-v6.json',
        'path': 'samples/oblique-squat-pexels-8837221.mp4',
        'exercise': 'SQUAT',
        'variant': 'BODYWEIGHT',
        'expectedView': 'OBLIQUE',
        'subjectId': 'subj-pexels-8837221',
        'sessionId': 'sess-pexels-8837221',
        'split': 'development',
        'sourceType': 'REAL',
        'sourceDataset': 'Pexels Free License (8837221)',
    },
    {
        'videoId': 'squat-legacy-view1-220k',
        'debugJson': 'evaluation/private/pipeline-debug/legacy-first.after-v6.json',
        'path': 'samples/squat_first_view-220k.mp4',
        'exercise': 'SQUAT',
        'variant': 'BODYWEIGHT',
        'expectedView': 'FRONT',
        'subjectId': 'subj-ymove-multiview-01',
        'sessionId': 'sess-ymove-multiview-01',
        'split': 'development',
        'sourceType': 'REAL',
        'sourceDataset': 'Multi-View Squat Sample (View 1)',
    },
    {
        'videoId': 'squat-legacy-view2-220k',
        'debugJson': 'evaluation/private/pipeline-debug/legacy-second.after-v6.json',
        'path': 'samples/squat_second_view-220k.mp4',
        'exercise': 'SQUAT',
        'variant': 'BODYWEIGHT',
        'expectedView': 'OBLIQUE',
        'subjectId': 'subj-ymove-multiview-01',
        'sessionId': 'sess-ymove-multiview-01',
        'split': 'development',
        'sourceType': 'REAL',
        'sourceDataset': 'Multi-View Squat Sample (View 2)',
    },
    {
        'videoId': 'squat-legacy-view3-220k',
        'debugJson': 'evaluation/private/pipeline-debug/legacy-third.after-v6.json',
        'path': 'samples/squat_third_view-220k.mp4',
        'exercise': 'SQUAT',
        'variant': 'BODYWEIGHT',
        'expectedView': 'OBLIQUE',
        'subjectId': 'subj-ymove-multiview-01',
        'sessionId': 'sess-ymove-multiview-01',
        'split': 'development',
        'sourceType': 'REAL',
        'sourceDataset': 'Multi-View Squat Sample (View 3)',
    },
    {
        'videoId': 'squat-pexels-6525519',
        'debugJson': 'evaluation/private/pipeline-debug/pexels-squat-6525519.after-v6.json',
        'path': 'samples/pexels-squat-6525519.mp4',
        'exercise': 'SQUAT',
        'variant': 'BODYWEIGHT',
        'expectedView': 'FRONT',
        'subjectId': 'subj-pexels-6525519',
        'sessionId': 'sess-pexels-6525519',
        'split': 'development',
        'sourceType': 'REAL',
        'sourceDataset': 'Pexels Free License (6525519)',
    },
    {
        'videoId': 'squat-pexels-7117541',
        'debugJson': 'evaluation/private/pipeline-debug/pexels-squat-7117541.after-v6.json',
        'path': 'samples/pexels-squat-7117541.mp4',
        'exercise': 'SQUAT',
        'variant': 'BODYWEIGHT',
        'expectedView': 'SIDE',
        'subjectId': 'subj-pexels-7117541',
        'sessionId': 'sess-pexels-7117541',
        'split': 'development',
        'sourceType': 'REAL',
        'sourceDataset': 'Pexels Free License (7117541)',
    },
    {
        'videoId': 'squat-pexels-8402111',
        'debugJson': 'evaluation/private/pipeline-debug/pexels-squat-8402111.after-v6.json',
        'path': 'samples/pexels-squat-8402111.mp4',
        'exercise': 'SQUAT',
        'variant': 'BODYWEIGHT',
        'expectedView': 'SIDE',
        'subjectId': 'subj-pexels-8402111',
        'sessionId': 'sess-pexels-8402111',
        'split': 'development',
        'sourceType': 'REAL',
        'sourceDataset': 'Pexels Free License (8402111)',
    },
    {
        'videoId': 'squat-barbell-back-01',
        'debugJson': 'evaluation/private/pipeline-debug/barbell.after-v6.json',
        'path': 'samples/barbell-back-squat.mp4',
        'exercise': 'SQUAT',
        'variant': 'BARBELL_BACK_SQUAT',
        'expectedView': 'SIDE',
        'subjectId': 'subj-barbell-01',
        'sessionId': 'sess-barbell-01',
        'split': 'development',
        'sourceType': 'REAL',
        'sourceDataset': 'Weighted Squat Sample (Barbell)',
    },
    {
        'videoId': 'squat-dumbbell-goblet-01',
        'debugJson': 'evaluation/private/pipeline-debug/dumbbell.after-v6.json',
        'path': 'samples/dumbbell-goblet-squat.mp4',
        'exercise': 'SQUAT',
        'variant': 'DUMBBELL_GOBLET_SQUAT',
        'expectedView': 'FRONT',
        'subjectId': 'subj-dumbbell-01',
        'sessionId': 'sess-dumbbell-01',
        'split': 'development',
        'sourceType': 'REAL',
        'sourceDataset': 'Weighted Squat Sample (Dumbbell)',
    },
    {
        'videoId': 'squat-kettlebell-goblet-01',
        'debugJson': 'evaluation/private/pipeline-debug/kettlebell.after-v6.json',
        'path': 'samples/kettlebell-goblet-squat.mp4',
        'exercise': 'SQUAT',
        'variant': 'KETTLEBELL_GOBLET_SQUAT',
        'expectedView': 'FRONT',
        'subjectId': 'subj-kettlebell-01',
        'sessionId': 'sess-kettlebell-01',
        'split': 'development',
        'sourceType': 'REAL',
        'sourceDataset': 'Weighted Squat Sample (Kettlebell)',
    },
    {
        'videoId': 'push-up-pexels-4964649',
        'debugJson': None,
        'path': 'samples/push-up-pexels-4964649.mp4',
        'exercise': 'PUSH_UP',
        'variant': 'STANDARD',
        'expectedView': 'SIDE',
        'subjectId': 'subj-pexels-4964649',
        'sessionId': 'sess-pexels-4964649',
        'split': 'development',
        'sourceType': 'REAL',
        'sourceDataset': 'Pexels Free License (4964649)',
    },
    {
        'videoId': 'plank-pexels-6525496',
        'debugJson': None,
        'path': 'samples/plank-pexels-6525496.mp4',
        'exercise': 'PLANK',
        'variant': 'FOREARM_PLANK',
        'expectedView': 'SIDE',
        'subjectId': 'subj-pexels-6525496',
        'sessionId': 'sess-pexels-6525496',
        'split': 'development',
        'sourceType': 'REAL',
        'sourceDataset': 'Pexels Free License (6525496)',
    },
    {
        'videoId': 'lunge-pexels-6525491',
        'debugJson': None,
        'path': 'samples/lunge-pexels-6525491.mp4',
        'exercise': 'LUNGE',
        'variant': 'FORWARD_LUNGE',
        'expectedView': 'SIDE',
        'subjectId': 'subj-pexels-6525491',
        'sessionId': 'sess-pexels-6525491',
        'split': 'development',
        'sourceType': 'REAL',
        'sourceDataset': 'Pexels Free License (6525491)',
    },
    {
        'videoId': 'biceps-curl-ymove-01',
        'debugJson': 'evaluation/private/pipeline-debug/non-squat.after-v6.json',
        'path': 'samples/hammer-curls-ymove.mp4',
        'exercise': 'BICEPS_CURL',
        'variant': 'DUMBBELL_CURL',
        'expectedView': 'FRONT',
        'subjectId': 'subj-ymove-curl-01',
        'sessionId': 'sess-ymove-curl-01',
        'split': 'development',
        'sourceType': 'REAL',
        'sourceDataset': 'YMove Sample (Hammer Curls)',
    },
    {
        'videoId': 'shoulder-press-pexels-5837705',
        'debugJson': None,
        'path': 'samples/shoulder-press-pexels-5837705.mp4',
        'exercise': 'SHOULDER_PRESS',
        'variant': 'OVERHEAD_PRESS',
        'expectedView': 'FRONT',
        'subjectId': 'subj-pexels-5837705',
        'sessionId': 'sess-pexels-5837705',
        'split': 'development',
        'sourceType': 'REAL',
        'sourceDataset': 'Pexels Free License (5837705)',
    },
]


def _run_squat_evaluation_from_pose(
    pose_frames: list,
    width: int,
    height: int,
    variant: str,
    protocol_opts: dict,
) -> dict:
    config = load_config()
    protocol = parse_protocol(protocol_opts)
    base_result = analyze_pose_frames(pose_frames, width, height, protocol, config, {})
    base_result['poseFrames'] = pose_frames
    base_result['video'] = {'width': width, 'height': height, 'sampleRateHz': config.sample_hz}
    evaluation = evaluate_technique(
        'SQUAT',
        pose_frames,
        base_result,
        width,
        height,
        variant=variant,
    )
    base_result['techniqueEvaluation'] = evaluation
    base_result['experimentalEvaluation'] = _experimental_evaluation(evaluation, base_result)
    return base_result


def evaluate_squat_development_set(base_dir: Path) -> tuple[dict, dict]:
    import main as main_module
    main_module.MODEL_PATH = base_dir / 'models' / 'pose_landmarker_lite.task'
    _analyze_video = main_module._analyze_video

    normalized_records = []
    squat_video_reports = []
    criterion_agg = {
        f'SQUAT-0{i}': {
            'criterionId': f'SQUAT-0{i}',
            'hasCandidateRule': default_candidate_policy(f'SQUAT-0{i}') is not None,
            'candidatePolicy': default_candidate_policy(f'SQUAT-0{i}'),
            'realVideosEvaluated': 0,
            'bodyweightRealVideos': 0,
            'weightedRealVideos': 0,
            'uniqueSubjects': set(),
            'totalDetectedReps': 0,
            'defaultProtocol': {
                'MEETS_CRITERION': 0,
                'NEEDS_IMPROVEMENT': 0,
                'UNABLE_TO_ASSESS': 0,
                'abstentionReasons': {},
            },
            'explicitProtocol': {
                'MEETS_CRITERION': 0,
                'NEEDS_IMPROVEMENT': 0,
                'UNABLE_TO_ASSESS': 0,
                'abstentionReasons': {},
                'byCameraView': {},
                'observedValuesSample': [],
            },
            'kinematicCandidateAllSquat': {
                'MEETS_CRITERION': 0,
                'NEEDS_IMPROVEMENT': 0,
                'UNABLE_TO_ASSESS': 0,
                'abstentionReasons': {},
                'byCameraView': {},
                'observedValuesSample': [],
            },
        }
        for i in range(1, 9)
    }

    for meta in LOCAL_VIDEO_METADATA:
        video_path = base_dir / meta['path']
        sha256 = hashlib.sha256(video_path.read_bytes()).hexdigest() if video_path.is_file() else None
        norm = normalize_dataset_record({
            **meta,
            'cameraView': meta['expectedView'],
            'sha256': sha256,
        })
        normalized_records.append(norm)

        if meta['exercise'] != 'SQUAT':
            continue

        if meta['debugJson'] and (base_dir / meta['debugJson']).is_file():
            saved = json.loads((base_dir / meta['debugJson']).read_text(encoding='utf-8'))
            pose_frames = saved.get('poseFrames', [])
            width = saved.get('video', {}).get('width', 720)
            height = saved.get('video', {}).get('height', 1280)
        else:
            analyzed = _analyze_video(str(video_path), {'cameraView': 'AUTO'}, 'SQUAT')
            if meta['debugJson']:
                (base_dir / meta['debugJson']).write_text(json.dumps(analyzed, ensure_ascii=False), encoding='utf-8')
            pose_frames = analyzed.get('poseFrames', [])
            width = analyzed.get('video', {}).get('width', 720)
            height = analyzed.get('video', {}).get('height', 1280)

        default_res = _run_squat_evaluation_from_pose(
            pose_frames,
            width,
            height,
            meta['variant'],
            {'cameraView': 'AUTO', 'depthTarget': 'NONE', 'descentTargetSeconds': None},
        )
        detected_view = default_res.get('cameraView', {}).get('detected', 'UNKNOWN')
        explicit_view = detected_view if detected_view in ('SIDE', 'FRONT') else 'AUTO'
        explicit_res = _run_squat_evaluation_from_pose(
            pose_frames,
            width,
            height,
            meta['variant'],
            {
                'cameraView': explicit_view,
                'depthTarget': 'HIP_AT_KNEE' if detected_view == 'SIDE' else 'NONE',
                'descentTargetSeconds': 1.5,
            },
        )
        kinematic_res = _run_squat_evaluation_from_pose(
            pose_frames,
            width,
            height,
            'BODYWEIGHT',
            {
                'cameraView': explicit_view,
                'depthTarget': 'HIP_AT_KNEE' if detected_view == 'SIDE' else 'NONE',
                'descentTargetSeconds': 1.5,
            },
        )

        reps = default_res.get('detectedRepetitions') or 0
        default_exp = {
            c['criterionId']: c
            for c in default_res.get('experimentalEvaluation', {}).get('criteria', [])
        }
        explicit_exp = {
            c['criterionId']: c
            for c in explicit_res.get('experimentalEvaluation', {}).get('criteria', [])
        }
        kinematic_exp = {
            c['criterionId']: c
            for c in kinematic_res.get('experimentalEvaluation', {}).get('criteria', [])
        }
        explicit_tech = {
            c['criterionId']: c
            for c in explicit_res.get('techniqueEvaluation', {}).get('criteria', [])
        }
        kinematic_tech = {
            c['criterionId']: c
            for c in kinematic_res.get('techniqueEvaluation', {}).get('criteria', [])
        }

        per_criterion_video = {}
        for cid, agg in criterion_agg.items():
            agg['realVideosEvaluated'] += 1
            if meta['variant'] == 'BODYWEIGHT':
                agg['bodyweightRealVideos'] += 1
            else:
                agg['weightedRealVideos'] += 1
            agg['uniqueSubjects'].add(meta['subjectId'])
            agg['totalDetectedReps'] += reps

            d_crit = default_exp.get(cid, {})
            e_crit = explicit_exp.get(cid, {})
            k_crit = kinematic_exp.get(cid, {})
            t_crit = explicit_tech.get(cid, {})
            kt_crit = kinematic_tech.get(cid, {})

            d_preds = d_crit.get('predictions') or []
            e_preds = e_crit.get('predictions') or []
            k_preds = k_crit.get('predictions') or []

            if d_preds:
                for p in d_preds:
                    st = p.get('status', 'UNABLE_TO_ASSESS')
                    agg['defaultProtocol'][st] = agg['defaultProtocol'].get(st, 0) + 1
                    if st == 'UNABLE_TO_ASSESS':
                        rc = p.get('reasonCode') or d_crit.get('reasonCode') or 'UNSPECIFIED'
                        agg['defaultProtocol']['abstentionReasons'][rc] = (
                            agg['defaultProtocol']['abstentionReasons'].get(rc, 0) + 1
                        )
            else:
                count_units = max(1, reps)
                agg['defaultProtocol']['UNABLE_TO_ASSESS'] += count_units
                rc = d_crit.get('reasonCode') or t_crit.get('reasonCode') or 'UNSPECIFIED'
                agg['defaultProtocol']['abstentionReasons'][rc] = (
                    agg['defaultProtocol']['abstentionReasons'].get(rc, 0) + count_units
                )

            view_bucket = agg['explicitProtocol']['byCameraView'].setdefault(
                detected_view,
                {'MEETS_CRITERION': 0, 'NEEDS_IMPROVEMENT': 0, 'UNABLE_TO_ASSESS': 0},
            )
            if e_preds:
                for p in e_preds:
                    st = p.get('status', 'UNABLE_TO_ASSESS')
                    agg['explicitProtocol'][st] = agg['explicitProtocol'].get(st, 0) + 1
                    view_bucket[st] = view_bucket.get(st, 0) + 1
                    if st == 'UNABLE_TO_ASSESS':
                        rc = p.get('reasonCode') or e_crit.get('reasonCode') or 'UNSPECIFIED'
                        agg['explicitProtocol']['abstentionReasons'][rc] = (
                            agg['explicitProtocol']['abstentionReasons'].get(rc, 0) + 1
                        )
                    if len(agg['explicitProtocol']['observedValuesSample']) < 8 and p.get('observedValue') is not None:
                        agg['explicitProtocol']['observedValuesSample'].append({
                            'videoId': meta['videoId'],
                            'cameraView': detected_view,
                            'repNumber': p.get('repNumber'),
                            'status': st,
                            'observedValue': p.get('observedValue'),
                        })
            else:
                count_units = max(1, reps)
                agg['explicitProtocol']['UNABLE_TO_ASSESS'] += count_units
                view_bucket['UNABLE_TO_ASSESS'] += count_units
                rc = e_crit.get('reasonCode') or t_crit.get('reasonCode') or 'UNSPECIFIED'
                agg['explicitProtocol']['abstentionReasons'][rc] = (
                    agg['explicitProtocol']['abstentionReasons'].get(rc, 0) + count_units
                )

            k_view_bucket = agg['kinematicCandidateAllSquat']['byCameraView'].setdefault(
                detected_view,
                {'MEETS_CRITERION': 0, 'NEEDS_IMPROVEMENT': 0, 'UNABLE_TO_ASSESS': 0},
            )
            if k_preds:
                for p in k_preds:
                    st = p.get('status', 'UNABLE_TO_ASSESS')
                    agg['kinematicCandidateAllSquat'][st] = agg['kinematicCandidateAllSquat'].get(st, 0) + 1
                    k_view_bucket[st] = k_view_bucket.get(st, 0) + 1
                    if st == 'UNABLE_TO_ASSESS':
                        rc = p.get('reasonCode') or k_crit.get('reasonCode') or 'UNSPECIFIED'
                        agg['kinematicCandidateAllSquat']['abstentionReasons'][rc] = (
                            agg['kinematicCandidateAllSquat']['abstentionReasons'].get(rc, 0) + 1
                        )
                    if len(agg['kinematicCandidateAllSquat']['observedValuesSample']) < 8 and p.get('observedValue') is not None:
                        agg['kinematicCandidateAllSquat']['observedValuesSample'].append({
                            'videoId': meta['videoId'],
                            'cameraView': detected_view,
                            'repNumber': p.get('repNumber'),
                            'status': st,
                            'observedValue': p.get('observedValue'),
                        })
            else:
                count_units = max(1, reps)
                agg['kinematicCandidateAllSquat']['UNABLE_TO_ASSESS'] += count_units
                k_view_bucket['UNABLE_TO_ASSESS'] += count_units
                rc = k_crit.get('reasonCode') or kt_crit.get('reasonCode') or 'UNSPECIFIED'
                agg['kinematicCandidateAllSquat']['abstentionReasons'][rc] = (
                    agg['kinematicCandidateAllSquat']['abstentionReasons'].get(rc, 0) + count_units
                )

            per_criterion_video[cid] = {
                'defaultStatus': d_crit.get('status', 'UNABLE_TO_ASSESS'),
                'defaultReasonCode': d_crit.get('reasonCode'),
                'explicitStatus': e_crit.get('status', 'UNABLE_TO_ASSESS'),
                'explicitReasonCode': e_crit.get('reasonCode'),
                'kinematicStatus': k_crit.get('status', 'UNABLE_TO_ASSESS'),
                'kinematicReasonCode': k_crit.get('reasonCode'),
                'repPredictions': [
                    {
                        'repNumber': p.get('repNumber'),
                        'status': p.get('status'),
                        'reasonCode': p.get('reasonCode'),
                        'observedValue': p.get('observedValue'),
                    }
                    for p in k_preds
                ],
            }

        squat_video_reports.append({
            'videoId': meta['videoId'],
            'path': meta['path'],
            'sha256': sha256,
            'subjectId': meta['subjectId'],
            'sessionId': meta['sessionId'],
            'variant': meta['variant'],
            'expectedView': meta['expectedView'],
            'detectedView': detected_view,
            'status': default_res.get('status'),
            'detectedRepetitions': reps,
            'defaultExperimentalSummary': default_res.get('experimentalEvaluation', {}).get('summary'),
            'explicitExperimentalSummary': explicit_res.get('experimentalEvaluation', {}).get('summary'),
            'kinematicExperimentalSummary': kinematic_res.get('experimentalEvaluation', {}).get('summary'),
            'criteria': per_criterion_video,
        })

    serializable_criteria = {}
    for cid, agg in criterion_agg.items():
        d_tot = (
            agg['defaultProtocol']['MEETS_CRITERION']
            + agg['defaultProtocol']['NEEDS_IMPROVEMENT']
            + agg['defaultProtocol']['UNABLE_TO_ASSESS']
        )
        e_tot = (
            agg['explicitProtocol']['MEETS_CRITERION']
            + agg['explicitProtocol']['NEEDS_IMPROVEMENT']
            + agg['explicitProtocol']['UNABLE_TO_ASSESS']
        )
        k_tot = (
            agg['kinematicCandidateAllSquat']['MEETS_CRITERION']
            + agg['kinematicCandidateAllSquat']['NEEDS_IMPROVEMENT']
            + agg['kinematicCandidateAllSquat']['UNABLE_TO_ASSESS']
        )
        serializable_criteria[cid] = {
            'criterionId': cid,
            'hasCandidateRule': agg['hasCandidateRule'],
            'realVideosEvaluated': agg['realVideosEvaluated'],
            'bodyweightRealVideos': agg['bodyweightRealVideos'],
            'weightedRealVideos': agg['weightedRealVideos'],
            'uniqueSubjectCount': len(agg['uniqueSubjects']),
            'totalDetectedReps': agg['totalDetectedReps'],
            'coachGroundTruthRepsInSql': 0,
            'coachLabelCounts': {'MEETS': 0, 'IMPROVE': 0, 'UNASSESSABLE': 0},
            'precision': None,
            'recall': None,
            'falsePositives': None,
            'falseNegatives': None,
            'defaultProtocol': {
                **agg['defaultProtocol'],
                'totalRepUnits': d_tot,
                'abstentionRate': round(agg['defaultProtocol']['UNABLE_TO_ASSESS'] / d_tot, 4) if d_tot else 1.0,
            },
            'explicitProtocol': {
                **agg['explicitProtocol'],
                'totalRepUnits': e_tot,
                'abstentionRate': round(agg['explicitProtocol']['UNABLE_TO_ASSESS'] / e_tot, 4) if e_tot else 1.0,
            },
            'kinematicCandidateAllSquat': {
                **agg['kinematicCandidateAllSquat'],
                'totalRepUnits': k_tot,
                'abstentionRate': round(agg['kinematicCandidateAllSquat']['UNABLE_TO_ASSESS'] / k_tot, 4) if k_tot else 1.0,
            },
            'validationStatus': 'BLOCKED_FOR_HUMAN_VALIDATION' if agg['hasCandidateRule'] else 'DEFERRED_NO_CANDIDATE_RULE',
        }

    split_check = validate_split_independence(normalized_records)
    catalog_doc = {
        'schemaVersion': 1,
        'publicDatasetsEvaluated': PUBLIC_DATASET_CATALOG,
        'splitIndependenceCheck': split_check,
        'normalizedLocalRecords': normalized_records,
    }
    dev_validation_doc = {
        'schemaVersion': 1,
        'stageStatus': 'BLOCKED_FOR_HUMAN_VALIDATION',
        'totalRealSquatVideos': len(squat_video_reports),
        'uniqueSquatSubjects': len({v['subjectId'] for v in squat_video_reports}),
        'totalDetectedSquatReps': sum(v['detectedRepetitions'] for v in squat_video_reports),
        'coachLabeledRepsInDatabase': 0,
        'criteriaSummary': serializable_criteria,
        'videos': squat_video_reports,
    }
    return catalog_doc, dev_validation_doc


def main(argv=None):
    sys.stdout.reconfigure(encoding='utf-8')
    parser = argparse.ArgumentParser(description='Normalize exercise datasets and run Squat development validation.')
    parser.add_argument('--base-dir', default='.', help='Path to ai-exercise-service directory')
    parser.add_argument(
        '--catalog-out',
        default='evaluation/normalized-dataset-catalog.json',
        help='Output path for normalized dataset catalog JSON',
    )
    parser.add_argument(
        '--validation-out',
        default='evaluation/SQUAT_DEV_VALIDATION_REPORT.json',
        help='Output path for Squat development validation report JSON',
    )
    args = parser.parse_args(argv)
    base_dir = Path(args.base_dir).resolve()
    catalog_doc, dev_validation_doc = evaluate_squat_development_set(base_dir)
    catalog_path = base_dir / args.catalog_out
    validation_path = base_dir / args.validation_out
    catalog_path.write_text(json.dumps(catalog_doc, ensure_ascii=False, indent=2), encoding='utf-8')
    validation_path.write_text(json.dumps(dev_validation_doc, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({
        'status': dev_validation_doc['stageStatus'],
        'totalRealSquatVideos': dev_validation_doc['totalRealSquatVideos'],
        'uniqueSquatSubjects': dev_validation_doc['uniqueSquatSubjects'],
        'totalDetectedSquatReps': dev_validation_doc['totalDetectedSquatReps'],
        'splitIndependence': catalog_doc['splitIndependenceCheck'],
        'criteriaSummary': {
            cid: {
                'hasCandidateRule': row['hasCandidateRule'],
                'defaultProtocol': {
                    'MEETS_CRITERION': row['defaultProtocol']['MEETS_CRITERION'],
                    'NEEDS_IMPROVEMENT': row['defaultProtocol']['NEEDS_IMPROVEMENT'],
                    'UNABLE_TO_ASSESS': row['defaultProtocol']['UNABLE_TO_ASSESS'],
                    'abstentionRate': row['defaultProtocol']['abstentionRate'],
                },
                'explicitProtocol': {
                    'MEETS_CRITERION': row['explicitProtocol']['MEETS_CRITERION'],
                    'NEEDS_IMPROVEMENT': row['explicitProtocol']['NEEDS_IMPROVEMENT'],
                    'UNABLE_TO_ASSESS': row['explicitProtocol']['UNABLE_TO_ASSESS'],
                    'abstentionRate': row['explicitProtocol']['abstentionRate'],
                    'abstentionReasons': row['explicitProtocol']['abstentionReasons'],
                },
                'kinematicCandidateAllSquat': {
                    'MEETS_CRITERION': row['kinematicCandidateAllSquat']['MEETS_CRITERION'],
                    'NEEDS_IMPROVEMENT': row['kinematicCandidateAllSquat']['NEEDS_IMPROVEMENT'],
                    'UNABLE_TO_ASSESS': row['kinematicCandidateAllSquat']['UNABLE_TO_ASSESS'],
                    'abstentionRate': row['kinematicCandidateAllSquat']['abstentionRate'],
                    'abstentionReasons': row['kinematicCandidateAllSquat']['abstentionReasons'],
                    'byCameraView': row['kinematicCandidateAllSquat']['byCameraView'],
                },
            }
            for cid, row in dev_validation_doc['criteriaSummary'].items()
        },
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
