const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const authController = require('../../controllers/auth.controller');
const { protect } = require('../../middleware/auth');

// ============================================
// Step-by-Step Registration Routes (v1)
// ============================================

// Send OTP to phone (Step 1)
router.post(
  '/register/phone/send',
  [
    body('phone').notEmpty().withMessage('Phone number is required'),
  ],
  authController.sendPhoneOtp
);

// Verify phone OTP (Step 2)
router.post(
  '/register/phone/verify',
  [
    body('phone').notEmpty().withMessage('Phone number is required'),
    body('code').isLength({ min: 6, max: 6 }).withMessage('Valid 6-digit code is required'),
  ],
  authController.verifyPhoneOtp
);

// Resend phone OTP
router.post(
  '/register/phone/resend',
  [
    body('phone').notEmpty().withMessage('Phone number is required'),
  ],
  authController.resendPhoneOtp
);

// Send OTP to email (Step 3)
router.post(
  '/register/email/send',
  [
    body('email').isEmail().withMessage('Valid email address is required'),
  ],
  authController.sendEmailOtp
);

// Verify email OTP (Step 4)
router.post(
  '/register/email/verify',
  [
    body('email').isEmail().withMessage('Valid email address is required'),
    body('code').isLength({ min: 6, max: 6 }).withMessage('Valid 6-digit code is required'),
  ],
  authController.verifyEmailOtp
);

// Resend email OTP
router.post(
  '/register/email/resend',
  [
    body('email').isEmail().withMessage('Valid email address is required'),
  ],
  authController.resendEmailOtp
);

// Complete registration (Step 5) - FIXED: This route was missing
router.post(
  '/register/complete',
  [
    body('phone').notEmpty().withMessage('Phone number is required'),
    body('email').isEmail().withMessage('Valid email address is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('fullName').notEmpty().withMessage('Full name is required'),
    body('role').isIn(['farmer', 'buyer', 'vendor', 'admin', 'seller', 'logistics']).withMessage('Invalid role'),
    body('businessType').optional(),
    body('businessLogoUrl').optional().isURL().withMessage('Valid URL is required for business logo'),
  ],
  authController.completeRegistration
);

// ============================================
// OTP Routes (Public) - RESTful style
// ============================================

// Send OTP for phone verification
router.post(
  '/otp/phone/send',
  [
    body('phone').notEmpty().withMessage('Phone number is required'),
  ],
  authController.sendPhoneVerificationOtp
);

// Verify phone OTP
router.post(
  '/otp/phone/verify',
  [
    body('phone').notEmpty().withMessage('Phone number is required'),
    body('code').isLength({ min: 6, max: 6 }).withMessage('Valid 6-digit code is required'),
  ],
  authController.verifyPhoneOtpCode
);

// Send OTP for email verification
router.post(
  '/otp/email/send',
  [
    body('email').isEmail().withMessage('Valid email address is required'),
  ],
  authController.sendEmailVerificationOtp
);

// Verify email OTP
router.post(
  '/otp/email/verify',
  [
    body('email').isEmail().withMessage('Valid email address is required'),
    body('code').isLength({ min: 6, max: 6 }).withMessage('Valid 6-digit code is required'),
  ],
  authController.verifyEmailOtpCode
);

// Get OTP cooldown status
router.get('/otp/cooldown/:channel/:identifier', authController.getOtpCooldown);

// Resend OTP code
router.post(
  '/otp/resend',
  [
    body('channel').isIn(['phone', 'email']).withMessage('Channel must be phone or email'),
    body('identifier').notEmpty().withMessage('Identifier is required'),
  ],
  authController.resendOtpCode
);

// ============================================
// Legacy OTP Routes (Backward Compatibility)
// ============================================

// Send OTP for phone verification (legacy)
router.post(
  '/send-phone-otp',
  [
    body('phone').notEmpty().withMessage('Phone number is required'),
  ],
  authController.sendPhoneVerificationOtp
);

// Verify phone OTP (legacy)
router.post(
  '/verify-phone',
  [
    body('phone').notEmpty().withMessage('Phone number is required'),
    body('code').isLength({ min: 6, max: 6 }).withMessage('Valid 6-digit code is required'),
  ],
  authController.verifyPhoneOtpCode
);

router.post(
  '/verify-phone-otp',
  [
    body('phone').notEmpty().withMessage('Phone number is required'),
    body('code').isLength({ min: 6, max: 6 }).withMessage('Valid 6-digit code is required'),
  ],
  authController.verifyPhoneOtpCode
);

// Send OTP for email verification (legacy)
router.post(
  '/send-email-otp',
  [
    body('email').isEmail().withMessage('Valid email address is required'),
  ],
  authController.sendEmailVerificationOtp
);

// Verify email OTP (legacy)
router.post(
  '/verify-email',
  [
    body('email').isEmail().withMessage('Valid email address is required'),
    body('code').isLength({ min: 6, max: 6 }).withMessage('Valid 6-digit code is required'),
  ],
  authController.verifyEmailOtpCode
);

router.post(
  '/verify-email-otp',
  [
    body('email').isEmail().withMessage('Valid email address is required'),
    body('code').isLength({ min: 6, max: 6 }).withMessage('Valid 6-digit code is required'),
  ],
  authController.verifyEmailOtpCode
);

// Legacy cooldown route
router.get('/cooldown/:channel/:identifier', authController.getOtpCooldown);

// Legacy resend OTP
router.post(
  '/resend-otp',
  [
    body('channel').isIn(['phone', 'email']).withMessage('Channel must be phone or email'),
    body('identifier').notEmpty().withMessage('Identifier is required'),
  ],
  authController.resendOtpCode
);

// ============================================
// Authentication Routes
// ============================================

// Register new user (single-step)
router.post(
  '/register',
  [
    body('phone').notEmpty().withMessage('Phone number is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('email').optional().isEmail().withMessage('Valid email address is required'),
    body('fullName').notEmpty().withMessage('Full name is required'),
    body('role').isIn(['farmer', 'buyer', 'vendor', 'admin', 'seller', 'logistics']).withMessage('Invalid role'),
  ],
  authController.register
);

// Login
router.post(
  '/login',
  [
    body('password').notEmpty().withMessage('Password is required'),
  ],
  authController.login
);

// Forgot password
router.post(
  '/forgot-password',
  [
    body('phone').optional(),
    body('email').optional(),
    body().custom(value => {
      if (!value.phone && !value.email) {
        throw new Error('Either phone or email is required');
      }
      return true;
    }),
  ],
  authController.forgotPassword
);

// Reset password
router.post(
  '/reset-password',
  [
    body('code').isLength({ min: 6, max: 6 }).withMessage('Valid 6-digit code is required'),
    body('newPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ],
  authController.resetPassword
);

// Refresh token
router.post(
  '/refresh-token',
  [
    body('refreshToken').notEmpty().withMessage('Refresh token is required'),
  ],
  authController.refreshToken
);

// ============================================
// Protected Routes (Requires Authentication)
// ============================================

// Get current user
router.get('/me', protect, authController.getCurrentUser);

// Change password
router.post(
  '/change-password',
  protect,
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
    body('otpCode').optional().isLength({ min: 6, max: 6 }),
  ],
  authController.changePassword
);

// Submit KYC
router.post(
  '/kyc',
  protect,
  [
    body('idNumber').notEmpty().withMessage('ID number is required'),
    body('idImageUrl').isURL().withMessage('Valid image URL is required'),
  ],
  authController.verifyKYC
);

module.exports = router;