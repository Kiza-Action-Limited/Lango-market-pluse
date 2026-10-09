const crypto = require('crypto');
const axios = require('axios');
const { getVertoConfig, validateVertoConfig } = require('../../config/verto');

const tokenCache = {
  token: null,
  expiresAt: 0,
};

const createVertoError = (message, code = 'VERTO_ERROR', statusCode = 502, details = {}) => {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  Object.assign(error, details);
  return error;
};

const extractToken = (payload = {}) => (
  payload.accessToken ||
  payload.access_token ||
  payload.token ||
  payload.idToken ||
  payload.id_token ||
  payload.data?.accessToken ||
  payload.data?.access_token ||
  payload.data?.token
);

const extractExpiry = (payload = {}, skewSeconds = 60) => {
  const seconds = Number(
    payload.expiresIn ||
    payload.expires_in ||
    payload.expires ||
    payload.data?.expiresIn ||
    payload.data?.expires_in ||
    900
  );
  return Date.now() + Math.max(60, seconds - skewSeconds) * 1000;
};

const buildAuthFailureMessage = (error) => {
  const status = error.response?.status;
  const providerMessage = error.response?.data?.message || error.response?.data?.error || error.response?.data?.detail;
  if (status === 403 && /request blocked/i.test(String(providerMessage || ''))) {
    return 'Verto blocked the auth request. For production, confirm the backend outbound IP is whitelisted by Verto, VERTO_ENV matches the key environment, and certificate-based login is enabled.';
  }
  return providerMessage || 'Verto login was rejected. Check VERTO_CLIENT_ID, the full VERTO_API_KEY secret, VERTO_ENV, and certificate-based auth settings.';
};

const encryptApiKey = (apiKey, publicCertificate, enabled = false) => {
  if (!enabled || !publicCertificate) return apiKey;
  const payload = `${apiKey}:${Date.now()}`;
  return crypto.publicEncrypt(
    {
      key: publicCertificate,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha512',
    },
    Buffer.from(payload, 'utf8')
  ).toString('base64');
};

class VertoAuthService {
  getConfig() {
    const config = getVertoConfig();
    const validation = validateVertoConfig(config);
    if (!config.enabled) {
      throw createVertoError('Verto is not enabled on this backend.', 'VERTO_DISABLED', 503);
    }
    if (!validation.ok) {
      throw createVertoError('Verto configuration is incomplete.', 'VERTO_CONFIG_INVALID', 500, {
        errors: validation.errors,
      });
    }
    return config;
  }

  async getAccessToken({ forceRefresh = false } = {}) {
    const config = this.getConfig();
    if (!forceRefresh && tokenCache.token && Date.now() < tokenCache.expiresAt) {
      return tokenCache.token;
    }

    const payload = {
      clientId: config.clientId,
      mode: 'apiKey',
      apiKey: encryptApiKey(config.apiKey, config.publicCertificate, config.encryptApiKey),
    };

    let response;
    try {
      response = await axios.post(`${config.companyBaseUrl}${config.loginPath}`, payload, {
        timeout: config.timeoutMs,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      });
    } catch (error) {
      const status = error.response?.status;
      throw createVertoError(
        buildAuthFailureMessage(error),
        'VERTO_AUTH_REJECTED',
        status && status < 500 ? status : 502,
        {
          providerStatus: status,
          providerCode: error.response?.data?.code,
        }
      );
    }

    const token = extractToken(response.data);
    if (!token) {
      throw createVertoError('Verto login response did not include an access token.', 'VERTO_AUTH_TOKEN_MISSING', 502);
    }

    tokenCache.token = token;
    tokenCache.expiresAt = extractExpiry(response.data, config.tokenSkewSeconds);
    return token;
  }

  clearToken() {
    tokenCache.token = null;
    tokenCache.expiresAt = 0;
  }
}

module.exports = {
  vertoAuthService: new VertoAuthService(),
  createVertoError,
};
