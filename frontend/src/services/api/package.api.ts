import { request } from './client';
import { ApiPackage } from './types';

export const packageApi = {
  async getPackages(params: { type?: 'MEMBERSHIP' | 'PT'; includeInactive?: boolean } = {}) {
    const q = new URLSearchParams();
    if (params.type) q.set('type', params.type);
    if (params.includeInactive !== undefined) {
      q.set('includeInactive', String(params.includeInactive));
    }
    const res = await request<{ success: boolean; data: ApiPackage[] }>(
      `/packages?${q.toString()}`
    );
    return res.data;
  },

  async getPackageById(id: number | string) {
    const res = await request<{ success: boolean; data: ApiPackage }>(`/packages/${id}`);
    return res.data;
  },

  async createPackage(payload: {
    name: string;
    type: 'MEMBERSHIP' | 'PT';
    description?: string;
    price: number;
    durationDays: number;
    trialPtSessions?: number;
    totalPtSessions?: number;
  }) {
    const res = await request<{
      success: boolean;
      message: string;
      data: ApiPackage;
    }>('/packages', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    return res.data;
  },

  async updatePackage(
    id: number | string,
    payload: Partial<{
      name: string;
      type: 'MEMBERSHIP' | 'PT';
      description: string;
      price: number;
      durationDays: number;
      trialPtSessions: number;
      totalPtSessions: number;
      isActive: boolean;
    }>
  ) {
    const res = await request<{
      success: boolean;
      message: string;
      data: ApiPackage;
    }>(`/packages/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
    return res.data;
  },

  async deletePackage(id: number | string) {
    return request<{ success: boolean; message: string }>(`/packages/${id}`, {
      method: 'DELETE'
    });
  }
};
