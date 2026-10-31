# Developer and Coach Experimental Evaluation

## Safety boundary

Experimental output is a separate `experimentalEvaluation` object. The official `techniqueEvaluation`, standard status, and release checks are not changed by it. The experimental object is marked `UNVALIDATED` and must never be mapped to a Member verdict.

Enable it only in a local development environment:

1. Set `AI_EXPERIMENTAL_EVALUATION=true` in `backend/.env`.
2. Restart the backend and local AI service with `run-local.ps1`. The local launcher forwards this flag as `EXPERIMENTAL_EVALUATION_ENABLED` to the AI service.
3. Sign in to the development app as an active `COACH`/`TRAINER` or `ADMIN` account. Developer Mode is visible only in an Expo development build (`__DEV__`).
4. Upload a video from `/exercise-analysis`. The developer endpoint stores `evaluationMode=EXPERIMENTAL`; the ordinary Member endpoint always uses `OFFICIAL`.

Each new job persists `evaluationMode` in SQL at creation. Completed jobs also persist `ruleVersion` and `resultVersion`; the worker rejects an AI response with a mismatched mode or missing version. Old rows remain historical and are not silently reprocessed.

The backend rejects the developer endpoint in production, rejects Member roles, and returns only analyses owned by the authenticated developer/Coach. Keep both flags false in production. The AI service also requires the private service key.

The real-video regression trace is `backend/tests/artifacts/exercise-experimental-e2e.json`. It records selected JSON fields from direct FastAPI OFFICIAL/EXPERIMENTAL responses, queued Backend job, Worker SQL row, Backend detail response, and the Mobile visibility projection. The same SHA-256 video is used for every layer. The integration database is temporary and removed after the run.

## Current experimental rule coverage

For `BODYWEIGHT` Squat, `SQUAT-03` compares each side's projected inward knee displacement to `SquatConfig.knee_inward_ratio` (default `0.10` stance widths). This is an existing provisional algorithm parameter, not an ACE/NSCA numeric standard. `SQUAT-02` compares projected hip and knee height only from a side view when the user explicitly selects `HIP_AT_KNEE`; its zero boundary comes from that selected geometric target, not a population norm. Both rules require rep-level quality and landmark evidence. Neither proves injury risk, complete-form quality, or safety.

The other criteria produce criterion-specific abstentions. For example: `SQUAT-02` requires a side view, explicit depth target, and stable per-rep reference; `SQUAT-04` requires a side view and a decision rule; `SQUAT-01` and `SQUAT-05` have timing measurements but no decision boundary; `SQUAT-06` has no bilateral decision rule; `SQUAT-07` cannot infer floor contact; `SQUAT-08` requires a typed individual target. Other exercises still lack rep or hold segmentation, so their measurements do not yield verdicts.

## Coach review persistence

After applying the additive SQL Server migration, authenticated active Coaches can:

- `POST /coach/shared-exercise-analyses/:analysisId/technique-labels` to persist hash-bound labels, but only for a currently shared, video-consented analysis with an active PT relationship.
- `GET /coach/shared-exercise-analyses/:analysisId/technique-labels` to inspect their labels.
- `POST /coach/shared-exercise-analyses/criteria-review` to save review conditions and threshold proposals against the current AI-service standard version and digest.

Criterion content review is stored as `COACH_REVIEWED_PENDING_VIDEO_VALIDATION`. The application deliberately does not offer an API that promotes a draft to `APPROVED_AND_VALIDATED`. The independent holdout evaluator and hash-bound release gate remain required; coach notes, database edits, or self-reported thresholds do not activate Member verdicts.

The Coach review migration and the additive job mode/version migration have been applied to the local development SQL database. Future environments must apply both through the normal migration process.

## Timestamp overlay behavior

The audited video is 16.52s long. Its last 10 Hz pose sample is at 16.416s, with all 16 landmarks present and valid core landmarks on both sides. Native playback near the clip end reported roughly 16.522s, 106 ms from that sample. Mobile now holds the final sample through the recorded duration within one sampling period (plus 50 ms playback tolerance), and displays the requested timestamp and actual pose timestamp/offset. This is a sampling-window issue for this clip, not a failed pose inference.

