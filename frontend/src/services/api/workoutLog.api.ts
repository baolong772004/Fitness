import { request } from './client';
import type { CoachWorkoutPlan } from './pt.api';
import { ApiProgressLog, ApiSessionResult } from './types';

export interface PtTrainingAssessment {
  id: number;
  memberId: number;
  coachId: number;
  level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
  kind: 'BASELINE' | 'REVIEW';
  goal: string | null;
  movementNotes: string | null;
  metricName: string | null;
  metricValue: number | null;
  phaseName: string | null;
  nextSteps: string;
  createdAt: string;
  coach?: { fullName: string };
}

export const workoutLogApi = {
  async createPtAssessment(payload: {
    memberId: number;
    level: PtTrainingAssessment['level'];
    kind: PtTrainingAssessment['kind'];
    goal?: string;
    movementNotes?: string;
    metricName?: string;
    metricValue?: number;
    phaseName?: string;
    nextSteps: string;
  }) {
    return request<{ success: boolean; data: PtTrainingAssessment }>('/workouts/pt-assessments', {
      method: 'POST', body: JSON.stringify(payload),
    });
  },
  async logSessionResult(payload: {
    bookingId: number;
    notes?: string;
    calories?: number;
    durationMin?: number;
    exercises?: Array<{
      exerciseName: string;
      sets: number;
      reps: number;
      weightKg?: number;
    }>;
  }) {
    return request<{
      success: boolean;
      message: string;
      data: ApiSessionResult;
    }>('/workouts/log-session', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async logInBody(payload: {
    memberId: number;
    weight: number;
    bodyFat?: number;
    muscleMass?: number;
  }) {
    return request<{
      success: boolean;
      message: string;
      data: ApiProgressLog;
    }>('/workouts/inbody', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async getMemberProgress(memberId: number | string) {
    const res = await request<{
      success: boolean;
      data: {
        inbodyLogs: ApiProgressLog[];
        workoutLogs: any[];
        plans: Array<Omit<CoachWorkoutPlan, 'member'> & { coach: { fullName: string } }>;
        assessments: PtTrainingAssessment[];
        trainingPolicy: Record<PtTrainingAssessment['level'], { reviewEverySessions: number }>;
      };
    }>(`/workouts/progress/${memberId}`);
    return res.data;
  }
};
