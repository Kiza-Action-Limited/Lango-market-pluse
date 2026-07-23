// src/services/api.js
import api from '../config/axios';

export const API_ENDPOINTS = {
  // Auth
  AUTH: {
    LOGIN: '/v1/auth/login',
    REGISTER: '/v1/auth/register',
    ME: '/v1/auth/me',
  },
  
  // Products
  PRODUCTS: {
    BASE: '/v1/products',
    FEATURED: '/v1/products/featured',
    DETAIL: (id) => `/v1/products/${id}`,
    REVIEWS: (id) => `/v1/products/${id}/reviews`,
  },
  
  // Categories
  CATEGORIES: {
    BASE: '/v1/categories',
  },
  
  // Cart
  CART: {
    BASE: '/v1/cart',
    ADD: '/v1/cart/add',
    UPDATE: '/v1/cart/update',
    REMOVE: (id) => `/v1/cart/remove/${id}`,
    CLEAR: '/v1/cart/clear',
  },
  
  // Orders
  ORDERS: {
    BASE: '/v1/orders',
    DETAIL: (id) => `/v1/orders/${id}`,
    TRACK: (id) => `/v1/orders/${id}/tracking`,
    CANCEL: (id) => `/v1/orders/${id}/cancel`,
  },
  
  // Wishlist
  WISHLIST: {
    BASE: '/v1/wishlist',
    CHECK: (id) => `/v1/wishlist/check/${id}`,
    TOGGLE: (id) => `/v1/wishlist/${id}`,
  },
  
  // Notifications
  NOTIFICATIONS: {
    BASE: '/v1/notifications',
    READ: (id) => `/v1/notifications/${id}/read`,
    READ_ALL: '/v1/notifications/read-all',
  },
  
  // Seller
  SELLER: {
    PREMIUM_VERIFICATION: '/v1/seller/premium-verification',
    EXPORT: (type) => `/v1/seller/export/${type}`,
  },
  
  // Admin
  ADMIN: {
    STATS: '/v1/admin/stats',
    USERS: '/v1/admin/users',
    BLOCK_USER: (id) => `/v1/admin/users/${id}`,
    ORDERS: '/v1/admin/orders',
    UPDATE_ORDER_STATUS: (id) => `/v1/admin/orders/${id}/status`,
    PRODUCTS: '/v1/admin/products',
    TOGGLE_PRODUCT: (id) => `/v1/admin/products/${id}/toggle`,
    SUBSCRIPTIONS: '/v1/admin/subscriptions',
    UPDATE_SUBSCRIPTION: (id) => `/v1/admin/subscriptions/${id}`,
    EXPORT: (type) => `/v1/admin/export/${type}`,
  },
  
  // Profile
  PROFILE: {
    BASE: '/v1/auth/me',
    AVATAR: '/v1/auth/me/profile-image',
  },
};

export default api;
