"""Pose-based per-rep observations. Values describe 2D projections, not diagnoses."""
from math import atan2, degrees, hypot, isfinite
from statistics import median

from rules import Sample, analyze_samples, angle, insufficient, RULE_VERSION
from squat_config import SquatConfig, parse_protocol
from diagnostics import landmark_problem, pose_diagnostics, finalize_diagnostics, state_event, value_range

CRITERIA = {
    'MOVEMENT_TIMING': ('Số lần và nhịp chuyển động', 'WHOLE_BODY', 'ANY_TRACKED', ['hip', 'knee', 'ankle'], 'start, bottom and end of a complete tracked movement cycle', [], 'Theo dõi liên tục một chu kỳ đứng, xuống và đứng lên.', 'Số lần và thời gian không xác nhận kỹ thuật đúng hay độ sâu đạt chuẩn.'),
    'DEPTH_TARGET': ('Độ sâu theo mục tiêu', 'HIP', 'SIDE', ['hip', 'knee'], '(knee_y - hip_y) / femur_length at bottom', ['depth_tolerance_ratio'], 'Mục tiêu hông gần ngang gối phải được chọn; thấy rõ hông và gối quanh đáy.', 'Không xác định nếp hông hay độ sâu phù hợp về y khoa; tọa độ khớp là ước lượng trên ảnh.'),
    'TORSO_ASCENT_CHANGE': ('Thân người lúc đứng lên', 'TORSO', 'SIDE', ['shoulder', 'hip', 'knee', 'ankle'], 'lean(t)-lean(bottom), (hip_rise-shoulder_rise)/torso_length during early ascent', ['torso_increase_degrees', 'hip_shoulder_rise_ratio', 'sustain_seconds'], 'Góc ngang ổn định; khớp rõ xuyên suốt đoạn đáy và nửa đầu pha lên.', 'Không kết luận cong lưng, tải quá nặng hoặc nguyên nhân của thay đổi.'),
    'DESCENT_TARGET': ('Nhịp xuống theo mục tiêu', 'WHOLE_BODY', 'ANY_TRACKED', ['hip', 'knee', 'ankle'], 'bottom_seconds - start_seconds versus selected descent target', ['tempo_tolerance_seconds'], 'Có mục tiêu thời gian xuống; rep hoàn chỉnh và theo dõi liên tục.', 'Chênh lệch mục tiêu không đồng nghĩa chuyển động nguy hiểm; chưa tách riêng thời gian dừng ở đáy.'),
    'KNEE_INWARD_LEFT': ('Hướng gối trái trên ảnh', 'LEFT_KNEE', 'FRONT', ['leftHip', 'leftKnee', 'leftAnkle', 'leftHeel', 'leftToe', 'rightHip', 'rightAnkle'], 'signed inward delta of knee_x - (ankle_x+toe_x)/2 from standing / stance_width', ['knee_inward_ratio', 'sustain_seconds'], 'Chính diện; cả hai chân, gót và mũi chân rõ; vị trí bàn chân ổn định.', 'Chỉ mô tả dịch chuyển vào giữa trên ảnh; không chẩn đoán valgus/chụm gối hay bệnh lý.'),
    'KNEE_INWARD_RIGHT': ('Hướng gối phải trên ảnh', 'RIGHT_KNEE', 'FRONT', ['rightHip', 'rightKnee', 'rightAnkle', 'rightHeel', 'rightToe', 'leftHip', 'leftAnkle'], 'signed inward delta of knee_x - (ankle_x+toe_x)/2 from standing / stance_width', ['knee_inward_ratio', 'sustain_seconds'], 'Chính diện; cả hai chân, gót và mũi chân rõ; vị trí bàn chân ổn định.', 'Chỉ mô tả dịch chuyển vào giữa trên ảnh; không chẩn đoán valgus/chụm gối hay bệnh lý.'),
    'LUMBAR_CURVATURE': ('Độ cong lưng', 'TORSO', 'UNSUPPORTED', [], 'Not implemented', [], 'Cần dữ liệu cột sống đủ chi tiết và quy trình kiểm chứng riêng.', 'Hai điểm vai–hông không mô tả độ cong cột sống.'),
    'HEEL_LIFT': ('Tiếp xúc gót với sàn', 'FEET', 'UNSUPPORTED', ['heel', 'toe'], 'Not implemented', [], 'Cần mặt sàn và độ cao gót được hiệu chuẩn, kiểm chứng.', 'Landmark gót xuất hiện không chứng minh gót chạm hay rời sàn.'),
    'BALANCE': ('Thăng bằng cơ thể', 'WHOLE_BODY', 'UNSUPPORTED', [], 'Not implemented', [], 'Cần dữ liệu và tiêu chí thăng bằng riêng.', 'Video 2D không cung cấp trọng tâm hay lực tiếp xúc bàn chân.'),
    'LEFT_RIGHT_SYMMETRY': ('Đối xứng toàn thân', 'WHOLE_BODY', 'UNSUPPORTED', [], 'Not implemented', [], 'Cần kiểm chứng riêng theo góc quay và đặc điểm cơ thể.', 'Hai bên có số đo khác không tự chứng minh bất đối xứng kỹ thuật.'),
}


def point(frame, name, width, height, visibility=.65):
    p = frame['landmarks'].get(name)
    if landmark_problem(p,visibility):
        return None
    return (p['x'] * width, p['y'] * height)


def distance(a, b):
    return hypot(a[0] - b[0], a[1] - b[1])


