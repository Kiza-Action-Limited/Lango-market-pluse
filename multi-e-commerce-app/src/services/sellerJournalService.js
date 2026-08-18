import api from '../config/axios';

export const sellerJournalService = {
  cfoDashboard: async (params = {}) => {
    const response = await api.get('/v1/seller/cfo-dashboard', { params });
    return response.data;
  },

  list: async (params = {}) => {
    const response = await api.get('/v1/seller/journal', { params });
    return response.data;
  },

  create: async (payload) => {
    const response = await api.post('/v1/seller/journal', payload);
    return response.data;
  },
};
