'use strict';

/**
 * GPS Tracking Service for Logistics
 * Manages real-time location tracking, geofencing, and route validation
 */

const mongoose = require('mongoose');
const Logistics = require('../../models/Logistics.model');
const QRToken = require('../../models/QRToken.model');
const User = require('../../models/User.model');
const googleMaps = require('../maps/googleMaps.service');
const dispatchSvc = require('../notification/dispatch.service');
const logger = require('../../utils/logger');

const createHttpError = (statusCode, message, details = {}) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  Object.assign(error, details);
  return error;
};

const getIdString = (value) => {
  if (!value) return null;
  return value._id?.toString?.() || value.toString();
};

class GPSTrackingService {
  /**
   * Update driver's current location
   * @param {string} logisticsId - Logistics record ID
   * @param {string} driverId - Driver user ID
   * @param {Object} location - {lat, lng, accuracy, speed, heading}
   * @returns {Promise<Object>}
   */
  async updateLocation(logisticsId, driverId, location) {
    const logistics = await Logistics.findById(logisticsId);
    
    if (!logistics) {
      throw createHttpError(404, 'Logistics record not found');
    }
    
    let assignedDriverId = getIdString(logistics.driver);
    const currentDriverId = getIdString(driverId);
    let autoAccepted = false;

    if (!assignedDriverId) {
      if (logistics.status !== 'pending') {
        throw createHttpError(409, 'Assign this trip before updating its live location', {
          code: 'LOGISTICS_TRIP_UNASSIGNED',
          currentStatus: logistics.status,
        });
      }

      const driver = await User.findById(currentDriverId).select(
        'role fullName name businessName phone employer ownerAccount logisticsProfile'
      );

      if (!driver || driver.role !== 'logistics') {
        throw createHttpError(403, 'Only logistics drivers can update shipment location', {
          code: 'LOGISTICS_DRIVER_REQUIRED',
        });
      }

      if (driver.logisticsProfile?.verificationStatus !== 'verified') {
        throw createHttpError(403, 'Logistics verification is required before accepting trips', {
          code: 'LOGISTICS_VERIFICATION_REQUIRED',
        });
      }

      logistics.driver = driver._id;
      logistics.driverName = driver.fullName || driver.name || driver.businessName || 'Logistics driver';
      logistics.driverPhone = driver.phone;

      const fleetOwnerId = driver.employer || driver.logisticsProfile?.fleetOwner || driver.ownerAccount;
      if (fleetOwnerId) {
        logistics.fleetOwner = fleetOwnerId;
        logistics.carrier = 'fleet_managed';
      } else {
        logistics.carrier = 'solo_owner_operator';
      }

      await QRToken.updateOne(
        { logistics: logistics._id, type: 'DELIVERY', isUsed: false },
        { $set: { holder: driver._id } }
      );

      await logistics.updateStatus('driver_assigned', {
        notes: 'Driver accepted trip with live location update',
        updatedBy: driver._id,
      });

      assignedDriverId = getIdString(driver._id);
      autoAccepted = true;
    }

    if (assignedDriverId !== currentDriverId) {
      throw createHttpError(403, 'Not authorized to update location for this shipment', {
        code: 'LOGISTICS_LOCATION_FORBIDDEN',
      });
    }

    logistics.gpsTracking = logistics.gpsTracking || {};
    logistics.gpsTracking.history = logistics.gpsTracking.history || [];
    
    // Snap to road for better accuracy
    let snappedLocation = location;
    if (process.env.GOOGLE_MAPS_API_KEY) {
      try {
        const snapped = await googleMaps.snapToRoad([{ lat: location.lat, lng: location.lng }]);
        if (snapped && snapped.length > 0) {
          snappedLocation = snapped[0];
        }
      } catch (error) {
        logger.warn('Snap to road failed, using raw GPS:', error.message);
      }
    }
    
    // Add to history
    logistics.gpsTracking.history.push({
      location: { lat: snappedLocation.lat, lng: snappedLocation.lng },
      accuracy: location.accuracy,
      speed: location.speed,
      heading: location.heading,
      timestamp: new Date(),
      recordedBy: driverId,
    });
    
    // Update current location
    logistics.gpsTracking.current = {
      lat: snappedLocation.lat,
      lng: snappedLocation.lng,
      accuracy: location.accuracy,
      lastUpdate: new Date(),
    };

    await User.updateOne(
      { _id: currentDriverId },
      {
        $set: {
          'logisticsProfile.currentLocation': {
            lat: snappedLocation.lat,
            lng: snappedLocation.lng,
            accuracy: location.accuracy,
            heading: location.heading || 0,
            speed: location.speed || 0,
            updatedAt: new Date(),
          },
          'logisticsProfile.location': {
            type: 'Point',
            coordinates: [snappedLocation.lng, snappedLocation.lat],
          },
          'logisticsProfile.isOnline': true,
        },
      }
    );
    
    // Keep only last 1000 points (prune old data)
    if (logistics.gpsTracking.history.length > 1000) {
      logistics.gpsTracking.history = logistics.gpsTracking.history.slice(-1000);
    }
    
    await logistics.save();
    
    // Check geofences
    await this.checkGeofences(logistics, snappedLocation);
    
    return {
      logisticsId: logistics._id,
      location: snappedLocation,
      autoAccepted,
      status: logistics.status,
      timestamp: new Date(),
    };
  }
  
