export function isSupportedVideo(bytes) {
  if (bytes.length < 32) return false;
  return bytes.toString('ascii', 4, 8) === 'ftyp' || bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
}

export function publicAnalysis(row) {
  const { mediaStorageKey, resultJson, ...safe } = row;
  return { ...safe, videoAvailable: videoAvailable(row), result: resultJson ? JSON.parse(resultJson) : null };
}

export function analysisSummary(row) {
  const safe = publicAnalysis(row);
  if (safe.result) {
    const { poseFrames, diagnostics, techniqueEvaluation, ...summary } = safe.result;
    if (techniqueEvaluation) {
      const { standardSnapshot, ...techniqueSummary } = techniqueEvaluation;
      summary.techniqueEvaluation = { ...techniqueSummary, criteria: (techniqueSummary.criteria || []).map(({ measurement, verdicts, ...criterion }) => ({
        ...criterion, measuredSamples: measurement?.sampleCount || 0, verdictCount: verdicts?.length || 0,
      })) };
    }
    if (diagnostics) {
      const { timeline, decodeTimeline, segmentation, ...counts } = diagnostics;
      const { signal, ...states } = segmentation || {};
      summary.diagnostics = { ...counts, segmentation: states };
    }
    safe.result = summary;
  }
  return safe;
}

export function videoAvailable(row, now = Date.now()) {
  return typeof row.mediaStorageKey === 'string'
    && /^[0-9a-f-]{36}\.video$/i.test(row.mediaStorageKey)
    && !row.mediaDeletedAt
    && new Date(row.createdAt).getTime() > now - 7 * 24 * 60 * 60_000;
}

export function analysisQuota({ paid, trial, configured }) {
  const tier = paid ? 'PT_PAID' : trial ? 'PT_TRIAL' : 'MEMBER';
  const fallback = tier === 'PT_PAID' ? 10 : tier === 'PT_TRIAL' ? 5 : 3;
  const amount = Number(configured);
  return { tier, limit: Number.isSafeInteger(amount) && amount > 0 ? amount : fallback };
}

export function parseAnalysisOptions(raw) {
  const value = typeof raw === 'string' ? JSON.parse(raw) : raw ?? {};
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !['cameraView', 'depthTarget', 'descentTargetSeconds'].includes(key))) throw new Error('Invalid analysis options');
  const { cameraView = 'AUTO', depthTarget = 'NONE', descentTargetSeconds = null } = value;
  if (!['AUTO', 'SIDE', 'FRONT'].includes(cameraView) || !['NONE', 'HIP_AT_KNEE'].includes(depthTarget)) throw new Error('Invalid view or depth target');
  if (descentTargetSeconds !== null && (typeof descentTargetSeconds !== 'number' || !Number.isFinite(descentTargetSeconds) || descentTargetSeconds < 1 || descentTargetSeconds > 6)) throw new Error('Invalid descent target');
  return { cameraView, depthTarget, descentTargetSeconds };
}

