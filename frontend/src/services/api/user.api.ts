import { request } from './client';
import { ApiUser, Pagination } from './types';

export const userApi = {
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

  async updateUserRole(id: number | string, role: 'ADMIN' | 'STAFF' | 'COACH' | 'MEMBER' | string) {
    const res = await request<{
      success: boolean;
      message: string;
      data: ApiUser;
    }>(`/users/${id}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role })
    });
    return res.data;
  },

  async updateUserStatus(id: number | string, status: 'ACTIVE' | 'INACTIVE' | 'BANNED' | string) {
    const res = await request<{
      success: boolean;
      message: string;
      data: ApiUser;
    }>(`/users/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
    return res.data;
  }
};
