const trimTrailingSlash = (value = '') => String(value).replace(/\/+$/, '');

export const API_BASE_URL = trimTrailingSlash(import.meta.env.VITE_API_URL || '/api');

export const buildApiUrl = (path = '') => {
  const normalizedPath = String(path || '');
  if (!normalizedPath) return API_BASE_URL;
  return `${API_BASE_URL}${normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`}`;
};

export const getSocketUrl = () => {
  const explicitSocketUrl = import.meta.env.VITE_SOCKET_URL;
  if (explicitSocketUrl) return trimTrailingSlash(explicitSocketUrl);

  if (!API_BASE_URL || API_BASE_URL.startsWith('/')) {
    return window.location.origin;
  }

  return trimTrailingSlash(API_BASE_URL.replace(/\/api(?:\/v\d+)?$/i, ''));
};
