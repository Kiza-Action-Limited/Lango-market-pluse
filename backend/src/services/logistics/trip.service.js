const Trip = require('../../models/Trip.model');
const Order = require('../../models/Order.model');
const User = require('../../models/User.model');
const { smsQueue } = require('../../config/redis');
const turf = require('@turf/turf');

class TripService {
  async assignTrip(tripData) {
    const { order, logisticsProvider, pickupLocation, deliveryLocation } = tripData;

    // Check if order exists
    const orderDoc = await Order.findById(order);
    if (!orderDoc) throw new Error('Order not found');

    // Calculate distance
    const from = turf.point([pickupLocation.coordinates[0], pickupLocation.coordinates[1]]);
    const to = turf.point([deliveryLocation.coordinates[0], deliveryLocation.coordinates[1]]);
    const distance = turf.distance(from, to, { units: 'kilometers' });

    const trip = await Trip.create({
      order,
      logisticsProvider,
      pickupLocation,
      deliveryLocation,
      estimatedDistanceKm: distance,
      estimatedDurationMin: distance * 2, // rough estimate: 2 min per km
      trackingToken: this.generateTrackingToken(),
    });

    // Notify logistics provider
    await smsQueue.add('send', {
      to: logisticsProvider.phone,
      message: `New trip assigned: Order ${order}. Pickup at ${pickupLocation.address}.`,
    });

    return trip;
  }

  async getTrips({ userId, role, page = 1, limit = 10, status }) {
    const query = {};
    if (role === 'logistics') query.logisticsProvider = userId;
    else if (role === 'admin') {}
    else {
      // For buyer/seller, get trips via order
      const orders = await Order.find({ $or: [{ buyer: userId }, { seller: userId }] }).select('_id');
      query.order = { $in: orders.map(o => o._id) };
    }
    if (status) query.status = status;

    const skip = (page - 1) * limit;
    const trips = await Trip.find(query)
      .populate('order', 'buyer seller totalAmount')
      .populate('logisticsProvider', 'fullName phone')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });
    const total = await Trip.countDocuments(query);
    return { data: trips, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  async updateTripStatus(tripId, status, userId, location = null) {
    const trip = await Trip.findById(tripId);
    if (!trip) throw new Error('Trip not found');
    if (trip.logisticsProvider.toString() !== userId && userId.role !== 'admin') {
      throw new Error('Unauthorized');
    }

    trip.status = status;
    if (status === 'picked_up') trip.pickedUpAt = new Date();
    if (status === 'delivered') trip.deliveredAt = new Date();
    if (location) {
      trip.currentLocation = {
        type: 'Point',
        coordinates: [location.lng, location.lat],
      };
      trip.locationHistory.push({
        coordinates: [location.lng, location.lat],
        timestamp: new Date(),
      });
    }
    await trip.save();

    // Notify order parties
    const order = await Order.findById(trip.order).populate('buyer seller');
    await smsQueue.add('send', {
      to: order.buyer.phone,
      message: `Your order ${order._id} is now ${status}.`,
    });

    return trip;
  }

  async updateLocation(tripId, userId, { lat, lng }) {
    return this.updateTripStatus(tripId, null, userId, { lat, lng });
  }

  async getTrackingInfo(trackingToken) {
    const trip = await Trip.findOne({ trackingToken }).populate('order', 'buyer seller totalAmount');
    if (!trip) throw new Error('Invalid tracking token');
    return {
      status: trip.status,
      currentLocation: trip.currentLocation,
      estimatedArrival: trip.deliveredAt || null,
      history: trip.locationHistory.slice(-5),
    };
  }

  async completeTrip(tripId, userId) {
    const trip = await this.updateTripStatus(tripId, 'delivered', userId);
    // Mark order as delivered
    const order = await Order.findById(trip.order);
    order.status = 'delivered';
    await order.save();
    return trip;
  }

  generateTrackingToken() {
    return require('crypto').randomBytes(16).toString('hex');
  }
}

module.exports = new TripService();