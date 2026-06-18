const authService = require('../services/auth/auth.service');
const User = require('../models/User.model');
const { validationResult } = require('express-validator');
const { 
  sendPhoneOtp, 
  verifyPhoneOtp, 
  sendEmailOtpCode, 
  verifyEmailOtp,
  resendCooldownSeconds,
  clearOtpData
} = require('../services/auth/Otp.service');

// Redis client for cleanup
let redisClient = null;
try {
  const redis = require('../../config/redis');
  redisClient = redis.redisClient;
} catch (err) {
  console.warn('⚠️ Redis not available');
}

// ============================================
// Helper Functions for Business Type Mapping
// ============================================

/**
 * Map business type to valid enum values based on User Schema
 * Valid enum values: brand, wholesaler, manufacturer, retailer, farmer, small_business, analytics, analystic, logistics
 */
const mapBusinessType = (role, businessType) => {
  // If no business type provided, return null
  if (!businessType) return null;
  
  // First, check if the businessType is already valid
  const validEnumValues = [
    'brand', 'wholesaler', 'manufacturer', 'retailer', 
    'farmer', 'small_business', 'analytics', 'analystic', 'logistics'
  ];
  
  const normalizedInput = businessType.toLowerCase().trim();
  
  // If already valid, return as is
  if (validEnumValues.includes(normalizedInput)) {
    return normalizedInput;
  }
  
  // Mapping from common input values to valid enum values
  const mapping = {
    // Farmer-related mappings
    'farming': 'farmer',
    'organic farming': 'farmer',
    'organic': 'farmer',
    'conventional farming': 'farmer',
    'conventional': 'farmer',
    'mixed farming': 'farmer',
    'mixed': 'farmer',
    'livestock': 'farmer',
    'livestock farming': 'farmer',
    'crops': 'farmer',
    'crop farming': 'farmer',
    'agroforestry': 'farmer',
    'aquaculture': 'farmer',
    'poultry': 'farmer',
    'poultry farming': 'farmer',
    'dairy': 'farmer',
    'dairy farming': 'farmer',
    'horticulture': 'farmer',
    'greenhouse': 'farmer',
    'hydroponics': 'farmer',
    
    // Wholesaler-related mappings
    'wholesale': 'wholesaler',
    'produce wholesale': 'wholesaler',
    'grain wholesale': 'wholesaler',
    'general wholesale': 'wholesaler',
    
    // Retailer-related mappings
    'retail': 'retailer',
    'farm shop': 'retailer',
    'agricultural store': 'retailer',
    'grocery retail': 'retailer',
    'supermarket': 'retailer',
    
    // Brand-related mappings
    'brand': 'brand',
    'product brand': 'brand',
    
    // Manufacturer-related mappings
    'manufacturer': 'manufacturer',
    'processing': 'manufacturer',
    'food processing': 'manufacturer',
    
    // Small business mappings
    'small business': 'small_business',
    'small_business': 'small_business',
    'other business': 'small_business',
    'other_business': 'small_business',
    'sme': 'small_business',
    
    // Analytics mappings
    'analytics': 'analytics',
    'analystic': 'analystic',
    'data analytics': 'analytics',
    'market research': 'analytics',
    
    // Logistics mappings
    'logistics': 'logistics',
    'transport': 'logistics',
    'delivery': 'logistics',
    'shipping': 'logistics',
    'farm transport': 'logistics',
    'cold chain': 'logistics'
  };
  
  // Return mapped value or default based on role
  const mappedValue = mapping[normalizedInput];
  
  if (mappedValue) {
    return mappedValue;
  }
  
  // Default based on role
  if (role === 'farmer') return 'farmer';
  if (role === 'seller') return 'retailer';
  if (role === 'buyer') return null;
  if (role === 'logistics') return 'logistics';
  if (role === 'admin') return null;
  
  // Default fallback
  return 'small_business';
};

// ============================================
// OTP Controllers for main routes (auth.routes.js)
// ============================================

/**
 * Send OTP for phone verification (main route)
 */
