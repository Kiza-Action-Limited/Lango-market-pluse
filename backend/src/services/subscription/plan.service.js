const Subscription = require('../../models/Subscription.model');
const { PLANS, normalizePlanId, getPlan } = require('../../config/subscriptionPlans');

class PlanService {
  getPlans() {
    return Object.values(PLANS);
  }

  async getUserSubscription(userId) {
    let subscription = await Subscription.findOne({ user: userId });
    if (!subscription) {
      const soloPlan = getPlan('solo');
      subscription = await Subscription.create({
        user: userId,
        plan: soloPlan.id,
        status: 'active',
        startDate: new Date(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        features: new Map(Object.entries(soloPlan.features)),
      });
    }
    if (subscription.plan !== normalizePlanId(subscription.plan)) {
      subscription.plan = normalizePlanId(subscription.plan);
      await subscription.save();
    }
    return subscription;
  }

  getPlanById(planId) {
    return getPlan(planId);
  }

  normalizePlan(planId) {
    return normalizePlanId(planId);
  }

  async checkFeatureAccess(userId, feature) {
    const sub = await this.getUserSubscription(userId);
    if (!sub?.isActive) return false;

    const normalizedPlan = normalizePlanId(sub.plan);
    const plan = getPlan(normalizedPlan);
    if (plan?.features?.[feature] === true) return true;

    return sub.features?.get?.(feature) === true;
  }

  async getEffectivePlanForUser(user) {
    if (!user) return getPlan('solo');

    const directTier = normalizePlanId(user.subscriptionTier);
    if (directTier) {
      return getPlan(directTier);
    }

    const sub = await this.getUserSubscription(user._id || user.id);
    return getPlan(sub.plan);
  }
}

module.exports = new PlanService();