def classify_frame(frame, width, height, cfg):
    pts = [point(frame, side + joint, width, height, .5) for side in ('left', 'right') for joint in ('Shoulder', 'Hip')]
    if any(p is None for p in pts):
        return 'UNKNOWN'
    ls, lh, rs, rh = pts
    torso = (distance(ls, lh) + distance(rs, rh)) / 2
    if torso < height * .08:
        return 'UNKNOWN'
    shoulder_ratio = abs(ls[0] - rs[0]) / torso
    hip_ratio = abs(lh[0] - rh[0]) / torso
    if shoulder_ratio <= cfg.side_shoulder_ratio and hip_ratio <= cfg.side_hip_ratio:
        return 'SIDE'
    if shoulder_ratio >= cfg.front_shoulder_ratio and hip_ratio >= cfg.front_hip_ratio:
        return 'FRONT'
    return 'OBLIQUE'


def geometry(frame, width, height, view, side, cfg):
    get = lambda name: point(frame, name, width, height, cfg.visibility)
    names = [side + joint for joint in ('Shoulder', 'Hip', 'Knee', 'Ankle')] if view == 'SIDE' else [s + j for s in ('left', 'right') for j in ('Shoulder', 'Hip', 'Knee', 'Ankle')]
    if any(get(name) is None for name in names):
        return None
    data = {name: get(name) for name in names}
    data['time'] = frame['timeSeconds']
    data['visibility'] = min(frame['landmarks'][name]['visibility'] for name in names)
    if view == 'SIDE':
        sh, hip, knee, ankle = [data[side + j] for j in ('Shoulder', 'Hip', 'Knee', 'Ankle')]
        femur, shank, torso = distance(hip, knee), distance(knee, ankle), distance(sh, hip)
        if min(femur, shank, torso) < height * .04:
            return None
        data.update(knee=angle(hip, knee, ankle), hipAngle=angle(sh, hip, knee), lean=abs(degrees(atan2(sh[0] - hip[0], hip[1] - sh[1]))), travel=abs(knee[0] - ankle[0])/shank, femur=femur, torso=torso, leg=femur+shank)
    else:
        data['hipY'] = (data['leftHip'][1] + data['rightHip'][1]) / 2
        data['ankleY'] = (data['leftAnkle'][1] + data['rightAnkle'][1]) / 2
        data['leg'] = sum(distance(data[s+'Hip'], data[s+'Knee']) + distance(data[s+'Knee'], data[s+'Ankle']) for s in ('left', 'right')) / 2
        if data['leg'] < height * .20:
            return None
    for s in ('left', 'right'):
        for j in ('Ankle', 'Heel', 'Toe'):
            p = get(s + j)
            if p is not None:
                data[s + j] = p
    return data


def upright_rows(rows, cfg, side=None):
    """Candidate references, in image units; never normalize by a bent thigh."""
    if not rows:
        return []
    def position(r):
        return r[side+'Hip'][1]-r[side+'Ankle'][1] if side else r['hipY']-r['ankleY']
    positions = sorted(position(r) for r in rows)
    leg = median(r['leg'] for r in rows)
    upper = positions[int((len(positions)-1)*.1)]
    candidates = []
    for row in rows:
        if position(row) > upper + leg*.04:
            continue
        sides = (side,) if side else ('left', 'right')
        if all(row[s+'Hip'][1] < row[s+'Knee'][1]-row['leg']*.15
               and (knee_angle := angle(row[s+'Hip'], row[s+'Knee'], row[s+'Ankle'])) is not None
               and knee_angle >= cfg.standing_angle
               for s in sides):
            candidates.append(row)
    return candidates


def standing_reference(rows, cfg):
    """Find a continuous upright window anywhere, including after a cut-in rep."""
    candidates = upright_rows(rows, cfg)
    minimum = max(3, int(cfg.front_calibration_seconds*cfg.sample_hz*.8))
    window = []
    for row in candidates:
        if window and row['time']-window[-1]['time'] > 1.5/cfg.sample_hz:
            window = []
        window.append(row)
        window = [r for r in window if row['time']-r['time'] <= cfg.front_calibration_seconds+1e-8]
        if len(window) < minimum or window[-1]['time']-window[0]['time'] < cfg.front_calibration_seconds*.78:
            continue
        leg = median(r['leg'] for r in window)
        positions = [r['hipY']-r['ankleY'] for r in window]
        if max(positions)-min(positions) <= leg*.04:
            return median(positions), leg, window
    return None


