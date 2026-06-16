'use strict';

/**
 * Lango MarketPulse — Notification Model
 * Kakuma–Kitale Corridor | Plan 4 "Mizigo"
 *
 * Every notification (push, SMS, email, in-app) is persisted here.
 * Records expire after 30 days via MongoDB TTL index.
 */

const mongoose = require('mongoose');

// ─────────────────────────────────────────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────────────────────────────────────────

const NOTIFICATION_TYPES = Object.freeze(['push', 'sms', 'email', 'in_app']);

const NOTIFICATION_CHANNELS = Object.freeze([
  'order_update',    // Order status changes (packed, dispatched, delivered)
  'payment',         // Escrow release, M-Pesa credit, payouts
  'scarcity_alert',  // Low stock, supply disruptions, dead stock
  'group_buy',       // Group trip ready, promotions, bulk deals
  'new_product',     // New farm listings, new stock, manufacturer launches
  'logistics',       // Driver assigned, QR scanned, approaching delivery
  'dispute',         // Dispute opened, escalated, resolved
  'system',          // Platform announcements, service alerts, vehicle maintenance
]);

const NOTIFICATION_STATUSES = Object.freeze([
  'pending',    // Created but not yet sent
  'sent',       // Successfully dispatched to delivery channel
  'delivered',  // Confirmed delivery (where supported, e.g. SMS DLR)
  'failed',     // Could not be delivered after retry
  'read',       // User opened/tapped the notification
]);

// ─────────────────────────────────────────────────────────────────────────────
// SCHEMA
// ─────────────────────────────────────────────────────────────────────────────

const NotificationSchema = new mongoose.Schema(
  {
    user : {
      type     : mongoose.Schema.Types.ObjectId,
      ref      : 'User',
      required : true,
      index    : true,
    },
    type : {
      type     : String,
      enum     : NOTIFICATION_TYPES,
      required : true,
    },
    channel : {
      type     : String,
      enum     : NOTIFICATION_CHANNELS,
      required : true,
      index    : true,
    },
    title : {
      type     : String,
      required : true,
      trim     : true,
      maxlength: 160,
    },
    body : {
      type     : String,
      required : true,
      maxlength: 1600,
    },
    /**
     * Flexible metadata bag for linking to related resources.
     * Examples: { orderId, shipmentId, productId, promoId, tripId }
     */
    data : {
      type    : Map,
      of      : mongoose.Schema.Types.Mixed,
      default : {},
    },
    status : {
      type    : String,
      enum    : NOTIFICATION_STATUSES,
      default : 'pending',
      index   : true,
    },
    readAt      : { type: Date },
    deliveredAt : { type: Date },
    failedReason: { type: String, trim: true },

    /**
     * External message ID from the delivery provider
     * e.g. Africa's Talking SMS SID, FCM message ID
     */
    externalId : { type: String, trim: true },

    retryCount : {
      type    : Number,
      default : 0,
      min     : 0,
      max     : 5,
    },
    scheduledFor : {
      type    : Date,
      default : Date.now,
    },
    expiresAt : {
      type  : Date,
    },
  },
  {
    timestamps  : true,
    toJSON      : { virtuals: true },
    toObject    : { virtuals: true },
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// INDEXES
// ─────────────────────────────────────────────────────────────────────────────

// Primary query pattern: fetch unread notifications for a user, newest first
NotificationSchema.index({ user: 1, status: 1, createdAt: -1 });

// Channel-scoped queries (e.g. all scarcity alerts for dashboard)
NotificationSchema.index({ user: 1, channel: 1, createdAt: -1 });

// TTL: MongoDB auto-deletes documents after expiresAt
NotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// ─────────────────────────────────────────────────────────────────────────────
// VIRTUALS
// ─────────────────────────────────────────────────────────────────────────────

NotificationSchema.virtual('isRead').get(function () {
  return this.status === 'read';
});

// ─────────────────────────────────────────────────────────────────────────────
// MIDDLEWARE
// ─────────────────────────────────────────────────────────────────────────────

/** Auto-set expiresAt to 30 days from creation if not provided. */
NotificationSchema.pre('save', function (next) {
  if (!this.expiresAt) {
    this.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  }
  next();
});

// ─────────────────────────────────────────────────────────────────────────────

module.exports = mongoose.model('Notification', NotificationSchema);
