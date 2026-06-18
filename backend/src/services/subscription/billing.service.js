// services/subscription/billing.service.js
const Subscription = require('../../models/Subscription.model');
const Transaction = require('../../models/Transaction.model');
const User = require('../../models/User.model');
const planService = require('./plan.service');
const { PLAN_IDS, PLANS, normalizePlanId } = require('../../config/subscriptionPlans');
const { smsQueue } = require('../../config/redis');
const logger = require('../../utils/logger');
const { SELLER_BUSINESS_TYPES, normalizeBusinessType } = require('../../utils/userCategory');

const httpError = (message, statusCode, details = {}) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  Object.assign(error, details);
  return error;
};

const money = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const normalizeValue = (value) => String(value || '').trim().toLowerCase();

const SELLER_PLAN_ROLES = new Set(['seller', 'farmer']);
const BLOCKED_SELLER_PLAN_ROLES = new Set(['buyer', 'consumer', 'admin', 'logistics']);
const LOGISTICS_ACCOUNT_ROLES = new Set(['DRIVER', 'FLEET_OWNER']);

const isSellerPlanEligible = (user = {}) => {
  const role = normalizeValue(user.role);
  if (BLOCKED_SELLER_PLAN_ROLES.has(role)) return false;

  const businessType = normalizeBusinessType(user.businessType);
  return SELLER_PLAN_ROLES.has(role) || SELLER_BUSINESS_TYPES.has(businessType);
};

const isMizigoPlanEligible = (user = {}) => {
  const role = normalizeValue(user.role);
  const businessType = normalizeBusinessType(user.businessType);
  const accountRole = String(user.accountRole || '').trim().toUpperCase();

  return role === 'logistics' || businessType === 'logistics' || LOGISTICS_ACCOUNT_ROLES.has(accountRole);
};

const PLAN_PRICES = {
  solo: 500,
  smart: 2500,
  growth: 6500,
  mizigo: 0 // Commission-based
};

const SMS_CREDITS = {
  solo: 0,
  smart: 500,
  growth: 2000,
  mizigo: 0
};

const getCycleEnd = (planId) => {
  // Mizigo has no end date (commission-based, no expiry)
  if (planId === 'mizigo') {
    const farFuture = new Date();
    farFuture.setFullYear(farFuture.getFullYear() + 20);
    return farFuture;
  }

  // Monthly plans end after 30 days
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 30);
  return endDate;
};

const buildSmsCredits = (planId) => {
  const allocated = SMS_CREDITS[planId] || 0;
  return {
    balance: allocated,
    includedPerCycle: allocated,
    usedThisCycle: 0,
    purchasedThisCycle: 0,
    lastTopUpAt: null,
    topUpHistory: []
  };
};

const getSmsCreditState = (subscription) => {
  const allocated = Number(
    subscription.features?.smsCreditsAllocated ??
    subscription.smsCredits?.includedPerCycle ??
    SMS_CREDITS[subscription.plan] ??
    0
  );
  const used = Number(
    subscription.features?.smsCreditsUsed ??
    subscription.smsCredits?.usedThisCycle ??
    0
  );

  return {
    allocated,
    used,
    balance: Math.max(0, allocated - used)
  };
};

const setSmsCreditState = (subscription, { allocated, used }) => {
  if (!subscription.features) {
    subscription.features = {};
  }

  subscription.features.smsCreditsAllocated = allocated;
  subscription.features.smsCreditsUsed = used;
  subscription.markModified('features');
};

const addSmsTopUpHistory = (subscription, entry) => {
  const metadata = subscription.metadata && typeof subscription.metadata === 'object'
    ? subscription.metadata
    : {};
  const history = Array.isArray(metadata.smsTopUpHistory) ? metadata.smsTopUpHistory : [];

  subscription.metadata = {
    ...metadata,
    smsTopUpHistory: [...history, entry],
    lastSmsTopUpAt: entry.date
  };
  subscription.markModified('metadata');
};

const buildCommission = (planId) => {
  if (planId !== 'mizigo') return null;
  
  return {
    rate: 5, // Default 5%, can be negotiated up to 10%
    minRate: 5,
    maxRate: 10,
    sinkingFundRate: 10, // 10% of each trip goes to sinking fund
    sinkingFundBalance: 0,
    tripsCompleted: 0,
    totalCommission: 0,
    totalDriverEarnings: 0
  };
};

