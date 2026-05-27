const Subscription = require('../../models/Subscription.model');
const Transaction = require('../../models/Transaction.model');
const User = require('../../models/User.model');
const planService = require('./plan.service');
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

    const normalizedPlanId = normalizePlanId(planId);
    const plan = planService.getPlan(normalizedPlanId);
    if (!plan) throw new Error('Invalid plan');

    if (plan.billingModel === 'monthly') {
      if (paymentMethod !== 'mpesa') throw new Error('M-Pesa is the only supported payment method');
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
    }

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

    return subscription;
  }

  async cancelSubscription(userId) {
    const subscription = await Subscription.findOne({ user: userId });
    if (!subscription) throw new Error('No active subscription');
    subscription.status = 'canceled';
    await subscription.save();

    const user = await User.findById(userId);
    if (user) {
      user.subscriptionTier = 'solo';
      user.subscriptionExpiry = null;
      await user.save();
    }

    return { cancelled: true };
  }

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
  }

  async handleWebhook(payload) {
    logger.info('Billing webhook received', payload);
  }
}

module.exports = new BillingService();
