"""Observable squat signals. Thresholds are provisional and require coach validation."""
from dataclasses import dataclass
from math import acos, degrees, hypot, isfinite
from statistics import median
from diagnostics import state_event

RULE_VERSION = "squat-observation-7"
VISIBILITY_MIN = 0.6
STANDING_ANGLE = 155.0  # segmentation only, not a safety threshold
MIN_ROM_DEGREES = 35.0  # provisional movement signal
TORSO_LEAN_CHANGE_DEGREES = 12.0  # within-video change, not a safe-angle threshold
TEMPO_RATIO_MIN = 1.6  # provisional within-video change, not an ideal cadence
KNEE_TRAVEL_CHANGE_MIN = 0.2  # normalized by visible shank length


@dataclass
class Sample:
    time: float
    knee_angle: float
    hip_angle: float
    visibility: float
    torso_lean: float = 0.0
    knee_travel: float | None = None


def angle(a, b, c):
    ba = (a[0] - b[0], a[1] - b[1])
    bc = (c[0] - b[0], c[1] - b[1])
    size = hypot(*ba) * hypot(*bc)
    if size < 1e-8:
        return None
    cosine = max(-1.0, min(1.0, (ba[0] * bc[0] + ba[1] * bc[1]) / size))
    return degrees(acos(cosine))


def image_point(x, y, width, height):
    """Use equal units on both axes before measuring angles in a non-square frame."""
    return x * width, y * height


def make_observation(code, rep, message, suggestion, body_part, timestamp, evidence, limitation, landmarks):
    return {
        "code": code,
        "bodyPart": body_part,
        "repNumber": rep["number"],
        "timestampSeconds": round(timestamp, 2),
        "message": message,
        "suggestion": suggestion,
        "confidence": rep["landmarkVisibility"],
        "confidenceBasis": "median_landmark_visibility_not_diagnostic_accuracy",
        "cameraAngle": "SIDE",
        "landmarks": landmarks,
        "evidence": evidence,
        "limitation": limitation,
    }


def criteria(reps):
    two = len(reps) >= 2
    travel = sum(rep["bottomKneeTravelRatio"] is not None for rep in reps) >= 2
    common = "Một người, góc ngang, thấy rõ vai, hông, gối và cổ chân trong ít nhất 55% khung hình."
    return [
        {"code": "DEPTH_CONSISTENCY", "status": "ASSESSED" if two else "NOT_ASSESSED", "reason": None if two else "Cần ít nhất hai lần Squat.", "cameraAngle": "SIDE", "landmarks": ["hip", "knee", "ankle"], "formula": "Biên độ góc gối = góc lúc đứng - góc nhỏ nhất; so sánh các lần.", "qualityConditions": common, "detectionRule": "Biên độ dưới 70% lần lớn nhất (ngưỡng thử nghiệm).", "limitation": "Không xác nhận độ sâu Squat đúng cho từng người."},
        {"code": "TORSO_LEAN_CHANGE", "status": "ASSESSED" if two else "NOT_ASSESSED", "reason": None if two else "Cần ít nhất hai lần Squat.", "cameraAngle": "SIDE", "landmarks": ["shoulder", "hip"], "formula": "Góc thân so với phương dọc; so sánh lần cuối với lần đầu.", "qualityConditions": common, "detectionRule": "Tăng ít nhất 12° (ngưỡng thử nghiệm).", "limitation": "Không phát hiện cong lưng từ hai điểm vai–hông."},
        {"code": "TEMPO_CONSISTENCY", "status": "ASSESSED" if two else "NOT_ASSESSED", "reason": None if two else "Cần ít nhất hai lần Squat.", "cameraAngle": "SIDE", "landmarks": ["hip", "knee", "ankle"], "formula": "Thời gian xuống = đáy - bắt đầu; thời gian lên = kết thúc - đáy.", "qualityConditions": common, "detectionRule": "Một pha dài hơn 1,6 lần pha ngắn nhất cùng loại (ngưỡng thử nghiệm).", "limitation": "Nhịp nhanh hoặc chậm không tự nó là lỗi kỹ thuật."},
        {"code": "KNEE_TRAVEL_CONSISTENCY", "status": "ASSESSED" if travel else "NOT_ASSESSED", "reason": None if travel else "Cần hai lần thấy rõ gối và cổ chân ở đáy.", "cameraAngle": "SIDE", "landmarks": ["knee", "ankle"], "formula": "Khoảng ngang gối–cổ chân ở đáy / chiều dài cẳng chân trên ảnh.", "qualityConditions": common, "detectionRule": "Chênh lệch tỷ số ít nhất 0,2 giữa các lần (ngưỡng thử nghiệm).", "limitation": "Không kết luận gối vượt mũi chân là sai."},
        {"code": "LEFT_RIGHT_SYMMETRY", "status": "NOT_ASSESSED", "reason": "Góc ngang không cho thấy đáng tin cậy cả hai bên.", "cameraAngle": "FRONT", "landmarks": ["left_hip", "right_hip", "left_knee", "right_knee", "left_ankle", "right_ankle"], "formula": "Chưa triển khai cho góc chính diện.", "qualityConditions": "Cần video chính diện và cả hai chân rõ.", "detectionRule": "Chưa có ngưỡng đã kiểm chứng.", "limitation": "Không suy đoán mất cân xứng từ góc ngang."},
    ]


