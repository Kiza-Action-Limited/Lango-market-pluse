const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const orderController = require('../../controllers/order.controller');
const paymentController = require('../../controllers/payment.controller');
const { protect: authMiddleware } = require('../../middleware/auth');
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
  body('logisticsProviderId').optional({ nullable: true, checkFalsy: true }).isMongoId().withMessage('Choose a valid logistics company'),
  body('logisticsPreference.notes').optional({ nullable: true, checkFalsy: true }).isString().trim().isLength({ max: 300 }),
], orderController.createOrder);

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
  query('range').optional().isIn([
    'today',
    '2d',
    '3d',
    '1w',
    '2w',
    '3w',
    '1m',
    '2m',
    '3m',
    '4m',
    '6m',
    '7m',
    '8m',
    '9m',
    '10m',
    '11m',
    '1y',
    '2y',
    '7d',
    '30d',
    '90d',
    'year',
  ]),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
], orderController.getOrders);

router.get('/buyer/sellers', orderController.getBuyerSellers);
router.get('/buyer/review-queue', orderController.getBuyerReviewQueue);
router.get('/:id/tracking', param('id').isMongoId(), orderController.getOrderTracking);
router.get('/:id', param('id').isMongoId(), orderController.getOrderById);
router.put(
  '/:id/status',
  [
    param('id').isMongoId(),
    body('status').isIn([
      'processing',
      'dispatched',
      'delivered',
      'cancelled',
      'IN_TRANSIT',
      'DELIVERED',
      'DISPUTED',
      'RELEASED',
    ]),
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
