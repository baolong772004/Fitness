"""Versioned technique evaluation, independently gated from pose measurements.

Reference documents describe coaching intent. Only server-owned policies with
expert review and hash-bound independent video validation can emit definitive
criterion decisions. The bundled standards remain draft/experimental.
"""
from copy import deepcopy

from criterion_evaluation import compare_measurement, corrective_feedback, released_policy
from exercise_catalog import EXERCISES
from measurement_engine import MIN_SAMPLES, measure_projected_joints
from squat_measurements import extract_squat_measurements
from standard_registry import load_standard, standard_digest

ENGINE_VERSION = 'technique-evaluation-3'
EXPERIMENTAL_RULE_VERSION = 'technique-experimental-4'
PROVISIONAL_RULE_VERSION = 'technique-provisional-2'
DECISIVE = ('MEETS_CRITERION', 'NEEDS_IMPROVEMENT')
REASONS = {
    'NOT_COACH_VALIDATED': 'Đã có số đo thử nghiệm; tiêu chí chưa được Coach phê duyệt và kiểm chứng bằng video gắn nhãn.',
    'VARIANT_NOT_SPECIFIED': 'Chưa xác định biến thể bài tập để áp dụng tiêu chuẩn tham chiếu.',
    'VARIANT_NOT_SUPPORTED': 'Biến thể đã chọn chưa có tiêu chuẩn được triển khai cho tiêu chí này.',
    'CAMERA_VIEW_NOT_VERIFIED': 'Chưa xác nhận được góc camera phù hợp cho tiêu chí này.',
    'VIEW_NOT_SUITABLE': 'Cần góc camera khác để đối chiếu tiêu chí này.',
    'GOAL_NOT_SET': 'Đã lưu số đo thực tế; chưa có mục tiêu riêng phù hợp để đối chiếu.',
    'TARGET_PROVENANCE_REQUIRED': 'Mục tiêu cần có nguồn cấu hình và biến thể cụ thể trước khi dùng để kết luận.',
    'NO_COMPLETE_REPETITION': 'Chưa có rep hoàn chỉnh đủ dữ liệu để phân tích tiêu chí này.',
    'REP_DETECTION_NOT_IMPLEMENTED': 'Bài này hiện đo khớp thử nghiệm; bộ tách rep chưa được triển khai và kiểm chứng.',
    'HOLD_SEGMENTATION_NOT_IMPLEMENTED': 'Đã đo khớp trên ảnh; chưa xác định đoạn giữ Plank đủ điều kiện để kết luận.',
    'MISSING_LANDMARKS': 'Thiếu landmarks đủ rõ để đo tiêu chí này.',
    'MISSING_LANDMARK_EVIDENCE': 'Số đo chưa có đủ bằng chứng tọa độ khớp để đưa ra kết luận.',
    'TRACKING_OR_REFERENCE_UNVERIFIED': 'Số đo vẫn được lưu; theo dõi hoặc mốc tham chiếu chưa đủ ổn định để kết luận.',
    'FOOT_ANCHOR_DRIFT_UNVERIFIED': 'Cổ chân dịch chuyển trên ảnh vượt ngưỡng ổn định thử nghiệm; chưa tách được di chuyển chân và camera.',
    'FOOT_REFERENCE_SCALE_UNVERIFIED': 'Chiều dài gót–mũi chân trên ảnh thay đổi; chưa xác nhận được mốc không gian ổn định.',
    'INSUFFICIENT_REP_TRACKING': 'Đoạn mất dấu hoặc độ phủ khớp trong rep chưa đủ để đối chiếu tiêu chí.',
    'SINGLE_REP_NO_TEMPO_BASELINE': 'Cần từ 2 rep trở lên để đối chiếu độ ổn định nhịp giữa các lần lặp.',
    'NOT_SUPPORTED': 'Chưa có phương pháp đánh giá tiêu chí này đủ tin cậy trong phạm vi video hiện tại.',
}


def _body_part(criterion):
    return criterion.get('bodyPart') or {
        'SQUAT-01': 'WHOLE_BODY', 'SQUAT-02': 'HIP', 'SQUAT-03': 'KNEE',
        'SQUAT-04': 'TORSO', 'SQUAT-05': 'WHOLE_BODY', 'SQUAT-06': 'WHOLE_BODY',
        'SQUAT-07': 'FEET', 'SQUAT-08': 'WHOLE_BODY',
    }.get(criterion['criterionId'], 'JOINTS')


def _has_measurement(measurement):
    return bool(measurement and (measurement.get('perRep') or measurement.get('range')))


def _generic_measurements(exercise, standard, frames, width, height):
    definitions = {item['code']: item for item in EXERCISES[exercise]['criteria']}
    result = {}
    for criterion in standard['criteria']:
        sources = []
        missing = 'MEASUREMENT_NOT_IMPLEMENTED'
        for code in criterion.get('sourceCriterionCodes', []):
            definition = definitions.get(code)
            if not definition or definition['source'] == 'squat':
                continue
            measurement, reason = measure_projected_joints(frames, definition, width, height)
            if measurement:
                sources.append({'sourceCode': code, **measurement})
            else:
                missing = reason
        result[criterion['criterionId']] = ({**sources[0], 'sourceMeasurements': sources,
                                             'measurementScope': 'VIDEO_PROJECTION_WITHOUT_VALIDATED_SEGMENTATION'}
                                            if sources else {'reasonCode': missing})
    return result


