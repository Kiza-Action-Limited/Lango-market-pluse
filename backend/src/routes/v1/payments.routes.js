const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const paymentController = require('../../controllers/payment.controller');
const { protect: authMiddleware, authorize } = require('../../middleware/auth');
const requireVerified = require('../../middleware/requireVerified');
const idempotency = require('../../middleware/idempotency');

router.post('/verto/webhook', paymentController.handleVertoWebhook);

router.use(authMiddleware);

// Verto
router.get('/verto/config', paymentController.getVertoConfig);
router.post(
  '/verto/create',
  requireVerified,
  idempotency('payments:verto-create', { required: true }),
  [
    body('orderId').notEmpty().withMessage('Order ID or order number required'),
  ],
  paymentController.createVertoPayment
);
router.get('/verto/status/:reference', param('reference').isString().isLength({ min: 3 }), paymentController.checkVertoPaymentStatus);
router.get('/verto/transactions', authorize('admin'), paymentController.getVertoTransactions);
router.get('/verto/payouts', authorize('admin'), paymentController.getVertoPayouts);
router.post(
  '/verto/payouts',
  authorize('admin'),
  idempotency('payments:verto-payout', { required: true }),
  [
    body('orderId').isMongoId(),
    body('role').optional().isIn(['seller', 'driver']),
    body('reason').notEmpty().isString().trim().isLength({ min: 8, max: 500 }),
  ],
  paymentController.createVertoPayout
);
router.get('/verto/wallets', authorize('admin'), paymentController.getVertoWallets);

// Wallet
router.get('/wallet/balance', paymentController.getWalletBalance);
router.post('/wallet/transfer', [
  body('toUserId').isMongoId(),
  body('amount').isFloat({ min: 1 }),
  body('description').optional(),
], idempotency('payments:wallet-transfer'), paymentController.walletTransfer);

router.post('/sms-credits/topup', [
  body('credits').isInt({ min: 1 }),
  body('amount').isFloat({ min: 0 }),
  body('paymentCompleted').isBoolean(),
  body('paymentReference').isString().isLength({ min: 3 }),
], paymentController.topUpSmsCredits);

// Ledger
router.get('/transactions', [
  query('page').optional().isInt(),
  query('limit').optional().isInt(),
  query('type').optional().isIn([
    'deposit',
    'withdrawal',
    'payment',
    'refund',
    'escrow_hold',
    'escrow_release',
    'fee',
    'subscription_payment',
    'sms_topup',
    'commission',
    'sinking_fund',
  ]),
], paymentController.getTransactionHistory);

module.exports = router;
