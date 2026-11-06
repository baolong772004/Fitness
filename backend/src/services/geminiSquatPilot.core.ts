export type VisionFinding = {
  repNumber: number;
  criterionId: string;
  timestampSeconds: number;
  observation: string;
  correction: string;
};

const criterionIds = new Set(['SQUAT-01', 'SQUAT-02', 'SQUAT-03', 'SQUAT-04', 'SQUAT-05', 'SQUAT-08']);

export function reconcileVisionFindings(raw: unknown, analysis: any) {
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as any).findings) || (raw as any).findings.length > 5) {
    throw new Error('VISION_INVALID_RESPONSE');
  }
  const reps: any[] = Array.isArray(analysis?.repetitions) ? analysis.repetitions : [];
  const criteria: any[] = analysis?.provisionalEvaluation?.criteria || analysis?.experimentalEvaluation?.criteria || [];
  const duration = Number(analysis?.video?.durationSeconds);
  const view = analysis?.cameraView?.detected;
  const protocol = analysis?.protocol || analysis?.requestOptions || {};
  return (raw as any).findings.map((item: any) => {
    if (!item || !Number.isSafeInteger(item.repNumber) || !criterionIds.has(item.criterionId) ||
        !Number.isFinite(item.timestampSeconds) || item.timestampSeconds < 0 ||
        (Number.isFinite(duration) && item.timestampSeconds > duration) ||
        typeof item.observation !== 'string' || item.observation.trim().length < 3 || item.observation.length > 240 ||
        typeof item.correction !== 'string' || item.correction.trim().length < 3 || item.correction.length > 240) {
      throw new Error('VISION_INVALID_RESPONSE');
    }
    const rep = reps.find((row, index) => Number(row.number ?? index + 1) === item.repNumber);
    const withinRep = rep && item.timestampSeconds >= Number(rep.startSeconds) - 0.5 &&
      item.timestampSeconds <= Number(rep.endSeconds) + 0.5;
    const viewAllows = item.criterionId === 'SQUAT-02' ? view === 'SIDE' && protocol.depthTarget === 'HIP_AT_KNEE'
      : item.criterionId === 'SQUAT-03' ? view === 'FRONT'
      : item.criterionId === 'SQUAT-04' ? view === 'SIDE'
      : item.criterionId === 'SQUAT-08' ? protocol.depthTarget === 'HIP_AT_KNEE' || Number.isFinite(protocol.descentTargetSeconds)
      : true;
    const rule = criteria.find(row => (row.id ?? row.criterionId) === item.criterionId);
    const matchingPrediction = withinRep && viewAllows && rule?.predictions?.find((prediction: any) =>
      prediction.status === 'NEEDS_IMPROVEMENT' && Number(prediction.rep ?? prediction.repNumber) === item.repNumber &&
      Math.abs(Number(prediction.timestampSeconds) - item.timestampSeconds) <= 2);
    return {
      repNumber: item.repNumber,
      criterionId: item.criterionId,
      timestampSeconds: item.timestampSeconds,
      observation: item.observation.trim(),
      correction: item.correction.trim(),
      reviewStatus: matchingPrediction ? 'RULE_CORROBORATED_COACH_REVIEW' : 'UNSUPPORTED_COACH_REVIEW',
      reason: !rep || !withinRep ? 'REP_OR_TIME_MISMATCH' : !viewAllows ? 'VIEW_OR_TARGET_NOT_SUPPORTED'
        : matchingPrediction ? 'MATCHING_RULE_PREDICTION' : 'NO_MATCHING_RULE_PREDICTION',
    };
  });
}

export function reconcileVisionAssessments(raw: unknown, analysis: any) {
  const rows = (raw as any)?.assessments;
  if (!Array.isArray(rows) || rows.length > 80) throw new Error('VISION_INVALID_RESPONSE');
  const reps: any[] = analysis?.repetitions || [];
  const criteria: any[] = analysis?.provisionalEvaluation?.criteria || analysis?.experimentalEvaluation?.criteria || [];
  const seen = new Set<string>();
  return rows.map((item: any) => {
    const rep = reps.find((row, index) => Number(row.number ?? index + 1) === item?.repNumber);
    const identity = `${item?.repNumber}:${item?.criterionId}`;
    if (!rep || seen.has(identity) || !criterionIds.has(item.criterionId) ||
        !['MEETS_CRITERION', 'NEEDS_IMPROVEMENT', 'UNABLE_TO_ASSESS'].includes(item.status) ||
        typeof item.observation !== 'string' || !item.observation.trim() || item.observation.length > 320 ||
        typeof item.correction !== 'string' || item.correction.length > 240 ||
        (item.status === 'NEEDS_IMPROVEMENT' && !item.correction.trim()) ||
        (item.timestampSeconds !== null && (!Number.isFinite(item.timestampSeconds) ||
          item.timestampSeconds < rep.startSeconds - 0.5 || item.timestampSeconds > rep.endSeconds + 0.5))) {
      throw new Error('VISION_INVALID_RESPONSE');
    }
    seen.add(identity);
    const protocol = analysis?.protocol || analysis?.requestOptions || {};
    const view = analysis?.cameraView?.detected;
    const viewAllows = item.criterionId === 'SQUAT-02' ? view === 'SIDE' && protocol.depthTarget === 'HIP_AT_KNEE'
      : item.criterionId === 'SQUAT-03' ? view === 'FRONT'
      : item.criterionId === 'SQUAT-04' ? view === 'SIDE'
      : item.criterionId === 'SQUAT-08' ? Number.isFinite(protocol.descentTargetSeconds) || (view === 'SIDE' && protocol.depthTarget === 'HIP_AT_KNEE') : true;
    const predictions = (criteria.find(row => (row.criterionId ?? row.id) === item.criterionId)?.predictions || [])
      .filter((row: any) => Number(row.repNumber ?? row.rep) === item.repNumber);
    const ruleStatus = predictions.some((row: any) => row.status === 'NEEDS_IMPROVEMENT') ? 'NEEDS_IMPROVEMENT'
      : predictions.length && predictions.every((row: any) => row.status === 'MEETS_CRITERION') ? 'MEETS_CRITERION' : 'UNABLE_TO_ASSESS';
    const supported = viewAllows && item.status !== 'UNABLE_TO_ASSESS' && ruleStatus === item.status &&
      item.timestampSeconds !== null && predictions.some((row: any) => row.status === item.status &&
        Math.abs(Number(row.timestampSeconds) - item.timestampSeconds) <= 2 && row.landmarkEvidence?.length > 0 &&
        Number.isFinite(row.observedValue));
    return { repNumber: item.repNumber, criterionId: item.criterionId,
      sourceStatus: item.status, sourceObservation: item.observation.trim(), sourceCorrection: item.correction.trim(),
      status: supported ? item.status : 'UNABLE_TO_ASSESS', timestampSeconds: item.timestampSeconds,
      observation: supported || item.status === 'UNABLE_TO_ASSESS' ? item.observation.trim()
        : !viewAllows ? 'Góc quay hoặc mục tiêu chưa cho phép đánh giá tiêu chí này.' : 'Nhận xét hình ảnh chưa được số đo chuyển động xác nhận.',
      correction: supported && item.status === 'NEEDS_IMPROVEMENT' ? item.correction.trim() : '',
      reviewStatus: supported ? 'RULE_CORROBORATED' : 'UNSUPPORTED_BY_MEASUREMENT' };
  });
}
