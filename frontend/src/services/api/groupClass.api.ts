import { request } from './client';
import { ApiGroupClass, ApiGroupClassBooking, ApiGroupClassSchedule } from './types';

export const groupClassApi = {
  async getSchedules(date?: string) {
    const q = date ? `?date=${date}` : '';
    const res = await request<{ success: boolean; data: ApiGroupClassSchedule[] }>(
      `/group-classes/schedules${q}`
    );
    return res.data;
  },

  async getAllSchedules() {
    const res = await request<{ success: boolean; data: ApiGroupClassSchedule[] }>(
      '/group-classes/schedules?all=true'
    );
    return res.data;
  },

  async book(scheduleId: number) {
    return request<{
      success: boolean;
      message: string;
      data: { booking: ApiGroupClassBooking; updatedSchedule: ApiGroupClassSchedule };
    }>('/group-classes/book', {
      method: 'POST',
      body: JSON.stringify({ scheduleId })
    });
  },

  async cancel(bookingId: number) {
    return request<{
      success: boolean;
      message: string;
      data: any;
    }>(`/group-classes/cancel/${bookingId}`, {
      method: 'POST'
    });
  },

  async checkIn(bookingId: number, qrToken: string) {
    return request<{
      success: boolean;
      message: string;
      data: ApiGroupClassBooking;
    }>(`/group-classes/check-in/${bookingId}`, {
      method: 'POST',
      body: JSON.stringify({ qrToken })
    });
  },

  async getCheckInQr(scheduleId: number) {
    const res = await request<{
      success: boolean;
      data: { token: string; qrCodeImage: string; expiresInSeconds: number };
    }>(`/group-classes/schedules/${scheduleId}/check-in-qr`);
    return res.data;
  },

  async getAttendees(scheduleId: number) {
    const res = await request<{
      success: boolean;
      data: Array<{ id: number; status: 'BOOKED' | 'CHECKED_IN'; user: { id: number; fullName: string } }>;
    }>(`/group-classes/schedules/${scheduleId}/attendees`);
    return res.data;
  },

  async createClass(payload: {
    name: string;
    description?: string;
    imageUrl?: string;
    durationMin?: number;
  }) {
    return request<{
      success: boolean;
      message: string;
      data: ApiGroupClass;
    }>('/group-classes', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async createSchedule(payload: {
    classId: number;
    trainerId: number;
    roomId?: number;
    startTime: string;
    endTime: string;
    capacity?: number;
  }) {
    return request<{
      success: boolean;
      message: string;
      data: ApiGroupClassSchedule;
    }>('/group-classes/schedules', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }
};