def front_repetitions(rows, cfg, diagnostics=None):
    if not rows:
        return [], 'Không thấy đủ khớp ở cả hai bên.'
    reference = standing_reference(rows, cfg)
    if reference is None:
        if diagnostics is not None:
            diagnostics['rejectionCode']='NO_STANDING_REFERENCE'
        return [], 'Chưa tìm thấy đoạn đứng thẳng ổn định trong video để làm mốc. Cần thấy rõ cả hai chân và ít nhất một đoạn đứng thẳng khoảng nửa giây.'
    base, leg, calibration = reference
    if diagnostics is not None:
        diagnostics.update(reference={'startSeconds':calibration[0]['time'],'endSeconds':calibration[-1]['time'],'hipAnkleOffsetPixels':base,'standingLegPixels':leg},signal=[],signalUnits='standing_leg_ratio',rejectedCycles=[])
    # Ankle-relative hip height cancels small shared vertical shifts, not zoom/perspective.
    raw = [(r['hipY'] - r['ankleY'] - base)/leg for r in rows]
    values = [median(raw[j] for j in range(max(0,i-1),min(len(rows),i+2)) if abs(rows[j]['time']-rows[i]['time']) <= cfg.max_gap_seconds) for i in range(len(rows))]
    reps, start, bottom, moving = [], None, None, False
    for i, value in enumerate(values):
        if i and rows[i]['time'] - rows[i-1]['time'] > cfg.max_gap_seconds:
            start, bottom, moving = None, None, False
            state_event(diagnostics,rows[i]['time'],'SEEK_STANDING','TRACKING_GAP')
        if not moving:
            if value <= cfg.front_return_ratio:
                start = i
            elif start is not None and value >= cfg.front_onset_ratio:
                bottom, moving = i, True
        else:
            if bottom is None or value > values[bottom]:
                bottom = i
            if value <= cfg.front_return_ratio:
                if values[bottom] >= cfg.front_peak_ratio and rows[i]['time'] - rows[start]['time'] >= cfg.minimum_rep_seconds:
                    reps.append({'number': len(reps)+1, 'startSeconds': rows[start]['time'], 'bottomSeconds': rows[bottom]['time'], 'endSeconds': rows[i]['time'], 'descentSeconds': round(rows[bottom]['time']-rows[start]['time'],2), 'ascentSeconds': round(rows[i]['time']-rows[bottom]['time'],2), 'hipTravelRatio': round(values[bottom],3), 'minimumKneeAngle': None, 'rangeDegrees': None, 'bottomHipAngleDegrees': None, 'maximumTorsoLeanDegrees': None, 'landmarkVisibility': round(median(r['visibility'] for r in rows[start:i+1]),2), 'observations': [], 'notAssessed': []})
                    state_event(diagnostics,rows[i]['time'],'REP_COMPLETE')
                elif diagnostics is not None:
                    diagnostics['rejectedCycles'].append({'timeSeconds':rows[i]['time'],'reason':'RANGE_OR_DURATION_BELOW_MINIMUM','hipTravelRatio':values[bottom],'durationSeconds':rows[i]['time']-rows[start]['time']})
                start, bottom, moving = i, None, False
        state = 'MOVING' if moving else 'STANDING' if start is not None else 'SEEK_STANDING'
        state_event(diagnostics,rows[i]['time'],state)
        if diagnostics is not None:
            diagnostics['signal'].append({'timeSeconds':rows[i]['time'],'raw':raw[i],'smoothed':value,'state':state})
    if not reps and diagnostics is not None:
        diagnostics['rejectionCode']='NO_COMPLETE_REPETITION'
    return reps, None if reps else 'Chưa thấy chu kỳ hông xuống và trở về mốc đứng rõ ràng ở góc chính diện.'


def check(code, cfg, reason=None, evidence=None, detected=False):
    title, part, view, landmarks, formula, thresholds, conditions, limitation = CRITERIA[code]
    return {'code': code, 'title': title, 'bodyPart': part, 'cameraAngle': view, 'landmarks': landmarks, 'formula': formula, 'thresholds': {k:getattr(cfg,k) for k in thresholds}, 'qualityConditions': conditions, 'limitation': limitation, 'status': 'NOT_ASSESSED' if reason else 'ASSESSED', 'outcome': 'NOT_ASSESSED' if reason else 'SIGNAL' if detected else 'NO_SIGNAL', 'reason': reason, 'evidence': evidence or {}, 'detectionRule': formula, 'validation': 'PROVISIONAL_NOT_COACH_VALIDATED'}


def unavailable_checks(cfg, reason, protocol, view='UNKNOWN'):
    checks = []
    for code, details in CRITERIA.items():
        required = details[2]
        if required=='UNSUPPORTED':
            specific = details[7]
        elif view!='UNKNOWN' and required in ('SIDE','FRONT') and view!=required:
            specific = 'Tiêu chí này cần góc ngang.' if required=='SIDE' else 'Tiêu chí này cần góc chính diện, thấy rõ cả hai bàn chân.'
        elif code=='DEPTH_TARGET' and protocol['depthTarget']=='NONE':
            specific = 'Chưa chọn mục tiêu độ sâu.'
        elif code=='DESCENT_TARGET' and protocol['descentTargetSeconds'] is None:
            specific = 'Chưa chọn thời gian xuống mục tiêu.'
        else:
            specific = reason
        criterion=check(code,cfg,specific)
        annotate_requirements(criterion,view,protocol,False)
        checks.append(criterion)
    return checks


def sustained(rows, predicate, cfg):
    streak, best = [], []
    for row in rows:
        if not predicate(row):
            streak = []
            continue
        if streak and row['time'] - streak[-1]['time'] > cfg.max_gap_seconds:
            streak = []
        streak.append(row)
        if len(streak) >= 3 and streak[-1]['time'] - streak[0]['time'] >= cfg.sustain_seconds - 1e-8:
            best = list(streak) if len(streak) > len(best) else best
    return best


def signal(rep, criterion, at, message, suggestion, evidence, interval=None):
    return {'code': criterion['code'], 'bodyPart': criterion['bodyPart'], 'repNumber': rep['number'], 'timestampSeconds': round(evidence.get('timestampSeconds',at),2), 'intervalSeconds': interval, 'message': message, 'suggestion': suggestion, 'evidence': evidence, 'evidenceText': evidence['description'], 'confidence': rep['landmarkVisibility'], 'confidenceBasis': 'landmark_visibility_not_diagnostic_accuracy', 'cameraAngle': rep['cameraAngle'], 'landmarks': criterion['landmarks'], 'limitation': criterion['limitation'], 'kind': 'OBSERVABLE_SIGNAL', 'validation': 'PROVISIONAL_NOT_COACH_VALIDATED'}