  /**
   * Check if driver has entered any geofence
   */
  async checkGeofences(logistics, location) {
    let notificationsSent = [];
    
    // Check pickup geofence
    if (logistics.gpsTracking.pickupGeofence?.center?.lat) {
      const isAtPickup = googleMaps.isWithinGeofence(
        location,
        logistics.gpsTracking.pickupGeofence.center,
        logistics.gpsTracking.pickupGeofence.radiusMeters || 50
      );
      
      if (isAtPickup && !logistics.gpsTracking.pickupGeofence.enteredAt) {
        logistics.gpsTracking.pickupGeofence.enteredAt = new Date();
        await logistics.save();
        
        // Notify seller
        await dispatchSvc.dispatch({
          userIds: [logistics.seller],
          channels: ['push', 'sms'],
          title: 'Driver arriving for pickup',
          body: `Driver ${logistics.driverName} is now at your location for pickup.`,
          data: { logisticsId: logistics._id.toString(), type: 'pickup_arrival' },
        });
        
        notificationsSent.push('pickup_arrival');
      }
    }
    
    // Check delivery geofence
    if (logistics.gpsTracking.deliveryGeofence?.center?.lat) {
      const isAtDelivery = googleMaps.isWithinGeofence(
        location,
        logistics.gpsTracking.deliveryGeofence.center,
        logistics.gpsTracking.deliveryGeofence.radiusMeters || 50
      );
      
      if (isAtDelivery && !logistics.gpsTracking.deliveryGeofence.enteredAt) {
        logistics.gpsTracking.deliveryGeofence.enteredAt = new Date();
        await logistics.save();
        
        // Notify buyer
        await dispatchSvc.dispatch({
          userIds: [logistics.buyer],
          channels: ['push', 'sms'],
          title: 'Driver approaching delivery location',
          body: `Your package is arriving! Driver ${logistics.driverName} is at your location.`,
          data: { logisticsId: logistics._id.toString(), type: 'delivery_arrival' },
        });
        
        notificationsSent.push('delivery_arrival');
      }
    }
    
    return notificationsSent;
  }
  
  /**
   * Set up geofence for pickup location
   */
  async setupPickupGeofence(logisticsId, centerLat, centerLng, radiusMeters = 50) {
    const logistics = await Logistics.findById(logisticsId);
    
    if (!logistics) {
      throw new Error('Logistics record not found');
    }
    
    logistics.gpsTracking = logistics.gpsTracking || {};
    logistics.gpsTracking.pickupGeofence = {
      center: { lat: centerLat, lng: centerLng },
      radiusMeters,
      enteredAt: null,
    };
    
    await logistics.save();
    
    return logistics.gpsTracking.pickupGeofence;
  }
  
  /**
   * Set up geofence for delivery location
   */
  async setupDeliveryGeofence(logisticsId, centerLat, centerLng, radiusMeters = 50) {
    const logistics = await Logistics.findById(logisticsId);
    
    if (!logistics) {
      throw new Error('Logistics record not found');
    }
    
    logistics.gpsTracking = logistics.gpsTracking || {};
    logistics.gpsTracking.deliveryGeofence = {
      center: { lat: centerLat, lng: centerLng },
      radiusMeters,
      enteredAt: null,
    };
    
    await logistics.save();
    
    return logistics.gpsTracking.deliveryGeofence;
  }
  
