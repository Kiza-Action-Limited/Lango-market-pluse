// config/africastalking.js
// Professional Africa's Talking SMS service with retry logic, queue support, and delivery reports

const axios = require('axios');
const logger = require('../utils/logger');

const envValue = (value) => String(value || '').trim();

const normalizeEnvironment = (value) => {
  const normalized = envValue(value).toLowerCase();
  return normalized === 'production' || normalized === 'live' ? 'production' : 'sandbox';
};

const resolveEnvironment = () => {
  const explicitEnvironment = envValue(process.env.AFRICASTALKING_ENV || process.env.AT_ENV);
  if (explicitEnvironment) return normalizeEnvironment(explicitEnvironment);

  const username = envValue(process.env.AFRICASTALKING_USERNAME || process.env.AT_USERNAME).toLowerCase();
  return username && username !== 'sandbox' ? 'production' : 'sandbox';
};

const maskSecret = (value) => {
  const secret = envValue(value);
  if (!secret) return '';
  if (secret.length <= 10) return `${secret.slice(0, 2)}...`;
  return `${secret.slice(0, 8)}...${secret.slice(-4)}`;
};

const buildSmsError = (message, statusCode, code) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
};

class AfricaTalkingService {
  constructor() {
    this.environment = resolveEnvironment();
    this.baseURL = this.environment === 'production'
      ? 'https://api.africastalking.com/version1'
      : 'https://api.sandbox.africastalking.com/version1';
    this.apiKey = envValue(process.env.AFRICASTALKING_API_KEY || process.env.AT_API_KEY);
    this.username = envValue(process.env.AFRICASTALKING_USERNAME || process.env.AT_USERNAME);
    this.senderId = envValue(process.env.AFRICASTALKING_SENDER_ID || process.env.AT_SENDER_ID);
    this.otpSenderId = envValue(process.env.AFRICASTALKING_OTP_SENDER_ID || process.env.OTP_SMS_SENDER_ID) || this.senderId;
    this.productName = envValue(process.env.AFRICASTALKING_PRODUCT_NAME) || 'Lango Market Pulse';
    this.isInitialized = false;
    
    // Rate limiting configuration
    this.rateLimit = 10;
    this.requestQueue = [];
    this.processing = false;
  }

  /**
   * Validate configuration
   */
  initialize() {
    if (!this.apiKey || !this.username) {
      logger.error('Africa\'s Talking credentials missing', {
        hasApiKey: Boolean(this.apiKey),
        hasUsername: Boolean(this.username),
        environment: this.environment,
      });
      throw buildSmsError(
        'SMS provider is not configured. Please contact support.',
        503,
        'SMS_PROVIDER_NOT_CONFIGURED'
      );
    }

    if (this.environment === 'sandbox' && this.username !== 'sandbox') {
      logger.error('Africa\'s Talking sandbox username mismatch', {
        username: this.username,
        environment: this.environment,
      });
      throw buildSmsError(
        'SMS provider sandbox credentials are mismatched. Please contact support.',
        503,
        'SMS_PROVIDER_CONFIG_MISMATCH'
      );
    }

    if (this.environment === 'production' && this.username === 'sandbox') {
      logger.error('Africa\'s Talking production environment cannot use sandbox username');
      throw buildSmsError(
        'SMS provider production credentials are mismatched. Please contact support.',
        503,
        'SMS_PROVIDER_CONFIG_MISMATCH'
      );
    }
    
    logger.info('Africa\'s Talking service initialized', {
      username: this.username,
      senderId: this.getSenderId(this.senderId) || 'default',
      otpSenderId: this.getSenderId(this.otpSenderId) || 'default',
      environment: this.environment,
      apiKey: maskSecret(this.apiKey),
    });
    
    this.isInitialized = true;
    return true;
  }

