const Subscription = require('../../models/Subscription.model');
const User = require('../../models/User.model');
const { walletService } = require('../payment/wallet.service');
const logger = require('../../utils/logger');

const PLANS = {
  free: { price: 0, features: { escrow: false, groupBuying: false, scarcityAlerts: false, predictiveAnalytics: false, prioritySupport: false } },
  v3: { price: 500, features: { escrow: true, groupBuying: false, scarcityAlerts: true, predictiveAnalytics: false, prioritySupport: false } },
  v4: { price: 1500, features: { escrow: true, groupBuying: true, scarcityAlerts: true, predictiveAnalytics: true, prioritySupport: true } },
};

class PlanService {
  getPlans() {
    return Object.entries(PLANS).map(([id, details]) => ({ id, ...details }));
  }

  async getUserSubscription(userId) {
    let subscription = await Subscription.findOne({ user: userId });
    if (!subscription) {
      // Default free plan
      subscription = await Subscription.create({
        user: userId,
        plan: 'free',
        status: 'active',
        startDate: new Date(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        features: PLANS.free.features,
      });
    }
    return subscription;
  }

  async checkFeatureAccess(userId, feature) {
    const sub = await this.getUserSubscription(userId);
    return sub.isActive && sub.features.get(feature) === true;
  }
}

module.exports = new PlanService();