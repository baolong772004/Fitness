"""Target-independent projected Squat measurements and traceable evidence.

These functions extract observations; they never certify form or floor contact.
Existing segmentation/visibility/coverage thresholds are retained. Measurements
remain available with a failed quality gate, explicitly marked as descriptive.
"""
from math import atan2, degrees, hypot, isfinite
from statistics import median

from diagnostics import landmark_problem, value_range
from rules import angle
from squat_config import SquatConfig


CORE = ('Shoulder', 'Hip', 'Knee', 'Ankle')
LIMIT_2D = 'Số đo là hình chiếu 2D, chịu ảnh hưởng của phối cảnh và cách đặt camera.'


def _points(frame, names, width, height, cfg):
    points = {}
    for name in names:
        point = frame.get('landmarks', {}).get(name)
        if landmark_problem(point, cfg.visibility):
            return None
        points[name] = (point['x'] * width, point['y'] * height)
    return points


def _distance(first, second):
    return hypot(first[0] - second[0], first[1] - second[1])


def _snapshots(frames, names, moments, cfg):
    """Keep actual normalized coordinates and visibility at supporting times."""
    snapshots = []
    seen = set()
    for moment in moments:
        if not frames:
            break
        frame = min(frames, key=lambda item: abs(item['timeSeconds'] - moment))
        stamp = frame['timeSeconds']
        if stamp in seen or abs(stamp - moment) > cfg.max_gap_seconds:
            continue
        seen.add(stamp)
        landmarks = {}
        for name in names:
            point = frame.get('landmarks', {}).get(name)
            if not landmark_problem(point, cfg.visibility):
                landmarks[name] = {key: point[key] for key in ('x', 'y', 'visibility')}
        snapshots.append({'timestampSeconds': stamp, 'landmarks': landmarks})
    return snapshots


def _quality(frames, rep, cfg, reference_required=True):
    expected = max(1, (rep['endSeconds'] - rep['startSeconds']) * cfg.sample_hz + 1)
    coverage = min(1, len(frames) / expected)
    gap = max((second['timeSeconds'] - first['timeSeconds']
               for first, second in zip(frames, frames[1:])), default=0)
    anchors = bool(frames and frames[0]['timeSeconds'] - rep['startSeconds'] <= cfg.max_gap_seconds
                   and rep['endSeconds'] - frames[-1]['timeSeconds'] <= cfg.max_gap_seconds)
    continuous = coverage >= cfg.min_rep_coverage and gap <= cfg.max_gap_seconds and anchors
    stable = rep.get('techniqueTrackingSufficient')
    sufficient = continuous and (not reference_required or stable is True)
    reason = (None if sufficient else 'INSUFFICIENT_REP_TRACKING' if not continuous
              else rep.get('referenceQualityReasonCode') or 'TRACKING_OR_REFERENCE_UNVERIFIED')
    return {'continuousTracking': continuous, 'stableReference': stable,
            'referenceRequired': reference_required,
            'sufficientForExperimentalComparison': sufficient,
            'maximumGapSeconds': round(gap, 4),
            'coverageThreshold': cfg.min_rep_coverage,
            'maximumGapThresholdSeconds': cfg.max_gap_seconds,
            'reasonCode': reason}, expected, coverage


def _row(rep, frames, names, observed, units, stamp, cfg, side=None, extra=None, reference_required=True):
    quality, expected, coverage = _quality(frames, rep, cfg, reference_required)
    evidence = _snapshots(frames, names,
                          (rep['startSeconds'], rep['bottomSeconds'], stamp, rep['endSeconds']), cfg)
    visibility = [point['visibility'] for snapshot in evidence for point in snapshot['landmarks'].values()]
    return {'repNumber': rep['number'], 'startSeconds': rep['startSeconds'],
            'bottomSeconds': rep['bottomSeconds'], 'endSeconds': rep['endSeconds'],
            'timestampSeconds': round(stamp, 4), 'side': side.upper() if side else 'BOTH',
            'observedValue': observed, 'units': units, 'validFrames': len(frames),
            'requiredFrames': round(expected, 2), 'trackingCoverage': round(coverage, 4),
            'landmarkEvidence': evidence, 'measurementQuality': quality,
            'confidenceOfObservation': min(visibility) if visibility else None,
            'confidenceBasis': 'minimum_landmark_visibility_not_technique_accuracy',
            'limitations': [LIMIT_2D], **(extra or {})}