  /**
   * Process queued SMS requests with rate limiting
   */
  async processQueue() {
    if (this.processing || this.requestQueue.length === 0) return;
    
    this.processing = true;
    
    while (this.requestQueue.length > 0) {
      const { to, message, options, resolve, reject } = this.requestQueue.shift();
      
      try {
        const result = await this.sendSMSDirect(to, message, options);
        resolve(result);
      } catch (error) {
        reject(error);
      }
      
      // Rate limiting: wait 100ms between sends (10 per second)
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    this.processing = false;
  }

  /**
   * Send SMS with queue support
   */
  async sendSMS(to, message, options = {}) {
    this.initialize();
    
    // Validate phone numbers and format them
    const recipients = Array.isArray(to) ? to : [to];
    const formattedNumbers = recipients.map(num => this.formatPhoneNumber(num));
    
    // Validate each phone number
    for (const recipient of formattedNumbers) {
      if (!this.validatePhoneNumber(recipient)) {
        throw new Error(`Invalid phone number format: ${recipient}. Use format: 2547XXXXXXXX`);
      }
    }
    
    // Validate message
    if (!message || message.length > 1600) {
      throw new Error('Message must be between 1 and 1600 characters');
    }
    
    // Return promise that will be queued
    return new Promise((resolve, reject) => {
      this.requestQueue.push({
        to: formattedNumbers.join(','),
        message,
        options,
        resolve,
        reject
      });
      
      this.processQueue();
    });
  }

  /**
   * Direct SMS sending (without queue) - FIXED VERSION
   */
  async sendSMSDirect(to, message, options = {}) {
    const formattedRecipients = to.split(',').map(num => this.formatPhoneNumber(num));
    for (const recipient of formattedRecipients) {
      if (!this.validatePhoneNumber(recipient)) {
        throw buildSmsError(
          `Invalid phone number format: ${recipient}. Use format: 2547XXXXXXXX or 2541XXXXXXXX`,
          400,
          'INVALID_PHONE'
        );
      }
    }
    const numbers = formattedRecipients.join(',');
    
    // Prepare data according to Africa's Talking API spec
    const senderId = this.getSenderId(options.senderId || options.from || this.senderId);
    
    // Only include from parameter if it's not 'sandbox' or empty
    const data = {
      username: this.username,
      to: numbers,
      message: message,
    };
    
    if (senderId) {
      data.from = senderId;
    }

    logger.info(`Sending SMS to ${numbers}`, { 
      messageLength: message.length,
      senderId: data.from || 'default'
    });

    try {
      const response = await axios({
        method: 'post',
        url: `${this.baseURL}/messaging`,
        data: new URLSearchParams(data),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'apiKey': this.apiKey,
          'Accept': 'application/json',
        },
        timeout: 30000,
      });
      
      const result = response.data;
      
      // Parse the response correctly
      let messageId = null;
      let status = null;
      let cost = null;
      
      if (result.SMSMessageData && result.SMSMessageData.Recipients) {
        const recipients = result.SMSMessageData.Recipients;
        if (recipients.length > 0) {
          messageId = recipients[0].messageId;
          status = recipients[0].status;
          cost = recipients[0].cost;
        }
      }
      
      logger.info('SMS sent successfully', {
        to: numbers,
        messageId: messageId,
        status: status,
        cost: cost,
        fullResponse: result
      });
      
      return {
        success: true,
        data: result.SMSMessageData,
        recipients: result.SMSMessageData?.Recipients || [],
        messageId: messageId,
        status: status,
        cost: cost
      };
    } catch (error) {
      const errorDetails = error.response?.data || error.message || error.code || 'Unknown SMS provider error';
      const statusCode = error.response?.status;
      
      logger.error('SMS sending failed:', {
        to: numbers,
        error: errorDetails,
        statusCode: statusCode,
        provider: 'africastalking',
        environment: this.environment,
      });
      
      // Provide more specific error messages
      if (statusCode === 401) {
        throw buildSmsError(
          'SMS provider authentication failed. Please contact support.',
          503,
          'SMS_PROVIDER_AUTH_FAILED'
        );
      } else if (statusCode === 403) {
        throw buildSmsError(
          'SMS provider rejected the request. Please contact support.',
          503,
          'SMS_PROVIDER_FORBIDDEN'
        );
      } else if (statusCode === 400) {
        throw buildSmsError(
          `Invalid SMS request: ${typeof errorDetails === 'string' ? errorDetails : JSON.stringify(errorDetails)}`,
          400,
          'SMS_PROVIDER_BAD_REQUEST'
        );
      } else {
        throw buildSmsError(
          `SMS delivery failed: ${typeof errorDetails === 'string' ? errorDetails : JSON.stringify(errorDetails)}`,
          502,
          'SMS_PROVIDER_DELIVERY_FAILED'
        );
      }
    }
  }

