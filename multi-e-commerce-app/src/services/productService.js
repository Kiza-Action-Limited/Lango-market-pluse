// src/services/productService.js
import api from '../config/axios';

const MAX_PRODUCT_LIMIT = 100;

const normalizeProductParams = (params = {}) => {
  const normalized = Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')
  );

  if (normalized.limit) {
    normalized.limit = Math.min(Number(normalized.limit) || MAX_PRODUCT_LIMIT, MAX_PRODUCT_LIMIT);
  }

  return normalized;
};

export const productService = {
  getAll: async (params = {}) => {
    const response = await api.get('/v1/products', { params: normalizeProductParams(params) });
    return response.data;
  },

  getFeatured: async () => {
    const response = await api.get('/v1/products/featured');
    return response.data;
  },

  getById: async (id) => {
    const response = await api.get(`/v1/products/${id}`);
    return response.data.data;
  },

  getMyProducts: async (params = {}) => {
    const response = await api.get('/v1/products/my-products', { params });
    return response.data;
  },

  create: async (productData) => {
    const response = await api.post('/v1/products', productData);
    return response.data;
  },

  update: async (id, productData) => {
    const response = await api.put(`/v1/products/${id}`, productData);
    return response.data;
  },

  delete: async (id) => {
    const response = await api.delete(`/v1/products/${id}`);
    return response.data;
  },

  addReview: async (productId, reviewData) => {
    const response = await api.post(`/v1/products/${productId}/reviews`, reviewData);
    return response.data;
  },

  getReviews: async (productId) => {
    const response = await api.get(`/v1/products/${productId}/reviews`);
    return response.data;
  },

  getReviewEligibility: async (productId) => {
    const response = await api.get(`/v1/products/${productId}/reviews/eligibility`);
    return response.data;
  },
};
