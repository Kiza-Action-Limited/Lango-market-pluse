const express = require('express');
const router = express.Router();
const { body, query } = require('express-validator');
const analyticsController = require('../../controllers/Analytics.controller');
const { protect, authorize } = require('../../middleware/auth');

// All routes require authentication
router.use(protect);

// Admin-only routes
router.post('/generate',
  authorize('admin'),
  [
    body('date').optional().isISO8601(),
    body('force').optional().isBoolean()
  ],
  analyticsController.generateDailyAnalytics
);

// Role-based analytics access
router.get('/',
  authorize('admin', 'manufacturer', 'wholesaler'),
  [
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('period').optional().isIn(['day', 'week', 'month', 'year']),
    query('role').optional().isIn(['farmer', 'wholesaler', 'manufacturer', 'retailer'])
  ],
  analyticsController.getAnalytics
);

router.get('/dashboard',
  analyticsController.getDashboardOverview
);

router.get('/sales',
  authorize('admin', 'manufacturer', 'wholesaler', 'retailer'),
  [
    query('period').optional().isIn(['day', 'week', 'month', 'year']),
    query('year').optional().isInt({ min: 2020, max: 2030 }),
    query('month').optional().isInt({ min: 1, max: 12 }),
    query('farmerId').optional().isMongoId(),
    query('productCategory').optional().isString()
  ],
  analyticsController.getSalesAnalytics
);

// Role-specific analytics
router.get('/farmers',
  authorize('admin', 'manufacturer', 'wholesaler'),
  [
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601()
  ],
  analyticsController.getFarmerAnalytics
);

router.get('/manufacturers',
  authorize('admin', 'wholesaler'),
  [
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601()
  ],
  analyticsController.getManufacturerAnalytics
);

router.get('/market-trends',
  authorize('admin', 'manufacturer', 'wholesaler', 'farmer', 'retailer'),
  [
    query('category').optional().isString(),
    query('region').optional().isString()
  ],
  analyticsController.getMarketTrends
);

router.get('/supply-chain',
  authorize('admin', 'manufacturer', 'wholesaler'),
  analyticsController.getSupplyChainAnalytics
);

module.exports = router;