export const CANDIDATE_SQUAT_POLICIES = {
  'SQUAT-01': {
    passCondition: {
      kind: 'ALL_OF',
      conditions: [
        { kind: 'BOOLEAN_EQUALS', observedKey: 'completedCycleObserved', expected: true },
        { kind: 'NUMERIC_RANGE', observedKey: 'totalSeconds', minimum: 0.6, maximum: 15.0 },
        { kind: 'NUMERIC_RANGE', observedKey: 'descentSeconds', minimum: 0.2, maximum: 10.0 },
        { kind: 'NUMERIC_RANGE', observedKey: 'ascentSeconds', minimum: 0.2, maximum: 10.0 },
      ],
    },
    improvementCondition: { kind: 'COMPLEMENT_OF_PASS' },
    thresholds: { minimumRepSeconds: 0.6, maximumRepSeconds: 15.0 },
  },
  'SQUAT-02': {
    passCondition: { kind: 'NUMERIC_RANGE', observedKey: 'hipAboveKneeRatio', minimum: -1.0, maximum: 0.0 },
    improvementCondition: { kind: 'COMPLEMENT_OF_PASS' },
    thresholds: { maximumHipAboveKneeRatio: 0.0 },
  },
  'SQUAT-03': {
    passCondition: { kind: 'NUMERIC_RANGE', observedKey: 'inwardChangeStanceRatio', minimum: -1.0, maximum: 0.10 },
    improvementCondition: { kind: 'COMPLEMENT_OF_PASS' },
    thresholds: { maximumInwardChangeStanceRatio: 0.10 },
  },
  'SQUAT-04': {
    passCondition: {
      kind: 'ANY_OF',
      conditions: [
        { kind: 'NUMERIC_RANGE', observedKey: 'earlyAscentLeanChangeDegrees', minimum: -90.0, maximum: 12.0 },
        { kind: 'NUMERIC_RANGE', observedKey: 'hipShoulderRiseDifferenceRatio', minimum: -2.0, maximum: 0.12 },
      ],
    },
    improvementCondition: { kind: 'COMPLEMENT_OF_PASS' },
    thresholds: { maximumTorsoIncreaseDegrees: 12.0, maximumHipShoulderRiseRatio: 0.12 },
  },
  'SQUAT-05': {
    passCondition: {
      kind: 'ALL_OF',
      conditions: [
        { kind: 'NUMERIC_RANGE', observedKey: 'descentDifferenceFromClipMedianSeconds', minimum: -0.30, maximum: 0.30 },
        { kind: 'NUMERIC_RANGE', observedKey: 'ascentDifferenceFromClipMedianSeconds', minimum: -0.30, maximum: 0.30 },
        { kind: 'NUMERIC_RANGE', observedKey: 'descentSeconds', minimum: 0.25, maximum: 10.0 },
        { kind: 'NUMERIC_RANGE', observedKey: 'ascentSeconds', minimum: 0.25, maximum: 10.0 },
      ],
    },
    improvementCondition: { kind: 'COMPLEMENT_OF_PASS' },
    thresholds: { tempoToleranceSeconds: 0.30 },
  },
  'SQUAT-08': {
    passCondition: { kind: 'TARGET_TOLERANCE', observedKey: 'descentSeconds', targetKey: 'descentTargetSeconds', tolerance: 0.30 },
    improvementCondition: { kind: 'COMPLEMENT_OF_PASS' },
    thresholds: { tempoToleranceSeconds: 0.30 },
  },
};

export function evaluateCandidateRep(criterionId, repRow, protocol = {}, cameraView = 'UNKNOWN') {
  const obs = repRow?.observedValue || {};
  const quality = repRow?.measurementQuality || {};
  if (!quality.sufficientForExperimentalComparison || !Array.isArray(repRow?.landmarkEvidence) || !repRow.landmarkEvidence.length) {
    return 'UNABLE_TO_ASSESS';
  }
  if (criterionId === 'SQUAT-01' && ['SIDE', 'FRONT', 'OBLIQUE'].includes(cameraView)) {
    const ok = obs.completedCycleObserved === true && typeof obs.totalSeconds === 'number' && obs.totalSeconds >= 0.6 && obs.totalSeconds <= 15 && obs.descentSeconds >= 0.2 && obs.ascentSeconds >= 0.2;
    return ok ? 'MEETS_CRITERION' : 'NEEDS_IMPROVEMENT';
  }
  if (criterionId === 'SQUAT-02' && cameraView === 'SIDE' && protocol?.depthTarget === 'HIP_AT_KNEE') {
    if (typeof obs.hipAboveKneeRatio !== 'number') return 'UNABLE_TO_ASSESS';
    return obs.hipAboveKneeRatio <= 0 ? 'MEETS_CRITERION' : 'NEEDS_IMPROVEMENT';
  }
  if (criterionId === 'SQUAT-03' && cameraView === 'FRONT') {
    if (typeof obs.inwardChangeStanceRatio !== 'number') return 'UNABLE_TO_ASSESS';
    return obs.inwardChangeStanceRatio <= 0.10 ? 'MEETS_CRITERION' : 'NEEDS_IMPROVEMENT';
  }
  if (criterionId === 'SQUAT-04' && cameraView === 'SIDE') {
    if (typeof obs.earlyAscentLeanChangeDegrees !== 'number' || typeof obs.hipShoulderRiseDifferenceRatio !== 'number') return 'UNABLE_TO_ASSESS';
    return obs.earlyAscentLeanChangeDegrees >= 12.0 && obs.hipShoulderRiseDifferenceRatio >= 0.12 ? 'NEEDS_IMPROVEMENT' : 'MEETS_CRITERION';
  }
  if (criterionId === 'SQUAT-05' && ['SIDE', 'FRONT', 'OBLIQUE'].includes(cameraView)) {
    if (typeof obs.descentDifferenceFromClipMedianSeconds !== 'number' || typeof obs.ascentDifferenceFromClipMedianSeconds !== 'number') return 'UNABLE_TO_ASSESS';
    const maxDev = Math.max(Math.abs(obs.descentDifferenceFromClipMedianSeconds), Math.abs(obs.ascentDifferenceFromClipMedianSeconds));
    return maxDev <= 0.30 && (obs.descentSeconds || 0) >= 0.25 && (obs.ascentSeconds || 0) >= 0.25 ? 'MEETS_CRITERION' : 'NEEDS_IMPROVEMENT';
  }
  if (criterionId === 'SQUAT-08') {
    const hasTempo = typeof protocol?.descentTargetSeconds === 'number';
    const hasDepth = protocol?.depthTarget === 'HIP_AT_KNEE' && cameraView === 'SIDE';
    if (!hasTempo && !hasDepth) return 'UNABLE_TO_ASSESS';
    const tempoOk = hasTempo ? typeof obs.descentSeconds === 'number' && Math.abs(obs.descentSeconds - protocol.descentTargetSeconds) <= 0.30 : true;
    const depthOk = hasDepth ? typeof obs.hipAboveKneeRatio === 'number' && obs.hipAboveKneeRatio <= 0 : true;
    return tempoOk && depthOk ? 'MEETS_CRITERION' : 'NEEDS_IMPROVEMENT';
  }
  return 'UNABLE_TO_ASSESS';
}

