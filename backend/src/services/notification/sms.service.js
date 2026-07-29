const User = require('../../models/User.model');
const logger = require('../../utils/logger');
const { africaTalkingService } = require('../../config/africastalking');

class SMSService {
  constructor() {
    this.isConfigured = !!(
      (process.env.AFRICASTALKING_API_KEY || process.env.AT_API_KEY) &&
      (process.env.AFRICASTALKING_USERNAME || process.env.AT_USERNAME)
    );
  }

  formatPhoneNumber(phone) {
    return africaTalkingService.formatPhoneNumber(phone);
  }

  async sendToPhone(phoneNumber, message) {
    try {
      if (!this.isConfigured) {
        logger.warn('Africa\'s Talking not configured. SMS queued in mock mode.', {
          messageLength: String(message || '').length,
        });
        return { success: true, message: 'SMS queued (mock mode)' };
      }

      const formattedPhone = this.formatPhoneNumber(phoneNumber);
      logger.info('Sending SMS notification', {
        phone: formattedPhone,
        messageLength: String(message || '').length,
      });

      return await africaTalkingService.sendSMS(formattedPhone, message);
    } catch (error) {
      logger.error('Error sending SMS:', error);
      throw error;
    }
  }

  async sendToUser(userId, message) {
    try {
      const user = await User.findById(userId).select('phone');
      if (!user || !user.phone) {
        logger.warn(`No phone number found for user ${userId}`);
        return { success: false, message: 'No phone number' };
      }

      return await this.sendToPhone(user.phone, message);
    } catch (error) {
      logger.error('Error sending SMS to user:', error);
      throw error;
    }
  }

  async sendBatch(userIds, message) {
    try {
      const results = await Promise.all(
        userIds.map(userId => this.sendToUser(userId, message).catch(err => ({ error: err.message })))
      );

      return {
        success: true,
        results,
        successCount: results.filter(r => r.success).length,
        failureCount: results.filter(r => r.error).length,
      };
    } catch (error) {
      logger.error('Error sending batch SMS:', error);
      throw error;
    }
  }

  async broadcast(message, userRole) {
    try {
      const users = await User.find({ role: userRole }).select('_id');
      const userIds = users.map(u => u._id);

      return await this.sendBatch(userIds, message);
    } catch (error) {
      logger.error('Error broadcasting SMS:', error);
      throw error;
    }
  }
}

module.exports = new SMSService();
