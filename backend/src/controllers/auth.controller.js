const authService = require('../services/auth/auth.service');
const User = require('../models/User.model');
const { validationResult } = require('express-validator');
const fs = require('fs/promises');
const path = require('path');
const { randomUUID } = require('crypto');
const jwt = require('jsonwebtoken');
const { uploadToCloudinary } = require('../config/cloudinary.config');
const { 
  sendPhoneOtp, 
  verifyPhoneOtp, 
  sendEmailOtpCode, 
  verifyEmailOtp,
  resendCooldownSeconds,
  clearOtpData,
  hasVerifiedOtp
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

const buildPublicUploadUrl = (req, relativePath) => {
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  return `${protocol}://${req.get('host')}${relativePath}`;
};

const saveImageLocally = async (req, file, folderName) => {
  const extension = path.extname(file.originalname || '').toLowerCase() || '.png';
  const filename = `${Date.now()}-${randomUUID()}${extension}`;
  const uploadDir = path.join(__dirname, '..', 'uploads', folderName);
  await fs.mkdir(uploadDir, { recursive: true });
  await fs.writeFile(path.join(uploadDir, filename), file.buffer);
  return buildPublicUploadUrl(req, `/uploads/${folderName}/${filename}`);
};

const saveLogoLocally = (req, file) => saveImageLocally(req, file, 'business-logos');

exports.uploadBusinessLogo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Business logo image is required',
        code: 'BUSINESS_LOGO_REQUIRED',
      });
    }

    let logoUrl = null;
    let storage = 'local';

    try {
      const result = await uploadToCloudinary(
        req.file.buffer,
        'business-logos',
        req.file.mimetype
      );
      logoUrl = result.secure_url || result.url;
      storage = 'cloudinary';
    } catch (uploadError) {
      console.warn('Business logo Cloudinary upload failed, using local storage:', uploadError.message);
      logoUrl = await saveLogoLocally(req, req.file);
    }

    return res.status(201).json({
      success: true,
      message: 'Business logo uploaded successfully',
      data: {
        businessLogoUrl: logoUrl,
        storage,
      },
    });
  } catch (error) {
    console.error('Business logo upload error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to upload business logo. Please try again.',
      code: 'BUSINESS_LOGO_UPLOAD_FAILED',
    });
  }
};

