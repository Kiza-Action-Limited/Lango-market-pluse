const express    = require('express');
const router     = express.Router();
const { body, param } = require('express-validator');

const logisticsController = require('../../controllers/logistics.controller');
const { protect, authorize } = require('../../middleware/auth');

// All routes require authentication
router.use(protect);

// ─── Create ───────────────────────────────────────────────────────────────────
router.post('/',
  authorize('admin', 'logistics'),
  [
    body('orderId').isMongoId().withMessage('Valid order ID required'),
    body('driverType').optional().isIn(['owner_operator', 'hired_driver']),
    body('shippingAddress').optional().isObject(),
    body('escrowAmount').optional().isFloat({ min: 0 }),
    body('commissionRate').optional().isFloat({ min: 0.05, max: 0.10 })
  ],
  logisticsController.createLogistics
);

// ─── 3-Way QR Handshake ───────────────────────────────────────────────────────

/**
 * Step 1 — Driver scans Seller's QR at pickup
 * Role: driver (logistics)
 */
router.post('/:id/scan/pickup',
  authorize('logistics', 'admin'),
  [
    param('id').isMongoId(),
    body('qrPayload').notEmpty().withMessage('QR payload required'),
    body('lat').optional().isFloat(),
    body('lng').optional().isFloat()
  ],
  logisticsController.scanPickup
);

/**
 * Step 2 — Buyer scans Driver's QR on delivery
 * Role: buyer (user)
 */
router.post('/:id/scan/delivery',
  authorize('user', 'admin'),
  [
    param('id').isMongoId(),
    body('qrPayload').notEmpty().withMessage('QR payload required'),
    body('lat').optional().isFloat(),
    body('lng').optional().isFloat()
  ],
  logisticsController.scanDelivery
);

/**
 * Step 3 — Release escrow
 * Called by cron job (auto), buyer early confirm, or admin
 */
router.post('/:id/escrow/release',
  authorize('admin', 'user'),
  [
    param('id').isMongoId(),
    body('triggeredBy').optional().isIn(['buyer_confirm', 'auto', 'admin'])
  ],
  logisticsController.releaseEscrow
);

/**
 * Open a dispute — freezes escrow auto-release
 */
router.post('/:id/dispute',
  authorize('user', 'seller', 'admin'),
  [param('id').isMongoId()],
  logisticsController.openDispute
);

// ─── Read ─────────────────────────────────────────────────────────────────────
router.get('/',
  authorize('admin', 'logistics'),
  logisticsController.getAllLogistics
);

router.get('/stats/delivery',
  authorize('admin', 'logistics'),
  logisticsController.getDeliveryStats
);

router.get('/:id',
  [param('id').isMongoId()],
  logisticsController.getLogisticsById
);

router.get('/order/:orderId',
  [param('orderId').isMongoId()],
  logisticsController.getLogisticsByOrder
);

// ─── Driver Assignment ────────────────────────────────────────────────────────
router.put('/:id/assign-driver',
  authorize('admin', 'logistics'),
  [
    param('id').isMongoId(),
    body('driverId').optional().isMongoId(),
    body('driverName').optional().isString(),
    body('driverPhone').optional().isString(),
    body('driverType').optional().isIn(['owner_operator', 'hired_driver'])
  ],
  logisticsController.assignDriver
);

// ─── Bulk Update ──────────────────────────────────────────────────────────────
router.post('/bulk-update',
  authorize('admin'),
  [
    body('logisticsIds').isArray().withMessage('logisticsIds must be an array'),
    body('status').isIn(['pending', 'in_transit', 'delivered', 'failed']),
    body('notes').optional().isString()
  ],
  logisticsController.bulkUpdateStatus
);

module.exports = router;