def assess_rep(rep, rows, view, side, protocol, cfg):
    current = [r for r in rows if rep['startSeconds']-1e-6 <= r['time'] <= rep['endSeconds']+1e-6]
    expected = (rep['endSeconds']-rep['startSeconds'])*cfg.sample_hz + 1
    coverage = len(current)/expected
    tracking_ok = coverage >= cfg.min_rep_coverage and all(b['time']-a['time'] <= cfg.max_gap_seconds for a,b in zip(current,current[1:]))
    rep['cameraAngle'], rep['criteria'], rep['trackingCoverage'] = view, [], round(min(1,coverage),3)
    common_reason = None if tracking_ok else 'Mất khớp trong rep hoặc không đủ độ phủ để nhận xét kỹ thuật.'
    quality_reason_code = None if tracking_ok else 'INSUFFICIENT_REP_TRACKING'
    if current:
        anchor = current[0]
        feet = ['leftAnkle','rightAnkle'] if view == 'FRONT' else [side+'Ankle']
        drift = max(distance(r[k],anchor[k])/anchor['leg'] for r in current for k in feet)
        # Projected thigh length changes during a normal squat, especially from the front.
        # Use foot/stance references, never changing leg length, as a limited zoom/foot-motion check.
        scales = [abs(r['leftAnkle'][0]-r['rightAnkle'][0]) for r in current] if view=='FRONT' else [distance(r[side+'Heel'],r[side+'Toe']) for r in current if side+'Heel' in r and side+'Toe' in r]
        scales = sorted(s for s in scales if s>1)
        scale_change = scales[int((len(scales)-1)*.9)]/scales[int((len(scales)-1)*.1)]-1 if len(scales)>=3 else None
        if tracking_ok and drift > cfg.foot_drift_ratio:
            common_reason = 'Vị trí cổ chân trên ảnh thay đổi; chưa tách được chuyển động camera và người tập.'
            quality_reason_code = 'FOOT_ANCHOR_DRIFT_UNVERIFIED'
        elif tracking_ok and scale_change is not None and scale_change > cfg.max_scale_change:
            common_reason = 'Chiều dài gót–mũi chân trên ảnh thay đổi; mốc không gian chưa ổn định.'
            quality_reason_code = 'FOOT_REFERENCE_SCALE_UNVERIFIED'
        rep['qualityEvidence'] = {'ankleDriftRatio':round(drift,3),'footReferenceScaleChange':round(scale_change,3) if scale_change is not None else None}
    rep['techniqueTrackingSufficient'] = common_reason is None
    rep['referenceQualityReasonCode'] = quality_reason_code

    def add(code, reason=None, evidence=None, hit=None, message='', suggestion='', reason_code=None):
        criterion = check(code,cfg,reason,evidence,bool(hit))
        if reason_code:
            criterion['reasonCode']=reason_code
        rep['criteria'].append(criterion)
        if hit and not reason:
            rep['observations'].append(signal(rep,criterion,hit[0]['time'],message,suggestion,evidence,[hit[0]['time'],hit[-1]['time']]))

    add('MOVEMENT_TIMING', None if tracking_ok else common_reason, {
        'startSeconds':rep['startSeconds'], 'bottomSeconds':rep['bottomSeconds'], 'endSeconds':rep['endSeconds'],
        'descentSeconds':rep['descentSeconds'], 'ascentSeconds':rep['ascentSeconds'],
        'description':f"Rep {rep['number']}: xuống {rep['descentSeconds']:.2f}s, lên {rep['ascentSeconds']:.2f}s. Đây là số đo, chưa so với mục tiêu kỹ thuật."
    })
    if tracking_ok:
        rep['criteria'][-1]['outcome'] = 'MEASURED'

    depth_reason = ('Cần góc ngang để so vị trí hông và gối.' if view != 'SIDE' else 'Chưa chọn mục tiêu độ sâu; không áp đặt độ sâu mặc định.' if protocol['depthTarget']=='NONE' else None) or common_reason
    bottom = min(current,key=lambda r:abs(r['time']-rep['bottomSeconds'])) if current else None
    window = [r for r in current if abs(r['time']-rep['bottomSeconds']) <= .2+1e-6]
    if not depth_reason and len(window) < 3:
        depth_reason = 'Thiếu khung hình rõ quanh đáy rep.'
    if depth_reason:
        add('DEPTH_TARGET',depth_reason)
    else:
        ratio = median((r[side+'Knee'][1]-r[side+'Hip'][1])/r['femur'] for r in window)
        evidence = {'hipAboveKneeRatio':round(ratio,3),'target':'HIP_AT_KNEE','toleranceRatio':cfg.depth_tolerance_ratio,'windowStartSeconds':window[0]['time'],'windowEndSeconds':window[-1]['time'],'description':f'Hông cao hơn gối khoảng {ratio:.2f} lần chiều dài đùi trên ảnh; mục tiêu đã chọn là hông gần ngang gối, dung sai {cfg.depth_tolerance_ratio:.2f}.'}
        add('DEPTH_TARGET',evidence=evidence,hit=[bottom] if ratio>cfg.depth_tolerance_ratio else None,message=f'Rep {rep["number"]}: vị trí hông chưa xuống tới mục tiêu bạn chọn trên ảnh.',suggestion='Lần sau thử hạ hông thêm một chút trong phạm vi thoải mái để tiến gần mục tiêu. Không ép xuống nếu đau hoặc khó kiểm soát; nhờ Coach điều chỉnh mục tiêu nếu cần.')

    torso_reason = ('Cần góc ngang để quan sát vai và hông khi đứng lên.' if view!='SIDE' else None) or common_reason
    if torso_reason:
        add('TORSO_ASCENT_CHANGE',torso_reason)
    else:
        early = [r for r in current if rep['bottomSeconds'] <= r['time'] <= rep['bottomSeconds']+.6*rep['ascentSeconds']]
        if len(early)<3 or early[-1]['time']-early[0]['time'] < cfg.sustain_seconds:
            add('TORSO_ASCENT_CHANGE','Pha lên quá ngắn hoặc thiếu khớp để xác nhận thay đổi kéo dài.')
        else:
            def rises(r):
                return ((bottom[side+'Hip'][1]-r[side+'Hip'][1])-(bottom[side+'Shoulder'][1]-r[side+'Shoulder'][1]))/bottom['torso']
            hit = sustained(early,lambda r:r['lean']-bottom['lean']>=cfg.torso_increase_degrees and rises(r)>=cfg.hip_shoulder_rise_ratio,cfg)
            peak = max(hit or early,key=lambda r:r['lean']-bottom['lean'])
            evidence = {'timestampSeconds':peak['time'],'leanIncreaseDegrees':round(peak['lean']-bottom['lean'],1),'hipShoulderRiseDifferenceRatio':round(rises(peak),3),'description':f'Ở đầu pha lên, độ nghiêng thân tăng {peak["lean"]-bottom["lean"]:.1f}°; chênh lệch độ nâng hông–vai {rises(peak):.2f} lần chiều dài thân trên ảnh.'}
            add('TORSO_ASCENT_CHANGE',evidence=evidence,hit=hit,message=f'Rep {rep["number"]}: hông lên trước vai và thân nghiêng thêm ở đầu pha đứng lên.',suggestion='Thử đứng lên chậm hơn và để vai, hông cùng nâng lên trong đoạn đầu. Quay lại từ bên hông để đối chiếu; nếu vẫn khó giữ, nhờ Coach xem trực tiếp.')

    tempo_reason = ('Chưa chọn thời gian xuống mục tiêu.' if protocol['descentTargetSeconds'] is None else None) or (None if tracking_ok else 'Thiếu khớp liên tục để xác định thời gian pha xuống.')
    if tempo_reason:
        add('DESCENT_TARGET',tempo_reason)
    else:
        target = protocol['descentTargetSeconds']
        delta = rep['descentSeconds']-target
        evidence = {'seconds':rep['descentSeconds'],'targetSeconds':target,'differenceSeconds':round(delta,2),'description':f'Pha xuống {rep["descentSeconds"]:.2f}s; mục tiêu đã chọn {target:.2f}s, dung sai {cfg.tempo_tolerance_seconds:.2f}s.'}
        hit = [current[0],bottom] if abs(delta)>cfg.tempo_tolerance_seconds else None
        add('DESCENT_TARGET',evidence=evidence,hit=hit,message=f'Rep {rep["number"]}: pha xuống {"nhanh" if delta<0 else "chậm"} hơn mục tiêu bạn chọn.',suggestion=f'Thử đếm đều khoảng {target:g} giây khi hạ người ở lần tiếp theo. Giữ nhịp thoải mái; nếu bạn đang cố ý dừng hoặc tập nhịp khác, hãy đổi mục tiêu trước khi phân tích.')

    for s in ('left','right'):
        code = 'KNEE_INWARD_'+s.upper()
        # The other foot's toe/heel is not used in this knee's formula.
        needed = ['leftAnkle','rightAnkle',s+'Heel',s+'Toe']
        reason = ('Cần góc chính diện và thấy rõ hai bàn chân.' if view!='FRONT' else None) or common_reason
        reason_code = None
        foot_rows = [r for r in current if all(name in r for name in needed)]
        if not reason and (len(foot_rows)<len(current)*cfg.min_rep_coverage or not all(name in current[0] for name in needed)):
            reason = 'Thiếu gót hoặc mũi chân rõ ở tư thế đứng và trong rep.'
            reason_code = 'MISSING_FOOT_LANDMARKS'
        if not reason:
            anchor = current[0]
            stance = abs(anchor['leftAnkle'][0]-anchor['rightAnkle'][0])
            if stance < anchor['leg']*.15:
                reason = 'Hai chân quá gần nhau trên ảnh để chuẩn hóa dịch chuyển gối.'
            elif any(distance(r[name],anchor[name])/anchor['leg']>cfg.foot_drift_ratio for r in foot_rows for name in needed):
                reason = 'Bàn chân đổi vị trí hoặc góc camera thay đổi trong rep.'
        if reason:
            add(code,reason,reason_code=reason_code)
            continue
        sign = 1 if anchor[s+'Ankle'][0] < (anchor['leftAnkle'][0]+anchor['rightAnkle'][0])/2 else -1
        def offset(r):
            return sign*(r[s+'Knee'][0]-(r[s+'Ankle'][0]+r[s+'Toe'][0])/2)/stance
        baseline = offset(anchor)
        hit = sustained(foot_rows,lambda r:offset(r)-baseline>=cfg.knee_inward_ratio,cfg)
        peak = max(hit or foot_rows,key=lambda r:offset(r)-baseline)
        delta = offset(peak)-baseline
        evidence = {'timestampSeconds':peak['time'],'inwardChangeStanceRatio':round(delta,3),'side':s.upper(),'description':f'Gối {"trái" if s=="left" else "phải"} dịch vào phía giữa so với mốc bàn chân {delta:.2f} lần khoảng cách hai cổ chân, so với đầu rep.'}
        add(code,evidence=evidence,hit=hit,message=f'Rep {rep["number"]}: gối {"trái" if s=="left" else "phải"} dịch vào phía giữa so với bàn chân trên ảnh.',suggestion='Thử giữ bàn chân ổn định và để đầu gối di chuyển cùng hướng mũi chân trong phạm vi thoải mái. Quay lại chính diện; nếu dấu hiệu lặp lại, nhờ Coach xác nhận trước khi tự chỉnh mạnh.')
    for code in ('LUMBAR_CURVATURE','HEEL_LIFT','BALANCE','LEFT_RIGHT_SYMMETRY'):
        add(code,CRITERIA[code][7])
    rep['notAssessed'] = [{'code':c['code'],'reason':c['reason']} for c in rep['criteria'] if c['status']=='NOT_ASSESSED']
    rep['bodyParts'] = {part:{'observationCodes':[o['code'] for o in rep['observations'] if o['bodyPart']==part], 'checkedCriteria':[c['code'] for c in rep['criteria'] if c['bodyPart']==part and c['status']=='ASSESSED']} for part in {c['bodyPart'] for c in rep['criteria']}}


