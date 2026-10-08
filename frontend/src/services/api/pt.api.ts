import { request } from './client';
import { ApiBooking, ApiSubscription } from './types';

export const ptApi = {
  async getAvailableTrainers() {
    return request<{
      success: boolean;
      data: Array<{
        userId: number;
        bio?: string;
        specialization?: string;
        rating?: number;
        hourlyRate: number;
        fullName: string;
        avatar?: string;
      }>;
    }>('/pt/trainers');
  },

  async buyPtPackage(payload: { ptPackageId: number; trainerId: number }) {
    return request<{
      success: boolean;
      message: string;
      data: ApiSubscription;
    }>('/pt/buy', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async getTrainerSlots(trainerId: number | string, date: string) {
    return request<{
      success: boolean;
      date: string;
      trainerId: number;
      slots: Array<{
        startTime: string;
        endTime: string;
        status: 'AVAILABLE' | 'BOOKED' | 'EXPIRED' | string;
        isAvailable: boolean;
      }>;
    }>(`/pt/trainers/${trainerId}/slots?date=${date}`);
  },

  async createBooking(payload: { ptSubscriptionId: number; bookingDate: string; note?: string }) {
    return request<{
      success: boolean;
      message: string;
      data: ApiBooking;
    }>('/pt/booking', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async updateBookingStatus(id: number | string, status: 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | string) {
    return request<{
      success: boolean;
      message: string;
      data: any;
    }>(`/pt/booking/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
  },

  async getMyBookings() {
    const res = await request<{ success: boolean; data: ApiBooking[] }>('/pt/my-bookings');
    return res.data;
  },

  async generateSessionQr(bookingId: number | string) {
    return request<{
      success: boolean;
      message: string;
      data: { token: string; qrCodeImage: string };
    }>(`/pt/booking/${bookingId}/generate-session-qr`, {
      method: 'POST'
    });
  },

  async startSessionWithQr(qrToken: string) {
    return request<{
      success: boolean;
      message: string;
      data: ApiBooking;
    }>('/pt/booking/start-session', {
      method: 'POST',
      body: JSON.stringify({ qrToken })
    });
  },

  async completeSession(bookingId: number | string) {
    return request<{
      success: boolean;
      message: string;
      data: any;
    }>(`/pt/booking/${bookingId}/complete-session`, {
      method: 'POST'
    });
  },

  async markAbsent(bookingId: number | string, reason?: string) {
    return request<{
      success: boolean;
      message: string;
      data: ApiBooking;
    }>(`/pt/booking/${bookingId}/mark-absent`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
  },

  async scheduleMakeup(payload: { originalBookingId: number; newBookingDate: string }) {
    return request<{
      success: boolean;
      message: string;
      data: ApiBooking;
    }>('/pt/booking/schedule-makeup', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }
};