exports.sendPhoneVerificationOtp = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }

    const { phone } = req.body;
    const normalizedPhone = String(phone || '').trim();
    const existingUser = await User.findOne({ phone: normalizedPhone }).lean();
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Phone number already exists. Please use another number or sign in.',
        code: 'PHONE_ALREADY_EXISTS',
      });
    }

    const result = await sendPhoneOtp(normalizedPhone);
    
    res.status(200).json({
      success: true,
      message: result.message,
      cooldownSeconds: result.cooldownSeconds,
      ...(result.devCode ? { devCode: result.devCode } : {}),
      ...(result.deliveryError ? { deliveryError: result.deliveryError } : {}),
    });
  } catch (error) {
    console.error('Send phone OTP error:', error.message);
    
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
      code: error.code,
      cooldownRemaining: error.cooldownRemaining,
    });
  }
};

/**
 * Verify phone OTP code (main route)
 */
exports.verifyPhoneOtpCode = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }

    const { phone, code } = req.body;
    await verifyPhoneOtp(phone, code);
    
    res.status(200).json({
      success: true,
      message: 'Phone number verified successfully',
    });
  } catch (error) {
    console.error('Verify phone OTP error:', error.message);
    
    res.status(error.statusCode || 400).json({
      success: false,
      message: error.message,
      code: error.code,
      remainingAttempts: error.remainingAttempts,
      ...(error.identifier && process.env.NODE_ENV !== 'production' ? { identifier: error.identifier } : {}),
    });
  }
};

/**
 * Send OTP for email verification (main route)
 */
exports.sendEmailVerificationOtp = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }

    const { email } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail }).lean();
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Email already exists. Please use another email or sign in.',
        code: 'EMAIL_ALREADY_EXISTS',
      });
    }

    const result = await sendEmailOtpCode(normalizedEmail);
    
    res.status(200).json({
      success: true,
      message: result.message,
      cooldownSeconds: result.cooldownSeconds,
      delivered: result.delivered,
      ...(result.devCode ? { devCode: result.devCode } : {}),
      ...(result.deliveryError ? { deliveryError: result.deliveryError } : {}),
    });
  } catch (error) {
    console.error('Send email OTP error:', error.message);
    
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
      code: error.code,
    });
  }
};

/**
 * Verify email OTP code (main route)
 */
exports.verifyEmailOtpCode = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }

    const { email, code } = req.body;
    await verifyEmailOtp(email, code);
    
    res.status(200).json({
      success: true,
      message: 'Email verified successfully',
    });
  } catch (error) {
    console.error('Verify email OTP error:', error.message);
    
    res.status(error.statusCode || 400).json({
      success: false,
      message: error.message,
      code: error.code,
      remainingAttempts: error.remainingAttempts,
    });
  }
};

/**
 * Get OTP cooldown status
 */
exports.getOtpCooldown = async (req, res) => {
  try {
    const { channel, identifier } = req.params;
    
    if (!channel || !identifier) {
      return res.status(400).json({
        success: false,
        message: 'Channel and identifier are required',
      });
    }

    const cooldownSeconds = await resendCooldownSeconds(channel, identifier);
    
    res.status(200).json({
      success: true,
      cooldownSeconds,
      canResend: cooldownSeconds === 0,
    });
  } catch (error) {
    console.error('Get cooldown error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Resend OTP code (main route)
 */
exports.resendOtpCode = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }

    const { channel, identifier } = req.body;
    
    let result;
    if (channel === 'phone') {
      const normalizedPhone = String(identifier || '').trim();
      const existingUser = await User.findOne({ phone: normalizedPhone }).lean();
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'Phone number already exists. Please use another number or sign in.',
          code: 'PHONE_ALREADY_EXISTS',
        });
      }
      result = await sendPhoneOtp(normalizedPhone);
    } else if (channel === 'email') {
      const normalizedEmail = String(identifier || '').trim().toLowerCase();
      const existingUser = await User.findOne({ email: normalizedEmail }).lean();
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'Email already exists. Please use another email or sign in.',
          code: 'EMAIL_ALREADY_EXISTS',
        });
      }
      result = await sendEmailOtpCode(normalizedEmail);
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid channel. Must be "phone" or "email"',
      });
    }
    
    res.status(200).json({
      success: true,
      message: result.message,
      cooldownSeconds: result.cooldownSeconds,
    });
  } catch (error) {
    console.error('Resend OTP error:', error.message);
    
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
      code: error.code,
      cooldownRemaining: error.cooldownRemaining,
    });
  }
};

