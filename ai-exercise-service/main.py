import os
import tempfile
import hashlib
import json
from pathlib import Path
from time import perf_counter

import cv2
import mediapipe as mp
from math import isfinite
from fastapi import Body, FastAPI, File, Form, Header, HTTPException, UploadFile
from starlette.concurrency import run_in_threadpool

from rules import insufficient, RULE_VERSION
from squat_config import load_config, parse_protocol
from squat_criteria import analyze_pose_frames, unavailable_checks
from diagnostics import pose_diagnostics, finalize_diagnostics
from video_io import sampled_frames
from exercise_catalog import EXERCISES, public_exercises
from technique_engine import ENGINE_VERSION, EXPERIMENTAL_RULE_VERSION, evaluate_technique, measured_pose_result, _experimental_evaluation, member_provisional_evaluation
from standard_registry import list_standards, load_standard
from criterion_release import prepare_release, commit_release
from reference_dataset import reference_comparison_for_inference
from analyzers import analyzer_for

app = FastAPI(title="Private Exercise Analysis Service")
MODEL_PATH = Path(os.environ.get("POSE_MODEL_PATH", "models/pose_landmarker_lite.task"))
MAX_BYTES = 25 * 1024 * 1024


@app.get("/health")
def health():
    return {"ready": MODEL_PATH.is_file(), "ruleVersion": RULE_VERSION,
            "techniqueEngineVersion": ENGINE_VERSION,
            "experimentalRuleVersion": EXPERIMENTAL_RULE_VERSION,
            "experimentalEvaluationEnabled": os.environ.get('EXPERIMENTAL_EVALUATION_ENABLED') == 'true',
            "exercises": public_exercises()}


