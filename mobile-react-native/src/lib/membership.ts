type Subscription = {
  status?: string;
  startDate?: string;
  endDate?: string;
  hasVerifiedPayment?: boolean;
  package?: { type?: string };
};

export function hasActiveGymMembership(subscriptions: Subscription[]): boolean {
  const now = Date.now();
  return subscriptions.some(subscription => subscription.package?.type === 'MEMBERSHIP' &&
    subscription.status === 'ACTIVE' &&
    subscription.hasVerifiedPayment === true &&
    !!subscription.startDate && new Date(subscription.startDate).getTime() <= now &&
    !!subscription.endDate && new Date(subscription.endDate).getTime() > now);
}
