const Subscription = require('../../models/Subscription.model');
const User = require('../../models/User.model');
const walletService = require('../payment/wallet.service');
const planService = require('./plan.service');
const { smsQueue } = require('../../config/redis');
const logger = require('../../utils/logger');

class BillingService {
  async subscribe(userId, planId, paymentMethod, paymentMeta = {}) {
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    const plan = planService.getPlans().find(p => p.id === planId);
    if (!plan) throw new Error('Invalid plan');
    if (paymentMethod !== 'mpesa') throw new Error('M-Pesa is the only supported payment method');

    // Charge payment
    if (plan.price > 0) {
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
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1); // Monthly billing

    if (subscription) {
      subscription.plan = planId;
      subscription.status = 'active';
      subscription.startDate = startDate;
      subscription.endDate = endDate;
      subscription.features = new Map(Object.entries(plan.features));
      subscription.paymentMethod = 'mpesa';
      subscription.lastPaymentId = paymentMeta?.paymentReference || null;
    } else {
      subscription = await Subscription.create({
        user: userId,
        plan: planId,
        startDate,
        endDate,
        features: plan.features,
        paymentMethod: 'mpesa',
        lastPaymentId: paymentMeta?.paymentReference || null,
      });
    }
    await subscription.save();

    // Update user's subscription tier
    user.subscriptionTier = planId;
    user.subscriptionExpiry = endDate;
    await user.save();

    await smsQueue.add('send', {
      to: user.phone,
      message: `You've subscribed to the ${planId} plan. Thank you!`,
    });

    return subscription;
  }

  async cancelSubscription(userId) {
    const subscription = await Subscription.findOne({ user: userId });
    if (!subscription) throw new Error('No active subscription');
    subscription.status = 'canceled';
    await subscription.save();

    // Downgrade user to free
    const user = await User.findById(userId);
    user.subscriptionTier = 'free';
    user.subscriptionExpiry = null;
    await user.save();

    return { cancelled: true };
  }

  async changePlan(userId, newPlanId) {
    // Cancel current and subscribe to new
    await this.cancelSubscription(userId);
    return await this.subscribe(userId, newPlanId, 'mpesa', {
      paymentCompleted: true,
      paymentReference: `manual-change-${Date.now()}`,
    });
  }

  async handleWebhook(payload) {
    // For auto-renewal from external billing
    logger.info('Billing webhook received', payload);
  }
}

module.exports = new BillingService();
