const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const adminController = require('../../controllers/admin.controller');
const logisticsController = require('../../controllers/logistics.controller');
const { protect, admin } = require('../../middleware/auth');
const { uploadDocuments, handleUploadError } = require('../../middleware/upload');

// All routes require authentication and admin role
router.use(protect);
router.use(admin);

// Dashboard & Stats
router.get('/stats', adminController.getStats);
router.get('/analytics', adminController.getAnalytics);
router.get('/reports/summary.pdf', adminController.exportSummaryPdf);

// User Management
router.get('/users', adminController.getAllUsers);
router.get('/documents', adminController.getAllUserDocuments);
router.get('/users/:userId', param('userId').isMongoId(), adminController.getUserDetails);
router.get('/users/:userId/documents', param('userId').isMongoId(), adminController.getUserDocuments);
router.put('/users/:userId', param('userId').isMongoId(), [
  body('role').optional().isIn(['seller', 'farmer', 'buyer', 'logistics', 'admin']),
  body('businessType').optional({ nullable: true, checkFalsy: true }).isIn([
    'brand',
    'wholesaler',
    'manufacturer',
    'retailer',
    'farmer',
    'small_business',
    'analytics',
    'analystic',
    'logistics',
  ]),
  body('isBlocked').optional().isBoolean(),
  body('isActive').optional().isBoolean(),
  body('isPhoneVerified').optional().isBoolean(),
  body('isEmailVerified').optional().isBoolean(),
  body('kycVerified').optional().isBoolean(),
  body('verificationStatus').optional().isIn(['unverified', 'pending', 'verified', 'gold', 'rejected', 'restricted']),
  body('userType').optional().isString().trim(),
  body('businessName').optional({ nullable: true, checkFalsy: true }).trim().isLength({ min: 2, max: 120 }),
  body('phone').optional({ nullable: true, checkFalsy: true }).matches(/^\+?254[0-9]{9}$/),
  body('address').optional({ nullable: true }).trim().isLength({ max: 240 }),
], adminController.updateUser);
router.post(
  '/users/:userId/documents',
  param('userId').isMongoId(),
  uploadDocuments.single('document'),
  handleUploadError,
  [
    body('documentType').optional().isIn(['national_id', 'business_permit', 'tax_certificate', 'kyc', 'contract', 'receipt', 'other']),
    body('title').optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 160 }),
    body('documentNumber').optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 120 }),
    body('notes').optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 500 }),
  ],
  adminController.uploadUserDocument
);

// Subscription Management
router.get('/subscriptions', adminController.getSubscriptions);
router.get('/subscriptions/features', adminController.getSubscriptionFeatures);
router.post('/subscriptions/features', [
  body('key').optional({ nullable: true, checkFalsy: true }).isString().trim().isLength({ max: 80 }),
  body('label').trim().notEmpty().isLength({ max: 120 }),
  body('description').optional({ nullable: true }).isString().trim().isLength({ max: 500 }),
  body('category').optional({ nullable: true, checkFalsy: true }).isString().trim().isLength({ max: 80 }),
  body('planIds').optional().isArray(),
  body('planIds.*').optional().isIn(['solo', 'smart', 'growth', 'mizigo']),
  body('isActive').optional().isBoolean(),
  body('sortOrder').optional().isInt({ min: 0 }),
], adminController.createSubscriptionFeature);
router.put('/subscriptions/features/:featureId', param('featureId').isMongoId(), [
  body('key').optional({ nullable: true, checkFalsy: true }).isString().trim().isLength({ max: 80 }),
  body('label').optional().trim().notEmpty().isLength({ max: 120 }),
  body('description').optional({ nullable: true }).isString().trim().isLength({ max: 500 }),
  body('category').optional({ nullable: true, checkFalsy: true }).isString().trim().isLength({ max: 80 }),
  body('planIds').optional().isArray(),
  body('planIds.*').optional().isIn(['solo', 'smart', 'growth', 'mizigo']),
  body('isActive').optional().isBoolean(),
  body('sortOrder').optional().isInt({ min: 0 }),
], adminController.updateSubscriptionFeature);
router.delete('/subscriptions/features/:featureId', param('featureId').isMongoId(), adminController.deleteSubscriptionFeature);
router.put('/subscriptions/:userId', param('userId').isMongoId(), [
  body('planId').isIn(['solo', 'smart', 'growth', 'mizigo']),
  body('amount').optional({ nullable: true, checkFalsy: true }).isFloat({ min: 0 }),
  body('status').optional().isIn(['active', 'inactive', 'suspended', 'cancelled', 'expired', 'trial']),
  body('endDate').optional({ nullable: true, checkFalsy: true }).isISO8601(),
  body('autoRenew').optional().isBoolean(),
  body('note').optional().isString().trim(),
], adminController.setSubscription);
router.delete('/subscriptions/:userId', param('userId').isMongoId(), [
  body('reason').optional().isString().trim(),
], adminController.cancelSellerSubscription);

