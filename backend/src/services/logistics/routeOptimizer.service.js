'use strict';

const User = require('../../models/User.model');
const googleMaps = require('../maps/googleMaps.service');
const gpsTracking = require('./gpsTracking.service');

const httpError = (message, statusCode = 400, details = {}) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  Object.assign(error, details);
  return error;
};

const toNumber = (value, field) => {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw httpError(`${field} must be a valid number`, 400);
  }
  return number;
};

const getDriverLocation = (driver) => {
  const current = driver.logisticsProfile?.currentLocation;
  if (Number.isFinite(Number(current?.lat)) && Number.isFinite(Number(current?.lng))) {
    return {
      lat: Number(current.lat),
      lng: Number(current.lng),
      accuracy: current.accuracy,
      heading: current.heading,
      speed: current.speed,
      updatedAt: current.updatedAt,
    };
  }

  const coordinates = driver.logisticsProfile?.location?.coordinates || driver.location?.coordinates;
  if (Array.isArray(coordinates) && coordinates.length >= 2) {
    return {
      lat: Number(coordinates[1]),
      lng: Number(coordinates[0]),
    };
  }

  return null;
};

class RouteOptimizerService {
  async geocodeAddress(address) {
    if (!address) {
      throw httpError('Address is required', 400);
    }

    return googleMaps.geocodeAddress(address);
  }

  async placeAutocomplete(input) {
    if (!input) {
      throw httpError('Input is required', 400);
    }

    return googleMaps.getPlaceAutocomplete(input);
  }

  async getNearbyDrivers({ lat, lng, maxDistanceKm = 10, cargoWeightKg = null }) {
    const location = {
      lat: toNumber(lat, 'lat'),
      lng: toNumber(lng, 'lng'),
    };
    const maxDistance = toNumber(maxDistanceKm, 'maxDistanceKm');
    const cargoWeight = cargoWeightKg == null ? null : toNumber(cargoWeightKg, 'cargoWeightKg');

    const drivers = await User.find({
      role: 'logistics',
      'logisticsProfile.verificationStatus': 'verified',
      'logisticsProfile.isOnline': true,
    }).select('_id fullName name businessName phone logisticsProfile currentLocation location');

    return drivers
      .map((driver) => {
        const driverLocation = getDriverLocation(driver);
        if (!driverLocation) return null;

        const distanceKm = googleMaps.calculateHaversineDistanceSync(location, driverLocation);
        const capacityKg = driver.logisticsProfile?.cargoCapacityKg;

        if (distanceKm > maxDistance) return null;
        if (cargoWeight != null && capacityKg && cargoWeight > capacityKg) return null;

        return {
          driverId: driver._id,
          name: driver.fullName || driver.name || driver.businessName || 'Logistics driver',
          phone: driver.phone,
          distanceKm: Math.round(distanceKm * 10) / 10,
          cargoCapacityKg: capacityKg,
          currentLocation: driverLocation,
          vehiclePlate: driver.logisticsProfile?.vehiclePlate,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }

  async calculateRoute(logisticsId) {
    return gpsTracking.calculateRoute(logisticsId);
  }

  async updateLocation(logisticsId, driverId, location) {
    return gpsTracking.updateLocation(logisticsId, driverId, {
      lat: toNumber(location.lat, 'lat'),
      lng: toNumber(location.lng, 'lng'),
      accuracy: location.accuracy == null ? undefined : toNumber(location.accuracy, 'accuracy'),
      speed: location.speed == null ? undefined : toNumber(location.speed, 'speed'),
      heading: location.heading == null ? undefined : toNumber(location.heading, 'heading'),
    });
  }

  async getCurrentLocation(logisticsId) {
    return gpsTracking.getCurrentLocation(logisticsId);
  }

  async getTrackingHistory(logisticsId, options = {}) {
    return gpsTracking.getTrackingHistory(logisticsId, options);
  }

  async validateDeliveryLocation(logisticsId, lat, lng) {
    return gpsTracking.validateDeliveryLocation(
      logisticsId,
      toNumber(lat, 'lat'),
      toNumber(lng, 'lng')
    );
  }
}

module.exports = new RouteOptimizerService();
