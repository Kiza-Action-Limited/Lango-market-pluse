const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const paymentController = require('../../controllers/payment.controller');
const { protect: authMiddleware } = require('../../middleware/auth');
const checkRole = require('../../middleware/checkRole');

router.use(authMiddleware);

// M-Pesa
router.post('/mpesa/stkpush', [
  body('orderId').isMongoId(),
  body('phoneNumber').isMobilePhone(),
], paymentController.initiateMpesaPayment);

router.get('/mpesa/status/:checkoutRequestId', paymentController.checkMpesaStatus);

// Wallet
router.get('/wallet/balance', checkRole('OWNER'), paymentController.getWalletBalance);
router.post('/wallet/transfer', [
  body('toUserId').isMongoId(),
  body('amount').isFloat({ min: 1 }),
  body('description').optional(),
], checkRole('OWNER'), paymentController.walletTransfer);

router.post('/wallet/withdraw', [
  body('amount').isFloat({ min: 10 }),
  body('phoneNumber').isMobilePhone(),
], checkRole('OWNER'), paymentController.withdrawToMpesa);

// Ledger
router.get('/transactions', [
  query('page').optional().isInt(),
  query('limit').optional().isInt(),
  query('type').optional().isIn(['deposit', 'withdrawal', 'payment', 'refund', 'escrow_hold', 'escrow_release', 'fee']),
], checkRole('OWNER'), paymentController.getTransactionHistory);

module.exports = router;
