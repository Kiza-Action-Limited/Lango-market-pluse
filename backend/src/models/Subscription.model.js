// models/Subscription.js
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
      enum: ['solo', 'smart', 'growth', 'mizigo'],
      required: true
    },
    planName: {
      type: String,
      enum: ['Solo', 'Smart', 'Growth', 'Mizigo'],
      required: true
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'suspended', 'cancelled', 'expired', 'trial'],
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
      enum: ['mpesa', 'commission'],
      default: null
    },
    price: {
      type: Number,
      default: 0
    },
    
    // Plan-specific features storage
    features: {
      // Inventory limits
      maxProducts: {
        type: Number,
        default: 30 // Solo: 30, Smart/Growth: unlimited (set to large number)
      },
      
      // SMS Credits (Plan 2: 500, Plan 3: 2000)
      smsCreditsAllocated: {
        type: Number,
        default: 0
      },
      smsCreditsUsed: {
        type: Number,
        default: 0
      },
      
      // Commission for Mizigo
      commissionRate: {
        type: Number,
        default: 5, // 5-10%
        min: 5,
        max: 10
      },
      
      // Sinking Fund for Mizigo
      sinkingFundBalance: {
        type: Number,
        default: 0
      },
      
      // Feature flags
      hasRegionalGuardian: {
        type: Boolean,
        default: false
      },
      hasBillGuardian: {
        type: Boolean,
        default: false
      },
      hasAssetTracking: {
        type: Boolean,
        default: false
      },
      hasStaffRoles: {
        type: Boolean,
        default: false
      },
      hasDailyBurn: {
        type: Boolean,
        default: false
      },
      
      // Additional metadata
      staffAccounts: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }],
      
      recurringExpenses: [{
        name: String,
        amount: Number,
        dueDate: Date,
        category: String
      }],
      
      assets: [{
        name: String,
        marketValue: Number,
        purchaseDate: Date,
        type: String
      }]
    },
    
    // Billing and payment tracking
    billingCycle: {
      type: String,
      enum: ['monthly'],
      default: 'monthly'
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
    
    // Mizigo specific
    vehicleInfo: {
      registration: String,
      mileage: {
        type: Number,
        default: 0
      },
      lastMaintenanceKm: Number,
      tripsCompleted: {
        type: Number,
        default: 0
      },
      totalEarnings: {
        type: Number,
        default: 0
      }
    },
    
    // Metadata for additional tracking
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    
    transactionHistory: [{
      transactionId: mongoose.Schema.Types.ObjectId,
      type: {
        type: String,
        enum: ['subscription', 'topup', 'commission', 'sinking_fund', 'delivery_payout']
      },
      amount: Number,
      date: Date,
      status: String,
      reference: String
    }]
  },
  {
    timestamps: true
  }
);

const setPlanName = (subscription) => {
  const planNames = {
    'solo': 'Solo',
    'smart': 'Smart',
    'growth': 'Growth',
    'mizigo': 'Mizigo'
  };
  subscription.planName = planNames[subscription.plan] || subscription.planName;
};

// Pre-validate hook runs before enum validation, so service-level display names
// like "Lango Solo" cannot fail the Subscription planName enum.
subscriptionSchema.pre('validate', function() {
  setPlanName(this);
});

// Pre-save hook to set plan-specific defaults
subscriptionSchema.pre('save', function() {
  // Set plan name based on plan ID
  setPlanName(this);

  if (!this.features) {
    this.features = {};
  }

  const shouldApplyPlanDefaults = this.isNew || this.isModified('plan');
  if (!shouldApplyPlanDefaults) {
    return;
  }

  // Set plan-specific features
  switch(this.plan) {
    case 'solo':
      this.price = 500;
      this.features.maxProducts = 30;
      this.features.smsCreditsAllocated = 0;
      this.features.hasRegionalGuardian = false;
      this.features.hasBillGuardian = false;
      this.features.hasAssetTracking = false;
      this.features.hasStaffRoles = false;
      this.features.hasDailyBurn = false;
      break;
      
    case 'smart':
      this.price = 2500;
      this.features.maxProducts = 999999; // Unlimited
      this.features.smsCreditsAllocated = 500;
      this.features.hasRegionalGuardian = true;
      this.features.hasBillGuardian = false;
      this.features.hasAssetTracking = false;
      this.features.hasStaffRoles = false;
      this.features.hasDailyBurn = false;
      break;
      
    case 'growth':
      this.price = 6500;
      this.features.maxProducts = 999999; // Unlimited
      this.features.smsCreditsAllocated = 2000;
      this.features.hasRegionalGuardian = true;
      this.features.hasBillGuardian = true;
      this.features.hasAssetTracking = true;
      this.features.hasStaffRoles = true;
      this.features.hasDailyBurn = true;
      break;
      
    case 'mizigo':
      this.price = 0;
      this.features.maxProducts = 0;
      this.features.smsCreditsAllocated = 0;
      this.features.commissionRate = 5; // Default 5%, can go up to 10%
      break;
  }

  // Set end date (1 month from start)
  if (this.plan !== 'mizigo') {
    const endDate = new Date(this.startDate || Date.now());
    endDate.setMonth(endDate.getMonth() + 1);
    this.endDate = endDate;
    this.nextBillingDate = new Date(endDate);
  } else {
    // Mizigo has no end date (commission-based)
    this.endDate = null;
    this.nextBillingDate = null;
  }
  
});