def _target_context(protocol, individual_targets):
    values = {key: value for key, value in protocol.items()
              if key in ('depthTarget', 'descentTargetSeconds')}
    provenance = {}
    for key, configured in (individual_targets or {}).items():
        if isinstance(configured, dict) and 'value' in configured:
            values[key] = configured['value']
            provenance[key] = deepcopy(configured)
        else:
            values[key] = configured
    return values, provenance


def _iter_conditions(condition):
    if not isinstance(condition, dict):
        return
    yield condition
    for sub in condition.get('conditions') or []:
        yield from _iter_conditions(sub)


def _target_provenance(policy, values, provenance, variant):
    for condition in _iter_conditions((policy or {}).get('passCondition')):
        if condition.get('kind') != 'TARGET_TOLERANCE':
            continue
        key = condition.get('targetKey')
        if values.get(key) in (None, 'NONE'):
            return 'GOAL_NOT_SET'
        source = provenance.get(key) or {}
        if source.get('exerciseVariant') != variant or not all(source.get(field) for field in ('units', 'source', 'configuredBy', 'configuredAt')):
            return 'TARGET_PROVENANCE_REQUIRED'
    return None


def _feedback(standard, criterion, row, target, status):
    content = deepcopy(criterion)
    content['bodyPart'] = _body_part(criterion)
    advice = content.get('correctionAdvice') or {}
    if isinstance(advice, dict):
        advice['adjustments'] = advice.get('adjustments') or advice.get('suggestions', [])
        advice['coachReview'] = advice.get('coachReview') or advice.get('coachReviewWhen')
    content['correctionAdvice'] = advice
    source_ids = criterion.get('referenceSourceIds', [])
    content['referenceSources'] = [source for source in standard['referenceSources'] if source['sourceId'] in source_ids]
    return corrective_feedback(content, row, target, status)


def _row_verdict(standard, criterion, row, base_blocker, policy, targets, target_provenance, variant):
    status, target = 'MEASURED', row.get('targetValue')
    blocker = base_blocker
    quality = row.get('measurementQuality') or {}
    if blocker is None and not quality.get('sufficientForExperimentalComparison'):
        blocker = quality.get('reasonCode') or 'TRACKING_OR_REFERENCE_UNVERIFIED'
    if blocker is None and not row.get('landmarkEvidence'):
        blocker = 'MISSING_LANDMARK_EVIDENCE'
    if blocker is None:
        blocker = _target_provenance(policy, targets, target_provenance, variant)
    if blocker is None:
        status, target, blocker = compare_measurement(row.get('observedValue') or {}, targets, policy)
        status = status or 'MEASURED'
    feedback = _feedback(standard, criterion, row, target, status) if status in DECISIVE else None
    return {**deepcopy(row), 'criterionId': criterion['criterionId'], 'exerciseId': standard['exerciseId'],
            'status': status, 'resultStatus': status, 'targetValue': target,
            'reasonCode': blocker, 'reason': REASONS.get(blocker, blocker),
            'feedback': feedback, 'referenceStandardVersion': standard['standardVersion']}


