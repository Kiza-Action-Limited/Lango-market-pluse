const planService = require('../services/subscription/plan.service');
const { PLAN_IDS, TIER_ORDER } = require('../config/subscriptionPlans');

/**
 * Middleware to check if user's subscription plan allows access to a feature.
 * @param {string|string[]} requiredTier - Minimum tier(s) required.
 * @param {string} [feature] - Specific feature name (e.g., 'groupBuying', 'scarcityAlerts')
 * @returns {Function} Express middleware
 */
const subscriptionGate = (requiredTier, feature = null) => {
  const requiredTiers = Array.isArray(requiredTier) ? requiredTier : [requiredTier];

  return async (req, res, next) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required.',
        });
      }

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

      if (!hasRequiredTier) {
        return res.status(403).json({
          success: false,
          message: `This feature requires one of: ${normalizedRequired.join(', ')}.`,
          requiredTier: normalizedRequired,
          currentTier: userTier,
        });
      }

      // If specific feature check is needed (for v4 granular features)
      if (feature) {
        const hasFeature = await planService.checkFeatureAccess(user._id, feature);
        if (!hasFeature) {
          return res.status(403).json({
            success: false,
            message: `Feature "${feature}" is not included in your current plan.`,
          });
        }
      }

      next();
    } catch (err) {
      next(err);
    }
  };
};

module.exports = subscriptionGate;
