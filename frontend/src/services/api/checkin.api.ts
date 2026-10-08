import { request } from './client';
import { ApiCheckIn, Pagination } from './types';

export const checkinApi = {
  async checkIn(checkinToken?: string) {
    return request<{
      message: string;
      data: {
        checkInId: number;
        fullName: string;
        packageName: string;
        remainingDays: number;
        remainingSessions: number | string;
      };
    }>('/checkin', {
      method: 'POST',
      body: JSON.stringify({ checkinToken })
    });
  },

  async generateQR() {
    const res = await request<{
      message: string;
      data: {
        token: string;
        qrCodeImage: string;
      };
    }>('/checkin/generate-qr');
    return res.data;
  },

  async getHistory(params: { page?: number; limit?: number } = {}) {
    const q = new URLSearchParams();
    if (params.page) q.set('page', String(params.page));
    if (params.limit) q.set('limit', String(params.limit));

    return request<{
      success: boolean;
      data: ApiCheckIn[];
      pagination: Pagination;
    }>(`/checkin/history?${q.toString()}`);
  }
};
