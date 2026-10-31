<!-- Historical v3 audit retained for traceability. -->
> **Superseded by v4:** See [SQUAT_V4.md](SQUAT_V4.md) and [evaluation/development-smoke-report.json](evaluation/development-smoke-report.json). Counts/signs and 5 Hz below describe the previous v3 run. Current smoke script uses v4 at 10 Hz and stricter quality gates; do not use the old signs as current expected output.

# Squat observation v3 — validation and scope

This implementation uses OpenCV to decode video, MediaPipe Pose Landmarker Lite for joints, and Python rules for segmentation and observations. There is no language model judging the video. Text feedback is generated from the detected rule and its measurements.

## Processing and measurements

1. Validate the container, 25 MB limit and 3–30 second duration. Sample at 5 Hz; resize proportionally to at most 720 pixels.
2. Reject insufficient usable frames, blur, multiple detected people and unsuitable camera angle. Track one visible side consistently; selected joints need visibility >= 0.6 and must be inside the frame. The side-view gate uses projected shoulder/hip separation; it is a heuristic, not a calibrated camera estimator.
3. Convert normalized x/y to image pixels before measuring angles. This avoids stretching angle geometry in portrait videos. Smooth the knee angle with a three-sample median, without filling long gaps.
4. Segment standing → descending → ascending → standing. Standing threshold 155°, movement onset below 147°, rise from bottom >= 8°, completed ROM >= 35° and duration >= 0.6 s. A tracking gap > 0.61 s resets segmentation. Partial reps are not counted.
5. Store start/bottom/end, minimum knee angle, hip angle at bottom, ROM, down/up duration, maximum torso lean, normalized knee displacement and observation evidence for each complete rep.
6. Return visible joint samples and their timestamps for a client-side skeleton. The mobile view uses the video aspect ratio, hides uncertain/out-of-frame joints and frames more than 0.15 s from the playhead, and seeks to a rep or observation when tapped. Amber indicates a location to review, not a confirmed error.

| Criterion | Measurement and provisional trigger | What it cannot conclude |
| --- | --- | --- |
| Depth consistency | Standing knee angle minus minimum angle; flag ROM < 70% of maximum in that clip | Absolute depth, individual mobility or prescribed target depth |
| Torso lean change | Angle of hip–shoulder segment from vertical; last-rep maximum minus first >= 12° | Lumbar curvature, back injury or an unsafe absolute torso angle |
| Tempo consistency | Start→bottom and bottom→end; flag a phase > 1.6× shortest equivalent phase | Whether slow/fast or intentional pauses are incorrect |
| Knee travel consistency | Horizontal knee–ankle distance divided by projected shank length at bottom; range >= 0.2 | Knee-over-toe danger, knee valgus, or separation of depth/camera changes from technique |
| Left/right symmetry | Not assessed from side view | Requires validated front-view tracking of both sides |

These are within-clip comparisons, requiring at least two eligible complete reps. The reported confidence is median landmark visibility, not accuracy of the feedback. A single rep lists the comparative criteria as unassessed. The engine assumes the submitted exercise is Squat; it is not yet an exercise classifier.

## Local sample checks — 2026-10-30

