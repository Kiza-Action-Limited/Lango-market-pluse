'use strict';

/**
 * Lango MarketPulse — Logistics Routes
 * Kakuma–Kitale Corridor | Plan 4 "Mizigo"
 *
 * Base path: /api/v1/logistics
 * Complete Google Maps & GPS Integration
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

const nearbyDriversValidation = [
  query('lat').isFloat({ min: -90, max: 90 }).withMessage('Valid latitude required.'),
  query('lng').isFloat({ min: -180, max: 180 }).withMessage('Valid longitude required.'),
  query('maxDistance').optional().isFloat({ min: 1, max: 100 }),
  query('weight').optional().isFloat({ min: 0 }),
];

const tripLocationValidation = [
  param('id').isMongoId(),
  body('lat').isFloat({ min: -90, max: 90 }).withMessage('Valid latitude required.'),
  body('lng').isFloat({ min: -180, max: 180 }).withMessage('Valid longitude required.'),
  body('accuracy').optional().isFloat(),
  body('speed').optional().isFloat(),
  body('heading').optional().isFloat({ min: 0, max: 360 }),
];

const nearbyDriversRoles = [
  'admin',
  'seller',
  'farmer',
  'buyer',
  'logistics',
  'wholesaler',
  'manufacturer',
  'retailer',
];

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
    body('gpsLat').optional().isFloat(),
    body('gpsLng').optional().isFloat(),
  ],
  validate,
  ctrl.applyAsLogistics
);

router.get('/me/application', ctrl.getMyLogisticsApplication);
router.get('/my-application', ctrl.getMyLogisticsApplication);

// ─── GPS & Location Tracking ───────────────────────────────────────────────────
router.post(
  '/geocode',
  authorize('admin', 'logistics', 'seller', 'buyer', 'farmer'),
  [
    body('address').notEmpty().withMessage('Address is required.'),
  ],
  validate,
  ctrl.geocodeAddress
);

router.get(
  '/places/autocomplete',
  authorize('admin', 'logistics', 'seller', 'buyer', 'farmer'),
  [
    query('input').notEmpty().withMessage('Input is required.'),
  ],
  validate,
  ctrl.placeAutocomplete
);

router.get(
  '/drivers/nearby',
  authorize(...nearbyDriversRoles),
  nearbyDriversValidation,
  validate,
  ctrl.getNearbyDrivers
);

router.get(
  '/nearby-drivers',
  authorize(...nearbyDriversRoles),
  nearbyDriversValidation,
  validate,
  ctrl.getNearbyDrivers
);

router.put(
  ['/location', '/driver/location'],
  authorize('logistics'),
  [
    body('lat').isFloat({ min: -90, max: 90 }).withMessage('Valid latitude required'),
    body('lng').isFloat({ min: -180, max: 180 }).withMessage('Valid longitude required'),
    body('heading').optional().isFloat({ min: 0, max: 360 }),
    body('speed').optional().isFloat({ min: 0 }),
  ],
  validate,
  ctrl.updateDriverLocation
);

router.get(
  '/:id/map',
  authorize('admin', 'logistics', 'farmer', 'wholesaler', 'manufacturer', 'retailer'),
  [
    param('id').isMongoId(),
  ],
  validate,
  ctrl.getTrackingMapData
);

// ─── Create ───────────────────────────────────────────────────────────────────
router.get(
  ['/:id/route', '/:id/route%20', '/:id/route '],
  authorize(...nearbyDriversRoles),
  [
    param('id').isMongoId(),
  ],
  validate,
  ctrl.getRoute
);

router.post(
  '/:id/calculate-route',
  authorize('admin', 'seller', 'farmer'),
  [
    param('id').isMongoId(),
  ],
  validate,
  ctrl.calculateRoute
);

router.post(
  ['/:id/update-location', '/:id/location'],
  authorize('logistics'),
  tripLocationValidation,
  validate,
  ctrl.updateLocation
);

router.put(
  ['/:id/update-location', '/:id/location'],
  authorize('logistics'),
  tripLocationValidation,
  validate,
  ctrl.updateLocation
);

router.get(
  ['/:id/current-location', '/:id/location'],
  authorize('admin', 'logistics', 'seller', 'buyer', 'farmer'),
  [
    param('id').isMongoId(),
  ],
  validate,
  ctrl.getCurrentLocation
);

router.get(
  '/:id/tracking-history',
  authorize('admin', 'logistics', 'seller', 'buyer', 'farmer'),
  [
    param('id').isMongoId(),
    query('limit').optional().isInt({ min: 1, max: 1000 }),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
  ],
  validate,
  ctrl.getTrackingHistory
);

router.post(
  ['/:id/validate-delivery-location', '/:id/validate-delivery'],
  authorize('logistics'),
  [
    param('id').isMongoId(),
    body('lat').isFloat({ min: -90, max: 90 }).withMessage('Valid latitude required.'),
    body('lng').isFloat({ min: -180, max: 180 }).withMessage('Valid longitude required.'),
  ],
  validate,
  ctrl.validateDeliveryLocation
);

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
      body('shippingAddress.gpsLat').optional().isFloat(),
      body('shippingAddress.gpsLng').optional().isFloat(),
      body('pickupAddress.gpsLat').optional().isFloat(),
      body('pickupAddress.gpsLng').optional().isFloat(),
      body('gpsLat').optional().isFloat(),
      body('gpsLng').optional().isFloat(),
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
      query('nearLat').optional().isFloat(),
      query('nearLng').optional().isFloat(),
      query('radiusKm').optional().isFloat({ min: 1, max: 100 }),
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

// ─── Group Trips / Shared Logistics ───────────────────────────────────────────
router.post(
  '/group-trip',
  authorize('admin', 'logistics', 'wholesaler', 'manufacturer', 'farmer'),
  [
    body('originLat').isFloat({ min: -90, max: 90 }),
    body('originLng').isFloat({ min: -180, max: 180 }),
    body('destinationLat').isFloat({ min: -90, max: 90 }),
    body('destinationLng').isFloat({ min: -180, max: 180 }),
    body('maxCapacityKg').optional().isFloat({ min: 100 }),
    body('deadlineHours').optional().isInt({ min: 1, max: 24 }),
    body('cargoType').optional().isString(),
  ],
  validate,
  ctrl.createGroupTrip
);

router.post(
  '/group-trip/join',
  authorize('admin', 'logistics', 'wholesaler', 'retailer', 'manufacturer', 'farmer'),
  [
    body('groupTripId').notEmpty().withMessage('Group trip ID required'),
    body('weightKg').isFloat({ min: 1 }).withMessage('Weight in kg required'),
  ],
  validate,
  ctrl.joinGroupTrip
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

router.post(
  '/bulk/status',
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
// QR TOKEN MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

router.post(
  ['/:id/generate-qr-tokens', '/:id/qr-tokens'],
  authorize('admin', 'seller', 'wholesaler', 'manufacturer', 'farmer'),
  [
    param('id').isMongoId(),
  ],
  validate,
  ctrl.generateQrTokens
);

router.get(
  '/:id/qr-tokens',
  authorize('admin', 'logistics', 'seller', 'buyer', 'farmer', 'wholesaler', 'manufacturer', 'retailer'),
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
// STATUS UPDATE WITH GPS VERIFICATION
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
  '/:id/accept',
  authorize('logistics'),
  subscriptionGate('mizigo'),
  [
    param('id').isMongoId(),
  ],
  validate,
  ctrl.acceptTrip
);

router.put(
  '/:id/assign-driver',
  authorize('admin', 'logistics'),
  subscriptionGate('mizigo'),
  [
    param('id').isMongoId(),
    body('driverId')
      .customSanitizer((value, { req }) => {
        const normalizedValue = String(value ?? '').trim();
        const lowerValue = normalizedValue.toLowerCase();
        if (!normalizedValue || ['driver_id', 'driver-id', 'driverid', 'placeholder'].includes(lowerValue)) {
          return undefined;
        }
        if (['me', 'self', 'current'].includes(lowerValue)) {
          return req.user.id || req.user._id?.toString();
        }
        return normalizedValue;
      })
      .custom((value) => !value || /^[a-f\d]{24}$/i.test(String(value)))
      .withMessage('driverId must be a valid logistics user ID'),
    body('driverName').optional({ values: 'falsy' }).isString().trim(),
    body('driverPhone').optional({ values: 'falsy' }).isString().trim(),
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
// QR HANDSHAKE WITH GPS VERIFICATION
// ─────────────────────────────────────────────────────────────────────────────

router.post(
  '/:id/qr-scan',
  authorize('admin', 'logistics', 'buyer', 'farmer', 'wholesaler', 'manufacturer', 'retailer'),
  [
    param('id').isMongoId(),
    body('step').optional().isIn(['pickup', 'delivery']).withMessage('step must be "pickup" or "delivery".'),
    body('token')
      .custom((value) => (
        (typeof value === 'string' && value.trim().length > 0) ||
        (value && typeof value === 'object' && typeof value.token === 'string' && value.token.trim().length > 0)
      ))
      .withMessage('A single-use QR token is required.'),
    body('gpsCoords.lat').optional().isFloat({ min: -90, max: 90 }),
    body('gpsCoords.lng').optional().isFloat({ min: -180, max: 180 }),
  ],
  validate,
  ctrl.processQrScan
);

// ─────────────────────────────────────────────────────────────────────────────
// ESCROW & DISPUTES - REQUIRE KYB VERIFICATION
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
  '/:id/release-escrow',
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
