const Notification = require('../../models/notification.model');
const User = require('../../models/User.model');
const logger = require('../../utils/logger');

class NotificationService {
  /**
   * Create notification
   */
  async create(userId, data) {
    const notification = new Notification({
      user: userId,
      ...data,
    });
    await notification.save();
    return notification;
  }

  /**
   * Get user notifications
   */
  async getUserNotifications(userId, options = {}) {
    const { page = 1, limit = 20, read = null, type = null } = options;
    const query = { user: userId };

    if (read !== null) query.read = read;
    if (type) query.type = type;

    const skip = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Notification.countDocuments(query),
    ]);

    return {
      notifications,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  /**
   * Mark as read
   */
  async markAsRead(notificationId, userId) {
    return Notification.findOneAndUpdate(
      { _id: notificationId, user: userId },
      { read: true },
      { new: true }
    );
  }

  /**
   * Mark all as read
   */
  async markAllAsRead(userId) {
    return Notification.updateMany(
      { user: userId, read: false },
      { read: true }
    );
  }

  /**
   * Delete notification
   */
  async delete(notificationId, userId) {
    return Notification.findOneAndDelete({
      _id: notificationId,
      user: userId,
    });
  }

  /**
   * Get unread count
   */
  async getUnreadCount(userId) {
    return Notification.countDocuments({ user: userId, read: false });
  }

  /**
   * Send bulk notifications
   */
  async sendBulkNotifications(userIds, data) {
    const notifications = userIds.map((userId) => ({
      user: userId,
      ...data,
    }));
    return Notification.insertMany(notifications);
  }

  /**
   * Send notification by type
   */
  async sendByType(type, data) {
    const users = await User.find(data.criteria || {}).select('_id');
    return this.sendBulkNotifications(
      users.map((u) => u._id),
      { type, message: data.message, data: data.data }
    );
  }
}

module.exports = new NotificationService();
