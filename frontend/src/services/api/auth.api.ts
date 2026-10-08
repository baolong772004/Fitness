import { request, tokenStorage, STORAGE_KEYS } from './client';
import { ApiUser } from './types';

export const authApi = {
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
};
