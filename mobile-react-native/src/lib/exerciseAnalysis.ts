import { API_URL, request, sessionStore } from './api';
import { fetch } from 'expo/fetch';
import { File } from 'expo-file-system';

export type AnalysisOptions = { cameraView: 'AUTO' | 'SIDE' | 'FRONT'; depthTarget: 'NONE' | 'HIP_AT_KNEE'; descentTargetSeconds: number | null };
export type ExerciseCode = 'SQUAT' | 'PUSH_UP' | 'PLANK' | 'LUNGE' | 'BICEPS_CURL' | 'SHOULDER_PRESS';
export type VideoProvenanceInput = { videoOrigin: 'USER_UPLOAD' | 'SAMPLE' | 'DATASET'; captureMethodDeclared: 'CAMERA' | 'LIBRARY'; performerDeclaration: 'SELF_DECLARED' | 'OTHER_PERSON' | 'UNKNOWN' };
export type SessionSignal = { analysisId: number; cameraView: string | null; criterionId: string; title: string; repNumber?: number; timestampSeconds?: number; status: TechniqueStatus; observedValue?: number | null; units?: string; threshold?: Record<string, unknown>; bodyPart?: string; feedback?: string; evidenceFrames?: number };
export type SquatSession = { sessionGroupId: string; status: string; wholeExerciseStatus: 'UNABLE_TO_CONFIRM'; samePersonSessionConfirmed: boolean; performerIdentityVerified: false; repSynchronization: 'NONE'; clips: { analysisId: number; status: string; videoOrigin: string; performerDeclaration: string; cameraViewDetected: string | null; detectedRepetitions: number | null }[]; criteria: { criterionId: string; title: string; evidenceClips: unknown[] }[]; measuredMeets: SessionSignal[]; measuredNeedsImprovement: SessionSignal[]; unable: { criterionId: string; title: string; analysisId: number; cameraView: string | null; reasonCode: string | null }[] };
export type TechniqueStatus = 'PASS' | 'MEETS_CRITERION' | 'NEEDS_IMPROVEMENT' | 'MEASURED' | 'UNABLE_TO_ASSESS' | 'NOT_SUPPORTED' | 'INSUFFICIENT_DATA';
export type JointEvidence = { timestampSeconds: number; landmarks: Record<string, { x: number; y: number; visibility: number }> };
export type TechniqueMeasurement = { repNumber: number; timestampSeconds: number; startSeconds?: number; endSeconds?: number; side?: string; observedValue?: Record<string, unknown>; units?: Record<string, string>; landmarkEvidence?: JointEvidence[]; measurementQuality?: { continuousTracking?: boolean; stableReference?: boolean; referenceRequired?: boolean; reasonCode?: string | null }; confidenceOfObservation?: number; outcome?: string; evidence?: Record<string, unknown> };
export type TechniqueVerdict = TechniqueMeasurement & { status: TechniqueStatus; targetValue?: unknown; feedback?: { issue?: string; reason?: string; adjustments?: string[]; retry?: string; coachReview?: string } };
export type TechniqueCriterion = { code: string; criterionId?: string; title: string; description: string; joints: string[]; cameraViews: string[]; bodyPart: string; status: TechniqueStatus; reasonCode: string | null; reason: string | null; referenceStandardVersion?: string; measurement: { sampleCount?: number; side?: string; unit?: string; range?: { count: number; min: number | null; max: number | null; range: number | null }; minimum?: { timeSeconds: number; value: number; joints: Record<string, { x: number; y: number; visibility: number }> }; maximum?: { timeSeconds: number; value: number; joints: Record<string, { x: number; y: number; visibility: number }> }; perRep?: TechniqueMeasurement[] } | null; verdicts?: TechniqueVerdict[]; improvement: string | { suggestions?: string[]; adjustments?: string[]; retry?: string; coachReviewWhen?: string }; validation: string; approval: Record<string, unknown> | null };
export type TechniqueEvaluation = { engineVersion: string; exercise: ExerciseCode; exerciseVariant?: string; referenceStandardVersion?: string; status: TechniqueStatus; headline: string; passedCriteria: number; needsImprovementCriteria: number; measuredCriteria: number; unableCriteria?: number; criteria: TechniqueCriterion[]; planContext?: { exerciseName: string; sessionTitle: string; sets: number; reps: number; weightKg: number | null; notes: string; limitation?: string; planVersion?: number } | null; limitations: string[] };
export type ExperimentalPrediction = Omit<TechniqueMeasurement, 'observedValue' | 'units'> & { criterionId: string; status: TechniqueStatus; unvalidated: true; bodyPart: string; observedValue: number | null; units: string; threshold?: { minimum?: number; maximum: number; target?: number; tolerance?: number; hipShoulderRiseMaximum?: number; source: string; validation: string }; feedback?: string; reasonCode?: string };
export type ExperimentalCriterion = { criterionId: string; title: string; status: TechniqueStatus; unvalidated: true; reasonCode: string | null; missingRequirements?: string[]; predictions: ExperimentalPrediction[]; measurementAvailable: boolean; bodyPart?: string; improvement?: string };
export type ExperimentalEvaluation = { mode: 'EXPERIMENTAL'; validation: 'UNVALIDATED'; warning: string; ruleVersion: string; standardVersion: string; passedCriteria: number; needsImprovementCriteria: number; unassessableCriteria: number; criteria: ExperimentalCriterion[] };
export type ProvisionalCorrection = { criterionId: string; title: string; bodyPart: string; repNumber: number; timestampSeconds: number; observedValue: number; units: string; threshold: ExperimentalPrediction['threshold']; feedback: string; affectedReps: number[]; evidenceFrames: number };
export type ProvisionalEvaluation = Omit<ExperimentalEvaluation, 'mode'> & { mode: 'PROVISIONAL'; decisionScope: 'PER_CRITERION_2D_ONLY'; screeningStatus?: 'NEEDS_IMPROVEMENT_DETECTED' | 'NO_ISSUE_DETECTED_IN_ASSESSED_SCOPE' | 'UNABLE_TO_ASSESS'; wholeExerciseStatus?: 'UNABLE_TO_CONFIRM'; correctionPriorities?: ProvisionalCorrection[] };
export type Criterion = { code: string; title?: string; bodyPart?: string; status: string; outcome?: string; reason: string | null; formula: string; detectionRule: string; limitation: string; qualityConditions?: string; thresholds?: Record<string, number>; evidence?: Record<string, number | string>; assessedReps?: number; totalReps?: number; signalReps?: number; kind?: string };
export type Observation = { code: string; message: string; timestampSeconds: number; confidence: number; confidenceBasis?: string; suggestion: string; repNumber?: number; bodyPart?: string; evidence?: Record<string, number | string>; evidenceText?: string; limitation?: string; kind?: string; intervalSeconds?: number[] | null };
export type Repetition = { number: number; startSeconds: number; bottomSeconds: number; endSeconds: number; minimumKneeAngle: number | null; bottomHipAngleDegrees: number | null; rangeDegrees: number | null; descentSeconds: number; ascentSeconds: number; maximumTorsoLeanDegrees: number | null; observations: Observation[]; notAssessed: { code: string; reason: string }[]; criteria?: Criterion[]; cameraAngle?: string; hipTravelRatio?: number; trackingCoverage?: number };
export type StoredRepetition = Pick<Repetition, 'startSeconds' | 'bottomSeconds' | 'endSeconds' | 'minimumKneeAngle' | 'rangeDegrees' | 'maximumTorsoLeanDegrees'> & Partial<Repetition>;
export type PoseFrame = { timeSeconds: number; repNumber: number | null; side: 'LEFT' | 'RIGHT' | 'BOTH'; kneeAngleDegrees: number | null; torsoLeanDegrees: number | null; landmarks: Record<string, { x: number; y: number; visibility: number }> };
export type AnalysisResult = {
  exercise: ExerciseCode; status: string; quality: string; detectedRepetitions: number | null;
  evaluationMode?: 'OFFICIAL' | 'EXPERIMENTAL'; resultVersion?: string;
  exerciseVariant?: string;
  referenceStandardVersion?: string;
  analysisCoverage?: 'COMPLETE_REPETITIONS' | 'VALID_SEGMENTS_ONLY' | 'NONE';
  observations: Observation[];
  repetitions?: StoredRepetition[];
  poseFrames?: PoseFrame[];
  video?: { width: number; height: number; durationSeconds: number; sampleRateHz: number };
  criteria?: Criterion[];
  cameraView?: { detected: string; requested: string; supportFraction?: number };
  protocol?: AnalysisOptions;
  requestOptions?: AnalysisOptions;
  limitations: string[];
  techniqueEvaluation?: TechniqueEvaluation;
  experimentalEvaluation?: ExperimentalEvaluation;
  provisionalEvaluation?: ProvisionalEvaluation;
  coachPlanContext?: TechniqueEvaluation['planContext'];
};
export type Analysis = {
  id: number; status: string; errorCode: string | null; createdAt: string; studentPlanId: number | null; result: AnalysisResult | null;
  evaluationMode?: 'OFFICIAL' | 'EXPERIMENTAL'; resultVersion?: string;
  videoOrigin?: 'USER_UPLOAD' | 'SAMPLE' | 'DATASET' | 'UNVERIFIED_LEGACY'; captureMethodDeclared?: string; performerDeclaration?: string;
  sourceReference?: string | null; sessionGroupId?: string | null; samePersonSessionConfirmed?: boolean;
  videoAvailable?: boolean;
  ruleVersion?: string;
  shares?: { id: number; coachId: number; revokedAt: string | null; includeVideo?: boolean; coach: { id: number; fullName: string } }[];
  feedback?: { id: number; comment: string; createdAt: string; coach: { id: number; fullName: string } }[];
};