def _entry(code, view, allowed, rows=None, reason=None, implemented=True, **extra):
    rows = rows or []
    return {'criterionId': code, 'implemented': implemented,
            'measurementType': 'EXPERIMENTAL_PROJECTION', 'cameraViews': list(allowed),
            'sampleCount': sum(row['validFrames'] for row in rows),
            'validRepCount': len({row['repNumber'] for row in rows}),
            'perRep': rows, 'reasonCode': reason if reason else None if rows else
                       'VIEW_NOT_SUITABLE' if view not in allowed else 'NO_COMPLETE_REPETITION',
            'limitations': [LIMIT_2D], **extra}


def _side_samples(frames, side, width, height, cfg):
    names = [side + joint for joint in CORE]
    samples = []
    for frame in frames:
        points = _points(frame, names, width, height, cfg)
        if not points:
            continue
        shoulder, hip, knee, ankle = (points[name] for name in names)
        femur, shank, torso = _distance(hip, knee), _distance(knee, ankle), _distance(shoulder, hip)
        if min(femur, shank, torso) < height * .04:
            continue
        samples.append({'frame': frame, 'points': points,
                        'kneeAngle': angle(hip, knee, ankle),
                        'hipAngle': angle(shoulder, hip, knee),
                        'lean': abs(degrees(atan2(shoulder[0] - hip[0], hip[1] - shoulder[1]))),
                        'femur': femur, 'torso': torso,
                        'depth': (knee[1] - hip[1]) / femur})
    return samples


def _front_knees(rep, frames, width, height, cfg):
    result = []
    for side in ('left', 'right'):
        names = [side + joint for joint in ('Hip', 'Knee', 'Ankle', 'Heel', 'Toe')]
        names += [('right' if side == 'left' else 'left') + 'Ankle']
        samples = [(frame, points) for frame in frames
                   if (points := _points(frame, names, width, height, cfg))]
        if len(samples) < 3:
            continue
        anchor, baseline_points = samples[0]
        if anchor['timeSeconds'] - rep['startSeconds'] > cfg.max_gap_seconds:
            continue
        stance = abs(baseline_points['leftAnkle'][0] - baseline_points['rightAnkle'][0])
        hip, knee, ankle = [baseline_points[side + joint] for joint in ('Hip', 'Knee', 'Ankle')]
        leg = _distance(hip, knee) + _distance(knee, ankle)
        if stance <= 0 or stance < leg * .15:
            continue
        sign = 1 if baseline_points[side + 'Ankle'][0] < (baseline_points['leftAnkle'][0] + baseline_points['rightAnkle'][0]) / 2 else -1
        def offset(points):
            return sign * (points[side + 'Knee'][0] - (points[side + 'Ankle'][0] + points[side + 'Toe'][0]) / 2) / stance
        baseline = offset(baseline_points)
        peak_frame, peak_points = max(samples, key=lambda sample: offset(sample[1]) - baseline)
        drift = max(_distance(points[side + 'Ankle'], baseline_points[side + 'Ankle']) / leg for _, points in samples)
        observed = {'inwardChangeStanceRatio': round(offset(peak_points) - baseline, 4),
                    'projectedKneeAngleRangeDegrees': value_range(angle(points[side + 'Hip'], points[side + 'Knee'], points[side + 'Ankle']) for _, points in samples),
                    'ankleDriftStandingLegRatio': round(drift, 4),
                    'stanceWidthPixels': round(stance, 3)}
        result.append(_row(rep, [frame for frame, _ in samples], names, observed,
                           {'inwardChangeStanceRatio': 'stance_width', 'projectedKneeAngleRangeDegrees': 'degrees',
                            'ankleDriftStandingLegRatio': 'standing_leg_length', 'stanceWidthPixels': 'pixels'},
                           peak_frame['timeSeconds'], cfg, side,
                           {'limitations': [LIMIT_2D, 'Ghi nhận tương quan gối–bàn chân và biến thiên góc; không chẩn đoán valgus hoặc kết luận chụm gối.']}))
    return result


