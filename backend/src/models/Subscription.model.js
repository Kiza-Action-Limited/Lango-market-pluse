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
      enum: ['free', 'v3', 'v4'],
      required: true,
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
      enum: ['mpesa', 'card', 'wallet'],
    },
    lastPaymentId: String,
    features: {
      type: Map,
      of: Boolean,
      default: {
        escrow: false,
        groupBuying: false,
        scarcityAlerts: false,
        predictiveAnalytics: false,
        prioritySupport: false,
      },
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

SubscriptionSchema.index({ endDate: 1 });
SubscriptionSchema.index({ user: 1, status: 1 });

module.exports = mongoose.model('Subscription', SubscriptionSchema);