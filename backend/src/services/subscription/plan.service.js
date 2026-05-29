const Subscription = require('../../models/Subscription.model');
const {
  PLANS,
  PLAN_IDS,
  normalizePlanId,
  getPlan,
  meetsTier,
} = require('../../config/subscriptionPlans');

const monthFromNow = () => {
  const endDate = new Date();
  endDate.setMonth(endDate.getMonth() + 1);
  return endDate;
};

const buildFeatureMap = (plan) => new Map(Object.entries(plan.features));

class PlanService {
  getPlans() {
    return Object.values(PLANS).map((plan) => ({
      ...plan,
      features: { ...plan.features },
      lockedFeatures: { ...plan.lockedFeatures },
    }));
  }

  getPlan(planId) {
    return getPlan(planId);
  }

  normalizePlanId(planId) {
    return normalizePlanId(planId);
  }

  async getUserSubscription(userId) {
    let subscription = await Subscription.findOne({ user: userId });

    if (!subscription) {
      const plan = PLANS[PLAN_IDS.SOLO];
      subscription = await Subscription.create({
        user: userId,
        plan: plan.id,
        billingModel: plan.billingModel,
        price: plan.price,
        currency: plan.currency,
        status: 'active',
        startDate: new Date(),
        endDate: monthFromNow(),
        features: plan.features,
        smsCredits: {
          balance: plan.includedSmsCredits,
          includedPerCycle: plan.includedSmsCredits,
          usedThisCycle: 0,
          purchasedThisCycle: 0,
        },
      });
    }

    const normalizedPlanId = normalizePlanId(subscription.plan);
    const plan = PLANS[normalizedPlanId];
    if (plan && subscription.plan !== normalizedPlanId) {
      subscription.plan = normalizedPlanId;
      subscription.billingModel = plan.billingModel;
      subscription.price = plan.price;
      subscription.currency = plan.currency;
      subscription.features = buildFeatureMap(plan);
      await subscription.save();
    }

    return subscription;
  }

  async getEntitlements(userId) {
    const subscription = await this.getUserSubscription(userId);
    const plan = getPlan(subscription.plan);
    const active = Boolean(subscription.isActive);

    return {
      planId: normalizePlanId(subscription.plan),
      active,
      billingModel: plan?.billingModel,
      skuLimit: active ? plan?.skuLimit ?? null : 0,
      includedSmsCredits: plan?.includedSmsCredits ?? 0,
      smsCredits: subscription.smsCredits || {},
      features: plan?.features || {},
      lockedFeatures: active ? plan?.lockedFeatures || {} : {},
      nextPlan: plan?.nextPlan || null,
      subscription,
    };
  }

  async checkFeatureAccess(userId, feature) {
    const sub = await this.getUserSubscription(userId);
    const plan = getPlan(sub.plan);
    if (!sub.isActive || !plan) return false;
    return Boolean(plan.features[feature] || sub.features?.get(feature));
  }

  async checkTierAccess(userId, requiredTier) {
    const sub = await this.getUserSubscription(userId);
    if (!sub.isActive) return false;
    return meetsTier(sub.plan, requiredTier);
  }
}

module.exports = new PlanService();
