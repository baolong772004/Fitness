import { request } from './client';
import { ApiCoachProfile, Pagination } from './types';

export const adminTrainerApi = {
  async getPtProducts() {
    const res = await request<{ success: boolean; data: Array<{ id: number; name: string; level: string; sessionCount: number; durationDays: number | null; price: number; singleSessionPrice: number | null; benefits: string | null; isActive: boolean }> }>('/pt/products/manage');
    return res.data;
  },
  async createPtProduct(data: { name: string; level: string; sessionCount: number; durationDays: number; price: number; singleSessionPrice: number | null; benefits: string }) {
    return request('/pt/products', { method: 'POST', body: JSON.stringify(data) });
  },
  async updatePtProduct(id: number, data: { name: string; level: string; sessionCount: number; durationDays: number; price: number; singleSessionPrice: number | null; benefits: string }) {
    return request(`/pt/products/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  async archivePtProduct(id: number) {
    return request(`/pt/products/${id}`, { method: 'DELETE' });
  },
  async restorePtProduct(id: number) {
    return request(`/pt/products/${id}/restore`, { method: 'PATCH' });
  },
  async getPtSingleOffers() {
    const res = await request<{ success: boolean; data: Array<{ id: number; level: string; price: number; durationDays: number; maxQuantity: number; benefits: string | null; isActive: boolean }> }>('/pt/single-offers/all');
    return res.data;
  },
  async savePtSingleOffer(level: string, data: { price: number; durationDays: number; maxQuantity: number; benefits: string }) {
    return request(`/pt/single-offers/${level}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  async setPtSingleOfferActive(level: string, isActive: boolean) {
    return request(`/pt/single-offers/${level}/active`, { method: 'PATCH', body: JSON.stringify({ isActive }) });
  },
  async getPendingPtCoachChanges() {
    const res = await request<{ success: boolean; data: Array<{ id: number; batchId: number; memberId: number; memberName: string; oldCoachId: number; oldCoachName: string; newCoachId: number; newCoachName: string; reason: string; requestedAt: string; batch: { level: string; source: string } }> }>('/pt/coach-change-requests/pending');
    return res.data;
  },
  async resolvePtCoachChange(id: number, decision: 'APPROVED' | 'REJECTED', adminNote: string) {
    return request(`/pt/coach-change-requests/${id}`, { method: 'PATCH', body: JSON.stringify({ decision, adminNote }) });
  },
  async getPtRenewalOptions() {
    const res = await request<{ success: boolean; data: Array<{ id: number; name: string; level: string; durationDays: number; price: number; isActive: boolean; ptProductId: number | null; purchaseMode: string | null }> }>('/pt/renewal-options/manage');
    return res.data;
  },
  async createPtRenewalOption(data: { productId?: number; level?: string; purchaseMode: 'PACKAGE' | 'SINGLE' | null; durationDays: number; price: number }) {
    return request('/pt/renewal-options', { method: 'POST', body: JSON.stringify(data) });
  },
  async updatePtRenewalOption(id: number, data: { productId?: number; level?: string; purchaseMode: 'PACKAGE' | 'SINGLE' | null; durationDays: number; price: number }) {
    return request(`/pt/renewal-options/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  async archivePtRenewalOption(id: number) {
    return request(`/pt/renewal-options/${id}`, { method: 'DELETE' });
  },
  async restorePtRenewalOption(id: number) {
    return request(`/pt/renewal-options/${id}/restore`, { method: 'PATCH' });
  },
  async setPtSpecializations(coachId: number, levels: string[]) {
    return request(`/pt/trainers/${coachId}/specializations`, { method: 'PUT', body: JSON.stringify({ levels }) });
  },
  async getPtWallet(memberId: number) {
    const res = await request<{ success: boolean; data: { summary: { total: number; available: number; held: number; used: number; expired: number; levels: Array<{ level: string; available: number; held: number; used: number; expired: number }>; sources: Array<{ id: number; level: string; source: string; quantity: number; remainingSessions: number; availableSessions: number; startAt: string | null; endAt: string | null; activatedAt: string | null; status: string; renewable: boolean; renewalDeadline: string | null }> }; batches: unknown[]; transactions: unknown[]; renewals: Array<{ id: number; batchId: number; durationDays: number; previousEndAt: string; startAt: string; endAt: string; payment: { amount: number; paidAt: string } }> } }>(`/pt/admin/wallets/${memberId}`);
    return res.data;
  },
  async adjustPtWallet(memberId: number, value: { level: string; delta: number; reason: string }) {
    return request(`/pt/admin/wallets/${memberId}/adjust`, { method: 'POST', body: JSON.stringify(value) });
  },
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

  async updateTrainerPricing(id: number | string, payload: {
    hourlyRate: number;
    commissionPercent: number;
    rank: 'junior' | 'senior' | 'master';
    levels?: string[];
  }) {
    return request<{ success: boolean; message: string; data: ApiCoachProfile }>(
      `/admin-trainers/${id}/pricing`,
      { method: 'PATCH', body: JSON.stringify(payload) }
    );
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
