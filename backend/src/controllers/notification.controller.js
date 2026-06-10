const smsService = require('../services/notification/sms.service');
const pushService = require('../services/notification/push.service');
const emailService = require('../services/notification/email.service');
const { validationResult } = require('express-validator');
const Notification = require('../models/notification.model');
const Product = require('../models/Product.model');
const Order = require('../models/Order.model');

const SELLER_ROLES = new Set([
  'seller',
  'farmer',
  'wholesaler',
  'retailer',
  'manufacturer',
  'small_business',
  'brand',
]);

const unreadStatuses = ['pending', 'sent', 'delivered', 'failed'];

const getUserId = (user) => user?.id || user?._id || user?.userId;

const isSyntheticNotification = (notificationId) =>
  typeof notificationId === 'string' && notificationId.startsWith('system:');

const normalizeNotification = (notification) => ({
  id: String(notification._id || notification.id),
  title: notification.title,
  message: notification.body || notification.message || '',
  type: notification.channel || notification.type || 'system',
  channel: notification.channel || notification.type || 'system',
  read: notification.status === 'read' || notification.read === true,
  createdAt: notification.createdAt || new Date().toISOString(),
  data: notification.data || {},
  synthetic: Boolean(notification.synthetic),
});

const syntheticNotification = ({ id, title, message, type = 'system', read = false, data = {} }) => ({
  id,
  title,
  message,
  type,
  channel: type,
  read,
  createdAt: new Date().toISOString(),
  data,
  synthetic: true,
});

const countSafely = async (query) => {
  try {
    return await query;
  } catch (error) {
    return 0;
  }
};

const buildAdminNotifications = async () => {
  const [pendingProducts, lowStockProducts, disputedOrders] = await Promise.all([
    countSafely(Product.countDocuments({ isPublished: false })),
    countSafely(Product.countDocuments({ quantityAvailable: { $lte: 5 } })),
    countSafely(Order.countDocuments({ status: 'disputed' })),
  ]);

  const notifications = [];

  if (pendingProducts > 0) {
    notifications.push(syntheticNotification({
      id: 'system:admin:seller-products',
      title: 'Seller product updates',
      message: `${pendingProducts} seller product${pendingProducts === 1 ? '' : 's'} need admin review.`,
      type: 'new_product',
      data: { source: 'seller', count: pendingProducts, href: '/admin/products' },
    }));
  }

  if (disputedOrders > 0) {
    notifications.push(syntheticNotification({
      id: 'system:admin:customer-complaints',
      title: 'Customer complaints',
      message: `${disputedOrders} customer complaint${disputedOrders === 1 ? '' : 's'} or disputed order${disputedOrders === 1 ? '' : 's'} need attention.`,
      type: 'dispute',
      data: { source: 'customer', count: disputedOrders, href: '/admin/orders' },
    }));
  }

  if (lowStockProducts > 0) {
    notifications.push(syntheticNotification({
      id: 'system:admin:product-alerts',
      title: 'System product alert',
      message: `${lowStockProducts} product${lowStockProducts === 1 ? ' is' : 's are'} low on stock across the marketplace.`,
      type: 'scarcity_alert',
      data: { source: 'system', count: lowStockProducts, href: '/admin/products' },
    }));
  }

  notifications.push(syntheticNotification({
    id: 'system:admin:monitoring',
    title: 'System alerts active',
    message: 'Admin notifications are watching seller activity, customer complaints, products, and system alerts.',
    type: 'system',
    read: pendingProducts === 0 && lowStockProducts === 0 && disputedOrders === 0,
    data: { source: 'system' },
  }));

  return notifications;
};

