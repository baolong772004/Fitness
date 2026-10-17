import { API_BASE_URL } from './client';
import { authApi } from './auth.api';
import { userApi } from './user.api';
import { packageApi } from './package.api';
import { subscriptionApi } from './subscription.api';
import { paymentApi } from './payment.api';
import { checkinApi } from './checkin.api';
import { ptApi } from './pt.api';
import { groupClassApi } from './groupClass.api';
import { memberApi } from './member.api';
import { adminApi } from './admin.api';
import { adminTrainerApi } from './adminTrainer.api';
import { workoutLogApi } from './workoutLog.api';
import { reviewApi } from './review.api';
import { supportApi } from './support.api';
import { facilityApi } from './facility.api';
import { notificationApi } from './notification.api';
import { staffApi } from './staff.api';

// Health check
export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL.replace('/api', '')}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

// Unified API object matching previous api signature
export const api = {
  checkHealth,
  auth: authApi,
  staff: staffApi,
  users: userApi,
  packages: packageApi,
  subscriptions: subscriptionApi,
  payments: paymentApi,
  checkin: checkinApi,
  pt: ptApi,
  groupClasses: groupClassApi,
  member: memberApi,
  admin: adminApi,
  adminTrainers: adminTrainerApi,
  workouts: workoutLogApi,
  reviews: reviewApi,
  support: supportApi,
  facility: facilityApi,
  notifications: notificationApi,
};

export default api;

// Export individual modules
export {
  authApi,
  staffApi,
  userApi,
  packageApi,
  subscriptionApi,
  paymentApi,
  checkinApi,
  ptApi,
  groupClassApi,
  memberApi,
  adminApi,
  adminTrainerApi,
  workoutLogApi,
  reviewApi,
  supportApi,
  facilityApi,
  notificationApi,
};
export type { ApiNotification } from './notification.api';
export * from './staff.api';


// Re-export client utilities & types
export * from './client';
export * from './types';
