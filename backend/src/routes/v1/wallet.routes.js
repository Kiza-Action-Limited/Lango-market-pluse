const express = require('express');
const router = express.Router();
const { body, query } = require('express-validator');
const walletController = require('../../controllers/wallet.controller');
const { protect } = require('../../middleware/auth');
const requireVerified = require('../../middleware/requireVerified');

router.use(protect);

/**
 * Get wallet balance
 */
router.get('/balance', walletController.getBalance);

/**
 * Get wallet details
 */
router.get('/', walletController.getWalletDetails);

/**
 * Get transaction history
 */
router.get(
  '/transactions',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('type').optional().isIn(['transfer', 'deposit', 'withdrawal', 'payment', 'refund']),
    query('status').optional().isIn(['pending', 'completed', 'failed']),
  ],
  walletController.getTransactionHistory
);

/**
 * Get wallet statement
 */
router.get(
  '/statement',
  [
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
  ],
  walletController.getStatement
);

/**
 * Transfer funds to another user
 */
router.post(
  '/transfer',
  requireVerified,
  [
    body('toUserId').isMongoId().withMessage('Invalid recipient ID'),
    body('amount').isFloat({ min: 10 }).withMessage('Amount must be at least 10'),
    body('description').optional().isString().trim(),
  ],
  walletController.transfer
);

/**
 * Withdraw to M-Pesa
 */
router.post(
  '/withdraw',
  requireVerified,
  [
    body('amount').isFloat({ min: 50 }).withMessage('Minimum withdrawal is 50'),
    body('phoneNumber').isMobilePhone('en-KE').withMessage('Invalid phone number'),
  ],
  walletController.withdraw
);

/**
 * Add funds to wallet
 */
router.post(
  '/add-funds',
  [
    body('amount').isFloat({ min: 10 }).withMessage('Amount must be at least 10'),
    body('paymentMethod')
      .isIn(['mpesa', 'card', 'bank_transfer'])
      .withMessage('Invalid payment method'),
    body('description').optional().isString().trim(),
  ],
  walletController.addFunds
);

/**
 * Lock funds (admin/system use)
 */
router.post(
  '/lock',
  [
    body('amount').isFloat({ min: 0 }).withMessage('Invalid amount'),
    body('orderId').isMongoId().withMessage('Invalid order ID'),
    body('reason').isString().trim(),
  ],
  walletController.lockFunds
);

/**
 * Unlock funds (admin/system use)
 */
router.post(
  '/unlock',
  [
    body('orderId').isMongoId().withMessage('Invalid order ID'),
    body('amount').isFloat({ min: 0 }).withMessage('Invalid amount'),
  ],
  walletController.unlockFunds
);

module.exports = router;