def _analyze_video(video_path: str, options=None, exercise_type='SQUAT'):
    exercise_type = exercise_type.upper()
    if exercise_type not in EXERCISES:
        raise ValueError('Unsupported exercise')
    config = load_config()
    protocol = parse_protocol(options)
    if not MODEL_PATH.is_file():
        raise HTTPException(503, "Pose model is not installed")
    capture = cv2.VideoCapture(video_path)
    try:
        rotation = capture.get(cv2.CAP_PROP_ORIENTATION_META)
        capture.set(cv2.CAP_PROP_ORIENTATION_AUTO, 1)
        auto_rotation = bool(capture.get(cv2.CAP_PROP_ORIENTATION_AUTO))
        fps = capture.get(cv2.CAP_PROP_FPS)
        count = capture.get(cv2.CAP_PROP_FRAME_COUNT)
        width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT))
        duration = count / fps if isfinite(fps) and fps > 0 else 0
        diag={'schemaVersion':1,'video':{'fps':fps if isfinite(fps) else None,'reportedFrameCount':count,
              'reportedDurationSeconds':duration,'rotationMetadataDegrees':rotation,'autoRotation':auto_rotation,
              'backend':capture.getBackendName() if capture.isOpened() else None,'decodedFrames':0},
              'pose':{'mode':'VIDEO','sampledFrames':0,'poseFrames':0},'segmentation':{}}
        if not capture.isOpened() or not isfinite(duration) or not 3 <= duration <= 30:
            reason = "Video cần dài từ 3 đến 30 giây và có thể giải mã được."
            result = insufficient(reason) if exercise_type == 'SQUAT' else measured_pose_result(exercise_type, [], protocol['cameraView'])
            result.update(criteria=unavailable_checks(config,reason,protocol) if exercise_type == 'SQUAT' else [],protocol=protocol,thresholdConfig=config.snapshot(),cameraView={'requested':protocol['cameraView'],'detected':'UNKNOWN'},validationStatus='NOT_COACH_VALIDATED',modelVersion=f"{MODEL_PATH.stem}-{hashlib.sha256(MODEL_PATH.read_bytes()).hexdigest()[:12]}")
            result['limitations']=[reason]
            diag['segmentation']['rejectionCode']='INVALID_VIDEO_DURATION_OR_DECODE'
            return finalize_diagnostics(result,diag)
        if rotation and not auto_rotation:
            reason='Không xoay được video theo metadata. Hãy xuất video đúng chiều rồi gửi lại.'
            result=insufficient(reason) if exercise_type == 'SQUAT' else measured_pose_result(exercise_type, [], protocol['cameraView'])
            result.update(criteria=unavailable_checks(config,reason,protocol) if exercise_type == 'SQUAT' else [],protocol=protocol)
            result['limitations']=[reason]
            diag['segmentation']['rejectionCode']='UNSUPPORTED_ROTATION'
            return finalize_diagnostics(result,diag)
        options = mp.tasks.vision.PoseLandmarkerOptions(
            base_options=mp.tasks.BaseOptions(model_asset_path=str(MODEL_PATH)),
            running_mode=mp.tasks.vision.RunningMode.VIDEO,
            num_poses=2,
            min_pose_detection_confidence=0.5,
        )
        pose_frames = []
        sampled = 0
        blurred = 0
        multi_person = 0
        last_time_ms = -1
        with mp.tasks.vision.PoseLandmarker.create_from_options(options) as landmarker:
            for second, frame, entry in sampled_frames(capture,fps,config.sample_hz,diag):
                sampled += 1
                if sampled == 1:
                    height, width = frame.shape[:2]
                if max(frame.shape[:2]) > 720:
                    scale = 720 / max(frame.shape[:2])
                    frame = cv2.resize(frame, (round(frame.shape[1] * scale), round(frame.shape[0] * scale)))
                gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                if cv2.Laplacian(gray, cv2.CV_64F).var() < 25:
                    blurred += 1
                    entry['rejection']='BLURRED'
                    continue
                time_ms = max(last_time_ms + 1, round(second * 1000))
                last_time_ms = time_ms
                entry['landmarkerTimestampMs']=time_ms
                image = mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
                poses = landmarker.detect_for_video(image, time_ms).pose_landmarks
                entry['poseCount']=len(poses)
                if len(poses) > 1:
                    multi_person += 1
                    entry['rejection']='MULTIPLE_PEOPLE'
                    continue
                if len(poses) != 1:
                    entry['rejection']='NO_POSE'
                    continue
                p = poses[0]
                landmark_names = {11: "leftShoulder", 12: "rightShoulder", 13: "leftElbow", 14: "rightElbow", 15: "leftWrist", 16: "rightWrist", 23: "leftHip", 24: "rightHip", 25: "leftKnee", 26: "rightKnee", 27: "leftAnkle", 28: "rightAnkle", 29: "leftHeel", 30: "rightHeel", 31: "leftToe", 32: "rightToe"}
                pose_frames.append({"timeSeconds": time_ms/1000, "repNumber": None, "side": "BOTH", "kneeAngleDegrees": None, "torsoLeanDegrees": None, "landmarks": {name: {"x": round(p[i].x, 5), "y": round(p[i].y, 5), "visibility": round(p[i].visibility, 3)} for i, name in landmark_names.items()}})
        quality_reason = None
        if diag['video'].get('durationExceeded'):
            quality_reason = 'Timestamp thực của video vượt quá giới hạn 30 giây.'
        elif sampled < 12:
            quality_reason = "Không đọc được đủ khung hình từ video."
        elif multi_person > sampled * 0.15:
            quality_reason = "Video có nhiều người trong khung hình; hãy quay lại khi chỉ có một người."
        elif len(pose_frames) < 12 and blurred > sampled * 0.5:
            quality_reason = "Video quá mờ để nhận diện khớp; hãy quay lại nơi đủ sáng."
        elif len(pose_frames) < 12:
            quality_reason = "Không nhận diện được một người rõ ở đủ khung hình."
        if quality_reason:
            result = insufficient(quality_reason) if exercise_type == 'SQUAT' else measured_pose_result(exercise_type, [], protocol['cameraView'])
            result.update(criteria=unavailable_checks(config,quality_reason,protocol) if exercise_type == 'SQUAT' else [], protocol=protocol, thresholdConfig=config.snapshot(), cameraView={'requested':protocol['cameraView'],'detected':'UNKNOWN'}, validationStatus='NOT_COACH_VALIDATED')
            result['limitations']=[quality_reason]
            diag.update(pose_diagnostics(pose_frames,width,height,config))
            diag['segmentation']['rejectionCode']='INPUT_QUALITY'
        else:
            result = analyzer_for(exercise_type).analyze(pose_frames,width,height,protocol,config,diag)
        result["video"] = {"width": width, "height": height, "durationSeconds": round(duration, 2), "sampleRateHz": config.sample_hz}
        result["qualityDetails"] = {"sampledFrames": sampled, "poseFrames": len(pose_frames), "blurredFrames": blurred, "multiplePersonFrames": multi_person}
        result["poseFrames"] = pose_frames
        result["modelVersion"] = f"{MODEL_PATH.stem}-{hashlib.sha256(MODEL_PATH.read_bytes()).hexdigest()[:12]}"
        diag['video'].update(displayWidth=width,displayHeight=height)
        diag['pose'].update(sampledFrames=sampled,poseFrames=len(pose_frames),
            detectionRate=round(len(pose_frames)/sampled,4) if sampled else 0,
            rateDenominator='sampled_decoded_frames_including_blurred',
            blurredFrames=blurred,multiplePersonFrames=multi_person,
            noPoseFrames=sum(e['rejection']=='NO_POSE' for e in diag['decodeTimeline']),
            inferenceFrames=sum('landmarkerTimestampMs' in e for e in diag['decodeTimeline']))
        return finalize_diagnostics(result,diag)
    finally:
        capture.release()


