import { request } from './client';

export const paymentApi = {
  async createCheckoutSession(packageId: number) {
    return request<{
      message: string;
      subscriptionId: number;
      orderCode: number;
      checkoutUrl: string;
      qrCode: string;
    }>('/payments/checkout', {
      method: 'POST',
      body: JSON.stringify({ packageId })
    });
  },

  async checkPaymentStatus(orderCode: number | string) {
    return request<{
      success: boolean;
      status: 'PAID' | 'CANCELLED' | 'PENDING' | string;
      message: string;
    }>(`/payments/check-status/${orderCode}`);
  }
};
