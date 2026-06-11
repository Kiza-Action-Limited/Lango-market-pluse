const Logistics = require('../../models/Logistics.model');
const Order = require('../../models/Order.model');
const User = require('../../models/User.model');
const logger = require('../../utils/logger');

class LogisticsService {
  /**
   * Create logistics route
   */
  async createRoute(data, driverId) {
    const route = new Logistics({
      driver: driverId,
      ...data,
    });
    await route.save();
    return route.populate('driver', 'fullName phone').populate('pickups.order');
  }

  /**
   * Get active routes
   */
  async getActiveRoutes(options = {}) {
    const { page = 1, limit = 20, driverId = null, status = 'active' } = options;

    const query = { status };
    if (driverId) query.driver = driverId;

    const skip = (page - 1) * limit;

    const [routes, total] = await Promise.all([
      Logistics.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('driver', 'fullName phone')
        .populate('pickups.order'),
      Logistics.countDocuments(query),
    ]);

    return {
      routes,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  /**
   * Add stop to route
   */
  async addStop(routeId, driverId, stopData) {
    const route = await Logistics.findById(routeId);

    if (!route) throw new Error('Route not found');
    if (route.driver.toString() !== driverId.toString()) {
      throw new Error('Unauthorized');
    }

    route.stops.push(stopData);
    await route.save();
    return route;
  }

  /**
   * Update stop status
   */
  async updateStopStatus(routeId, stopId, status, driverId) {
    const route = await Logistics.findById(routeId);

    if (!route) throw new Error('Route not found');
    if (route.driver.toString() !== driverId.toString()) {
      throw new Error('Unauthorized');
    }

    const stop = route.stops.find((s) => s._id.toString() === stopId);
    if (!stop) throw new Error('Stop not found');

    stop.status = status;
    stop.completedAt = status === 'completed' ? new Date() : null;

    await route.save();
    return route;
  }

  /**
   * Get driver performance
   */
  async getDriverPerformance(driverId, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const routes = await Logistics.find({
      driver: driverId,
      createdAt: { $gte: startDate },
    });

    const completed = routes.filter((r) => r.status === 'completed').length;
    const pending = routes.filter((r) => r.status === 'pending').length;
    const canceled = routes.filter((r) => r.status === 'canceled').length;

    return {
      totalRoutes: routes.length,
      completed,
      pending,
      canceled,
      completionRate: ((completed / routes.length) * 100).toFixed(2),
    };
  }

  /**
   * Calculate delivery fee
   */
  calculateDeliveryFee(distance, weight = 1) {
    const baseFee = 100; // KES
    const distanceFee = distance * 10; // 10 KES per km
    const weightFee = (weight - 1) * 50; // 50 KES per kg after first kg

    return baseFee + distanceFee + Math.max(0, weightFee);
  }

  /**
   * Get available drivers
   */
  async getAvailableDrivers(location, maxDistance = 10) {
    const drivers = await User.find({
      role: 'logistics',
      accountRole: 'DRIVER',
      isOnline: true,
    }).select('fullName phone location gpsLat gpsLng');

    // Filter by distance
    return drivers.filter((driver) => {
      if (!driver.gpsLat || !driver.gpsLng) return false;
      const distance = this.calculateDistance(
        location.lat,
        location.lng,
        driver.gpsLat,
        driver.gpsLng
      );
      return distance <= maxDistance;
    });
  }

  /**
   * Calculate distance between two coordinates
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}

module.exports = new LogisticsService();
