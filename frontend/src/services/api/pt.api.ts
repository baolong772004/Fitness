import { request } from './client';
import { ApiBooking, ApiCoachProfile, ApiCoachSchedule, ApiCoachTrainee, ApiSubscription } from './types';

export interface CoachTraineeMembership {
  id: number;
  userId: number;
  startDate: string;
  endDate: string;
  remainingSessions: number | null;
  status: string;
  package: { name: string; totalPtSessions: number | null };
  user: {
    id: number;
    fullName: string;
    phone: string | null;
    email: string;
    avatar: string | null;
    gender: string | null;
    dateOfBirth: string | null;
    height: number | null;
    weight: number | null;
  };
}

export interface CoachWorkoutPlan {
  id: number;
  memberId: number | null;
  title: string;
  description: string | null;
  sessions: CoachPlanSession[];
  mealDays: CoachMealDay[];
  createdAt: string;
  member: { id: number; fullName: string } | null;
}

export interface CoachPlanExercise {
  exerciseName: string;
  sets: number;
  reps: number;
  weightKg: number | null;
  notes: string;
}

export interface CoachPlanSession {
  dayOfWeek: number;
  title: string;
  notes: string;
  exercises: CoachPlanExercise[];
}

export interface CoachPlanMeal {
  mealType: 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK';
  time: string;
  food: string;
  portion: string;
  calories: number | null;
  notes: string;
}

export interface CoachMealDay {
  dayOfWeek: number;
  notes: string;
  meals: CoachPlanMeal[];
}

export interface CoachPlanDraft {
  memberId?: number | null;
  title: string;
  description: string;
  sessions: CoachPlanSession[];
  mealDays: CoachMealDay[];
}

export type GeneratedCoachPlan = Omit<CoachPlanDraft, 'memberId'>;

export const ptApi = {
  async getCoachAvailability() {
    const res = await request<{ success: boolean; data: {
      calendar: { openTime: string; closeTime: string; slotMinutes: number; breakMinutes: number };
      slots: Array<{ startTime: string; endTime: string; startMinute: number; endMinute: number }>;
      closures: Array<{ id: number; startAt: string; endAt: string; kind: string; reason: string }>;
      bookings: Array<{ id: number; startTime: string; endTime: string; status: string }>;
      schedules: ApiCoachSchedule[];
      dates: Array<{ date: string; shifts: Array<{ startTime: string; endTime: string }> }>;
    } }>('/pt/coach/availability');
    return res.data;
  },
  async saveCoachDates(dates: Array<{ date: string; shifts: Array<{ startTime: string; endTime: string }> }>) {
    return request<{ success: boolean; message: string }>('/pt/coach/availability/dates', {
      method: 'PUT', body: JSON.stringify({ dates }),
    });
  },
  async resetCoachDate(date: string) {
    return request<{ success: boolean; message: string }>(`/pt/coach/availability/dates/${date}`, { method: 'DELETE' });
  },
  async removeCoachSlot(date: string, startTime: string) {
    return request<{ success: boolean; message: string }>(`/pt/coach/availability/slots?date=${date}&startTime=${encodeURIComponent(startTime)}`, { method: 'DELETE' });
  },
  async getCoachChangeRequests() {
    const res = await request<{ success: boolean; data: Array<{ id: number; bookingId: number; reason: string; status: string; createdAt: string }> }>('/pt/coach/availability/change-requests');
    return res.data;
  },
  async getCoachWorkspace() {
    const res = await request<{ success: boolean; data: ApiCoachProfile & { schedules: ApiCoachSchedule[] } }>('/pt/coach/me');
    return res.data;
  },

  async getCoachTrainees() {
    const res = await request<{ success: boolean; data: CoachTraineeMembership[] }>('/pt/coach/trainees');
    return res.data;
  },

  async updateCoachAvailability(schedules: Array<{ dayOfWeek: number; startTime: string; endTime: string; isAvailable: boolean }>) {
    return request<{ success: boolean; message: string; data: ApiCoachSchedule[] }>('/pt/coach/availability', {
      method: 'PUT',
      body: JSON.stringify({ schedules })
    });
  },

  async getCoachPlans() {
    const res = await request<{ success: boolean; data: CoachWorkoutPlan[] }>('/pt/coach/plans');
    return res.data;
  },

  async createCoachPlan(payload: CoachPlanDraft) {
    return request<{ success: boolean; message: string; data: CoachWorkoutPlan }>('/pt/coach/plans', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async generateCoachPlan(memberId: number | null, aiRequest: string) {
    const res = await request<{ success: boolean; data: GeneratedCoachPlan }>('/pt/coach/plans/generate', {
      method: 'POST',
      body: JSON.stringify({ ...(memberId ? { memberId } : {}), request: aiRequest })
    });
    return res.data;
  },
  async getAvailableTrainers() {
    return request<{
      success: boolean;
      data: Array<{
        id: number;
        userId: number;
        bio?: string;
        specialization?: string;
        rating?: number;
        hourlyRate: number;
        fullName: string;
        email: string;
        phone?: string | null;
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

  async updateBookingStatus(id: number | string, status: 'CONFIRMED' | 'REJECTED') {
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

  async getMyTrainees() {
    const res = await request<{ success: boolean; data: ApiCoachTrainee[] }>('/pt/my-trainees');
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

  async getBookingMessages(bookingId: number | string) {
    return request<{
      success: boolean;
      data: Array<{ id: number; senderId: number; content: string; createdAt: string; sender: { fullName: string } }>;
      canSend: boolean;
      hasMore: boolean;
    }>(`/pt/booking/${bookingId}/messages`);
  },

  async sendBookingMessage(bookingId: number | string, content: string) {
    return request<{ success: boolean; data: { id: number } }>(`/pt/booking/${bookingId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content })
    });
  },

  async resolveNoShow(bookingId: number | string, resolution: 'ATTENDED' | 'EXCUSED', reason: string) {
    return request<{ success: boolean; message: string; data: ApiBooking }>(
      `/pt/booking/${bookingId}/resolve-no-show`, {
      method: 'POST',
      body: JSON.stringify({ resolution, reason })
    }
    );
  },

  async manualCheckIn(bookingId: number | string, reason: string) {
    return request<{ success: boolean; data: { bookingId: number; status: string } }>(
      `/pt/booking/${bookingId}/manual-check-in`, {
        method: 'POST', body: JSON.stringify({ reason })
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
