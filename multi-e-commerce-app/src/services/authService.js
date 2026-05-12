import api from '../config/axios';

const normalizeAuthResponse = (payload) => {
  const data = payload?.data || payload || {};
  return {
    user: data.user || null,
    token: data.accessToken || data.token || null,
    accessToken: data.accessToken || data.token || null,
    refreshToken: data.refreshToken || null,
  };
};

export const authService = {
  login: async (identifier, password) => {
    const body = {
      password,
      ...(identifier?.includes('@') ? { email: identifier } : { phone: identifier }),
    };
    const response = await api.post('/v1/auth/login', body);
    return normalizeAuthResponse(response.data);
  },

  register: async (userData) => {
    const response = await api.post('/v1/auth/register', userData);
    return normalizeAuthResponse(response.data);
  },

  getCurrentUser: async () => {
    const response = await api.get('/v1/auth/me');
    return response.data?.data?.user || response.data?.user || null;
  },

  logout: () => {
    localStorage.removeItem('token');
  },

  checkEmailAccount: async (email) => {
    const payload = { email };
    const readExists = (data) => {
      if (typeof data?.exists === 'boolean') return data.exists;
      if (typeof data?.found === 'boolean') return data.found;
      if (typeof data?.isRegistered === 'boolean') return data.isRegistered;
      if (data?.user && typeof data.user === 'object') return true;
      if (Array.isArray(data?.users)) return data.users.length > 0;
      return false;
    };
    const attempts = [
      () => api.post('/v1/auth/check-email', payload),
      () => api.post('/v1/auth/email-exists', payload),
      () => api.get(`/v1/auth/check-email?email=${encodeURIComponent(email)}`),
    ];
    let lastError = null;
    for (const call of attempts) {
      try {
        const response = await call();
        return { exists: readExists(response?.data), raw: response?.data };
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error('Unable to validate email account');
  },

  forgotPassword: async (email) => {
    const response = await api.post('/v1/auth/forgot-password', { email });
    return response.data;
  },

  resetPassword: async (token, password) => {
    const response = await api.post('/v1/auth/reset-password', { token, password });
    return response.data;
  },

  changePassword: async (currentPassword, newPassword) => {
    const response = await api.put('/v1/auth/change-password', { currentPassword, newPassword });
    return response.data;
  },

  verifyEmail: async (token) => {
    const response = await api.post('/v1/auth/verify-email', { token });
    return response.data;
  },

  resendVerification: async (email) => {
    const response = await api.post('/v1/auth/resend-verification', { email });
    return response.data;
  }
};
