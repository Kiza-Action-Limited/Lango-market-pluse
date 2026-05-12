const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['push', 'sms', 'email', 'in_app'],
      required: true,
    },
    channel: {
      type: String,
      enum: ['order_update', 'payment', 'scarcity_alert', 'group_buy', 'subscription', 'dispute', 'system'],
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    body: {
      type: String,
      required: true,
    },
    data: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    }, // e.g., { orderId, productId, groupBuyId }
    status: {
      type: String,
      enum: ['pending', 'sent', 'delivered', 'failed', 'read'],
      default: 'pending',
      index: true,
    },
    readAt: {
      type: Date,
    },
    deliveredAt: Date,
    failedReason: String,
    externalId: String, // e.g., message SID from Africa's Talking
    retryCount: {
      type: Number,
      default: 0,
    },
    scheduledFor: {
      type: Date,
      default: Date.now,
    },
    expiresAt: Date, // Auto-delete old notifications
  },
  {
    timestamps: true,
  }
);

// Index for fetching unread notifications
NotificationSchema.index({ user: 1, status: 1, createdAt: -1 });
// TTL index to auto-delete old read notifications (e.g., after 30 days)
NotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Virtual: isRead
NotificationSchema.virtual('isRead').get(function () {
  return this.status === 'read';
});

// Pre-save: set expiresAt if not set (30 days from creation)
NotificationSchema.pre('save', function (next) {
  if (!this.expiresAt) {
    this.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  }
  next();
});

module.exports = mongoose.model('Notification', NotificationSchema);