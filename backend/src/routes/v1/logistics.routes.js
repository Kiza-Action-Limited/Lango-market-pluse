const express    = require('express');
const router     = express.Router();
const { body, param } = require('express-validator');

const logisticsController = require('../../controllers/logistics.controller');
const { protect, authorize } = require('../../middleware/auth');
const subscriptionGate = require('../../middleware/subscriptionGate');
const requireApprovedLogistics = require('../../middleware/requireApprovedLogistics');
const { uploadDocuments, handleUploadError } = require('../../middleware/upload');

// All routes require authentication
router.use(protect);

// ─── Logistics Application Flow ───────────────────────────────────────────────
router.post(
  '/apply',
  authorize('buyer', 'seller', 'farmer', 'logistics', 'admin'),
  uploadDocuments.fields([
    { name: 'nationalIdImage', maxCount: 1 },
    { name: 'businessPermitImage', maxCount: 1 },
  ]),
  handleUploadError,
  [
    body('driverMode').optional().isIn(['owner_operator', 'hired_driver']),
    body('vehiclePlate').notEmpty().withMessage('vehiclePlate is required'),
    body('cargoCapacityKg').isFloat({ min: 1 }).withMessage('cargoCapacityKg must be greater than 0'),
    body('documentType').isIn(['national_id', 'business_permit']).withMessage('Invalid documentType'),
    body('documentNumber').notEmpty().withMessage('documentNumber is required'),
    body('fleetOwnerId').optional().isMongoId(),
  ],
  logisticsController.applyAsLogistics
);

router.get('/me/application', logisticsController.getMyLogisticsApplication);

// ─── Create ───────────────────────────────────────────────────────────────────
router.post('/',
  authorize('admin', 'logistics'),
  requireApprovedLogistics,
  subscriptionGate(['growth', 'mizigo']),
  [
    body('orderId').isMongoId().withMessage('Valid order ID required'),
    body('driverType').optional().isIn(['owner_operator', 'hired_driver']),
    body('driverId').optional().isMongoId(),
    body('fleetOwnerId').optional().isMongoId(),
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
  requireApprovedLogistics,
  subscriptionGate('mizigo'),
  [
    param('id').isMongoId(),
    body('qrPayload').notEmpty().withMessage('QR payload required'),
    body('lat').optional().isFloat(),
    body('lng').optional().isFloat()
  ],
  logisticsController.scanPickup
);

router.put('/:id/accept',
  authorize('logistics'),
  requireApprovedLogistics,
  [param('id').isMongoId()],
  logisticsController.acceptLogisticsOrder
);

/**
 * Step 2 — Buyer scans Driver's QR on delivery
 * Role: buyer (user)
 */
router.post('/:id/scan/delivery',
  authorize('buyer', 'seller', 'farmer', 'admin'),
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
  authorize('admin', 'buyer', 'seller', 'farmer'),
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
  authorize('buyer', 'seller', 'farmer', 'admin'),
  [param('id').isMongoId()],
  logisticsController.openDispute
);

// ─── Read ─────────────────────────────────────────────────────────────────────
router.get('/',
  authorize('admin', 'logistics'),
  subscriptionGate(['growth', 'mizigo']),
  logisticsController.getAllLogistics
);

router.get('/stats/delivery',
  authorize('admin', 'logistics'),
  subscriptionGate(['growth', 'mizigo']),
  logisticsController.getDeliveryStats
);

router.get('/order/:orderId',
  [param('orderId').isMongoId()],
  logisticsController.getLogisticsByOrder
);

router.get('/:id',
  [param('id').isMongoId()],
  logisticsController.getLogisticsById
);

// ─── Driver Assignment ────────────────────────────────────────────────────────
router.put('/:id/assign-driver',
  authorize('admin', 'logistics'),
  subscriptionGate('mizigo'),
  [
    param('id').isMongoId(),
    body('driverId').optional().isMongoId(),
    body('driverName').optional().isString(),
    body('driverPhone').optional().isString(),
    body('driverType').optional().isIn(['owner_operator', 'hired_driver']),
    body('fleetOwnerId').optional().isMongoId()
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
