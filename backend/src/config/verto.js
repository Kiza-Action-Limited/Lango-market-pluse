const fs = require('fs');
const path = require('path');

const ENVIRONMENTS = new Set(['sandbox', 'production']);

const DEFAULT_HOSTS = {
  sandbox: {
    company: 'https://api-company-sandbox.vertofx.com',
    payment: 'https://api-payment-sandbox.vertofx.com',
    wallet: 'https://api-wallet-sandbox.vertofx.com',
  },
  production: {
    company: 'https://api-company-beta.vertofx.com',
    payment: 'https://api-payment-beta.vertofx.com',
    wallet: 'https://api-wallet-beta.vertofx.com',
  },
};

const trimTrailingSlash = (value) => String(value || '').trim().replace(/\/+$/, '');

const boolEnv = (name, fallback = false) => {
  const value = process.env[name];
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
};

const readSecretMaterial = (inlineName, pathName) => {
  const inline = process.env[inlineName];
  if (inline && String(inline).trim()) {
    return String(inline).replace(/\\n/g, '\n').trim();
  }

  const filePath = process.env[pathName];
  if (!filePath || !String(filePath).trim()) return '';
  const resolved = path.resolve(filePath);
  return fs.readFileSync(resolved, 'utf8').replace(/\\n/g, '\n').trim();
};

const getVertoConfig = () => {
  const env = String(process.env.VERTO_ENV || (process.env.NODE_ENV === 'production' ? 'production' : 'sandbox')).trim().toLowerCase();
  const enabled = boolEnv('VERTO_ENABLED', Boolean(process.env.VERTO_CLIENT_ID && process.env.VERTO_API_KEY));
  const defaults = DEFAULT_HOSTS[env] || DEFAULT_HOSTS.sandbox;
  const publicCertificate = readSecretMaterial('VERTO_PUBLIC_CERTIFICATE', 'VERTO_PUBLIC_CERTIFICATE_PATH');

  const config = {
    enabled,
    env,
    clientId: String(process.env.VERTO_CLIENT_ID || '').trim(),
    apiKey: String(process.env.VERTO_API_KEY || '').trim(),
    companyBaseUrl: trimTrailingSlash(process.env.VERTO_COMPANY_API_BASE_URL || process.env.VERTO_API_BASE_URL || defaults.company),
    paymentBaseUrl: trimTrailingSlash(process.env.VERTO_PAYMENT_API_BASE_URL || defaults.payment),
    walletBaseUrl: trimTrailingSlash(process.env.VERTO_WALLET_API_BASE_URL || defaults.wallet),
    loginPath: process.env.VERTO_LOGIN_PATH || '/users/login',
    paymentCreatePath: process.env.VERTO_PAYMENT_CREATE_PATH || '/payments/create',
    paymentStatusPath: process.env.VERTO_PAYMENT_STATUS_PATH || '/payments/:reference',
    walletsPath: process.env.VERTO_WALLETS_PATH || '/wallets',
    timeoutMs: Number(process.env.VERTO_REQUEST_TIMEOUT_MS || 15000),
    retryAttempts: Number(process.env.VERTO_RETRY_ATTEMPTS || 2),
    tokenSkewSeconds: Number(process.env.VERTO_TOKEN_SKEW_SECONDS || 60),
    webhookUrl: process.env.VERTO_WEBHOOK_URL || '',
    webhookSecret: process.env.VERTO_WEBHOOK_VERIFICATION_SECRET || '',
    publicCertificate,
    privateKey: readSecretMaterial('VERTO_PRIVATE_KEY', 'VERTO_PRIVATE_KEY_PATH'),
    encryptApiKey: boolEnv('VERTO_ENCRYPT_API_KEY', Boolean(publicCertificate)),
    sourceWalletId: process.env.VERTO_SOURCE_WALLET_ID || '',
    targetWalletId: process.env.VERTO_TARGET_WALLET_ID || '',
    targetCompanyId: process.env.VERTO_TARGET_COMPANY_ID || '',
    paymentType: process.env.VERTO_PAYMENT_TYPE || 'WALLET_TO_BUSINESS',
    payoutPaymentType: process.env.VERTO_PAYOUT_PAYMENT_TYPE || 'PAYOUT',
    payoutsEnabled: boolEnv('VERTO_PAYOUTS_ENABLED', true),
    refundsEnabled: boolEnv('VERTO_REFUNDS_ENABLED', false),
    escrowEnabled: boolEnv('VERTO_ESCROW_ENABLED', true),
    splitPayoutsEnabled: boolEnv('VERTO_SPLIT_PAYOUTS_ENABLED', false),
    productionApproved: boolEnv('VERTO_PRODUCTION_APPROVED', false),
  };

  return config;
};

