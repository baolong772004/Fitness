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

export type RepScreening = {
  repNumber: number;
  status: 'NEEDS_IMPROVEMENT' | 'MEETS_OBSERVED_CRITERIA' | 'UNABLE_TO_ASSESS';
  firstIssue: { timestampSeconds: number; feedback: string } | null;
  unableReason: string | null;
  retryAdvice: string | null;
};

function missingSquatAdvice(evaluation: ExperimentalEvaluation | ProvisionalEvaluation,
  repNumber: number, cameraView: string | undefined) {
  const camera = cameraView || 'UNKNOWN';
  if (!['FRONT', 'SIDE'].includes(camera)) return {
    reason: 'Góc quay chưa đủ rõ để theo dõi tư thế.',
    retry: 'Quay chính diện hoặc ngang, thấy toàn thân và giữ máy cố định.',
  };
  const focusId = camera === 'FRONT' ? 'SQUAT-03' : 'SQUAT-02';
  const focus = evaluation.criteria.find(item => item.criterionId === focusId);
  const prediction = focus?.predictions.find(item => item.repNumber === repNumber &&
    item.status === 'UNABLE_TO_ASSESS');
  const code = prediction?.reasonCode || focus?.reasonCode || focus?.missingRequirements?.[0];
  if (code === 'NO_EXPLICIT_DEPTH_TARGET') return {
    reason: 'Chưa chọn mục tiêu độ sâu để đối chiếu.',
    retry: 'Chọn mục tiêu “hông gần ngang gối” và quay từ góc ngang.',
  };
  if (code === 'NO_INDIVIDUAL_TARGET') return {
    reason: 'Chưa có mục tiêu cá nhân để so sánh.',
    retry: 'Chọn mục tiêu độ sâu hoặc nhịp đã thống nhất với Coach.',
  };
  if (code === 'NO_EXPERIMENTAL_DECISION_RULE' || code === 'NOT_SUPPORTED' ||
      code === 'NO_VALIDATED_BILATERAL_DECISION_RULE') return {
    reason: 'AI chưa có quy tắc đủ tin cậy để chấm phần này.',
    retry: 'Gửi video cho Coach nhận xét; quay lại không tự giải quyết giới hạn này.',
  };
  if (code === 'VIEW_NOT_SUITABLE') return {
    reason: 'Góc quay không phù hợp với tiêu chí cần chấm.',
    retry: camera === 'FRONT' ? 'Quay thêm góc ngang để xem hông và thân người.'
      : 'Quay thêm chính diện để xem hướng gối.',
  };
  if (code === 'FOOT_ANCHOR_DRIFT_UNVERIFIED' || code === 'FOOT_REFERENCE_SCALE_UNVERIFIED') return {
    reason: 'Mốc bàn chân thay đổi trên ảnh, AI không theo dõi ổn định.',
    retry: 'Giữ máy cố định và thấy rõ cả hai bàn chân suốt lần tập.',
  };
  if (code === 'VARIANT_NOT_SUPPORTED') return {
    reason: 'Biến thể đã chọn chưa có quy tắc chấm phù hợp.',
    retry: 'Nếu tập không tạ, chọn “Không tạ”; biến thể khác cần Coach xem.',
  };
  if (code === 'NO_COMPLETE_REPETITION') return {
    reason: 'AI không thấy đủ một lần đứng, xuống rồi đứng lên.',
    retry: 'Quay trọn một lần tập từ tư thế đứng đến khi đứng lại.',
  };
  if (camera === 'FRONT') return {
    reason: 'Gối hoặc bàn chân của lần này chưa được theo dõi đủ rõ.',
    retry: 'Quay chính diện, đủ sáng, thấy toàn thân và hai bàn chân; giữ máy cố định.',
  };
  return {
    reason: 'Hông hoặc gối của lần này chưa được theo dõi đủ rõ.',
    retry: 'Quay góc ngang, đủ sáng, thấy trọn vai đến bàn chân; giữ máy cố định.',
  };
}

// A rep may be tentatively clear only when a form criterion was actually compared.
// Counting a complete cycle or comparing tempo alone cannot establish squat form.
export function screenSquatReps(evaluation: ExperimentalEvaluation | ProvisionalEvaluation | null,
  reps: Repetition[], cameraView?: string): RepScreening[] {
  if (!evaluation) return [];
  const formIds = new Set(['SQUAT-02', 'SQUAT-03', 'SQUAT-04', 'SQUAT-08']);
  return reps.map(rep => {
    const compared = evaluation.criteria.flatMap(criterion => criterion.predictions
      .filter(prediction => prediction.repNumber === rep.number &&
        ['MEETS_CRITERION', 'NEEDS_IMPROVEMENT'].includes(prediction.status))
      .map(prediction => ({ criterion, prediction })));
    const assessedForm = new Set(compared.filter(item => formIds.has(item.criterion.criterionId))
      .map(item => item.criterion.criterionId));
    const issue = compared.find(item => item.prediction.status === 'NEEDS_IMPROVEMENT');
    const unable = !issue && !assessedForm.size
      ? missingSquatAdvice(evaluation, rep.number, cameraView) : null;
    return {
      repNumber: rep.number,
      status: issue ? 'NEEDS_IMPROVEMENT' : assessedForm.size ? 'MEETS_OBSERVED_CRITERIA' : 'UNABLE_TO_ASSESS',
      firstIssue: issue ? { timestampSeconds: issue.prediction.timestampSeconds,
        feedback: issue.prediction.feedback || issue.criterion.improvement ||
          `Kiểm tra lại ${issue.criterion.title.toLowerCase()} cùng Coach.` } : null,
      unableReason: unable?.reason || null,
      retryAdvice: unable?.retry || null,
    };
  });
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
