const express = require('express');
const router = express.Router();
const { body, query } = require('express-validator');
const analyticsController = require('../../controllers/Analytics.controller');
const { protect, authorize } = require('../../middleware/auth');

// All routes require authentication and admin access
router.use(protect);
router.use(authorize('admin'));

// Analytics routes
router.post('/generate',
  [
    body('date').optional().isISO8601(),
    body('force').optional().isBoolean()
  ],
  analyticsController.generateDailyAnalytics
);

router.get('/',
  [
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('period').optional().isIn(['day', 'week', 'month', 'year'])
  ],
  analyticsController.getAnalytics
);

router.get('/dashboard',
  analyticsController.getDashboardOverview
);

router.get('/sales',
  [
    query('period').optional().isIn(['day', 'week', 'month', 'year']),
    query('year').optional().isInt({ min: 2020, max: 2030 }),
    query('month').optional().isInt({ min: 1, max: 12 })
  ],
  analyticsController.getSalesAnalytics
);

module.exports = router;