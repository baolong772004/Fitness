# Real video audit: Bodyweight Squat

Date: 2026-10-31  
Video: `samples/front-facing-squat-pexels-5034577.mp4` (real footage, Pexels; SHA-256 `5d27d9b378af0d323237fa48fa2fe32befec20a72e4f24988f7979f7fef9c7a8`)  
Exercise variant: `BODYWEIGHT`  
Engine: `technique-evaluation-2` / `squat-observation-6`

This is a software inference check on real footage. The clip has no independent Coach labels, so it is development evidence only and cannot validate accuracy or release a technique verdict.

## Observed result

- Analysis completed; 165 sampled frames had pose landmarks (100% detection); 5 squat cycles were segmented.
- Five of eight criteria produced experimental measurements: `SQUAT-01`, `SQUAT-03`, `SQUAT-05`, `SQUAT-06`, and `SQUAT-08`.
- `SQUAT-02` (depth) and `SQUAT-04` (torso on ascent) returned `UNABLE_TO_ASSESS / VIEW_NOT_SUITABLE` because the clip is front-facing and these checks require a side view.
- `SQUAT-06` (projected left/right comparison) and `SQUAT-07` (heel/floor contact) are `NOT_SUPPORTED` for a technique decision. Measurements, where present, do not establish that either criterion is met or missed.
- No criterion returned `MEETS_CRITERION` or `NEEDS_IMPROVEMENT`. The five measured rows remain gated with `NOT_COACH_VALIDATED`.

## Developer experimental run

The same source video was analyzed again with the separate `EXPERIMENTAL` mode. Its SHA-256 matches the baseline above; repetition count remained 5, and pose coverage remained 165/165. The official `techniqueEvaluation` statuses remained unchanged and locked.

- Experimental verdicts: **1 criterion** (`SQUAT-03`) produced predictions; 7 criteria abstained with criterion-specific reasons.
- `SQUAT-03`: **10 per-side/per-rep predictions** across five reps, all `MEETS_CRITERION` under the provisional threshold `inwardChangeStanceRatio <= 0.10`; no `NEEDS_IMPROVEMENT` predictions occurred in this clip.
- The 10 measured values ranged from 0.0000 to 0.0468 stance widths. Each row includes knee side, rep, timestamp, landmark snapshots and tracking quality. The threshold comes from the existing `SquatConfig.knee_inward_ratio` heuristic. It is not a threshold prescribed by ACE/NSCA, not Coach approved, and not validated against labeled videos. A provisional “meets” means only “below this development heuristic,” not correct or safe squat form.
- `SQUAT-01` and `SQUAT-05` have cycle/timing measurements but no experimental decision rule. `SQUAT-08` has no individual target. `SQUAT-06` has no bilateral decision rule, while `SQUAT-07` cannot determine floor contact without floor calibration. `SQUAT-02` and `SQUAT-04` require side-view footage; this clip is front-facing.

Machine-readable before/after evidence is saved in `private/technique-smoke/squat-experimental-comparison.json` (ignored private artifact). It preserves the common video hash, baseline, official statuses, experimental predictions, and the overlay timestamp check.

## What this run demonstrates

The service can segment repetitions and retain criterion-specific projected measurements, timestamps, landmarks, coverage, and abstention reasons on an actual clip. It also rejects checks that need a different view and does not turn experimental observations into pass/fail results.

## What it does not demonstrate

There is no Coach ground truth for this clip, independent reviewer agreement, or holdout accuracy report. Therefore no technical error was confirmed or ruled out, no decision threshold was approved, and no criterion is ready for member-facing pass/improvement feedback. Coach review must label this video independently (or use a consented, Coach-assessed member video) and separately review the standard before any release gate can open.

## Skeleton overlay at 16.5 seconds

The nearest decoded pose sample is at 16.416 seconds (84 ms away). All 16 reported landmarks are present and both sides' shoulder/hip/knee/ankle landmarks are present. At 10 Hz, sampling naturally has no pose frame exactly at 16.5 seconds. The old overlay tolerance was 75 ms, so the valid nearest sample was hidden. The Mobile overlay tolerance is now 100 ms and the video panel shows the sampled timestamp and offset. This case is a sampling/tolerance mismatch, not a synchronization failure or a pose-tracking failure. The saved analysis cannot prove that every uploaded video has the same outcome; the playback check is specific to this video/model.

## Coach review tools

- `coach-technique-review.html` lets a Coach select a local video, inspect it frame by frame, mark complete reps/holds, assign a criterion label with timestamp and evidence, and export a hash-bound JSON annotation.
- `../standards/review.html` lets a qualified reviewer inspect source references and each criterion's formula, camera, conditions, limits, and advice, then export a review proposal.
- Backend Coach routes now persist hash-bound criterion labels for videos explicitly shared with video consent, and persist criterion review proposals against the exact standard version/digest. A content review is recorded as `COACH_REVIEWED_PENDING_VIDEO_VALIDATION`; it cannot set `APPROVED_AND_VALIDATED`.
- Both tools export local files. Neither claims a review occurred, writes approval into the server registry, or enables verdicts. Independent video validation and a separately checked release artifact are still required by `criterion_evaluation.py`.

