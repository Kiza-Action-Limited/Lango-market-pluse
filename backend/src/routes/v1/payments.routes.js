const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const paymentController = require('../../controllers/payment.controller');
const { protect: authMiddleware } = require('../../middleware/auth');
<<<<<<< HEAD
const subscriptionGate = require('../../middleware/subscriptionGate');
=======
const checkRole = require('../../middleware/checkRole');
>>>>>>> a4ca05ef18bdd6473e0d7b4cf68582b8dde40cd6

router.use(authMiddleware);

// M-Pesa
router.post('/mpesa/stkpush', [
  body('orderId').isMongoId(),
  body('phoneNumber').isMobilePhone(),
], paymentController.initiateMpesaPayment);

router.get('/mpesa/status/:checkoutRequestId', paymentController.checkMpesaStatus);

// Wallet
<<<<<<< HEAD
router.get('/wallet/balance', subscriptionGate.checkRole('OWNER', 'FLEET_OWNER'), paymentController.getWalletBalance);
=======
router.get('/wallet/balance', checkRole('OWNER'), paymentController.getWalletBalance);
>>>>>>> a4ca05ef18bdd6473e0d7b4cf68582b8dde40cd6
router.post('/wallet/transfer', [
  body('toUserId').isMongoId(),
  body('amount').isFloat({ min: 1 }),
  body('description').optional(),
<<<<<<< HEAD
], subscriptionGate.checkRole('OWNER', 'FLEET_OWNER'), paymentController.walletTransfer);
=======
], checkRole('OWNER'), paymentController.walletTransfer);
>>>>>>> a4ca05ef18bdd6473e0d7b4cf68582b8dde40cd6

router.post('/wallet/withdraw', [
  body('amount').isFloat({ min: 10 }),
  body('phoneNumber').isMobilePhone(),
<<<<<<< HEAD
], subscriptionGate.checkRole('OWNER', 'FLEET_OWNER'), paymentController.withdrawToMpesa);

router.post('/sms-credits/topup', [
  body('credits').isInt({ min: 1 }),
  body('amount').isFloat({ min: 0 }),
  body('paymentCompleted').isBoolean(),
  body('paymentReference').isString().isLength({ min: 3 }),
], subscriptionGate.checkRole('OWNER'), paymentController.topUpSmsCredits);
=======
], checkRole('OWNER'), paymentController.withdrawToMpesa);
>>>>>>> a4ca05ef18bdd6473e0d7b4cf68582b8dde40cd6

// Ledger
router.get('/transactions', [
  query('page').optional().isInt(),
  query('limit').optional().isInt(),
<<<<<<< HEAD
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
=======
  query('type').optional().isIn(['deposit', 'withdrawal', 'payment', 'refund', 'escrow_hold', 'escrow_release', 'fee']),
], checkRole('OWNER'), paymentController.getTransactionHistory);
>>>>>>> a4ca05ef18bdd6473e0d7b4cf68582b8dde40cd6

module.exports = router;