export const exerciseAnalysis = {
  supported: async () => (await request<{ data: { code: ExerciseCode; name: string; cameraAngle: string; measurementStatus: string; techniqueStatus: string; supportStatus?: string; variants?: string[] }[] }>('GET', '/exercise-analysis/supported-exercises')).data,
  history: async () => (await request<{ data: Analysis[] }>('GET', '/exercise-analysis/my-history')).data,
  detail: async (id: number) => (await request<{ data: Analysis }>('GET', `/exercise-analysis/${id}`)).data,
  reanalyze: async (id: number) => (await request<{ data: Analysis }>('POST', `/exercise-analysis/${id}/reanalyze`)).data,
  remove: async (id: number) => request('DELETE', `/exercise-analysis/${id}`),
  shareOptions: async () => (await request<{ data: { id: number; fullName: string }[] }>('GET', '/exercise-analysis/share-options')).data,
  share: async (id: number, coachId: number, includeVideo = false) => request('POST', `/exercise-analysis/${id}/share`, { coachId, includeVideo }),
  revoke: async (id: number, coachId: number) => request('DELETE', `/exercise-analysis/${id}/share?coachId=${coachId}`),
  async upload(video: { uri: string; fileName?: string | null; mimeType?: string | null }, studentPlanId?: number, options?: AnalysisOptions, exerciseType: ExerciseCode = 'SQUAT', exerciseVariant = 'UNSPECIFIED', provenance?: VideoProvenanceInput) {
    const body = new FormData();
    body.append('exerciseType', exerciseType);
    body.append('exerciseVariant', exerciseVariant);
    body.append('consent', 'true');
    if (options) body.append('analysisOptions', JSON.stringify(options));
    if (studentPlanId) body.append('studentPlanId', String(studentPlanId));
    if (provenance) for (const [key, value] of Object.entries(provenance)) body.append(key, value);
    body.append('video', new File(video.uri));
    const response = await fetch(`${API_URL}/exercise-analysis`, { method: 'POST', headers: { Authorization: `Bearer ${sessionStore.token()}`, Accept: 'application/json' }, body });
    const json = await response.json();
    if (!response.ok || !json.success) throw new Error(json.message || 'Không gửi được video.');
    return json.data as Analysis;
  },
  async developerUpload(video: { uri: string; fileName?: string | null; mimeType?: string | null }, options: AnalysisOptions | undefined, exerciseType: ExerciseCode, exerciseVariant: string, provenance?: VideoProvenanceInput) {
    const body = new FormData();
    body.append('exerciseType', exerciseType);
    body.append('exerciseVariant', exerciseVariant);
    body.append('consent', 'true');
    if (options) body.append('analysisOptions', JSON.stringify(options));
    if (provenance) for (const [key, value] of Object.entries(provenance)) body.append(key, value);
    body.append('video', new File(video.uri));
    const response = await fetch(`${API_URL}/exercise-analysis/developer`, { method: 'POST', headers: { Authorization: `Bearer ${sessionStore.token()}`, Accept: 'application/json' }, body });
    const json = await response.json();
    if (!response.ok || !json.success) throw new Error(json.message || 'Không gửi được video thử nghiệm.');
    return json.data as Analysis;
  },
  developerDetail: async (id: number) => (await request<{ data: Analysis }>('GET', `/exercise-analysis/developer/${id}`)).data,
  developerHistory: async () => (await request<{ data: Analysis[] }>('GET', '/exercise-analysis/developer')).data,
  developerRemove: async (id: number) => request('DELETE', `/exercise-analysis/developer/${id}`),
  developerReanalyze: async (id: number) => (await request<{ data: Analysis }>('POST', `/exercise-analysis/developer/${id}/reanalyze`)).data,
  createSquatSession: async (frontAnalysisId: number, sideAnalysisId: number) => (await request<{ data: SquatSession }>('POST', '/exercise-analysis/sessions', { frontAnalysisId, sideAnalysisId, samePersonSessionConfirmed: true })).data,
  squatSession: async (sessionGroupId: string) => (await request<{ data: SquatSession }>('GET', `/exercise-analysis/sessions/${sessionGroupId}`)).data,
};
