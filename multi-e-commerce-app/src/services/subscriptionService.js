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

  getOverview: async () => {
    const response = await api.get('/v1/subscriptions/overview');
    return normalizeSubscriptionPayload(response.data);
  },

  getEntitlements: async () => {
    const response = await api.get('/v1/subscriptions/entitlements');
    return normalizeSubscriptionPayload(response.data);
  },

  getUpgradeOptions: async () => {
    const response = await api.get('/v1/subscriptions/upgrade-options');
    return normalizeSubscriptionPayload(response.data);
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

  changePlan: async ({ newPlanId, paymentCompleted = true, paymentReference } = {}) => {
    const normalizedPlanId = normalizePlanId(newPlanId);
    const response = await api.put('/v1/subscriptions/change-plan', {
      newPlanId: normalizedPlanId,
      paymentCompleted,
      paymentReference: paymentReference || `ui-change-${normalizedPlanId}-${Date.now()}`,
    });
    return normalizeSubscriptionPayload(response.data);
  },

  cancel: async (reason = '') => {
    const response = await api.delete('/v1/subscriptions/me', {
      data: reason ? { reason } : {},
    });
    return normalizeSubscriptionPayload(response.data);
  },

  getSellerLogisticsAddon: async () => {
    const response = await api.get('/v1/subscriptions/seller-logistics-addon');
    return normalizeSubscriptionPayload(response.data);
  },

  updateSellerLogisticsAddon: async (payload = {}) => {
    const response = await api.put('/v1/subscriptions/seller-logistics-addon', payload);
    return normalizeSubscriptionPayload(response.data);
  },

  getSmsBalance: async () => {
    const response = await api.get('/v1/subscriptions/sms-balance');
    return normalizeSubscriptionPayload(response.data);
  },

  topupSmsCredits: async ({ amount, paymentReference } = {}) => {
    const response = await api.post('/v1/subscriptions/topup-sms', {
      amount,
      paymentReference: paymentReference || `ui-sms-${Date.now()}`,
    });
    return normalizeSubscriptionPayload(response.data);
  },

  getSinkingFund: async () => {
    const response = await api.get('/v1/subscriptions/sinking-fund');
    return normalizeSubscriptionPayload(response.data);
  },

  checkFeatureAccess: async (feature) => {
    const response = await api.get(`/v1/subscriptions/check-feature/${encodeURIComponent(feature)}`);
    return normalizeSubscriptionPayload(response.data);
  },
};
