'use strict';

/**
 * Lango MarketPulse — Logistics Routes
 * Kakuma–Kitale Corridor | Plan 4 "Mizigo"
 *
 * Base path: /api/v1/logistics
 *
 * Role access:
 *  admin      — full access
 *  logistics  — driver/fleet operations (own records + job acceptance)
 *  wholesaler — read own shipments, create logistics for their orders
 *  retailer   — read own inbound shipments, confirm QR delivery
 *  farmer     — read own outbound shipments
 *  manufacturer — read own outbound shipments
 */

const express    = require('express');
const { body, param, query } = require('express-validator');
const ctrl       = require('../../controllers/logistics.controller');
const { protect, authorize } = require('../../middleware/auth');
<<<<<<< HEAD
const { validate }   = require('../../middleware/validation');
=======
const subscriptionGate = require('../../middleware/subscriptionGate');
const requireApprovedLogistics = require('../../middleware/requireApprovedLogistics');
const { uploadDocuments, handleUploadError } = require('../../middleware/upload');
>>>>>>> a4ca05ef18bdd6473e0d7b4cf68582b8dde40cd6

const router = express.Router();

// All routes require a valid JWT
router.use(protect);

<<<<<<< HEAD
// ─────────────────────────────────────────────────────────────────────────────
// COLLECTION ROUTES
// ─────────────────────────────────────────────────────────────────────────────

router
  .route('/')
  .post(
    authorize('admin', 'wholesaler', 'manufacturer', 'farmer'),
    [
      body('orderId').isMongoId().withMessage('Valid order ID required.'),
      body('carrier').optional().isIn(['solo_owner_operator', 'fleet_managed', 'third_party', 'other']),
      body('cargoType').optional().isString().trim(),
      body('weight').optional().isFloat({ min: 0 }),
      body('weightUnit').optional().isIn(['kg', 'g', 'lb', 'tons']),
      body('isExpress').optional().isBoolean(),
      body('shippingAddress.county').optional().isString().trim(),
      body('shippingAddress.town').notEmpty().withMessage('Delivery town is required.'),
    ],
    validate,
    ctrl.createLogistics
  )
  .get(
    authorize('admin', 'logistics'),
    [
      query('page').optional().isInt({ min: 1 }),
      query('limit').optional().isInt({ min: 1, max: 100 }),
      query('status').optional().isString(),
    ],
    validate,
    ctrl.getAllLogistics
  );

// ─────────────────────────────────────────────────────────────────────────────
// STATS (must be defined before /:id to avoid route conflict)
// ─────────────────────────────────────────────────────────────────────────────

router.get(
  '/stats/delivery',
=======
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
>>>>>>> a4ca05ef18bdd6473e0d7b4cf68582b8dde40cd6
  authorize('admin', 'logistics'),
  requireApprovedLogistics,
  subscriptionGate(['growth', 'mizigo']),
  [
<<<<<<< HEAD
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
=======
    body('orderId').isMongoId().withMessage('Valid order ID required'),
    body('driverType').optional().isIn(['owner_operator', 'hired_driver']),
    body('driverId').optional().isMongoId(),
    body('fleetOwnerId').optional().isMongoId(),
    body('shippingAddress').optional().isObject(),
    body('escrowAmount').optional().isFloat({ min: 0 }),
    body('commissionRate').optional().isFloat({ min: 0.05, max: 0.10 })
>>>>>>> a4ca05ef18bdd6473e0d7b4cf68582b8dde40cd6
  ],
  validate,
  ctrl.getDeliveryStats
);

// ─────────────────────────────────────────────────────────────────────────────
// BULK UPDATE (admin only)
// ─────────────────────────────────────────────────────────────────────────────

