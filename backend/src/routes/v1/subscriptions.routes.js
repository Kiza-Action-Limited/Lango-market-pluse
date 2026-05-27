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
<<<<<<< HEAD
  body('planId').isIn(Object.values(PLAN_IDS)),
  body('paymentMethod').optional().isIn(['mpesa', 'commission']),
=======
  body('planId').isIn(['free', 'v3', 'v4', 'solo', 'smart', 'growth', 'mizigo']),
  body('paymentMethod').optional().isIn(['mpesa']),
>>>>>>> a4ca05ef18bdd6473e0d7b4cf68582b8dde40cd6
  body('paymentCompleted').optional().isBoolean(),
  body('paymentReference').optional().isString().isLength({ min: 3 }),
], subscriptionGate.checkRole('OWNER', 'FLEET_OWNER'), subscriptionController.subscribe);

router.delete('/me', subscriptionGate.checkRole('OWNER', 'FLEET_OWNER'), subscriptionController.cancelSubscription);
router.put('/change-plan', [
<<<<<<< HEAD
  body('newPlanId').isIn(Object.values(PLAN_IDS)),
  body('paymentCompleted').optional().isBoolean(),
  body('paymentReference').optional().isString().isLength({ min: 3 }),
], subscriptionGate.checkRole('OWNER', 'FLEET_OWNER'), subscriptionController.changePlan);
=======
  body('newPlanId').isIn(['solo', 'smart', 'growth', 'mizigo']),
], subscriptionController.changePlan);

// Webhook (no auth, public endpoint for external billing)
router.post('/webhook', subscriptionController.billingWebhook);
>>>>>>> a4ca05ef18bdd6473e0d7b4cf68582b8dde40cd6

module.exports = router;
