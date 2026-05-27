const Subscription = require('../../models/Subscription.model');
const Transaction = require('../../models/Transaction.model');
const User = require('../../models/User.model');
const planService = require('./plan.service');
const { PLAN_IDS } = require('../../config/subscriptionPlans');
const { smsQueue } = require('../../config/redis');
const { normalizePlanId } = require('../../config/subscriptionPlans');
const logger = require('../../utils/logger');

const getCycleEnd = (plan) => {
  if (plan.billingModel === 'commission') {
    const farFuture = new Date();
    farFuture.setFullYear(farFuture.getFullYear() + 20);
    return farFuture;
  }

  const endDate = new Date();
  endDate.setMonth(endDate.getMonth() + 1);
  return endDate;
};

const buildSmsCredits = (plan) => ({
  balance: plan.includedSmsCredits || 0,
  includedPerCycle: plan.includedSmsCredits || 0,
  usedThisCycle: 0,
  purchasedThisCycle: 0,
});

const buildCommission = (plan) => ({
  minRate: plan.commissionRate?.min || 0,
  maxRate: plan.commissionRate?.max || 0,
  sinkingFundRate: plan.sinkingFundRate || 0,
});

class BillingService {
  async subscribe(userId, planId, paymentMethod, paymentMeta = {}) {
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

<<<<<<< HEAD
    const normalizedPlanId = normalizePlanId(planId);
    const plan = planService.getPlan(normalizedPlanId);
    if (!plan) throw new Error('Invalid plan');

    if (plan.billingModel === 'monthly') {
      if (paymentMethod !== 'mpesa') throw new Error('M-Pesa is the only supported payment method');
=======
    const normalizedPlanId = planService.normalizePlan(planId);
    const plan = planService.getPlanById(normalizedPlanId);
    if (!plan) throw new Error('Invalid plan');
    const normalizedPaymentMethod = paymentMethod || 'mpesa';
    if (plan.billingType === 'monthly' && normalizedPaymentMethod !== 'mpesa') {
      throw new Error('M-Pesa is the only supported payment method');
    }

    // Charge payment for monthly plans only
    if (plan.billingType === 'monthly' && plan.priceKes > 0) {
>>>>>>> a4ca05ef18bdd6473e0d7b4cf68582b8dde40cd6
      if (!paymentMeta?.paymentCompleted) {
        throw new Error('Payment must be completed before plan activation');
      }
      if (!paymentMeta?.paymentReference) {
        throw new Error('M-Pesa payment reference is required');
      }
    } else if (paymentMethod && paymentMethod !== 'commission') {
      throw new Error('Mizigo uses commission settlement, not monthly billing');
    }

    const startDate = new Date();
<<<<<<< HEAD
    const endDate = getCycleEnd(plan);

    let subscription = await Subscription.findOne({ user: userId });
    const payload = {
      plan: normalizedPlanId,
      billingModel: plan.billingModel,
      price: plan.price,
      currency: plan.currency,
      status: 'active',
      startDate,
      endDate,
      features: new Map(Object.entries(plan.features)),
      paymentMethod: plan.billingModel === 'commission' ? 'commission' : 'mpesa',
      lastPaymentId: paymentMeta?.paymentReference || null,
      smsCredits: buildSmsCredits(plan),
      commission: buildCommission(plan),
    };

    if (subscription) {
      Object.assign(subscription, payload);
      await subscription.save();
    } else {
      subscription = await Subscription.create({ user: userId, ...payload });
=======
    const endDate = plan.billingType === 'monthly'
      ? new Date(new Date(startDate).setMonth(startDate.getMonth() + 1))
      : null;

    if (subscription) {
      subscription.plan = normalizedPlanId;
      subscription.status = 'active';
      subscription.startDate = startDate;
      subscription.endDate = endDate;
      subscription.features = new Map(Object.entries(plan.features));
      subscription.paymentMethod = normalizedPaymentMethod || null;
      subscription.lastPaymentId = paymentMeta?.paymentReference || null;
    } else {
      subscription = await Subscription.create({
        user: userId,
        plan: normalizedPlanId,
        startDate,
        endDate,
        features: new Map(Object.entries(plan.features)),
        paymentMethod: normalizedPaymentMethod || null,
        lastPaymentId: paymentMeta?.paymentReference || null,
      });
>>>>>>> a4ca05ef18bdd6473e0d7b4cf68582b8dde40cd6
    }

<<<<<<< HEAD
    user.subscriptionTier = normalizedPlanId;
    user.subscriptionExpiry = endDate;
    if (normalizedPlanId === 'mizigo' && user.role !== 'logistics') {
      user.role = 'logistics';
    }
    await user.save();

    if (plan.billingModel === 'monthly') {
      await Transaction.create({
        user: userId,
        type: 'subscription_payment',
        amount: plan.price,
        balanceAfter: user.walletBalance || 0,
        reference: paymentMeta.paymentReference,
        description: `M-Pesa subscription payment for ${plan.displayName}`,
        metadata: {
          planId: normalizedPlanId,
          billingModel: plan.billingModel,
          includedSmsCredits: plan.includedSmsCredits,
        },
      });
    }

    if (user.phone) {
      await smsQueue.add('send', {
        to: user.phone,
        message: `You've subscribed to Lango ${plan.displayName}. Your plan is active.`,
      });
    }
=======
    // Update user's subscription tier
    user.subscriptionTier = normalizedPlanId;
    user.subscriptionExpiry = endDate;
    if (plan.billingType === 'monthly') {
      user.smsCredits = plan.smsCreditsPerCycle || 0;
    } else if (normalizedPlanId === PLAN_IDS.MIZIGO) {
      user.smsCredits = 0;
    }
    await user.save();

    await smsQueue.add('send', {
      to: user.phone,
      message: `You've subscribed to the ${plan.name} plan. Thank you!`,
    });
>>>>>>> a4ca05ef18bdd6473e0d7b4cf68582b8dde40cd6

    return subscription;
  }

  async cancelSubscription(userId) {
    const subscription = await Subscription.findOne({ user: userId });
    if (!subscription) throw new Error('No active subscription');
    subscription.status = 'canceled';
    await subscription.save();

<<<<<<< HEAD
    const user = await User.findById(userId);
    if (user) {
      user.subscriptionTier = 'solo';
      user.subscriptionExpiry = null;
      await user.save();
    }
=======
    // Downgrade user to solo
    const user = await User.findById(userId);
    user.subscriptionTier = PLAN_IDS.SOLO;
    user.subscriptionExpiry = null;
    user.smsCredits = 0;
    await user.save();
>>>>>>> a4ca05ef18bdd6473e0d7b4cf68582b8dde40cd6

    return { cancelled: true };
  }

<<<<<<< HEAD
  async changePlan(userId, newPlanId, paymentMeta = {}) {
    const normalizedPlanId = normalizePlanId(newPlanId);
    const plan = planService.getPlan(normalizedPlanId);
    if (!plan) throw new Error('Invalid plan');

    const paymentMethod = plan.billingModel === 'commission' ? 'commission' : 'mpesa';
    return this.subscribe(userId, normalizedPlanId, paymentMethod, paymentMeta);
  }

  async topUpSmsCredits(userId, { credits, amount, paymentReference, paymentCompleted }) {
    const purchasedCredits = Number(credits);
    if (!Number.isInteger(purchasedCredits) || purchasedCredits <= 0) {
      throw new Error('SMS credit top-up must be a positive whole number');
    }
    if (!paymentCompleted) throw new Error('Payment must be completed before SMS credits are added');
    if (!paymentReference) throw new Error('M-Pesa payment reference is required');

    const [subscription, user] = await Promise.all([
      planService.getUserSubscription(userId),
      User.findById(userId),
    ]);
    if (!user) throw new Error('User not found');

    subscription.smsCredits.balance += purchasedCredits;
    subscription.smsCredits.purchasedThisCycle += purchasedCredits;
    subscription.smsCredits.lastTopUpAt = new Date();
    await subscription.save();

    await Transaction.create({
      user: userId,
      type: 'sms_topup',
      amount: Number(amount || 0),
      balanceAfter: user.walletBalance || 0,
      reference: paymentReference,
      description: `SMS credit top-up: ${purchasedCredits} credits`,
      metadata: {
        credits: purchasedCredits,
        planId: subscription.plan,
      },
    });

    return {
      creditsAdded: purchasedCredits,
      balance: subscription.smsCredits.balance,
    };
  }

  async consumeSmsCredits(userId, count = 1) {
    const creditCount = Number(count);
    if (!Number.isInteger(creditCount) || creditCount <= 0) {
      throw new Error('SMS credit usage must be a positive whole number');
    }

    const subscription = await planService.getUserSubscription(userId);
    if ((subscription.smsCredits?.balance || 0) < creditCount) {
      const error = new Error('SMS credits exhausted. Top up via M-Pesa or upgrade your plan.');
      error.statusCode = 402;
      error.requiredPayment = 'sms_credits';
      throw error;
    }

    subscription.smsCredits.balance -= creditCount;
    subscription.smsCredits.usedThisCycle += creditCount;
    await subscription.save();

    return {
      balance: subscription.smsCredits.balance,
      usedThisCycle: subscription.smsCredits.usedThisCycle,
    };
=======
  async changePlan(userId, newPlanId) {
    const normalizedPlanId = planService.normalizePlan(newPlanId);
    const targetPlan = planService.getPlanById(normalizedPlanId);
    if (!targetPlan) throw new Error('Invalid target plan');

    const paymentMeta = targetPlan.billingType === 'monthly'
      ? {
          paymentCompleted: true,
          paymentReference: `manual-change-${Date.now()}`,
        }
      : {};

    return await this.subscribe(userId, normalizedPlanId, 'mpesa', paymentMeta);
>>>>>>> a4ca05ef18bdd6473e0d7b4cf68582b8dde40cd6
  }

  async handleWebhook(payload) {
    logger.info('Billing webhook received', payload);
  }
}

module.exports = new BillingService();