// ============================================
// OTP Controllers for v1 routes (step-by-step)
// ============================================

/**
 * Send OTP to phone for v1 step-by-step registration
 */
exports.sendPhoneOtp = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }

    const { phone } = req.body;
    const normalizedPhone = String(phone || '').trim();
    const existingUser = await User.findOne({ phone: normalizedPhone }).lean();
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Phone number already exists. Please use another number or sign in.',
        code: 'PHONE_ALREADY_EXISTS',
      });
    }

    const result = await sendPhoneOtp(normalizedPhone);
    
    res.status(200).json({
      success: true,
      message: result.message,
      cooldownSeconds: result.cooldownSeconds,
      nextStep: '/api/v1/auth/register/phone/verify'
    });
  } catch (error) {
    console.error('Send phone OTP error:', error.message);
    
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
      code: error.code,
      cooldownRemaining: error.cooldownRemaining,
    });
  }
};

/**
 * Verify phone OTP for v1 step-by-step registration
 */
exports.verifyPhoneOtp = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }

    const { phone, code } = req.body;
    await verifyPhoneOtp(phone, code);
    
    res.status(200).json({
      success: true,
      message: 'Phone number verified successfully',
      phoneVerified: true,
      nextStep: '/api/v1/auth/register/email/send'
    });
  } catch (error) {
    console.error('Verify phone OTP error:', error.message);
    
    res.status(error.statusCode || 400).json({
      success: false,
      message: error.message,
      code: error.code,
      remainingAttempts: error.remainingAttempts,
    });
  }
};

/**
 * Resend phone OTP for v1
 */
exports.resendPhoneOtp = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }

    const { phone } = req.body;
    const normalizedPhone = String(phone || '').trim();
    const existingUser = await User.findOne({ phone: normalizedPhone }).lean();
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Phone number already exists. Please use another number or sign in.',
        code: 'PHONE_ALREADY_EXISTS',
      });
    }

    const result = await sendPhoneOtp(normalizedPhone);
    
    res.status(200).json({
      success: true,
      message: 'Verification code resent successfully',
      cooldownSeconds: result.cooldownSeconds,
    });
  } catch (error) {
    console.error('Resend phone OTP error:', error.message);
    
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
      code: error.code,
    });
  }
};

/**
 * Send OTP to email for v1 step-by-step registration
 */
exports.sendEmailOtp = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }

    const { email } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail }).lean();
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Email already exists. Please use another email or sign in.',
        code: 'EMAIL_ALREADY_EXISTS',
      });
    }

    const result = await sendEmailOtpCode(normalizedEmail);
    
    res.status(200).json({
      success: true,
      message: result.message,
      cooldownSeconds: result.cooldownSeconds,
      delivered: result.delivered,
      ...(result.devCode ? { devCode: result.devCode } : {}),
      ...(result.deliveryError ? { deliveryError: result.deliveryError } : {}),
      nextStep: '/api/v1/auth/register/email/verify'
    });
  } catch (error) {
    console.error('Send email OTP error:', error.message);
    
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
      code: error.code,
    });
  }
};

/**
 * Verify email OTP for v1 step-by-step registration
 */
exports.verifyEmailOtp = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }

    const { email, code } = req.body;
    await verifyEmailOtp(email, code);
    
    res.status(200).json({
      success: true,
      message: 'Email verified successfully',
      emailVerified: true,
      nextStep: '/api/v1/auth/register/complete'
    });
  } catch (error) {
    console.error('Verify email OTP error:', error.message);
    
    res.status(error.statusCode || 400).json({
      success: false,
      message: error.message,
      code: error.code,
      remainingAttempts: error.remainingAttempts,
      ...(error.identifier && process.env.NODE_ENV !== 'production' ? { identifier: error.identifier } : {}),
    });
  }
};

/**
 * Resend email OTP for v1
 */
