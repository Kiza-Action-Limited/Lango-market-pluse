const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const logisticsController = require('../../controllers/logistics.controller');
const { protect, authorize } = require('../../middleware/auth');

// All routes require authentication
router.use(protect);

// Logistics routes
router.post('/',
  authorize('admin', 'logistics'),
  [
    body('orderId').isMongoId().withMessage('Valid order ID required'),
    body('carrier').optional().isString(),
    body('shippingAddress').optional().isObject()
  ],
  logisticsController.createLogistics
);

router.get('/',
  authorize('admin', 'logistics'),
  logisticsController.getAllLogistics
);

router.get('/stats/delivery',
  authorize('admin', 'logistics'),
  logisticsController.getDeliveryStats
);

router.get('/:id',
  param('id').isMongoId(),
  logisticsController.getLogisticsById
);

router.get('/order/:orderId',
  param('orderId').isMongoId(),
  logisticsController.getLogisticsByOrder
);

router.put('/:id/status',
  authorize('admin', 'logistics'),
  [
    param('id').isMongoId(),
    body('status').isIn(['pending', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'failed']),
    body('location').optional().isString(),
    body('notes').optional().isString()
  ],
  logisticsController.updateLogisticsStatus
);

router.put('/:id/assign-driver',
  authorize('admin', 'logistics'),
  [
    param('id').isMongoId(),
    body('driverId').optional().isMongoId(),
    body('driverName').optional().isString(),
    body('driverPhone').optional().isString()
  ],
  logisticsController.assignDriver
);

router.put('/:id/tracking',
  authorize('admin', 'logistics'),
  [
    param('id').isMongoId(),
    body('trackingNumber').optional().isString(),
    body('carrier').optional().isString(),
    body('estimatedDelivery').optional().isISO8601()
  ],
  logisticsController.updateTracking
);

router.post('/bulk-update',
  authorize('admin'),
  [
    body('logisticsIds').isArray(),
    body('status').isIn(['pending', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'failed']),
    body('notes').optional().isString()
  ],
  logisticsController.bulkUpdateStatus
);

module.exports = router;