// Virtual for checking if subscription is active
subscriptionSchema.virtual('isActive').get(function() {
  if (this.plan === 'mizigo') {
    return this.status === 'active';
  }
  return this.status === 'active' && (!this.endDate || this.endDate > new Date());
});

// Virtual for available SMS credits
subscriptionSchema.virtual('smsCreditsRemaining').get(function() {
  if (this.plan !== 'smart' && this.plan !== 'growth') {
    return 0;
  }
  return Math.max(0, this.features.smsCreditsAllocated - this.features.smsCreditsUsed);
});

// Method to use SMS credits
subscriptionSchema.methods.useSmsCredits = async function(amount) {
  if (this.plan !== 'smart' && this.plan !== 'growth') {
    throw new Error('SMS credits only available on Smart and Growth plans');
  }
  
  if (this.smsCreditsRemaining < amount) {
    throw new Error('Insufficient SMS credits');
  }
  
  this.features.smsCreditsUsed += amount;
  await this.save();
  
  return this.smsCreditsRemaining;
};

// Method to add SMS credits (top-up)
subscriptionSchema.methods.addSmsCredits = async function(amount) {
  if (this.plan !== 'smart' && this.plan !== 'growth') {
    throw new Error('SMS credits only available on Smart and Growth plans');
  }
  
  this.features.smsCreditsAllocated += amount;
  await this.save();
  
  return this.smsCreditsRemaining;
};

// Method for Mizigo sinking fund
subscriptionSchema.methods.addToSinkingFund = async function(amount) {
  if (this.plan !== 'mizigo') {
    throw new Error('Sinking fund only available on Mizigo plan');
  }
  
  this.features.sinkingFundBalance += amount;
  await this.save();
  
  return this.features.sinkingFundBalance;
};

// Method to withdraw from sinking fund (for maintenance)
subscriptionSchema.methods.withdrawFromSinkingFund = async function(amount) {
  if (this.plan !== 'mizigo') {
    throw new Error('Sinking fund only available on Mizigo plan');
  }
  
  if (this.features.sinkingFundBalance < amount) {
    throw new Error('Insufficient sinking fund balance');
  }
  
  this.features.sinkingFundBalance -= amount;
  await this.save();
  
  return this.features.sinkingFundBalance;
};

// Method to record trip and update mileage
subscriptionSchema.methods.recordTrip = async function(distance, earnings) {
  if (this.plan !== 'mizigo') {
    throw new Error('Trip recording only available on Mizigo plan');
  }
  
  const commission = earnings * (this.features.commissionRate / 100);
  const sinkingFundContribution = earnings * 0.10; // 10% to sinking fund
  const driverEarnings = earnings - commission - sinkingFundContribution;
  
  this.vehicleInfo.mileage += distance;
  this.vehicleInfo.tripsCompleted += 1;
  this.vehicleInfo.totalEarnings += driverEarnings;
  
  this.features.sinkingFundBalance += sinkingFundContribution;
  
  await this.save();
  
  return {
    commission,
    sinkingFundContribution,
    driverEarnings,
    newMileage: this.vehicleInfo.mileage,
    sinkingFundBalance: this.features.sinkingFundBalance
  };
};

// Static methods
subscriptionSchema.statics.findActiveForUser = async function(userId) {
  return this.findOne({
    user: userId,
    status: 'active',
    $or: [
      { endDate: { $gt: new Date() } },
      { plan: 'mizigo' } // Mizigo has no end date
    ]
  });
};

subscriptionSchema.statics.findDueForRenewal = async function() {
  return this.find({
    plan: { $ne: 'mizigo' }, // Exclude Mizigo from auto-renewal
    autoRenew: true,
    status: 'active',
    nextBillingDate: { $lte: new Date() }
  });
};

// Indexes
subscriptionSchema.index({ user: 1, status: 1 });
subscriptionSchema.index({ plan: 1, status: 1 });
subscriptionSchema.index({ nextBillingDate: 1 });
subscriptionSchema.index({ 'vehicleInfo.mileage': 1 });

module.exports = mongoose.model('Subscription', subscriptionSchema);
