import api from '../config/axios';
import {
  requireGpsCoords,
  requireMongoId,
  requirePositiveAmount,
  requireQrToken,
  resolveGpsCoords,
  withIdempotency,
} from '../utils/backendRules';

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

  getDashboard: async (params = {}) => {
    const response = await api.get('/v1/logistics/dashboard', { params });
    return unwrap(response);
  },

  getOperationsOverview: async () => {
    const response = await api.get('/v1/logistics/operations/overview');
    return unwrap(response);
  },

  updateDriverLocation: async (payload) => {
    const response = await api.put('/v1/logistics/location', requireGpsCoords(payload));
    return unwrap(response);
  },

  updateTripLocation: async (logisticsId, payload) => {
    const response = await api.put(`/v1/logistics/${requireMongoId(logisticsId, 'Logistics ID')}/location`, requireGpsCoords(payload));
    return unwrap(response);
  },

  getMapData: async (logisticsId) => {
    const response = await api.get(`/v1/logistics/${logisticsId}/map`);
    return unwrap(response);
  },

  getDriverTrips: async (params = {}) => {
    const response = await api.get('/v1/logistics', { params });
    return response?.data || { data: [], pagination: null };
  },

  createShipment: async (payload) => {
    const response = await api.post('/v1/logistics', payload, withIdempotency('logistics-create'));
    return unwrap(response);
  },

  getByOrder: async (orderId) => {
    const response = await api.get(`/v1/logistics/order/${orderId}`);
    return unwrap(response);
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

  getBuyerPreference: async () => {
    const response = await api.get('/v1/logistics/buyer/preference');
    return unwrap(response);
  },

  updateBuyerPreference: async (payload) => {
    const response = await api.put('/v1/logistics/buyer/preference', payload);
    return unwrap(response);
  },

  getSellerBuyerRequests: async (params = {}) => {
    const response = await api.get('/v1/logistics/seller/buyer-requests', { params });
    const payload = unwrap(response);
    return payload?.requests || payload || [];
  },

  acceptTrip: async (logisticsId) => {
    const response = await api.put(`/v1/logistics/${requireMongoId(logisticsId, 'Logistics ID')}/accept`, {}, withIdempotency('logistics-accept'));
    return unwrap(response);
  },

  assignDriver: async (logisticsId, payload = {}) => {
    const response = await api.put(`/v1/logistics/${requireMongoId(logisticsId, 'Logistics ID')}/assign-driver`, payload, withIdempotency('logistics-assign-driver'));
    return unwrap(response);
  },

  scanPickup: async (logisticsId, payload) => {
    const qrPayload = parseQrPayload(payload);
    if (qrPayload.type && String(qrPayload.type).toUpperCase() !== 'PICKUP') {
      throw new Error('This is a DELIVERY QR token. Use the PICKUP token to confirm pickup.');
    }

    const response = await api.post(`/v1/logistics/${requireMongoId(logisticsId, 'Logistics ID')}/qr-scan`, {
      step: 'pickup',
      token: requireQrToken(qrPayload.token),
      gpsCoords: await resolveGpsCoords(payload?.gpsCoords),
    }, withIdempotency('logistics-pickup-scan'));
    return unwrap(response);
  },

  scanDelivery: async (logisticsId, payload) => {
    const qrPayload = parseQrPayload(payload);
    const response = await api.post(`/v1/logistics/${requireMongoId(logisticsId, 'Logistics ID')}/qr-scan`, {
      step: 'delivery',
      token: requireQrToken(qrPayload.token),
      gpsCoords: await resolveGpsCoords(payload?.gpsCoords),
    }, withIdempotency('logistics-delivery-scan'));
    return unwrap(response);
  },

  getAdminApplications: async (params = {}) => {
    const response = await api.get('/v1/admin/logistics/applications', { params });
    return response?.data || { data: [], pagination: null };
  },

  reviewApplication: async (userId, payload) => {
    const response = await api.put(`/v1/admin/logistics/applications/${requireMongoId(userId, 'User ID')}/review`, payload, withIdempotency('logistics-review-application'));
    return unwrap(response);
  },

  getAdminLogisticsTrips: async (params = {}) => {
    const response = await api.get('/v1/admin/logistics', { params });
    return response?.data || { logistics: [], pagination: null };
  },

  getAdminLogisticsLive: async (logisticsId) => {
    const response = await api.get(`/v1/admin/logistics/${logisticsId}/live`);
    return unwrap(response);
  },

  adminScanTripQr: async (logisticsId, payload) => {
    const response = await api.post(`/v1/admin/logistics/${requireMongoId(logisticsId, 'Logistics ID')}/qr-scan`, {
      ...payload,
      token: requireQrToken(payload?.token),
      gpsCoords: await resolveGpsCoords(payload?.gpsCoords),
    }, withIdempotency('admin-logistics-qr-scan'));
    return unwrap(response);
  },

  adminReleaseLogisticsEscrow: async (logisticsId, payload = {}) => {
    const response = await api.post(`/v1/admin/logistics/${requireMongoId(logisticsId, 'Logistics ID')}/escrow/release`, payload, withIdempotency('admin-logistics-escrow-release'));
    return unwrap(response);
  },

  updateAdminLogisticsTracking: async (logisticsId, payload = {}) => {
    const response = await api.put(`/v1/admin/logistics/${requireMongoId(logisticsId, 'Logistics ID')}/tracking`, payload, withIdempotency('admin-logistics-tracking'));
    return unwrap(response);
  },

  createGroupTrip: async (payload) => {
    const response = await api.post('/v1/logistics/group-trip', {
      ...payload,
      originLat: requireGpsCoords({ lat: payload?.originLat, lng: payload?.originLng }).lat,
      originLng: requireGpsCoords({ lat: payload?.originLat, lng: payload?.originLng }).lng,
      destinationLat: requireGpsCoords({ lat: payload?.destinationLat, lng: payload?.destinationLng }).lat,
      destinationLng: requireGpsCoords({ lat: payload?.destinationLat, lng: payload?.destinationLng }).lng,
    }, withIdempotency('group-trip-create'));
    return unwrap(response);
  },

  getOpenGroupTrips: async (params = {}) => {
    const response = await api.get('/v1/logistics/group-trip/open', { params });
    return unwrap(response) || [];
  },

  getGroupTripRoutes: async (params = {}) => {
    const response = await api.get('/v1/logistics/group-trip/routes', { params });
    return unwrap(response) || [];
  },

  createGroupTripRoute: async (payload) => {
    const response = await api.post('/v1/logistics/group-trip/routes', payload, withIdempotency('group-trip-route-create'));
    return unwrap(response);
  },

  deleteGroupTripRoute: async (routeId) => {
    const response = await api.delete(`/v1/logistics/group-trip/routes/${encodeURIComponent(routeId)}`);
    return unwrap(response);
  },

  joinGroupTrip: async (payload) => {
    const response = await api.post('/v1/logistics/group-trip/join', {
      ...payload,
      weightKg: requirePositiveAmount(payload?.weightKg, 1, 'Cargo weight'),
    }, withIdempotency('group-trip-join'));
    return unwrap(response);
  },

  recordGroupTripPayment: async (groupTripId, payload = {}) => {
    const response = await api.post(`/v1/logistics/group-trip/${encodeURIComponent(groupTripId)}/payment`, payload, withIdempotency('group-trip-payment'));
    return unwrap(response);
  },

  bulkUpdateStatus: async (payload) => {
    const response = await api.post('/v1/logistics/bulk/status', payload, withIdempotency('logistics-bulk-status'));
    return unwrap(response);
  },

  getEscrowStatus: async (orderId) => {
    const response = await api.get(`/v1/escrow/status/${orderId}`);
    return unwrap(response);
  },

  releaseEscrow: async (orderId, payload = {}) => {
    const response = await api.post(`/v1/escrow/release/${orderId}`, payload, withIdempotency('logistics-escrow-release'));
    return unwrap(response);
  },

  holdEscrow: async (orderId, payload = {}) => {
    const response = await api.post(`/v1/escrow/hold/${orderId}`, payload, withIdempotency('logistics-escrow-hold'));
    return unwrap(response);
  },

  partialReleaseEscrow: async (orderId, payload = {}) => {
    const response = await api.post(`/v1/escrow/partial-release/${orderId}`, {
      ...payload,
      amount: requirePositiveAmount(payload?.amount, 1, 'Partial release amount'),
    }, withIdempotency('logistics-escrow-partial-release'));
    return unwrap(response);
  },

  cancelEscrow: async (orderId, payload = {}) => {
    const response = await api.post(`/v1/escrow/cancel/${orderId}`, payload, withIdempotency('logistics-escrow-cancel'));
    return unwrap(response);
  },

  generateQrToken: async (payload) => {
    const response = await api.post('/v1/qr-tokens/generate', payload, withIdempotency('qr-token-generate'));
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
    const response = await api.post(`/v1/qr-tokens/${requireMongoId(id, 'QR token ID')}/resend`, {}, withIdempotency('qr-token-resend'));
    return unwrap(response);
  },

  getQrTokenStats: async () => {
    const response = await api.get('/v1/qr-tokens/stats');
    return unwrap(response);
  },

  generateTripQrTokens: async (logisticsId) => {
    const response = await api.post(`/v1/logistics/${requireMongoId(logisticsId, 'Logistics ID')}/qr-tokens`, {}, withIdempotency('logistics-trip-qr-generate'));
    return unwrap(response);
  },

  listTripQrTokens: async (logisticsId) => {
    const response = await api.get(`/v1/logistics/${logisticsId}/qr-tokens`);
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
