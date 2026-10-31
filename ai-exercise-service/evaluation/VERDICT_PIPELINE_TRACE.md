# Squat verdict pipeline trace (2026-10-31)

Video: `samples/front-facing-squat-pexels-5034577.mp4`, SHA-256 `5d27d9b378af0d323237fa48fa2fe32befec20a72e4f24988f7979f7fef9c7a8`. Real public footage; no Coach ground truth. Both modes used `BODYWEIGHT`, front view and the same video. Full AI comparison: `private/technique-smoke/squat-experimental-comparison.json`. The real Backend test used a disposable SQL database and deleted it after verification.

| Stage | Observed value / boundary |
| --- | --- |
| MediaPipe | 165 sampled pose frames; 165 frames with pose. Skeleton landmarks persisted in `poseFrames`. |
| Movement extraction | 5 complete Squat cycles; detected camera `FRONT`; 5 of 8 criterion groups have measurements. |
| Official technique evaluator | `released_policy()` returns `NOT_COACH_VALIDATED` for measured draft criteria. No official decisive verdict. |
| Experimental evaluator | `SQUAT-03` produces 10 side/rep predictions from front-view inward-knee projection, all provisional `MEETS_CRITERION` on this video; other 7 criteria abstain. |
| Corrective feedback | The 10 predictions include value, threshold, rep, timestamp, body part, landmarks and a provisional message. No `NEEDS_IMPROVEMENT` prediction occurred here, so improvement-message rendering was not demonstrated with this video. |
| FastAPI | The first real integration run found `experimentalEvaluation` missing although local Python generated it: the already-running FastAPI process was stale. After restarting that exact listener, the endpoint returned the experimental object. |
| Worker | Sends persisted `evaluation_mode=EXPERIMENTAL`; retains the AI response and its experimental object in `resultJson`. |
| SQL | Real integration test read `resultJson` and matched its `experimentalEvaluation` to the API response. Reanalysis created a new ID; source record remained completed. |
| Backend API | Developer detail returns the same experimental object; Member detail returns official result. Developer history lists experimental records. |
| React Native | `ExerciseAnalysisResult` renders experimental panel only when `showExperimental` is true for `__DEV__` Coach/Trainer/Admin. Typecheck passed; no connected device was available for a visual/on-device assertion. |

The first status gate in the **official** branch is `technique_engine.evaluate_technique()` calling `criterion_evaluation.released_policy()`. The first loss in the **experimental** HTTP run was the stale FastAPI process, not Worker serialization. `run-local.ps1` previously returned early when a healthy listener already occupied port 8001; it did not verify that listener had loaded experimental mode. The launcher now checks the AI health flag and reports a stale process instead of silently accepting it. The final local AI process reports `ready=true`, `experimentalEvaluationEnabled=true`. Restart Backend after enabling `AI_EXPERIMENTAL_EVALUATION=true` locally. A Member record such as #10 remains an immutable official result; it will not acquire experimental predictions retroactively.

| Criterion | Measurement / example observed value | Experimental rule / threshold | Camera / standard | Experimental / official / reason |
| --- | --- | --- | --- | --- |
| SQUAT-01 | Yes; rep 1 down 0.701 s, up 0.801 s | No decision rule | FRONT / draft | Unable / Measured; `NO_EXPERIMENTAL_DECISION_RULE`, `NOT_COACH_VALIDATED` |
| SQUAT-02 | No front-view depth measure | No front rule or threshold | SIDE required / draft | Unable / Unable; `VIEW_NOT_SUITABLE` |
| SQUAT-03 | Yes; rep 1 left 0.0261 and right 0.0081 stance widths | Provisional comparison `<= 0.10` stance widths, from SquatConfig | FRONT / draft | Provisional Meets / Measured; official `NOT_COACH_VALIDATED` |
| SQUAT-04 | No front-view torso ascent measure | No front rule or threshold | SIDE required / draft | Unable / Unable; `VIEW_NOT_SUITABLE` |
| SQUAT-05 | Yes; rep 1 down 0.701 s, up 0.801 s | No decision rule | FRONT supported for measurement / draft | Unable / Measured; `NO_EXPERIMENTAL_DECISION_RULE`, `NOT_COACH_VALIDATED` |
| SQUAT-06 | Yes; rep 1 projected knee difference 7.885° | No bilateral decision rule or threshold | FRONT / draft | Unable / Not supported; `NO_VALIDATED_BILATERAL_DECISION_RULE` |
| SQUAT-07 | No floor-contact measurement | No rule; floor calibration absent | FRONT insufficient / draft | Unable / Not supported; `NOT_SUPPORTED` |
| SQUAT-08 | Yes; rep 1 timing available | No individual target supplied, hence no comparison | FRONT / draft | Unable / Measured; `NO_INDIVIDUAL_TARGET`, official `NOT_COACH_VALIDATED` |

`SQUAT-03` is a projected 2D heuristic, not a confirmation that knee alignment or the complete Squat technique is correct. No draft criterion was promoted to approved. The only real video here yielded provisional meets; false-improvement and accuracy rates require independent Coach-labeled clips.

Verification: Python engine tests 14 passed; Backend and Mobile TypeScript checks passed; isolated SQL integration passed 3 existing transport tests plus 2 real-video cases (official and Developer upload/Worker/SQL/API/reanalysis). The first integration attempt also exposed the AI Coach-review migration ordered before `ExerciseAnalysis`; that migration was moved after the analysis table migration. The disposable test database was removed.
