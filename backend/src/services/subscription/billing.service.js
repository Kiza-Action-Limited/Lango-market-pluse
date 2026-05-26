const Subscription = require('../../models/Subscription.model');
const User = require('../../models/User.model');
const planService = require('./plan.service');
const { PLAN_IDS } = require('../../config/subscriptionPlans');
const { smsQueue } = require('../../config/redis');
const logger = require('../../utils/logger');

class BillingService {
  async subscribe(userId, planId, paymentMethod, paymentMeta = {}) {
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    const normalizedPlanId = planService.normalizePlan(planId);
    const plan = planService.getPlanById(normalizedPlanId);
    if (!plan) throw new Error('Invalid plan');
    const normalizedPaymentMethod = paymentMethod || 'mpesa';
    if (plan.billingType === 'monthly' && normalizedPaymentMethod !== 'mpesa') {
      throw new Error('M-Pesa is the only supported payment method');
    }

    // Charge payment for monthly plans only
    if (plan.billingType === 'monthly' && plan.priceKes > 0) {
      if (!paymentMeta?.paymentCompleted) {
        throw new Error('Payment must be completed before plan activation');
      }
      if (!paymentMeta?.paymentReference) {
        throw new Error('M-Pesa payment reference is required');
      }
    }

    // Create or update subscription
    let subscription = await Subscription.findOne({ user: userId });
    const startDate = new Date();
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
    }
    await subscription.save();

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

    return subscription;
  }

  async cancelSubscription(userId) {
    const subscription = await Subscription.findOne({ user: userId });
    if (!subscription) throw new Error('No active subscription');
    subscription.status = 'canceled';
    await subscription.save();

    // Downgrade user to solo
    const user = await User.findById(userId);
    user.subscriptionTier = PLAN_IDS.SOLO;
    user.subscriptionExpiry = null;
    user.smsCredits = 0;
    await user.save();

    return { cancelled: true };
  }

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
  }

  async handleWebhook(payload) {
    // For auto-renewal from external billing
    logger.info('Billing webhook received', payload);
  }
}

module.exports = new BillingService();
