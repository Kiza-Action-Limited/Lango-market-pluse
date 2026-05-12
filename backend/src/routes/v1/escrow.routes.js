const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const escrowController = require('../../controllers/escrow.controller');
const { protect: authMiddleware } = require('../../middleware/auth');
const rbacMiddleware = require('../../middleware/rbac');

router.use(authMiddleware);

// Buyer / seller views
router.get('/status/:orderId', param('orderId').isMongoId(), escrowController.getEscrowStatus);
router.get('/transactions', escrowController.getUserEscrowTransactions);
router.get('/summary', escrowController.getEscrowSummary);

// Admin only
router.post('/release/:orderId', rbacMiddleware(['admin']), [
  param('orderId').isMongoId(),
  body('forceRelease').optional().isBoolean(),
], escrowController.releaseEscrow);

router.post('/hold/:orderId', rbacMiddleware(['admin']), [
  param('orderId').isMongoId(),
  body('reason').notEmpty(),
], escrowController.holdEscrow);

router.post('/partial-release/:orderId', rbacMiddleware(['admin', 'seller']), [
  param('orderId').isMongoId(),
  body('amount').isFloat({ min: 0.01 }),
  body('reason').optional(),
], escrowController.partialRelease);

router.post('/cancel/:orderId', rbacMiddleware(['admin']), [
  param('orderId').isMongoId(),
  body('reason').notEmpty(),
], escrowController.cancelEscrow);

module.exports = router;