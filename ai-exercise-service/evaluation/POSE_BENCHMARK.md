# Pose model benchmark — Lite / Full / Heavy

Local software benchmark on identical real development videos. No Coach-confirmed labels are available; rep-count and technique accuracy are **not reported**. The active service model has not been changed.

Platform: `Windows-10-10.0.26300-SP0`. Processor: `AMD64 Family 25 Model 116 Stepping 1, AuthenticAMD`. Python: `3.11.9`.
Protocol: VIDEO mode, 10 Hz samples, existing visibility/quality gates and movement rules; one run per model/clip, no explicit warm-up. Model initialization and video decoding are included in wall time. Each model uses its own subprocess, clips run sequentially in the same order.

**The projected-knee step metric includes actual exercise movement and camera effects. It is a motion-sensitive proxy, not a validated landmark-jitter/stability score. Lower is not automatically better.**

**Peak RAM is the process high-water working set after each clip**, including Python, OpenCV, MediaPipe and data already loaded in that model process. It is not isolated model memory or per-clip allocation. No GPU resource claim is made.

[Full benchmark JSON](private/pose-benchmark/20261031T055005984849Z/benchmark.json)

| Model | Clip | FPS | Decoded / sampled / pose | Pose rate | Valid core / pose | Valid core / sample | Rep output | Measured criteria | Median projected knee step (°) | Time (s) | Process peak RAM (MiB) |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| lite | side | 29.970 | 614 / 205 / 205 | 100.0% | 100.0% | 100.0% | 2 | 6 | 1.6126 | 6.565 | 257.33 |
| lite | front | 29.970 | 495 / 165 / 165 | 100.0% | 100.0% | 100.0% | 5 | 5 | 2.6799 | 7.102 | 368.41 |
| lite | push_up | 25.000 | 391 / 157 / 157 | 100.0% | 100.0% | 100.0% | None | 2 | 2.4384 | 6.302 | 368.51 |
| lite | plank | 25.000 | 199 / 80 / 80 | 100.0% | 100.0% | 100.0% | None | 2 | 1.1827 | 3.760 | 368.51 |
| lite | lunge | 25.000 | 184 / 74 / 74 | 100.0% | 100.0% | 100.0% | None | 2 | 10.358 | 3.072 | 368.51 |
| lite | biceps_curl | 25.000 | 327 / 131 / 131 | 100.0% | 100.0% | 100.0% | None | 2 | 1.2939 | 5.380 | 368.51 |
| lite | shoulder_press | 23.976 | 128 / 53 / 40 | 75.5% | 7.5% | 5.7% | None | 2 | None | 2.743 | 368.51 |
| full | side | 29.970 | 614 / 205 / 205 | 100.0% | 100.0% | 100.0% | 2 | 6 | 1.4879 | 8.932 | 268.21 |
| full | front | 29.970 | 495 / 165 / 165 | 100.0% | 100.0% | 100.0% | 5 | 5 | 2.6894 | 8.953 | 378.72 |
| full | push_up | 25.000 | 391 / 157 / 157 | 100.0% | 100.0% | 100.0% | None | 2 | 2.1055 | 7.038 | 379.64 |
| full | plank | 25.000 | 199 / 80 / 80 | 100.0% | 100.0% | 100.0% | None | 2 | 1.3158 | 3.365 | 379.64 |
| full | lunge | 25.000 | 184 / 74 / 74 | 100.0% | 100.0% | 100.0% | None | 2 | 13.4939 | 2.738 | 379.64 |
| full | biceps_curl | 25.000 | 327 / 131 / 131 | 100.0% | 100.0% | 100.0% | None | 2 | 0.9729 | 4.726 | 379.64 |
| full | shoulder_press | 23.976 | 128 / 53 / 48 | 90.6% | 14.6% | 13.2% | None | 1 | 16.1237 | 2.405 | 379.64 |
| heavy | side | 29.970 | 614 / 205 / 205 | 100.0% | 81.5% | 81.5% | 2 | 6 | 1.3217 | 13.792 | 333.37 |
| heavy | front | 29.970 | 495 / 165 / 165 | 100.0% | 100.0% | 100.0% | 5 | 5 | 3.0825 | 12.541 | 443.25 |
| heavy | push_up | 25.000 | 391 / 157 / 157 | 100.0% | 6.4% | 6.4% | None | 2 | 2.0467 | 11.912 | 444.09 |
| heavy | plank | 25.000 | 199 / 80 / 80 | 100.0% | 100.0% | 100.0% | None | 2 | 0.9416 | 6.246 | 444.09 |
| heavy | lunge | 25.000 | 184 / 74 / 74 | 100.0% | 100.0% | 100.0% | None | 2 | 14.7878 | 5.126 | 444.09 |
| heavy | biceps_curl | 25.000 | 327 / 131 / 131 | 100.0% | 100.0% | 100.0% | None | 2 | 0.7338 | 9.771 | 444.09 |
| heavy | shoulder_press | 23.976 | 128 / 53 / 47 | 88.7% | 0.0% | 0.0% | None | 1 | None | 4.467 | 444.09 |

## Aggregate observations

| Model | Pose / samples | Valid core / samples | Total wall time (s) | Process peak RAM (MiB) |
|---|---:|---:|---:|---:|
| lite | 852 / 865 (98.5%) | 815 / 865 (94.2%) | 34.924 | 368.51 |
| full | 860 / 865 (99.4%) | 819 / 865 (94.7%) | 38.157 | 379.64 |
| heavy | 859 / 865 (99.3%) | 627 / 865 (72.5%) | 63.855 | 444.09 |

## Model artifacts

| Model | Bytes | SHA-256 | Source |
|---|---:|---|---|
| lite | 5777746 | `59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a` | [Official Google task bundle](https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task) |
| full | 9398198 | `5134a3aad27a58b93da0088d431f366da362b44e3ccfbe3462b3827a839011b1` | [Official Google task bundle](https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task) |
| heavy | 30664242 | `64437af838a65d18e5ba7a0d39b465540069bc8aae8308de3e318aad31fcbc7b` | [Official Google task bundle](https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task) |

Core-valid means shoulder, hip, knee and ankle on the better-tracked fixed side satisfy visibility and in-frame checks. It is reported against both pose frames and all sampled frames; it does not prove correct exercise technique. Whole-body core validity is conservative for upper-body exercises: elbow/wrist measurements can remain available even when ankles are cropped or low confidence. Per-criterion evidence and valid sample counts are in each full inference JSON. All outputs and video hashes are retained in the linked directory.

For reference: [official MediaPipe Pose Landmarker model documentation](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker#models).

## Limits and interpretation

- Small development sample, one run, no participant-independent holdout labels or confidence intervals.
- Segmentation differences are raw output differences, not measured counting errors.
- A model with better detection coverage or a larger task bundle has not thereby shown more accurate technique evaluation.
- The running Lite model stays selected until a separately reviewed deployment/configuration decision.

Re-run from `ai-exercise-service`: `python benchmark_pose_models.py`. New timestamped private artifacts are created; prior runs are preserved.