def _analyze_pose_frames(frames, width, height, options=None, config=None, diagnostics=None):
    cfg, protocol = config or SquatConfig(), parse_protocol(options)
    def unavailable(reason):
        result = insufficient(reason)
        result.update(criteria=unavailable_checks(cfg,reason,protocol),protocol=protocol,thresholdConfig=cfg.snapshot(),cameraView={'requested':protocol['cameraView'],'detected':'UNKNOWN'},validationStatus='NOT_COACH_VALIDATED')
        return result
    if not frames or width<=0 or height<=0:
        return unavailable('Không có dữ liệu khớp hợp lệ.')
    if any(not isfinite(f['timeSeconds']) for f in frames) or any(b['timeSeconds']<=a['timeSeconds'] for a,b in zip(frames,frames[1:])):
        return unavailable('Thứ tự thời gian khung hình không hợp lệ.')
    side = max(('left','right'),key=lambda s:sum(all(point(f,s+j,width,height,cfg.visibility) is not None for j in ('Shoulder','Hip','Knee','Ankle')) for f in frames))
    diagnostics['landmarks']['selectedSide']=side
    diagnostics['landmarks']['sideSelectionMethod']='most_complete_core_frames_one_fixed_side_no_mid_rep_switch'
    views = [classify_frame(frame,width,height,cfg) for frame in frames]
    votes = {name:views.count(name) for name in ('SIDE','FRONT','OBLIQUE','UNKNOWN')}
    side_rows = [geometry(f,width,height,'SIDE',side,cfg) for f in frames]
    reference_times = {r['time'] for r in side_rows if r and r['knee']>=cfg.standing_angle
                       and r[side+'Hip'][1]<r[side+'Knee'][1]-r['leg']*.15}
    # Squatting foreshortens the torso. Estimate orientation while upright, then
    # keep usable joints through the descent instead of dropping bottom frames.
    reference_views = [v for f,v in zip(frames,views) if f['timeSeconds'] in reference_times]
    selected_views = reference_views if len(reference_views)>=3 else views
    reference_votes = {name:selected_views.count(name) for name in votes}
    dominant = max(('SIDE','FRONT','OBLIQUE'),key=lambda name:reference_votes[name])
    fraction = reference_votes[dominant]/len(selected_views)
    view = dominant if fraction>=cfg.view_fraction else 'UNKNOWN'
    # A projected side torso with a persistently front-spread stance is not a
    # reliable side view for technique checks. Abstain conservatively: this
    # uses the existing view vote fraction, and never promotes a view to SIDE.
    stance_votes=[]
    oblique_from_side=False
    if view=='SIDE':
        for frame in frames:
            if frame['timeSeconds'] not in reference_times:
                continue
            shoulders=[point(frame,s+'Shoulder',width,height,.5) for s in ('left','right')]
            ankles=[point(frame,s+'Ankle',width,height,.5) for s in ('left','right')]
            if any(p is None for p in shoulders+ankles):
                continue
            stance_votes.append(abs(ankles[0][0]-ankles[1][0])>abs(shoulders[0][0]-shoulders[1][0]))
        if len(stance_votes)>=3 and sum(stance_votes)/len(stance_votes)>=cfg.view_fraction:
            view='OBLIQUE'
            oblique_from_side=True
    # A sustained opposite orientation at the top indicates an actual view
    # change, even if most of the clip has a single dominant view.
    opposite = 'FRONT' if view=='SIDE' else 'SIDE' if view=='FRONT' else None
    opposite_streak = []
    for f,v in zip(frames,views):
        if f['timeSeconds'] not in reference_times or v!=opposite:
            opposite_streak = []
            continue
        if opposite_streak and f['timeSeconds']-opposite_streak[-1]>cfg.max_gap_seconds:
            opposite_streak = []
        opposite_streak.append(f['timeSeconds'])
        if opposite_streak[-1]-opposite_streak[0]>=cfg.front_calibration_seconds-1e-8:
            view = 'UNKNOWN'
            break
    camera = {'requested':protocol['cameraView'],'detected':view,'supportFraction':round(fraction,3),'votes':votes,'referenceVotes':reference_votes,'referenceFrames':len(reference_views),'wideStanceReferenceFraction':round(sum(stance_votes)/len(stance_votes),3) if stance_votes else None,'wideStanceReferenceFrames':len(stance_votes),'obliqueFromSideConflict':oblique_from_side,'method':'upright_projected_shoulder_hip_and_ankle_width','validated':False}
    reason = None
    if view=='UNKNOWN':
        reason = 'Góc quay chéo hoặc thay đổi trong video. Hãy quay rõ từ bên hông hoặc chính diện, giữ camera cố định.'
    elif protocol['cameraView']!='AUTO' and protocol['cameraView']!=view:
        reason = 'Góc quay quan sát được không khớp lựa chọn. Hãy kiểm tra lại hướng camera.'
    if reason:
        diagnostics['segmentation']['rejectionCode']='VIEW_UNCERTAIN_OR_MISMATCH'
        result = unavailable(reason)
        result.update(cameraView=camera)
        return result
    rows = side_rows if view=='SIDE' or oblique_from_side else [geometry(f,width,height,view,side,cfg) for f in frames]
    rows = [r for r in rows if r is not None]
    diagnostics['landmarks'].update(geometryValidFrames=len(rows),geometryValidRateAmongPoseFrames=round(len(rows)/len(frames),4))
    valid_times={r['time'] for r in rows}
    for row in diagnostics['timeline']:
        row['geometryValid']=row['timeSeconds'] in valid_times
        row['geometryRejection']=None if row['geometryValid'] else 'MISSING_OR_LOW_CONFIDENCE_CORE' if row['missingLandmarks'] else 'PROJECTED_LIMBS_TOO_SHORT'
    diagnostics['_rows']=rows
    if len(rows)<8:
        diagnostics['segmentation']['rejectionCode']='TOO_FEW_VALID_LANDMARKS'
        result = insufficient('Không đủ khớp rõ theo góc quay để phân tích từng rep.')
    elif view=='SIDE' or oblique_from_side:
        result = analyze_samples([Sample(r['time'],r['knee'],r['hipAngle'],r['visibility'],r['lean'],r['travel']) for r in rows],cfg.max_gap_seconds,cfg,diagnostics['segmentation'])
    else:
        reps, reason = front_repetitions(rows,cfg,diagnostics['segmentation'])
        result = insufficient(reason) if reason else {'exercise':'SQUAT','status':'COMPLETED','quality':'SUFFICIENT','detectedRepetitions':len(reps),'repetitions':reps,'observations':[],'criteria':[],'limitations':[],'ruleVersion':RULE_VERSION}
    if result['status']=='COMPLETED' and view=='OBLIQUE':
        # A single visible leg can support cycle timing. Projected side-form
        # comparisons must not become technique claims at an oblique angle.
        result['observations']=[]
        result['criteria']=[]
        result['limitations']=[]
        for rep in result['repetitions']:
            rep['observations']=[]
            for key in ('hipTravelRatio','minimumKneeAngle','rangeDegrees','bottomHipAngleDegrees','maximumTorsoLeanDegrees','bottomKneeTravelRatio'):
                if key in rep:
                    rep[key]=None
    if result['status']=='COMPLETED':
        comparisons = [c for c in result.get('criteria',[]) if c['code']!='LEFT_RIGHT_SYMMETRY']
        # Keep existing within-clip comparisons, but expose them separately from technique criteria.
        for rep in result['repetitions']:
            for obs in rep['observations']:
                obs.update(kind='WITHIN_CLIP_COMPARISON',cameraAngle=view,validation='PROVISIONAL_NOT_COACH_VALIDATED')
            assess_rep(rep,rows,view,side,protocol,cfg)
        if any(not rep['techniqueTrackingSufficient'] for rep in result['repetitions']):
            for rep in result['repetitions']:
                rep['observations'] = [o for o in rep['observations'] if o.get('kind')!='WITHIN_CLIP_COMPARISON']
            for c in comparisons:
                c.update(status='NOT_ASSESSED',reason='Chất lượng theo dõi giữa các rep chưa đủ để so sánh.')
        result['observations'] = [o for rep in result['repetitions'] for o in rep['observations']]
        for rep in result['repetitions']:
            for part,details in rep['bodyParts'].items():
                details['observationCodes']=[o['code'] for o in rep['observations'] if o['bodyPart']==part]
        result['observations'].sort(key=lambda o:(o.get('kind')!='OBSERVABLE_SIGNAL',o['timestampSeconds']))
        summary=[]
        for code in CRITERIA:
            checks=[c for rep in result['repetitions'] for c in rep['criteria'] if c['code']==code]
            assessed=[c for c in checks if c['status']=='ASSESSED']
            c=check(code,cfg,None if assessed else checks[0]['reason'])
            if not assessed and checks[0].get('reasonCode'):
                c['reasonCode']=checks[0]['reasonCode']
            c.update(assessedReps=len(assessed),totalReps=len(checks),signalReps=sum(c['outcome']=='SIGNAL' for c in checks),outcome='SIGNAL' if any(c['outcome']=='SIGNAL' for c in checks) else 'MEASURED' if assessed and code=='MOVEMENT_TIMING' else 'NO_SIGNAL' if assessed else 'NOT_ASSESSED')
            summary.append(c)
        threshold_keys = {'DEPTH_CONSISTENCY':'comparison_rom_ratio','TORSO_LEAN_CHANGE':'comparison_torso_degrees','TEMPO_CONSISTENCY':'comparison_tempo_ratio','KNEE_TRAVEL_CONSISTENCY':'comparison_knee_travel_ratio'}
        for c in comparisons:
            key = threshold_keys[c['code']]
            c.update(kind='WITHIN_CLIP_COMPARISON',thresholds={key:getattr(cfg,key)},detectionRule=f'{key} = {getattr(cfg,key)}',validation='PROVISIONAL_NOT_COACH_VALIDATED')
        result['criteria']=summary+comparisons
    else:
        result['criteria']=unavailable_checks(cfg,result['limitations'][0],protocol,view)
    result.update(cameraView=camera,protocol=protocol,thresholdConfig=cfg.snapshot(),validationStatus='NOT_COACH_VALIDATED',priorityObservationCode=result['observations'][0]['code'] if result['observations'] else None)
    result['trackingDetails'] = {'usableFrames':len(rows),'poseFrames':len(frames),'coveragePolicy':'complete_continuous_repetitions'}
    if view=='OBLIQUE':
        result['limitations'].append('Góc chéo: chỉ đo chu kỳ và nhịp chuyển động; chưa kết luận độ sâu, độ nghiêng thân hoặc hướng gối. Quay ngang hoặc chính diện để kiểm tra các tiêu chí đó.')
    result['limitations'] += ['Các ngưỡng quan sát đang thử nghiệm, chưa có độ chính xác xác nhận bằng nhãn Coach.', 'Chỉ mô tả chuyển động 2D; không kết luận cong lưng, chụm gối, nhấc gót, mất thăng bằng hoặc an toàn.', 'Hệ thống giả định video là Squat; chưa loại trừ được mọi bài tập khác.']
    for f,v in zip(frames,views):
        f['side'] = side.upper() if view=='SIDE' else 'BOTH'
        f['repNumber']=next((r['number'] for r in result['repetitions'] if r['startSeconds']<=f['timeSeconds']<=r['endSeconds']),None)
        g=geometry(f,width,height,view,side,cfg)
        f['kneeAngleDegrees']=round(g['knee'],1) if g and view=='SIDE' else None
        f['torsoLeanDegrees']=round(g['lean'],1) if g and view=='SIDE' else None
    return result