exports.resendEmailOtp = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }

    const { email } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail }).lean();
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Email already exists. Please use another email or sign in.',
        code: 'EMAIL_ALREADY_EXISTS',
      });
    }

    const result = await sendEmailOtpCode(normalizedEmail);
    
    res.status(200).json({
      success: true,
      message: 'Verification code resent successfully',
      cooldownSeconds: result.cooldownSeconds,
      delivered: result.delivered,
      ...(result.devCode ? { devCode: result.devCode } : {}),
      ...(result.deliveryError ? { deliveryError: result.deliveryError } : {}),
    });
  } catch (error) {
    console.error('Resend email OTP error:', error.message);
    
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
      code: error.code,
    });
  }
};

/**
 * Complete registration after both OTPs verified (v1)
 */
exports.completeRegistration = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }

    let { 
      phone, 
      email, 
      password, 
      fullName, 
      role,
      businessType,
      businessName,
      businessLogoUrl 
    } = req.body;

    // Map business type to valid enum value
    businessType = mapBusinessType(role, businessType);

    const result = await authService.register({
      phone,
      password,
      email,
      fullName,
      role,
      businessType,
      businessName,
      businessLogoUrl,
      isPhoneVerified: true,
      isEmailVerified: true,
    });

    // Clear OTP data after successful registration
    if (phone) await clearOtpData(phone);
    if (email) await clearOtpData(null, email);

    res.status(201).json({
      success: true,
      message: 'Registration completed successfully',
      data: result,
    });
  } catch (error) {
    console.error('Complete registration error:', error.message);
    
    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Phone or email already exists',
        code: 'DUPLICATE_USER',
      });
    }

    // Handle validation errors specifically
    if (error.message?.includes('validation failed') || error.message?.includes('enum value')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid business type. Valid types are: brand, wholesaler, manufacturer, retailer, farmer, small_business, analytics, analystic, logistics',
        code: 'INVALID_BUSINESS_TYPE',
      });
    }

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Registration failed',
      code: error.code || 'REGISTRATION_FAILED',
    });
  }
};

// ============================================
// Authentication Controllers (Shared)
// ============================================

/**
 * Register new user (main route - with OTP verification)
 */
exports.register = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }

    let { 
      phone, 
      password, 
      email, 
      fullName, 
      role, 
      businessType, 
      businessName,
      businessLogoUrl,
      phoneOtpCode,
      emailOtpCode
    } = req.body;

    // Map business type to valid enum value
    businessType = mapBusinessType(role, businessType);

    // Verify phone OTP if provided
    if (phoneOtpCode) {
      try {
        await verifyPhoneOtp(phone, phoneOtpCode);
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: `Phone verification failed: ${error.message}`,
          code: error.code,
        });
      }
    }

    // Verify email OTP if provided
    if (email && emailOtpCode) {
      try {
        await verifyEmailOtp(email, emailOtpCode);
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: `Email verification failed: ${error.message}`,
          code: error.code,
        });
      }
    }

    const result = await authService.register({
      phone,
      password,
      email,
      fullName,
      role,
      businessType,
      businessName,
      businessLogoUrl,
      isPhoneVerified: !!phoneOtpCode,
      isEmailVerified: !!(email && emailOtpCode),
    });

    // Clear OTP data after successful registration
    if (phone) await clearOtpData(phone);
    if (email) await clearOtpData(null, email);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: result,
    });
  } catch (error) {
    console.error('Register error:', error.message);
    
    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Phone or email already exists',
        code: 'DUPLICATE_USER',
      });
    }

    // Handle validation errors specifically
    if (error.message?.includes('validation failed') || error.message?.includes('enum value')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid business type. Valid types are: brand, wholesaler, manufacturer, retailer, farmer, small_business, analytics, analystic, logistics',
        code: 'INVALID_BUSINESS_TYPE',
      });
    }

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Registration failed',
      code: error.code || 'REGISTRATION_FAILED',
    });
  }
};

/**
 * Login user
 */
exports.login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }

    const { phone, email, password } = req.body;
    const result = await authService.login({ phone, email, password });
    
    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: result,
    });
  } catch (error) {
    console.error('Login error:', error.message);
    
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Login failed',
      code: error.code || 'LOGIN_FAILED',
    });
  }
};
/**
 * Get current authenticated user
 */
