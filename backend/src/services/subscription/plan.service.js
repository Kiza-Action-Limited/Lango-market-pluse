const Subscription = require('../../models/Subscription.model');
<<<<<<< HEAD
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
=======
const { PLANS, normalizePlanId, getPlan } = require('../../config/subscriptionPlans');
>>>>>>> a4ca05ef18bdd6473e0d7b4cf68582b8dde40cd6

const buildFeatureMap = (plan) => new Map(Object.entries(plan.features));

class PlanService {
  getPlans() {
<<<<<<< HEAD
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
=======
    return Object.values(PLANS);
>>>>>>> a4ca05ef18bdd6473e0d7b4cf68582b8dde40cd6
  }

  async getUserSubscription(userId) {
    let subscription = await Subscription.findOne({ user: userId });

    if (!subscription) {
<<<<<<< HEAD
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
=======
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
>>>>>>> a4ca05ef18bdd6473e0d7b4cf68582b8dde40cd6
  }

  async checkFeatureAccess(userId, feature) {
    const sub = await this.getUserSubscription(userId);
<<<<<<< HEAD
    const plan = getPlan(sub.plan);
    if (!sub.isActive || !plan) return false;
    return Boolean(plan.features[feature] || sub.features?.get(feature));
  }

  async checkTierAccess(userId, requiredTier) {
    const sub = await this.getUserSubscription(userId);
    if (!sub.isActive) return false;
    return meetsTier(sub.plan, requiredTier);
=======
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
>>>>>>> a4ca05ef18bdd6473e0d7b4cf68582b8dde40cd6
  }
}

module.exports = new PlanService();
