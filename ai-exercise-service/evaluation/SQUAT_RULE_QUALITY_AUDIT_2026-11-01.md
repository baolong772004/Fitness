# Squat candidate-rule audit — 2026-11-01

This audit checks software behavior on real development clips. It is not a Coach accuracy study. SQL has no real Coach labels, and the independent holdout manifest is empty. All six decision rules remain `EXPERIMENTAL`; `SQUAT-06` and `SQUAT-07` remain `NOT_SUPPORTED` for a verdict.

The changed quality and camera behavior is versioned as `squat-observation-7`, `technique-evaluation-3`, and `technique-experimental-4`. Saved jobs with older versions remain historical results; the Worker verifies the experimental version on a new job.

## Rule inventory

| Criterion | What is calculated and from which landmarks | View and candidate comparison | What the result can and cannot mean |
| --- | --- | --- | --- |
| SQUAT-01, complete cycle | Start, bottom, end from tracked hip/knee/ankle movement; `totalSeconds`, `descentSeconds`, `ascentSeconds`, `completedCycleObserved`. | SIDE, FRONT, OBLIQUE. Candidate: complete cycle, total 0.6–15 s, each phase at least 0.2 s. These are segmentation/development bounds from `SquatConfig`, not an ACE/NSCA form threshold. | Checks detection and timing only. A complete cycle does not prove good Squat technique or depth. Tracking gaps and missing phase anchors still cause abstention. |
| SQUAT-02, chosen depth | At the bottom, median `(knee_y - hip_y) / projected_femur_length` from shoulder/hip/knee/ankle frames. | SIDE only, with `HIP_AT_KNEE` selected before analysis. Candidate compares to 0 projected femur lengths; the personal target has coaching context, but the 2D decision boundary has not been Coach validated. | Can describe projected hip versus knee. Cannot identify the hip crease, individual safe depth, or true 3D depth. Requires stable spatial reference and bottom frames. |
| SQUAT-03, knee path | Per side, signed change of knee x relative to ankle/toe baseline, divided by standing stance width; uses hips, both ankles, knee, heel and toe. | FRONT only. Candidate inward change ≤0.10 stance widths from `SquatConfig.knee_inward_ratio`; this is a heuristic, not a threshold specified by ACE/NSCA. | Describes movement on the image. Cannot diagnose valgus, injury risk, or whether feet were placed correctly. Needs visible feet and stable camera/stance. |
| SQUAT-04, torso/hip coordination | Change in projected shoulder–hip lean from bottom, plus `(hip rise - shoulder rise) / projected torso length` during early ascent. | SIDE only. Candidate flags improvement only when lean rise ≥12° **and** hip–shoulder difference ≥0.12; both are development settings. | Describes coordination in the projection, not lumbar curvature, spinal loading, or injury. Early ascent frames and stable reference are required. |
| SQUAT-05, pace consistency | Per-rep descent/ascent durations and deviation from the clip median. | SIDE, FRONT, OBLIQUE; at least two reps. Candidate deviation ≤0.30 s and each phase ≥0.25 s. Development heuristic. | Describes within-set pace, not Squat form quality. A consistently shallow set can still have consistent timing. |
| SQUAT-08, selected plan target | Duration versus explicitly selected descent target (±0.30 s), or depth metric versus `HIP_AT_KNEE` target. | Tempo: SIDE or FRONT; depth: SIDE. Candidate target must be chosen before analysis. OBLIQUE is measurement-only, matching the standard's camera scope. | Only compares the chosen target. It does not decide if the target itself is suitable or the whole movement is correct. |

`SQUAT-06` records projected bilateral differences but has no validated bilateral decision rule. `SQUAT-07` records heel–toe projection but cannot measure floor contact or force from monocular 2D landmarks. Neither produces a technique verdict.

## Quality-gate finding and same-video replay

The previous `assess_rep` gate used one `techniqueTrackingSufficient` boolean for all criteria. It mixed frame continuity with spatial-reference stability. `squat_measurements._quality` then blocked even cycle and pace measurements when a foot anchor moved or projected heel–toe length changed. This was a reason to abstain on **spatial** comparisons, but not by itself evidence that tracked phase timestamps were missing.

Two real SIDE development videos were run before and after the change with identical video SHA-256, requested view, depth target, model and rule thresholds. Results are in `backend/tests/artifacts/exercise-coverage-side-before-quality.json` and `exercise-coverage-targeted.json`.

| Video | Real observation before change | Experimental after change | Spatial checks after change |
| --- | --- | --- | --- |
| `pexels-squat-6525519.mp4`, 2 reps, 63 pose frames | Both reps had continuous tracking, but projected ankle drift 0.139/0.129 exceeded the existing 0.12 stability gate. All 10 candidate predictions abstained. | SQUAT-01 and SQUAT-05 made provisional `MEETS_CRITERION` comparisons from cycle/pace data. | SQUAT-02/04/08 abstained with `FOOT_ANCHOR_DRIFT_UNVERIFIED`. |
| `github-side-squat.mp4`, 2 reps, 205 pose frames | Both reps had continuous tracking, but projected heel–toe length change 0.253/0.262 exceeded the existing 0.20 gate. All 10 candidate predictions abstained. | SQUAT-01 and SQUAT-05 made provisional `MEETS_CRITERION` comparisons from cycle/pace data. | SQUAT-02/04/08 abstained with `FOOT_REFERENCE_SCALE_UNVERIFIED`. |

The side-foot scale formula is `p90(projected heel–toe distance) / p10(projected heel–toe distance) - 1`. Projected foot length can change with pose-estimator jitter, foot rotation, occlusion or perspective as well as camera zoom. The 0.20 limit therefore remains an **abstention heuristic**, not a demonstrated diagnosis of camera motion. No threshold was widened. The new gate records whether a spatial reference is required; loss of core frames still blocks temporal comparisons.

## Unresolved accuracy risks

- Camera view is classified from 2D shoulder/hip ratios and standing frames; an oblique recording or changing camera can make SIDE/FRONT measurements misleading. SQUAT-08's candidate verdict was restricted to the standard's SIDE/FRONT scope.
- Bilateral body dimensions and stance width change with perspective and subject proportions. The 0.10 knee-path heuristic and 0.12 torso coordination ratio need Coach-reviewed development labels and independent holdout testing before release.
- Ten-Hz sampling, missing landmarks and brief jitter can shift phase boundaries. The engine retains timestamps, coverage, gap checks and actual landmark snapshots; it does not interpolate absent frames into evidence.
- SQUAT-01 and SQUAT-05 are cycle/pace checks. Their provisional `MEETS_CRITERION` labels must not be presented as overall correct form. Member sees neutral timing measurements with a `CHƯA ĐƯỢC KIỂM CHỨNG` label, while official pass/improvement remains gated.
- No Coach-labeled false positives or false negatives can be reported yet. Analysis #18 duplicates a development video and cannot become independent holdout even after Member grants video access.

Next human steps: Coach labels development reps independently; the rule and acceptance criteria are signed before collecting a distinct holdout; the holdout is evaluated per criterion/view/variant; only then can Coach use the release action. Until then, official approved criteria remain zero.
