import { request } from './client';

export interface MemberScheduleEvent {
  id: number;
  scheduleId?: number;
  bookingType: 'PERSONAL_TRAINING' | 'GROUP_CLASS';
  title: string;
  startTime: string;
  endTime: string;
  status: string;
  trainerName?: string;
  trainerAvatar?: string;
  location?: string;
  canCancel?: boolean;
}

export const memberApi = {
  async getMySchedule(params?: { fromDate?: string; toDate?: string; type?: 'ALL' | 'PT' | 'GROUP' }) {
    const q = new URLSearchParams();
    if (params?.fromDate) q.set('fromDate', params.fromDate);
    if (params?.toDate) q.set('toDate', params.toDate);
    if (params?.type) q.set('type', params.type);

    const res = await request<{
      success: boolean;
      data: MemberScheduleEvent[];
    }>(`/member/my-schedule?${q.toString()}`);
    return res.data;
  },

  async getBookingDetail(type: 'PT' | 'GROUP', id: number | string) {
    const res = await request<{ success: boolean; data: any }>(`/member/booking-detail/${type}/${id}`);
    return res.data;
  }
};