export function coachAnalysisSummary(row) {
  const safe = publicAnalysis(row);
  if (safe.result) {
    const { poseFrames, diagnostics, ...summary } = safe.result;
    if (diagnostics) {
      const { timeline, decodeTimeline, segmentation, ...counts } = diagnostics;
      const { signal, ...states } = segmentation || {};
      summary.diagnostics = { ...counts, segmentation: states };
    }
    safe.result = summary;
  }
  return safe;
}

export function resolveCoachLabelHistory(coachLabels = [], defaultCameraView = 'UNKNOWN') {
  const groups = new Map();
  for (const raw of coachLabels || []) {
    let evidence = raw.evidence;
    if (!evidence && typeof raw.evidenceJson === 'string') {
      try { evidence = JSON.parse(raw.evidenceJson || '{}'); } catch { evidence = {}; }
    }
    evidence = evidence && typeof evidence === 'object' ? evidence : {};
    const cameraView = ['SIDE', 'FRONT', 'OBLIQUE'].includes(String(raw.cameraView || evidence.cameraView || '').toUpperCase())
      ? String(raw.cameraView || evidence.cameraView).toUpperCase()
      : defaultCameraView;
    const reviewerId = raw.coachId ?? raw.reviewerId ?? evidence.reviewerId ?? null;
    const labeledAt = raw.createdAt || evidence.labeledAt || null;
    const enriched = {
      ...raw,
      evidence,
      cameraView,
      reviewerId,
      labeledAt,
    };
    const key = `${enriched.criterionId}::${enriched.repNumber != null ? `rep-${enriched.repNumber}` : `${enriched.startSeconds}-${enriched.endSeconds}`}`;
    const list = groups.get(key) || [];
    list.push(enriched);
    groups.set(key, list);
  }
  const activeLabels = [];
  for (const list of groups.values()) {
    list.sort((a, b) => {
      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (ta !== tb) return ta - tb;
      return (Number(a.id) || 0) - (Number(b.id) || 0);
    });
    const latest = list[list.length - 1];
    activeLabels.push({
      ...latest,
      revision: list.length,
      editHistory: list.map((item, idx) => ({
        id: item.id ?? idx + 1,
        revision: idx + 1,
        outcome: item.outcome,
        repNumber: item.repNumber ?? null,
        startSeconds: item.startSeconds,
        endSeconds: item.endSeconds,
        timestampSeconds: item.timestampSeconds ?? null,
        cameraView: item.cameraView,
        reviewerId: item.reviewerId,
        standardVersion: item.standardVersion ?? null,
        reviewerNotes: item.reviewerNotes,
        createdAt: item.labeledAt,
      })),
    });
  }
  return {
    activeLabels,
    totalRevisions: (coachLabels || []).length,
  };
}

