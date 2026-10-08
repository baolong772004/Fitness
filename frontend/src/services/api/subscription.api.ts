import { request } from './client';
import { ApiSubscription, Pagination } from './types';

export const subscriptionApi = {
  async createSubscription(payload: {
    packageId: number;
    startDate?: string;
    userId?: number;
    status?: 'ACTIVE' | 'PENDING' | string;
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
    status: 'PENDING' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED' | string
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
  },

  async renewSubscription(payload: {
    subscriptionId: number;
    packageId: number;
  }) {
    return request<{
      success: boolean;
      message: string;
      data: {
        subscriptionId: number;
        orderCode: number;
        checkoutUrl: string;
        qrCode: string;
      };
    }>('/subscriptions/renew', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }
};
