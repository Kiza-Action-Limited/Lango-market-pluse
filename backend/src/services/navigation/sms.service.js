const { sendSMS } = require('../../config/africastalking');
const User = require('../../models/User.model');
const { smsQueue } = require('../../config/redis');
const logger = require('../../utils/logger');

class SMSService {
  async sendToUser(userId, message) {
    const user = await User.findById(userId);
    if (!user || !user.phone) throw new Error('User or phone not found');
    return await sendSMS(user.phone, message);
  }

  async sendToNumber(phoneNumber, message) {
    return await sendSMS(phoneNumber, message);
  }

  async handleDeliveryReport(reportData) {
    // Update notification status in DB
    logger.info('SMS delivery report:', reportData);
  }

  // Queue processor worker (called by BullMQ)
  async processQueue(job) {
    const { to, message } = job.data;
    try {
      const result = await sendSMS(to, message);
      return result;
    } catch (err) {
      logger.error(`SMS send failed: ${err.message}`);
      throw err;
    }
  }
}

module.exports = new SMSService();