export function compareAiAndCoachLabels(result, coachLabels = []) {
  const criteria = result?.techniqueEvaluation?.criteria || [];
  const expCriteria = result?.experimentalEvaluation?.criteria || [];
  const cameraView = result?.cameraView?.detected || 'UNKNOWN';
  const protocol = result?.protocol || {};
  const { activeLabels, totalRevisions } = resolveCoachLabelHistory(coachLabels, cameraView);
  const rows = activeLabels.map(label => {
    const cid = label.criterionId;
    const crit = criteria.find(c => (c.criterionId || c.code) === cid);
    const expCrit = expCriteria.find(c => c.criterionId === cid);
    const perRep = crit?.measurement?.perRep || [];
    const verdicts = crit?.verdicts || [];
    const predictions = expCrit?.predictions || [];
    const matchRep = list => list.find(r => (label.repNumber != null && r.repNumber === label.repNumber)
      || (typeof r.startSeconds === 'number' && typeof r.endSeconds === 'number'
        && Math.min(label.endSeconds, r.endSeconds) - Math.max(label.startSeconds, r.startSeconds) > 0)) || null;
    const repMeasurement = matchRep(perRep);
    const repVerdict = matchRep(verdicts);
    const repPrediction = matchRep(predictions);
    const effectiveView = label.cameraView && label.cameraView !== 'UNKNOWN' ? label.cameraView : cameraView;
    const officialStatus = repVerdict?.resultStatus || repVerdict?.status || crit?.status || 'UNABLE_TO_ASSESS';
    const candidateStatus = repPrediction?.status || (repMeasurement ? evaluateCandidateRep(cid, repMeasurement, protocol, effectiveView) : 'UNABLE_TO_ASSESS');
    const aiDecisive = ['MEETS_CRITERION', 'NEEDS_IMPROVEMENT'].includes(officialStatus)
      ? officialStatus
      : ['MEETS_CRITERION', 'NEEDS_IMPROVEMENT'].includes(candidateStatus)
        ? candidateStatus
        : 'ABSTAINED';
    let agreement = 'AI_ABSTAINED';
    if (label.outcome === 'UNASSESSABLE') {
      agreement = aiDecisive === 'ABSTAINED' ? 'AGREE_UNASSESSABLE' : 'FALSE_ACCEPTANCE_ON_UNASSESSABLE';
    } else if (aiDecisive === 'ABSTAINED') {
      agreement = 'AI_ABSTAINED';
    } else if ((label.outcome === 'IMPROVE' && aiDecisive === 'NEEDS_IMPROVEMENT') || (label.outcome === 'MEETS' && aiDecisive === 'MEETS_CRITERION')) {
      agreement = 'AGREE';
    } else if (label.outcome === 'IMPROVE' && aiDecisive === 'MEETS_CRITERION') {
      agreement = 'DISAGREE_FALSE_NEGATIVE';
    } else {
      agreement = 'DISAGREE_FALSE_POSITIVE';
    }
    return {
      id: label.id,
      criterionId: cid,
      repNumber: label.repNumber ?? repMeasurement?.repNumber ?? null,
      cameraView: effectiveView,
      reviewerId: label.reviewerId,
      standardVersion: label.standardVersion || result?.techniqueEvaluation?.referenceStandardVersion || null,
      revision: label.revision || 1,
      editHistory: label.editHistory || [],
      startSeconds: label.startSeconds,
      endSeconds: label.endSeconds,
      timestampSeconds: label.timestampSeconds,
      coachOutcome: label.outcome,
      officialStatus,
      candidateStatus,
      aiComparableStatus: aiDecisive,
      observedValue: repMeasurement?.observedValue || null,
      agreement,
      reviewerNotes: label.reviewerNotes,
      createdAt: label.createdAt,
    };
  });
  return {
    totalLabels: rows.length,
    totalRevisions,
    agreeCount: rows.filter(r => r.agreement === 'AGREE' || r.agreement === 'AGREE_UNASSESSABLE').length,
    disagreeFalsePositiveCount: rows.filter(r => r.agreement === 'DISAGREE_FALSE_POSITIVE' || r.agreement === 'FALSE_ACCEPTANCE_ON_UNASSESSABLE').length,
    disagreeFalseNegativeCount: rows.filter(r => r.agreement === 'DISAGREE_FALSE_NEGATIVE').length,
    aiAbstainedCount: rows.filter(r => r.agreement === 'AI_ABSTAINED').length,
    coachUnassessableCount: rows.filter(r => r.coachOutcome === 'UNASSESSABLE').length,
    rows,
  };
}

