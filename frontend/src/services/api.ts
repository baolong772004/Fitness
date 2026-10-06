/**
 * AURA FITNESS - API Client Service
 * Connects Frontend directly to Backend Express REST API (Port 5000)
 * Eliminates mock data dependency for all live endpoints.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

// Auth Tokens Storage Keys
export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'aura_access_token',
  REFRESH_TOKEN: 'aura_refresh_token',
  CURRENT_USER: 'aura_current_user',
  THEME: 'aura_theme'
};

// Types corresponding to Backend Models
export interface ApiUser {
  id: number;
  email: string;
  fullName: string;
  phone?: string | null;
  avatar?: string | null;
  gender?: string | null;
  dateOfBirth?: string | null;
  height?: number | null;
  weight?: number | null;
  role: 'ADMIN' | 'STAFF' | 'RECEPTIONIST' | 'COACH' | 'MEMBER' | string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ApiPackage {
  id: number;
  name: string;
  type: 'MEMBERSHIP' | 'PT';
  description?: string | null;
  price: number | string;
  durationDays: number;
  trialPtSessions: number;
  totalPtSessions?: number | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ApiSubscription {
  id: number;
  userId: number;
  packageId: number;
  startDate: string;
  endDate: string;
  remainingSessions?: number | null;
  status: 'PENDING' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
  createdAt?: string;
  updatedAt?: string;
  package?: ApiPackage;
  user?: {
    id: number;
    fullName: string;
    email: string;
  };
}

export interface ApiCheckIn {
  id: number;
  memberId: number;
  membershipId?: number | null;
  roomId?: number | null;
  staffId?: number | null;
  checkInTime: string;
  method: string;
  status: 'SUCCESS' | 'FAILED';
  rejectReason?: string | null;
  membership?: {
    package?: ApiPackage;
  };
}

export interface Pagination {
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

// Token helper methods
export const tokenStorage = {
  getAccessToken(): string | null {
    return localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  },
  setTokens(accessToken: string, refreshToken?: string) {
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
    if (refreshToken) {
      localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
    }
  },
  getUser(): ApiUser | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
  clear() {
    localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
  }
};

// Generic Fetch Wrapper
async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const token = tokenStorage.getAccessToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(url, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data.message || data.error || `HTTP error ${response.status}`;
    throw new Error(errorMsg);
  }

  return data as T;
}

// =============================================================================
// API MODULES EXPORTED
// =============================================================================
export const api = {
  // Health check
  async checkHealth(): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE_URL.replace('/api', '')}/health`);
      return res.ok;
    } catch {
      return false;
    }
  },

  // 1. Auth Module
  auth: {
    async login(payload: { email: string; password: string }) {
      const res = await request<{
        success: boolean;
        message: string;
        data: {
          user: ApiUser;
          accessToken: string;
          refreshToken?: string;
        };
      }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (res.data?.accessToken) {
        tokenStorage.setTokens(res.data.accessToken, res.data.refreshToken);
        localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(res.data.user));
      }
      return res.data;
    },

    async register(payload: {
      email: string;
      password: string;
      fullName: string;
      phone?: string;
    }) {
      const res = await request<{
        success: boolean;
        message: string;
        data: ApiUser;
      }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      return res.data;
    },

    async changePassword(payload: { oldPassword: string; newPassword: string }) {
      return request<{ success: boolean; message: string }>('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    },

    async forgotPassword(email: string) {
      return request<{
        success: boolean;
        message: string;
        data?: { resetToken: string };
      }>('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email })
      });
    },

    async resetPassword(payload: { resetToken: string; newPassword: string }) {
      return request<{ success: boolean; message: string }>('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    },

    async googleLogin(idToken: string) {
      const res = await request<{
        success: boolean;
        message: string;
        data: {
          user: ApiUser;
          accessToken: string;
          refreshToken?: string;
        };
      }>('/auth/google', {
        method: 'POST',
        body: JSON.stringify({ idToken })
      });
      if (res.data?.accessToken) {
        tokenStorage.setTokens(res.data.accessToken, res.data.refreshToken);
        localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(res.data.user));
      }
      return res.data;
    },

    getToken(): string | null {
      return tokenStorage.getAccessToken();
    },

    getCurrentUser(): ApiUser | null {
      return tokenStorage.getUser();
    },

    logout() {
      tokenStorage.clear();
    }
  },

  // 2. Users Module
  users: {
    async getUsers(params: {
      page?: number;
      limit?: number;
      role?: string;
      search?: string;
    } = {}) {
      const q = new URLSearchParams();
      if (params.page) q.set('page', String(params.page));
      if (params.limit) q.set('limit', String(params.limit));
      if (params.role) q.set('role', params.role);
      if (params.search) q.set('search', params.search);

      return request<{
        success: boolean;
        data: ApiUser[];
        pagination: Pagination;
      }>(`/users?${q.toString()}`);
    },

    async getUserById(id: number | string) {
      const res = await request<{ success: boolean; data: ApiUser }>(`/users/${id}`);
      return res.data;
    },

    async updateUser(
      id: number | string,
      payload: { fullName?: string; phone?: string; avatar?: string }
    ) {
      const res = await request<{
        success: boolean;
        message: string;
        data: ApiUser;
      }>(`/users/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      return res.data;
    },

    async updateUserRole(id: number | string, role: 'ADMIN' | 'STAFF' | 'RECEPTIONIST' | 'COACH' | 'MEMBER' | string) {
      const res = await request<{
        success: boolean;
        message: string;
        data: ApiUser;
      }>(`/users/${id}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role })
      });
      return res.data;
    }
  },

  // 3. Packages Module
  packages: {
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
  },

  // 4. Subscriptions Module
  subscriptions: {
    async createSubscription(payload: {
      packageId: number;
      startDate?: string;
      userId?: number;
      status?: 'ACTIVE' | 'PENDING';
    }) {
      const res = await request<{
        success: boolean;
        message: string;
        data: ApiSubscription;
      }>('/subscriptions', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      return res.data;
    },

    async getMySubscriptions() {
      const res = await request<{ success: boolean; data: ApiSubscription[] }>(
        '/subscriptions/my-subscriptions'
      );
      return res.data;
    },

    async getAllSubscriptions(params: {
      page?: number;
      limit?: number;
      status?: string;
      search?: string;
    } = {}) {
      const q = new URLSearchParams();
      if (params.page) q.set('page', String(params.page));
      if (params.limit) q.set('limit', String(params.limit));
      if (params.status) q.set('status', params.status);
      if (params.search) q.set('search', params.search);

      return request<{
        success: boolean;
        data: ApiSubscription[];
        pagination: Pagination;
      }>(`/subscriptions?${q.toString()}`);
    },

    async updateSubscriptionStatus(
      id: number | string,
      status: 'PENDING' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED'
    ) {
      const res = await request<{
        success: boolean;
        message: string;
        data: ApiSubscription;
      }>(`/subscriptions/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
      return res.data;
    }
  },

  // 5. Payments Module (PayOS Integration)
  payments: {
    async createCheckoutSession(packageId: number) {
      return request<{
        message: string;
        subscriptionId: number;
        checkoutUrl: string;
        qrCode: string;
      }>('/payments/checkout', {
        method: 'POST',
        body: JSON.stringify({ packageId })
      });
    }
  },

  // 6. Check-in Module
  checkin: {
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
  }
};