def _front_bilateral(rep, frames, width, height, cfg):
    names = [side + joint for side in ('left', 'right') for joint in CORE]
    samples = []
    for frame in frames:
        points = _points(frame, names, width, height, cfg)
        if not points:
            continue
        stance = abs(points['leftAnkle'][0] - points['rightAnkle'][0])
        if stance <= 0:
            continue
        left_angle = angle(*(points['left' + joint] for joint in ('Hip', 'Knee', 'Ankle')))
        right_angle = angle(*(points['right' + joint] for joint in ('Hip', 'Knee', 'Ankle')))
        if left_angle is None or right_angle is None:
            continue
        samples.append((frame, abs(left_angle - right_angle),
                        (points['leftHip'][1] - points['rightHip'][1]) / stance,
                        left_angle, right_angle))
    if len(samples) < 3:
        return None
    peak = max(samples, key=lambda sample: sample[1])
    return _row(rep, [sample[0] for sample in samples], names,
                {'maximumProjectedKneeDifferenceDegrees': round(peak[1], 3),
                 'leftProjectedKneeAtPeakDegrees': round(peak[3], 3),
                 'rightProjectedKneeAtPeakDegrees': round(peak[4], 3),
                 'hipHeightDifferenceStanceRatio': round(peak[2], 4)},
                {'maximumProjectedKneeDifferenceDegrees': 'degrees', 'leftProjectedKneeAtPeakDegrees': 'degrees',
                 'rightProjectedKneeAtPeakDegrees': 'degrees', 'hipHeightDifferenceStanceRatio': 'stance_width'},
                peak[0]['timeSeconds'], cfg,
                extra={'limitations': [LIMIT_2D, 'Chỉ mô tả khác biệt hình chiếu giữa hai bên; chưa có ngưỡng đối xứng đã kiểm chứng và chưa kết luận bất đối xứng kỹ thuật.']})


