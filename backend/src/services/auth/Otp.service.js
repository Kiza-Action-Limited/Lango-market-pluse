// services/auth/otpService.js
// Unified OTP service supporting both SMS and email with rate limiting and retry logic

const crypto = require('crypto');
const { africaTalkingService } = require('../../config/africastalking');
const { emailService } = require('../../config/email');

// Redis client (optional)
let redis = null;
try {
  const { createClient } = require('redis');
  if (process.env.REDIS_ENABLED === 'true' && process.env.REDIS_URL) {
    redis = createClient({
      url: process.env.REDIS_URL,
      socket: {
        connectTimeout: Number(process.env.REDIS_CONNECT_TIMEOUT_MS || 1000),
        reconnectStrategy: false,
      },
    });
    redis.on('error', () => { redis = null; });
    redis.connect().catch(() => { redis = null; });
  }
} catch {
  // Redis not available
}

// In-memory fallback store
const memStore = new Map();
const memSet = (key, value, ttlSeconds) => {
  memStore.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
};
const memGet = (key) => {
  const entry = memStore.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memStore.delete(key);
    return null;
  }
  return entry.value;
};
const memDel = (key) => memStore.delete(key);

const hasReadyRedis = () => redis?.isReady === true;

const disableRedis = () => {
  const client = redis;
  redis = null;
  try {
    if (client?.isOpen) client.disconnect();
  } catch {
    // Ignore cleanup failures and continue with the in-memory fallback.
  }
};

// Storage helper
const store = {
  async set(key, value, ttlSeconds) {
    if (hasReadyRedis()) {
      try {
        await redis.setEx(key, ttlSeconds, JSON.stringify(value));
        return;
      } catch {
        disableRedis();
      }
    }
    memSet(key, value, ttlSeconds);
  },
  async get(key) {
    if (hasReadyRedis()) {
      try {
        const raw = await redis.get(key);
        return raw ? JSON.parse(raw) : null;
      } catch {
        disableRedis();
      }
    }
    return memGet(key);
  },
  async del(key) {
    if (hasReadyRedis()) {
      try {
        await redis.del(key);
        return;
      } catch {
        disableRedis();
      }
    }
    memDel(key);
  },
};

// Constants
const PHONE_OTP_TTL = 5 * 60;   // 5 minutes
const EMAIL_OTP_TTL = 10 * 60;  // 10 minutes
const VERIFIED_OTP_TTL = 30 * 60; // 30 minutes to finish registration
const MAX_ATTEMPTS = 3;
const MAX_RESENDS = 3;
const RESEND_COOLDOWN = 60;
const isProduction = process.env.NODE_ENV === 'production';
const shouldExposeDevOtp = !isProduction && process.env.OTP_EXPOSE_DEV_CODE === 'true';
const configuredDevTestOtp = String(
  process.env.OTP_DEV_TEST_CODE || process.env.DEV_TEST_OTP_CODE || '123456'
).trim();
const allowDevTestOtp = !isProduction
  && /^\d{6}$/.test(configuredDevTestOtp)
  && process.env.OTP_ENABLE_DEV_TEST_CODE !== 'false';

// Helper functions
const generateCode = () => crypto.randomInt(100000, 999999).toString();

const devOtpFields = (actualCode) => ({
  ...(allowDevTestOtp ? { devTestCode: configuredDevTestOtp } : {}),
  ...(shouldExposeDevOtp ? { devCode: actualCode } : {}),
});

const isDevTestOtp = (code) => allowDevTestOtp && String(code || '').trim() === configuredDevTestOtp;

const getOtpSecret = () => process.env.OTP_HASH_SECRET || process.env.JWT_SECRET || 'lango-market-otp-secret';

const hashOtpCode = (channel, identifier, code) => crypto
  .createHmac('sha256', getOtpSecret())
  .update(`${channel}:${identifier}:${code}`)
  .digest('hex');

