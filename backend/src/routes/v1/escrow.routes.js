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

router.post('/external/:orderId/create', [
  orderIdParam,
  body('buyerCustomer').optional().isEmail().withMessage('buyerCustomer must be a valid Escrow.com customer email.'),
  body('sellerCustomer').optional().isEmail().withMessage('sellerCustomer must be a valid Escrow.com customer email.'),
  body('currency').optional().isIn(['usd', 'aud', 'euro', 'gbp', 'cad']),
  body('amount').optional().isFloat({ min: 0.01 }),
  body('quantity').optional().isInt({ min: 1 }),
  body('inspectionPeriodSeconds').optional().isInt({ min: 86400, max: 2592000 }),
  body('itemType').optional().isIn(['domain_name', 'domain_name_holding', 'general_merchandise', 'milestone', 'motor_vehicle']),
  body('forceNew').optional().isBoolean(),
  body('useConfiguredAccountAsBuyer').optional().isBoolean(),
  body('payload').optional().isObject(),
], escrowController.createExternalTransaction);

router.get('/external/:orderId', orderIdParam, escrowController.getExternalTransaction);
router.post('/external/:orderId/sync', orderIdParam, escrowController.syncExternalTransaction);

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
