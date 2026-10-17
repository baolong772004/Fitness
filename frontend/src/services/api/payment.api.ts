import { request } from './client';

export const paymentApi = {
  async createCheckoutSession(packageId: number, memberId?: number) {
    return request<{
      message: string;
      subscriptionId: number;
      orderCode: number;
      checkoutUrl: string;
      qrCode: string;
    }>('/payments/checkout', {
      method: 'POST',
      body: JSON.stringify({ packageId, ...(memberId ? { memberId } : {}) })
    });
  },

  async checkPaymentStatus(orderCode: number | string) {
    return request<{
      success: boolean;
      status: 'PAID' | 'PAID_REVIEW' | 'CANCELLED' | 'PENDING' | string;
      message: string;
    }>(`/payments/check-status/${orderCode}`);
  }
};
