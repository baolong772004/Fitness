import { request } from './client';
import { Pagination } from './types';

export interface ApiNotification {
  id: number;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export const notificationApi = {
  async getMyNotifications(params: { page?: number; limit?: number } = {}) {
    const q = new URLSearchParams();
    if (params.page) q.set('page', String(params.page));
    if (params.limit) q.set('limit', String(params.limit));
    return request<{ success: boolean; data: ApiNotification[]; unreadCount: number; pagination: Pagination }>(
      `/notifications?${q.toString()}`
    );
  },

  async getUnreadCount() {
    return request<{ success: boolean; data: { unreadCount: number } }>('/notifications/unread-count');
  },

  async markRead(id: number | string) {
    return request<{ success: boolean; message: string }>(`/notifications/${id}/read`, { method: 'PATCH' });
  },

  async markAllRead() {
    return request<{ success: boolean; message: string; data: { updatedCount: number } }>('/notifications/read-all', {
      method: 'PATCH'
    });
  },

  async createAnnouncement(payload: { title: string; message: string; userId?: number }) {
    return request<{ success: boolean; message?: string; data: ApiNotification | { sentCount: number } }>('/notifications/announcement', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }
};
