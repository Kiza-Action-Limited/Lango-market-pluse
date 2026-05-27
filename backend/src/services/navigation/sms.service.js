const { sendSMS } = require('../../config/africastalking');
const User = require('../../models/User.model');
const { smsQueue } = require('../../config/redis');
const planService = require('../subscription/plan.service');
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

  async sendPaidSmsFromUser(senderId, recipientUserId, message) {
    const [sender, recipient] = await Promise.all([
      User.findById(senderId),
      User.findById(recipientUserId),
    ]);

    if (!sender) throw new Error('Sender not found');
    if (!recipient || !recipient.phone) throw new Error('Recipient phone not found');

    if (sender.role !== 'admin') {
      const hasSmsFeature = await planService.checkFeatureAccess(senderId, 'activeSmsCampaigns');
      if (!hasSmsFeature) {
        const err = new Error('SMS messaging is locked for your current plan. Upgrade to Smart or Growth.');
        err.statusCode = 403;
        throw err;
      }

      if ((sender.smsCredits || 0) < 1) {
        const err = new Error('SMS credits are depleted. Top up credits to continue.');
        err.statusCode = 402;
        throw err;
      }

      sender.smsCredits -= 1;
      await sender.save();
    }

    try {
      return await sendSMS(recipient.phone, message);
    } catch (error) {
      if (sender.role !== 'admin') {
        sender.smsCredits += 1;
        await sender.save();
      }
      throw error;
    }
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
