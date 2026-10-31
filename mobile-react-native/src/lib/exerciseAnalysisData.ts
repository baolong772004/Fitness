import type { Analysis, AnalysisResult, ExperimentalEvaluation, ProvisionalEvaluation, Repetition } from './exerciseAnalysis';

// The UI uses this exact gate; tests feed it the real Backend detail JSON.
export function visibleExperimentalEvaluation(analysis: Analysis, developerMode: boolean): ExperimentalEvaluation | null {
  const evaluation = analysis.result?.experimentalEvaluation;
  return developerMode && analysis.evaluationMode === 'EXPERIMENTAL'
    && analysis.result?.evaluationMode === 'EXPERIMENTAL'
    && evaluation?.mode === 'EXPERIMENTAL' && evaluation.validation === 'UNVALIDATED'
    ? evaluation : null;
}

export function visibleProvisionalEvaluation(analysis: Analysis, developerMode: boolean): ProvisionalEvaluation | null {
  const evaluation = analysis.result?.provisionalEvaluation;
  return !developerMode && analysis.evaluationMode === 'OFFICIAL'
    && analysis.result?.evaluationMode === 'OFFICIAL'
    && evaluation?.mode === 'PROVISIONAL' && evaluation.validation === 'UNVALIDATED'
    && evaluation.decisionScope === 'PER_CRITERION_2D_ONLY'
    ? evaluation : null;
}

export function poseOverlayToleranceSeconds(sampleTime: number, finalSampleTime: number, playbackTime: number,
  durationSeconds: number | undefined, sampleRateHz: number): number {
  const rate = sampleRateHz > 0 ? sampleRateHz : 5;
  const base = 0.5 / rate + 0.05;
  return sampleTime === finalSampleTime && durationSeconds != null && playbackTime <= durationSeconds + 0.05
    ? 1 / rate + 0.05 : base;
}

// v2 results remain in history. Derive only timing/ordinal values supported by their stored data.
export function resultRepetitions(result: AnalysisResult | null): Repetition[] {
  return (result?.repetitions || []).map((rep, index) => ({
    ...rep,
    number: rep.number ?? index + 1,
    bottomHipAngleDegrees: rep.bottomHipAngleDegrees ?? null,
    descentSeconds: rep.descentSeconds ?? Math.round((rep.bottomSeconds - rep.startSeconds) * 100) / 100,
    ascentSeconds: rep.ascentSeconds ?? Math.round((rep.endSeconds - rep.bottomSeconds) * 100) / 100,
    observations: rep.observations ?? (result?.observations || []).filter(item => item.repNumber != null
      ? item.repNumber === (rep.number ?? index + 1)
      : item.timestampSeconds >= rep.startSeconds && item.timestampSeconds <= rep.endSeconds),
    notAssessed: rep.notAssessed ?? [{ code: 'LEGACY_RESULT', reason: 'Kết quả cũ chưa lưu đầy đủ tiêu chí từng rep. Gửi video mới để dùng bản phân tích hiện tại.' }],
  }));
}
