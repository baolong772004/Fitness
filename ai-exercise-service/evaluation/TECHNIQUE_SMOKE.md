# Real-video technique smoke results

All clips are real footage and remain UNLABELED by a Coach. Counts and measurements below are software smoke results, not technique accuracy. No PASS/NEEDS_IMPROVEMENT was enabled.

| Exercise | FPS | Decoded / sampled / pose | Pose rate | Rep count | Measured criteria | Technique verdict |
|---|---:|---:|---:|---:|---|---|
| SQUAT | 29.970 | 495 / 165 / 165 | 100.0% | 5 | SQUAT-01, SQUAT-03, SQUAT-05, SQUAT-06, SQUAT-08 | Chưa đủ điều kiện đánh giá |
| PUSH_UP | 25.000 | 391 / 157 / 157 | 100.0% | None | PUSHUP-01, PUSHUP-02 | Chưa đủ điều kiện đánh giá |
| PLANK | 25.000 | 199 / 80 / 80 | 100.0% | None | PLANK-01, PLANK-02 | Chưa đủ điều kiện đánh giá |
| LUNGE | 25.000 | 184 / 74 / 74 | 100.0% | None | LUNGE-01, LUNGE-02 | Chưa đủ điều kiện đánh giá |
| BICEPS_CURL | 25.000 | 327 / 131 / 131 | 100.0% | None | CURL-01, CURL-02 | Chưa đủ điều kiện đánh giá |
| SHOULDER_PRESS | 23.976 | 128 / 53 / 40 | 75.5% | None | PRESS-01, PRESS-02 | Chưa đủ điều kiện đánh giá |

## SQUAT

Source: https://www.pexels.com/video/woman-doing-squat-exercise-5034577/
SHA-256: `5d27d9b378af0d323237fa48fa2fe32befec20a72e4f24988f7979f7fef9c7a8`. Coach label: **not available**.
[Full inference result](private/technique-smoke/squat.json)

| Criterion | Measurement | Side / valid samples | Range | Reason |
|---|---|---|---|---|
| SQUAT-01 | — | — / 86 | — | NOT_COACH_VALIDATED |
| SQUAT-02 | — | — / — | — | VIEW_NOT_SUITABLE |
| SQUAT-03 | — | — / 172 | — | NOT_COACH_VALIDATED |
| SQUAT-04 | — | — / — | — | VIEW_NOT_SUITABLE |
| SQUAT-05 | — | — / 86 | — | NOT_COACH_VALIDATED |
| SQUAT-06 | — | — / 86 | — | NOT_SUPPORTED |
| SQUAT-07 | — | — / — | — | NOT_SUPPORTED |
| SQUAT-08 | — | — / 86 | — | NOT_COACH_VALIDATED |

## PUSH_UP

Source: https://www.pexels.com/video/man-doing-push-ups-4964649/
SHA-256: `ae8c7f1df9f5727bdd26d22b204ba63f21a48b1d3dc2ff13d1eb81d028cd5251`. Coach label: **not available**.
[Full inference result](private/technique-smoke/push_up.json)

| Criterion | Measurement | Side / valid samples | Range | Reason |
|---|---|---|---|---|
| PUSHUP-01 | degrees | LEFT / 157 | {"count": 157, "min": 66.665, "max": 168.769, "range": 102.104} | CAMERA_VIEW_NOT_VERIFIED |
| PUSHUP-02 | degrees | LEFT / 157 | {"count": 157, "min": 153.324, "max": 179.208, "range": 25.884} | CAMERA_VIEW_NOT_VERIFIED |

## PLANK

Source: https://www.pexels.com/video/young-woman-doing-planks-6525496/
SHA-256: `27a73cc4668d8225690510a7242a152aaa1bebb0fd85b456a2873c428318aa7e`. Coach label: **not available**.
[Full inference result](private/technique-smoke/plank.json)

| Criterion | Measurement | Side / valid samples | Range | Reason |
|---|---|---|---|---|
| PLANK-01 | degrees | RIGHT / 80 | {"count": 80, "min": 142.07, "max": 159.467, "range": 17.397} | CAMERA_VIEW_NOT_VERIFIED |
| PLANK-02 | body_lengths | RIGHT / 80 | {"count": 80, "min": -0.164, "max": -0.087, "range": 0.077} | CAMERA_VIEW_NOT_VERIFIED |

## LUNGE

Source: https://www.pexels.com/video/side-view-of-woman-exercising-legs-6525491/
SHA-256: `de2e555ca261eedbc5a6a0c382c7138f80f928c637532c4bc70fb6511f5126b1`. Coach label: **not available**.
[Full inference result](private/technique-smoke/lunge.json)

| Criterion | Measurement | Side / valid samples | Range | Reason |
|---|---|---|---|---|
| LUNGE-01 | degrees | RIGHT / 74 | {"count": 74, "min": 65.28, "max": 179.984, "range": 114.704} | CAMERA_VIEW_NOT_VERIFIED |
| LUNGE-02 | degrees | RIGHT / 74 | {"count": 74, "min": 88.857, "max": 179.892, "range": 91.035} | CAMERA_VIEW_NOT_VERIFIED |

## BICEPS_CURL

Source: https://ymove.app/free-exercise-videos
SHA-256: `f75af638089352a4de0cfd3ad39de36350b894f8555d4f16404655a769ab12b9`. Coach label: **not available**.
[Full inference result](private/technique-smoke/biceps_curl.json)

| Criterion | Measurement | Side / valid samples | Range | Reason |
|---|---|---|---|---|
| CURL-01 | degrees | LEFT / 131 | {"count": 131, "min": 57.769, "max": 178.631, "range": 120.862} | CAMERA_VIEW_NOT_VERIFIED |
| CURL-02 | degrees | LEFT / 131 | {"count": 131, "min": 3.173, "max": 21.421, "range": 18.248} | CAMERA_VIEW_NOT_VERIFIED |

## SHOULDER_PRESS

Source: https://www.pexels.com/video/man-lifting-weights-5837705/
SHA-256: `cfa4fd92731b994508d88f4a56062e65fdf6901ca7fde1bf1dbc7d6d28140488`. Coach label: **not available**.
[Full inference result](private/technique-smoke/shoulder_press.json)

| Criterion | Measurement | Side / valid samples | Range | Reason |
|---|---|---|---|---|
| PRESS-01 | degrees | RIGHT / 40 | {"count": 40, "min": 0.663, "max": 175.084, "range": 174.421} | CAMERA_VIEW_NOT_VERIFIED |
| PRESS-02 | torso_lengths | LEFT / 10 | {"count": 10, "min": 0.672, "max": 1.538, "range": 0.866} | CAMERA_VIEW_NOT_VERIFIED |
