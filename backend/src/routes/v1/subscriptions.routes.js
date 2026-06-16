// routes/subscription.routes.js
const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const subscriptionController = require('../../controllers/subscription.controller');
const { protect: authMiddleware } = require('../../middleware/auth');
const { PLAN_IDS } = require('../../config/subscriptionPlans');
const subscriptionGate = require('../../middleware/subscriptionGate');

// Public webhook (no auth required)
router.post('/webhook', subscriptionController.billingWebhook);

// Public plans endpoint
router.get('/plans', subscriptionController.getPlans);

// Protected routes
router.use(authMiddleware);

// Basic subscription info
router.get('/me', subscriptionController.getMySubscription);
router.get('/entitlements', subscriptionController.getMyEntitlements);
router.get('/upgrade-options', subscriptionController.getUpgradeOptions);
router.get('/check-feature/:feature', subscriptionController.checkFeatureAccess);

// SMS credit management (Plan 2+)
router.get('/sms-balance', subscriptionController.getSmsBalance);
router.post('/topup-sms', [
  body('amount').isInt({ min: 50, max: 10000 }),
  body('paymentReference').optional().isString().trim(),
], subscriptionController.topupSmsCredits);

// Mizigo specific (Plan 4). Authenticated users can query this safely; the
// controller returns an unavailable state for non-Mizigo subscriptions.
router.get('/sinking-fund', subscriptionController.getSinkingFund);

// Daily operational expenses (Plan 3)
router.post('/daily-burn', [
  body('expenseType').isIn(['Lunch/Tea', 'Airtime', 'Fuel', 'Boda Fares']),
  body('amount').isInt({ min: 10 }),
  body('description').optional().isString().trim(),
], subscriptionGate.checkRole('OWNER'), subscriptionController.recordDailyBurn);

// Reports
router.get('/report/:type', subscriptionController.getReport);

// Subscription management
router.post('/subscribe', [
  body('planId').isIn(['solo', 'smart', 'growth', 'mizigo']),
  body('paymentMethod').optional().isIn(['mpesa', 'commission']),
  body('paymentCompleted').optional().isBoolean(),
  body('paymentReference').optional().isString().isLength({ min: 3 }),
], subscriptionGate.checkRole('OWNER', 'FLEET_OWNER', 'DRIVER'), subscriptionController.subscribe);

router.delete('/me', [
  body('reason').optional().isString().trim(),
], subscriptionGate.checkRole('OWNER', 'FLEET_OWNER', 'DRIVER'), subscriptionController.cancelSubscription);

router.put('/change-plan', [
  body('newPlanId').isIn(['solo', 'smart', 'growth', 'mizigo']),
  body('paymentCompleted').optional().isBoolean(),
  body('paymentReference').optional().isString().isLength({ min: 3 }),
], subscriptionGate.checkRole('OWNER', 'FLEET_OWNER'), subscriptionController.changePlan);

module.exports = router;