const resolvePlanPrice = (planId, overrideAmount) => {
  if (overrideAmount === undefined || overrideAmount === null || overrideAmount === '') {
    return PLAN_PRICES[planId] || 0;
  }

  const amount = Number(overrideAmount);
  if (!Number.isFinite(amount) || amount < 0) {
    throw httpError('Subscription amount must be a non-negative number', 400);
  }

  return money(amount);
};

const buildFeatures = (planId) => {
  const baseFeatures = {
    autoQRSync: true,
    cfoDashboard: true,
    pdfReport: true,
    crmCapture: true
  };

  switch(planId) {
    case 'solo':
      return {
        ...baseFeatures,
        maxProducts: 30,
        smsCredits: 0,
        regionalGuardian: false,
        billGuardian: false,
        assetTracking: false,
        staffRoles: false,
        dailyBurn: false,
        sendSms: false,
        restockAlert: false,
        netProfitGauge: false
      };
      
    case 'smart':
      return {
        ...baseFeatures,
        maxProducts: Infinity,
        smsCredits: 500,
        regionalGuardian: true,
        billGuardian: false,
        assetTracking: false,
        staffRoles: false,
        dailyBurn: false,
        sendSms: true,
        restockAlert: true,
        netProfitGauge: true
      };
      
    case 'growth':
      return {
        ...baseFeatures,
        maxProducts: Infinity,
        smsCredits: 2000,
        regionalGuardian: true,
        billGuardian: true,
        assetTracking: true,
        staffRoles: true,
        dailyBurn: true,
        sendSms: true,
        restockAlert: true,
        netProfitGauge: true
      };
      
    case 'mizigo':
      return {
        ...baseFeatures,
        maxProducts: 0,
        smsCredits: 0,
        regionalGuardian: false,
        billGuardian: false,
        assetTracking: true, // Vehicle tracking
        staffRoles: false,
        dailyBurn: true, // Fuel/Lunch/Airtime tracking
        sendSms: false,
        restockAlert: false,
        netProfitGauge: false,
        threeWayQRHandshake: true,
        radialExpressAlert: true,
        groupBuyMatcher: true,
        takeHomeGauge: true
      };
      
    default:
      return baseFeatures;
  }
};

class BillingService {
  assertCanUseSubscriptionPlan(user, planId) {
    const normalizedPlanId = normalizePlanId(planId);

    if (normalizedPlanId === PLAN_IDS.MIZIGO) {
      if (!isMizigoPlanEligible(user)) {
        throw httpError('Mizigo plan is only available for registered logistics accounts.', 403, {
          code: 'LOGISTICS_REGISTRATION_REQUIRED'
        });
      }
      return true;
    }

    if (!isSellerPlanEligible(user)) {
      throw httpError('Buyer accounts cannot activate seller subscription plans. Register as a seller first.', 403, {
        code: 'SELLER_REGISTRATION_REQUIRED'
      });
    }

    return true;
  }

  async assertUserCanUseSubscriptionPlan(userId, planId) {
    const user = await User.findById(userId);
    if (!user) throw httpError('User not found', 404);
    this.assertCanUseSubscriptionPlan(user, planId);
    return user;
  }

