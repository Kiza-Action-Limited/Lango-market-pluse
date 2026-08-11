const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const escrowController = require('../../controllers/escrow.controller');
const { protect: authMiddleware } = require('../../middleware/auth');
const rbacMiddleware = require('../../middleware/rbac');
const requireVerified = require('../../middleware/requireVerified');

router.use(authMiddleware);
router.use(requireVerified);

const missingOrderId = (req, res) => res.status(400).json({
  success: false,
  message: 'orderId path parameter is required.',
});

const orderIdParam = param('orderId').trim().isMongoId().withMessage('Valid orderId is required.');
const disputeIdParam = param('id').trim().isMongoId().withMessage('Valid dispute ID is required.');

// Buyer / seller views
router.get('/status/:orderId', orderIdParam, escrowController.getEscrowStatus);
router.get('/transactions', escrowController.getUserEscrowTransactions);
router.get('/summary', escrowController.getEscrowSummary);

// Admin only
router.post('/release', rbacMiddleware(['admin']), missingOrderId);
router.post('/release/:orderId', rbacMiddleware(['admin']), [
  orderIdParam,
  body('forceRelease').optional().isBoolean(),
], escrowController.releaseEscrow);

router.post('/hold', rbacMiddleware(['admin']), missingOrderId);
router.post('/hold/:orderId', rbacMiddleware(['admin']), [
  orderIdParam,
  body('reason').notEmpty(),
], escrowController.holdEscrow);

router.post('/partial-release', rbacMiddleware(['admin', 'seller']), missingOrderId);
router.post('/partial-release/:orderId', rbacMiddleware(['admin', 'seller']), [
  orderIdParam,
  body('amount').isFloat({ min: 0.01 }),
  body('reason').optional(),
], escrowController.partialRelease);

router.post('/cancel', rbacMiddleware(['admin']), missingOrderId);
router.post('/cancel/:orderId', rbacMiddleware(['admin']), [
  orderIdParam,
  body('reason').notEmpty(),
], escrowController.cancelEscrow);

router.post('/resolve/:id', rbacMiddleware(['admin']), [
  disputeIdParam,
  body('resolution').optional().isIn(['refund_buyer', 'release_to_seller', 'partial_refund', 'cancelled']),
  body('refundAmount').optional().isFloat({ min: 0 }),
  body('resolutionAmount').optional().isFloat({ min: 0 }),
  body('faultParty').optional().isMongoId(),
], escrowController.resolveDispute);

module.exports = router;