const isOtpMatch = (channel, identifier, code, entry = {}) => {
  const expectedHash = entry.codeHash || hashOtpCode(channel, identifier, entry.code || '');
  const providedHash = hashOtpCode(channel, identifier, String(code || '').trim());
  return crypto.timingSafeEqual(Buffer.from(expectedHash), Buffer.from(providedHash));
};

const phoneKey = (phone) => `otp:phone:${phone}`;
const emailKey = (email) => `otp:email:${email.toLowerCase()}`;
const resendKey = (channel, id) => `otp:resend:${channel}:${id}`;
const verifiedKey = (channel, id) => `otp:verified:${channel}:${id}`;

const normalizeIdentifier = (channel, identifier) => {
  if (channel === 'email') return String(identifier || '').trim().toLowerCase();
  if (channel === 'phone') return africaTalkingService.formatPhoneNumber(identifier);
  return String(identifier || '').trim();
};

const markVerifiedOtp = async (channel, identifier) => {
  const normalized = normalizeIdentifier(channel, identifier);
  await store.set(verifiedKey(channel, normalized), {
    verifiedAt: Date.now(),
  }, VERIFIED_OTP_TTL);
};

const hasVerifiedOtp = async (channel, identifier) => {
  const normalized = normalizeIdentifier(channel, identifier);
  return Boolean(await store.get(verifiedKey(channel, normalized)));
};

const consumeVerifiedOtp = async (channel, identifier) => {
  const normalized = normalizeIdentifier(channel, identifier);
  const entry = await store.get(verifiedKey(channel, normalized));
  if (!entry) return false;
  await store.del(verifiedKey(channel, normalized));
  return true;
};

/**
 * Send OTP via SMS
 * @param {string} phone - Phone number
 * @returns {Promise<Object>}
 */
const sendPhoneOtp = async (phone) => {
  const formattedPhone = africaTalkingService.formatPhoneNumber(phone);

  // Validate phone
  if (!formattedPhone || !africaTalkingService.validatePhoneNumber(formattedPhone)) {
    const err = new Error('Invalid phone number format. Use format: 2547XXXXXXXX or 2541XXXXXXXX');
    err.statusCode = 400;
    err.code = 'INVALID_PHONE';
    throw err;
  }

  // Rate limit check
  const resend = await store.get(resendKey('phone', formattedPhone));
  if (resend && resend.count >= MAX_RESENDS) {
    const err = new Error('Too many OTP requests. Please wait 10 minutes.');
    err.statusCode = 429;
    err.code = 'OTP_RATE_LIMITED';
    throw err;
  }

  // Cooldown check
  const cooldownRemaining = await resendCooldownSeconds('phone', formattedPhone);
  if (cooldownRemaining > 0) {
    const err = new Error(`Please wait ${cooldownRemaining} seconds before requesting another code.`);
    err.statusCode = 429;
    err.code = 'OTP_COOLDOWN';
    err.cooldownRemaining = cooldownRemaining;
    throw err;
  }

  const code = generateCode();

  // Store OTP
  await store.set(phoneKey(formattedPhone), {
    codeHash: hashOtpCode('phone', formattedPhone, code),
    attempts: 0,
    createdAt: Date.now(),
  }, PHONE_OTP_TTL);

  // Update resend counter
  await store.set(resendKey('phone', formattedPhone), {
    count: (resend?.count || 0) + 1,
    lastSentAt: Date.now(),
  }, 10 * 60);

  // Send SMS
  try {
    const result = await africaTalkingService.sendOtpSMS(formattedPhone, code);
    return {
      success: true,
      message: 'Verification code sent successfully',
      delivered: true,
      cooldownSeconds: RESEND_COOLDOWN,
      ...devOtpFields(code),
    };
  } catch (error) {
    if (allowDevTestOtp) {
      return {
        success: true,
        message: 'Verification code generated. SMS delivery failed in development mode.',
        delivered: false,
        deliveryError: error.message,
        cooldownSeconds: RESEND_COOLDOWN,
        ...devOtpFields(code),
      };
    }

    await store.del(phoneKey(formattedPhone));
    throw error;
  }
};

