import api from '../config/axios';

const unwrap = (response) => response?.data?.data || response?.data || null;

const parseQrPayload = (payload = {}) => {
  const value = payload.token || payload.qrPayload || '';
  if (value && typeof value === 'object') return value;
  if (typeof value !== 'string') return { token: value };

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : { token: value };
  } catch {
    return { token: value };
  }
};

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

  getNearbyDrivers: async (params = {}) => {
    const response = await api.get('/v1/logistics/drivers/nearby', { params });
    return unwrap(response) || [];
  },

  geocodeAddress: async (address) => {
    const response = await api.post('/v1/logistics/geocode', { address });
    return unwrap(response);
  },

  placeAutocomplete: async (input) => {
    const response = await api.get('/v1/logistics/places/autocomplete', { params: { input } });
    return unwrap(response);
  },

  getDeliveryStats: async (params = {}) => {
    const response = await api.get('/v1/logistics/stats/delivery', { params });
    return unwrap(response);
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
    const qrPayload = parseQrPayload(payload);
    if (qrPayload.type && String(qrPayload.type).toUpperCase() !== 'PICKUP') {
      throw new Error('This is a DELIVERY QR token. Use the PICKUP token to confirm pickup.');
    }

    const response = await api.post(`/v1/logistics/${logisticsId}/qr-scan`, {
      step: 'pickup',
      token: qrPayload.token,
      gpsCoords: payload?.gpsCoords,
    });
    return unwrap(response);
  },

  scanDelivery: async (logisticsId, payload) => {
    const qrPayload = parseQrPayload(payload);
    const response = await api.post(`/v1/logistics/${logisticsId}/qr-scan`, {
      step: 'delivery',
      token: qrPayload.token,
      gpsCoords: payload?.gpsCoords,
    });
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

  createGroupTrip: async (payload) => {
    const response = await api.post('/v1/logistics/group-trip', payload);
    return unwrap(response);
  },

  joinGroupTrip: async (payload) => {
    const response = await api.post('/v1/logistics/group-trip/join', payload);
    return unwrap(response);
  },

  bulkUpdateStatus: async (payload) => {
    const response = await api.post('/v1/logistics/bulk/status', payload);
    return unwrap(response);
  },

  getEscrowStatus: async (orderId) => {
    const response = await api.get(`/v1/escrow/status/${orderId}`);
    return unwrap(response);
  },

  releaseEscrow: async (orderId, payload = {}) => {
    const response = await api.post(`/v1/escrow/release/${orderId}`, payload);
    return unwrap(response);
  },

  holdEscrow: async (orderId, payload = {}) => {
    const response = await api.post(`/v1/escrow/hold/${orderId}`, payload);
    return unwrap(response);
  },

  partialReleaseEscrow: async (orderId, payload = {}) => {
    const response = await api.post(`/v1/escrow/partial-release/${orderId}`, payload);
    return unwrap(response);
  },

  cancelEscrow: async (orderId, payload = {}) => {
    const response = await api.post(`/v1/escrow/cancel/${orderId}`, payload);
    return unwrap(response);
  },

  generateQrToken: async (payload) => {
    const response = await api.post('/v1/qr-tokens/generate', payload);
    return unwrap(response);
  },

  listQrTokensForOrder: async (orderId, params = {}) => {
    const response = await api.get(`/v1/qr-tokens/order/${orderId}`, { params });
    return unwrap(response);
  },

  getQrToken: async (id) => {
    const response = await api.get(`/v1/qr-tokens/${id}`);
    return unwrap(response);
  },

  resendQrToken: async (id) => {
    const response = await api.post(`/v1/qr-tokens/${id}/resend`);
    return unwrap(response);
  },

  getQrTokenStats: async () => {
    const response = await api.get('/v1/qr-tokens/stats');
    return unwrap(response);
  },

  getMySinkingFund: async () => {
    const response = await api.get('/v1/sinking-fund/me');
    return unwrap(response);
  },

  getSinkingFund: async (driverId) => {
    const response = await api.get(`/v1/sinking-fund/${driverId}`);
    return unwrap(response);
  },

  getSinkingFundContributions: async (driverId, params = {}) => {
    const response = await api.get(`/v1/sinking-fund/${driverId}/contributions`, { params });
    return unwrap(response);
  },

  getAllSinkingFunds: async (params = {}) => {
    const response = await api.get('/v1/sinking-fund/admin/all', { params });
    return unwrap(response);
  },

  getSinkingFundServiceAlerts: async () => {
    const response = await api.get('/v1/sinking-fund/admin/service-alerts');
    return unwrap(response);
  },

  getSinkingFundAnalytics: async () => {
    const response = await api.get('/v1/sinking-fund/admin/analytics');
    return unwrap(response);
  },
};
