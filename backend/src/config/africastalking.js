// config/africastalking.js
// Professional Africa's Talking SMS service with retry logic, queue support, and delivery reports

const axios = require('axios');
const logger = require('../utils/logger');

class AfricaTalkingService {
  constructor() {
    this.baseURL = 'https://api.sandbox.africastalking.com/version1';
    this.apiKey = process.env.AFRICASTALKING_API_KEY;
    this.username = process.env.AFRICASTALKING_USERNAME;
    this.senderId = process.env.AFRICASTALKING_SENDER_ID || 'LangoMarket';
    this.productName = process.env.AFRICASTALKING_PRODUCT_NAME || 'Lango Market Pulse';
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
      const errorMsg = `Africa's Talking credentials missing. 
        API Key: ${!!this.apiKey}, Username: ${!!this.username}
        Check AFRICASTALKING_API_KEY and AFRICASTALKING_USERNAME in .env`;
      console.error(errorMsg);
      throw new Error('Africa\'s Talking credentials missing');
    }
    
    this.isInitialized = true;
    logger.info('Africa\'s Talking service initialized', {
      username: this.username,
      senderId: this.senderId,
      environment: 'sandbox'
    });
    
    return true;
  }

  /**
   * Process queued SMS requests with rate limiting
   */
  async processQueue() {
    if (this.processing || this.requestQueue.length === 0) return;
    
    this.processing = true;
    
    while (this.requestQueue.length > 0) {
      const { to, message, resolve, reject } = this.requestQueue.shift();
      
      try {
        const result = await this.sendSMSDirect(to, message);
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
  async sendSMSDirect(to, message) {
    // Format phone numbers - ensure they start with 254
    const numbers = to.split(',').map(num => {
      let cleaned = num.toString().replace(/\D/g, '');
      // Remove leading 0 or +254 and ensure 254 format
      if (cleaned.startsWith('0')) {
        cleaned = '254' + cleaned.substring(1);
      } else if (cleaned.startsWith('254')) {
        cleaned = cleaned;
      } else if (cleaned.length === 9) {
        cleaned = '254' + cleaned;
      }
      return cleaned;
    }).join(',');
    
    // Prepare data according to Africa's Talking API spec
    const data = {
      username: this.username,
      to: numbers,
      message: message,
      from: this.senderId,
    };

    logger.info(`Sending SMS to ${numbers}`, { messageLength: message.length });

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
      const errorDetails = error.response?.data || error.message;
      logger.error('SMS sending failed:', {
        to: numbers,
        error: errorDetails,
        statusCode: error.response?.status,
        fullError: error
      });
      
      if (error.response?.status === 401) {
        throw new Error('Authentication failed. Check your API key and username.');
      } else if (error.response?.status === 403) {
        throw new Error('Insufficient balance. Please top up your Africa\'s Talking account.');
      } else {
        throw new Error(`SMS delivery failed: ${JSON.stringify(errorDetails)}`);
      }
    }
  }

  /**
   * Send OTP via SMS - FIXED for 25411 or 25476 numbers
   */
  async sendOtpSMS(phone, code, expiresIn = 5) {
    // Format phone number first
    const formattedPhone = this.formatPhoneNumber(phone);
    
    // Validate phone number supports both 25411 and 25476
    if (!this.validatePhoneNumber(formattedPhone)) {
      throw new Error(`Invalid phone number: ${phone}. Must be 25411XXXXXX or 25476XXXXXX format`);
    }
    
    const message = `Your verification code is ${code}. Valid for ${expiresIn} minutes. Never share this code with anyone. ${this.productName}`;
    
    logger.info(`Sending OTP SMS to ${formattedPhone}`, { codeLength: code.length });
    
    const result = await this.sendSMS(formattedPhone, message);
    
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
        url: `${this.baseURL}/user/balance`,
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
      logger.error('Balance check failed:', error.response?.data || error.message);
      throw new Error(`Failed to fetch balance: ${error.message}`);
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
   * Validate phone number format - Supports 25411 and 25476
   */
  validatePhoneNumber(phone) {
    const cleaned = phone.toString().replace(/\D/g, '');
    
    // Support both 25411 and 25476 formats
    // 25411XXXXXX (Safaricom)
    // 25476XXXXXX (Safaricom)
    // 2547XXXXXXXX (generic Safaricom)
    // 2541XXXXXXXX (Airtel)
    const patterns = [
      /^2541[1-9]\d{7}$/,     // 25411XXXXXX
      /^2547[0-9]\d{7}$/,     // 25476XXXXXX, 25470XXXXXX, 25471XXXXXX, etc.
      /^254[1-9]\d{8}$/,      // Generic 254 format
      /^0[1-9]\d{8}$/,        // Local format starting with 0
      /^[1-9]\d{8}$/          // Local format without leading 0
    ];
    
    const isValid = patterns.some(pattern => pattern.test(cleaned));
    
    if (!isValid) {
      logger.warn(`Invalid phone number: ${phone} (cleaned: ${cleaned})`);
    }
    
    return isValid;
  }

  /**
   * Format phone number to E.164 format (254XXXXXXXXX)
   */
  formatPhoneNumber(phone) {
    let cleaned = phone.toString().replace(/\D/g, '');
    
    // Remove leading + if present
    cleaned = cleaned.replace(/^\+/, '');
    
    if (cleaned.startsWith('0')) {
      // 07XXXXXXXX or 01XXXXXXXX -> 2547XXXXXXXX or 2541XXXXXXXX
      cleaned = '254' + cleaned.substring(1);
    } else if (cleaned.length === 9) {
      // 7XXXXXXXX -> 2547XXXXXXXX
      cleaned = '254' + cleaned;
    } else if (cleaned.length === 12 && cleaned.startsWith('254')) {
      // Already in correct format
      cleaned = cleaned;
    } else if (cleaned.length === 13 && cleaned.startsWith('254')) {
      // Extra digit, keep as is
      cleaned = cleaned;
    }
    
    // Final validation for 25411 or 25476
    if (!cleaned.match(/^2541\d{8}$/) && !cleaned.match(/^2547\d{8}$/)) {
      logger.warn(`Formatted number may be invalid: ${cleaned} (original: ${phone})`);
    }
    
    logger.debug(`Formatted phone: ${phone} -> ${cleaned}`);
    return cleaned;
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
        environment: 'sandbox'
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