Source: [rohanx01/Squat-Analysis-Model](https://github.com/rohanx01/Squat-Analysis-Model), `squat.mp4` (repository MIT license). Keep downloaded and derived footage under ignored `samples/`; no user footage is committed.

| Input | Observed pipeline output | Interpretation |
| --- | --- | --- |
| `github-side-squat.mp4`, 20.49 s | COMPLETED, 2 reps, 103 pose frames, no comparative signs | A smoke check; not proof of correct form |
| `squat-variable-depth-test.mp4`, about 7.4 s | COMPLETED, 2 reps, 37 pose frames; VARIABLE_ROM and VARIABLE_TEMPO | Artificial edit/reversal of the first clip, not a Coach-labeled real error |
| Generated uniform 4 s clip | INSUFFICIENT_DATA, no reps, no observations | Checks that empty/blurred video is not rated as good form |

Baseline rep measurements: rep 1 spans 8.6–11.4 s, bottom 10.4 s, ROM 86.4°, down/up 1.8/1.0 s. Rep 2 spans 15.2–18.2 s, bottom 17.2 s, ROM 86.2°, down/up 2.0/1.0 s. Values are 2D estimates at 5 Hz, not precise biomechanical ground truth.

Original SHA-256: `0a1b6dc35f6df231de33525c1f40ab1d4b98906b3523a1de39cd4e6f32316541`.
Variant SHA-256 from this run: `d093fffb25f91cc58bd3828aba59b3cf247140d40715724e4a10337f2c358532` (codec versions may change encoded bytes).

Run from `ai-exercise-service` in PowerShell:

```powershell
New-Item -ItemType Directory -Force samples
Invoke-WebRequest https://raw.githubusercontent.com/rohanx01/Squat-Analysis-Model/main/squat.mp4 -OutFile samples/github-side-squat.mp4
$env:MPLCONFIGDIR = Join-Path (Get-Location) '.venv/mplconfig'
.\.venv\Scripts\python.exe build_sample_variant.py
.\.venv\Scripts\python.exe -m unittest test_rules -v
.\.venv\Scripts\python.exe validate_samples.py
```

The variant concatenates 7.8–11.8 s, 14.6–15.8 s, the reverse of 14.6–15.8 s, and 15.0–15.7 s. Do not count it as an independently filmed subject. `validate_samples.py` writes detailed local JSON under `samples/` and asserts the expected outputs. The 12 rule tests cover geometry, rep boundaries, missing tracking, visibility, temporal ordering and evidence linkage.

Backend unit tests cover signature checks, private storage-key removal, expiry/path restrictions and quotas. The HTTP media test verifies byte ranges, no-store caching, missing files and expiry. Both sharing integration tests now pass against a fresh, isolated local SQL Server database, after applying all 19 migrations. They cover ownership, default result-only sharing, explicit boolean video consent, active Coach status, current PT relationship, revocation, feedback, history/detail payloads, expiry and deletion. The temporary database was removed after testing; application data was not used as fixtures.

To reproduce from `backend`, run `node tests/run-exercise-isolated.mjs` with a localhost `DATABASE_URL` and a Windows/SQL account permitted to create databases. The runner creates a randomly named `fitness_exercise_test_*` database and removes only that database in its cleanup. Alternatively set `PT_TEST_DATABASE_URL` to a separate migrated test database and run `node --import tsx --test tests/exerciseAnalysis.integration.test.ts`. The integration test refuses the application database.

Two mobile data compatibility tests pass (`node --import tsx --test tests/exerciseAnalysisData.test.ts` from `mobile-react-native`). Older v2 results lack rep ordinals, per-rep observations and hip angles; the adapter derives ordinals/timing, associates existing observations by timestamp, and shows missing measurements explicitly. It does not invent hip angles or rewrite stored results. The Android emulator also successfully opened v2 analysis #1 inside the comparison section of v3 analysis #2, with original video, rep buttons and the different-version notice.

Android emulator smoke test: uploaded the edited sample through the member app, worker completed analysis #2, authenticated video playback displayed the skeleton, and selecting rep 2 sought to 5.2 s with amber knee/ankle markers. The screen showed rep 2's 41.6° smoothed ROM compared with 86.8° maximum. Raw per-frame knee angle and smoothed rep minima intentionally differ. Coach sharing was implemented and built but not sent to a real Coach as part of this test.

## Remaining validation before expansion

Collect consented, independently filmed clips across people, lighting, clothes, body proportions and camera placement, with both valid and invalid inputs. Coach annotations should include complete/partial rep boundaries, each visible sign, whether a criterion is assessable, and corrective feedback. Compare rep count and boundary errors, per-sign precision/recall, missed signs, and quality-gate false acceptance/rejection. Keep a held-out set and record model/rule versions. Do not select thresholds using the final evaluation set.

In particular, test front/oblique views, occlusion, multiple people, camera motion, other exercises and deliberate tempo changes. No precision/recall, accuracy percentage or safety claim is supported by the current small sample set. Validate Squat first; then implement and separately evaluate Push-up and Plank.
