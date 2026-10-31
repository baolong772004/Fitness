# Pipeline diagnostic results

Actual inference outputs. REAL clips have no Coach-confirmed labels; EDITED fixtures are reproducible edits of real footage, not independent accuracy evidence. No PASS labels or accuracy percentages are inferred from model output.

Sources: [Pexels front](https://www.pexels.com/video/woman-doing-squat-exercise-5034577/), [Pexels oblique](https://www.pexels.com/video/a-woman-in-activewear-doing-squats-at-home-8837221/), [YMove free clips](https://ymove.app/free-exercise-videos).

| Case | Type | FPS | Decoded / sampled / pose / valid geometry | Pose rate | Valid rate of samples | Before reps | After reps | Status / view | Transitions |
|---|---|---:|---|---:|---:|---:|---:|---|---:|
| side | REAL | 29.970 | 614 / 205 / 205 / 205 | 100.0% | 100.0% | 2 | 2 | COMPLETED / SIDE | 8 |
| front | REAL | 29.970 | 495 / 165 / 165 / 165 | 100.0% | 100.0% | 5 | 5 | COMPLETED / FRONT | 15 |
| barbell | REAL | 25.000 | 350 / 140 / 140 / 140 | 100.0% | 100.0% | 4 | 4 | COMPLETED / SIDE | 16 |
| dumbbell | REAL | 25.000 | 478 / 191 / 191 / 191 | 100.0% | 100.0% | 5 | 5 | COMPLETED / SIDE | 20 |
| kettlebell | REAL | 25.000 | 430 / 172 / 172 / 172 | 100.0% | 100.0% | 5 | 5 | COMPLETED / SIDE | 20 |
| oblique | REAL | 25.000 | 639 / 256 / 256 / 256 | 100.0% | 100.0% | 5 | 5 | COMPLETED / OBLIQUE | 20 |
| non-squat | REAL | 25.000 | 327 / 131 / 131 / 131 | 100.0% | 100.0% | None | None | INSUFFICIENT_DATA / SIDE | 0 |
| front-mid-rep | EDITED | 30.034 | 471 / 157 / 157 / 157 | 100.0% | 100.0% | 4 | 4 | COMPLETED / FRONT | 13 |
| front-delayed | EDITED | 29.970 | 585 / 195 / 195 / 195 | 100.0% | 100.0% | 5 | 5 | COMPLETED / FRONT | 15 |
| front-short-gap | EDITED | 29.970 | 495 / 165 / 163 / 163 | 98.8% | 98.8% | 5 | 5 | COMPLETED / FRONT | 15 |
| front-long-gap | EDITED | 29.970 | 495 / 165 / 156 / 156 | 94.5% | 94.5% | 4 | 4 | COMPLETED / FRONT | 15 |
| front-static | EDITED | 25.168 | 149 / 60 / 60 / 60 | 100.0% | 100.0% | None | None | INSUFFICIENT_DATA / FRONT | 0 |
| front-vfr | EDITED | 22.613 | 375 / 165 / 165 / 165 | 100.0% | 100.0% | 6 | 5 | COMPLETED / FRONT | 15 |
| front-rotation-metadata | EDITED | 29.970 | 495 / 165 / 165 / 165 | 100.0% | 100.0% | 5 | 5 | COMPLETED / FRONT | 15 |
| variable-depth | EDITED | 29.970 | 217 / 73 / 73 / 73 | 100.0% | 100.0% | 2 | 2 | COMPLETED / SIDE | 9 |
| legacy-first | REAL | 14.095 | 0 / 0 / 0 / 0 | 0.0% | 0.0% | None | None | INSUFFICIENT_DATA / UNKNOWN | 0 |
| legacy-second | REAL | 14.993 | 0 / 0 / 0 / 0 | 0.0% | 0.0% | None | None | INSUFFICIENT_DATA / UNKNOWN | 0 |
| legacy-third | REAL | 14.997 | 0 / 0 / 0 / 0 | 0.0% | 0.0% | None | None | INSUFFICIENT_DATA / UNKNOWN | 0 |

## side

Input: `samples/github-side-squat.mp4` (REAL). Coach ground truth: unavailable.
Transformation: none
[Full result](private/pipeline-debug/side.after-v6.json) · [Angle / state / frame timeline CSV](private/pipeline-debug/side.timeline.csv)

Before: COMPLETED, 2 reps. After: COMPLETED, 2 reps.
Rejection: null
Orientation: 0.0°, auto=True, displayed size=608×1080; timestamp fallbacks=0.
Selected side: right; rejection counts: `{"leftKnee:LOW_VISIBILITY": 204, "leftAnkle:LOW_VISIBILITY": 125, "leftHeel:LOW_VISIBILITY": 72, "leftToe:LOW_VISIBILITY": 4}`.
Projected angle ranges: `{"leftKneeAngle": {"count": 1, "min": 58.306, "max": 58.306, "range": 0.0}, "leftHipAngle": {"count": 1, "min": 67.094, "max": 67.094, "range": 0.0}, "rightKneeAngle": {"count": 205, "min": 71.847, "max": 177.043, "range": 105.195}, "rightHipAngle": {"count": 205, "min": 67.746, "max": 179.668, "range": 111.922}}`.
Raw/smoothed signal ranges: `{"signalUnits": "projected_knee_degrees", "rawRange": {"count": 205, "min": 71.847, "max": 177.043, "range": 105.195}, "smoothedRange": {"count": 205, "min": 75.133, "max": 175.43, "range": 100.298}}`.

| Criterion | Scope | Outcome | Reason code | Reason |
|---|---|---|---|---|
| MOVEMENT_TIMING | COMPLETE_REPETITION | MEASURED |  |  |
| DEPTH_TARGET | COMPLETE_REPETITION | NOT_ASSESSED | GOAL_NOT_SET | Chưa chọn mục tiêu độ sâu; không áp đặt độ sâu mặc định. |
| TORSO_ASCENT_CHANGE | COMPLETE_REPETITION | NOT_ASSESSED | TRACKING_OR_PHASE_QUALITY | Vị trí chân hoặc tỷ lệ cơ thể trên ảnh thay đổi; chưa tách được chuyển động camera và người tập. |
| DESCENT_TARGET | COMPLETE_REPETITION | NOT_ASSESSED | GOAL_NOT_SET | Chưa chọn thời gian xuống mục tiêu. |
| KNEE_INWARD_LEFT | COMPLETE_REPETITION | NOT_ASSESSED | VIEW_NOT_SUITABLE | Cần góc chính diện và thấy rõ hai bàn chân. |
| KNEE_INWARD_RIGHT | COMPLETE_REPETITION | NOT_ASSESSED | VIEW_NOT_SUITABLE | Cần góc chính diện và thấy rõ hai bàn chân. |
| LUMBAR_CURVATURE | UNIMPLEMENTED | NOT_ASSESSED | NOT_IMPLEMENTED | Hai điểm vai–hông không mô tả độ cong cột sống. |
| HEEL_LIFT | UNIMPLEMENTED | NOT_ASSESSED | NOT_IMPLEMENTED | Landmark gót xuất hiện không chứng minh gót chạm hay rời sàn. |
| BALANCE | UNIMPLEMENTED | NOT_ASSESSED | NOT_IMPLEMENTED | Video 2D không cung cấp trọng tâm hay lực tiếp xúc bàn chân. |
| LEFT_RIGHT_SYMMETRY | UNIMPLEMENTED | NOT_ASSESSED | NOT_IMPLEMENTED | Hai bên có số đo khác không tự chứng minh bất đối xứng kỹ thuật. |
| DEPTH_CONSISTENCY | MULTIPLE_REPETITIONS | NOT_ASSESSED | TRACKING_OR_PHASE_QUALITY | Chất lượng theo dõi giữa các rep chưa đủ để so sánh. |
| TORSO_LEAN_CHANGE | MULTIPLE_REPETITIONS | NOT_ASSESSED | TRACKING_OR_PHASE_QUALITY | Chất lượng theo dõi giữa các rep chưa đủ để so sánh. |
| TEMPO_CONSISTENCY | MULTIPLE_REPETITIONS | NOT_ASSESSED | TRACKING_OR_PHASE_QUALITY | Chất lượng theo dõi giữa các rep chưa đủ để so sánh. |
| KNEE_TRAVEL_CONSISTENCY | MULTIPLE_REPETITIONS | NOT_ASSESSED | TRACKING_OR_PHASE_QUALITY | Chất lượng theo dõi giữa các rep chưa đủ để so sánh. |
| JOINT_MOTION | VALID_SEGMENT | MEASURED |  |  |

## front

Input: `samples/front-facing-squat-pexels-5034577.mp4` (REAL). Coach ground truth: unavailable.
Transformation: none
[Full result](private/pipeline-debug/front.after-v6.json) · [Angle / state / frame timeline CSV](private/pipeline-debug/front.timeline.csv)

Before: COMPLETED, 5 reps. After: COMPLETED, 5 reps.
Rejection: null
Orientation: 0.0°, auto=True, displayed size=1920×1080; timestamp fallbacks=0.
Selected side: left; rejection counts: `{}`.
Projected angle ranges: `{"leftKneeAngle": {"count": 165, "min": 132.655, "max": 179.691, "range": 47.035}, "leftHipAngle": {"count": 165, "min": 123.131, "max": 165.822, "range": 42.691}, "rightKneeAngle": {"count": 165, "min": 141.749, "max": 179.857, "range": 38.109}, "rightHipAngle": {"count": 165, "min": 133.676, "max": 166.685, "range": 33.009}}`.
Raw/smoothed signal ranges: `{"signalUnits": "standing_leg_ratio", "rawRange": {"count": 165, "min": -0.023, "max": 0.435, "range": 0.458}, "smoothedRange": {"count": 165, "min": -0.022, "max": 0.434, "range": 0.456}}`.

| Criterion | Scope | Outcome | Reason code | Reason |
|---|---|---|---|---|
| MOVEMENT_TIMING | COMPLETE_REPETITION | MEASURED |  |  |
| DEPTH_TARGET | COMPLETE_REPETITION | NOT_ASSESSED | VIEW_NOT_SUITABLE | Cần góc ngang để so vị trí hông và gối. |
| TORSO_ASCENT_CHANGE | COMPLETE_REPETITION | NOT_ASSESSED | VIEW_NOT_SUITABLE | Cần góc ngang để quan sát vai và hông khi đứng lên. |
| DESCENT_TARGET | COMPLETE_REPETITION | NOT_ASSESSED | GOAL_NOT_SET | Chưa chọn thời gian xuống mục tiêu. |
| KNEE_INWARD_LEFT | COMPLETE_REPETITION | NO_SIGNAL |  |  |
| KNEE_INWARD_RIGHT | COMPLETE_REPETITION | NO_SIGNAL |  |  |
| LUMBAR_CURVATURE | UNIMPLEMENTED | NOT_ASSESSED | NOT_IMPLEMENTED | Hai điểm vai–hông không mô tả độ cong cột sống. |
| HEEL_LIFT | UNIMPLEMENTED | NOT_ASSESSED | NOT_IMPLEMENTED | Landmark gót xuất hiện không chứng minh gót chạm hay rời sàn. |
| BALANCE | UNIMPLEMENTED | NOT_ASSESSED | NOT_IMPLEMENTED | Video 2D không cung cấp trọng tâm hay lực tiếp xúc bàn chân. |
| LEFT_RIGHT_SYMMETRY | UNIMPLEMENTED | NOT_ASSESSED | NOT_IMPLEMENTED | Hai bên có số đo khác không tự chứng minh bất đối xứng kỹ thuật. |
| JOINT_MOTION | VALID_SEGMENT | MEASURED |  |  |

## barbell

Input: `samples/barbell-back-squat.mp4` (REAL). Coach ground truth: unavailable.
Transformation: none
[Full result](private/pipeline-debug/barbell.after-v6.json) · [Angle / state / frame timeline CSV](private/pipeline-debug/barbell.timeline.csv)

Before: COMPLETED, 4 reps. After: COMPLETED, 4 reps.
Rejection: null
Orientation: 0.0°, auto=True, displayed size=720×1280; timestamp fallbacks=0.
Selected side: left; rejection counts: `{}`.
Projected angle ranges: `{"leftKneeAngle": {"count": 140, "min": 49.524, "max": 177.307, "range": 127.783}, "leftHipAngle": {"count": 140, "min": 48.862, "max": 179.916, "range": 131.054}, "rightKneeAngle": {"count": 140, "min": 34.016, "max": 170.762, "range": 136.746}, "rightHipAngle": {"count": 140, "min": 41.709, "max": 172.097, "range": 130.388}}`.
Raw/smoothed signal ranges: `{"signalUnits": "projected_knee_degrees", "rawRange": {"count": 140, "min": 49.524, "max": 177.307, "range": 127.783}, "smoothedRange": {"count": 140, "min": 53.351, "max": 176.933, "range": 123.582}}`.

| Criterion | Scope | Outcome | Reason code | Reason |
|---|---|---|---|---|
| MOVEMENT_TIMING | COMPLETE_REPETITION | MEASURED |  |  |
| DEPTH_TARGET | COMPLETE_REPETITION | NOT_ASSESSED | GOAL_NOT_SET | Chưa chọn mục tiêu độ sâu; không áp đặt độ sâu mặc định. |
| TORSO_ASCENT_CHANGE | COMPLETE_REPETITION | NO_SIGNAL |  |  |
| DESCENT_TARGET | COMPLETE_REPETITION | NOT_ASSESSED | GOAL_NOT_SET | Chưa chọn thời gian xuống mục tiêu. |
| KNEE_INWARD_LEFT | COMPLETE_REPETITION | NOT_ASSESSED | VIEW_NOT_SUITABLE | Cần góc chính diện và thấy rõ hai bàn chân. |
| KNEE_INWARD_RIGHT | COMPLETE_REPETITION | NOT_ASSESSED | VIEW_NOT_SUITABLE | Cần góc chính diện và thấy rõ hai bàn chân. |
| LUMBAR_CURVATURE | UNIMPLEMENTED | NOT_ASSESSED | NOT_IMPLEMENTED | Hai điểm vai–hông không mô tả độ cong cột sống. |
| HEEL_LIFT | UNIMPLEMENTED | NOT_ASSESSED | NOT_IMPLEMENTED | Landmark gót xuất hiện không chứng minh gót chạm hay rời sàn. |
| BALANCE | UNIMPLEMENTED | NOT_ASSESSED | NOT_IMPLEMENTED | Video 2D không cung cấp trọng tâm hay lực tiếp xúc bàn chân. |
| LEFT_RIGHT_SYMMETRY | UNIMPLEMENTED | NOT_ASSESSED | NOT_IMPLEMENTED | Hai bên có số đo khác không tự chứng minh bất đối xứng kỹ thuật. |
| DEPTH_CONSISTENCY | MULTIPLE_REPETITIONS | NOT_ASSESSED | TRACKING_OR_PHASE_QUALITY | Chất lượng theo dõi giữa các rep chưa đủ để so sánh. |
| TORSO_LEAN_CHANGE | MULTIPLE_REPETITIONS | NOT_ASSESSED | TRACKING_OR_PHASE_QUALITY | Chất lượng theo dõi giữa các rep chưa đủ để so sánh. |
| TEMPO_CONSISTENCY | MULTIPLE_REPETITIONS | NOT_ASSESSED | TRACKING_OR_PHASE_QUALITY | Chất lượng theo dõi giữa các rep chưa đủ để so sánh. |
| KNEE_TRAVEL_CONSISTENCY | MULTIPLE_REPETITIONS | NOT_ASSESSED | TRACKING_OR_PHASE_QUALITY | Chất lượng theo dõi giữa các rep chưa đủ để so sánh. |
| JOINT_MOTION | VALID_SEGMENT | MEASURED |  |  |

## dumbbell

Input: `samples/dumbbell-goblet-squat.mp4` (REAL). Coach ground truth: unavailable.
Transformation: none
[Full result](private/pipeline-debug/dumbbell.after-v6.json) · [Angle / state / frame timeline CSV](private/pipeline-debug/dumbbell.timeline.csv)

Before: COMPLETED, 5 reps. After: COMPLETED, 5 reps.
Rejection: null
Orientation: 0.0°, auto=True, displayed size=720×1280; timestamp fallbacks=0.
Selected side: right; rejection counts: `{"leftAnkle:LOW_VISIBILITY": 2, "leftHeel:LOW_VISIBILITY": 1}`.
Projected angle ranges: `{"leftKneeAngle": {"count": 189, "min": 43.031, "max": 179.863, "range": 136.832}, "leftHipAngle": {"count": 189, "min": 48.65, "max": 179.682, "range": 131.033}, "rightKneeAngle": {"count": 191, "min": 76.008, "max": 179.679, "range": 103.671}, "rightHipAngle": {"count": 191, "min": 77.25, "max": 179.314, "range": 102.065}}`.
Raw/smoothed signal ranges: `{"signalUnits": "projected_knee_degrees", "rawRange": {"count": 191, "min": 76.008, "max": 179.679, "range": 103.671}, "smoothedRange": {"count": 191, "min": 76.372, "max": 179.489, "range": 103.118}}`.

| Criterion | Scope | Outcome | Reason code | Reason |
|---|---|---|---|---|
| MOVEMENT_TIMING | COMPLETE_REPETITION | MEASURED |  |  |
| DEPTH_TARGET | COMPLETE_REPETITION | NOT_ASSESSED | GOAL_NOT_SET | Chưa chọn mục tiêu độ sâu; không áp đặt độ sâu mặc định. |
| TORSO_ASCENT_CHANGE | COMPLETE_REPETITION | NO_SIGNAL |  |  |
| DESCENT_TARGET | COMPLETE_REPETITION | NOT_ASSESSED | GOAL_NOT_SET | Chưa chọn thời gian xuống mục tiêu. |
| KNEE_INWARD_LEFT | COMPLETE_REPETITION | NOT_ASSESSED | VIEW_NOT_SUITABLE | Cần góc chính diện và thấy rõ hai bàn chân. |
| KNEE_INWARD_RIGHT | COMPLETE_REPETITION | NOT_ASSESSED | VIEW_NOT_SUITABLE | Cần góc chính diện và thấy rõ hai bàn chân. |
| LUMBAR_CURVATURE | UNIMPLEMENTED | NOT_ASSESSED | NOT_IMPLEMENTED | Hai điểm vai–hông không mô tả độ cong cột sống. |
| HEEL_LIFT | UNIMPLEMENTED | NOT_ASSESSED | NOT_IMPLEMENTED | Landmark gót xuất hiện không chứng minh gót chạm hay rời sàn. |
| BALANCE | UNIMPLEMENTED | NOT_ASSESSED | NOT_IMPLEMENTED | Video 2D không cung cấp trọng tâm hay lực tiếp xúc bàn chân. |
| LEFT_RIGHT_SYMMETRY | UNIMPLEMENTED | NOT_ASSESSED | NOT_IMPLEMENTED | Hai bên có số đo khác không tự chứng minh bất đối xứng kỹ thuật. |
| DEPTH_CONSISTENCY | MULTIPLE_REPETITIONS | ASSESSED |  |  |
| TORSO_LEAN_CHANGE | MULTIPLE_REPETITIONS | ASSESSED |  |  |
| TEMPO_CONSISTENCY | MULTIPLE_REPETITIONS | ASSESSED |  |  |
| KNEE_TRAVEL_CONSISTENCY | MULTIPLE_REPETITIONS | ASSESSED |  |  |
| JOINT_MOTION | VALID_SEGMENT | MEASURED |  |  |

## kettlebell

Input: `samples/kettlebell-goblet-squat.mp4` (REAL). Coach ground truth: unavailable.
Transformation: none
[Full result](private/pipeline-debug/kettlebell.after-v6.json) · [Angle / state / frame timeline CSV](private/pipeline-debug/kettlebell.timeline.csv)

Before: COMPLETED, 5 reps. After: COMPLETED, 5 reps.
Rejection: null
Orientation: 0.0°, auto=True, displayed size=720×1280; timestamp fallbacks=0.
Selected side: left; rejection counts: `{}`.
Projected angle ranges: `{"leftKneeAngle": {"count": 172, "min": 50.253, "max": 176.185, "range": 125.932}, "leftHipAngle": {"count": 172, "min": 67.703, "max": 179.784, "range": 112.081}, "rightKneeAngle": {"count": 172, "min": 82.761, "max": 179.369, "range": 96.608}, "rightHipAngle": {"count": 172, "min": 108.061, "max": 179.583, "range": 71.521}}`.
Raw/smoothed signal ranges: `{"signalUnits": "projected_knee_degrees", "rawRange": {"count": 172, "min": 50.253, "max": 176.185, "range": 125.932}, "smoothedRange": {"count": 172, "min": 51.194, "max": 175.46, "range": 124.266}}`.

| Criterion | Scope | Outcome | Reason code | Reason |
|---|---|---|---|---|
| MOVEMENT_TIMING | COMPLETE_REPETITION | MEASURED |  |  |
| DEPTH_TARGET | COMPLETE_REPETITION | NOT_ASSESSED | GOAL_NOT_SET | Chưa chọn mục tiêu độ sâu; không áp đặt độ sâu mặc định. |
| TORSO_ASCENT_CHANGE | COMPLETE_REPETITION | NO_SIGNAL |  |  |
| DESCENT_TARGET | COMPLETE_REPETITION | NOT_ASSESSED | GOAL_NOT_SET | Chưa chọn thời gian xuống mục tiêu. |
| KNEE_INWARD_LEFT | COMPLETE_REPETITION | NOT_ASSESSED | VIEW_NOT_SUITABLE | Cần góc chính diện và thấy rõ hai bàn chân. |
| KNEE_INWARD_RIGHT | COMPLETE_REPETITION | NOT_ASSESSED | VIEW_NOT_SUITABLE | Cần góc chính diện và thấy rõ hai bàn chân. |
| LUMBAR_CURVATURE | UNIMPLEMENTED | NOT_ASSESSED | NOT_IMPLEMENTED | Hai điểm vai–hông không mô tả độ cong cột sống. |
| HEEL_LIFT | UNIMPLEMENTED | NOT_ASSESSED | NOT_IMPLEMENTED | Landmark gót xuất hiện không chứng minh gót chạm hay rời sàn. |
| BALANCE | UNIMPLEMENTED | NOT_ASSESSED | NOT_IMPLEMENTED | Video 2D không cung cấp trọng tâm hay lực tiếp xúc bàn chân. |
| LEFT_RIGHT_SYMMETRY | UNIMPLEMENTED | NOT_ASSESSED | NOT_IMPLEMENTED | Hai bên có số đo khác không tự chứng minh bất đối xứng kỹ thuật. |
| DEPTH_CONSISTENCY | MULTIPLE_REPETITIONS | NOT_ASSESSED | TRACKING_OR_PHASE_QUALITY | Chất lượng theo dõi giữa các rep chưa đủ để so sánh. |
| TORSO_LEAN_CHANGE | MULTIPLE_REPETITIONS | NOT_ASSESSED | TRACKING_OR_PHASE_QUALITY | Chất lượng theo dõi giữa các rep chưa đủ để so sánh. |
| TEMPO_CONSISTENCY | MULTIPLE_REPETITIONS | NOT_ASSESSED | TRACKING_OR_PHASE_QUALITY | Chất lượng theo dõi giữa các rep chưa đủ để so sánh. |
| KNEE_TRAVEL_CONSISTENCY | MULTIPLE_REPETITIONS | NOT_ASSESSED | TRACKING_OR_PHASE_QUALITY | Chất lượng theo dõi giữa các rep chưa đủ để so sánh. |
| JOINT_MOTION | VALID_SEGMENT | MEASURED |  |  |

## oblique

Input: `samples/oblique-squat-pexels-8837221.mp4` (REAL). Coach ground truth: unavailable.
Transformation: none
[Full result](private/pipeline-debug/oblique.after-v6.json) · [Angle / state / frame timeline CSV](private/pipeline-debug/oblique.timeline.csv)

Before: COMPLETED, 5 reps. After: COMPLETED, 5 reps.
Rejection: null
Orientation: 0.0°, auto=True, displayed size=720×1366; timestamp fallbacks=0.
Selected side: right; rejection counts: `{"leftKnee:LOW_VISIBILITY": 82, "leftAnkle:LOW_VISIBILITY": 4}`.
Projected angle ranges: `{"leftKneeAngle": {"count": 174, "min": 65.616, "max": 179.942, "range": 114.326}, "leftHipAngle": {"count": 174, "min": 48.801, "max": 178.408, "range": 129.607}, "rightKneeAngle": {"count": 256, "min": 72.857, "max": 177.594, "range": 104.737}, "rightHipAngle": {"count": 256, "min": 61.705, "max": 179.847, "range": 118.142}}`.
Raw/smoothed signal ranges: `{"signalUnits": "projected_knee_degrees", "rawRange": {"count": 256, "min": 72.857, "max": 177.594, "range": 104.737}, "smoothedRange": {"count": 256, "min": 74.289, "max": 176.85, "range": 102.562}}`.

| Criterion | Scope | Outcome | Reason code | Reason |
|---|---|---|---|---|
| MOVEMENT_TIMING | COMPLETE_REPETITION | MEASURED |  |  |
| DEPTH_TARGET | COMPLETE_REPETITION | NOT_ASSESSED | VIEW_NOT_SUITABLE | Cần góc ngang để so vị trí hông và gối. |
| TORSO_ASCENT_CHANGE | COMPLETE_REPETITION | NOT_ASSESSED | VIEW_NOT_SUITABLE | Cần góc ngang để quan sát vai và hông khi đứng lên. |
| DESCENT_TARGET | COMPLETE_REPETITION | NOT_ASSESSED | GOAL_NOT_SET | Chưa chọn thời gian xuống mục tiêu. |
| KNEE_INWARD_LEFT | COMPLETE_REPETITION | NOT_ASSESSED | VIEW_NOT_SUITABLE | Cần góc chính diện và thấy rõ hai bàn chân. |
| KNEE_INWARD_RIGHT | COMPLETE_REPETITION | NOT_ASSESSED | VIEW_NOT_SUITABLE | Cần góc chính diện và thấy rõ hai bàn chân. |
| LUMBAR_CURVATURE | UNIMPLEMENTED | NOT_ASSESSED | NOT_IMPLEMENTED | Hai điểm vai–hông không mô tả độ cong cột sống. |
| HEEL_LIFT | UNIMPLEMENTED | NOT_ASSESSED | NOT_IMPLEMENTED | Landmark gót xuất hiện không chứng minh gót chạm hay rời sàn. |
| BALANCE | UNIMPLEMENTED | NOT_ASSESSED | NOT_IMPLEMENTED | Video 2D không cung cấp trọng tâm hay lực tiếp xúc bàn chân. |
| LEFT_RIGHT_SYMMETRY | UNIMPLEMENTED | NOT_ASSESSED | NOT_IMPLEMENTED | Hai bên có số đo khác không tự chứng minh bất đối xứng kỹ thuật. |
| JOINT_MOTION | VALID_SEGMENT | MEASURED |  |  |

## non-squat

Input: `samples/hammer-curls-ymove.mp4` (REAL). Coach ground truth: unavailable.
Transformation: none
[Full result](private/pipeline-debug/non-squat.after-v6.json) · [Angle / state / frame timeline CSV](private/pipeline-debug/non-squat.timeline.csv)

Before: INSUFFICIENT_DATA, None reps. After: INSUFFICIENT_DATA, None reps.
Rejection: {"code": "NO_SQUAT_MOVEMENT", "message": "Có điểm khớp nhưng biên độ chuyển động chưa đạt ngưỡng bắt đầu Squat; không tìm thấy chu kỳ xuống và đứng lên."}
Orientation: 0.0°, auto=True, displayed size=720×1280; timestamp fallbacks=0.
Selected side: left; rejection counts: `{}`.
Projected angle ranges: `{"leftKneeAngle": {"count": 131, "min": 159.428, "max": 168.184, "range": 8.756}, "leftHipAngle": {"count": 131, "min": 168.499, "max": 177.337, "range": 8.838}, "rightKneeAngle": {"count": 131, "min": 167.192, "max": 179.212, "range": 12.02}, "rightHipAngle": {"count": 131, "min": 166.847, "max": 177.459, "range": 10.613}}`.
Raw/smoothed signal ranges: `{"signalUnits": "projected_knee_degrees", "rawRange": {"count": 131, "min": 159.428, "max": 168.184, "range": 8.756}, "smoothedRange": {"count": 131, "min": 160.265, "max": 166.525, "range": 6.26}}`.

| Criterion | Scope | Outcome | Reason code | Reason |
|---|---|---|---|---|
| MOVEMENT_TIMING | COMPLETE_REPETITION | NOT_ASSESSED | NO_SQUAT_MOVEMENT | Có điểm khớp nhưng biên độ chuyển động chưa đạt ngưỡng bắt đầu Squat; không tìm thấy chu kỳ xuống và đứng lên. |
| DEPTH_TARGET | COMPLETE_REPETITION | NOT_ASSESSED | GOAL_NOT_SET | Chưa chọn mục tiêu độ sâu. |
| TORSO_ASCENT_CHANGE | COMPLETE_REPETITION | NOT_ASSESSED | NO_SQUAT_MOVEMENT | Có điểm khớp nhưng biên độ chuyển động chưa đạt ngưỡng bắt đầu Squat; không tìm thấy chu kỳ xuống và đứng lên. |
| DESCENT_TARGET | COMPLETE_REPETITION | NOT_ASSESSED | GOAL_NOT_SET | Chưa chọn thời gian xuống mục tiêu. |
| KNEE_INWARD_LEFT | COMPLETE_REPETITION | NOT_ASSESSED | VIEW_NOT_SUITABLE | Tiêu chí này cần góc chính diện, thấy rõ cả hai bàn chân. |
| KNEE_INWARD_RIGHT | COMPLETE_REPETITION | NOT_ASSESSED | VIEW_NOT_SUITABLE | Tiêu chí này cần góc chính diện, thấy rõ cả hai bàn chân. |
| LUMBAR_CURVATURE | UNIMPLEMENTED | NOT_ASSESSED | NOT_IMPLEMENTED | Hai điểm vai–hông không mô tả độ cong cột sống. |
| HEEL_LIFT | UNIMPLEMENTED | NOT_ASSESSED | NOT_IMPLEMENTED | Landmark gót xuất hiện không chứng minh gót chạm hay rời sàn. |
| BALANCE | UNIMPLEMENTED | NOT_ASSESSED | NOT_IMPLEMENTED | Video 2D không cung cấp trọng tâm hay lực tiếp xúc bàn chân. |
| LEFT_RIGHT_SYMMETRY | UNIMPLEMENTED | NOT_ASSESSED | NOT_IMPLEMENTED | Hai bên có số đo khác không tự chứng minh bất đối xứng kỹ thuật. |
| JOINT_MOTION | VALID_SEGMENT | MEASURED |  |  |

## front-mid-rep

Input: `samples/debug/front-mid-rep.mp4` (EDITED). Coach ground truth: unavailable.
Transformation: trim=start=0.8,setpts=PTS-STARTPTS
[Full result](private/pipeline-debug/front-mid-rep.after-v6.json) · [Angle / state / frame timeline CSV](private/pipeline-debug/front-mid-rep.timeline.csv)

Before: COMPLETED, 4 reps. After: COMPLETED, 4 reps.
Rejection: null
Orientation: 0.0°, auto=True, displayed size=720×406; timestamp fallbacks=0.
Selected side: left; rejection counts: `{}`.
Projected angle ranges: `{"leftKneeAngle": {"count": 157, "min": 135.393, "max": 179.892, "range": 44.499}, "leftHipAngle": {"count": 157, "min": 125.084, "max": 165.994, "range": 40.91}, "rightKneeAngle": {"count": 157, "min": 142.558, "max": 179.988, "range": 37.43}, "rightHipAngle": {"count": 157, "min": 136.216, "max": 166.825, "range": 30.609}}`.
Raw/smoothed signal ranges: `{"signalUnits": "standing_leg_ratio", "rawRange": {"count": 157, "min": -0.025, "max": 0.437, "range": 0.462}, "smoothedRange": {"count": 157, "min": -0.023, "max": 0.43, "range": 0.453}}`.

| Criterion | Scope | Outcome | Reason code | Reason |
|---|---|---|---|---|
| MOVEMENT_TIMING | COMPLETE_REPETITION | MEASURED |  |  |
| DEPTH_TARGET | COMPLETE_REPETITION | NOT_ASSESSED | VIEW_NOT_SUITABLE | Cần góc ngang để so vị trí hông và gối. |
| TORSO_ASCENT_CHANGE | COMPLETE_REPETITION | NOT_ASSESSED | VIEW_NOT_SUITABLE | Cần góc ngang để quan sát vai và hông khi đứng lên. |
| DESCENT_TARGET | COMPLETE_REPETITION | NOT_ASSESSED | GOAL_NOT_SET | Chưa chọn thời gian xuống mục tiêu. |
| KNEE_INWARD_LEFT | COMPLETE_REPETITION | NO_SIGNAL |  |  |
| KNEE_INWARD_RIGHT | COMPLETE_REPETITION | NO_SIGNAL |  |  |
| LUMBAR_CURVATURE | UNIMPLEMENTED | NOT_ASSESSED | NOT_IMPLEMENTED | Hai điểm vai–hông không mô tả độ cong cột sống. |
| HEEL_LIFT | UNIMPLEMENTED | NOT_ASSESSED | NOT_IMPLEMENTED | Landmark gót xuất hiện không chứng minh gót chạm hay rời sàn. |
| BALANCE | UNIMPLEMENTED | NOT_ASSESSED | NOT_IMPLEMENTED | Video 2D không cung cấp trọng tâm hay lực tiếp xúc bàn chân. |
| LEFT_RIGHT_SYMMETRY | UNIMPLEMENTED | NOT_ASSESSED | NOT_IMPLEMENTED | Hai bên có số đo khác không tự chứng minh bất đối xứng kỹ thuật. |
| JOINT_MOTION | VALID_SEGMENT | MEASURED |  |  |

## front-delayed

Input: `samples/debug/front-delayed.mp4` (EDITED). Coach ground truth: unavailable.
Transformation: tpad=start_duration=3:start_mode=clone
[Full result](private/pipeline-debug/front-delayed.after-v6.json) · [Angle / state / frame timeline CSV](private/pipeline-debug/front-delayed.timeline.csv)

Before: COMPLETED, 5 reps. After: COMPLETED, 5 reps.
Rejection: null
Orientation: 0.0°, auto=True, displayed size=720×406; timestamp fallbacks=0.
Selected side: left; rejection counts: `{}`.
Projected angle ranges: `{"leftKneeAngle": {"count": 195, "min": 133.485, "max": 179.904, "range": 46.419}, "leftHipAngle": {"count": 195, "min": 124.17, "max": 165.575, "range": 41.405}, "rightKneeAngle": {"count": 195, "min": 138.674, "max": 179.965, "range": 41.291}, "rightHipAngle": {"count": 195, "min": 133.966, "max": 166.617, "range": 32.651}}`.
Raw/smoothed signal ranges: `{"signalUnits": "standing_leg_ratio", "rawRange": {"count": 195, "min": -0.029, "max": 0.435, "range": 0.465}, "smoothedRange": {"count": 195, "min": -0.027, "max": 0.432, "range": 0.459}}`.

| Criterion | Scope | Outcome | Reason code | Reason |
|---|---|---|---|---|
| MOVEMENT_TIMING | COMPLETE_REPETITION | MEASURED |  |  |
| DEPTH_TARGET | COMPLETE_REPETITION | NOT_ASSESSED | VIEW_NOT_SUITABLE | Cần góc ngang để so vị trí hông và gối. |
| TORSO_ASCENT_CHANGE | COMPLETE_REPETITION | NOT_ASSESSED | VIEW_NOT_SUITABLE | Cần góc ngang để quan sát vai và hông khi đứng lên. |
| DESCENT_TARGET | COMPLETE_REPETITION | NOT_ASSESSED | GOAL_NOT_SET | Chưa chọn thời gian xuống mục tiêu. |
| KNEE_INWARD_LEFT | COMPLETE_REPETITION | NO_SIGNAL |  |  |
| KNEE_INWARD_RIGHT | COMPLETE_REPETITION | NO_SIGNAL |  |  |
| LUMBAR_CURVATURE | UNIMPLEMENTED | NOT_ASSESSED | NOT_IMPLEMENTED | Hai điểm vai–hông không mô tả độ cong cột sống. |
| HEEL_LIFT | UNIMPLEMENTED | NOT_ASSESSED | NOT_IMPLEMENTED | Landmark gót xuất hiện không chứng minh gót chạm hay rời sàn. |
| BALANCE | UNIMPLEMENTED | NOT_ASSESSED | NOT_IMPLEMENTED | Video 2D không cung cấp trọng tâm hay lực tiếp xúc bàn chân. |
| LEFT_RIGHT_SYMMETRY | UNIMPLEMENTED | NOT_ASSESSED | NOT_IMPLEMENTED | Hai bên có số đo khác không tự chứng minh bất đối xứng kỹ thuật. |
| JOINT_MOTION | VALID_SEGMENT | MEASURED |  |  |

## front-short-gap

Input: `samples/debug/front-short-gap.mp4` (EDITED). Coach ground truth: unavailable.
Transformation: drawbox=x=0:y=0:w=iw:h=ih:color=black:t=fill:enable='between(t,6.2,6.38)'
[Full result](private/pipeline-debug/front-short-gap.after-v6.json) · [Angle / state / frame timeline CSV](private/pipeline-debug/front-short-gap.timeline.csv)

Before: COMPLETED, 5 reps. After: COMPLETED, 5 reps.
Rejection: null
Orientation: 0.0°, auto=True, displayed size=720×406; timestamp fallbacks=0.
Selected side: left; rejection counts: `{}`.
Projected angle ranges: `{"leftKneeAngle": {"count": 163, "min": 133.746, "max": 179.994, "range": 46.249}, "leftHipAngle": {"count": 163, "min": 123.371, "max": 165.92, "range": 42.549}, "rightKneeAngle": {"count": 163, "min": 142.088, "max": 179.946, "range": 37.858}, "rightHipAngle": {"count": 163, "min": 133.783, "max": 166.577, "range": 32.794}}`.
Raw/smoothed signal ranges: `{"signalUnits": "standing_leg_ratio", "rawRange": {"count": 163, "min": -0.028, "max": 0.436, "range": 0.464}, "smoothedRange": {"count": 163, "min": -0.024, "max": 0.43, "range": 0.455}}`.

| Criterion | Scope | Outcome | Reason code | Reason |
|---|---|---|---|---|
| MOVEMENT_TIMING | COMPLETE_REPETITION | MEASURED |  |  |
| DEPTH_TARGET | COMPLETE_REPETITION | NOT_ASSESSED | VIEW_NOT_SUITABLE | Cần góc ngang để so vị trí hông và gối. |
| TORSO_ASCENT_CHANGE | COMPLETE_REPETITION | NOT_ASSESSED | VIEW_NOT_SUITABLE | Cần góc ngang để quan sát vai và hông khi đứng lên. |
| DESCENT_TARGET | COMPLETE_REPETITION | NOT_ASSESSED | GOAL_NOT_SET | Chưa chọn thời gian xuống mục tiêu. |
| KNEE_INWARD_LEFT | COMPLETE_REPETITION | NO_SIGNAL |  |  |
| KNEE_INWARD_RIGHT | COMPLETE_REPETITION | NO_SIGNAL |  |  |
| LUMBAR_CURVATURE | UNIMPLEMENTED | NOT_ASSESSED | NOT_IMPLEMENTED | Hai điểm vai–hông không mô tả độ cong cột sống. |
| HEEL_LIFT | UNIMPLEMENTED | NOT_ASSESSED | NOT_IMPLEMENTED | Landmark gót xuất hiện không chứng minh gót chạm hay rời sàn. |
| BALANCE | UNIMPLEMENTED | NOT_ASSESSED | NOT_IMPLEMENTED | Video 2D không cung cấp trọng tâm hay lực tiếp xúc bàn chân. |
| LEFT_RIGHT_SYMMETRY | UNIMPLEMENTED | NOT_ASSESSED | NOT_IMPLEMENTED | Hai bên có số đo khác không tự chứng minh bất đối xứng kỹ thuật. |
| JOINT_MOTION | VALID_SEGMENT | MEASURED |  |  |

## front-long-gap

Input: `samples/debug/front-long-gap.mp4` (EDITED). Coach ground truth: unavailable.
Transformation: drawbox=x=0:y=0:w=iw:h=ih:color=black:t=fill:enable='between(t,6.0,6.9)'
[Full result](private/pipeline-debug/front-long-gap.after-v6.json) · [Angle / state / frame timeline CSV](private/pipeline-debug/front-long-gap.timeline.csv)

Before: COMPLETED, 4 reps. After: COMPLETED, 4 reps.
Rejection: null
Orientation: 0.0°, auto=True, displayed size=720×406; timestamp fallbacks=0.
Selected side: left; rejection counts: `{}`.
Projected angle ranges: `{"leftKneeAngle": {"count": 156, "min": 137.216, "max": 179.994, "range": 42.778}, "leftHipAngle": {"count": 156, "min": 127.669, "max": 166.033, "range": 38.364}, "rightKneeAngle": {"count": 156, "min": 141.209, "max": 179.735, "range": 38.527}, "rightHipAngle": {"count": 156, "min": 133.885, "max": 166.719, "range": 32.834}}`.
Raw/smoothed signal ranges: `{"signalUnits": "standing_leg_ratio", "rawRange": {"count": 156, "min": -0.026, "max": 0.438, "range": 0.463}, "smoothedRange": {"count": 156, "min": -0.024, "max": 0.436, "range": 0.46}}`.

| Criterion | Scope | Outcome | Reason code | Reason |
|---|---|---|---|---|
| MOVEMENT_TIMING | COMPLETE_REPETITION | MEASURED |  |  |
| DEPTH_TARGET | COMPLETE_REPETITION | NOT_ASSESSED | VIEW_NOT_SUITABLE | Cần góc ngang để so vị trí hông và gối. |
| TORSO_ASCENT_CHANGE | COMPLETE_REPETITION | NOT_ASSESSED | VIEW_NOT_SUITABLE | Cần góc ngang để quan sát vai và hông khi đứng lên. |
| DESCENT_TARGET | COMPLETE_REPETITION | NOT_ASSESSED | GOAL_NOT_SET | Chưa chọn thời gian xuống mục tiêu. |
| KNEE_INWARD_LEFT | COMPLETE_REPETITION | NO_SIGNAL |  |  |
| KNEE_INWARD_RIGHT | COMPLETE_REPETITION | NO_SIGNAL |  |  |
| LUMBAR_CURVATURE | UNIMPLEMENTED | NOT_ASSESSED | NOT_IMPLEMENTED | Hai điểm vai–hông không mô tả độ cong cột sống. |
| HEEL_LIFT | UNIMPLEMENTED | NOT_ASSESSED | NOT_IMPLEMENTED | Landmark gót xuất hiện không chứng minh gót chạm hay rời sàn. |
| BALANCE | UNIMPLEMENTED | NOT_ASSESSED | NOT_IMPLEMENTED | Video 2D không cung cấp trọng tâm hay lực tiếp xúc bàn chân. |
| LEFT_RIGHT_SYMMETRY | UNIMPLEMENTED | NOT_ASSESSED | NOT_IMPLEMENTED | Hai bên có số đo khác không tự chứng minh bất đối xứng kỹ thuật. |
| JOINT_MOTION | VALID_SEGMENT | MEASURED |  |  |

## front-static

Input: `samples/debug/front-static.mp4` (EDITED). Coach ground truth: unavailable.
Transformation: trim=start=2,trim=end_frame=1,loop=loop=149:size=1:start=0,setpts=N/(25*TB)
[Full result](private/pipeline-debug/front-static.after-v6.json) · [Angle / state / frame timeline CSV](private/pipeline-debug/front-static.timeline.csv)

Before: INSUFFICIENT_DATA, None reps. After: INSUFFICIENT_DATA, None reps.
Rejection: {"code": "NO_SQUAT_MOVEMENT", "message": "Có điểm khớp nhưng biên độ chuyển động chưa đạt ngưỡng bắt đầu Squat; không tìm thấy chu kỳ xuống và đứng lên."}
Orientation: 0.0°, auto=True, displayed size=720×406; timestamp fallbacks=0.
Selected side: left; rejection counts: `{}`.
Projected angle ranges: `{"leftKneeAngle": {"count": 60, "min": 171.052, "max": 171.112, "range": 0.06}, "leftHipAngle": {"count": 60, "min": 163.887, "max": 163.974, "range": 0.087}, "rightKneeAngle": {"count": 60, "min": 171.592, "max": 171.76, "range": 0.168}, "rightHipAngle": {"count": 60, "min": 162.595, "max": 162.679, "range": 0.084}}`.
Raw/smoothed signal ranges: `{"signalUnits": "standing_leg_ratio", "rawRange": {"count": 60, "min": -0.0, "max": 0.001, "range": 0.001}, "smoothedRange": {"count": 60, "min": -0.0, "max": 0.001, "range": 0.001}}`.

| Criterion | Scope | Outcome | Reason code | Reason |
|---|---|---|---|---|
| MOVEMENT_TIMING | COMPLETE_REPETITION | NOT_ASSESSED | NO_SQUAT_MOVEMENT | Có điểm khớp nhưng biên độ chuyển động chưa đạt ngưỡng bắt đầu Squat; không tìm thấy chu kỳ xuống và đứng lên. |
| DEPTH_TARGET | COMPLETE_REPETITION | NOT_ASSESSED | VIEW_NOT_SUITABLE | Tiêu chí này cần góc ngang. |
| TORSO_ASCENT_CHANGE | COMPLETE_REPETITION | NOT_ASSESSED | VIEW_NOT_SUITABLE | Tiêu chí này cần góc ngang. |
| DESCENT_TARGET | COMPLETE_REPETITION | NOT_ASSESSED | GOAL_NOT_SET | Chưa chọn thời gian xuống mục tiêu. |
| KNEE_INWARD_LEFT | COMPLETE_REPETITION | NOT_ASSESSED | NO_SQUAT_MOVEMENT | Có điểm khớp nhưng biên độ chuyển động chưa đạt ngưỡng bắt đầu Squat; không tìm thấy chu kỳ xuống và đứng lên. |
| KNEE_INWARD_RIGHT | COMPLETE_REPETITION | NOT_ASSESSED | NO_SQUAT_MOVEMENT | Có điểm khớp nhưng biên độ chuyển động chưa đạt ngưỡng bắt đầu Squat; không tìm thấy chu kỳ xuống và đứng lên. |
| LUMBAR_CURVATURE | UNIMPLEMENTED | NOT_ASSESSED | NOT_IMPLEMENTED | Hai điểm vai–hông không mô tả độ cong cột sống. |
| HEEL_LIFT | UNIMPLEMENTED | NOT_ASSESSED | NOT_IMPLEMENTED | Landmark gót xuất hiện không chứng minh gót chạm hay rời sàn. |
| BALANCE | UNIMPLEMENTED | NOT_ASSESSED | NOT_IMPLEMENTED | Video 2D không cung cấp trọng tâm hay lực tiếp xúc bàn chân. |
| LEFT_RIGHT_SYMMETRY | UNIMPLEMENTED | NOT_ASSESSED | NOT_IMPLEMENTED | Hai bên có số đo khác không tự chứng minh bất đối xứng kỹ thuật. |
| JOINT_MOTION | VALID_SEGMENT | MEASURED |  |  |

## front-vfr

Input: `samples/debug/front-vfr.mp4` (EDITED). Coach ground truth: unavailable.
Transformation: select='if(lt(t,8),not(mod(n,2)),1)'
[Full result](private/pipeline-debug/front-vfr.after-v6.json) · [Angle / state / frame timeline CSV](private/pipeline-debug/front-vfr.timeline.csv)

Before: COMPLETED, 6 reps. After: COMPLETED, 5 reps.
Rejection: null
Orientation: 0.0°, auto=True, displayed size=720×406; timestamp fallbacks=0.
Selected side: left; rejection counts: `{}`.
Projected angle ranges: `{"leftKneeAngle": {"count": 165, "min": 132.815, "max": 179.769, "range": 46.953}, "leftHipAngle": {"count": 165, "min": 121.836, "max": 165.646, "range": 43.81}, "rightKneeAngle": {"count": 165, "min": 138.592, "max": 179.905, "range": 41.313}, "rightHipAngle": {"count": 165, "min": 130.092, "max": 166.63, "range": 36.538}}`.
Raw/smoothed signal ranges: `{"signalUnits": "standing_leg_ratio", "rawRange": {"count": 165, "min": -0.022, "max": 0.442, "range": 0.464}, "smoothedRange": {"count": 165, "min": -0.018, "max": 0.435, "range": 0.453}}`.

| Criterion | Scope | Outcome | Reason code | Reason |
|---|---|---|---|---|
| MOVEMENT_TIMING | COMPLETE_REPETITION | MEASURED |  |  |
| DEPTH_TARGET | COMPLETE_REPETITION | NOT_ASSESSED | VIEW_NOT_SUITABLE | Cần góc ngang để so vị trí hông và gối. |
| TORSO_ASCENT_CHANGE | COMPLETE_REPETITION | NOT_ASSESSED | VIEW_NOT_SUITABLE | Cần góc ngang để quan sát vai và hông khi đứng lên. |
| DESCENT_TARGET | COMPLETE_REPETITION | NOT_ASSESSED | GOAL_NOT_SET | Chưa chọn thời gian xuống mục tiêu. |
| KNEE_INWARD_LEFT | COMPLETE_REPETITION | NO_SIGNAL |  |  |
| KNEE_INWARD_RIGHT | COMPLETE_REPETITION | NO_SIGNAL |  |  |
| LUMBAR_CURVATURE | UNIMPLEMENTED | NOT_ASSESSED | NOT_IMPLEMENTED | Hai điểm vai–hông không mô tả độ cong cột sống. |
| HEEL_LIFT | UNIMPLEMENTED | NOT_ASSESSED | NOT_IMPLEMENTED | Landmark gót xuất hiện không chứng minh gót chạm hay rời sàn. |
| BALANCE | UNIMPLEMENTED | NOT_ASSESSED | NOT_IMPLEMENTED | Video 2D không cung cấp trọng tâm hay lực tiếp xúc bàn chân. |
| LEFT_RIGHT_SYMMETRY | UNIMPLEMENTED | NOT_ASSESSED | NOT_IMPLEMENTED | Hai bên có số đo khác không tự chứng minh bất đối xứng kỹ thuật. |
| JOINT_MOTION | VALID_SEGMENT | MEASURED |  |  |

## front-rotation-metadata

Input: `samples/debug/front-rotation-metadata.mp4` (EDITED). Coach ground truth: unavailable.
Transformation: clockwise pixels + FFmpeg display_rotation=90 (OpenCV orientation metadata 270 degrees)
[Full result](private/pipeline-debug/front-rotation-metadata.after-v6.json) · [Angle / state / frame timeline CSV](private/pipeline-debug/front-rotation-metadata.timeline.csv)

Before: COMPLETED, 5 reps. After: COMPLETED, 5 reps.
Rejection: null
Orientation: 270.0°, auto=True, displayed size=1280×720; timestamp fallbacks=0.
Selected side: left; rejection counts: `{}`.
Projected angle ranges: `{"leftKneeAngle": {"count": 165, "min": 130.948, "max": 179.919, "range": 48.971}, "leftHipAngle": {"count": 165, "min": 121.213, "max": 165.926, "range": 44.713}, "rightKneeAngle": {"count": 165, "min": 140.186, "max": 179.963, "range": 39.777}, "rightHipAngle": {"count": 165, "min": 133.697, "max": 166.63, "range": 32.933}}`.
Raw/smoothed signal ranges: `{"signalUnits": "standing_leg_ratio", "rawRange": {"count": 165, "min": -0.025, "max": 0.436, "range": 0.461}, "smoothedRange": {"count": 165, "min": -0.022, "max": 0.434, "range": 0.456}}`.

| Criterion | Scope | Outcome | Reason code | Reason |
|---|---|---|---|---|
| MOVEMENT_TIMING | COMPLETE_REPETITION | MEASURED |  |  |
| DEPTH_TARGET | COMPLETE_REPETITION | NOT_ASSESSED | VIEW_NOT_SUITABLE | Cần góc ngang để so vị trí hông và gối. |
| TORSO_ASCENT_CHANGE | COMPLETE_REPETITION | NOT_ASSESSED | VIEW_NOT_SUITABLE | Cần góc ngang để quan sát vai và hông khi đứng lên. |
| DESCENT_TARGET | COMPLETE_REPETITION | NOT_ASSESSED | GOAL_NOT_SET | Chưa chọn thời gian xuống mục tiêu. |
| KNEE_INWARD_LEFT | COMPLETE_REPETITION | NO_SIGNAL |  |  |
| KNEE_INWARD_RIGHT | COMPLETE_REPETITION | NO_SIGNAL |  |  |
| LUMBAR_CURVATURE | UNIMPLEMENTED | NOT_ASSESSED | NOT_IMPLEMENTED | Hai điểm vai–hông không mô tả độ cong cột sống. |
| HEEL_LIFT | UNIMPLEMENTED | NOT_ASSESSED | NOT_IMPLEMENTED | Landmark gót xuất hiện không chứng minh gót chạm hay rời sàn. |
| BALANCE | UNIMPLEMENTED | NOT_ASSESSED | NOT_IMPLEMENTED | Video 2D không cung cấp trọng tâm hay lực tiếp xúc bàn chân. |
| LEFT_RIGHT_SYMMETRY | UNIMPLEMENTED | NOT_ASSESSED | NOT_IMPLEMENTED | Hai bên có số đo khác không tự chứng minh bất đối xứng kỹ thuật. |
| JOINT_MOTION | VALID_SEGMENT | MEASURED |  |  |

## variable-depth

Input: `samples/squat-variable-depth-test.mp4` (EDITED). Coach ground truth: unavailable.
Transformation: Existing reversed/edited fixture; see build_sample_variant.py
[Full result](private/pipeline-debug/variable-depth.after-v6.json) · [Angle / state / frame timeline CSV](private/pipeline-debug/variable-depth.timeline.csv)

Before: COMPLETED, 2 reps. After: COMPLETED, 2 reps.
Rejection: null
Orientation: 0.0°, auto=True, displayed size=608×1080; timestamp fallbacks=0.
Selected side: right; rejection counts: `{"leftKnee:LOW_VISIBILITY": 73, "leftAnkle:LOW_VISIBILITY": 38, "leftHeel:LOW_VISIBILITY": 29, "leftToe:LOW_VISIBILITY": 1}`.
Projected angle ranges: `{"leftKneeAngle": {"count": 0, "min": null, "max": null, "range": null}, "leftHipAngle": {"count": 0, "min": null, "max": null, "range": null}, "rightKneeAngle": {"count": 73, "min": 74.542, "max": 172.14, "range": 97.597}, "rightHipAngle": {"count": 73, "min": 67.989, "max": 168.475, "range": 100.487}}`.
Raw/smoothed signal ranges: `{"signalUnits": "projected_knee_degrees", "rawRange": {"count": 73, "min": 74.542, "max": 172.14, "range": 97.597}, "smoothedRange": {"count": 73, "min": 76.196, "max": 171.482, "range": 95.286}}`.

| Criterion | Scope | Outcome | Reason code | Reason |
|---|---|---|---|---|
| MOVEMENT_TIMING | COMPLETE_REPETITION | MEASURED |  |  |
| DEPTH_TARGET | COMPLETE_REPETITION | NOT_ASSESSED | GOAL_NOT_SET | Chưa chọn mục tiêu độ sâu; không áp đặt độ sâu mặc định. |
| TORSO_ASCENT_CHANGE | COMPLETE_REPETITION | NOT_ASSESSED | TRACKING_OR_PHASE_QUALITY | Vị trí chân hoặc tỷ lệ cơ thể trên ảnh thay đổi; chưa tách được chuyển động camera và người tập. |
| DESCENT_TARGET | COMPLETE_REPETITION | NOT_ASSESSED | GOAL_NOT_SET | Chưa chọn thời gian xuống mục tiêu. |
| KNEE_INWARD_LEFT | COMPLETE_REPETITION | NOT_ASSESSED | VIEW_NOT_SUITABLE | Cần góc chính diện và thấy rõ hai bàn chân. |
| KNEE_INWARD_RIGHT | COMPLETE_REPETITION | NOT_ASSESSED | VIEW_NOT_SUITABLE | Cần góc chính diện và thấy rõ hai bàn chân. |
| LUMBAR_CURVATURE | UNIMPLEMENTED | NOT_ASSESSED | NOT_IMPLEMENTED | Hai điểm vai–hông không mô tả độ cong cột sống. |
| HEEL_LIFT | UNIMPLEMENTED | NOT_ASSESSED | NOT_IMPLEMENTED | Landmark gót xuất hiện không chứng minh gót chạm hay rời sàn. |
| BALANCE | UNIMPLEMENTED | NOT_ASSESSED | NOT_IMPLEMENTED | Video 2D không cung cấp trọng tâm hay lực tiếp xúc bàn chân. |
| LEFT_RIGHT_SYMMETRY | UNIMPLEMENTED | NOT_ASSESSED | NOT_IMPLEMENTED | Hai bên có số đo khác không tự chứng minh bất đối xứng kỹ thuật. |
| DEPTH_CONSISTENCY | MULTIPLE_REPETITIONS | NOT_ASSESSED | TRACKING_OR_PHASE_QUALITY | Chất lượng theo dõi giữa các rep chưa đủ để so sánh. |
| TORSO_LEAN_CHANGE | MULTIPLE_REPETITIONS | NOT_ASSESSED | TRACKING_OR_PHASE_QUALITY | Chất lượng theo dõi giữa các rep chưa đủ để so sánh. |
| TEMPO_CONSISTENCY | MULTIPLE_REPETITIONS | NOT_ASSESSED | TRACKING_OR_PHASE_QUALITY | Chất lượng theo dõi giữa các rep chưa đủ để so sánh. |
| KNEE_TRAVEL_CONSISTENCY | MULTIPLE_REPETITIONS | NOT_ASSESSED | TRACKING_OR_PHASE_QUALITY | Chất lượng theo dõi giữa các rep chưa đủ để so sánh. |
| JOINT_MOTION | VALID_SEGMENT | MEASURED |  |  |

## legacy-first

Input: `samples/squat_first_view-220k.mp4` (REAL). Coach ground truth: unavailable.
Transformation: none
[Full result](private/pipeline-debug/legacy-first.after-v6.json) · [Angle / state / frame timeline CSV](private/pipeline-debug/legacy-first.timeline.csv)

Before: INSUFFICIENT_DATA, None reps. After: INSUFFICIENT_DATA, None reps.
Rejection: {"code": "INVALID_VIDEO_DURATION_OR_DECODE", "message": "Video cần dài từ 3 đến 30 giây và có thể giải mã được."}
Orientation: 0.0°, auto=True, displayed size=None×None; timestamp fallbacks=None.
Selected side: None; rejection counts: `{}`.
Projected angle ranges: `{}`.
Raw/smoothed signal ranges: `{"signalUnits": null, "rawRange": null, "smoothedRange": null}`.

| Criterion | Scope | Outcome | Reason code | Reason |
|---|---|---|---|---|
| MOVEMENT_TIMING | COMPLETE_REPETITION | NOT_ASSESSED | NO_COMPLETE_REPETITION | Video cần dài từ 3 đến 30 giây và có thể giải mã được. |
| DEPTH_TARGET | COMPLETE_REPETITION | NOT_ASSESSED | VIEW_NOT_SUITABLE | Chưa chọn mục tiêu độ sâu. |
| TORSO_ASCENT_CHANGE | COMPLETE_REPETITION | NOT_ASSESSED | VIEW_NOT_SUITABLE | Video cần dài từ 3 đến 30 giây và có thể giải mã được. |
| DESCENT_TARGET | COMPLETE_REPETITION | NOT_ASSESSED | GOAL_NOT_SET | Chưa chọn thời gian xuống mục tiêu. |
| KNEE_INWARD_LEFT | COMPLETE_REPETITION | NOT_ASSESSED | VIEW_NOT_SUITABLE | Video cần dài từ 3 đến 30 giây và có thể giải mã được. |
| KNEE_INWARD_RIGHT | COMPLETE_REPETITION | NOT_ASSESSED | VIEW_NOT_SUITABLE | Video cần dài từ 3 đến 30 giây và có thể giải mã được. |
| LUMBAR_CURVATURE | UNIMPLEMENTED | NOT_ASSESSED | NOT_IMPLEMENTED | Hai điểm vai–hông không mô tả độ cong cột sống. |
| HEEL_LIFT | UNIMPLEMENTED | NOT_ASSESSED | NOT_IMPLEMENTED | Landmark gót xuất hiện không chứng minh gót chạm hay rời sàn. |
| BALANCE | UNIMPLEMENTED | NOT_ASSESSED | NOT_IMPLEMENTED | Video 2D không cung cấp trọng tâm hay lực tiếp xúc bàn chân. |
| LEFT_RIGHT_SYMMETRY | UNIMPLEMENTED | NOT_ASSESSED | NOT_IMPLEMENTED | Hai bên có số đo khác không tự chứng minh bất đối xứng kỹ thuật. |

## legacy-second

Input: `samples/squat_second_view-220k.mp4` (REAL). Coach ground truth: unavailable.
Transformation: none
[Full result](private/pipeline-debug/legacy-second.after-v6.json) · [Angle / state / frame timeline CSV](private/pipeline-debug/legacy-second.timeline.csv)

Before: INSUFFICIENT_DATA, None reps. After: INSUFFICIENT_DATA, None reps.
Rejection: {"code": "INVALID_VIDEO_DURATION_OR_DECODE", "message": "Video cần dài từ 3 đến 30 giây và có thể giải mã được."}
Orientation: 0.0°, auto=True, displayed size=None×None; timestamp fallbacks=None.
Selected side: None; rejection counts: `{}`.
Projected angle ranges: `{}`.
Raw/smoothed signal ranges: `{"signalUnits": null, "rawRange": null, "smoothedRange": null}`.

| Criterion | Scope | Outcome | Reason code | Reason |
|---|---|---|---|---|
| MOVEMENT_TIMING | COMPLETE_REPETITION | NOT_ASSESSED | NO_COMPLETE_REPETITION | Video cần dài từ 3 đến 30 giây và có thể giải mã được. |
| DEPTH_TARGET | COMPLETE_REPETITION | NOT_ASSESSED | VIEW_NOT_SUITABLE | Chưa chọn mục tiêu độ sâu. |
| TORSO_ASCENT_CHANGE | COMPLETE_REPETITION | NOT_ASSESSED | VIEW_NOT_SUITABLE | Video cần dài từ 3 đến 30 giây và có thể giải mã được. |
| DESCENT_TARGET | COMPLETE_REPETITION | NOT_ASSESSED | GOAL_NOT_SET | Chưa chọn thời gian xuống mục tiêu. |
| KNEE_INWARD_LEFT | COMPLETE_REPETITION | NOT_ASSESSED | VIEW_NOT_SUITABLE | Video cần dài từ 3 đến 30 giây và có thể giải mã được. |
| KNEE_INWARD_RIGHT | COMPLETE_REPETITION | NOT_ASSESSED | VIEW_NOT_SUITABLE | Video cần dài từ 3 đến 30 giây và có thể giải mã được. |
| LUMBAR_CURVATURE | UNIMPLEMENTED | NOT_ASSESSED | NOT_IMPLEMENTED | Hai điểm vai–hông không mô tả độ cong cột sống. |
| HEEL_LIFT | UNIMPLEMENTED | NOT_ASSESSED | NOT_IMPLEMENTED | Landmark gót xuất hiện không chứng minh gót chạm hay rời sàn. |
| BALANCE | UNIMPLEMENTED | NOT_ASSESSED | NOT_IMPLEMENTED | Video 2D không cung cấp trọng tâm hay lực tiếp xúc bàn chân. |
| LEFT_RIGHT_SYMMETRY | UNIMPLEMENTED | NOT_ASSESSED | NOT_IMPLEMENTED | Hai bên có số đo khác không tự chứng minh bất đối xứng kỹ thuật. |

## legacy-third

Input: `samples/squat_third_view-220k.mp4` (REAL). Coach ground truth: unavailable.
Transformation: none
[Full result](private/pipeline-debug/legacy-third.after-v6.json) · [Angle / state / frame timeline CSV](private/pipeline-debug/legacy-third.timeline.csv)

Before: INSUFFICIENT_DATA, None reps. After: INSUFFICIENT_DATA, None reps.
Rejection: {"code": "INVALID_VIDEO_DURATION_OR_DECODE", "message": "Video cần dài từ 3 đến 30 giây và có thể giải mã được."}
Orientation: 0.0°, auto=True, displayed size=None×None; timestamp fallbacks=None.
Selected side: None; rejection counts: `{}`.
Projected angle ranges: `{}`.
Raw/smoothed signal ranges: `{"signalUnits": null, "rawRange": null, "smoothedRange": null}`.

| Criterion | Scope | Outcome | Reason code | Reason |
|---|---|---|---|---|
| MOVEMENT_TIMING | COMPLETE_REPETITION | NOT_ASSESSED | NO_COMPLETE_REPETITION | Video cần dài từ 3 đến 30 giây và có thể giải mã được. |
| DEPTH_TARGET | COMPLETE_REPETITION | NOT_ASSESSED | VIEW_NOT_SUITABLE | Chưa chọn mục tiêu độ sâu. |
| TORSO_ASCENT_CHANGE | COMPLETE_REPETITION | NOT_ASSESSED | VIEW_NOT_SUITABLE | Video cần dài từ 3 đến 30 giây và có thể giải mã được. |
| DESCENT_TARGET | COMPLETE_REPETITION | NOT_ASSESSED | GOAL_NOT_SET | Chưa chọn thời gian xuống mục tiêu. |
| KNEE_INWARD_LEFT | COMPLETE_REPETITION | NOT_ASSESSED | VIEW_NOT_SUITABLE | Video cần dài từ 3 đến 30 giây và có thể giải mã được. |
| KNEE_INWARD_RIGHT | COMPLETE_REPETITION | NOT_ASSESSED | VIEW_NOT_SUITABLE | Video cần dài từ 3 đến 30 giây và có thể giải mã được. |
| LUMBAR_CURVATURE | UNIMPLEMENTED | NOT_ASSESSED | NOT_IMPLEMENTED | Hai điểm vai–hông không mô tả độ cong cột sống. |
| HEEL_LIFT | UNIMPLEMENTED | NOT_ASSESSED | NOT_IMPLEMENTED | Landmark gót xuất hiện không chứng minh gót chạm hay rời sàn. |
| BALANCE | UNIMPLEMENTED | NOT_ASSESSED | NOT_IMPLEMENTED | Video 2D không cung cấp trọng tâm hay lực tiếp xúc bàn chân. |
| LEFT_RIGHT_SYMMETRY | UNIMPLEMENTED | NOT_ASSESSED | NOT_IMPLEMENTED | Hai bên có số đo khác không tự chứng minh bất đối xứng kỹ thuật. |
