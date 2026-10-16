import { request } from './client';
import { ApiCoachProfile, Pagination } from './types';

export const adminTrainerApi = {
  async getCalendar() {
    const res = await request<{ success: boolean; data: {
      calendar: { openTime: string; closeTime: string; slotMinutes: number; breakMinutes: number };
      slots: Array<{ startTime: string; endTime: string; startMinute: number; endMinute: number }>;
      closures: Array<{ id: number; startAt: string; endAt: string; kind: string; reason: string }>;
    } }>('/admin-trainers/calendar');
    return res.data;
  },
  async saveCalendar(calendar: { openTime: string; closeTime: string; slotMinutes: number; breakMinutes: number }) {
    return request<{ success: boolean }>('/admin-trainers/calendar', { method: 'PUT', body: JSON.stringify(calendar) });
  },
  async addClosure(value: { startAt: string; endAt: string; kind: string; reason: string }) {
    return request<{ success: boolean }>('/admin-trainers/calendar/closures', { method: 'POST', body: JSON.stringify(value) });
  },
  async removeClosure(id: number) {
    return request<{ success: boolean }>(`/admin-trainers/calendar/closures/${id}`, { method: 'DELETE' });
  },
  async getCalendarCoaches(date: string) {
    const res = await request<{ success: boolean; data: Array<{ coachId: number; coachName: string; coachStatus: string;
      bookings: Array<{ id: number; startTime: string; endTime: string; memberName: string }>;
      slots: Array<{
      startTime: string; endTime: string; booking: { id: number; member: { fullName: string } } | null;
    }> }> }>(`/admin-trainers/calendar/coaches?date=${date}`);
    return res.data;
  },
  async getCalendarAudit() {
    const res = await request<{ success: boolean; data: Array<{ id: number; action: string; details: string; createdAt: string; user: { fullName: string } }> }>('/admin-trainers/calendar/audit');
    return res.data;
  },
  async getCalendarChangeRequests() {
    const res = await request<{ success: boolean; data: Array<{ id: number; coachId: number; coachName?: string; memberName?: string; startTime?: string; bookingId: number; reason: string; status: string; createdAt: string }> }>('/admin-trainers/calendar/change-requests');
    return res.data;
  },
  async resolveCalendarChangeRequest(id: number, decision: 'APPROVED' | 'REJECTED', adminNote: string) {
    return request<{ success: boolean }>(`/admin-trainers/calendar/change-requests/${id}`, { method: 'PATCH', body: JSON.stringify({ decision, adminNote }) });
  },
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
