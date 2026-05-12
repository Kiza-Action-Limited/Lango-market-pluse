// services/auth/otpService.js
// Unified OTP service supporting both SMS and email with rate limiting and retry logic

const crypto = require('crypto');
const { africaTalkingService } = require('../../config/africastalking');
const { emailService } = require('../../config/email');

// Redis client (optional)
let redis = null;
try {
  const { createClient } = require('redis');
  redis = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
  redis.on('error', () => { redis = null; });
  redis.connect().catch(() => { redis = null; });
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

// Storage helper
const store = {
  async set(key, value, ttlSeconds) {
    if (redis?.isOpen) {
      await redis.setEx(key, ttlSeconds, JSON.stringify(value));
    } else {
      memSet(key, value, ttlSeconds);
    }
  },
  async get(key) {
    if (redis?.isOpen) {
      const raw = await redis.get(key);
      return raw ? JSON.parse(raw) : null;
    }
    return memGet(key);
  },
  async del(key) {
    if (redis?.isOpen) {
      await redis.del(key);
    } else {
      memDel(key);
    }
  },
};

// Constants
const PHONE_OTP_TTL = 5 * 60;   // 5 minutes
const EMAIL_OTP_TTL = 10 * 60;  // 10 minutes
const MAX_ATTEMPTS = 3;
const MAX_RESENDS = 3;
const RESEND_COOLDOWN = 60;

// Helper functions
const generateCode = () => crypto.randomInt(100000, 999999).toString();

const phoneKey = (phone) => `otp:phone:${phone}`;
const emailKey = (email) => `otp:email:${email.toLowerCase()}`;
const resendKey = (channel, id) => `otp:resend:${channel}:${id}`;

/**
 * Send OTP via SMS
 * @param {string} phone - Phone number
 * @returns {Promise<Object>}
 */
const sendPhoneOtp = async (phone) => {
  // Validate phone
  if (!phone || !africaTalkingService.validatePhoneNumber(phone)) {
    const err = new Error('Invalid phone number format. Use format: 2547XXXXXXXX');
    err.statusCode = 400;
    err.code = 'INVALID_PHONE';
    throw err;
  }

  // Format phone number
  const formattedPhone = africaTalkingService.formatPhoneNumber(phone);

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
    code,
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
      cooldownSeconds: RESEND_COOLDOWN,
    };
  } catch (error) {
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

  if (entry.code !== code.trim()) {
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

  // Success - cleanup
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

  await store.set(emailKey(normalized), {
    code,
    attempts: 0,
    createdAt: Date.now(),
  }, EMAIL_OTP_TTL);

  await store.set(resendKey('email', normalized), {
    count: (resend?.count || 0) + 1,
    lastSentAt: Date.now(),
  }, 10 * 60);

  try {
    await emailService.sendOtpEmail(normalized, code);
    return {
      success: true,
      message: 'Verification code sent to your email',
      cooldownSeconds: RESEND_COOLDOWN,
    };
  } catch (error) {
    await store.del(emailKey(normalized));
    throw error;
  }
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
  const entry = await store.get(emailKey(normalized));

  if (!entry) {
    const err = new Error('Code expired or not found. Please request a new one.');
    err.statusCode = 400;
    err.code = 'OTP_EXPIRED';
    throw err;
  }

  if (entry.attempts >= MAX_ATTEMPTS) {
    await store.del(emailKey(normalized));
    const err = new Error('Too many incorrect attempts. Please request a new code.');
    err.statusCode = 400;
    err.code = 'OTP_MAX_ATTEMPTS';
    throw err;
  }

  if (entry.code !== code.trim()) {
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
  const entry = await store.get(resendKey(channel, identifier));
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
  }
  if (email) {
    const normalized = email.toLowerCase().trim();
    await store.del(emailKey(normalized));
    await store.del(resendKey('email', normalized));
  }
};

module.exports = {
  sendPhoneOtp,
  verifyPhoneOtp,
  sendEmailOtpCode,
  verifyEmailOtp,
  resendCooldownSeconds,
  clearOtpData,
  PHONE_OTP_TTL,
  EMAIL_OTP_TTL,
  MAX_ATTEMPTS,
  MAX_RESENDS,
  RESEND_COOLDOWN,
};