const buildSellerNotifications = async (userId) => {
  const [lowStockProducts, activeOrders, reviewedProducts, disputedOrders] = await Promise.all([
    countSafely(Product.countDocuments({ seller: userId, quantityAvailable: { $lte: 5 } })),
    countSafely(Order.countDocuments({
      seller: userId,
      status: { $in: ['pending_payment', 'payment_escrowed', 'processing', 'dispatched'] },
    })),
    countSafely(Product.countDocuments({ seller: userId, 'reviews.0': { $exists: true } })),
    countSafely(Order.countDocuments({ seller: userId, status: 'disputed' })),
  ]);

  const notifications = [];

  if (activeOrders > 0) {
    notifications.push(syntheticNotification({
      id: 'system:seller:customer-orders',
      title: 'Customer order updates',
      message: `${activeOrders} customer order${activeOrders === 1 ? '' : 's'} need seller follow-up.`,
      type: 'order_update',
      data: { source: 'customer', count: activeOrders, href: '/seller/orders' },
    }));
  }

  if (disputedOrders > 0) {
    notifications.push(syntheticNotification({
      id: 'system:seller:complaints',
      title: 'Customer complaint alert',
      message: `${disputedOrders} disputed order${disputedOrders === 1 ? '' : 's'} need your response.`,
      type: 'dispute',
      data: { source: 'customer', count: disputedOrders, href: '/seller/orders' },
    }));
  }

  if (lowStockProducts > 0) {
    notifications.push(syntheticNotification({
      id: 'system:seller:product-alerts',
      title: 'Product stock alert',
      message: `${lowStockProducts} of your product${lowStockProducts === 1 ? ' is' : 's are'} low on stock.`,
      type: 'scarcity_alert',
      data: { source: 'system', count: lowStockProducts, href: '/seller/products' },
    }));
  }

  if (reviewedProducts > 0) {
    notifications.push(syntheticNotification({
      id: 'system:seller:customer-reviews',
      title: 'Customer review activity',
      message: `${reviewedProducts} product${reviewedProducts === 1 ? ' has' : 's have'} verified customer review activity.`,
      type: 'system',
      read: true,
      data: { source: 'customer', count: reviewedProducts, href: '/seller/products' },
    }));
  }

  return notifications;
};

const buildRoleNotifications = async (user) => {
  const userId = getUserId(user);

  if (user?.role === 'admin') {
    return buildAdminNotifications();
  }

  if (SELLER_ROLES.has(user?.role)) {
    return buildSellerNotifications(userId);
  }

  return [];
};

exports.getNotifications = async (req, res, next) => {
  try {
    const userId = getUserId(req.user);
    const [savedNotifications, roleNotifications] = await Promise.all([
      Notification.find({ user: userId }).sort({ createdAt: -1 }).limit(50).lean().catch(() => []),
      buildRoleNotifications(req.user),
    ]);

    const notifications = [
      ...roleNotifications,
      ...savedNotifications.map(normalizeNotification),
    ];

    res.status(200).json({
      success: true,
      notifications,
      unreadCount: notifications.filter((notification) => !notification.read).length,
    });
  } catch (error) {
    next(error);
  }
};

exports.getUnreadCount = async (req, res, next) => {
  try {
    const userId = getUserId(req.user);
    const [savedUnreadCount, roleNotifications] = await Promise.all([
      countSafely(Notification.countDocuments({ user: userId, status: { $in: unreadStatuses } })),
      buildRoleNotifications(req.user),
    ]);

    res.status(200).json({
      success: true,
      count: savedUnreadCount + roleNotifications.filter((notification) => !notification.read).length,
    });
  } catch (error) {
    next(error);
  }
};

exports.markAsRead = async (req, res, next) => {
  try {
    const { notificationId } = req.params;

    if (isSyntheticNotification(notificationId)) {
      return res.status(200).json({
        success: true,
        message: 'Notification marked as read',
      });
    }

    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, user: getUserId(req.user) },
      { status: 'read', readAt: new Date() },
      { new: true }
    ).lean();

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found',
      });
    }

    res.status(200).json({
      success: true,
      notification: normalizeNotification(notification),
    });
  } catch (error) {
    next(error);
  }
};

exports.markAllAsRead = async (req, res, next) => {
  try {
    await Notification.updateMany(
      { user: getUserId(req.user), status: { $ne: 'read' } },
      { status: 'read', readAt: new Date() }
    );

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteNotification = async (req, res, next) => {
  try {
    const { notificationId } = req.params;

    if (isSyntheticNotification(notificationId)) {
      return res.status(200).json({
        success: true,
        message: 'Notification removed',
      });
    }

    const notification = await Notification.findOneAndDelete({
      _id: notificationId,
      user: getUserId(req.user),
    }).lean();

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Notification deleted',
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteAllNotifications = async (req, res, next) => {
  try {
    await Notification.deleteMany({ user: getUserId(req.user) });

    res.status(200).json({
      success: true,
      message: 'All notifications deleted',
    });
  } catch (error) {
    next(error);
  }
};

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
