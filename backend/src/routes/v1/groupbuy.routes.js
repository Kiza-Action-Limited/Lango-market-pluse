const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const groupBuyController = require('../../controllers/groupBuy.controller');
const { protect: authMiddleware } = require('../../middleware/auth');
const subscriptionGate = require('../../middleware/subscriptionGate');

// Public (view active group buys)
router.get('/', [
  query('status').optional().isIn(['active', 'fulfilled', 'expired']),
], groupBuyController.getGroupBuys);

router.get('/:id', param('id').isMongoId(), groupBuyController.getGroupBuyById);

// Protected (require auth and Smart plan+)
router.use(authMiddleware);
router.use(subscriptionGate('smart'));

router.post('/', [
  body('product').isMongoId(),
  body('targetQuantity').isInt({ min: 2 }),
  body('unitPrice').isFloat({ min: 0 }),
  body('deadline').isISO8601().toDate(),
], groupBuyController.createGroupBuy);

router.post('/:id/join', param('id').isMongoId(), [
  body('quantity').isInt({ min: 1 }),
], groupBuyController.joinGroupBuy);

router.post('/:id/fulfill', param('id').isMongoId(), groupBuyController.fulfillGroupBuy);

module.exports = router;
