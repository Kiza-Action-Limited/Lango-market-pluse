const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const paymentController = require('../../controllers/payment.controller');
const { protect: authMiddleware } = require('../../middleware/auth');
const subscriptionGate = require('../../middleware/subscriptionGate');

router.use(authMiddleware);

// M-Pesa
router.post('/mpesa/stkpush', [
  body('orderId').isMongoId(),
  body('phoneNumber').isMobilePhone(),
], paymentController.initiateMpesaPayment);

router.get('/mpesa/status/:checkoutRequestId', paymentController.checkMpesaStatus);

// Wallet
router.get('/wallet/balance', subscriptionGate.checkRole('OWNER', 'FLEET_OWNER'), paymentController.getWalletBalance);
router.post('/wallet/transfer', [
  body('toUserId').isMongoId(),
  body('amount').isFloat({ min: 1 }),
  body('description').optional(),
], subscriptionGate.checkRole('OWNER', 'FLEET_OWNER'), paymentController.walletTransfer);

router.post('/wallet/withdraw', [
  body('amount').isFloat({ min: 10 }),
  body('phoneNumber').isMobilePhone(),
], subscriptionGate.checkRole('OWNER', 'FLEET_OWNER'), paymentController.withdrawToMpesa);

router.post('/sms-credits/topup', [
  body('credits').isInt({ min: 1 }),
  body('amount').isFloat({ min: 0 }),
  body('paymentCompleted').isBoolean(),
  body('paymentReference').isString().isLength({ min: 3 }),
], subscriptionGate.checkRole('OWNER'), paymentController.topUpSmsCredits);

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
], subscriptionGate.checkRole('OWNER', 'FLEET_OWNER'), paymentController.getTransactionHistory);

module.exports = router;