def extract_squat_measurements(frames, movement, width, height):
    """Return measurements keyed SQUAT-01..08, regardless of chosen goals.

    ``movement`` is the existing segmented Squat result, including protocol,
    cameraView and diagnostics. No reps are created here and no frame is
    interpolated. Values with unverified tracking remain descriptive only.
    """
    view = movement.get('cameraView', {}).get('detected', 'UNKNOWN')
    allowed = {
        'SQUAT-01': ('SIDE', 'FRONT', 'OBLIQUE'), 'SQUAT-02': ('SIDE',),
        'SQUAT-03': ('FRONT',), 'SQUAT-04': ('SIDE',),
        'SQUAT-05': ('SIDE', 'FRONT', 'OBLIQUE'), 'SQUAT-06': ('FRONT',),
        'SQUAT-07': ('SIDE',), 'SQUAT-08': ('SIDE', 'FRONT', 'OBLIQUE'),
    }
    result = {code: _entry(code, view, views) for code, views in allowed.items()}
    if width <= 0 or height <= 0 or any(not isfinite(frame.get('timeSeconds', float('nan'))) for frame in frames) or any(second['timeSeconds'] <= first['timeSeconds'] for first, second in zip(frames, frames[1:])):
        for entry in result.values(): entry['reasonCode'] = 'INVALID_DIMENSIONS_OR_TIMESTAMPS'
        return result
    values = movement.get('thresholdConfig', {}).get('values')
    cfg = SquatConfig(**values) if values else SquatConfig()
    side = movement.get('diagnostics', {}).get('landmarks', {}).get('selectedSide')
    if side not in ('left', 'right'):
        side = max(('left', 'right'), key=lambda candidate: sum(_points(frame, [candidate + joint for joint in CORE], width, height, cfg) is not None for frame in frames))
    row_lists = {code: [] for code in allowed}
    for rep in movement.get('repetitions', []):
        current = [frame for frame in frames if rep['startSeconds'] - 1e-6 <= frame['timeSeconds'] <= rep['endSeconds'] + 1e-6]
        core_names = [side + joint for joint in CORE] if view != 'FRONT' else [candidate + joint for candidate in ('left', 'right') for joint in CORE]
        core = [frame for frame in current if _points(frame, core_names, width, height, cfg)]
        if not core or view not in allowed['SQUAT-01']:
            continue
        timing = {'descentSeconds': round(rep['bottomSeconds'] - rep['startSeconds'], 4),
                  'ascentSeconds': round(rep['endSeconds'] - rep['bottomSeconds'], 4),
                  'totalSeconds': round(rep['endSeconds'] - rep['startSeconds'], 4),
                  'completedCycleObserved': True}
        units = {'descentSeconds': 'seconds', 'ascentSeconds': 'seconds', 'totalSeconds': 'seconds', 'completedCycleObserved': 'boolean'}
        protocol = movement.get('protocol', {})
        row_lists['SQUAT-01'].append(_row(rep, core, core_names, dict(timing), dict(units), rep['endSeconds'], cfg,
                                          reference_required=False))
        row_lists['SQUAT-05'].append(_row(rep, core, core_names, dict(timing), dict(units), rep['bottomSeconds'], cfg,
                                          reference_required=False))
        target_row = _row(rep, core, core_names, dict(timing), dict(units), rep['bottomSeconds'], cfg,
                          reference_required=protocol.get('depthTarget') == 'HIP_AT_KNEE')
        target_row['targetValue'] = {'descentSeconds': protocol.get('descentTargetSeconds'),
                                     'depthTarget': protocol.get('depthTarget', 'NONE')}
        target_row['targetSource'] = 'REQUEST_PROTOCOL_NOT_AUTOMATIC_COACH_APPROVAL'
        row_lists['SQUAT-08'].append(target_row)
        if view == 'SIDE':
            samples = _side_samples(current, side, width, height, cfg)
            bottom = [sample for sample in samples if abs(sample['frame']['timeSeconds'] - rep['bottomSeconds']) <= .2 + 1e-6]
            if len(bottom) >= 3:
                bottom_frame = min(bottom, key=lambda sample: abs(sample['frame']['timeSeconds'] - rep['bottomSeconds']))['frame']
                depth = median(sample['depth'] for sample in bottom)
                data = {'hipAboveKneeRatio': round(depth, 4),
                        'minimumProjectedKneeDegrees': round(min(sample['kneeAngle'] for sample in samples), 3),
                        'projectedKneeRangeDegrees': value_range(sample['kneeAngle'] for sample in samples),
                        'projectedHipRangeDegrees': value_range(sample['hipAngle'] for sample in samples)}
                row = _row(rep, [sample['frame'] for sample in samples], [side + joint for joint in CORE], data,
                           {'hipAboveKneeRatio': 'projected_femur_length', 'minimumProjectedKneeDegrees': 'degrees',
                            'projectedKneeRangeDegrees': 'degrees', 'projectedHipRangeDegrees': 'degrees'},
                           bottom_frame['timeSeconds'], cfg, side,
                           {'bottomWindowValidFrames': len(bottom), 'bottomWindowStartSeconds': bottom[0]['frame']['timeSeconds'],
                            'bottomWindowEndSeconds': bottom[-1]['frame']['timeSeconds']})
                row_lists['SQUAT-02'].append(row)
                target_row['observedValue']['hipAboveKneeRatio'] = round(depth, 4)
                target_row['units']['hipAboveKneeRatio'] = 'projected_femur_length'
            if samples:
                base = min(samples, key=lambda sample: abs(sample['frame']['timeSeconds'] - rep['bottomSeconds']))
                early = [sample for sample in samples if rep['bottomSeconds'] <= sample['frame']['timeSeconds'] <= rep['bottomSeconds'] + .6 * (rep['endSeconds'] - rep['bottomSeconds'])]
                if early:
                    peak = max(early, key=lambda sample: sample['lean'] - base['lean'])
                    hip_rise = base['points'][side + 'Hip'][1] - peak['points'][side + 'Hip'][1]
                    shoulder_rise = base['points'][side + 'Shoulder'][1] - peak['points'][side + 'Shoulder'][1]
                    torso_data = {'maximumProjectedLeanDegrees': round(max(sample['lean'] for sample in samples), 3),
                                  'bottomProjectedLeanDegrees': round(base['lean'], 3),
                                  'earlyAscentLeanChangeDegrees': round(peak['lean'] - base['lean'], 3),
                                  'hipShoulderRiseDifferenceRatio': round((hip_rise - shoulder_rise) / base['torso'], 4)}
                    row_lists['SQUAT-04'].append(_row(rep, [sample['frame'] for sample in samples], [side + joint for joint in CORE], torso_data,
                        {'maximumProjectedLeanDegrees': 'degrees', 'bottomProjectedLeanDegrees': 'degrees',
                         'earlyAscentLeanChangeDegrees': 'degrees', 'hipShoulderRiseDifferenceRatio': 'projected_torso_length'},
                        peak['frame']['timeSeconds'], cfg, side,
                        {'earlyAscentValidFrames': len(early), 'limitations': [LIMIT_2D, 'Độ nghiêng thân không mô tả đường cong cột sống hoặc nguyên nhân thay đổi tư thế.']}))
            # A visible heel/toe projection is a measurement only. It supplies
            # no floor contact, force, or calibrated heel-height information.
            foot_names = [side + joint for joint in ('Ankle', 'Heel', 'Toe')]
            feet = [(frame, points) for frame in current if (points := _points(frame, foot_names, width, height, cfg))]
            feet = [(frame, points) for frame, points in feet if _distance(points[side + 'Heel'], points[side + 'Toe']) > 1]
            if len(feet) >= 3:
                def tilt(points):
                    heel, toe = points[side + 'Heel'], points[side + 'Toe']
                    return degrees(atan2(heel[1] - toe[1], abs(heel[0] - toe[0])))
                baseline = tilt(feet[0][1])
                peak_frame, peak_points = max(feet, key=lambda sample: abs(tilt(sample[1]) - baseline))
                row_lists['SQUAT-07'].append(_row(rep, [frame for frame, _ in feet], foot_names,
                    {'heelToeProjectedAngleChangeDegrees': round(tilt(peak_points) - baseline, 3),
                     'heelToeProjectedAngleRangeDegrees': value_range(tilt(points) for _, points in feet)},
                    {'heelToeProjectedAngleChangeDegrees': 'degrees', 'heelToeProjectedAngleRangeDegrees': 'degrees'},
                    peak_frame['timeSeconds'], cfg, side,
                    {'limitations': [LIMIT_2D, 'Chỉ mô tả hướng gót–mũi chân trên ảnh; không đo độ cao gót so với sàn, tiếp xúc sàn hoặc phân bổ lực.']}))
        if view == 'FRONT':
            row_lists['SQUAT-03'].extend(_front_knees(rep, current, width, height, cfg))
            bilateral = _front_bilateral(rep, current, width, height, cfg)
            if bilateral:
                row_lists['SQUAT-06'].append(bilateral)
    # Consistency is descriptive and requires multiple completed cycles.
    control = row_lists['SQUAT-05']
    if len(control) >= 2:
        down = median(row['observedValue']['descentSeconds'] for row in control)
        up = median(row['observedValue']['ascentSeconds'] for row in control)
        for row in control:
            row['observedValue'].update(descentDifferenceFromClipMedianSeconds=round(row['observedValue']['descentSeconds'] - down, 4),
                                        ascentDifferenceFromClipMedianSeconds=round(row['observedValue']['ascentSeconds'] - up, 4))
            row['units'].update(descentDifferenceFromClipMedianSeconds='seconds', ascentDifferenceFromClipMedianSeconds='seconds')
    for code, rows in row_lists.items():
        reason = None
        if not rows and view in allowed[code] and movement.get('repetitions'):
            reason = 'MISSING_OR_INSUFFICIENT_PHASE_LANDMARKS'
        result[code] = _entry(code, view, allowed[code], rows, reason)
    result['SQUAT-01']['measurementType'] = 'COMPLETE_CYCLE_TIMING'
    result['SQUAT-05']['measurementType'] = 'TIMING_AND_WITHIN_CLIP_CONSISTENCY'
    result['SQUAT-06']['evaluationSupported'] = False
    result['SQUAT-06']['limitations'].append('Chưa có ngưỡng đối xứng kỹ thuật được kiểm chứng; chỉ đo khác biệt hình chiếu hai bên.')
    result['SQUAT-07']['evaluationSupported'] = False
    result['SQUAT-07']['reasonCode'] = 'NO_FLOOR_CALIBRATION' if row_lists['SQUAT-07'] else result['SQUAT-07']['reasonCode']
    result['SQUAT-07']['limitations'].append('Không quan sát được tiếp xúc sàn, độ cao gót thật hoặc lực bàn chân chỉ từ landmarks.')
    result['SQUAT-08']['measurementType'] = 'INDIVIDUAL_TARGET_INPUTS'
    protocol = movement.get('protocol', {})
    if row_lists['SQUAT-08'] and protocol.get('depthTarget', 'NONE') == 'NONE' and protocol.get('descentTargetSeconds') is None:
        result['SQUAT-08']['reasonCode'] = 'NO_INDIVIDUAL_TARGET'
    return result