/**
 * Verify phone OTP
 * @param {string} phone - Phone number
 * @param {string} code - OTP code
 * @returns {Promise<boolean>}
 */
const verifyPhoneOtp = async (phone, code) => {
  if (!code || !code.match(/^\d{6}$/)) {
    const err = new Error('Invalid code format. Please enter a 6-digit code.');
    err.statusCode = 400;
    err.code = 'INVALID_CODE_FORMAT';
    throw err;
  }

  const formattedPhone = africaTalkingService.formatPhoneNumber(phone);
  if (isDevTestOtp(code)) {
    await markVerifiedOtp('phone', formattedPhone);
    await store.del(phoneKey(formattedPhone));
    await store.del(resendKey('phone', formattedPhone));
    return true;
  }

  const entry = await store.get(phoneKey(formattedPhone));

  if (!entry) {
    const err = new Error('Code expired or not found. Please request a new one.');
    err.statusCode = 400;
    err.code = 'OTP_EXPIRED';
    throw err;
  }

  if (entry.attempts >= MAX_ATTEMPTS) {
    await store.del(phoneKey(formattedPhone));
    const err = new Error('Too many incorrect attempts. Please request a new code.');
    err.statusCode = 400;
    err.code = 'OTP_MAX_ATTEMPTS';
    throw err;
  }

  if (!isOtpMatch('phone', formattedPhone, code, entry)) {
    const newAttempts = entry.attempts + 1;
    await store.set(phoneKey(formattedPhone), {
      ...entry,
      attempts: newAttempts,
    }, PHONE_OTP_TTL);

    const remaining = MAX_ATTEMPTS - newAttempts;
    const err = new Error(
      remaining > 0
        ? `Incorrect code. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`
        : 'Incorrect code. No attempts remaining. Please request a new code.'
    );
    err.statusCode = 400;
    err.code = 'OTP_INVALID';
    err.remainingAttempts = remaining;
    throw err;
  }

  await markVerifiedOtp('phone', formattedPhone);
  await store.del(phoneKey(formattedPhone));
  await store.del(resendKey('phone', formattedPhone));
  return true;
};

/**
 * Send email OTP
 * @param {string} email - Email address
 * @returns {Promise<Object>}
 */
const sendEmailOtpCode = async (email) => {
  const normalized = email.toLowerCase().trim();

  if (!normalized || !normalized.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
    const err = new Error('Invalid email address format.');
    err.statusCode = 400;
    err.code = 'INVALID_EMAIL';
    throw err;
  }

  const resend = await store.get(resendKey('email', normalized));
  if (resend && resend.count >= MAX_RESENDS) {
    const err = new Error('Too many OTP requests. Please wait 10 minutes.');
    err.statusCode = 429;
    err.code = 'OTP_RATE_LIMITED';
    throw err;
  }

  const cooldownRemaining = await resendCooldownSeconds('email', normalized);
  if (cooldownRemaining > 0) {
    const err = new Error(`Please wait ${cooldownRemaining} seconds before requesting another code.`);
    err.statusCode = 429;
    err.code = 'OTP_COOLDOWN';
    err.cooldownRemaining = cooldownRemaining;
    throw err;
  }

  const code = generateCode();
  let delivered = false;
  let deliveryError = null;

  await store.set(emailKey(normalized), {
    codeHash: hashOtpCode('email', normalized, code),
    attempts: 0,
    createdAt: Date.now(),
  }, EMAIL_OTP_TTL);

  await store.set(resendKey('email', normalized), {
    count: (resend?.count || 0) + 1,
    lastSentAt: Date.now(),
  }, 10 * 60);

  try {
    await emailService.sendOtpEmail(normalized, code);
    delivered = true;
  } catch (error) {
    deliveryError = error;
    if (isProduction) {
      await store.del(emailKey(normalized));
      throw error;
    }
  }

  return {
    success: true,
    message: delivered
      ? 'Verification code sent to your email'
      : 'Verification code generated. Email delivery failed in development mode.',
    cooldownSeconds: RESEND_COOLDOWN,
    delivered,
    ...(deliveryError && !isProduction ? { deliveryError: deliveryError.message } : {}),
    ...devOtpFields(code),
  };
};