  /**
   * Calculate and update route information
   */
  async calculateRoute(logisticsId) {
    const logistics = await Logistics.findById(logisticsId)
      .populate('seller buyer');
    
    if (!logistics) {
      throw new Error('Logistics record not found');
    }
    
    // Get coordinates
    let origin, destination;
    
    if (logistics.pickupAddress?.gpsLat && logistics.pickupAddress?.gpsLng) {
      origin = { lat: logistics.pickupAddress.gpsLat, lng: logistics.pickupAddress.gpsLng };
    } else if (logistics.pickupAddress?.label) {
      const geocoded = await googleMaps.geocodeAddress(logistics.pickupAddress.label);
      origin = { lat: geocoded.lat, lng: geocoded.lng };
    } else {
      throw new Error('Pickup location not specified');
    }
    
    if (logistics.shippingAddress?.gpsLat && logistics.shippingAddress?.gpsLng) {
      destination = { lat: logistics.shippingAddress.gpsLat, lng: logistics.shippingAddress.gpsLng };
    } else {
      const addressStr = `${logistics.shippingAddress.town}, ${logistics.shippingAddress.county}, Kenya`;
      const geocoded = await googleMaps.geocodeAddress(addressStr);
      destination = { lat: geocoded.lat, lng: geocoded.lng };
    }
    
    // Calculate distance and duration
    const route = await googleMaps.calculateDistance(origin, destination);
    
    // Calculate delivery fee
    const fee = googleMaps.calculateDeliveryFee(
      route.distance,
      logistics.weight || 1,
      logistics.isExpress
    );
    
    // Update logistics
    logistics.routeInfo = {
      totalDistanceKm: route.distance,
      estimatedDurationMin: route.duration,
      waypoints: [
        {
          location: origin,
          address: logistics.pickupAddress?.label,
          type: 'pickup',
          sequence: 0,
        },
        {
          location: destination,
          address: logistics.shippingAddress?.label || `${logistics.shippingAddress.town}, ${logistics.shippingAddress.county}`,
          type: 'dropoff',
          sequence: 1,
        },
      ],
    };
    
    // Update shipping cost
    logistics.shippingCost = fee.total;
    
    await logistics.save();
    
    // Setup geofences
    await this.setupPickupGeofence(logisticsId, origin.lat, origin.lng);
    await this.setupDeliveryGeofence(logisticsId, destination.lat, destination.lng);
    
    return {
      distance: route.distance,
      duration: route.duration,
      shippingCost: fee.total,
      feeBreakdown: fee,
    };
  }
  
  /**
   * Get driver's current location for map display
   */
  async getCurrentLocation(logisticsId) {
    const logistics = await Logistics.findById(logisticsId)
      .select('gpsTracking.current driverName driverPhone status');
    
    if (!logistics) {
      throw new Error('Logistics record not found');
    }
    
    return {
      logisticsId,
      status: logistics.status,
      driverName: logistics.driverName,
      driverPhone: logistics.driverPhone,
      location: logistics.gpsTracking?.current || null,
      lastUpdate: logistics.gpsTracking?.current?.lastUpdate,
    };
  }
  
  /**
   * Get complete tracking history for a shipment
   */
  async getTrackingHistory(logisticsId, options = {}) {
    const { limit = 100, startDate, endDate } = options;
    
    const logistics = await Logistics.findById(logisticsId)
      .select('gpsTracking.history gpsTracking.current status');
    
    if (!logistics) {
      throw new Error('Logistics record not found');
    }
    
    let history = [...(logistics.gpsTracking?.history || [])];
    
    // Filter by date range
    if (startDate) {
      history = history.filter(h => h.timestamp >= new Date(startDate));
    }
    if (endDate) {
      history = history.filter(h => h.timestamp <= new Date(endDate));
    }
    
    // Sort by timestamp descending and limit
    history.sort((a, b) => b.timestamp - a.timestamp);
    history = history.slice(0, limit);
    
    return {
      logisticsId,
      status: logistics.status,
      currentLocation: logistics.gpsTracking?.current || null,
      history,
      totalPoints: logistics.gpsTracking?.history?.length || 0,
    };
  }
  
