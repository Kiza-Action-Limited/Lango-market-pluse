// config/validate.js
// Environment configuration validation

const requiredEnvVars = {
  // Email configuration
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  
  // Africa's Talking configuration
  AT_API_KEY: process.env.AT_API_KEY,
  AT_USERNAME: process.env.AT_USERNAME,
};

const validateConfig = () => {
  const missing = [];
  
  for (const [key, value] of Object.entries(requiredEnvVars)) {
    if (!value) {
      missing.push(key);
    }
  }
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  
  console.log('✅ Configuration validation passed');
  return true;
};

// Middleware and validation rules
const { validationResult } = require('express-validator');

/**
 * Middleware to validate request using express-validator rules.
 * Usage: Place after validation rules in route.
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(err => ({
        field: err.param,
        message: err.msg,
      })),
    });
  }
  next();
};

/**
 * Common validation rules for IDs, pagination, etc.
 */
const commonValidations = {
  mongoId: (field = 'id') => ({
    in: ['params', 'body'],
    isMongoId: { errorMessage: `Invalid ${field} format` },
  }),
  pagination: () => [
    { in: ['query'], optional: true, isInt: { min: 1 }, errorMessage: 'Page must be a positive integer' },
    { in: ['query'], optional: true, isInt: { min: 1, max: 100 }, errorMessage: 'Limit must be between 1 and 100' },
  ],
  phone: () => ({
    isMobilePhone: { options: ['any'], errorMessage: 'Invalid phone number format' },
  }),
};

module.exports = {
  validateConfig,
  validate,
  commonValidations,
};