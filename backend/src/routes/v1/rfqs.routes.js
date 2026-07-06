const express = require('express');
const { body, param, query } = require('express-validator');
const rfqController = require('../../controllers/rfq.controller');
const { protect } = require('../../middleware/auth');

const router = express.Router();

router.use(protect);

router.post(
  '/',
  [
    body('productId').isMongoId().withMessage('Product is required'),
    body('quantity').isFloat({ min: 1 }).withMessage('Quantity must be at least 1'),
    body('unit').optional().isString().trim().isLength({ max: 30 }),
    body('targetPrice').optional({ nullable: true, checkFalsy: true }).isFloat({ min: 0 }),
    body('deliveryLocation').optional().isString().trim().isLength({ max: 240 }),
    body('neededBy').optional({ nullable: true, checkFalsy: true }).isISO8601(),
    body('message').optional().isString().trim().isLength({ max: 1000 }),
  ],
  rfqController.createRFQ
);

router.get(
  '/my',
  [
    query('mode').optional().isIn(['buyer', 'seller']),
    query('status').optional().isString().trim(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  rfqController.getMyRFQs
);

router.get('/:id', param('id').isMongoId(), rfqController.getRFQById);

router.put(
  '/:id/respond',
  [
    param('id').isMongoId(),
    body('unitPrice').isFloat({ min: 0 }).withMessage('Quote unit price is required'),
    body('availableQuantity').optional({ nullable: true, checkFalsy: true }).isFloat({ min: 0 }),
    body('validUntil').optional({ nullable: true, checkFalsy: true }).isISO8601(),
    body('deliveryWindowDays').optional({ nullable: true, checkFalsy: true }).isInt({ min: 0 }),
    body('sellerMessage').optional().isString().trim().isLength({ max: 1000 }),
  ],
  rfqController.respondToRFQ
);

router.patch(
  '/:id/status',
  [
    param('id').isMongoId(),
    body('status').isIn(['accepted', 'declined', 'cancelled']).withMessage('Invalid RFQ status'),
    body('message').optional().isString().trim().isLength({ max: 1000 }),
  ],
  rfqController.updateRFQStatus
);

module.exports = router;