export function buildHoldoutExportBundle(analysisRow, result, coachLabels = [], reviewerName = 'COACH') {
  const defaultView = result?.cameraView?.detected || 'UNKNOWN';
  const { activeLabels } = resolveCoachLabelHistory(coachLabels, defaultView);
  const videoSha256 = result?.inputVideoSha256 || activeLabels[0]?.videoSha256 || '';
  const standardVersion = result?.techniqueEvaluation?.referenceStandardVersion || activeLabels[0]?.standardVersion || 'bodyweight-squat-1.0.0-draft';
  const exerciseVariant = result?.techniqueEvaluation?.exerciseVariant || result?.exerciseVariant || 'BODYWEIGHT';
  const segMap = new Map();
  for (const rep of result?.repetitions || []) {
    const key = `${rep.startSeconds}-${rep.endSeconds}`;
    segMap.set(key, {
      repNumber: rep.number,
      startSeconds: rep.startSeconds,
      bottomSeconds: rep.bottomSeconds,
      endSeconds: rep.endSeconds,
      criteria: {},
    });
  }
  for (const label of activeLabels) {
    let targetSeg = null;
    for (const seg of segMap.values()) {
      if ((label.repNumber != null && seg.repNumber === label.repNumber)
          || Math.abs(seg.startSeconds - label.startSeconds) < 0.25) {
        targetSeg = seg;
        break;
      }
    }
    if (!targetSeg) {
      const key = `${label.startSeconds}-${label.endSeconds}`;
      targetSeg = { repNumber: label.repNumber, startSeconds: label.startSeconds, endSeconds: label.endSeconds, criteria: {} };
      segMap.set(key, targetSeg);
    }
    targetSeg.criteria[label.criterionId] = {
      outcome: label.outcome,
      timestampSeconds: label.timestampSeconds ?? Number(((label.startSeconds + label.endSeconds) / 2).toFixed(3)),
      cameraView: label.cameraView || defaultView,
      reviewerId: label.reviewerId,
      standardVersion: label.standardVersion || standardVersion,
      labeledAt: label.labeledAt,
      revision: label.revision || 1,
      note: label.reviewerNotes,
    };
  }
  const segments = Array.from(segMap.values()).filter(seg => Object.keys(seg.criteria).length > 0);
  const criterionIds = Array.from(new Set(activeLabels.map(l => l.criterionId)));
  return {
    manifestEntry: {
      id: `holdout-analysis-${analysisRow.id}`,
      exercise: analysisRow.exerciseType,
      exerciseVariant,
      path: `holdout/analysis-${analysisRow.id}.mp4`,
      // The uploader may not be the filmed subject. A Coach must verify
      // provenance and split independence before this enters validation.
      sourceType: 'UNVERIFIED',
      split: 'UNASSIGNED',
      subjectId: null,
      sessionId: null,
      sha256: videoSha256,
      coachLabels: `holdout/analysis-${analysisRow.id}.labels.json`,
      resultPath: `holdout/analysis-${analysisRow.id}.inference.json`,
      referenceStandardVersion: standardVersion,
      criterionIds,
    },
    coachLabelsDocument: {
      schemaVersion: 2,
      exercise: analysisRow.exerciseType,
      exerciseVariant,
      sourceType: 'UNVERIFIED',
      videoSha256,
      durationSeconds: result?.video?.durationSeconds ?? null,
      coachConfirmed: false,
      reviewer: reviewerName,
      rubricVersion: standardVersion,
      approvedConditions: '',
      reviewedAt: null,
      cameraView: activeLabels[0]?.cameraView || defaultView,
      expectedStatus: segments.length > 0 ? 'ANALYZABLE' : 'INSUFFICIENT_DATA',
      segments,
    },
    exportStatus: 'DRAFT_REQUIRES_COACH_CONFIRMATION_AND_SPLIT_REVIEW',
  };
}
