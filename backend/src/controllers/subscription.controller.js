// controllers/subscription.controller.js
const subscriptionService = require('../services/subscription/plan.service');
const billingService = require('../services/subscription/billing.service');
const { validationResult } = require('express-validator');

const sendValidationErrors = (req, res) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) return false;

  res.status(400).json({
    success: false,
    message: 'Validation failed',
    errors: errors.array()
  });
  return true;
};

const getSmsCreditBalance = (subscription) => {
  const allocated = Number(subscription.features?.smsCreditsAllocated || 0);
  const used = Number(subscription.features?.smsCreditsUsed || 0);
  return Math.max(0, allocated - used);
};

/**
 * Get available subscription plans
 * GET /api/v1/subscriptions/plans
 */
exports.getPlans = async (req, res, next) => {
  try {
    const plans = await subscriptionService.getPlans();
    res.status(200).json({
      success: true,
      data: plans,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Subscribe to a plan
 * POST /api/v1/subscriptions/subscribe
 */
exports.subscribe = async (req, res, next) => {
  try {
    if (sendValidationErrors(req, res)) return;

    const { planId, paymentMethod, paymentCompleted, paymentReference } = req.body;
    
    // Special handling for Mizigo (commission-based)
    if (planId === 'mizigo') {
      const subscription = await billingService.subscribeToCommissionPlan(
        req.user.id, 
        planId, 
        {
          paymentCompleted,
          paymentReference,
          userRole: req.user.role // 'DRIVER' or 'FLEET_OWNER'
        }
      );
      return res.status(200).json({
        success: true,
        message: 'Mizigo plan activated successfully. You earn 90% per delivery (10% goes to Sinking Fund)',
        data: subscription,
      });
    }

    // Regular paid plans (Solo, Smart, Growth)
    const subscription = await billingService.subscribe(req.user.id, planId, paymentMethod, {
      paymentCompleted,
      paymentReference,
    });
    
    res.status(200).json({
      success: true,
      message: `Subscribed to ${subscription.planName} plan successfully. ${
        getSmsCreditBalance(subscription) ? `You have ${getSmsCreditBalance(subscription)} SMS credits.` : ''
      }`,
      data: subscription,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get current user's effective entitlements with feature gating
 * GET /api/v1/subscriptions/entitlements
 */
exports.getMyEntitlements = async (req, res, next) => {
  try {
    const entitlements = await subscriptionService.getEntitlements(req.user.id);
    
    // Add locked features information for upgrade prompts
    const lockedFeatures = await subscriptionService.getLockedFeatures(req.user.id, entitlements.planId);
    
    res.status(200).json({
      success: true,
      data: {
        ...entitlements,
        lockedFeatures, // Shows what's greyed out with upgrade prompts
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get current user's subscription with SMS credit balance
 * GET /api/v1/subscriptions/me
 */
exports.getMySubscription = async (req, res, next) => {
  try {
    const subscription = await subscriptionService.getUserSubscription(req.user.id);
    
    // Add SMS credit info for Plan 2 and 3
    if (subscription.plan === 'smart' || subscription.plan === 'growth') {
      const smsBalance = await subscriptionService.getSmsCreditBalance(req.user.id);
      subscription.smsCreditsRemaining = smsBalance;
    }
    
    // Add Sinking Fund info for Mizigo
    if (subscription.plan === 'mizigo') {
      const sinkingFund = await subscriptionService.getSinkingFundBalance(req.user.id);
      subscription.sinkingFundBalance = sinkingFund;
    }
    
    res.status(200).json({
      success: true,
      data: subscription,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Cancel subscription
 * DELETE /api/v1/subscriptions/me
 */
exports.cancelSubscription = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const result = await billingService.cancelSubscription(req.user.id, reason);
    res.status(200).json({
      success: true,
      message: result?.message || 'Subscription cancelled successfully.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Change subscription plan (upgrade/downgrade)
 * PUT /api/v1/subscriptions/change-plan
 */
exports.changePlan = async (req, res, next) => {
  try {
    if (sendValidationErrors(req, res)) return;

    const { newPlanId, paymentCompleted, paymentReference } = req.body;
    
    // Get current plan to determine if this is upgrade or downgrade
    const currentSubscription = await subscriptionService.getUserSubscription(req.user.id);
    
    const subscription = await billingService.changePlan(req.user.id, newPlanId, {
      paymentCompleted,
      paymentReference,
      isUpgrade: subscriptionService.isUpgrade(currentSubscription.plan, newPlanId)
    });
    
    let message = `Plan changed to ${subscription.planName}`;
    if (subscription.features?.smsCreditsAllocated) {
      message += `. You now have ${subscription.features.smsCreditsAllocated} SMS credits available.`;
    }
    
    res.status(200).json({
      success: true,
      message,
      data: subscription,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Top up SMS credits (for Plan 2 and 3 users)
 * POST /api/v1/subscriptions/topup-sms
 */
exports.topupSmsCredits = async (req, res, next) => {
  try {
    if (sendValidationErrors(req, res)) return;

    const { amount, paymentReference } = req.body;
    const result = await billingService.topupSmsCredits(req.user.id, amount, paymentReference);
    res.status(200).json({
      success: true,
      message: `Successfully added ${result.creditsAdded} SMS credits`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get SMS credit balance
 * GET /api/v1/subscriptions/sms-balance
 */
exports.getSmsBalance = async (req, res, next) => {
  try {
    const balance = await subscriptionService.getSmsCreditBalance(req.user.id);
    res.status(200).json({
      success: true,
      data: {
        balance,
        remaining: balance,
        unit: 'credits',
        rate: '1 credit = 1 SMS'
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get sinking fund balance (for Mizigo drivers)
 * GET /api/v1/subscriptions/sinking-fund
 */
exports.getSinkingFund = async (req, res, next) => {
  try {
    const subscription = await subscriptionService.getUserSubscription(req.user.id);

    if (subscription.plan !== 'mizigo') {
      return res.status(200).json({
        success: true,
        data: {
          available: false,
          plan: subscription.plan,
          requiredPlan: 'mizigo',
          balance: 0,
          nextMaintenanceKm: null,
          currentKm: 0,
          kmUntilMaintenance: null,
          canCoverMaintenance: false,
          upgradePrompt: 'Switch to Mizigo to unlock sinking fund maintenance tracking.',
        },
      });
    }

    const sinkingFund = await subscriptionService.getSinkingFundBalance(req.user.id);
    const mileage = await subscriptionService.getVehicleMileage(req.user.id);
    
    res.status(200).json({
      success: true,
      data: {
        available: true,
        plan: subscription.plan,
        balance: sinkingFund,
        nextMaintenanceKm: 5000,
        currentKm: mileage,
        kmUntilMaintenance: Math.max(0, 5000 - (mileage % 5000)),
        canCoverMaintenance: sinkingFund >= 2500, // Estimated oil change cost
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Check if user has access to a specific feature (for frontend gating)
 * GET /api/v1/subscriptions/check-feature/:feature
 */
exports.checkFeatureAccess = async (req, res, next) => {
  try {
    const { feature } = req.params;
    const hasAccess = await subscriptionService.checkFeatureAccess(req.user.id, feature);
    
    const nextPlan = await subscriptionService.getUpgradePlanForFeature(feature);
    
    res.status(200).json({
      success: true,
      data: {
        hasAccess,
        feature,
        nextPlan: nextPlan ? nextPlan.name : null,
        upgradePrompt: nextPlan ? `Upgrade to ${nextPlan.name} to unlock ${feature}` : null,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Webhook for subscription billing (M-Pesa auto-renewal)
 * POST /api/v1/subscriptions/webhook
 */
exports.billingWebhook = async (req, res, next) => {
  try {
    const { event, data } = req.body;
    
    // Handle different webhook events
    switch(event) {
      case 'payment.success':
        await billingService.handleSuccessfulPayment(data);
        break;
      case 'payment.failed':
        await billingService.handleFailedPayment(data);
        break;
      case 'subscription.renewal':
        await billingService.handleAutoRenewal(data);
        break;
      case 'sms.topup':
        await billingService.handleSmsTopup(data);
        break;
      default:
        await billingService.handleWebhook(req.body);
    }
    
    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
};

/**
 * Get upgrade options with pricing
 * GET /api/v1/subscriptions/upgrade-options
 */
exports.getUpgradeOptions = async (req, res, next) => {
  try {
    const currentPlan = await subscriptionService.getUserSubscription(req.user.id);
    const upgradeOptions = await subscriptionService.getUpgradePaths(currentPlan.plan);
    
    res.status(200).json({
      success: true,
      data: {
        currentPlan: currentPlan.planName,
        upgradeOptions,
        pricing: {
          solo: 500,
          smart: 2500,
          growth: 6500,
          mizigo: '5-10% commission'
        }
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get performance report (PDF generation endpoint)
 * GET /api/v1/subscriptions/report/:type
 */
exports.getReport = async (req, res, next) => {
  try {
    const { type } = req.params; // 'vitals', 'performance', 'audit', 'verified-trip'
    const { period } = req.query; // 'month', 'quarter', 'year'
    
    const report = await subscriptionService.generateReport(req.user.id, type, period);
    
    res.status(200).json({
      success: true,
      data: report,
      message: `${type.charAt(0).toUpperCase() + type.slice(1)} report generated successfully`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Record daily operational expenses (for Plan 3 Growth)
 * POST /api/v1/subscriptions/daily-burn
 */
exports.recordDailyBurn = async (req, res, next) => {
  try {
    if (sendValidationErrors(req, res)) return;

    const { expenseType, amount, description } = req.body;
    const validTypes = ['Lunch/Tea', 'Airtime', 'Fuel', 'Boda Fares'];
    
    if (!validTypes.includes(expenseType)) {
      return res.status(400).json({ error: 'Invalid expense type' });
    }
    
    const expense = await billingService.recordDailyBurn(req.user.id, {
      type: expenseType,
      amount,
      description,
      date: new Date()
    });
    
    // Update CFO health gauge
    const updatedMetrics = await subscriptionService.updateFinancialMetrics(req.user.id);
    
    res.status(200).json({
      success: true,
      message: `${expenseType} expense recorded: KES ${amount}`,
      data: {
        expense,
        updatedMetrics
      },
    });
  } catch (error) {
    next(error);
  }
};
