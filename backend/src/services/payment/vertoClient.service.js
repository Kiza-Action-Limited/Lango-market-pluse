const axios = require('axios');
const { vertoAuthService, createVertoError } = require('./vertoAuth.service');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class VertoClientService {
  async request({ baseUrl, method = 'GET', path, data, params, idempotencyKey, attempt = 0 }) {
    const config = vertoAuthService.getConfig();
    const token = await vertoAuthService.getAccessToken({ forceRefresh: attempt > 0 });

    try {
      const response = await axios({
        method,
        url: `${baseUrl}${path}`,
        data,
        params,
        timeout: config.timeoutMs,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
        },
      });

      return response.data;
    } catch (error) {
      const status = error.response?.status;
      const shouldRetry = [401, 408, 429, 500, 502, 503, 504].includes(status) && attempt < config.retryAttempts;

      if (status === 401) {
        vertoAuthService.clearToken();
      }

      if (shouldRetry) {
        await sleep(500 * Math.pow(2, attempt));
        return this.request({ baseUrl, method, path, data, params, idempotencyKey, attempt: attempt + 1 });
      }

      throw createVertoError(
        error.response?.data?.message ||
          error.response?.data?.error ||
          error.response?.data?.detail ||
          `Verto ${method.toUpperCase()} ${path} failed${status ? ` with HTTP ${status}` : ''}.`,
        'VERTO_PROVIDER_REQUEST_FAILED',
        status && status < 500 ? status : 502,
        {
          providerStatus: status,
          providerCode: error.response?.data?.code,
        }
      );
    }
  }
}

module.exports = new VertoClientService();