/**
 * Verify email OTP
 * @param {string} email - Email address
 * @param {string} code - OTP code
 * @returns {Promise<boolean>}
 */
const verifyEmailOtp = async (email, code) => {
  if (!code || !code.match(/^\d{6}$/)) {
    const err = new Error('Invalid code format. Please enter a 6-digit code.');
    err.statusCode = 400;
    err.code = 'INVALID_CODE_FORMAT';
    throw err;
  }

  const normalized = email.toLowerCase().trim();
  if (isDevTestOtp(code)) {
    await markVerifiedOtp('email', normalized);
    await store.del(emailKey(normalized));
    await store.del(resendKey('email', normalized));
    return true;
  }

  const entry = await store.get(emailKey(normalized));

  if (!entry) {
    const err = new Error('Code expired or not found. Please request a new one.');
    err.statusCode = 400;
    err.code = 'OTP_EXPIRED';
    err.identifier = normalized;
    throw err;
  }

  if (entry.attempts >= MAX_ATTEMPTS) {
    await store.del(emailKey(normalized));
    const err = new Error('Too many incorrect attempts. Please request a new code.');
    err.statusCode = 400;
    err.code = 'OTP_MAX_ATTEMPTS';
    throw err;
  }

  if (!isOtpMatch('email', normalized, code, entry)) {
    const newAttempts = entry.attempts + 1;
    await store.set(emailKey(normalized), {
      ...entry,
      attempts: newAttempts,
    }, EMAIL_OTP_TTL);

    const remaining = MAX_ATTEMPTS - newAttempts;
    const err = new Error(
      remaining > 0
        ? `Incorrect code. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`
        : 'Incorrect code. No attempts remaining. Please request a new code.'
    );
    err.statusCode = 400;
    err.code = 'OTP_INVALID';
    err.remainingAttempts = remaining;
    throw err;
  }

  await markVerifiedOtp('email', normalized);
  await store.del(emailKey(normalized));
  await store.del(resendKey('email', normalized));
  return true;
};

/**
 * Get remaining cooldown seconds
 * @param {'phone'|'email'} channel
 * @param {string} identifier
 * @returns {Promise<number>}
 */
const resendCooldownSeconds = async (channel, identifier) => {
  const normalized = normalizeIdentifier(channel, identifier);
  const entry = await store.get(resendKey(channel, normalized));
  if (!entry || !entry.lastSentAt) return 0;
  const elapsed = Math.floor((Date.now() - entry.lastSentAt) / 1000);
  return Math.max(0, RESEND_COOLDOWN - elapsed);
};

/**
 * Clear OTP data
 * @param {string} phone - Phone number (optional)
 * @param {string} email - Email address (optional)
 */
const clearOtpData = async (phone = null, email = null) => {
  if (phone) {
    const formattedPhone = africaTalkingService.formatPhoneNumber(phone);
    await store.del(phoneKey(formattedPhone));
    await store.del(resendKey('phone', formattedPhone));
    await store.del(verifiedKey('phone', formattedPhone));
  }
  if (email) {
    const normalized = email.toLowerCase().trim();
    await store.del(emailKey(normalized));
    await store.del(resendKey('email', normalized));
    await store.del(verifiedKey('email', normalized));
  }
};

module.exports = {
  sendPhoneOtp,
  verifyPhoneOtp,
  sendEmailOtpCode,
  verifyEmailOtp,
  resendCooldownSeconds,
  clearOtpData,
  hasVerifiedOtp,
  consumeVerifiedOtp,
  PHONE_OTP_TTL,
  EMAIL_OTP_TTL,
  VERIFIED_OTP_TTL,
  MAX_ATTEMPTS,
  MAX_RESENDS,
  RESEND_COOLDOWN,
  allowDevTestOtp,
  configuredDevTestOtp,
  emailKey,
  verifiedKey,
};
