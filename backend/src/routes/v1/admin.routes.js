const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const adminController = require('../../controllers/admin.controller');
const { protect, admin } = require('../../middleware/auth');

// All routes require authentication and admin role
router.use(protect);
router.use(admin);

// Dashboard & Stats
router.get('/stats', adminController.getStats);
router.get('/analytics', adminController.getAnalytics);

// User Management
router.get('/users', adminController.getAllUsers);
router.get('/users/:userId', param('userId').isMongoId(), adminController.getUserDetails);
router.put('/users/:userId', param('userId').isMongoId(), adminController.updateUser);

// Order Management
router.get('/orders', adminController.getAllOrders);
router.put('/orders/:orderId/status', param('orderId').isMongoId(), [
  body('status').isIn(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled']),
  body('trackingNumber').optional().isString(),
  body('carrier').optional().isString()
], adminController.updateOrderStatus);

// Product Management
router.get('/products', adminController.getAllProducts);
router.put('/products/:productId/toggle', param('productId').isMongoId(), adminController.toggleProductStatus);
router.put('/products/:productId', param('productId').isMongoId(), adminController.updateProduct);

// Logistics Management
router.get('/logistics', adminController.getLogistics);
router.get('/logistics/applications', adminController.getLogisticsApplications);
router.put('/logistics/applications/:userId/review', param('userId').isMongoId(), [
  body('action').isIn(['approve', 'reject']),
  body('notes').optional().isString(),
], adminController.reviewLogisticsApplication);
router.put('/logistics/:logisticsId/tracking', param('logisticsId').isMongoId(), [
  body('status').isIn(['pending', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'failed']),
  body('location').optional().isString(),
  body('estimatedDelivery').optional().isISO8601()
], adminController.updateLogisticsTracking);

// Payment Management
router.get('/payments', adminController.getPayments);

// Communication
router.post('/broadcast', [
  body('type').isIn(['email', 'sms', 'push']),
  body('title').optional().isString(),
  body('message').notEmpty().isString(),
  body('targetRole').optional().isString(),
  body('targetUserType').optional().isString()
], adminController.broadcastNotification);

module.exports = router;
