const express = require('express');
const router = express.Router();
const sinkingfundController = require('../../controllers/sinkingfund.controller');
const { protect } = require('../../middleware/auth');
const rbacMiddleware = require('../../middleware/rbac');
const { body, param, query } = require('express-validator');

// All routes require authentication
router.use(protect);

/**
 * Get current driver's sinking fund
 * GET /api/v1/sinking-fund/me
 */
router.get('/me', sinkingfundController.getMyFund);

/**
 * Get driver's sinking fund
 * GET /api/v1/sinking-fund/:driverId
 */
router.get(
  '/:driverId',
  [param('driverId').isMongoId()],
  sinkingfundController.getSinkingFund
);

/**
 * Contribute to sinking fund
 * POST /api/v1/sinking-fund/contribute
 */
router.post(
  '/contribute',
  rbacMiddleware(['admin']),
  [
    body('driverId').isMongoId().withMessage('Valid driver ID required'),
    body('amount').isFloat({ min: 0 }).withMessage('Valid amount required'),
    body('orderId').optional().isMongoId(),
    body('logisticsId').optional().isMongoId(),
  ],
  sinkingfundController.contributeToFund
);

/**
 * Update mileage
 * POST /api/v1/sinking-fund/update-mileage
 */
router.post(
  '/update-mileage',
  [
    body('driverId').isMongoId().withMessage('Valid driver ID required'),
    body('mileageKm').isFloat({ min: 0 }).withMessage('Valid mileage required'),
  ],
  sinkingfundController.updateMileage
);

/**
 * Withdraw funds
 * POST /api/v1/sinking-fund/withdraw
 */
router.post(
  '/withdraw',
  [
    body('driverId').isMongoId().withMessage('Valid driver ID required'),
    body('amount').isFloat({ min: 0 }).withMessage('Valid amount required'),
    body('reason').notEmpty().withMessage('Reason required'),
  ],
  sinkingfundController.withdrawFunds
);

/**
 * Get contribution history
 * GET /api/v1/sinking-fund/:driverId/contributions
 */
router.get(
  '/:driverId/contributions',
  [
    param('driverId').isMongoId(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  sinkingfundController.getContributions
);

/**
 * Admin: Get all sinking funds
 * GET /api/v1/sinking-fund/admin/all
 */
router.get(
  '/admin/all',
  rbacMiddleware(['admin']),
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('sortBy').optional().isIn(['balance', 'totalContributed', 'mileageKm']),
  ],
  sinkingfundController.getAllFunds
);

/**
 * Admin: Get service alerts
 * GET /api/v1/sinking-fund/service-alerts
 */
router.get(
  '/admin/service-alerts',
  rbacMiddleware(['admin']),
  sinkingfundController.getServiceAlerts
);

/**
 * Admin: Get analytics
 * GET /api/v1/sinking-fund/analytics
 */
router.get(
  '/admin/analytics',
  rbacMiddleware(['admin']),
  sinkingfundController.getAnalytics
);

module.exports = router;
