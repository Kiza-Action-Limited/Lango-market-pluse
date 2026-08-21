const AUTH_TOKEN_KEY = 'token';
const AUTH_LAST_ACTIVITY_KEY = 'auth_last_activity_at';
const IDLE_TIMEOUT_MINUTES = Number(import.meta.env.VITE_SESSION_IDLE_TIMEOUT_MINUTES || 30);

export const SESSION_IDLE_TIMEOUT_MS = Math.max(1, IDLE_TIMEOUT_MINUTES) * 60 * 1000;

export const clearStoredAuth = () => {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem('refreshToken');
  sessionStorage.removeItem(AUTH_TOKEN_KEY);
  sessionStorage.removeItem('refreshToken');
  sessionStorage.removeItem(AUTH_LAST_ACTIVITY_KEY);
};

export const touchAuthActivity = () => {
  if (sessionStorage.getItem(AUTH_TOKEN_KEY)) {
    sessionStorage.setItem(AUTH_LAST_ACTIVITY_KEY, String(Date.now()));
  }
};

export const getLastAuthActivity = () => Number(sessionStorage.getItem(AUTH_LAST_ACTIVITY_KEY) || 0);

export const getStoredToken = () => {
  const token = sessionStorage.getItem(AUTH_TOKEN_KEY);
  if (!token) {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem('refreshToken');
  }
  return token;
};

export const setSessionToken = (token) => {
  clearStoredAuth();
  if (token) {
    sessionStorage.setItem(AUTH_TOKEN_KEY, token);
    touchAuthActivity();
  }
};
