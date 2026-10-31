# Squat observation v5

## Why usable videos were rejected

- Front-view calibration required an uninterrupted standing pose in the first 0.5 seconds. A clip that started descending failed even when later repetitions contained clear standing poses.
- View voting used all frames equally. Squatting changes projected torso length, so a fixed camera could appear to switch between side, front and ambiguous views. Filtering out every ambiguous frame then created artificial gaps in the movement.
- Whole-clip coverage gates rejected usable continuous repetitions when other portions of the clip had missing joints.
- All unsupported criteria repeated the same failure reason, making missing features look like missing video data.

## Changes

`front_repetitions` now finds a continuous upright reference anywhere in the video. Hip height is relative to ankles and normalized by the fixed standing leg length. An incomplete opening repetition is skipped until a standing start is visible. No frames are interpolated across tracking gaps.

View voting uses extended-knee upright reference frames, with all-frame voting only if too few references exist. Usable joints remain available during the movement even when projected shoulder/hip widths cross a view boundary. A sustained opposing view at an upright reference still rejects a changing-camera clip. These are 2D heuristics, not calibrated camera angles or reliable front/back classification.

Clear continuous repetitions can be analyzed even if other parts of the clip are unusable. Per-repetition tracking coverage, maximum gaps, foot motion and geometry requirements still apply. Multi-person clips remain rejected. Invalid duration, un-decodable video and missing pose data still produce insufficient data.

Stable `OBLIQUE` clips can return repetitions and timing only. Side-only and front-only technique criteria remain unassessed for these clips. `MOVEMENT_TIMING` has outcome `MEASURED`, which does not indicate correct form. Missing goals, unsuitable views and unimplemented criteria have separate reasons.

## Regression checks

Run from this directory:

```powershell
.venv\Scripts\python.exe -m unittest test_rules test_squat_criteria test_evaluate -v
.venv\Scripts\python.exe validate_samples.py
```

The video script writes `.mp4.v5.json` results and `samples/validation-report-v5.json`, preserving the earlier v4 snapshots.

| Local clip | v4 | v5 |
| --- | --- | --- |
| `front-facing-squat-pexels-5034577.mp4` | Insufficient: initial standing calibration | Completed, 5 repetitions, front view |
| `dumbbell-goblet-squat.mp4` | Insufficient: view voting | Completed, 5 repetitions, side projection |
| `kettlebell-goblet-squat.mp4` | Insufficient: view voting | Completed, 5 repetitions, side projection |
| `barbell-back-squat.mp4` | Completed, 4 repetitions | Completed, 4 repetitions |
| `github-side-squat.mp4` | Completed, 2 repetitions | Completed, 2 repetitions |
| `squat-variable-depth-test.mp4` (edited) | Completed, 2 repetitions | Completed, 2 repetitions |
| Generated blank video | Insufficient | Insufficient |

These counts are development regression snapshots, not coach-confirmed ground truth or an accuracy measurement. Oblique and changing-view behavior also has synthetic geometry tests; broader real-camera validation is still needed.

## Local runtime and existing results

Restart the local AI process after changing Python code. `/health` now returns `ruleVersion: squat-observation-5` so the running version can be checked. Restart using `run-local.ps1` after stopping the old service.

Saved analysis records are historical snapshots. Selecting an old result does not rerun inference. Submit the video again to obtain a v5 result; existing results and coach feedback are not rewritten.
