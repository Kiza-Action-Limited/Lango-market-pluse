// src/services/orderService.js
import api from '../config/axios';

export const orderService = {
  getAll: async (params = {}) => {
    const response = await api.get('/v1/orders', { params });
    return response.data;
  },

  getById: async (id) => {
    const response = await api.get(`/v1/orders/${id}`);
    return response.data;
  },

  create: async (orderData) => {
    const response = await api.post('/v1/orders', orderData);
    return response.data;
  },

  cancel: async (id) => {
    const response = await api.put(`/v1/orders/${id}/cancel`);
    return response.data;
  },

  updateStatus: async (id, status) => {
    const response = await api.put(`/v1/orders/${id}/status`, { status });
    return response.data;
  },

  getTracking: async (id) => {
    const response = await api.get(`/v1/orders/${id}/tracking`);
    return response.data;
  },
};