// Order Management
router.get('/orders', adminController.getAllOrders);
router.put('/orders/:orderId/status', param('orderId').isMongoId(), [
  body('status').isIn([
    'AWAITING_PAYMENT',
    'FUNDS_HELD',
    'IN_TRANSIT',
    'DELIVERED',
    'RELEASED',
    'DISPUTED',
    'REFUNDED',
    'PARTIAL_REFUND',
    'EXPIRED',
    'pending_payment',
    'payment_escrowed',
    'processing',
    'dispatched',
    'delivered',
    'completed',
    'cancelled',
    'disputed',
  ]),
  body('trackingNumber').optional().isString(),
  body('carrier').optional().isString()
], adminController.updateOrderStatus);

// Product Management
router.get('/products', adminController.getAllProducts);
router.put('/products/:productId/toggle', param('productId').isMongoId(), adminController.toggleProductStatus);
router.put('/products/:productId', param('productId').isMongoId(), adminController.updateProduct);
router.delete('/products/:productId', param('productId').isMongoId(), adminController.deleteProduct);

// Logistics Management
router.get('/logistics', adminController.getLogistics);
router.get('/logistics/:logisticsId/live', param('logisticsId').isMongoId(), adminController.getLogisticsLiveTracking);
router.get('/logistics/applications', adminController.getLogisticsApplications);
router.put('/logistics/applications/:userId/review', param('userId').isMongoId(), [
  body('action').isIn(['approve', 'reject']),
  body('notes').optional().isString(),
], adminController.reviewLogisticsApplication);
router.post('/logistics/:id/qr-scan', [
  param('id').isMongoId(),
  body('step').optional().isIn(['pickup', 'delivery']),
  body('token').notEmpty().withMessage('QR token is required'),
  body('gpsCoords.lat').optional().isFloat({ min: -90, max: 90 }),
  body('gpsCoords.lng').optional().isFloat({ min: -180, max: 180 }),
], logisticsController.processQrScan);
router.post('/logistics/:logisticsId/escrow/release', [
  param('logisticsId').isMongoId(),
  body('forceRelease').optional().isBoolean(),
], adminController.releaseLogisticsEscrow);
router.put('/logistics/:logisticsId/tracking', param('logisticsId').isMongoId(), [
  body('status').isIn(['pending', 'driver_assigned', 'en_route_to_pickup', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'auto_released', 'failed', 'returned', 'disputed']),
  body('location').optional().isString(),
  body('estimatedDelivery').optional().isISO8601(),
  body('gpsCoords.lat').optional().isFloat({ min: -90, max: 90 }),
  body('gpsCoords.lng').optional().isFloat({ min: -180, max: 180 }),
], adminController.updateLogisticsTracking);

// Payment Management
router.get('/payments', adminController.getPayments);

// Communication
router.post('/broadcast', [
  body('type').isIn(['all', 'in_app', 'email', 'sms', 'push']),
  body('title').optional().isString(),
  body('message').notEmpty().isString(),
  body('targetMode').optional().isIn(['all', 'individual']),
  body('targetRole').optional().isString(),
  body('targetUserType').optional().isString(),
  body('recipientId').optional({ nullable: true, checkFalsy: true }).isMongoId(),
  body('recipientEmail').optional({ nullable: true, checkFalsy: true }).isEmail(),
  body('recipientPhone').optional({ nullable: true, checkFalsy: true }).isString().trim(),
], adminController.broadcastNotification);

module.exports = router;
