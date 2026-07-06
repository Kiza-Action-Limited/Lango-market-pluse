import api from '../config/axios';

const unwrap = (response) => response?.data?.data || response?.data || null;

export const rfqService = {
  create: async (payload) => {
    const response = await api.post('/v1/rfqs', payload);
    return unwrap(response);
  },

  getMy: async (params = {}) => {
    const response = await api.get('/v1/rfqs/my', { params });
    return response?.data || { data: [], pagination: null };
  },

  getById: async (id) => {
    const response = await api.get(`/v1/rfqs/${id}`);
    return unwrap(response);
  },

  respond: async (id, payload) => {
    const response = await api.put(`/v1/rfqs/${id}/respond`, payload);
    return unwrap(response);
  },

  updateStatus: async (id, payload) => {
    const response = await api.patch(`/v1/rfqs/${id}/status`, payload);
    return unwrap(response);
  },
};

export default rfqService;
