import type { AnalysisResult } from './exerciseAnalysis';

// The Backend is the only place that combines evidence and decides a verdict.
// Legacy source payloads never become a separate Mobile assessment.
export function buildSquatRepFeedback(result: AnalysisResult) {
  return result.assessment?.version === 'squat-assessment-fusion-1' ? result.assessment.reps : [];
}
