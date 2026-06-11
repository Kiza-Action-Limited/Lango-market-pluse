const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const transactionController = require('../../controllers/transaction.controller');
const { protect: authMiddleware } = require('../../middleware/auth');
const rbacMiddleware = require('../../middleware/rbac');

// Apply authentication to all routes
router.use(authMiddleware);

// User routes
router.get('/',
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('type').optional().isString(),
  query('status').optional().isIn(['pending', 'completed', 'failed', 'reversed']),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  query('minAmount').optional().isFloat({ min: 0 }),
  query('maxAmount').optional().isFloat({ min: 0 }),
  transactionController.getTransactions
);

router.get('/balance',
  transactionController.getBalance
);

router.get('/summary',
  query('days').optional().isInt({ min: 1, max: 365 }),
  transactionController.getTransactionSummary
);

router.get('/export',
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  query('type').optional().isString(),
  transactionController.exportTransactions
);

router.get('/:id',
  param('id').isMongoId(),
  transactionController.getTransactionById
);

router.post('/:id/reverse',
  param('id').isMongoId(),
  body('reason').notEmpty().withMessage('Reversal reason is required').isLength({ min: 5, max: 500 }),
  transactionController.reverseTransaction
);

// Admin only routes
router.get('/admin/all',
  rbacMiddleware(['admin']),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('userId').optional().isMongoId(),
  query('type').optional().isString(),
  query('status').optional().isIn(['pending', 'completed', 'failed', 'reversed']),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  transactionController.adminGetAllTransactions
);

router.get('/admin/stats',
  rbacMiddleware(['admin']),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  transactionController.adminGetTransactionStats
);

module.exports = router;