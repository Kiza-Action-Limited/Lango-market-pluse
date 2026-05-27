import api from '../config/axios';
import { normalizePlanId } from '../config/subscriptionPlans';

const normalizeSubscriptionPayload = (payload) => payload?.data?.data || payload?.data || payload || null;

export const subscriptionService = {
  getPlans: async () => {
    const response = await api.get('/v1/subscriptions/plans');
    return normalizeSubscriptionPayload(response.data) || [];
  },

  getMySubscription: async () => {
    const response = await api.get('/v1/subscriptions/me');
    const data = normalizeSubscriptionPayload(response.data);
    if (!data) return null;
    return {
      ...data,
      plan: normalizePlanId(data.plan),
    };
  },

  subscribe: async ({ planId, paymentMethod = 'mpesa', paymentCompleted = true, paymentReference }) => {
    const normalizedPlanId = normalizePlanId(planId);
    const body = {
      planId: normalizedPlanId,
      paymentMethod,
    };

    if (normalizedPlanId !== 'mizigo') {
      body.paymentCompleted = paymentCompleted;
      body.paymentReference = paymentReference || `ui-${normalizedPlanId}-${Date.now()}`;
    }

    const response = await api.post('/v1/subscriptions/subscribe', body);
    return normalizeSubscriptionPayload(response.data);
  },
};
