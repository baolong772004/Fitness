import { request } from './client';
import { ApiCoachProfile, Pagination } from './types';

export const adminTrainerApi = {
  async getTrainers(params: {
    search?: string;
    specialization?: string;
    status?: string;
    page?: number;
    limit?: number;
  } = {}) {
    const q = new URLSearchParams();
    if (params.search) q.set('search', params.search);
    if (params.specialization) q.set('specialization', params.specialization);
    if (params.status) q.set('status', params.status);
    if (params.page) q.set('page', String(params.page));
    if (params.limit) q.set('limit', String(params.limit));

    return request<{
      success: boolean;
      data: ApiCoachProfile[];
      pagination: Pagination;
    }>(`/admin-trainers?${q.toString()}`);
  },

  async setupTrainer(payload: {
    userId: number;
    bio?: string;
    specialties?: string | string[];
    hourlyRate: number;
    experienceYears?: number;
    workingSchedules?: Array<{
      dayOfWeek: number;
      startTime: string;
      endTime: string;
      isAvailable?: boolean;
    }>;
  }) {
    return request<{
      success: boolean;
      message: string;
      data: ApiCoachProfile;
    }>('/admin-trainers/setup', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async toggleTrainerStatus(id: number | string, status: 'ACTIVE' | 'INACTIVE' | 'BLOCKED') {
    return request<{
      success: boolean;
      message: string;
      data: ApiCoachProfile;
    }>(`/admin-trainers/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
  }
};
