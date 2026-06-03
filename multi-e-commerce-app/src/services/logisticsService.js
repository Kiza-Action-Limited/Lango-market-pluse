import api from '../config/axios';

const unwrap = (response) => response?.data?.data || response?.data || null;

export const logisticsService = {
  applyAsLogistics: async (formData) => {
    const response = await api.post('/v1/logistics/apply', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return unwrap(response);
  },

  getMyApplication: async () => {
    const response = await api.get('/v1/logistics/me/application');
    return unwrap(response);
  },

  getDriverTrips: async (params = {}) => {
    const response = await api.get('/v1/logistics', { params });
    return response?.data || { data: [], pagination: null };
  },

  getVerifiedProviders: async (params = {}) => {
    const candidates = [
      () => api.get('/v1/logistics/providers', { params: { ...params, status: 'verified' } }),
      () => api.get('/v1/logistics/providers/verified', { params }),
      () => api.get('/v1/logistics/verified-providers', { params }),
    ];

    let lastError;
    for (const request of candidates) {
      try {
        const response = await request();
        const payload = response?.data?.data || response?.data || {};
        return payload.providers || payload.logistics || payload.users || payload.data || payload || [];
      } catch (error) {
        lastError = error;
        if (error.response?.status === 401 || error.response?.status === 403) throw error;
      }
    }

    if (lastError?.response?.status === 404) return [];
    throw lastError;
  },

  acceptTrip: async (logisticsId) => {
    const response = await api.put(`/v1/logistics/${logisticsId}/accept`);
    return unwrap(response);
  },

  scanPickup: async (logisticsId, payload) => {
    const response = await api.post(`/v1/logistics/${logisticsId}/scan/pickup`, payload);
    return unwrap(response);
  },

  getAdminApplications: async (params = {}) => {
    const response = await api.get('/v1/admin/logistics/applications', { params });
    return response?.data || { data: [], pagination: null };
  },

  reviewApplication: async (userId, payload) => {
    const response = await api.put(`/v1/admin/logistics/applications/${userId}/review`, payload);
    return unwrap(response);
  },

  getAdminLogisticsTrips: async (params = {}) => {
    const response = await api.get('/v1/admin/logistics', { params });
    return response?.data || { logistics: [], pagination: null };
  },
};
