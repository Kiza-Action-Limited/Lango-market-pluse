'use strict';

/**
 * Lango MarketPulse — Logistics Routes
 * Kakuma–Kitale Corridor | Plan 4 "Mizigo"
 *
 * Base path: /api/v1/logistics
 */

const express = require('express');
const { body, param, query } = require('express-validator');
const ctrl = require('../../controllers/logistics.controller');
const { protect, authorize } = require('../../middleware/auth');
const { validate } = require('../../middleware/validation');
const subscriptionGate = require('../../middleware/subscriptionGate');
const requireVerified = require('../../middleware/requireVerified');
const { uploadDocuments, handleUploadError } = require('../../middleware/upload');

const router = express.Router();

// All routes require a valid JWT
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
  validate,
  ctrl.applyAsLogistics
);

router.get('/me/application', ctrl.getMyLogisticsApplication);

// ─── Create ───────────────────────────────────────────────────────────────────
router
  .route('/')
  .post(
    authorize('admin', 'wholesaler', 'manufacturer', 'farmer'),
    subscriptionGate(['growth', 'mizigo']),
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
    subscriptionGate(['growth', 'mizigo']),
    [
      query('page').optional().isInt({ min: 1 }),
      query('limit').optional().isInt({ min: 1, max: 100 }),
      query('status').optional().isString(),
    ],
    validate,
    ctrl.getAllLogistics
  );

// ─── Stats (must be defined before /:id to avoid route conflict) ────────────────
router.get(
  '/stats/delivery',
  authorize('admin', 'logistics'),
  subscriptionGate(['growth', 'mizigo']),
  [
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
  ],
  validate,
  ctrl.getDeliveryStats
);

// ─────────────────────────────────────────────────────────────────────────────
// BULK UPDATE (admin only)
// ─────────────────────────────────────────────────────────────────────────────

router.post(
  '/bulk-update',
  authorize('admin'),
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

// ─────────────────────────────────────────────────────────────────────────────
// QR TOKEN MANAGEMENT (MISSING ROUTES - ADD THIS SECTION)
// ─────────────────────────────────────────────────────────────────────────────

// Generate QR tokens for existing logistics record
router.post(
  '/:id/generate-qr-tokens',
  authorize('admin', 'wholesaler', 'manufacturer', 'farmer'),
  [
    param('id').isMongoId(),
  ],
  validate,
  ctrl.generateQrTokens
);

// Get QR tokens for a logistics record
router.get(
  '/:id/qr-tokens',
  authorize('admin', 'logistics', 'farmer', 'wholesaler', 'manufacturer', 'retailer'),
  [
    param('id').isMongoId(),
  ],
  validate,
  ctrl.getQrTokens
);

// ─────────────────────────────────────────────────────────────────────────────
// SINGLE RECORD ROUTES
// ─────────────────────────────────────────────────────────────────────────────

router
  .route('/:id')
  .get(
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
  authorize('admin', 'logistics'),
  subscriptionGate('mizigo'),
  [
    param('id').isMongoId(),
    body('driverId').optional().isMongoId(),
    body('driverName').optional().isString().trim(),
    body('driverPhone').optional().isString().trim(),
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
    body('token').isString().notEmpty().withMessage('A single-use QR token is required.'),
    body('gpsCoords.lat').optional().isFloat({ min: -90, max: 90 }),
    body('gpsCoords.lng').optional().isFloat({ min: -180, max: 180 }),
  ],
  validate,
  ctrl.processQrScan
);

// ─────────────────────────────────────────────────────────────────────────────
// ESCROW & DISPUTES - REQUIRE KYB VERIFICATION (Financial transactions)
// ─────────────────────────────────────────────────────────────────────────────

router.post(
  '/:id/escrow/release',
  authorize('admin', 'logistics', 'wholesaler', 'manufacturer'),
  requireVerified,
  [
    param('id').isMongoId(),
    body('triggeredBy').optional().isString(),
  ],
  validate,
  ctrl.releaseEscrow
);

router.post(
  '/:id/dispute',
  authorize('admin', 'logistics', 'wholesaler', 'manufacturer', 'retailer'),
  requireVerified,
  [
    param('id').isMongoId(),
  ],
  validate,
  ctrl.openDispute
);

module.exports = router;