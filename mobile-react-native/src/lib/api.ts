import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { asRecord, dayKey, list } from './theme';

const configuredUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
export const API_URL = (configuredUrl || (Platform.OS === 'android' ? 'http://10.0.2.2:5000/api' : 'http://localhost:5000/api')).replace(/\/$/, '');
export const SOCKET_URL = API_URL.replace(/\/api$/, '');
const TOKEN_KEY = 'aura_access_token';
const USER_KEY = 'aura_user';

export type User = { id: number; fullName: string; email: string; role: string; phone?: string | null; balance?: number };
export type Session = { token: string; user: User };

let accessToken: string | null = null;
export const sessionStore = {
  async restore(): Promise<Session | null> {
    const [token, rawUser] = await Promise.all([SecureStore.getItemAsync(TOKEN_KEY), SecureStore.getItemAsync(USER_KEY)]);
    if (!token || !rawUser) return null;
    try {
      const user = JSON.parse(rawUser) as User;
      accessToken = token;
      return { token, user };
    } catch { return null; }
  },
  async save(session: Session) {
    accessToken = session.token;
    await Promise.all([SecureStore.setItemAsync(TOKEN_KEY, session.token), SecureStore.setItemAsync(USER_KEY, JSON.stringify(session.user))]);
  },
  async clear() {
    accessToken = null;
    await Promise.all([SecureStore.deleteItemAsync(TOKEN_KEY), SecureStore.deleteItemAsync(USER_KEY)]);
  },
  token: () => accessToken,
};

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
export async function request<T = any>(method: Method, path: string, body?: unknown, allowUnsuccessful = false): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers: { Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    throw new Error(`Không kết nối được máy chủ ${API_URL}. Điện thoại thật cần EXPO_PUBLIC_API_BASE_URL là IP LAN của máy tính.`);
  }
  const raw = await response.text();
  let json: any;
  try { json = raw ? JSON.parse(raw) : {}; } catch { json = {}; }
  if (!response.ok || (!allowUnsuccessful && json.success === false)) throw new Error(json.message || `Máy chủ báo lỗi ${response.status}`);
  return json as T;
}
const get = <T = any>(path: string) => request<T>('GET', path);
const post = <T = any>(path: string, body: unknown = {}) => request<T>('POST', path, body);

