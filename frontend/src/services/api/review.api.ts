import { request } from './client';
import { ApiReview, Pagination } from './types';

export const reviewApi = {
  async createReview(payload: {
    coachProfileId: number;
    rating: number;
    comment?: string;
  }) {
    return request<{
      success: boolean;
      message: string;
      data: { review: ApiReview; averageRating: number };
    }>('/reviews', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async getCoachReviews(coachProfileId: number | string, params: { page?: number; limit?: number } = {}) {
    const q = new URLSearchParams();
    if (params.page) q.set('page', String(params.page));
    if (params.limit) q.set('limit', String(params.limit));

    return request<{
      success: boolean;
      data: ApiReview[];
      pagination: Pagination;
    }>(`/reviews/coach/${coachProfileId}?${q.toString()}`);
  }
};