def analyze_samples(samples: list[Sample], max_gap_seconds=0.61, config=None, diagnostics=None):
    standing = config.standing_angle if config else STANDING_ANGLE
    onset = config.onset_degrees if config else 8
    min_rom = config.minimum_rom if config else MIN_ROM_DEGREES
    min_seconds = config.minimum_rep_seconds if config else .6
    visibility = config.visibility if config else VISIBILITY_MIN
    samples = [s for s in samples if s.visibility >= visibility and all(isfinite(v) for v in (s.time, s.knee_angle, s.hip_angle, s.torso_lean, s.visibility))]
    if len(samples) < 8:
        return insufficient("Không thấy đủ các khớp vai, hông, gối và cổ chân trong video.")
    if any(b.time <= a.time for a, b in zip(samples, samples[1:])):
        return insufficient("Thứ tự thời gian khung hình không hợp lệ.")
    # Three-frame median removes one-frame landmark jumps without inventing missing joints.
    angles = [median(s.knee_angle for s in samples[max(0, i-1):i+2] if abs(s.time - samples[i].time) <= max_gap_seconds) for i in range(len(samples))]
    reps = []
    phase = "standing"
    start = None
    bottom = None
    if diagnostics is not None:
        diagnostics.update(signal=[],signalUnits='projected_knee_degrees',rejectedCycles=[])
    for index, value in enumerate(angles):
        if index and samples[index].time - samples[index - 1].time > max_gap_seconds:
            phase, start, bottom = "standing", None, None
            state_event(diagnostics,samples[index].time,'SEEK_STANDING','TRACKING_GAP')
        if phase == "standing" and value >= standing:
            start = index
        elif phase == "standing" and start is not None and value < standing - onset:
            phase = "descending"
            bottom = index
        elif phase == "descending":
            if bottom is None or value < angles[bottom]:
                bottom = index
            if bottom is not None and value >= angles[bottom] + onset:
                phase = "ascending"
        elif phase == "ascending":
            if value >= standing and start is not None and bottom is not None:
                depth = angles[start] - angles[bottom]
                if depth >= min_rom and samples[index].time - samples[start].time >= min_seconds:
                    lean = max(samples[start:index + 1], key=lambda sample: sample.torso_lean)
                    reps.append({
                        "number": len(reps) + 1,
                        "startSeconds": round(samples[start].time, 2),
                        "bottomSeconds": round(samples[bottom].time, 2),
                        "endSeconds": round(samples[index].time, 2),
                        "standingKneeAngleDegrees": round(angles[start], 1),
                        "minimumKneeAngle": round(angles[bottom], 1),
                        "bottomHipAngleDegrees": round(samples[bottom].hip_angle, 1),
                        "rangeDegrees": round(depth, 1),
                        "descentSeconds": round(samples[bottom].time - samples[start].time, 2),
                        "ascentSeconds": round(samples[index].time - samples[bottom].time, 2),
                        "maximumTorsoLeanDegrees": round(lean.torso_lean, 1),
                        "maximumTorsoLeanAtSeconds": round(lean.time, 2),
                        "bottomKneeTravelRatio": round(samples[bottom].knee_travel, 2) if samples[bottom].knee_travel is not None else None,
                        "landmarkVisibility": round(median(s.visibility for s in samples[start:index + 1]), 2),
                        "observations": [],
                        "notAssessed": [{"code": "LEFT_RIGHT_SYMMETRY", "reason": "Góc ngang không đủ để đánh giá hai bên."}],
                    })
                    state_event(diagnostics,samples[index].time,'REP_COMPLETE')
                elif diagnostics is not None:
                    diagnostics['rejectedCycles'].append({'timeSeconds':samples[index].time,'reason':'RANGE_OR_DURATION_BELOW_MINIMUM','rangeDegrees':depth,'durationSeconds':samples[index].time-samples[start].time})
                phase, start, bottom = "standing", index, None
            elif bottom is not None and value < angles[bottom] - onset:
                phase = "descending"
                bottom = index
        state = phase.upper() if start is not None else 'SEEK_STANDING'
        state_event(diagnostics,samples[index].time,state)
        if diagnostics is not None:
            diagnostics['signal'].append({'timeSeconds':samples[index].time,'raw':samples[index].knee_angle,'smoothed':value,'state':state})
    if not reps:
        if diagnostics is not None:
            diagnostics['rejectionCode']='NO_COMPLETE_REPETITION'
        return insufficient("Không xác định được một chu kỳ đứng, xuống và đứng lên rõ ràng. Hãy quay toàn thân từ góc ngang.")
    observations = []
    def add(item, rep):
        observations.append(item)
        rep["observations"].append(item)

    if len(reps) >= 2:
        peak = max(rep["rangeDegrees"] for rep in reps)
        for rep in reps:
            if rep["rangeDegrees"] < peak * (config.comparison_rom_ratio if config else .7):
                add(make_observation("VARIABLE_ROM", rep, f"Lần {rep['number']} có biên độ gập gối nhỏ hơn các lần khác.", "Thử giữ phạm vi chuyển động ổn định theo khả năng; nhờ Coach xem nếu cần.", "KNEE", rep["bottomSeconds"], {"rangeDegrees": rep["rangeDegrees"], "largestRangeDegrees": peak, "ratio": round(rep["rangeDegrees"] / peak, 2)}, "So sánh trong cùng video, không xác nhận độ sâu đạt chuẩn.", ["hip", "knee", "ankle"]), rep)
        change = reps[-1]["maximumTorsoLeanDegrees"] - reps[0]["maximumTorsoLeanDegrees"]
        if change >= (config.comparison_torso_degrees if config else TORSO_LEAN_CHANGE_DEGREES):
            rep = reps[-1]
            add(make_observation("INCREASING_TORSO_LEAN", rep, "Thân người nghiêng nhiều hơn ở lần cuối so với lần đầu.", "Thử giảm tốc độ và giữ tư thế ổn định; nhờ Coach xem lại nếu cần.", "TORSO", rep["maximumTorsoLeanAtSeconds"], {"firstDegrees": reps[0]["maximumTorsoLeanDegrees"], "lastDegrees": rep["maximumTorsoLeanDegrees"], "changeDegrees": round(change, 1)}, "Không đánh giá độ cong của lưng.", ["shoulder", "hip"]), rep)
        for phase_key, phase_name in (("descentSeconds", "xuống"), ("ascentSeconds", "lên")):
            shortest = min(rep[phase_key] for rep in reps)
            if shortest > 0:
                for rep in reps:
                    if rep[phase_key] > shortest * (config.comparison_tempo_ratio if config else TEMPO_RATIO_MIN):
                        add(make_observation("VARIABLE_TEMPO", rep, f"Pha {phase_name} ở lần {rep['number']} kéo dài hơn các lần khác.", "Thử duy trì nhịp chuyển động đều và thoải mái; trao đổi với Coach nếu cần.", "WHOLE_BODY", rep["bottomSeconds"], {"phase": phase_key, "seconds": rep[phase_key], "shortestSeconds": shortest, "ratio": round(rep[phase_key] / shortest, 2)}, "Chênh lệch nhịp không tự nó là sai kỹ thuật.", ["hip", "knee", "ankle"]), rep)
        traveled = [rep for rep in reps if rep["bottomKneeTravelRatio"] is not None]
        if len(traveled) >= 2:
            minimum = min(rep["bottomKneeTravelRatio"] for rep in traveled)
            maximum = max(rep["bottomKneeTravelRatio"] for rep in traveled)
            if maximum - minimum >= (config.comparison_knee_travel_ratio if config else KNEE_TRAVEL_CHANGE_MIN):
                rep = max(traveled, key=lambda item: item["bottomKneeTravelRatio"])
                add(make_observation("VARIABLE_KNEE_TRAVEL", rep, f"Vị trí gối so với cổ chân ở lần {rep['number']} khác các lần khác.", "Thử giữ vị trí chân và nhịp tập nhất quán; nhờ Coach xem video nếu cần.", "KNEE", rep["bottomSeconds"], {"ratio": maximum, "smallestRatio": minimum, "difference": round(maximum - minimum, 2)}, "Không kết luận gối vượt mũi chân là sai.", ["knee", "ankle"]), rep)

    assessed = criteria(reps)
    for rep in reps:
        rep["notAssessed"] = [{"code": item["code"], "reason": item["reason"]} for item in assessed if item["status"] == "NOT_ASSESSED"]
        if rep["bottomKneeTravelRatio"] is None and not any(item["code"] == "KNEE_TRAVEL_CONSISTENCY" for item in rep["notAssessed"]):
            rep["notAssessed"].append({"code": "KNEE_TRAVEL_CONSISTENCY", "reason": "Không đủ điểm khớp gối–cổ chân ở đáy rep này."})
    return {"exercise": "SQUAT", "status": "COMPLETED", "quality": "SUFFICIENT", "detectedRepetitions": len(reps), "repetitions": reps, "observations": observations, "priorityObservationCode": observations[0]["code"] if observations else None, "criteria": assessed, "limitations": ["Chỉ mô tả chuyển động thấy được từ góc ngang; không chấm điểm đúng/sai hoặc mức độ an toàn.", "Các ngưỡng là thử nghiệm và chưa được kiểm chứng trên video do Coach gắn nhãn.", "Hệ thống giả định bạn gửi bài Squat; chưa có mô hình phân loại để loại trừ mọi bài tập khác."], "ruleVersion": RULE_VERSION}


def insufficient(message, status="INSUFFICIENT_DATA"):
    return {"exercise": "SQUAT", "status": status, "quality": "INSUFFICIENT", "detectedRepetitions": None, "repetitions": [], "observations": [], "criteria": criteria([]), "limitations": [message], "ruleVersion": RULE_VERSION}
