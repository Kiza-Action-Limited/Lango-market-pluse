const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const orderController = require('../../controllers/order.controller');
const { protect: authMiddleware } = require('../../middleware/auth');
const subscriptionGate = require('../../middleware/subscriptionGate');

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

router.get('/', [
  query('status').optional().isIn(['pending_payment', 'payment_escrowed', 'processing', 'dispatched', 'delivered', 'completed', 'cancelled', 'disputed']),
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
router.put('/:id/confirm-delivery', param('id').isMongoId(), orderController.confirmDelivery);

module.exports = router;
