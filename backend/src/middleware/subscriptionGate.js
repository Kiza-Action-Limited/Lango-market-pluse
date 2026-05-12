const planService = require('../services/subscription/plan.service');

/**
 * Middleware to check if user's subscription plan allows access to a feature.
 * @param {string} requiredTier - Minimum tier required: 'v3' or 'v4' (free is always allowed for basic)
 * @param {string} [feature] - Specific feature name (e.g., 'groupBuying', 'scarcityAlerts')
 * @returns {Function} Express middleware
 */
const subscriptionGate = (requiredTier, feature = null) => {
  return async (req, res, next) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required.',
        });
      }

      const userTier = user.subscriptionTier || 'free';

      // Tier hierarchy: free < v3 < v4
      const tierOrder = { free: 0, v3: 1, v4: 2 };
      const hasRequiredTier = tierOrder[userTier] >= tierOrder[requiredTier];

      if (!hasRequiredTier) {
        return res.status(403).json({
          success: false,
          message: `This feature requires ${requiredTier.toUpperCase()} plan or higher. Please upgrade.`,
          requiredTier,
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