  /**
   * Send OTP via SMS - FIXED for proper phone number formatting
   */
  async sendOtpSMS(phone, code, expiresIn = 5) {
    // Format phone number first
    const formattedPhone = this.formatPhoneNumber(phone);
    
    // Validate phone number format (must be 2547XXXXXXXX or 2541XXXXXXXX)
    if (!this.validatePhoneNumber(formattedPhone)) {
      throw new Error(`Invalid phone number: ${phone}. Must be in format 2547XXXXXXXX or 2541XXXXXXXX`);
    }
    
    const message = `Your verification code is ${code}. Valid for ${expiresIn} minutes. Never share this code with anyone. ${this.productName}`;
    
    logger.info(`Sending OTP SMS to ${formattedPhone}`, { codeLength: code.length });
    
    const result = await this.sendSMS(formattedPhone, message, {
      senderId: this.otpSenderId,
      purpose: 'signup_phone_verification',
    });
    
    logger.info(`OTP SMS sent to ${formattedPhone}`, {
      messageId: result.messageId,
      status: result.status
    });
    
    return result;
  }

  /**
   * Send market alert SMS
   */
  async sendMarketAlert(phone, alertType, data) {
    const formattedPhone = this.formatPhoneNumber(phone);
    let message = '';
    
    switch(alertType) {
      case 'price_update':
        message = `💰 Price Alert: ${data.product} now at ${data.price} ${data.currency}. ${data.location}. Reply STOP to unsubscribe.`;
        break;
      case 'stock_alert':
        message = `📦 Stock Alert: ${data.product} ${data.status} at ${data.location}. ${data.quantity} units available.`;
        break;
      case 'promotion':
        message = `🎉 Special Offer: ${data.title}! ${data.description}. Valid until ${data.expiry}. ${this.productName}`;
        break;
      default:
        message = `${this.productName}: ${data.message}`;
    }
    
    return this.sendSMS(formattedPhone, message);
  }

  /**
   * Check account balance
   */
  async checkBalance() {
    this.initialize();
    
    try {
      const response = await axios({
        method: 'get',
        url: `${this.baseURL}/user`,
        headers: {
          'apiKey': this.apiKey,
          'Accept': 'application/json',
        },
        params: { username: this.username },
        timeout: 10000,
      });
      
      const balance = response.data;
      logger.info('Balance checked', { 
        balance: balance.UserData?.balance,
        currency: balance.UserData?.currencyCode 
      });
      
      return {
        success: true,
        balance: balance.UserData?.balance,
        currency: balance.UserData?.currencyCode || 'KES',
        data: balance,
      };
    } catch (error) {
      const errorDetails = error.response?.data || error.message || error.code || 'Unknown SMS provider error';
      const statusCode = error.response?.status;
      logger.error('Balance check failed:', {
        error: errorDetails,
        statusCode,
        provider: 'africastalking',
        environment: this.environment,
      });

      if (statusCode === 401) {
        throw buildSmsError(
          'SMS provider authentication failed. Please contact support.',
          503,
          'SMS_PROVIDER_AUTH_FAILED'
        );
      }

      throw buildSmsError(
        `Failed to fetch SMS balance: ${typeof errorDetails === 'string' ? errorDetails : JSON.stringify(errorDetails)}`,
        statusCode === 400 ? 400 : 502,
        'SMS_PROVIDER_BALANCE_FAILED'
      );
    }
  }

