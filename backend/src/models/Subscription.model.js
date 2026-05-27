const mongoose = require('mongoose');

const SubscriptionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    plan: {
      type: String,
      enum: ['free', 'v3', 'v4', 'solo', 'smart', 'growth', 'mizigo'],
      required: true,
    },
    billingModel: {
      type: String,
      enum: ['monthly', 'commission'],
      default: 'monthly',
    },
    price: {
      type: Number,
      default: 0,
      min: 0,
    },
    currency: {
      type: String,
      default: 'KES',
    },
    status: {
      type: String,
      enum: ['active', 'canceled', 'expired', 'trialing'],
      default: 'active',
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    endDate: {
      type: Date,
      required: true,
    },
    autoRenew: {
      type: Boolean,
      default: true,
    },
    paymentMethod: {
      type: String,
      enum: ['mpesa', 'card', 'wallet', 'commission'],
    },
    lastPaymentId: String,
    smsCredits: {
      balance: { type: Number, default: 0, min: 0 },
      includedPerCycle: { type: Number, default: 0, min: 0 },
      usedThisCycle: { type: Number, default: 0, min: 0 },
      purchasedThisCycle: { type: Number, default: 0, min: 0 },
      lastTopUpAt: Date,
    },
    commission: {
      minRate: { type: Number, default: 0, min: 0, max: 1 },
      maxRate: { type: Number, default: 0, min: 0, max: 1 },
      sinkingFundRate: { type: Number, default: 0, min: 0, max: 1 },
    },
    features: {
      type: Map,
      of: Boolean,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Virtual to check if active
SubscriptionSchema.virtual('isActive').get(function () {
  return this.status === 'active' && new Date() < this.endDate;
});

SubscriptionSchema.virtual('smsCreditBalance').get(function () {
  return this.smsCredits?.balance || 0;
});

SubscriptionSchema.index({ endDate: 1 });
SubscriptionSchema.index({ user: 1, status: 1 });
SubscriptionSchema.index({ plan: 1, status: 1 });

module.exports = mongoose.model('Subscription', SubscriptionSchema);
