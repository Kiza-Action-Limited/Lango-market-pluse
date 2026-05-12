const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const tripController = require('../../controllers/trip.controller');
const { protect: authMiddleware } = require('../../middleware/auth');
const rbacMiddleware = require('../../middleware/rbac');

router.use(authMiddleware);

// Customer tracking (public token)
router.get('/track/:trackingToken', tripController.trackTrip);

// Logistics & admin
router.post('/', rbacMiddleware(['admin', 'seller']), [
  body('order').isMongoId(),
  body('logisticsProvider').isMongoId(),
  body('pickupLocation').notEmpty(),
  body('deliveryLocation').notEmpty(),
], tripController.assignTrip);

router.get('/', [
  query('status').optional().isIn(['assigned', 'picked_up', 'in_transit', 'delivered', 'failed']),
], tripController.getTrips);

router.put('/:id/status', param('id').isMongoId(), [
  body('status').isIn(['picked_up', 'in_transit', 'delivered', 'failed']),
  body('location').optional(),
], tripController.updateTripStatus);

router.post('/:id/location', param('id').isMongoId(), [
  body('lat').isFloat(),
  body('lng').isFloat(),
], tripController.updateLocation);

router.put('/:id/complete', param('id').isMongoId(), tripController.completeTrip);

module.exports = router;