  /**
   * Fetch delivery reports for sent messages
   */
  async fetchDeliveryReports(date = null) {
    this.initialize();
    
    try {
      const params = { username: this.username };
      if (date) params.date = date;
      
      const response = await axios({
        method: 'get',
        url: `${this.baseURL}/messaging/delivery-reports`,
        headers: {
          'apiKey': this.apiKey,
          'Accept': 'application/json',
        },
        params,
        timeout: 15000,
      });
      
      return {
        success: true,
        reports: response.data.DeliveryReports || [],
        data: response.data,
      };
    } catch (error) {
      logger.error('Failed to fetch delivery reports:', error.message);
      throw new Error(`Failed to fetch delivery reports: ${error.message}`);
    }
  }

  /**
   * Validate phone number format - Supports 2547 and 2541 formats
   */
  validatePhoneNumber(phone) {
    const cleaned = phone.toString().replace(/\D/g, '');
    
    // Check for exact 12 digits starting with 254
    // 2547XXXXXXXX (Safaricom)
    // 2541XXXXXXXX (Airtel/Telkom)
    const pattern = /^254[17]\d{8}$/;
    
    const isValid = pattern.test(cleaned);
    
    if (!isValid) {
      logger.warn(`Invalid phone number: ${phone} (cleaned: ${cleaned}) - Expected format: 254XXXXXXXXX`);
    }
    
    return isValid;
  }

  /**
   * Format phone number to E.164 format (254XXXXXXXXX)
   */
  formatPhoneNumber(phone) {
    let cleaned = String(phone || '').replace(/\D/g, '');

    if (cleaned.startsWith('2540')) {
      cleaned = `254${cleaned.slice(4)}`;
    } else if (cleaned.startsWith('0')) {
      cleaned = `254${cleaned.slice(1)}`;
    } else if (/^[17]\d{8}$/.test(cleaned)) {
      cleaned = `254${cleaned}`;
    }
    
    logger.debug(`Formatted phone: ${phone} -> ${cleaned}`);
    return cleaned;
  }

  getSenderId(senderId) {
    const normalized = envValue(senderId);
    if (!normalized || normalized.toLowerCase() === 'sandbox') return '';
    if (this.environment === 'sandbox') return '';
    return normalized;
  }

  /**
   * Test connection and configuration
   */
  async testConnection() {
    try {
      this.initialize();
      const balance = await this.checkBalance();
      return {
        success: true,
        message: 'Africa\'s Talking connection successful',
        balance: balance.balance,
        senderId: this.senderId,
        otpSenderId: this.otpSenderId,
        environment: this.environment
      };
    } catch (error) {
      return {
        success: false,
        message: `Connection failed: ${error.message}`,
      };
    }
  }
}

// Export singleton instance
const africaTalkingService = new AfricaTalkingService();

// Backward compatibility functions
const sendSMS = async (to, message) => africaTalkingService.sendSMS(to, message);
const sendOtpSMS = async (phone, code, expiresIn) => africaTalkingService.sendOtpSMS(phone, code, expiresIn);
const checkBalance = () => africaTalkingService.checkBalance();
const fetchDeliveryReports = (date) => africaTalkingService.fetchDeliveryReports(date);
const formatPhoneNumber = (phone) => africaTalkingService.formatPhoneNumber(phone);

module.exports = {
  AfricaTalkingService,
  africaTalkingService,
  sendSMS,
  sendOtpSMS,
  checkBalance,
  fetchDeliveryReports,
  formatPhoneNumber,
};
