const express = require('express');
const router = express.Router();
const qrtokenController = require('../../controllers/qrtoken.controller');
const { protect } = require('../../middleware/auth');
const rbacMiddleware = require('../../middleware/rbac');
const { body, param, query } = require('express-validator');

// All routes require authentication
router.use(protect);

/**
 * Generate QR token
 * POST /api/v1/qr-tokens/generate
 */
router.post(
  '/generate',
  rbacMiddleware(['admin', 'logistics', 'driver']),
  [
    body('orderId').isMongoId().withMessage('Valid order ID required'),
    body('logisticsId').isMongoId().withMessage('Valid logistics ID required'),
    body('type').isIn(['PICKUP', 'DELIVERY']).withMessage('Type must be PICKUP or DELIVERY'),
  ],
  qrtokenController.generateQRToken
);

/**
 * Scan QR token
 * POST /api/v1/qr-tokens/scan
 */
router.post(
  '/scan',
  rbacMiddleware(['driver', 'admin']),
  [
    body('token').notEmpty().withMessage('Token required'),
    body('gpsLat').optional().isFloat(),
    body('gpsLng').optional().isFloat(),
  ],
  qrtokenController.scanQRToken
);

/**
 * Get QR token details
 * GET /api/v1/qr-tokens/:id
 */
router.get(
  '/:id',
  [param('id').isMongoId()],
  qrtokenController.getQRToken
);

/**
 * List QR tokens for order
 * GET /api/v1/qr-tokens/order/:orderId
 */
router.get(
  '/order/:orderId',
  [
    param('orderId').isMongoId(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  qrtokenController.listOrderQRTokens
);

/**
 * Resend QR token
 * POST /api/v1/qr-tokens/:id/resend
 */
router.post(
  '/:id/resend',
  [param('id').isMongoId()],
  qrtokenController.resendQRToken
);

/**
 * Get QR token statistics
 * GET /api/v1/qr-tokens/stats
 */
router.get(
  '/stats',
  rbacMiddleware(['admin']),
  qrtokenController.getQRStats
);

module.exports = router;
