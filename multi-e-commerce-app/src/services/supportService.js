 import api from '../config/axios';

export const supportService = {
  getMyMessages: async (params = {}) => {
    const response = await api.get('/v1/support/messages', { params });
    return response.data;
  },

  createMessage: async (payload) => {
    const response = await api.post('/v1/support/messages', payload);
    return response.data;
  },

  replyToMessage: async (messageId, message) => {
    const response = await api.post(`/v1/support/messages/${messageId}/replies`, { message });
    return response.data;
  },

  getAdminMessages: async (params = {}) => {
    const response = await api.get('/v1/support/admin/messages', { params });
    return response.data;
  },

  adminReply: async (messageId, payload) => {
    const response = await api.post(`/v1/support/admin/messages/${messageId}/replies`, payload);
    return response.data;
  },

  updateStatus: async (messageId, status) => {
    const response = await api.put(`/v1/support/admin/messages/${messageId}/status`, { status });
    return response.data;
  },
};