def segment_measurement(rows, view, cfg):
    """Measure observed motion independently of completing a repetition."""
    segments=[]
    for row in rows:
        if not segments or row['time']-segments[-1][-1]['time']>cfg.max_gap_seconds:
            segments.append([])
        segments[-1].append(row)
    segments=[s for s in segments if len(s)>=8 and s[-1]['time']-s[0]['time']>=cfg.minimum_rep_seconds]
    evidence=[]
    for segment in segments:
        item={'startSeconds':segment[0]['time'],'endSeconds':segment[-1]['time'],'validFrames':len(segment)}
        if 'knee' in segment[0]:
            item.update(kneeDegrees=value_range(r['knee'] for r in segment),hipDegrees=value_range(r['hipAngle'] for r in segment))
        else:
            item['hipAnkleOffsetPixels']=value_range(r['hipY']-r['ankleY'] for r in segment)
        evidence.append(item)
    reason=None if evidence else 'Chưa có đoạn liên tục đủ khớp hợp lệ để đo biên độ chuyển động.'
    return {'code':'JOINT_MOTION','title':'Biên độ chuyển động quan sát được','status':'ASSESSED' if evidence else 'NOT_ASSESSED',
            'outcome':'MEASURED' if evidence else 'NOT_ASSESSED','reason':reason,'reasonCode':None if evidence else 'NO_VALID_SEGMENT',
            'cameraAngle':'ANY_TRACKED','landmarks':['shoulder','hip','knee','ankle'],'formula':'Range of projected joint angles (side) or ankle-relative hip height (front/oblique) within continuous segments',
            'evidence':{'segments':evidence,'description':'Đo trên đoạn khớp theo dõi liên tục, không cần rep hoàn chỉnh; không chấm đúng/sai.'},
            'qualityConditions':'Ít nhất 8 mẫu hợp lệ liên tục; không nối qua khoảng mất dấu dài.',
            'limitation':'Biên độ trên ảnh không xác nhận đó là Squat, độ sâu đạt chuẩn hay kỹ thuật đúng.'}


