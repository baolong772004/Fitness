import { request } from './client';
import { ApiProgressLog, ApiSessionResult } from './types';

export const workoutLogApi = {
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
      };
    }>(`/workouts/progress/${memberId}`);
    return res.data;
  }
};