export const api = {
  coachAvailability: async () => (await get('/pt/coach/availability')).data as {
    calendar: { openTime: string; closeTime: string; slotMinutes: number; breakMinutes: number };
    slots: { startTime: string; endTime: string; startMinute: number; endMinute: number }[];
    schedules: { dayOfWeek: number; startTime: string; endTime: string; isAvailable: boolean }[];
    dates: { date: string; shifts: { startTime: string; endTime: string }[] }[];
    closures: { id: number; startAt: string; endAt: string; reason: string }[];
    bookings: { id: number; startTime: string; endTime: string; status: string }[];
  },
  saveCoachWeekly: (schedules: { dayOfWeek: number; startTime: string; endTime: string }[]) => request('PUT', '/pt/coach/availability', { schedules }),
  saveCoachDates: (dates: { date: string; shifts: { startTime: string; endTime: string }[] }[]) => request('PUT', '/pt/coach/availability/dates', { dates }),
  resetCoachDate: (date: string) => request('DELETE', `/pt/coach/availability/dates/${date}`),
  coachChangeRequests: async () => (await get('/pt/coach/availability/change-requests')).data as { id: number; bookingId: number; status: string; reason: string }[],
  coachSlots: async (coachId: number, date: string) => (await get(`/pt/trainers/${coachId}/slots?date=${date}`)).slots as { startTime: string; endTime: string; status: string }[],
  removeCoachSlot: (date: string, startTime: string) => request('DELETE', `/pt/coach/availability/slots?date=${date}&startTime=${encodeURIComponent(startTime)}`),
  async login(email: string, password: string): Promise<Session> {
    const result = await post('/auth/login', { email: email.trim().toLowerCase(), password });
    const data = asRecord(result.data);
    if (!data.accessToken || !data.user) throw new Error('Máy chủ chưa trả về phiên đăng nhập.');
    return { token: data.accessToken, user: data.user as User };
  },
  async register(fullName: string, email: string, password: string, phone: string): Promise<Session> {
    await post('/auth/register', { fullName: fullName.trim(), email: email.trim().toLowerCase(), password, phone: phone.trim() });
    return api.login(email, password);
  },
  async googleLogin(idToken: string): Promise<Session> {
    const result = await post('/auth/google', { idToken });
    const data = asRecord(result.data);
    return { token: data.accessToken, user: data.user as User };
  },
  forgotPassword: (email: string) => post('/auth/forgot-password', { email: email.trim().toLowerCase() }),
  resetPassword: (resetToken: string, newPassword: string) => post('/auth/reset-password', { resetToken: resetToken.trim(), newPassword }),
  changePassword: (oldPassword: string, newPassword: string) => post('/auth/change-password', { oldPassword, newPassword }),
  packages: async (type?: string) => list<any>((await get(`/packages${type ? `?type=${encodeURIComponent(type)}` : ''}`)).data),
  subscriptions: async () => list<any>((await get('/subscriptions/my-subscriptions')).data),
  coaches: async () => list<any>((await get('/pt/trainers')).data),
  buyPt: (ptPackageId: number, trainerId: number) => post('/pt/buy', { ptPackageId, trainerId }),
  checkout: (packageId: number) => post('/payments/checkout', { packageId }),
  renew: (subscriptionId: number, packageId: number) => post('/subscriptions/renew', { subscriptionId, packageId }),
  paymentStatus: (orderCode: string) => request('GET', `/payments/check-status/${encodeURIComponent(orderCode)}`, undefined, true),
  classSchedules: async (date: Date) => list<any>((await get(`/group-classes/schedules?date=${dayKey(date)}`)).data),
  classBookings: async (date: Date) => {
    const from = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const to = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
    const query = `fromDate=${encodeURIComponent(from.toISOString())}&toDate=${encodeURIComponent(to.toISOString())}&type=GROUP`;
    return list<any>((await get(`/member/my-schedule?${query}`)).data).filter(row => row.bookingType === 'GROUP_CLASS');
  },
  bookClass: (scheduleId: number) => post('/group-classes/book', { scheduleId }),
  cancelClass: (bookingId: number) => post(`/group-classes/cancel/${bookingId}`),
  checkInClass: (bookingId: number, qrToken: string) => post(`/group-classes/check-in/${bookingId}`, { qrToken }),
  ptBookings: async () => list<any>((await get('/pt/my-bookings')).data),
  ptTrainers: async () => list<any>((await get('/pt/trainers')).data),
  ptSlots: async (trainerId: number, date: Date) => list<any>((await get(`/pt/trainers/${trainerId}/slots?date=${dayKey(date)}`)).slots),
  bookPt: (ptSubscriptionId: number, bookingDate: string, coachId?: number) => post('/pt/booking', { ptSubscriptionId, bookingDate, coachId }),
  bookPtBatch: (ptSubscriptionId: number, bookingDates: string[], coachId?: number) => post('/pt/booking/batch', { ptSubscriptionId, bookingDates, coachId }),
  makeupPt: (originalBookingId: number, newBookingDate: string) => post('/pt/booking/schedule-makeup', { originalBookingId, newBookingDate }),
  absentPt: (bookingId: number, reason: string) => post(`/pt/booking/${bookingId}/mark-absent`, { reason }),
  ptQr: (bookingId: number) => post(`/pt/booking/${bookingId}/generate-session-qr`),
  startPt: (qrToken: string) => post('/pt/booking/start-session', { qrToken }),
  completePt: (bookingId: number) => post(`/pt/booking/${bookingId}/complete-session`),
  chat: (bookingId: number, query = '') => get(`/pt/booking/${bookingId}/messages${query}`),
  sendChat: (bookingId: number, content: string) => post(`/pt/booking/${bookingId}/messages`, { content }),
  gymQr: () => get('/checkin/generate-qr'),
  checkInHistory: (page = 1) => get(`/checkin/history?page=${page}&limit=10`),
  notifications: (page = 1) => get(`/notifications?page=${page}&limit=20`),
  unreadNotifications: () => get('/notifications/unread-count'),
  readNotification: (id: number) => request('PATCH', `/notifications/${id}/read`),
  readAllNotifications: () => request('PATCH', '/notifications/read-all'),
  progress: (memberId: number) => get(`/workouts/progress/${memberId}`),
};
