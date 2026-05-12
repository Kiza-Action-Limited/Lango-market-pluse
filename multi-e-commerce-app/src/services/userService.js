// src/services/userService.js
import api from '../config/axios';

export const userService = {
  getProfile: async () => {
    const response = await api.get('/profile');
    return response.data;
  },

  updateProfile: async (profileData) => {
    const response = await api.put('/profile', profileData);
    return response.data;
  },

  updateAvatar: async (avatarFile) => {
    const formData = new FormData();
    formData.append('avatar', avatarFile);
    const response = await api.put('/profile/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },

  getAddresses: async () => {
    const response = await api.get('/profile/addresses');
    return response.data;
  },

  addAddress: async (addressData) => {
    const response = await api.post('/profile/addresses', addressData);
    return response.data;
  },

  updateAddress: async (addressId, addressData) => {
    const response = await api.put(`/profile/addresses/${addressId}`, addressData);
    return response.data;
  },

  deleteAddress: async (addressId) => {
    const response = await api.delete(`/profile/addresses/${addressId}`);
    return response.data;
  },

  getWishlist: async () => {
    const response = await api.get('/wishlist');
    return response.data;
  },

  addToWishlist: async (productId) => {
    const response = await api.post(`/wishlist/${productId}`);
    return response.data;
  },

  removeFromWishlist: async (productId) => {
    const response = await api.delete(`/wishlist/${productId}`);
    return response.data;
  },

  checkWishlist: async (productId) => {
    const response = await api.get(`/wishlist/check/${productId}`);
    return response.data;
  },

  getOrderHistory: async () => {
    const response = await api.get('/orders');
    return response.data;
  },

  getOrderDetails: async (orderId) => {
    const response = await api.get(`/orders/${orderId}`);
    return response.data;
  },

  cancelOrder: async (orderId) => {
    const response = await api.put(`/orders/${orderId}/cancel`);
    return response.data;
  }
};