def evaluate_technique(exercise, frames, movement, width, height, plan_context=None,
                       variant='UNSPECIFIED', individual_targets=None):
    """Measure first; compare only an exact variant and released criterion.

    ``plan_context`` is display context only. Approval is loaded from the
    server registry; no client approval flags or free-text notes activate it.
    """
    if exercise not in EXERCISES:
        raise ValueError('Unsupported exercise')
    standard = load_standard(exercise)
    spec = EXERCISES[exercise]
    camera = movement.get('cameraView', {}).get('detected', 'UNKNOWN')
    protocol = movement.get('protocol') or {}
    targets, provenance = _target_context(protocol, individual_targets)
    measurements = (extract_squat_measurements(frames, movement, width, height) if exercise == 'SQUAT'
                    else _generic_measurements(exercise, standard, frames, width, height))
    rows = []
    for criterion in standard['criteria']:
        identity = criterion['criterionId']
        raw = measurements.get(identity) or {}
        measurement = deepcopy(raw) if _has_measurement(raw) else None
        policy, policy_blocker = released_policy(standard, criterion)
        unsupported = (criterion['type'] == 'D' or raw.get('evaluationSupported') is False
                       or criterion.get('evaluationPolicy', {}).get('status') == 'NOT_SUPPORTED')
        if unsupported:
            blocker = 'NOT_SUPPORTED'
        elif measurement is None:
            blocker = raw.get('reasonCode') or 'MISSING_LANDMARKS'
        elif variant == 'UNSPECIFIED' or not variant:
            blocker = 'VARIANT_NOT_SPECIFIED'
        elif variant != standard['exerciseVariant'] or variant not in criterion['applicableExerciseVariants']:
            blocker = 'VARIANT_NOT_SUPPORTED'
        elif 'ANY_TRACKED' not in criterion['requiredCameraAngles'] and camera not in criterion['requiredCameraAngles']:
            blocker = 'CAMERA_VIEW_NOT_VERIFIED' if camera == 'UNKNOWN' else 'VIEW_NOT_SUITABLE'
        elif exercise != 'SQUAT':
            blocker = 'HOLD_SEGMENTATION_NOT_IMPLEMENTED' if spec['phase'] == 'HOLD' else 'REP_DETECTION_NOT_IMPLEMENTED'
        else:
            blocker = policy_blocker
        if blocker is None and policy:
            scope = policy.get('validationReport', {}).get('scope') or {}
            if (scope.get('exerciseVariant') != variant or camera not in scope.get('cameraViews', [])
                    or scope.get('modelVersion') != movement.get('modelVersion')
                    or scope.get('ruleVersion') != movement.get('ruleVersion')):
                blocker = 'VALIDATION_SCOPE_MISMATCH'
        per_rep = measurement.get('perRep', []) if measurement else []
        verdicts = [_row_verdict(standard, criterion, row, blocker, policy,
                                 targets, provenance, variant) for row in per_rep] if not unsupported else []
        assessed = [row for row in verdicts if row['resultStatus'] in DECISIVE]
        if unsupported:
            status = 'NOT_SUPPORTED'
        elif any(row['resultStatus'] == 'NEEDS_IMPROVEMENT' for row in assessed):
            status = 'NEEDS_IMPROVEMENT'
        elif assessed and len(assessed) == len(verdicts):
            status = 'MEETS_CRITERION'
        else:
            status = 'MEASURED' if measurement else 'UNABLE_TO_ASSESS'
        if assessed and status in DECISIVE:
            blocker = None
        elif blocker is None and verdicts:
            blocker = next((row['reasonCode'] for row in verdicts if row['reasonCode']), None)
        advice = criterion.get('correctionAdvice') or {}
        suggestions = advice.get('suggestions', advice.get('adjustments', [])) if isinstance(advice, dict) else [advice]
        rows.append({'code': identity, 'criterionId': identity, 'exerciseId': exercise,
                     'sourceCodes': criterion.get('sourceCriterionCodes', []),
                     'title': criterion['criterionName'], 'description': criterion['description'],
                     'joints': criterion['requiredLandmarks'], 'cameraViews': criterion['requiredCameraAngles'],
                     'bodyPart': _body_part(criterion), 'type': criterion['type'],
                     'status': status, 'resultStatus': status, 'reasonCode': blocker,
                     'reason': REASONS.get(blocker, blocker), 'measurement': measurement,
                     'verdicts': verdicts, 'assessedReps': len(assessed), 'totalReps': len(per_rep),
                     'validFrames': raw.get('sampleCount', 0),
                     'targetValue': {key: value for key, value in targets.items() if value is not None and value != 'NONE'},
                     'targetProvenance': provenance,
                     'approval': deepcopy(policy.get('approvedByCoach')) if policy else None,
                     'validation': 'APPROVED_AND_VIDEO_VALIDATED' if policy else 'EXPERIMENTAL_NOT_COACH_VALIDATED',
                     'referenceStandardVersion': standard['standardVersion'],
                     'improvement': ' '.join(suggestions), 'correctionAdvice': advice,
                     'limitations': criterion['limitations'] + raw.get('limitations', []),
                     'referenceSources': [source for source in standard['referenceSources']
                                          if source['sourceId'] in criterion.get('referenceSourceIds', [])]})
    passed = sum(row['status'] == 'MEETS_CRITERION' for row in rows)
    improved = sum(row['status'] == 'NEEDS_IMPROVEMENT' for row in rows)
    measured = sum(row['measurement'] is not None for row in rows)
    overall = 'NEEDS_IMPROVEMENT' if improved else 'MEETS_CRITERION' if passed else 'MEASURED' if measured else 'UNABLE_TO_ASSESS'
    headline = ('Có tiêu chí cần cải thiện' if improved else 'Đạt các tiêu chí đã kiểm tra' if passed
                else 'Chưa đủ điều kiện đánh giá')
    return {'engineVersion': ENGINE_VERSION, 'exercise': exercise, 'exerciseId': exercise,
            'exerciseVariant': variant or 'UNSPECIFIED', 'referenceVariant': standard['exerciseVariant'],
            'phase': spec['phase'], 'status': overall, 'resultStatus': overall, 'headline': headline,
            'passedCriteria': passed, 'needsImprovementCriteria': improved, 'measuredCriteria': measured,
            'unassessedCriteria': sum(row['status'] not in DECISIVE for row in rows),
            'criteria': rows, 'planContext': plan_context, 'individualTrainingTargets': provenance,
            'referenceStandardVersion': standard['standardVersion'], 'referenceStandardDigest': standard_digest(standard),
            'standardSnapshot': deepcopy(standard),
            'implementationStatus': 'PARTIAL' if passed or improved else 'EXPERIMENTAL',
            'limitations': ['Chỉ kết luận cho tiêu chí, biến thể và góc quay có phạm vi kiểm chứng phù hợp; số đo 2D không xác nhận toàn bộ kỹ thuật hoặc an toàn.']}


def measured_pose_result(exercise, frames, requested_view):
    """Other analyzers currently expose measurements; segmentation is disabled."""
    status = 'COMPLETED' if len(frames) >= MIN_SAMPLES else 'INSUFFICIENT_DATA'
    phase = EXERCISES[exercise]['phase']
    return {'exercise': exercise, 'status': status,
            'quality': 'MEASUREMENT_ONLY' if status == 'COMPLETED' else 'INSUFFICIENT',
            'detectedRepetitions': None, 'repetitions': [], 'observations': [], 'criteria': [],
            'segmentationStatus': 'NOT_IMPLEMENTED',
            'segmentationMode': 'TIME_BASED_HOLD' if phase == 'HOLD' else 'REPETITIONS',
            'cameraView': {'requested': requested_view, 'detected': 'UNKNOWN', 'validated': False},
            'limitations': ['Bài này hiện chỉ có phép đo hình chiếu thử nghiệm; chưa có bộ phân đoạn và tiêu chí kỹ thuật được kiểm chứng.'],
            'ruleVersion': ENGINE_VERSION,
            'analysisCoverage': 'VALID_SEGMENTS_ONLY' if status == 'COMPLETED' else 'NONE'}


