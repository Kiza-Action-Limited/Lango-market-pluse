const planService = require('../services/subscription/plan.service');

const checkRole = (requiredStaffRole = 'OWNER') => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const userStaffRole = String(req.user.staffRole || 'OWNER').toUpperCase();
    const needed = String(requiredStaffRole).toUpperCase();

    if (userStaffRole === needed) {
      return next();
    }

    // Apply strict blocking for Growth tier clerks on financial routes.
    const normalizedPlan = planService.normalizePlanId(req.user.subscriptionTier);
    if (normalizedPlan === 'growth') {
      return res.status(403).json({
        success: false,
        message: `Access denied. ${needed} privileges required for this financial action.`,
        requiredRole: needed,
        currentRole: userStaffRole,
      });
    }

    return res.status(403).json({
      success: false,
      message: `Access denied. ${needed} privileges required.`,
      requiredRole: needed,
      currentRole: userStaffRole,
    });
  };
};

module.exports = checkRole;