def annotate_requirements(criterion, view, protocol, has_reps):
    code=criterion['code']
    implemented=code not in ('LUMBAR_CURVATURE','HEEL_LIFT','BALANCE','LEFT_RIGHT_SYMMETRY')
    scope='UNIMPLEMENTED' if not implemented else 'VALID_SEGMENT' if code=='JOINT_MOTION' else 'MULTIPLE_REPETITIONS' if code.endswith('CONSISTENCY') or code=='TORSO_LEAN_CHANGE' else 'COMPLETE_REPETITION'
    required_view=criterion.get('cameraAngle','SIDE')
    goal='depthTarget' if code=='DEPTH_TARGET' else 'descentTargetSeconds' if code=='DESCENT_TARGET' else None
    criterion['requirements']={'implemented':implemented,'scope':scope,'cameraView':required_view,'goal':goal,'landmarks':criterion.get('landmarks',[])}
    if criterion['status']=='ASSESSED':
        criterion['reasonCode']=None
    elif not implemented:
        criterion['reasonCode']='NOT_IMPLEMENTED'
    elif required_view in ('SIDE','FRONT') and view!=required_view:
        criterion['reasonCode']='VIEW_NOT_SUITABLE'
    elif goal and (protocol[goal] is None or protocol[goal]=='NONE'):
        criterion['reasonCode']='GOAL_NOT_SET'
    elif not has_reps and scope in ('COMPLETE_REPETITION','MULTIPLE_REPETITIONS'):
        criterion['reasonCode']='NO_COMPLETE_REPETITION'
    else:
        criterion.setdefault('reasonCode','TRACKING_OR_PHASE_QUALITY')


