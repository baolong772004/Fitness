import { request } from './client';
import { ApiMemberProfile360, Pagination } from './types';

export const adminApi = {
  async getMembersList(params: { search?: string; page?: number; limit?: number } = {}) {
    const q = new URLSearchParams();
    if (params.search) q.set('search', params.search);
    if (params.page) q.set('page', String(params.page));
    if (params.limit) q.set('limit', String(params.limit));

    return request<{
      success: boolean;
      data: Array<{
        id: number;
        fullName: string;
        email: string;
        phone?: string | null;
        avatar?: string | null;
        status: string;
        createdAt: string;
      }>;
      pagination: Pagination;
    }>(`/admin/members?${q.toString()}`);
  },

  async getMemberDetailProfile(id: number | string) {
    const res = await request<{
      success: boolean;
      data: ApiMemberProfile360;
    }>(`/admin/members/${id}/profile`);
    return res.data;
  }
};
