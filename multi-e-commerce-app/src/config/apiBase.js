const trimTrailingSlash = (value = '') => String(value).replace(/\/+$/, '');

const normalizeApiBaseUrl = (value = '', fallback = '/api') => {
  const trimmedValue = trimTrailingSlash(String(value || '').trim());

  if (!trimmedValue) return fallback;
  if (trimmedValue === '/api' || trimmedValue.endsWith('/api')) return trimmedValue;
  if (/^https?:\/\//i.test(trimmedValue)) return `${trimmedValue}/api`;

  return trimmedValue.startsWith('/') ? trimmedValue : `/${trimmedValue}`;
};

const PRODUCTION_API_ORIGIN = 'https://lango-market-pluse-4fje.onrender.com';
const defaultApiBaseUrl = import.meta.env.PROD ? `${PRODUCTION_API_ORIGIN}/api` : '/api';

export const API_BASE_URL = normalizeApiBaseUrl(import.meta.env.VITE_API_URL || defaultApiBaseUrl);

export const buildApiUrl = (path = '') => {
  const normalizedPath = String(path || '');
  if (!normalizedPath) return API_BASE_URL;
  return `${API_BASE_URL}${normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`}`;
};

export const getSocketUrl = () => {
  const explicitSocketUrl = import.meta.env.VITE_SOCKET_URL;
  if (explicitSocketUrl) return trimTrailingSlash(explicitSocketUrl);

  if (!API_BASE_URL || API_BASE_URL.startsWith('/')) {
    if (import.meta.env.PROD) return PRODUCTION_API_ORIGIN;
    return window.location.origin;
  }

  return trimTrailingSlash(API_BASE_URL.replace(/\/api(?:\/v\d+)?$/i, ''));
};
