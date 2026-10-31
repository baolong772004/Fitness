const decisive = new Set(['MEETS_CRITERION', 'NEEDS_IMPROVEMENT']);

export function summarizeSquatSession(rows) {
  const clips = rows.map(row => {
    const result = row.resultJson ? JSON.parse(row.resultJson) : {};
    return { analysisId: row.id, status: row.status, videoOrigin: row.videoOrigin,
      captureMethodDeclared: row.captureMethodDeclared, performerDeclaration: row.performerDeclaration,
      performerIdentityVerified: false, cameraViewRequested: result.cameraView?.requested || result.requestOptions?.cameraView,
      cameraViewDetected: result.cameraView?.detected || null,
      modelVersion: result.modelVersion || row.modelVersion, ruleVersion: result.ruleVersion || row.ruleVersion,
      standardVersion: result.referenceStandardVersion || null, detectedRepetitions: result.detectedRepetitions ?? null,
      result };
  });
  const views = clips.map(clip => clip.cameraViewDetected).sort();
  const completed = clips.every(clip => ['COMPLETED', 'INSUFFICIENT_DATA', 'NEEDS_REVIEW'].includes(clip.status));
  const matchingVersions = clips.length === 2 && clips[0].modelVersion === clips[1].modelVersion &&
    clips[0].ruleVersion === clips[1].ruleVersion && clips[0].standardVersion === clips[1].standardVersion;
  const status = !completed ? 'PROCESSING' : views.join(',') !== 'FRONT,SIDE' ? 'VIEW_MISMATCH'
    : !matchingVersions ? 'VERSION_MISMATCH' : 'READY_FOR_PER_CLIP_REVIEW';
  const byCriterion = new Map();
  for (const clip of clips) {
    const provisional = clip.result.provisionalEvaluation || clip.result.experimentalEvaluation;
    const official = new Map((clip.result.techniqueEvaluation?.criteria || []).map(item => [item.criterionId, item]));
    for (const item of provisional?.criteria || []) {
      const entry = byCriterion.get(item.criterionId) || { criterionId: item.criterionId, title: item.title,
        evidenceClips: [], measuredMeets: [], measuredNeedsImprovement: [], unable: [] };
      const evidence = { analysisId: clip.analysisId, cameraView: clip.cameraViewDetected,
        status: item.status, officialStatus: official.get(item.criterionId)?.status || 'UNABLE_TO_ASSESS',
        reasonCode: item.reasonCode || null,
        predictions: (item.predictions || []).map(row => ({ repNumber: row.repNumber,
          timestampSeconds: row.timestampSeconds, status: row.status, observedValue: row.observedValue,
          units: row.units, threshold: row.threshold, bodyPart: row.bodyPart, feedback: row.feedback,
          evidenceFrames: row.landmarkEvidence?.length || 0 })) };
      entry.evidenceClips.push(evidence);
      if (!decisive.has(item.status) && !evidence.predictions.some(row => decisive.has(row.status))) {
        entry.unable.push({ ...evidence, criterionId: item.criterionId, title: item.title });
      }
      for (const prediction of evidence.predictions) {
        if (prediction.status === 'MEETS_CRITERION') entry.measuredMeets.push({ ...prediction, criterionId: item.criterionId, title: item.title, analysisId: clip.analysisId, cameraView: clip.cameraViewDetected });
        else if (prediction.status === 'NEEDS_IMPROVEMENT') entry.measuredNeedsImprovement.push({ ...prediction, criterionId: item.criterionId, title: item.title, analysisId: clip.analysisId, cameraView: clip.cameraViewDetected });
      }
      byCriterion.set(item.criterionId, entry);
    }
  }
  return { status, wholeExerciseStatus: 'UNABLE_TO_CONFIRM', samePersonSessionConfirmed: true,
    performerIdentityVerified: false, repSynchronization: 'NONE', officialVerdictsRequireApproval: true,
    clips: clips.map(({ result, ...clip }) => clip), criteria: [...byCriterion.values()],
    measuredMeets: [...byCriterion.values()].flatMap(item => item.measuredMeets),
    measuredNeedsImprovement: [...byCriterion.values()].flatMap(item => item.measuredNeedsImprovement),
    unable: [...byCriterion.values()].flatMap(item => item.unable) };
}
