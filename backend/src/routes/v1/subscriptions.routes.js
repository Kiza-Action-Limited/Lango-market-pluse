const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const subscriptionController = require('../../controllers/subscription.controller');
const { protect: authMiddleware } = require('../../middleware/auth');

// Public plans
router.get('/plans', subscriptionController.getPlans);

// Protected
router.use(authMiddleware);

router.get('/me', subscriptionController.getMySubscription);
router.post('/subscribe', [
  body('planId').isIn(['free', 'v3', 'v4']),
  body('paymentMethod').isIn(['mpesa']),
  body('paymentCompleted').optional().isBoolean(),
  body('paymentReference').optional().isString().isLength({ min: 3 }),
], subscriptionController.subscribe);

router.delete('/me', subscriptionController.cancelSubscription);
router.put('/change-plan', [
  body('newPlanId').isIn(['v3', 'v4']),
], subscriptionController.changePlan);

// Webhook (no auth, public endpoint for external billing)
router.post('/webhook', subscriptionController.billingWebhook);

module.exports = router;