def analyze_video(video_path: str, options=None, exercise_type='SQUAT', exercise_variant='UNSPECIFIED', evaluation_mode='OFFICIAL'):
    started = perf_counter()
    exercise_type = exercise_type.upper()
    result = _analyze_video(video_path, options, exercise_type)
    video = result.get('video', {})
    evaluation = evaluate_technique(exercise_type, result.get('poseFrames', []), result,
                                    video.get('width', 0), video.get('height', 0), variant=exercise_variant)
    result.update(techniqueEvaluation=evaluation, exerciseVariant=exercise_variant,
                  evaluationMode=evaluation_mode, resultVersion='exercise-analysis-result-4',
                  exerciseSelection={'source': 'USER_SELECTED', 'recognized': False},
                  referenceStandardVersion=evaluation['referenceStandardVersion'],
                  inputVideoSha256=hashlib.sha256(Path(video_path).read_bytes()).hexdigest())
    if evaluation_mode == 'EXPERIMENTAL':
        result['experimentalEvaluation'] = _experimental_evaluation(evaluation, result)
        result['referenceComparison'] = reference_comparison_for_inference(result)
    elif evaluation_mode == 'OFFICIAL':
        preview = member_provisional_evaluation(evaluation, result)
        if preview:
            result['provisionalEvaluation'] = preview
    diagnostics = result.setdefault('diagnostics', {})
    diagnostics['technique'] = {'engineVersion': evaluation['engineVersion'],
        'standardVersion': evaluation['referenceStandardVersion'],
        'criteria': [{'criterionId': row.get('criterionId', row['code']), 'resultStatus': row['status'],
                     'validSamples': (row.get('measurement') or {}).get('sampleCount', 0),
                     'reasonCode': row.get('reasonCode'), 'targetValue': row.get('targetValue')}
                    for row in evaluation['criteria']]}
    diagnostics['processingSeconds'] = round(perf_counter() - started, 4)
    return result


@app.get('/standards')
def standards(x_ai_service_key: str = Header(default='')):
    if not os.environ.get('AI_SERVICE_KEY') or x_ai_service_key != os.environ['AI_SERVICE_KEY']:
        raise HTTPException(403, 'Forbidden')
    return {'standards': list_standards()}


@app.get('/standards/{exercise_type}')
def standard_detail(exercise_type: str, x_ai_service_key: str = Header(default='')):
    if not os.environ.get('AI_SERVICE_KEY') or x_ai_service_key != os.environ['AI_SERVICE_KEY']:
        raise HTTPException(403, 'Forbidden')
    try:
        return load_standard(exercise_type)
    except ValueError:
        raise HTTPException(404, 'Unknown reference standard')


