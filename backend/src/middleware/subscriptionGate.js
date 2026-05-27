const planService = require('../services/subscription/plan.service');
<<<<<<< HEAD
const billingService = require('../services/subscription/billing.service');
const { normalizePlanId, meetsTier } = require('../config/subscriptionPlans');

const isLogisticsBypass = (user) => (
  user?.role === 'logistics' || normalizePlanId(user?.subscriptionTier) === 'mizigo'
);

/**
 * Checks whether the user's active plan allows a feature or minimum tier.
 * Plan 4 logistics users bypass monthly subscription checks.
 */
const subscriptionGate = (requiredTier = 'solo', feature = null) => {
=======
const { PLAN_IDS, TIER_ORDER } = require('../config/subscriptionPlans');

/**
 * Middleware to check if user's subscription plan allows access to a feature.
 * @param {string|string[]} requiredTier - Minimum tier(s) required.
 * @param {string} [feature] - Specific feature name (e.g., 'groupBuying', 'scarcityAlerts')
 * @returns {Function} Express middleware
 */
const subscriptionGate = (requiredTier, feature = null) => {
  const requiredTiers = Array.isArray(requiredTier) ? requiredTier : [requiredTier];

>>>>>>> a4ca05ef18bdd6473e0d7b4cf68582b8dde40cd6
  return async (req, res, next) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required.',
        });
      }

<<<<<<< HEAD
      if (isLogisticsBypass(user)) {
        return next();
      }

      const subscription = await planService.getUserSubscription(user.id || user._id);
      const currentTier = normalizePlanId(subscription.plan || user.subscriptionTier || 'solo');
      const normalizedRequiredTier = normalizePlanId(requiredTier);
=======
      if (user.role === 'admin') {
        return next();
      }

      const userTier = planService.normalizePlan(user.subscriptionTier || PLAN_IDS.SOLO);
      const normalizedRequired = requiredTiers.map((tier) => planService.normalizePlan(tier));

      const hasRequiredTier = normalizedRequired.some((tier) => {
        if (tier === PLAN_IDS.MIZIGO) {
          return userTier === PLAN_IDS.MIZIGO;
        }
        if (userTier === PLAN_IDS.MIZIGO) {
          return false;
        }
        return (TIER_ORDER[userTier] || 0) >= (TIER_ORDER[tier] || 0);
      });
>>>>>>> a4ca05ef18bdd6473e0d7b4cf68582b8dde40cd6

      if (!subscription.isActive || !meetsTier(currentTier, normalizedRequiredTier)) {
        return res.status(403).json({
          success: false,
<<<<<<< HEAD
          message: `This feature requires the ${normalizedRequiredTier.toUpperCase()} plan or higher. Please upgrade.`,
          requiredTier: normalizedRequiredTier,
          currentTier,
          upgradePrompt: `Upgrade to ${normalizedRequiredTier} to unlock this feature.`,
=======
          message: `This feature requires one of: ${normalizedRequired.join(', ')}.`,
          requiredTier: normalizedRequired,
          currentTier: userTier,
>>>>>>> a4ca05ef18bdd6473e0d7b4cf68582b8dde40cd6
        });
      }

      if (feature) {
        const hasFeature = await planService.checkFeatureAccess(user.id || user._id, feature);
        if (!hasFeature) {
          const entitlements = await planService.getEntitlements(user.id || user._id);
          return res.status(403).json({
            success: false,
            message: `Feature "${feature}" is not included in your current plan.`,
            currentTier,
            nextPlan: entitlements.nextPlan,
            upgradePrompt: entitlements.lockedFeatures?.[feature] || 'Upgrade your plan to unlock this feature.',
          });
        }
      }

      next();
    } catch (err) {
      next(err);
    }
  };
};

<<<<<<< HEAD
const checkCredits = (count = 1) => async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
    }

    if (isLogisticsBypass(req.user)) return next();

    const result = await billingService.consumeSmsCredits(req.user.id || req.user._id, count);
    req.smsCreditUsage = result;
    next();
  } catch (err) {
    if (err.statusCode === 402) {
      return res.status(402).json({
        success: false,
        message: err.message,
        requiredPayment: err.requiredPayment,
      });
    }
    next(err);
  }
};

const checkRole = (...allowedRoles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required.',
    });
  }

  const accountRole = req.user.accountRole || 'OWNER';
  if (!allowedRoles.includes(accountRole)) {
    return res.status(403).json({
      success: false,
      message: `Access denied. Required account role: ${allowedRoles.join(' or ')}`,
      currentRole: accountRole,
    });
  }

  next();
};

subscriptionGate.checkCredits = checkCredits;
subscriptionGate.checkRole = checkRole;
subscriptionGate.isLogisticsBypass = isLogisticsBypass;

=======
>>>>>>> a4ca05ef18bdd6473e0d7b4cf68582b8dde40cd6
module.exports = subscriptionGate;
