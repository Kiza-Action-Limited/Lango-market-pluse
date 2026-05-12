// src/services/cartService.js
import api from '../config/axios';

export const cartService = {
  getCart: async () => {
    const response = await api.get('/v1/cart');
    return response.data;
  },

  addToCart: async (productId, quantity, variant) => {
    const response = await api.post('/v1/cart/add', { productId, quantity, variant });
    return response.data;
  },

  updateQuantity: async (itemId, quantity) => {
    const response = await api.put('/v1/cart/update', { itemId, quantity });
    return response.data;
  },

  removeFromCart: async (itemId) => {
    const response = await api.delete(`/v1/cart/remove/${itemId}`);
    return response.data;
  },

  clearCart: async () => {
    const response = await api.delete('/v1/cart/clear');
    return response.data;
  },

  applyCoupon: async (code) => {
    const response = await api.post('/v1/cart/apply-coupon', { code });
    return response.data;
  },

  removeCoupon: async () => {
    const response = await api.delete('/v1/cart/remove-coupon');
    return response.data;
  },

  mergeCart: async (guestCartItems) => {
    const response = await api.post('/v1/cart/merge', { items: guestCartItems });
    return response.data;
  }
};