def _experimental_evaluation(evaluation, movement):
    """Return explicitly unvalidated developer predictions, never official verdicts.

    Assessable Squat criteria (SQUAT-01, SQUAT-02, SQUAT-03, SQUAT-04,
    SQUAT-05, SQUAT-08) evaluate per-rep measurements when camera view,
    quality gates, and required targets are satisfied. SQUAT-06 and SQUAT-07
    abstain because 2D monocular projection without floor calibration cannot
    reliably diagnose bilateral asymmetry or floor contact.
    """
    cfg_values = ((movement.get('thresholdConfig') or {}).get('values') or {})
    min_rep_seconds = cfg_values.get('minimum_rep_seconds', 0.6)
    threshold = cfg_values.get('knee_inward_ratio', 0.10)
    torso_increase_degrees = cfg_values.get('torso_increase_degrees', 12.0)
    hip_shoulder_rise_ratio = cfg_values.get('hip_shoulder_rise_ratio', 0.12)
    tempo_tolerance_seconds = cfg_values.get('tempo_tolerance_seconds', 0.30)
    protocol = movement.get('protocol') or {}
    depth_target = protocol.get('depthTarget')
    descent_target = protocol.get('descentTargetSeconds')
    criteria = []
    for criterion in evaluation['criteria']:
        code = criterion['criterionId']
        rows = (criterion.get('measurement') or {}).get('perRep') or []
        camera = movement.get('cameraView', {}).get('detected', 'UNKNOWN')
        variant = evaluation.get('exerciseVariant')
        reason = None
        if code == 'SQUAT-01' and movement.get('status') == 'COMPLETED' and rows and camera in ('SIDE', 'FRONT', 'OBLIQUE') and variant == 'BODYWEIGHT':
            predictions = []
            for row in rows:
                obs = row.get('observedValue') or {}
                total = obs.get('totalSeconds')
                descent = obs.get('descentSeconds')
                ascent = obs.get('ascentSeconds')
                completed = obs.get('completedCycleObserved') is True
                if not isinstance(total, (int, float)) or not row.get('landmarkEvidence'):
                    status = 'UNABLE_TO_ASSESS'
                    reason = 'MISSING_CYCLE_TIMING_OR_EVIDENCE'
                elif not (row.get('measurementQuality') or {}).get('sufficientForExperimentalComparison'):
                    status = 'UNABLE_TO_ASSESS'
                    reason = (row.get('measurementQuality') or {}).get('reasonCode') or 'INSUFFICIENT_MEASUREMENT_QUALITY'
                else:
                    meets = (completed and min_rep_seconds <= total <= 15.0
                             and isinstance(descent, (int, float)) and descent >= 0.2
                             and isinstance(ascent, (int, float)) and ascent >= 0.2)
                    status = 'MEETS_CRITERION' if meets else 'NEEDS_IMPROVEMENT'
                    reason = 'PROVISIONAL_COMPLETE_CYCLE_TIMING'
                predictions.append({
                    'criterionId': code, 'status': status, 'resultStatus': status,
                    'unvalidated': True, 'bodyPart': 'WHOLE_BODY',
                    'repNumber': row.get('repNumber'), 'timestampSeconds': row.get('timestampSeconds'),
                    'observedValue': total, 'units': 'seconds',
                    'threshold': {'minimum': min_rep_seconds, 'maximum': 15.0,
                                  'source': 'SQUAT_CONFIG.minimum_rep_seconds',
                                  'validation': 'PROVISIONAL_NOT_COACH_VALIDATED'},
                    'reasonCode': reason,
                    'feedback': ('Thực hiện trọn vẹn pha hạ xuống, điểm đáy và đứng thẳng lên với tốc độ kiểm soát.'
                                 if status == 'NEEDS_IMPROVEMENT' else
                                 'Chu kỳ hạ xuống và đứng lên hoàn chỉnh với tracking liên tục.'
                                 if status == 'MEETS_CRITERION' else
                                 'Số đo chu kỳ chỉ để xem lại; dữ liệu theo dõi khớp chưa liên tục trong suốt rep.'),
                    'landmarkEvidence': row.get('landmarkEvidence', []),
                    'measurementQuality': row.get('measurementQuality'),
                })
            statuses = [row['status'] for row in predictions]
            status = ('NEEDS_IMPROVEMENT' if 'NEEDS_IMPROVEMENT' in statuses else
                      'MEETS_CRITERION' if statuses and all(item == 'MEETS_CRITERION' for item in statuses) else
                      'UNABLE_TO_ASSESS')
        elif code == 'SQUAT-02' and movement.get('status') == 'COMPLETED' and rows and camera == 'SIDE' and variant == 'BODYWEIGHT' and depth_target == 'HIP_AT_KNEE':
            predictions = []
            for row in rows:
                value = (row.get('observedValue') or {}).get('hipAboveKneeRatio')
                if not isinstance(value, (int, float)) or not row.get('landmarkEvidence'):
                    status = 'UNABLE_TO_ASSESS'
                    reason = 'MISSING_HIP_KNEE_MEASUREMENT_OR_EVIDENCE'
                elif not (row.get('measurementQuality') or {}).get('sufficientForExperimentalComparison'):
                    status = 'UNABLE_TO_ASSESS'
                    reason = (row.get('measurementQuality') or {}).get('reasonCode') or 'INSUFFICIENT_MEASUREMENT_QUALITY'
                else:
                    # The zero boundary follows directly from the selected
                    # projected hip-at-knee target, not a population norm.
                    status = 'MEETS_CRITERION' if value <= 0 else 'NEEDS_IMPROVEMENT'
                    reason = 'EXPLICIT_PROJECTED_DEPTH_TARGET'
                predictions.append({
                    'criterionId': code, 'status': status, 'resultStatus': status,
                    'unvalidated': True, 'bodyPart': 'HIP',
                    'repNumber': row.get('repNumber'), 'timestampSeconds': row.get('timestampSeconds'),
                    'observedValue': value, 'units': 'projected_femur_length',
                    'threshold': {'maximum': 0.0, 'source': 'REQUEST_PROTOCOL.depthTarget=HIP_AT_KNEE',
                                  'validation': 'PROVISIONAL_NOT_COACH_VALIDATED'},
                    'reasonCode': reason,
                    'feedback': ('Trên ảnh quay ngang, hông còn cao hơn gối ở đáy rep; thử xuống tới mục tiêu đã chọn và nhờ Coach kiểm tra độ sâu thực tế.'
                                 if status == 'NEEDS_IMPROVEMENT' else
                                 'Hình chiếu hông ở ngang hoặc thấp hơn gối theo mục tiêu đã chọn; cần Coach xác nhận độ sâu thực tế.'
                                 if status == 'MEETS_CRITERION' else
                                 'Số đo độ sâu chỉ để xem lại; mốc tham chiếu hoặc tracking chưa đủ ổn định để dự đoán.'),
                    'landmarkEvidence': row.get('landmarkEvidence', []),
                    'measurementQuality': row.get('measurementQuality'),
                })
            statuses = [row['status'] for row in predictions]
            status = ('NEEDS_IMPROVEMENT' if 'NEEDS_IMPROVEMENT' in statuses else
                      'MEETS_CRITERION' if statuses and all(item == 'MEETS_CRITERION' for item in statuses) else
                      'UNABLE_TO_ASSESS')
        elif code == 'SQUAT-03' and movement.get('status') == 'COMPLETED' and rows and camera == 'FRONT' and variant == 'BODYWEIGHT':
            predictions = []
            for row in rows:
                value = (row.get('observedValue') or {}).get('inwardChangeStanceRatio')
                if not isinstance(value, (int, float)) or not row.get('landmarkEvidence'):
                    status = 'UNABLE_TO_ASSESS'
                    reason = 'MISSING_KNEE_MEASUREMENT_OR_EVIDENCE'
                elif not (row.get('measurementQuality') or {}).get('sufficientForExperimentalComparison'):
                    status = 'UNABLE_TO_ASSESS'
                    reason = (row.get('measurementQuality') or {}).get('reasonCode') or 'INSUFFICIENT_MEASUREMENT_QUALITY'
                else:
                    status = 'MEETS_CRITERION' if value <= threshold else 'NEEDS_IMPROVEMENT'
                    reason = 'PROVISIONAL_KNEE_INWARD_THRESHOLD'
                predictions.append({
                    'criterionId': code,
                    'status': status,
                    'resultStatus': status,
                    'unvalidated': True,
                    'bodyPart': 'LEFT_KNEE' if row.get('side') == 'LEFT' else 'RIGHT_KNEE',
                    'repNumber': row.get('repNumber'),
                    'timestampSeconds': row.get('timestampSeconds'),
                    'observedValue': value,
                    'units': 'stance_width_ratio',
                    'threshold': {'maximum': threshold, 'source': 'SQUAT_CONFIG.knee_inward_ratio',
                                  'validation': 'PROVISIONAL_NOT_COACH_VALIDATED'},
                    'reasonCode': reason,
                    'feedback': ('Giữ gối đi theo hướng các ngón chân; kiểm tra lại từ góc chính diện.'
                                 if status == 'NEEDS_IMPROVEMENT' else
                                 'Số đo dịch chuyển vào giữa nằm dưới ngưỡng thử nghiệm; điều này chưa chứng minh toàn bộ kỹ thuật đạt.'),
                    'landmarkEvidence': row.get('landmarkEvidence', []),
                    'measurementQuality': row.get('measurementQuality'),
                })
            statuses = [row['status'] for row in predictions]
            status = ('NEEDS_IMPROVEMENT' if 'NEEDS_IMPROVEMENT' in statuses else
                      'MEETS_CRITERION' if statuses and all(item == 'MEETS_CRITERION' for item in statuses) else
                      'UNABLE_TO_ASSESS')
        elif code == 'SQUAT-04' and movement.get('status') == 'COMPLETED' and rows and camera == 'SIDE' and variant == 'BODYWEIGHT':
            predictions = []
            for row in rows:
                obs = row.get('observedValue') or {}
                lean_change = obs.get('earlyAscentLeanChangeDegrees')
                hip_shoulder_diff = obs.get('hipShoulderRiseDifferenceRatio')
                if not isinstance(lean_change, (int, float)) or not isinstance(hip_shoulder_diff, (int, float)) or not row.get('landmarkEvidence'):
                    status = 'UNABLE_TO_ASSESS'
                    reason = 'MISSING_TORSO_ASCENT_MEASUREMENT_OR_EVIDENCE'
                elif not (row.get('measurementQuality') or {}).get('sufficientForExperimentalComparison'):
                    status = 'UNABLE_TO_ASSESS'
                    reason = (row.get('measurementQuality') or {}).get('reasonCode') or 'INSUFFICIENT_MEASUREMENT_QUALITY'
                else:
                    needs_imp = lean_change >= torso_increase_degrees and hip_shoulder_diff >= hip_shoulder_rise_ratio
                    status = 'NEEDS_IMPROVEMENT' if needs_imp else 'MEETS_CRITERION'
                    reason = 'PROVISIONAL_TORSO_ASCENT_COORDINATION'
                predictions.append({
                    'criterionId': code, 'status': status, 'resultStatus': status,
                    'unvalidated': True, 'bodyPart': 'TORSO',
                    'repNumber': row.get('repNumber'), 'timestampSeconds': row.get('timestampSeconds'),
                    'observedValue': lean_change, 'units': 'degrees',
                    'threshold': {'maximum': torso_increase_degrees, 'hipShoulderRiseMaximum': hip_shoulder_rise_ratio,
                                  'source': 'SQUAT_CONFIG.torso_increase_degrees+hip_shoulder_rise_ratio',
                                  'validation': 'PROVISIONAL_NOT_COACH_VALIDATED'},
                    'reasonCode': reason,
                    'feedback': ('Ở đầu pha đứng lên, hông nhổm lên nhanh hơn vai làm thân gập thêm về trước; giữ ngực mở và đẩy hông cùng vai lên đồng thời.'
                                 if status == 'NEEDS_IMPROVEMENT' else
                                 'Độ nghiêng thân trên và phối hợp hông-vai đầu pha đứng lên nằm trong ngưỡng thử nghiệm.'
                                 if status == 'MEETS_CRITERION' else
                                 'Số đo thân trên chỉ để xem lại; thiếu khung hình đầu pha lên hoặc mốc tham chiếu chưa ổn định.'),
                    'landmarkEvidence': row.get('landmarkEvidence', []),
                    'measurementQuality': row.get('measurementQuality'),
                })
            statuses = [row['status'] for row in predictions]
            status = ('NEEDS_IMPROVEMENT' if 'NEEDS_IMPROVEMENT' in statuses else
                      'MEETS_CRITERION' if statuses and all(item == 'MEETS_CRITERION' for item in statuses) else
                      'UNABLE_TO_ASSESS')
        elif code == 'SQUAT-05' and movement.get('status') == 'COMPLETED' and len(rows) >= 2 and camera in ('SIDE', 'FRONT', 'OBLIQUE') and variant == 'BODYWEIGHT':
            predictions = []
            for row in rows:
                obs = row.get('observedValue') or {}
                descent_diff = obs.get('descentDifferenceFromClipMedianSeconds')
                ascent_diff = obs.get('ascentDifferenceFromClipMedianSeconds')
                descent = obs.get('descentSeconds')
                ascent = obs.get('ascentSeconds')
                if not isinstance(descent_diff, (int, float)) or not isinstance(ascent_diff, (int, float)) or not row.get('landmarkEvidence'):
                    status = 'UNABLE_TO_ASSESS'
                    reason = 'SINGLE_REP_NO_TEMPO_BASELINE'
                elif not (row.get('measurementQuality') or {}).get('sufficientForExperimentalComparison'):
                    status = 'UNABLE_TO_ASSESS'
                    reason = (row.get('measurementQuality') or {}).get('reasonCode') or 'INSUFFICIENT_MEASUREMENT_QUALITY'
                else:
                    max_dev = round(max(abs(descent_diff), abs(ascent_diff)), 4)
                    controlled = max_dev <= tempo_tolerance_seconds and (descent or 0) >= 0.25 and (ascent or 0) >= 0.25
                    status = 'MEETS_CRITERION' if controlled else 'NEEDS_IMPROVEMENT'
                    reason = 'PROVISIONAL_TEMPO_CONSISTENCY_THRESHOLD'
                max_dev_val = (round(max(abs(descent_diff), abs(ascent_diff)), 4)
                               if isinstance(descent_diff, (int, float)) and isinstance(ascent_diff, (int, float)) else None)
                predictions.append({
                    'criterionId': code, 'status': status, 'resultStatus': status,
                    'unvalidated': True, 'bodyPart': 'WHOLE_BODY',
                    'repNumber': row.get('repNumber'), 'timestampSeconds': row.get('timestampSeconds'),
                    'observedValue': max_dev_val, 'units': 'seconds',
                    'threshold': {'maximum': tempo_tolerance_seconds, 'source': 'SQUAT_CONFIG.tempo_tolerance_seconds',
                                  'validation': 'PROVISIONAL_NOT_COACH_VALIDATED'},
                    'reasonCode': reason,
                    'feedback': ('Nhịp hạ xuống hoặc đứng lên ở rep này lệch nhiều so với trung vị của hiệp tập; hãy giữ tốc độ đều giữa các rep.'
                                 if status == 'NEEDS_IMPROVEMENT' else
                                 'Nhịp hạ xuống và đứng lên ổn định giữa các rep trong ngưỡng thử nghiệm.'
                                 if status == 'MEETS_CRITERION' else
                                 'Số đo nhịp chỉ để xem lại; chưa đủ dữ liệu liên tục để đối chiếu nhịp.'),
                    'landmarkEvidence': row.get('landmarkEvidence', []),
                    'measurementQuality': row.get('measurementQuality'),
                })
            statuses = [row['status'] for row in predictions]
            status = ('NEEDS_IMPROVEMENT' if 'NEEDS_IMPROVEMENT' in statuses else
                      'MEETS_CRITERION' if statuses and all(item == 'MEETS_CRITERION' for item in statuses) else
                      'UNABLE_TO_ASSESS')
        elif (code == 'SQUAT-08' and movement.get('status') == 'COMPLETED' and rows and variant == 'BODYWEIGHT'
              and ((descent_target is not None and camera in ('SIDE', 'FRONT'))
                   or (depth_target == 'HIP_AT_KNEE' and camera == 'SIDE'))):
            predictions = []
            for row in rows:
                obs = row.get('observedValue') or {}
                descent = obs.get('descentSeconds')
                depth_val = obs.get('hipAboveKneeRatio')
                has_tempo = descent_target is not None
                has_depth = depth_target == 'HIP_AT_KNEE' and camera == 'SIDE'
                if (has_tempo and not isinstance(descent, (int, float))) or (has_depth and not isinstance(depth_val, (int, float))) or not row.get('landmarkEvidence'):
                    status = 'UNABLE_TO_ASSESS'
                    reason = 'MISSING_TARGET_MEASUREMENT_OR_EVIDENCE'
                elif not (row.get('measurementQuality') or {}).get('sufficientForExperimentalComparison'):
                    status = 'UNABLE_TO_ASSESS'
                    reason = (row.get('measurementQuality') or {}).get('reasonCode') or 'INSUFFICIENT_MEASUREMENT_QUALITY'
                else:
                    tempo_ok = abs(descent - descent_target) <= tempo_tolerance_seconds if has_tempo else True
                    depth_ok = depth_val <= 0.0 if has_depth else True
                    status = 'MEETS_CRITERION' if (tempo_ok and depth_ok) else 'NEEDS_IMPROVEMENT'
                    reason = 'EXPLICIT_INDIVIDUAL_TRAINING_TARGET'
                observed_display = descent if has_tempo else depth_val
                units_display = 'seconds' if has_tempo else 'projected_femur_length'
                threshold_display = ({'minimum': round(max(0.0, descent_target - tempo_tolerance_seconds), 4),
                                      'maximum': round(descent_target + tempo_tolerance_seconds, 4),
                                      'target': descent_target, 'tolerance': tempo_tolerance_seconds,
                                      'source': 'REQUEST_PROTOCOL.descentTargetSeconds',
                                      'validation': 'PROVISIONAL_NOT_COACH_VALIDATED'}
                                     if has_tempo else
                                     {'maximum': 0.0, 'source': 'REQUEST_PROTOCOL.depthTarget=HIP_AT_KNEE',
                                      'validation': 'PROVISIONAL_NOT_COACH_VALIDATED'})
                predictions.append({
                    'criterionId': code, 'status': status, 'resultStatus': status,
                    'unvalidated': True, 'bodyPart': 'WHOLE_BODY',
                    'repNumber': row.get('repNumber'), 'timestampSeconds': row.get('timestampSeconds'),
                    'observedValue': observed_display, 'units': units_display,
                    'threshold': threshold_display,
                    'reasonCode': reason,
                    'feedback': ('Thời gian hạ người hoặc độ sâu ở rep này chưa khớp mục tiêu cá nhân đã chọn; điều chỉnh nhịp đếm và độ sâu theo hướng dẫn của Coach.'
                                 if status == 'NEEDS_IMPROVEMENT' else
                                 'Rep tập đạt mục tiêu cá nhân đã chọn trong phạm vi dung sai thử nghiệm.'
                                 if status == 'MEETS_CRITERION' else
                                 'Số đo mục tiêu cá nhân chỉ để xem lại; dữ liệu theo dõi chưa đủ ổn định.'),
                    'landmarkEvidence': row.get('landmarkEvidence', []),
                    'measurementQuality': row.get('measurementQuality'),
                })
            statuses = [row['status'] for row in predictions]
            status = ('NEEDS_IMPROVEMENT' if 'NEEDS_IMPROVEMENT' in statuses else
                      'MEETS_CRITERION' if statuses and all(item == 'MEETS_CRITERION' for item in statuses) else
                      'UNABLE_TO_ASSESS')
        else:
            if movement.get('status') != 'COMPLETED':
                reason = 'INPUT_QUALITY_INSUFFICIENT'
            elif evaluation.get('exercise') != 'SQUAT':
                reason = ('HOLD_SEGMENTATION_NOT_IMPLEMENTED' if evaluation.get('phase') == 'HOLD'
                          else 'REP_DETECTION_NOT_IMPLEMENTED')
            elif code in ('SQUAT-02', 'SQUAT-04') and camera != 'SIDE':
                reason = 'VIEW_NOT_SUITABLE'
            elif code in ('SQUAT-01', 'SQUAT-02', 'SQUAT-03', 'SQUAT-04', 'SQUAT-05', 'SQUAT-08') and variant != 'BODYWEIGHT':
                reason = 'VARIANT_NOT_SUPPORTED'
            elif code == 'SQUAT-02' and not criterion.get('measurement'):
                reason = criterion.get('reasonCode') or 'NO_MEASUREMENT'
            elif code == 'SQUAT-02' and depth_target != 'HIP_AT_KNEE':
                reason = 'NO_EXPLICIT_DEPTH_TARGET'
            elif code == 'SQUAT-03' and camera != 'FRONT':
                reason = 'VIEW_NOT_SUITABLE'
            elif code == 'SQUAT-05' and len(rows) == 1:
                reason = 'SINGLE_REP_NO_TEMPO_BASELINE'
            elif code == 'SQUAT-08' and camera not in ('SIDE', 'FRONT'):
                reason = 'VIEW_NOT_SUITABLE'
            elif code == 'SQUAT-08' and descent_target is None and depth_target == 'HIP_AT_KNEE' and camera != 'SIDE':
                reason = 'VIEW_NOT_SUITABLE'
            elif code == 'SQUAT-08' and descent_target is None and depth_target != 'HIP_AT_KNEE':
                reason = 'NO_INDIVIDUAL_TARGET'
            elif not criterion.get('measurement'):
                reason = criterion.get('reasonCode') or 'NO_MEASUREMENT'
            else:
                reason = {
                    'SQUAT-06': 'NO_VALIDATED_BILATERAL_DECISION_RULE',
                    'SQUAT-07': 'NO_FLOOR_CALIBRATION',
                    'SQUAT-08': 'NO_INDIVIDUAL_TARGET',
                }.get(code, 'NO_EXPERIMENTAL_DECISION_RULE')
            predictions = []
            status = 'UNABLE_TO_ASSESS'
        missing_requirements = ([reason] if not predictions else
                                list(dict.fromkeys(row['reasonCode'] for row in predictions
                                                   if row['status'] == 'UNABLE_TO_ASSESS' and row.get('reasonCode'))))
        if evaluation.get('exercise') != 'SQUAT' and movement.get('status') == 'COMPLETED':
            if camera == 'UNKNOWN':
                missing_requirements.append('CAMERA_VIEW_NOT_VERIFIED')
            missing_requirements.append('NO_EXPERIMENTAL_DECISION_RULE')
        criteria.append({'criterionId': code, 'title': criterion['title'],
                         'status': status, 'resultStatus': status,
                         'unvalidated': True, 'reasonCode': reason if not predictions else None,
                         'missingRequirements': missing_requirements,
                         'predictions': predictions,
                         'measurementAvailable': bool(criterion.get('measurement')),
                         'measurement': criterion.get('measurement'),
                         'bodyPart': criterion.get('bodyPart'),
                         'improvement': criterion.get('improvement'),
                         'limitation': 'Thử nghiệm phát triển, chưa được Coach phê duyệt hoặc kiểm chứng trên video gắn nhãn.'})
    return {'mode': 'EXPERIMENTAL', 'validation': 'UNVALIDATED',
            'warning': 'DỰ ĐOÁN THỬ NGHIỆM — CHƯA ĐƯỢC COACH PHÊ DUYỆT HOẶC KIỂM CHỨNG.',
            'ruleVersion': EXPERIMENTAL_RULE_VERSION,
            'standardVersion': evaluation['referenceStandardVersion'],
            'passedCriteria': sum(item['status'] == 'MEETS_CRITERION' for item in criteria),
            'needsImprovementCriteria': sum(item['status'] == 'NEEDS_IMPROVEMENT' for item in criteria),
            'unassessableCriteria': sum(item['status'] == 'UNABLE_TO_ASSESS' for item in criteria),
            'criteria': criteria}