  /**
   * Calculate total distance traveled from tracking history
   */
  async calculateTraveledDistance(logisticsId) {
    const logistics = await Logistics.findById(logisticsId);
    
    if (!logistics) {
      throw new Error('Logistics record not found');
    }
    
    const history = logistics.gpsTracking?.history || [];
    if (history.length < 2) {
      return 0;
    }
    
    let totalDistance = 0;
    
    for (let i = 1; i < history.length; i++) {
      const prev = history[i - 1].location;
      const curr = history[i].location;
      
      const distance = googleMaps.calculateHaversineDistanceSync(
        { lat: prev.lat, lng: prev.lng },
        { lat: curr.lat, lng: curr.lng }
      );
      
      totalDistance += distance;
    }
    
    // Update actual duration
    if (logistics.gpsTracking.history.length > 0) {
      const firstPoint = logistics.gpsTracking.history[0];
      const lastPoint = logistics.gpsTracking.history[logistics.gpsTracking.history.length - 1];
      
      const actualDuration = (lastPoint.timestamp - firstPoint.timestamp) / (1000 * 60); // minutes
      logistics.routeInfo = logistics.routeInfo || {};
      logistics.routeInfo.actualDurationMin = actualDuration;
      await logistics.save();
    }
    
    return totalDistance;
  }
  
  /**
   * Validate delivery location (50m radius requirement)
   */
  async validateDeliveryLocation(logisticsId, actualLat, actualLng) {
    const logistics = await Logistics.findById(logisticsId);
    
    if (!logistics) {
      throw new Error('Logistics record not found');
    }
    
    // Get expected delivery coordinates
    let expectedCoords;
    if (logistics.shippingAddress?.gpsLat && logistics.shippingAddress?.gpsLng) {
      expectedCoords = {
        lat: logistics.shippingAddress.gpsLat,
        lng: logistics.shippingAddress.gpsLng,
      };
    } else {
      const addressStr = `${logistics.shippingAddress.town}, ${logistics.shippingAddress.county}, Kenya`;
      const geocoded = await googleMaps.geocodeAddress(addressStr);
      expectedCoords = { lat: geocoded.lat, lng: geocoded.lng };
      
      // Save for future use
      logistics.shippingAddress.gpsLat = geocoded.lat;
      logistics.shippingAddress.gpsLng = geocoded.lng;
      await logistics.save();
    }
    
    return googleMaps.validateDeliveryLocation(
      { lat: actualLat, lng: actualLng },
      expectedCoords
    );
  }
  
  /**
   * Get nearby drivers for assignment
   */
  async getNearbyDrivers(location, maxDistanceKm = 10, cargoWeightKg = null) {
    const drivers = await mongoose.model('User').find({
      role: 'logistics',
      'logisticsProfile.verificationStatus': 'verified',
      'logisticsProfile.isOnline': true,
    }).select('_id name phone logisticsProfile.location logisticsProfile.currentLocation logisticsProfile.cargoCapacityKg');
    
    const nearby = [];
    
    for (const driver of drivers) {
      const currentLocation = driver.logisticsProfile?.currentLocation;
      const coordinates = driver.logisticsProfile?.location?.coordinates;
      const driverLocation = currentLocation?.lat && currentLocation?.lng
        ? { lat: currentLocation.lat, lng: currentLocation.lng }
        : Array.isArray(coordinates) && coordinates.length >= 2
          ? { lat: coordinates[1], lng: coordinates[0] }
          : null;

      if (!driverLocation) {
        continue;
      }
      
      const distance = googleMaps.calculateHaversineDistanceSync(
        { lat: location.lat, lng: location.lng },
        driverLocation
      );
      
      if (distance <= maxDistanceKm) {
        // Check if driver can carry the cargo weight
        let canCarry = true;
        if (cargoWeightKg && driver.logisticsProfile?.cargoCapacityKg) {
          canCarry = cargoWeightKg <= driver.logisticsProfile.cargoCapacityKg;
        }
        
        if (canCarry) {
          nearby.push({
            driverId: driver._id,
            name: driver.name,
            phone: driver.phone,
            distanceKm: Math.round(distance * 10) / 10,
            cargoCapacityKg: driver.logisticsProfile?.cargoCapacityKg,
          });
        }
      }
    }
    
    // Sort by distance
    nearby.sort((a, b) => a.distanceKm - b.distanceKm);
    
    return nearby;
  }
}

module.exports = new GPSTrackingService();