def analyze_pose_frames(frames, width, height, options=None, config=None, diagnostics=None):
    cfg=config or SquatConfig()
    diag=diagnostics if diagnostics is not None else {'schemaVersion':1}
    diag.update(pose_diagnostics(frames,width,height,cfg))
    diag.setdefault('segmentation',{})
    result=_analyze_pose_frames(frames,width,height,options,cfg,diag)
    view=result.get('cameraView',{}).get('detected','UNKNOWN')
    rows=diag.pop('_rows',[])
    signal_rows=diag['segmentation'].get('signal',[])
    if not result['repetitions'] and signal_rows:
        span=value_range(r['smoothed'] for r in signal_rows)['range']
        onset=cfg.onset_degrees if view=='SIDE' else cfg.front_onset_ratio
        if span is not None and span<onset:
            old_reason=result['limitations'][0]
            reason='Có điểm khớp nhưng biên độ chuyển động chưa đạt ngưỡng bắt đầu Squat; không tìm thấy chu kỳ xuống và đứng lên.'
            result['limitations'][0]=reason
            diag['segmentation']['rejectionCode']='NO_SQUAT_MOVEMENT'
            for c in result['criteria']:
                if c.get('reason')==old_reason:
                    c['reason']=reason
    result['criteria'].append(segment_measurement(rows,view,cfg))
    protocol=parse_protocol(options)
    for criterion in result['criteria']:
        annotate_requirements(criterion,view,protocol,bool(result['repetitions']))
        if criterion.get('reasonCode')=='NO_COMPLETE_REPETITION' and diag['segmentation'].get('rejectionCode') in ('NO_STANDING_REFERENCE','TOO_FEW_VALID_LANDMARKS','NO_SQUAT_MOVEMENT'):
            criterion['reasonCode']=diag['segmentation']['rejectionCode']
    for rep in result['repetitions']:
        for criterion in rep['criteria']:
            annotate_requirements(criterion,view,protocol,True)
    diag['camera']=result.get('cameraView')
    result['analysisCoverage']='COMPLETE_REPETITIONS' if result['repetitions'] else 'VALID_SEGMENTS_ONLY' if any(c['status']=='ASSESSED' for c in result['criteria']) else 'NONE'
    return finalize_diagnostics(result,diag)