def member_provisional_evaluation(evaluation, movement):
    """Expose evidence-gated candidate comparisons as unvalidated Member context.

    This is deliberately separate from official criterion counts and from the
    privileged Developer/Coach experimental response. No candidate result is
    promoted to an approved verdict here.
    """
    if evaluation.get('exercise') != 'SQUAT' or evaluation.get('exerciseVariant') != 'BODYWEIGHT':
        return None
    candidate = _experimental_evaluation(evaluation, movement)
    priority_order = {'SQUAT-03': 0, 'SQUAT-02': 1, 'SQUAT-04': 2,
                      'SQUAT-08': 3, 'SQUAT-05': 4, 'SQUAT-01': 5}
    corrections = []
    for criterion in sorted(candidate['criteria'], key=lambda item: priority_order.get(item['criterionId'], 99)):
        failed = [row for row in criterion['predictions'] if row['status'] == 'NEEDS_IMPROVEMENT']
        if not failed:
            continue
        first = min(failed, key=lambda row: (row.get('repNumber') or 0, row.get('timestampSeconds') or 0))
        corrections.append({
            'criterionId': criterion['criterionId'], 'title': criterion['title'],
            'bodyPart': first['bodyPart'], 'repNumber': first['repNumber'],
            'timestampSeconds': first['timestampSeconds'],
            'observedValue': first['observedValue'], 'units': first['units'],
            'threshold': first['threshold'], 'feedback': first['feedback'],
            'affectedReps': sorted({row['repNumber'] for row in failed if row.get('repNumber') is not None}),
            'evidenceFrames': len(first.get('landmarkEvidence') or []),
        })
    screening_status = ('NEEDS_IMPROVEMENT_DETECTED' if corrections else
                        'NO_ISSUE_DETECTED_IN_ASSESSED_SCOPE' if candidate['passedCriteria'] else
                        'UNABLE_TO_ASSESS')
    return {**candidate, 'mode': 'PROVISIONAL', 'ruleVersion': PROVISIONAL_RULE_VERSION,
            'warning': 'PHÂN TÍCH THAM KHẢO — CHƯA ĐƯỢC COACH KIỂM CHỨNG. Dự đoán theo từng tiêu chí, không xác nhận toàn bộ bài tập đạt kỹ thuật hoặc an toàn.',
            'decisionScope': 'PER_CRITERION_2D_ONLY',
            'screeningStatus': screening_status,
            'wholeExerciseStatus': 'UNABLE_TO_CONFIRM',
            'correctionPriorities': corrections}
