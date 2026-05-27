const pushService = require('./push.service');
const smsService = require('./sms.service');
const emailService = require('./email.service');
const User = require('../../models/User.model');
const logger = require('../../utils/logger');

class NotificationDispatch {
  async dispatch(options = {}) {
    try {
      const {
        userIds = [],
        userRole = null,
        type = 'general',
        title = '',
        body = '',
        message = '',
        data = {},
        channels = ['push'],
        priority = 'normal',
      } = options;

      let targetUsers = userIds;

      if (userRole && userIds.length === 0) {
        const users = await User.find({ role: userRole }).select('_id');
        targetUsers = users.map(u => u._id);
      }

      const results = {
        success: 0,
        failed: 0,
        channels: {},
      };

      for (const channel of channels) {
        results.channels[channel] = [];

        try {
          switch (channel) {
            case 'push':
              const pushResult = await pushService.sendBatch(targetUsers, {
                title,
                body,
                data: { type, priority, ...data },
              });
              results.channels[channel] = pushResult;
              if (pushResult.success) results.success += pushResult.successCount;
              else results.failed += pushResult.failureCount;
              break;

            case 'sms':
              const smsResult = await smsService.sendBatch(targetUsers, message || body);
              results.channels[channel] = smsResult;
              if (smsResult.success) results.success += smsResult.successCount;
              else results.failed += smsResult.failureCount;
              break;

            case 'email':
              const emailResult = await emailService.sendBatch(targetUsers, title, body);
              results.channels[channel] = emailResult;
              if (emailResult.success) results.success += emailResult.successCount;
              else results.failed += emailResult.failureCount;
              break;
          }
        } catch (channelError) {
          logger.error(`Error sending ${channel} notification:`, channelError);
          results.channels[channel] = { success: false, error: channelError.message };
          results.failed += targetUsers.length;
        }
      }

      logger.info('Notification dispatch complete:', results);
      return {
        success: results.failed === 0,
        ...results,
      };
    } catch (error) {
      logger.error('Error dispatching notifications:', error);
      throw error;
    }
  }

  replaceVariables(template, variables = {}) {
    let result = template;

    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, value);
    }

    return result;
  }

  async sendFromTemplate(templateKey, userId, variables = {}) {
    try {
      const templates = {
        driver_assigned: {
          push: {
            title: 'Driver Assigned: {{productName}}',
            body: 'Driver {{driverName}} will collect {{quantity}} units. ETA: {{eta}} min',
          },
          sms: 'Driver {{driverName}} ({{vehiclePlate}}) assigned. ETA: {{eta}} min.',
          email: {
            subject: 'Driver Assigned to Your Order',
            html: '<p>Driver {{driverName}} has been assigned. ETA: {{eta}} minutes</p>',
          },
        },
        payment_released: {
          push: {
            title: 'Payment Received: KES {{amount}}',
            body: 'Your order has been delivered. Funds released to your wallet.',
          },
          sms: '💰 Delivery confirmed. KES {{amount}} released to your wallet.',
          email: {
            subject: 'Payment Received',
            html: '<p>Payment of KES {{amount}} has been released.</p>',
          },
        },
      };

      const template = templates[templateKey] || templates.driver_assigned;
      const user = await User.findById(userId);

      if (!user) {
        logger.warn(`User ${userId} not found`);
        return { success: false, message: 'User not found' };
      }

      const results = {};

      if (template.push && user.notificationPreferences?.pushEnabled !== false) {
        const pushPayload = {
          title: this.replaceVariables(template.push.title, variables),
          body: this.replaceVariables(template.push.body, variables),
          data: { templateKey, ...variables },
        };
        results.push = await pushService.sendToUser(userId, pushPayload);
      }

      if (template.sms && user.notificationPreferences?.smsEnabled !== false && user.phone) {
        const smsMessage = this.replaceVariables(template.sms, variables);
        results.sms = await smsService.sendToUser(userId, smsMessage);
      }

      if (template.email && user.notificationPreferences?.emailEnabled !== false && user.email) {
        const emailSubject = this.replaceVariables(template.email.subject, variables);
        const emailHtml = this.replaceVariables(template.email.html, variables);
        results.email = await emailService.sendEmail(user.email, emailSubject, emailHtml);
      }

      logger.info(`Sent template notification '${templateKey}' to user ${userId}`);
      return {
        success: true,
        templateKey,
        results,
      };
    } catch (error) {
      logger.error('Error sending templated notification:', error);
      throw error;
    }
  }
}

module.exports = new NotificationDispatch();
