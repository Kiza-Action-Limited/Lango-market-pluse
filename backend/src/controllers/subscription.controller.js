const subscriptionService = require('../services/subscription/plan.service');
const billingService = require('../services/subscription/billing.service');
const { validationResult } = require('express-validator');

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
 * Subscribe to a plan (V3 or V4)
 * POST /api/v1/subscriptions/subscribe
 */
exports.subscribe = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { planId, paymentMethod, paymentCompleted, paymentReference } = req.body;
    const subscription = await billingService.subscribe(req.user.id, planId, paymentMethod, {
      paymentCompleted,
      paymentReference,
    });
    res.status(200).json({
      success: true,
      message: `Subscribed to ${subscription.plan} plan successfully`,
      data: subscription,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get current user's subscription
 * GET /api/v1/subscriptions/me
 */
exports.getMySubscription = async (req, res, next) => {
  try {
    const subscription = await subscriptionService.getUserSubscription(req.user.id);
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
    const result = await billingService.cancelSubscription(req.user.id);
    res.status(200).json({
      success: true,
      message: 'Subscription cancelled successfully',
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
    const { newPlanId } = req.body;
    const subscription = await billingService.changePlan(req.user.id, newPlanId);
    res.status(200).json({
      success: true,
      message: `Plan changed to ${subscription.plan}`,
      data: subscription,
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
    await billingService.handleWebhook(req.body);
    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
};
