const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    plan: {
      type: String,
      enum: ['free', 'v3', 'v4', 'solo', 'smart', 'growth', 'mizigo'],
      default: 'free',
      required: true
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'suspended', 'cancelled', 'expired'],
      default: 'active'
    },
    startDate: {
      type: Date,
      default: Date.now
    },
    endDate: {
      type: Date
    },
    autoRenew: {
      type: Boolean,
      default: true
    },
    paymentMethod: {
      type: String,
      enum: ['mpesa', 'card', 'bank_transfer'],
      default: null
    },
    billingCycle: {
      type: String,
      enum: ['monthly', 'quarterly', 'annual'],
      default: 'monthly'
    },
    price: {
      type: Number,
      default: 0
    },
    features: {
      maxProducts: {
        type: Number,
        default: 30
      },
      maxOrders: {
        type: Number,
        default: Number.MAX_SAFE_INTEGER
      },
      maxCategories: {
        type: Number,
        default: 5
      },
      commissionRate: {
        type: Number,
        default: 5
      },
      storageGB: {
        type: Number,
        default: 10
      }
    },
    renewalDate: {
      type: Date
    },
    lastPaymentDate: {
      type: Date
    },
    nextBillingDate: {
      type: Date
    },
    cancellationDate: {
      type: Date
    },
    cancellationReason: {
      type: String,
      default: null
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    transactionHistory: [{
      transactionId: mongoose.Schema.Types.ObjectId,
      amount: Number,
      date: Date,
      status: String
    }]
  },
  {
    timestamps: true
  }
);

// Indexes for better query performance
subscriptionSchema.index({ user: 1, status: 1 });
subscriptionSchema.index({ plan: 1, status: 1 });
subscriptionSchema.index({ renewalDate: 1 });

// Pre-save hook to auto-generate end date based on billing cycle
// FIX: Use promise-based syntax (no `next` param) to avoid "next is not a function" error
subscriptionSchema.pre('save', function () {
  if (this.isNew || this.isModified('startDate') || this.isModified('billingCycle')) {
    const start = this.startDate || new Date();
    const endDate = new Date(start);

    switch (this.billingCycle) {
      case 'monthly':
        endDate.setMonth(endDate.getMonth() + 1);
        break;
      case 'quarterly':
        endDate.setMonth(endDate.getMonth() + 3);
        break;
      case 'annual':
        endDate.setFullYear(endDate.getFullYear() + 1);
        break;
    }

    this.endDate = endDate;
    this.nextBillingDate = new Date(endDate);
  }
});

// Virtual for checking if subscription is currently active
subscriptionSchema.virtual('isActive').get(function () {
  return this.status === 'active' && (!this.endDate || this.endDate > new Date());
});

// Static method to find active subscriptions
subscriptionSchema.statics.findActiveForUser = async function (userId) {
  return this.findOne({
    user: userId,
    status: 'active',
    endDate: { $gt: new Date() }
  });
};

// Static method to find subscriptions needing renewal
subscriptionSchema.statics.findDueForRenewal = async function () {
  return this.find({
    autoRenew: true,
    status: 'active',
    nextBillingDate: { $lte: new Date() }
  });
};

module.exports = mongoose.model('Subscription', subscriptionSchema); 