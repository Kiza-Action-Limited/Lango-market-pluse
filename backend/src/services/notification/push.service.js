const User = require('../../models/User.model');
const logger = require('../../utils/logger');

class PushService {
  async registerToken(userId, token, deviceType = 'web') {
    try {
      const user = await User.findById(userId);
      if (!user) throw new Error('User not found');

      if (!user.pushTokens) user.pushTokens = [];
      
      if (!user.pushTokens.includes(token)) {
        user.pushTokens.push(token);
        await user.save();
      }
      
      logger.info(`Push token registered for user ${userId}`);
      return { success: true, token };
    } catch (error) {
      logger.error('Error registering push token:', error);
      throw error;
    }
  }

  async unregisterToken(userId, token) {
    try {
      const user = await User.findById(userId);
      if (!user) throw new Error('User not found');

      if (user.pushTokens) {
        user.pushTokens = user.pushTokens.filter(t => t !== token);
        await user.save();
      }
      
      logger.info(`Push token unregistered for user ${userId}`);
      return { success: true };
    } catch (error) {
      logger.error('Error unregistering push token:', error);
      throw error;
    }
  }

  async sendToUser(userId, payload) {
    try {
      const user = await User.findById(userId);
      if (!user || !user.pushTokens || user.pushTokens.length === 0) {
        logger.warn(`No push tokens found for user ${userId}`);
        return { success: false, message: 'No push tokens' };
      }

      logger.info(`Sending push notification to user ${userId}:`, payload);
      
      return {
        success: true,
        message: 'Push notification queued',
        tokensCount: user.pushTokens.length,
      };
    } catch (error) {
      logger.error('Error sending push notification:', error);
      throw error;
    }
  }

  async sendBatch(userIds, payload) {
    try {
      const results = await Promise.all(
        userIds.map(userId => this.sendToUser(userId, payload).catch(err => ({ error: err.message })))
      );
      
      return {
        success: true,
        results,
        successCount: results.filter(r => r.success).length,
        failureCount: results.filter(r => r.error).length,
      };
    } catch (error) {
      logger.error('Error sending batch push notifications:', error);
      throw error;
    }
  }

  async broadcast(payload, userRole) {
    try {
      const users = await User.find({ role: userRole }).select('_id pushTokens');
      const userIds = users.map(u => u._id);
      
      return await this.sendBatch(userIds, payload);
    } catch (error) {
      logger.error('Error broadcasting push notification:', error);
      throw error;
    }
  }

  async getPreferences(userId) {
    try {
      const user = await User.findById(userId).select('notificationPreferences');
      return user?.notificationPreferences || {};
    } catch (error) {
      logger.error('Error getting preferences:', error);
      throw error;
    }
  }

  async updatePreferences(userId, prefs) {
    try {
      const updates = {};
      if (prefs.smsEnabled !== undefined) updates['notificationPreferences.smsEnabled'] = prefs.smsEnabled;
      if (prefs.emailEnabled !== undefined) updates['notificationPreferences.emailEnabled'] = prefs.emailEnabled;
      if (prefs.pushEnabled !== undefined) updates['notificationPreferences.pushEnabled'] = prefs.pushEnabled;
      if (prefs.orderUpdates !== undefined) updates['notificationPreferences.orderUpdates'] = prefs.orderUpdates;
      if (prefs.scarcityAlerts !== undefined) updates['notificationPreferences.scarcityAlerts'] = prefs.scarcityAlerts;

      const user = await User.findByIdAndUpdate(
        userId,
        updates,
        { new: true }
      ).select('notificationPreferences');
      
      return user?.notificationPreferences || {};
    } catch (error) {
      logger.error('Error updating preferences:', error);
      throw error;
    }
  }
}

module.exports = new PushService();