  /**
   * Subscribe to a plan
   */
  async subscribe(userId, planId, paymentMethod, paymentMeta = {}) {
    const user = await User.findById(userId);
    if (!user) throw httpError('User not found', 404);

    const normalizedPlanId = normalizePlanId(planId);
    if (!normalizedPlanId || !PLANS[normalizedPlanId]) {
      throw httpError('Invalid plan', 400);
    }

    const plan = PLANS[normalizedPlanId];
    const planName = plan.displayName || plan.name;
    const price = resolvePlanPrice(normalizedPlanId, paymentMeta?.amountOverride);
    this.assertCanUseSubscriptionPlan(user, normalizedPlanId);

    // Validate payment for monthly plans
    if (normalizedPlanId !== 'mizigo') {
      if (paymentMethod !== 'mpesa') {
        throw httpError('M-Pesa is the only supported payment method for monthly plans', 400);
      }
      if (!paymentMeta?.serverVerified) {
        throw httpError('Complete M-Pesa payment before plan activation', 402, {
          requiredPayment: 'subscription',
          requiredAmount: price,
          currency: 'KES'
        });
      }
      if (!paymentMeta?.paymentReference) {
        throw httpError('M-Pesa payment reference is required', 400);
      }
    } else {
      // Mizigo validation
      if (paymentMethod && paymentMethod !== 'commission') {
        throw httpError('Mizigo uses commission settlement, not monthly billing', 400);
      }
    }

    const startDate = new Date();
    const endDate = getCycleEnd(normalizedPlanId);

    // Check if subscription already exists
    let subscription = await Subscription.findOne({ user: userId });
    
    const subscriptionData = {
      plan: normalizedPlanId,
      planName,
      billingModel: normalizedPlanId === 'mizigo' ? 'commission' : 'monthly',
      price: price,
      currency: 'KES',
      status: 'active',
      startDate,
      endDate,
      features: buildFeatures(normalizedPlanId),
      paymentMethod: normalizedPlanId === 'mizigo' ? 'commission' : 'mpesa',
      lastPaymentDate: paymentMeta?.paymentCompleted ? new Date() : null,
      nextBillingDate: normalizedPlanId === 'mizigo' ? null : new Date(startDate.setDate(startDate.getDate() + 30)),
      autoRenew: normalizedPlanId !== 'mizigo',
      smsCredits: buildSmsCredits(normalizedPlanId),
      commission: buildCommission(normalizedPlanId),
      metadata: {
        paymentReference: paymentMeta?.paymentReference || null,
        activatedVia: paymentMeta?.source || 'web',
        previousPlan: subscription?.plan || null,
        priceOverridden: paymentMeta?.amountOverride !== undefined && paymentMeta?.amountOverride !== null,
        managedByAdmin: Boolean(paymentMeta?.managedByAdmin),
        managedBy: paymentMeta?.managedBy || null,
      }
    };

    if (subscription) {
      // Update existing subscription
      Object.assign(subscription, subscriptionData);
      await subscription.save();
    } else {
      // Create new subscription
      subscription = await Subscription.create({ user: userId, ...subscriptionData });
    }

    // Update user record
    user.subscriptionTier = normalizedPlanId;
    user.subscriptionExpiry = endDate;
    await user.save();

    // Record transaction for monthly plans
    if (normalizedPlanId !== 'mizigo' && paymentMeta.paymentReference) {
      await Transaction.create({
        user: userId,
        type: 'subscription_payment',
        amount: price,
        balanceAfter: user.walletBalance || 0,
        reference: paymentMeta.paymentReference,
        description: `M-Pesa payment for Lango ${planName} plan - ${price} KES`,
        metadata: {
          planId: normalizedPlanId,
          planName,
          billingModel: 'monthly',
          includedSmsCredits: SMS_CREDITS[normalizedPlanId],
          paymentCompleted: paymentMeta.paymentCompleted,
          paymentDate: new Date()
        }
      });
    }

    // Send confirmation SMS
    if (user.phone) {
      let message = `You've subscribed to Lango ${planName} plan. `;
      if (normalizedPlanId === 'mizigo') {
        message += `You earn ${subscriptionData.commission.rate}% per delivery. 10% goes to Sinking Fund.`;
      } else {
        message += `${SMS_CREDITS[normalizedPlanId]} SMS credits included. Next billing: ${subscriptionData.nextBillingDate.toLocaleDateString()}`;
      }
      
      await smsQueue.add('send', {
        to: user.phone,
        message
      });
    }

    return subscription;
  }

  async activatePaidSubscription(userId, planId, options = {}) {
    const { paymentReference, payment } = options;

    if (!paymentReference) {
      throw httpError('Verified M-Pesa payment reference is required', 400);
    }

    const alreadyActivatedAt = payment?.metadata?.get
      ? payment.metadata.get('subscriptionActivatedAt')
      : payment?.metadata?.subscriptionActivatedAt;

    if (alreadyActivatedAt) {
      return Subscription.findOne({ user: userId });
    }

    const subscription = await this.subscribe(userId, planId, 'mpesa', {
      paymentCompleted: true,
      paymentReference,
      serverVerified: true,
      source: 'mpesa_verified',
    });

    if (payment) {
      if (!payment.metadata) payment.metadata = new Map();
      if (payment.metadata.set) {
        payment.metadata.set('subscriptionActivatedAt', new Date().toISOString());
      } else {
        payment.metadata.subscriptionActivatedAt = new Date().toISOString();
      }
      await payment.save();
    }

    return subscription;
  }

