const planService = require('../services/subscription/plan.service');
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
  return async (req, res, next) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required.',
        });
      }

      if (isLogisticsBypass(user)) {
        return next();
      }

      const subscription = await planService.getUserSubscription(user.id || user._id);
      const currentTier = normalizePlanId(subscription.plan || user.subscriptionTier);
      const normalizedRequiredTier = normalizePlanId(requiredTier);

      if (!subscription.isActive || !meetsTier(currentTier, normalizedRequiredTier)) {
        return res.status(403).json({
          success: false,
          message: `This feature requires the ${String(normalizedRequiredTier || requiredTier).toUpperCase()} plan or higher. Please activate a subscription.`,
          requiredTier: normalizedRequiredTier,
          currentTier: currentTier || null,
          upgradePrompt: `Upgrade to ${normalizedRequiredTier} to unlock this feature.`,
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
  const normalizedUserRole = String(req.user.role || '').toUpperCase();
  const isAllowedByRole = allowedRoles.includes(accountRole) ||
    allowedRoles.includes(normalizedUserRole) ||
    (allowedRoles.includes('DRIVER') && isLogisticsBypass(req.user)) ||
    (allowedRoles.includes('FLEET_OWNER') && normalizePlanId(req.user.subscriptionTier) === 'mizigo');

  if (!isAllowedByRole) {
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

module.exports = subscriptionGate;
