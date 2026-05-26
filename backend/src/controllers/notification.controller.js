const smsService = require('../services/navigation/sms.service');
const pushService = require('../services/navigation/push.service');
const emailService = require('../services/navigation/email.service');
const { validationResult } = require('express-validator');

/**
 * Send SMS to a user (admin only)
 * POST /api/v1/notifications/sms
 */
exports.sendSMS = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId, message } = req.body;
    const result = await smsService.sendPaidSmsFromUser(req.user.id, userId, message);
    res.status(200).json({
      success: true,
      message: 'SMS sent successfully',
      data: result,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
};

/**
 * Send push notification to a user
 * POST /api/v1/notifications/push
 */
exports.sendPush = async (req, res, next) => {
  try {
    const { userId, title, body, data } = req.body;
    const result = await pushService.sendToUser(userId, { title, body, data });
    res.status(200).json({
      success: true,
      message: 'Push notification sent',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Send email (admin only)
 * POST /api/v1/notifications/email
 */
exports.sendEmail = async (req, res, next) => {
  try {
    const { to, subject, html } = req.body;
    const result = await emailService.sendEmail(to, subject, html);
    res.status(200).json({
      success: true,
      message: 'Email sent',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Register push notification token (FCM/Expo)
 * POST /api/v1/notifications/register-token
 */
exports.registerPushToken = async (req, res, next) => {
  try {
    const { token } = req.body;
    await pushService.registerToken(req.user.id, token);
    res.status(200).json({
      success: true,
      message: 'Push token registered',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get user's notification preferences
 * GET /api/v1/notifications/preferences
 */
exports.getPreferences = async (req, res, next) => {
  try {
    const prefs = await pushService.getPreferences(req.user.id);
    res.status(200).json({
      success: true,
      data: prefs,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update notification preferences
 * PUT /api/v1/notifications/preferences
 */
exports.updatePreferences = async (req, res, next) => {
  try {
    const { smsEnabled, emailEnabled, pushEnabled, orderUpdates, scarcityAlerts } = req.body;
    const prefs = await pushService.updatePreferences(req.user.id, {
      smsEnabled,
      emailEnabled,
      pushEnabled,
      orderUpdates,
      scarcityAlerts,
    });
    res.status(200).json({
      success: true,
      message: 'Preferences updated',
      data: prefs,
    });
  } catch (error) {
    next(error);
  }
};
