const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const subscriptionController = require('../../controllers/subscription.controller');
const { protect: authMiddleware } = require('../../middleware/auth');
const { PLAN_IDS } = require('../../config/subscriptionPlans');
const subscriptionGate = require('../../middleware/subscriptionGate');

// Public plans
router.get('/plans', subscriptionController.getPlans);
router.post('/webhook', subscriptionController.billingWebhook);

// Protected
router.use(authMiddleware);

router.get('/me', subscriptionController.getMySubscription);
router.get('/entitlements', subscriptionController.getMyEntitlements);
router.post('/subscribe', [
  body('planId').isIn(Object.values(PLAN_IDS)),
  body('paymentMethod').optional().isIn(['mpesa', 'commission']),
  body('paymentCompleted').optional().isBoolean(),
  body('paymentReference').optional().isString().isLength({ min: 3 }),
], subscriptionGate.checkRole('OWNER', 'FLEET_OWNER'), subscriptionController.subscribe);

router.delete('/me', subscriptionGate.checkRole('OWNER', 'FLEET_OWNER'), subscriptionController.cancelSubscription);
router.put('/change-plan', [
  body('newPlanId').isIn(Object.values(PLAN_IDS)),
  body('paymentCompleted').optional().isBoolean(),
  body('paymentReference').optional().isString().isLength({ min: 3 }),
], subscriptionGate.checkRole('OWNER', 'FLEET_OWNER'), subscriptionController.changePlan);

module.exports = router;
