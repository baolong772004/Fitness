import { request } from './client';
import { ApiSupportTicket } from './types';

export const supportApi = {
  async createTicket(payload: { subject: string; message: string }) {
    return request<{
      success: boolean;
      message: string;
      data: ApiSupportTicket;
    }>('/support', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async getTickets() {
    const res = await request<{
      success: boolean;
      data: ApiSupportTicket[];
    }>('/support');
    return res.data;
  },

  async replyTicket(id: number | string, payload: {
    reply: string;
    status?: 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | string;
  }) {
    return request<{
      success: boolean;
      message: string;
      data: ApiSupportTicket;
    }>(`/support/${id}/reply`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
  }
};