exports.uploadProfileImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Profile image is required',
        code: 'PROFILE_IMAGE_REQUIRED',
      });
    }

    let profileImageUrl = null;
    let storage = 'local';

    try {
      const result = await uploadToCloudinary(
        req.file.buffer,
        'profile-images',
        req.file.mimetype
      );
      profileImageUrl = result.secure_url || result.url;
      storage = 'cloudinary';
    } catch (uploadError) {
      console.warn('Profile image Cloudinary upload failed, using local storage:', uploadError.message);
      profileImageUrl = await saveImageLocally(req, req.file, 'profile-images');
    }

    const user = await authService.updateCurrentUser(req.user._id || req.user.id, {
      profileImageUrl,
    });

    return res.status(200).json({
      success: true,
      message: 'Profile image uploaded successfully',
      data: {
        profileImageUrl,
        storage,
        user,
      },
    });
  } catch (error) {
    console.error('Profile image upload error:', error.message);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to upload profile image. Please try again.',
      code: 'PROFILE_IMAGE_UPLOAD_FAILED',
    });
  }
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
      delivered: result.delivered,
      ...(result.devTestCode ? { devTestCode: result.devTestCode } : {}),
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
      ...(result.devTestCode ? { devTestCode: result.devTestCode } : {}),
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
      delivered: result.delivered,
      ...(result.devTestCode ? { devTestCode: result.devTestCode } : {}),
      ...(result.devCode ? { devCode: result.devCode } : {}),
      ...(result.deliveryError ? { deliveryError: result.deliveryError } : {}),
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
      delivered: result.delivered,
      ...(result.devTestCode ? { devTestCode: result.devTestCode } : {}),
      ...(result.devCode ? { devCode: result.devCode } : {}),
      ...(result.deliveryError ? { deliveryError: result.deliveryError } : {}),
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
      delivered: result.delivered,
      ...(result.devTestCode ? { devTestCode: result.devTestCode } : {}),
      ...(result.devCode ? { devCode: result.devCode } : {}),
      ...(result.deliveryError ? { deliveryError: result.deliveryError } : {}),
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
      ...(result.devTestCode ? { devTestCode: result.devTestCode } : {}),
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
      ...(result.devTestCode ? { devTestCode: result.devTestCode } : {}),
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

    if (typeof businessLogoUrl === 'string' && businessLogoUrl.startsWith('data:')) {
      return res.status(400).json({
        success: false,
        message: 'Please re-upload your business logo before registering.',
        code: 'INLINE_BUSINESS_LOGO_NOT_ALLOWED',
      });
    }

    const phoneVerified = await hasVerifiedOtp('phone', phone);
    const emailVerified = await hasVerifiedOtp('email', email);

    if (!emailVerified || !phoneVerified) {
      return res.status(400).json({
        success: false,
        message: 'Please verify your email first, then verify your phone number before completing registration.',
        code: 'CONTACT_NOT_VERIFIED',
      });
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
      isPhoneVerified: phoneVerified,
      isEmailVerified: emailVerified,
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

    if (typeof businessLogoUrl === 'string' && businessLogoUrl.startsWith('data:')) {
      return res.status(400).json({
        success: false,
        message: 'Please re-upload your business logo before registering.',
        code: 'INLINE_BUSINESS_LOGO_NOT_ALLOWED',
      });
    }

    let isPhoneVerified = false;
    let isEmailVerified = false;

    // Verify phone OTP if provided, otherwise accept a recent verified marker.
    if (phoneOtpCode) {
      try {
        await verifyPhoneOtp(phone, phoneOtpCode);
        isPhoneVerified = true;
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: `Phone verification failed: ${error.message}`,
          code: error.code,
        });
      }
    } else if (phone) {
      isPhoneVerified = await hasVerifiedOtp('phone', phone);
    }

    // Verify email OTP if provided, otherwise accept a recent verified marker.
    if (email && emailOtpCode) {
      try {
        await verifyEmailOtp(email, emailOtpCode);
        isEmailVerified = true;
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: `Email verification failed: ${error.message}`,
          code: error.code,
        });
      }
    } else if (email) {
      isEmailVerified = await hasVerifiedOtp('email', email);
    }

    if (!isEmailVerified || !isPhoneVerified) {
      return res.status(400).json({
        success: false,
        message: 'Please verify your email first, then verify your phone number before registering.',
        code: 'CONTACT_NOT_VERIFIED',
      });
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
      isPhoneVerified,
      isEmailVerified,
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
 * Check whether an email belongs to an account.
 */
exports.checkEmailAccount = async (req, res) => {
  try {
    const email = req.body.email || req.query.email;
    const result = await authService.checkEmailAccount(email);

    return res.status(200).json({
      success: true,
      exists: result.exists,
      found: result.exists,
      isRegistered: result.exists,
      email: result.email,
      user: result.user,
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      success: false,
      message: error.message || 'Unable to check email account',
      code: error.code || 'CHECK_EMAIL_FAILED',
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

    if (phone) {
      await sendPhoneOtp(phone);
      return res.status(200).json({
        success: true,
        resetMode: 'otp',
        message: 'Password reset code sent to your phone',
      });
    }

    const result = await authService.requestEmailPasswordReset(email);

    res.status(200).json({
      success: true,
      resetMode: 'link',
      message: result.message,
      delivered: result.delivered,
      ...(result.deliveryError ? { deliveryError: result.deliveryError } : {}),
      ...(result.devResetToken ? { devResetToken: result.devResetToken } : {}),
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
    const {
      phone,
      email,
      code,
      token,
      newPassword,
      password,
    } = req.body;
    const nextPassword = newPassword || password;

    if (token) {
      if (!nextPassword || String(nextPassword).length < 6) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 6 characters',
          code: 'INVALID_PASSWORD',
        });
      }

      await authService.resetPasswordByToken(token, nextPassword);
      return res.status(200).json({
        success: true,
        message: 'Password reset successful',
      });
    }

    const identifier = phone || email;
    
    if (!identifier || !code || !nextPassword) {
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
    
    await authService.setUserPassword(user, nextPassword);
    
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
 * Verify an existing user's email by token or legacy OTP.
 */
exports.verifyEmail = async (req, res) => {
  try {
    const { token, email, code } = req.body;

    if (token) {
      if (!process.env.JWT_SECRET) {
        return res.status(500).json({
          success: false,
          message: 'Email verification is not configured',
          code: 'JWT_SECRET_MISSING',
        });
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.purpose && decoded.purpose !== 'email_verification') {
        return res.status(400).json({
          success: false,
          message: 'Invalid email verification token',
          code: 'INVALID_EMAIL_TOKEN',
        });
      }

      const user = decoded.id
        ? await User.findById(decoded.id)
        : await authService.findUserByEmail(decoded.email);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
          code: 'USER_NOT_FOUND',
        });
      }

      user.isEmailVerified = true;
      await user.save();

      return res.status(200).json({
        success: true,
        message: 'Email verified successfully',
      });
    }

    if (!email || !code) {
      return res.status(400).json({
        success: false,
        message: 'Email and verification code are required',
      });
    }

    await verifyEmailOtp(email, code);
    const user = await authService.findUserByEmail(email);
    if (user && typeof user.save === 'function') {
      user.isEmailVerified = true;
      await user.save();
    }

    return res.status(200).json({
      success: true,
      message: 'Email verified successfully',
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      success: false,
      message: error.message || 'Email verification failed',
      code: error.code || 'EMAIL_VERIFICATION_FAILED',
    });
  }
};

/**
 * Resend verification email/code for an existing account.
 */
exports.resendVerification = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await authService.findUserByEmail(email);

    if (!user) {
      return res.status(200).json({
        success: true,
        message: 'If an account exists, a verification email has been sent.',
      });
    }

    if (user.isEmailVerified) {
      return res.status(200).json({
        success: true,
        message: 'Email is already verified.',
        alreadyVerified: true,
      });
    }

    const result = await sendEmailOtpCode(email);

    return res.status(200).json({
      success: true,
      message: result.message || 'Verification code sent to your email',
      cooldownSeconds: result.cooldownSeconds,
      delivered: result.delivered,
      ...(result.devTestCode ? { devTestCode: result.devTestCode } : {}),
      ...(result.devCode ? { devCode: result.devCode } : {}),
      ...(result.deliveryError ? { deliveryError: result.deliveryError } : {}),
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to resend verification email',
      code: error.code || 'RESEND_VERIFICATION_FAILED',
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
