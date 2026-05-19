// src/config/axios.js
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add token and support FormData uploads
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    config.headers = config.headers || {};
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (config.data instanceof FormData) {
      // Let the browser set the correct multipart boundary header.
      delete config.headers['Content-Type'];
      delete config.headers['content-type'];
      if (config.headers?.common) {
        delete config.headers.common['Content-Type'];
        delete config.headers.common['content-type'];
      }
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const requestUrl = String(error?.config?.url || '');
    const isAuthAttempt =
      requestUrl.includes('/v1/auth/login') ||
      requestUrl.includes('/v1/auth/register') ||
      requestUrl.includes('/v1/auth/otp/') ||
      requestUrl.includes('/v1/auth/forgot-password') ||
      requestUrl.includes('/v1/auth/reset-password');

    if (error.response?.status === 401 && !isAuthAttempt) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