<<<<<<< HEAD
router.post(
  '/bulk-update',
  authorize('admin'),
=======
/**
 * Step 1 — Driver scans Seller's QR at pickup
 * Role: driver (logistics)
 */
router.post('/:id/scan/pickup',
  authorize('logistics', 'admin'),
  requireApprovedLogistics,
  subscriptionGate('mizigo'),
>>>>>>> a4ca05ef18bdd6473e0d7b4cf68582b8dde40cd6
  [
    body('logisticsIds').isArray({ min: 1 }).withMessage('At least one logistics ID required.'),
    body('logisticsIds.*').isMongoId(),
    body('status').isIn([
      'pending', 'driver_assigned', 'en_route_to_pickup',
      'picked_up', 'in_transit', 'out_for_delivery',
      'delivered', 'failed',
    ]),
    body('notes').optional().isString().trim(),
  ],
  validate,
  ctrl.bulkUpdateStatus
);

<<<<<<< HEAD
// ─────────────────────────────────────────────────────────────────────────────
// SINGLE RECORD ROUTES
// ─────────────────────────────────────────────────────────────────────────────

router
  .route('/:id')
  .get(
=======
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
>>>>>>> a4ca05ef18bdd6473e0d7b4cf68582b8dde40cd6
    param('id').isMongoId(),
    validate,
    ctrl.getLogisticsById
  );

router.get(
  '/order/:orderId',
  param('orderId').isMongoId(),
  validate,
  ctrl.getLogisticsByOrder
);

<<<<<<< HEAD
// ─────────────────────────────────────────────────────────────────────────────
// STATUS UPDATE
// ─────────────────────────────────────────────────────────────────────────────

router.put(
  '/:id/status',
  authorize('admin', 'logistics'),
  [
    param('id').isMongoId(),
    body('status').isIn([
      'pending', 'driver_assigned', 'en_route_to_pickup',
      'picked_up', 'in_transit', 'out_for_delivery',
      'delivered', 'failed', 'returned', 'disputed',
    ]).withMessage('Invalid status value.'),
    body('location').optional().isString().trim(),
    body('notes').optional().isString().trim(),
    body('gpsCoords.lat').optional().isFloat(),
    body('gpsCoords.lng').optional().isFloat(),
  ],
  validate,
  ctrl.updateLogisticsStatus
);

// ─────────────────────────────────────────────────────────────────────────────
// DRIVER ASSIGNMENT
// ─────────────────────────────────────────────────────────────────────────────

router.put(
  '/:id/assign-driver',
=======
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
>>>>>>> a4ca05ef18bdd6473e0d7b4cf68582b8dde40cd6
  authorize('admin', 'logistics'),
  subscriptionGate('mizigo'),
  [
    param('id').isMongoId(),
    body('driverId').optional().isMongoId(),
<<<<<<< HEAD
    body('driverName').optional().isString().trim(),
    body('driverPhone').optional().isString().trim(),
=======
    body('driverName').optional().isString(),
    body('driverPhone').optional().isString(),
    body('driverType').optional().isIn(['owner_operator', 'hired_driver']),
    body('fleetOwnerId').optional().isMongoId()
>>>>>>> a4ca05ef18bdd6473e0d7b4cf68582b8dde40cd6
  ],
  validate,
  ctrl.assignDriver
);

// ─────────────────────────────────────────────────────────────────────────────
// TRACKING INFO UPDATE
// ─────────────────────────────────────────────────────────────────────────────

router.put(
  '/:id/tracking',
  authorize('admin', 'logistics'),
  [
    param('id').isMongoId(),
    body('trackingNumber').optional().isString().trim(),
    body('carrier').optional().isString().trim(),
    body('estimatedDelivery').optional().isISO8601().withMessage('estimatedDelivery must be a valid ISO 8601 date.'),
  ],
  validate,
  ctrl.updateTracking
);

// ─────────────────────────────────────────────────────────────────────────────
// QR HANDSHAKE
// ─────────────────────────────────────────────────────────────────────────────

router.post(
  '/:id/qr-scan',
  authorize('admin', 'logistics', 'farmer', 'wholesaler', 'manufacturer', 'retailer'),
  [
    param('id').isMongoId(),
    body('step').isIn(['pickup', 'delivery']).withMessage('step must be "pickup" or "delivery".'),
    body('gpsCoords.lat').optional().isFloat({ min: -90, max: 90 }),
    body('gpsCoords.lng').optional().isFloat({ min: -180, max: 180 }),
  ],
  validate,
  ctrl.processQrScan
);

module.exports = router;
