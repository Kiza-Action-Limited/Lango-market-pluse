import api from '../config/axios';

const readPayload = (payload) => payload?.data?.data || payload?.data || [];

export const adminSubscriptionService = {
  list: async (params = {}) => {
    const response = await api.get('/v1/admin/subscriptions', { params });
    return {
      rows: readPayload(response.data),
      plans: response.data?.plans || [],
      features: response.data?.features || [],
      stats: response.data?.stats || [],
      pagination: response.data?.pagination || null,
    };
  },

  save: async (sellerId, payload) => {
    const response = await api.put(`/v1/admin/subscriptions/${sellerId}`, payload);
    return response.data?.data || response.data;
  },

  cancel: async (sellerId, reason = '') => {
    const response = await api.delete(`/v1/admin/subscriptions/${sellerId}`, {
      data: reason ? { reason } : {},
    });
    return response.data?.data || response.data;
  },

  listFeatures: async (params = {}) => {
    const response = await api.get('/v1/admin/subscriptions/features', { params });
    return {
      features: response.data?.data || [],
      summary: response.data?.summary || null,
    };
  },

  createFeature: async (payload) => {
    const response = await api.post('/v1/admin/subscriptions/features', payload);
    return response.data?.data || response.data;
  },

  updateFeature: async (featureId, payload) => {
    const response = await api.put(`/v1/admin/subscriptions/features/${featureId}`, payload);
    return response.data?.data || response.data;
  },

  deleteFeature: async (featureId) => {
    const response = await api.delete(`/v1/admin/subscriptions/features/${featureId}`);
    return response.data?.data || response.data;
  },
};
