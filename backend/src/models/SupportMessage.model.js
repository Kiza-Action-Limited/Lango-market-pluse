const mongoose = require('mongoose');

const SupportThreadMessageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    senderRole: {
      type: String,
      enum: ['admin', 'seller', 'farmer', 'buyer', 'vendor', 'logistics', 'user'],
      default: 'user',
    },
    body: {
      type: String,
      required: true,
      trim: true,
      maxlength: 3000,
    },
    channel: {
      type: String,
      enum: ['in_app', 'email', 'sms', 'all'],
      default: 'in_app',
    },
    sentByAdmin: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

const SupportMessageSchema = new mongoose.Schema(
  {
    requester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    requesterRole: {
      type: String,
      default: 'buyer',
      index: true,
    },
    requesterSnapshot: {
      name: { type: String, trim: true },
      email: { type: String, trim: true },
      phone: { type: String, trim: true },
      businessName: { type: String, trim: true },
    },
    subject: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    category: {
      type: String,
      enum: ['general', 'account', 'orders', 'payments', 'products', 'logistics', 'technical'],
      default: 'general',
      index: true,
    },
    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'urgent'],
      default: 'normal',
      index: true,
    },
    status: {
      type: String,
      enum: ['open', 'pending_admin', 'pending_user', 'resolved', 'closed'],
      default: 'pending_admin',
      index: true,
    },
    messages: {
      type: [SupportThreadMessageSchema],
      default: [],
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    lastAdminReplyAt: {
      type: Date,
    },
    closedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

SupportMessageSchema.index({ requester: 1, lastMessageAt: -1 });
SupportMessageSchema.index({ status: 1, lastMessageAt: -1 });

module.exports = mongoose.model('SupportMessage', SupportMessageSchema);
