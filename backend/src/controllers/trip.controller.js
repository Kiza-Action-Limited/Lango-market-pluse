const tripService = require('../services/logistics/trip.service');
const { validationResult } = require('express-validator');

/**
 * Assign a trip to logistics provider (admin/seller)
 * POST /api/v1/trips
 */
exports.assignTrip = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const tripData = req.body;
    const trip = await tripService.assignTrip(tripData);
    res.status(201).json({
      success: true,
      message: 'Trip assigned successfully',
      data: trip,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get trips for logistics provider or buyer/seller
 * GET /api/v1/trips
 */
exports.getTrips = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const userId = req.user.id;
    const role = req.user.role;

    const result = await tripService.getTrips({ userId, role, page, limit, status });
    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update trip status (pickup, transit, delivery)
 * PUT /api/v1/trips/:id/status
 */
exports.updateTripStatus = async (req, res, next) => {
  try {
    const { status, location } = req.body;
    const trip = await tripService.updateTripStatus(req.params.id, status, req.user.id, location);
    res.status(200).json({
      success: true,
      message: `Trip status updated to ${status}`,
      data: trip,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update current location (real-time tracking)
 * POST /api/v1/trips/:id/location
 */
exports.updateLocation = async (req, res, next) => {
  try {
    const { lat, lng } = req.body;
    const trip = await tripService.updateLocation(req.params.id, req.user.id, { lat, lng });
    res.status(200).json({
      success: true,
      message: 'Location updated',
      data: trip,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get tracking info for customer
 * GET /api/v1/trips/track/:trackingToken
 */
exports.trackTrip = async (req, res, next) => {
  try {
    const { trackingToken } = req.params;
    const trackingInfo = await tripService.getTrackingInfo(trackingToken);
    res.status(200).json({
      success: true,
      data: trackingInfo,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Complete trip (mark as delivered)
 * PUT /api/v1/trips/:id/complete
 */
exports.completeTrip = async (req, res, next) => {
  try {
    const trip = await tripService.completeTrip(req.params.id, req.user.id);
    res.status(200).json({
      success: true,
      message: 'Trip completed successfully',
      data: trip,
    });
  } catch (error) {
    next(error);
  }
};