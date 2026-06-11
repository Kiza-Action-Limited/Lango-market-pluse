const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const orderController = require('../../controllers/order.controller');
const paymentController = require('../../controllers/payment.controller');
const { protect: authMiddleware } = require('../../middleware/auth');
const subscriptionGate = require('../../middleware/subscriptionGate');
const requireVerified = require('../../middleware/requireVerified');

router.use(authMiddleware);

router.post('/', [
  body('product').isMongoId(),
  body('quantity').isFloat({ min: 0.001 }),
  body('deliveryAddress').optional().custom((value) => {
    if (typeof value === 'string') return true;
    if (value && typeof value === 'object') return true;
    throw new Error('deliveryAddress must be a string or address object');
  }),
], subscriptionGate('v3'), orderController.createOrder);

router.post('/:id/pay', requireVerified, [
  param('id').isMongoId(),
  body('phoneNumber').optional().isMobilePhone(),
], paymentController.initiateMpesaPayment);

router.get('/', [
  query('status').optional().isIn([
    'AWAITING_PAYMENT',
    'FUNDS_HELD',
    'IN_TRANSIT',
    'DELIVERED',
    'RELEASED',
    'DISPUTED',
    'REFUNDED',
    'PARTIAL_REFUND',
    'EXPIRED',
    'pending_payment',
    'payment_escrowed',
    'processing',
    'dispatched',
    'delivered',
    'completed',
    'cancelled',
    'disputed',
  ]),
  query('role').optional().isIn(['buyer', 'seller']),
], orderController.getOrders);

router.get('/:id', param('id').isMongoId(), orderController.getOrderById);
router.put(
  '/:id/status',
  [
    param('id').isMongoId(),
    body('status').isIn(['processing', 'dispatched', 'delivered', 'cancelled']),
  ],
  orderController.updateOrderStatus
);
router.put('/:id/cancel', param('id').isMongoId(), orderController.cancelOrder);
router.put('/:id/confirm-delivery', requireVerified, param('id').isMongoId(), orderController.confirmDelivery);
router.post('/:id/confirm-delivery', requireVerified, param('id').isMongoId(), orderController.confirmDelivery);
router.post('/:id/dispute', requireVerified, [
  param('id').isMongoId(),
  body('reason').notEmpty(),
  body('description').optional().isString(),
  body('evidenceUrls').optional().isArray(),
], orderController.raiseDispute);

module.exports = router;
