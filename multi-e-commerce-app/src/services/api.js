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
    BASE: '/products',
    FEATURED: '/products/featured',
    DETAIL: (id) => `/products/${id}`,
    REVIEWS: (id) => `/products/${id}/reviews`,
  },
  
  // Categories
  CATEGORIES: {
    BASE: '/categories',
  },
  
  // Cart
  CART: {
    BASE: '/cart',
    ADD: '/cart/add',
    UPDATE: '/cart/update',
    REMOVE: (id) => `/cart/remove/${id}`,
    CLEAR: '/cart/clear',
  },
  
  // Orders5
  ORDERS: {
    BASE: '/orders',
    DETAIL: (id) => `/orders/${id}`,
    TRACK: (id) => `/orders/${id}/tracking`,
    CANCEL: (id) => `/orders/${id}/cancel`,
  },
  
  // Wishlist
  WISHLIST: {
    BASE: '/wishlist',
    CHECK: (id) => `/wishlist/check/${id}`,
    TOGGLE: (id) => `/wishlist/${id}`,
  },
  
  // Notifications
  NOTIFICATIONS: {
    BASE: '/notifications',
    READ: (id) => `/notifications/${id}/read`,
    READ_ALL: '/notifications/read-all',
  },
  
  // Seller
  SELLER: {
    STATS: '/seller/stats',
    PRODUCTS: '/seller/products',
    ORDERS: '/seller/orders',
  },
  
  // Admin
  ADMIN: {
    STATS: '/admin/stats',
    USERS: '/admin/users',
    BLOCK_USER: (id) => `/admin/users/${id}/block`,
    ORDERS: '/admin/orders',
    UPDATE_ORDER_STATUS: (id) => `/admin/orders/${id}/status`,
    PRODUCTS: '/admin/products',
    TOGGLE_PRODUCT: (id) => `/admin/products/${id}/toggle`,
  },
  
  // Profile
  PROFILE: {
    BASE: '/profile',
  },
};

export default api;