  /**
   * Subscribe to Mizigo (commission-based plan with special handling)
   */
  async subscribeToCommissionPlan(userId, planId, options = {}) {
    const { paymentReference } = options;
    
    const user = await User.findById(userId);
    if (!user) throw httpError('User not found', 404);
    
    this.assertCanUseSubscriptionPlan(user, planId);
    
    return this.subscribe(userId, planId, 'commission', {
      paymentCompleted: true,
      paymentReference: paymentReference || `MIZIGO_${Date.now()}`,
      source: 'mizigo_onboarding'
    });
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(userId, reason = null) {
    const subscription = await Subscription.findOne({ user: userId });
    if (!subscription) throw httpError('No active subscription found', 404);

    if (['cancelled', 'inactive', 'expired'].includes(subscription.status)) {
      return {
        cancelled: false,
        plan: subscription.plan,
        status: subscription.status,
        message: 'Subscription is already inactive.',
      };
    }

    const cancelledAt = new Date();
    const cancelledPlan = {
      plan: subscription.plan,
      planName: subscription.planName,
      status: subscription.status,
      startDate: subscription.startDate,
      endDate: subscription.endDate,
      price: subscription.price,
      reason: reason || null,
      cancelledAt,
    };

    subscription.status = 'cancelled';
    subscription.cancellationDate = cancelledAt;
    subscription.cancellationReason = reason;
    subscription.autoRenew = false;
    subscription.nextBillingDate = null;
    subscription.paymentMethod = null;
    subscription.metadata = {
      ...(subscription.metadata && typeof subscription.metadata === 'object' ? subscription.metadata : {}),
      lastCancelledPlan: cancelledPlan,
    };
    await subscription.save();

    const user = await User.findById(userId);
    if (user) {
      user.subscriptionTier = null;
      user.subscriptionExpiry = null;
      await user.save();
    }

    if (user?.phone) {
      await smsQueue.add('send', {
        to: user.phone,
        message: `Your Lango ${cancelledPlan.planName} subscription has been cancelled. Reactivate a plan to regain seller subscription access.`
      });
    }

    return {
      cancelled: true,
      plan: subscription.plan,
      status: subscription.status,
      cancelledPlan,
      endDate: subscription.endDate,
      message: 'Subscription cancelled. No plan is active on this account.'
    };
  }

  async setSubscriptionByAdmin(adminId, sellerId, options = {}) {
    const user = await User.findById(sellerId);
    if (!user) throw httpError('Seller not found', 404);
    if (user.role === 'admin') throw httpError('Admin accounts cannot be assigned seller subscriptions', 400);

    const normalizedPlanId = normalizePlanId(options.planId);
    const plan = PLANS[normalizedPlanId];
    if (!plan) throw httpError('Invalid plan', 400);
    this.assertCanUseSubscriptionPlan(user, normalizedPlanId);

    const status = options.status || 'active';
    if (!['active', 'inactive', 'suspended', 'cancelled', 'expired', 'trial'].includes(status)) {
      throw httpError('Invalid subscription status', 400);
    }

    const price = resolvePlanPrice(normalizedPlanId, options.amount);
    const startDate = options.startDate ? new Date(options.startDate) : new Date();
    const endDate = options.endDate
      ? new Date(options.endDate)
      : (normalizedPlanId === PLAN_IDS.MIZIGO ? null : getCycleEnd(normalizedPlanId));

    let subscription = await Subscription.findOne({ user: sellerId });
    const subscriptionData = {
      user: sellerId,
      plan: normalizedPlanId,
      planName: plan.displayName || plan.name,
      billingModel: normalizedPlanId === PLAN_IDS.MIZIGO ? 'commission' : 'monthly',
      price,
      currency: 'KES',
      status,
      startDate,
      endDate,
      features: buildFeatures(normalizedPlanId),
      paymentMethod: normalizedPlanId === PLAN_IDS.MIZIGO ? 'commission' : 'mpesa',
      lastPaymentDate: status === 'active' ? new Date() : null,
      nextBillingDate: normalizedPlanId === PLAN_IDS.MIZIGO || status !== 'active' ? null : endDate,
      autoRenew: Boolean(options.autoRenew),
      smsCredits: buildSmsCredits(normalizedPlanId),
      commission: buildCommission(normalizedPlanId),
      metadata: {
        ...(subscription?.metadata && typeof subscription.metadata === 'object' ? subscription.metadata : {}),
        managedByAdmin: true,
        managedBy: adminId,
        adminNote: options.note || null,
        priceOverridden: options.amount !== undefined && options.amount !== null && options.amount !== '',
        previousPlan: subscription?.plan || null,
        updatedVia: 'admin_subscription_console',
      },
    };

    if (subscription) {
      Object.assign(subscription, subscriptionData);
      await subscription.save();
    } else {
      subscription = await Subscription.create(subscriptionData);
    }

    user.subscriptionTier = status === 'active' ? normalizedPlanId : null;
    user.subscriptionExpiry = status === 'active' ? endDate : null;
    await user.save();

    return subscription;
  }

  /**
   * Change subscription plan (upgrade/downgrade)
   */
  async changePlan(userId, newPlanId, options = {}) {
    const { paymentCompleted, paymentReference, isUpgrade = true } = options;
    
    const currentSubscription = await Subscription.findOne({ user: userId });
    if (!currentSubscription) throw httpError('No active subscription found', 404);
    
    const normalizedNewPlanId = normalizePlanId(newPlanId);
    const newPlan = PLANS[normalizedNewPlanId];
    if (!newPlan) throw httpError('Invalid plan', 400);
    
    // Calculate prorated amount for upgrades
    let proratedAmount = null;
    let daysRemaining = 0;
    if (isUpgrade && currentSubscription.plan !== 'mizigo' && normalizedNewPlanId !== 'mizigo') {
      const currentPrice = PLAN_PRICES[currentSubscription.plan];
      const newPrice = PLAN_PRICES[normalizedNewPlanId];
      daysRemaining = Math.max(0, (currentSubscription.endDate - new Date()) / (1000 * 60 * 60 * 24));
      const daysInMonth = 30;
      const remainingValue = (currentPrice / daysInMonth) * daysRemaining;
      const newPlanCost = (newPrice / daysInMonth) * daysRemaining;
      proratedAmount = money(Math.max(0, newPlanCost - remainingValue));
    }
    
    // For downgrades or if prorated amount is zero/negative, just switch plans
    const paymentNeeded = proratedAmount && proratedAmount > 0;
    
    if (paymentNeeded && !paymentCompleted) {
      throw httpError(`Payment of ${proratedAmount} KES required for plan upgrade`, 402, {
        requiredPayment: 'plan_upgrade',
        requiredAmount: proratedAmount,
        currency: 'KES',
        fromPlan: currentSubscription.plan,
        toPlan: normalizedNewPlanId
      });
    }
    
    // Create new subscription (this will replace the old one)
    const paymentMethod = normalizedNewPlanId === 'mizigo' ? 'commission' : 'mpesa';
    const newSubscription = await this.subscribe(userId, normalizedNewPlanId, paymentMethod, {
      paymentCompleted: !paymentNeeded || paymentCompleted,
      paymentReference: paymentReference || `UPGRADE_${Date.now()}`,
      serverVerified: !paymentNeeded,
      source: 'plan_change',
      previousPlan: currentSubscription.plan,
      proratedAmount
    });
    
    // Record upgrade transaction
    if (paymentNeeded && paymentCompleted && paymentReference) {
      await Transaction.create({
        user: userId,
        type: 'subscription_payment',
        amount: proratedAmount,
        balanceAfter: 0,
        reference: paymentReference,
        description: `Upgrade from ${currentSubscription.planName} to ${newPlan.displayName || newPlan.name} - ${proratedAmount} KES`,
        metadata: {
          fromPlan: currentSubscription.plan,
          toPlan: normalizedNewPlanId,
          prorated: true,
          daysRemaining
        }
      });
    }
    
    return newSubscription;
  }

  /**
   * Top up SMS credits (for Smart and Growth plans)
   */
  async topupSmsCredits(userId, amount, paymentReference) {
    const amountNum = Number(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      throw httpError('Invalid top-up amount', 400);
    }
    
    const subscription = await Subscription.findOne({ user: userId });
    if (!subscription) throw httpError('No subscription found', 404);
    
    if (subscription.plan !== 'smart' && subscription.plan !== 'growth') {
      throw httpError('SMS credits are only available on Smart and Growth plans', 403);
    }
    
    if (!paymentReference) {
      throw httpError('M-Pesa payment reference is required', 400);
    }
    
    // Calculate credits: 1 KES = 1 SMS credit (example rate)
    const creditsToAdd = amountNum;

    const currentCredits = getSmsCreditState(subscription);
    const newAllocated = currentCredits.allocated + creditsToAdd;
    const newBalance = Math.max(0, newAllocated - currentCredits.used);

    setSmsCreditState(subscription, {
      allocated: newAllocated,
      used: currentCredits.used
    });
    addSmsTopUpHistory(subscription, {
      amount: amountNum,
      credits: creditsToAdd,
      reference: paymentReference,
      date: new Date()
    });
    
    await subscription.save();
    
    // Record transaction
    const user = await User.findById(userId);
    await Transaction.create({
      user: userId,
      type: 'sms_topup',
      amount: amountNum,
      balanceAfter: user?.walletBalance || 0,
      reference: paymentReference,
      description: `SMS credit top-up: ${creditsToAdd} credits for ${amountNum} KES`,
      metadata: {
        creditsAdded: creditsToAdd,
        planId: subscription.plan,
        newBalance
      }
    });
    
    // Send confirmation
    if (user?.phone) {
      await smsQueue.add('send', {
        to: user.phone,
        message: `You've added ${creditsToAdd} SMS credits. New balance: ${newBalance} credits.`
      });
    }
    
    return {
      creditsAdded: creditsToAdd,
      newBalance,
      totalSpent: amountNum
    };
  }

  async topUpSmsCredits(userId, options = {}) {
    const { credits, amount, paymentReference, paymentCompleted } = options;

    if (!paymentCompleted) {
      throw httpError('Payment must be completed before SMS credits are added', 402, {
        requiredPayment: 'sms_credits',
        requiredAmount: Number(amount || credits || 0),
        currency: 'KES'
      });
    }

    return this.topupSmsCredits(userId, credits || amount, paymentReference);
  }

  /**
   * Consume SMS credits (when sending SMS)
   */
  async consumeSmsCredits(userId, count = 1) {
    const creditCount = Number(count);
    if (!Number.isInteger(creditCount) || creditCount <= 0) {
      throw httpError('SMS credit usage must be a positive whole number', 400);
    }
    
    const subscription = await Subscription.findOne({ user: userId });
    if (!subscription) throw httpError('No subscription found', 404);
    
    if (subscription.plan !== 'smart' && subscription.plan !== 'growth') {
      throw httpError('SMS sending is only available on Smart and Growth plans', 403);
    }
    
    const currentCredits = getSmsCreditState(subscription);
    if (currentCredits.balance < creditCount) {
      const error = new Error('Insufficient SMS credits. Please top up via M-Pesa.');
      error.statusCode = 402;
      error.requiredPayment = 'sms_credits';
      error.currentBalance = currentCredits.balance;
      error.required = creditCount;
      throw error;
    }

    const newUsed = currentCredits.used + creditCount;
    const newBalance = Math.max(0, currentCredits.allocated - newUsed);
    setSmsCreditState(subscription, {
      allocated: currentCredits.allocated,
      used: newUsed
    });
    await subscription.save();
    
    return {
      success: true,
      balance: newBalance,
      usedThisCycle: newUsed,
      creditsConsumed: creditCount
    };
  }

  /**
   * Record daily operational expense (for Growth plan)
   */
  async recordDailyBurn(userId, expenseData) {
    const { type, amount, description, date } = expenseData;
    
    const subscription = await Subscription.findOne({ user: userId });
    if (!subscription) throw httpError('No subscription found', 404);
    
    if (subscription.plan !== 'growth' && subscription.plan !== 'mizigo') {
      throw httpError('Daily burn tracking is only available on Growth and Mizigo plans', 403);
    }
    
    if (!subscription.metadata.dailyBurn) {
      subscription.metadata.dailyBurn = {
        expenses: [],
        totalToday: 0,
        lastUpdated: new Date()
      };
    }
    
    const expense = {
      type,
      amount: Number(amount),
      description: description || '',
      date: date || new Date(),
      recordedAt: new Date()
    };
    
    subscription.metadata.dailyBurn.expenses.push(expense);
    subscription.metadata.dailyBurn.totalToday += expense.amount;
    subscription.metadata.dailyBurn.lastUpdated = new Date();
    
    await subscription.save();
    
    return expense;
  }

  /**
   * Record Mizigo delivery trip
   */
  async recordDeliveryTrip(userId, tripData) {
    const { distance, earnings, cargoWeight, from, to, verificationCode } = tripData;
    
    const subscription = await Subscription.findOne({ user: userId });
    if (!subscription) throw httpError('No subscription found', 404);
    if (subscription.plan !== 'mizigo') throw httpError('Trip recording only for Mizigo plan', 403);
    
    const commissionRate = subscription.commission.rate;
    const commission = earnings * (commissionRate / 100);
    const sinkingFundContribution = earnings * (subscription.commission.sinkingFundRate / 100);
    const driverEarnings = earnings - commission - sinkingFundContribution;
    
    // Update subscription
    subscription.commission.tripsCompleted += 1;
    subscription.commission.totalCommission += commission;
    subscription.commission.totalDriverEarnings += driverEarnings;
    subscription.commission.sinkingFundBalance += sinkingFundContribution;
    
    if (!subscription.metadata.trips) {
      subscription.metadata.trips = [];
    }
    
    subscription.metadata.trips.push({
      distance,
      earnings,
      commission,
      sinkingFund: sinkingFundContribution,
      driverEarnings,
      cargoWeight,
      from,
      to,
      verificationCode,
      date: new Date()
    });
    
    await subscription.save();
    
    return {
      commission,
      sinkingFundContribution,
      driverEarnings,
      newBalance: subscription.commission.sinkingFundBalance,
      totalTrips: subscription.commission.tripsCompleted
    };
  }

  /**
   * Handle auto-renewal via M-Pesa
   */
  async handleAutoRenewal(subscriptionId) {
    const subscription = await Subscription.findById(subscriptionId);
    if (!subscription) throw httpError('Subscription not found', 404);
    
    if (!subscription.autoRenew || subscription.plan === 'mizigo') {
      return { renewed: false, reason: 'Auto-renewal disabled or Mizigo plan' };
    }
    
    const user = await User.findById(subscription.user);
    if (!user) throw httpError('User not found', 404);
    
    // Attempt M-Pesa charge
    // This would integrate with M-Pesa API
    const paymentSuccessful = true; // Simulated
    
    if (paymentSuccessful) {
      const newEndDate = new Date();
      newEndDate.setDate(newEndDate.getDate() + 30);
      
      subscription.endDate = newEndDate;
      subscription.nextBillingDate = newEndDate;
      subscription.lastPaymentDate = new Date();
      setSmsCreditState(subscription, {
        allocated: SMS_CREDITS[subscription.plan] || 0,
        used: 0
      });
      
      await subscription.save();
      
      // Send renewal confirmation
      if (user.phone) {
        await smsQueue.add('send', {
          to: user.phone,
          message: `Your Lango ${subscription.planName} plan has been renewed for ${subscription.price} KES. Next billing: ${newEndDate.toLocaleDateString()}`
        });
      }
      
      return { renewed: true, newEndDate };
    } else {
      subscription.status = 'expired';
      await subscription.save();
      
      return { renewed: false, reason: 'Payment failed' };
    }
  }

  /**
   * Handle payment webhook
   */
  async handleWebhook(payload) {
    logger.info('Billing webhook received', { type: payload.event, reference: payload.reference });
    
    switch(payload.event) {
      case 'subscription.payment.success':
        await this.handleSuccessfulPayment(payload);
        break;
      case 'subscription.payment.failed':
        await this.handleFailedPayment(payload);
        break;
      case 'sms.topup.success':
        await this.handleSmsTopup(payload);
        break;
      default:
        logger.info('Unhandled webhook event', payload);
    }
    
    return { received: true };
  }

  async handleSuccessfulPayment(payload) {
    const { userId, subscriptionId, reference, amount } = payload;
    
    const subscription = await Subscription.findById(subscriptionId);
    if (subscription) {
      subscription.lastPaymentDate = new Date();
      subscription.metadata.lastPaymentReference = reference;
      await subscription.save();
    }
    
    logger.info('Payment processed successfully', { userId, subscriptionId, amount });
  }

  async handleFailedPayment(payload) {
    const { userId, subscriptionId, reason } = payload;
    
    const subscription = await Subscription.findById(subscriptionId);
    if (subscription) {
      subscription.status = 'suspended';
      subscription.metadata.lastPaymentFailure = {
        reason,
        date: new Date()
      };
      await subscription.save();
    }
    
    logger.warn('Payment failed', { userId, subscriptionId, reason });
  }

  async handleSmsTopup(payload) {
    const { userId, amount, credits, reference } = payload;
    await this.topupSmsCredits(userId, amount, reference);
  }
}

module.exports = new BillingService();