exports.getCurrentUser = async (req, res) => {
  try {
    const user = await authService.getCurrentUser(req.user._id || req.user.id);
    
    res.status(200).json({
      success: true,
      data: { user },
    });
  } catch (error) {
    console.error('Get current user error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Update current authenticated user's profile
 */
exports.updateCurrentUser = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const user = await authService.updateCurrentUser(req.user._id || req.user.id, req.body);

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: { user },
    });
  } catch (error) {
    console.error('Update current user error:', error.message);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Verify KYC documents
 */
exports.verifyKYC = async (req, res) => {
  try {
    const { idNumber, idImageUrl } = req.body;
    const userId = req.user.id;
    
    const result = await authService.verifyKYC(userId, { 
      idNumber, 
      idImageUrl 
    });
    
    res.status(200).json({ 
      success: true, 
      message: 'KYC submitted successfully', 
      data: result 
    });
  } catch (error) {
    console.error('KYC error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Request password reset (sends OTP) - FIXED
 */
exports.forgotPassword = async (req, res) => {
  try {
    const { phone, email } = req.body;
    const identifier = phone || email;
    
    if (!identifier) {
      return res.status(400).json({
        success: false,
        message: 'Phone number or email is required',
      });
    }

    // Send OTP based on identifier type - ONLY THIS, no extra service call
    if (phone) {
      await sendPhoneOtp(phone);
    } else if (email) {
      await sendEmailOtpCode(email);
    }
    
    res.status(200).json({ 
      success: true, 
      message: `Password reset code sent to your ${phone ? 'phone' : 'email'}` 
    });
  } catch (error) {
    console.error('Forgot password error:', error.message);
    
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message,
      code: error.code,
    });
  }
};

/**
 * Reset password with OTP verification - FIXED
 */
exports.resetPassword = async (req, res) => {
  try {
    const { phone, email, code, newPassword } = req.body;
    const identifier = phone || email;
    
    if (!identifier || !code || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Identifier, verification code, and new password are required',
      });
    }

    // Verify OTP based on identifier type
    if (phone) {
      await verifyPhoneOtp(phone, code);
    } else if (email) {
      await verifyEmailOtp(email, code);
    }
    
    // Find user by identifier
    let user;
    if (phone) {
      user = await authService.findUserByPhone(phone);
    } else if (email) {
      user = await authService.findUserByEmail(email);
    }
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        code: 'USER_NOT_FOUND',
      });
    }
    
    // Update password directly
    user.password = newPassword;
    await user.save();
    
    // Clear OTP data after successful reset
    if (phone) await clearOtpData(phone);
    if (email) await clearOtpData(null, email);
    
    // Also clear any legacy reset codes from Redis if they exist
    if (redisClient) {
      await redisClient.del(`reset:${identifier}`);
    }
    
    res.status(200).json({ 
      success: true, 
      message: 'Password reset successful' 
    });
  } catch (error) {
    console.error('Reset password error:', error.message);
    
    res.status(error.statusCode || 400).json({
      success: false,
      message: error.message,
      code: error.code || 'RESET_PASSWORD_FAILED',
      remainingAttempts: error.remainingAttempts,
    });
  }
};

/**
 * Refresh access token
 */
exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required',
      });
    }
    
    const result = await authService.refreshToken(refreshToken);
    
    res.status(200).json({ 
      success: true, 
      data: result 
    });
  } catch (error) {
    console.error('Refresh token error:', error.message);
    
    res.status(error.statusCode || 401).json({
      success: false,
      message: error.message || 'Invalid or expired refresh token',
    });
  }
};

/**
 * Change password with OTP verification
 */
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, otpCode } = req.body;
    const userId = req.user.id;
    const userPhone = req.user.phone;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required',
      });
    }

    // Verify OTP if provided for extra security
    if (otpCode) {
      try {
        await verifyPhoneOtp(userPhone, otpCode);
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: `Verification failed: ${error.message}`,
          code: error.code,
        });
      }
    }
    
    const result = await authService.changePassword(userId, currentPassword, newPassword);
    
    res.status(200).json({
      success: true,
      message: 'Password changed successfully',
      data: result,
    });
  } catch (error) {
    console.error('Change password error:', error.message);
    
    res.status(error.statusCode || 400).json({
      success: false,
      message: error.message,
      code: error.code,
    });
  }
};