const validateVertoConfig = (config = getVertoConfig()) => {
  const errors = [];

  if (!ENVIRONMENTS.has(config.env)) {
    errors.push('VERTO_ENV must be either sandbox or production.');
  }

  if (!config.enabled) {
    return { ok: true, errors, enabled: false };
  }

  if (!config.clientId) errors.push('VERTO_CLIENT_ID is required when VERTO_ENABLED=true.');
  if (!config.apiKey) errors.push('VERTO_API_KEY is required when VERTO_ENABLED=true.');
  if (/REPLACE_WITH|your_|\.{3,}/i.test(config.apiKey)) errors.push('VERTO_API_KEY must be the full Verto secret, not a placeholder or truncated value.');
  if (!config.companyBaseUrl || !config.paymentBaseUrl) errors.push('Verto company and payment base URLs are required.');
  if (!Number.isFinite(config.timeoutMs) || config.timeoutMs < 1000) errors.push('VERTO_REQUEST_TIMEOUT_MS must be at least 1000.');

  if (config.env === 'sandbox') {
    if (/beta\.vertofx\.com/i.test(config.companyBaseUrl) || /beta\.vertofx\.com/i.test(config.paymentBaseUrl)) {
      errors.push('Sandbox Verto configuration cannot point at beta/production hosts.');
    }
  }

  if (config.env === 'production') {
    if (!config.productionApproved) errors.push('Set VERTO_PRODUCTION_APPROVED=true only after Verto production approval.');
    if (/sandbox/i.test(config.companyBaseUrl) || /sandbox/i.test(config.paymentBaseUrl)) {
      errors.push('Production Verto configuration cannot point at sandbox hosts.');
    }
    if (!config.webhookSecret && !config.publicCertificate) {
      errors.push('Production Verto webhooks require VERTO_WEBHOOK_VERIFICATION_SECRET or VERTO_PUBLIC_CERTIFICATE.');
    }
  }

  return { ok: errors.length === 0, errors, enabled: true };
};

const getSafeVertoConfig = () => {
  const config = getVertoConfig();
  const validation = validateVertoConfig(config);
  return {
    enabled: config.enabled && validation.ok,
    configured: config.enabled,
    environment: config.env,
    hosts: {
      company: config.companyBaseUrl ? new URL(config.companyBaseUrl).host : '',
      payment: config.paymentBaseUrl ? new URL(config.paymentBaseUrl).host : '',
      wallet: config.walletBaseUrl ? new URL(config.walletBaseUrl).host : '',
    },
    capabilities: {
      payments: config.enabled && validation.ok,
      wallets: config.enabled && validation.ok,
      payouts: config.enabled && validation.ok && config.payoutsEnabled,
      refunds: config.enabled && validation.ok && config.refundsEnabled,
      escrow: config.enabled && validation.ok && config.escrowEnabled,
      splitPayouts: config.enabled && validation.ok && config.splitPayoutsEnabled,
    },
    webhookConfigured: Boolean(config.webhookSecret || config.publicCertificate),
    validationErrors: validation.ok ? [] : validation.errors,
  };
};

module.exports = {
  DEFAULT_HOSTS,
  getVertoConfig,
  getSafeVertoConfig,
  validateVertoConfig,
};
