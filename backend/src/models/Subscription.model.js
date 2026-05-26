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
      default: null,
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
        qrAutoSync: true,
        basicCfoDashboard: true,
        crmCapture: true,
        activeSmsCampaigns: false,
        restockAlerts: false,
        regionalGuardian: false,
        netProfitGauge: false,
        staffRbac: false,
        billGuardian: false,
        assetTracking: false,
        dailyBurnTracker: false,
        fullAuditPdf: false,
        checkCredits: false,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Virtual to check if active
SubscriptionSchema.virtual('isActive').get(function () {
  if (this.status !== 'active') return false;
  if (!this.endDate) return true;
  return new Date() < this.endDate;
});

SubscriptionSchema.index({ endDate: 1 });
SubscriptionSchema.index({ user: 1, status: 1 });

module.exports = mongoose.model('Subscription', SubscriptionSchema);
