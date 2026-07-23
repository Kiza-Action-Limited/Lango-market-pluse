const mongoose = require('mongoose');

const sellerSnapshotSchema = new mongoose.Schema(
  {
    name: String,
    businessName: String,
    email: String,
    phone: String,
    role: String,
    businessType: String,
  },
  { _id: false }
);

const agentReferralSchema = new mongoose.Schema(
  {
    agentNationalId: {
      type: String,
      required: true,
      trim: true,
      index: true, 
    },
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    sellerSnapshot: {
      type: sellerSnapshotSchema,
      default: {},
    },
    subscription: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subscription',
      default: null,
      index: true,
    },
    planId: {
      type: String,
      enum: ['solo', 'smart', 'growth', 'mizigo'],
      required: true,
      index: true,
    },
    source: {
      type: String,
      enum: ['subscription', 'mpesa_subscription', 'mizigo_onboarding', 'admin'],
      default: 'subscription',
      index: true,
    },
    paymentReference: {
      type: String,
      trim: true,
      default: '',
    },
    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['tracked', 'reviewed', 'paid', 'void'],
      default: 'tracked',
      index: true,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },
    referredAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true }
);

agentReferralSchema.index({ agentNationalId: 1, referredAt: -1 });
agentReferralSchema.index({ seller: 1, planId: 1 });

module.exports = mongoose.model('AgentReferral', agentReferralSchema);