@app.get('/standards/{exercise_type}/candidate-policies')
def standard_candidate_policies(exercise_type: str, x_ai_service_key: str = Header(default='')):
    from criterion_evaluation import default_candidate_policy
    if not os.environ.get('AI_SERVICE_KEY') or x_ai_service_key != os.environ['AI_SERVICE_KEY']:
        raise HTTPException(403, 'Forbidden')
    try:
        standard = load_standard(exercise_type)
    except ValueError:
        raise HTTPException(404, 'Unknown reference standard')
    return {
        'exerciseId': standard['exerciseId'],
        'exerciseVariant': standard['exerciseVariant'],
        'standardVersion': standard['standardVersion'],
        'candidatePolicies': {
            criterion['criterionId']: default_candidate_policy(criterion['criterionId'])
            for criterion in standard['criteria']
        },
    }


@app.post('/standards/{exercise_type}/release/verify')
async def verify_criterion_release(exercise_type: str, payload: dict = Body(...),
                                   x_ai_service_key: str = Header(default='')):
    if not os.environ.get('AI_SERVICE_KEY') or x_ai_service_key != os.environ['AI_SERVICE_KEY']:
        raise HTTPException(403, 'Forbidden')
    try:
        candidate = await run_in_threadpool(prepare_release, exercise_type.upper(), payload)
    except (ValueError, KeyError, TypeError, OSError) as error:
        raise HTTPException(422, str(error)) from error
    return {'ready': True, 'criterionId': payload['criterionId'],
            'standardVersion': candidate['standardVersion']}


@app.post('/standards/{exercise_type}/release/commit')
async def commit_criterion_release(exercise_type: str, payload: dict = Body(...),
                                   x_ai_service_key: str = Header(default='')):
    if not os.environ.get('AI_SERVICE_KEY') or x_ai_service_key != os.environ['AI_SERVICE_KEY']:
        raise HTTPException(403, 'Forbidden')
    try:
        return await run_in_threadpool(commit_release, exercise_type.upper(), payload)
    except (ValueError, KeyError, TypeError, OSError) as error:
        raise HTTPException(422, str(error)) from error


@app.post("/analyze/{exercise_type}")
async def analyze_exercise(exercise_type: str, file: UploadFile = File(...), x_ai_service_key: str = Header(default=""), options: str = Form(default="{}"), exercise_variant: str = Form(default='UNSPECIFIED'), evaluation_mode: str = Form(default='OFFICIAL')):
    required_key = os.environ.get("AI_SERVICE_KEY")
    if not required_key or x_ai_service_key != required_key:
        raise HTTPException(403, "Forbidden")
    if exercise_type.upper() not in EXERCISES:
        raise HTTPException(400, "Unsupported exercise")
    if exercise_variant not in ('UNSPECIFIED', 'BODYWEIGHT', 'WEIGHTED', 'STANDARD', 'FRONT', 'FORWARD_BODYWEIGHT', 'DUMBBELL_STANDING', 'DUMBBELL_SEATED'):
        raise HTTPException(400, 'Unsupported exercise variant')
    if evaluation_mode not in ('OFFICIAL', 'EXPERIMENTAL'):
        raise HTTPException(400, 'Unsupported evaluation mode')
    if evaluation_mode == 'EXPERIMENTAL' and os.environ.get('EXPERIMENTAL_EVALUATION_ENABLED') != 'true':
        raise HTTPException(403, 'Experimental evaluation is disabled')
    try:
        protocol = parse_protocol(json.loads(options))
    except (ValueError, TypeError):
        raise HTTPException(400, "Invalid analysis options")
    data = await file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "Video too large")
    if not (data[4:8] == b"ftyp" or data[:4] == bytes.fromhex("1a45dfa3")):
        raise HTTPException(400, "Invalid video container")
    with tempfile.NamedTemporaryFile(suffix=".video", delete=False) as temp:
        temp.write(data)
        video_path = temp.name
    try:
        return await run_in_threadpool(analyze_video, video_path, protocol, exercise_type, exercise_variant, evaluation_mode)
    finally:
        os.unlink(video_path)
