'use strict';

/**
 * Lango MarketPulse — Logistics Controller
 * Kakuma–Kitale Corridor | Plan 4 "Mizigo"
 * 
 * Complete Google Maps & GPS Integration
 * 3-Way QR Handshake | M-Pesa Escrow | Sinking Fund
 */

const Logistics = require('../models/Logistics.model');
const Order = require('../models/Order.model');
const User = require('../models/User.model');
const GroupTrip = require('../models/GroupTrip.model');
const QRToken = require('../models/QRToken.model');
const SinkingFund = require('../services/logistics/sinkingfund.service');
const { uploadToCloudinary } = require('../config/cloudinary.config');
const { validationResult } = require('express-validator');
const dispatchSvc = require('../services/notification/dispatch.service');
const qrChainSvc = require('../services/order/qrChain.service');
const escrowService = require('../services/order/escrow.service');
const routeOptimizer = require('../services/logistics/routeOptimizer.service');
const localGeocoder = require('../services/maps/localGeocoder.service');
const logger = require('../utils/logger');

// ─────────────────────────────────────────────────────────────────────────────
// GOOGLE MAPS & GPS HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

const logGoogleMapsHelperError = (operation, error) => {
  logger.error(`${operation} error: ${error.message}`, {
    code: error.code,
    axiosStatus: error.response?.status,
    axiosStatusText: error.response?.statusText,
  });
};

/**
 * Calculate distance between two coordinates using Haversine formula
 */
const calculateDistance = (lat1, lon1, lat2, lon2) => {
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
};

/**
 * Validate if GPS coordinates are within delivery radius (50m default)
 */
const isWithinDeliveryRadius = (driverLat, driverLng, destinationLat, destinationLng, radiusMeters = 50) => {
  const distanceKm = calculateDistance(driverLat, driverLng, destinationLat, destinationLng);
  const distanceMeters = distanceKm * 1000;
  return distanceMeters <= radiusMeters;
};

/**
 * Geocode address using Google Maps API
 */
const geocodeAddress = async (address) => {
  const localFallback = () => localGeocoder.geocodeAddress(address);

  if (!GOOGLE_MAPS_API_KEY) {
    logger.warn('Google Maps API key not configured');
    return localFallback();
  }

  try {
    const axios = require('axios');
    const encodedAddress = encodeURIComponent(
      typeof address === 'string' 
        ? address 
        : `${address.town || ''}, ${address.county || ''}, ${address.country || 'Kenya'}`
    );
    
    const response = await axios.get(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${GOOGLE_MAPS_API_KEY}`
    );
    
    if (response.data.status === 'OK' && response.data.results.length > 0) {
      const { lat, lng } = response.data.results[0].geometry.location;
      return { lat, lng, formattedAddress: response.data.results[0].formatted_address };
    }
    return localFallback();
  } catch (error) {
    logGoogleMapsHelperError('Geocoding', error);
    return localFallback();
  }
};

/**
 * Get route matrix between multiple points
 */
const getRouteMatrix = async (origins, destinations) => {
  if (!GOOGLE_MAPS_API_KEY) return null;

  try {
    const axios = require('axios');
    const originStr = origins.map(o => `${o.lat},${o.lng}`).join('|');
    const destStr = destinations.map(d => `${d.lat},${d.lng}`).join('|');
    
    const response = await axios.get(
      `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${originStr}&destinations=${destStr}&key=${GOOGLE_MAPS_API_KEY}&units=metric`
    );
    
    return response.data;
  } catch (error) {
    logGoogleMapsHelperError('Route matrix', error);
    return null;
  }
};

/**
 * Get ETA between two points
 */
const getETA = async (originLat, originLng, destLat, destLng) => {
  if (!GOOGLE_MAPS_API_KEY) return null;

  try {
    const axios = require('axios');
    const response = await axios.get(
      `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${originLat},${originLng}&destinations=${destLat},${destLng}&key=${GOOGLE_MAPS_API_KEY}&units=metric`
    );
    
    if (response.data.status === 'OK' && response.data.rows[0]?.elements[0]?.status === 'OK') {
      const element = response.data.rows[0].elements[0];
      return {
        distanceKm: element.distance.value / 1000,
        distanceMeters: element.distance.value,
        durationMinutes: Math.ceil(element.duration.value / 60),
        durationSeconds: element.duration.value,
        durationText: element.duration.text,
        distanceText: element.distance.text,
      };
    }
    return null;
  } catch (error) {
    logGoogleMapsHelperError('ETA calculation', error);
    return null;
  }
};

/**
 * Find nearest driver within radius
 */
const findNearestDrivers = async (pickupLat, pickupLng, maxRadiusKm = 10, limit = 5) => {
  const drivers = await User.find({
    role: 'logistics',
    'logisticsProfile.verificationStatus': 'verified',
    'logisticsProfile.isOnline': true,
    'logisticsProfile.currentLocation.lat': { $exists: true },
    'logisticsProfile.currentLocation.lng': { $exists: true },
  }).select('_id name phone logisticsProfile.currentLocation logisticsProfile.vehiclePlate logisticsProfile.cargoCapacityKg');

  const driversWithDistance = drivers.map(driver => {
    const distance = calculateDistance(
      pickupLat,
      pickupLng,
      driver.logisticsProfile?.currentLocation?.lat,
      driver.logisticsProfile?.currentLocation?.lng
    );
    return { driver, distance };
  });

  return driversWithDistance
    .filter(d => d.distance <= maxRadiusKm)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit);
};

const getOrderNumber = (order) => (
  order.orderNumber || `ORD-${order._id.toString().slice(-8).toUpperCase()}`
);

const normalizeAddress = (address, fallback = {}) => {
  const source = address || fallback || {};

  if (typeof source === 'string') {
    return {
      label: source,
      county: 'Unknown',
      town: 'Unknown',
      country: 'Kenya',
    };
  }

  return {
    label: source.label || source.street || fallback.label,
    county: source.county || fallback.county || 'Unknown',
    town: source.town || fallback.town || 'Unknown',
    street: source.street || fallback.street,
    gpsLat: source.gpsLat || source.lat || fallback.gpsLat,
    gpsLng: source.gpsLng || source.lng || fallback.gpsLng,
    country: source.country || fallback.country || 'Kenya',
  };
};

const toFiniteNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const hasValidCoordinatePair = (coordinates) => (
  Array.isArray(coordinates) &&
  coordinates.length === 2 &&
  coordinates.every((coordinate) => Number.isFinite(Number(coordinate)))
);

const getPlainLogisticsProfile = (profile) => {
  const plainProfile = profile?.toObject?.() || profile || {};
  const nextProfile = { ...plainProfile };

  if (!hasValidCoordinatePair(nextProfile.location?.coordinates)) {
    delete nextProfile.location;
  }

  return nextProfile;
};

const normalizeCarrier = (carrier) => {
  const value = String(carrier || '').trim();
  if (!value) return null;

  const normalized = value.toLowerCase().replace(/[\s-]+/g, '_');
  const aliases = {
    solo: 'solo_owner_operator',
    solo_owner: 'solo_owner_operator',
    solo_owner_operator: 'solo_owner_operator',
    owner_operator: 'solo_owner_operator',
    fleet: 'fleet_managed',
    fleet_managed: 'fleet_managed',
    fleet_owner: 'fleet_managed',
    third_party: 'third_party',
    thirdparty: 'third_party',
    courier: 'third_party',
    external: 'third_party',
    mizigo: 'third_party',
    mizigo_express: 'third_party',
    other: 'other',
  };

  return aliases[normalized] || 'other';
};

const uploadLogisticsDocument = async (file, userId, documentType) => {
  if (!file?.buffer) return null;

  const result = await uploadToCloudinary(
    file.buffer,
    `logistics/${userId}/documents`,
    file.mimetype
  );

  return {
    documentType,
    url: result.secure_url,
    publicId: result.public_id,
    uploadedAt: new Date(),
  };
};

/**
 * Calculate shipping cost based on distance and weight
 */
const calculateShippingCost = (distanceKm, weightKg, isExpress = false) => {
  const baseRate = 50; // KES per km
  const weightRate = 20; // KES per kg
  const expressMultiplier = isExpress ? 1.5 : 1;
  
  const distanceCost = distanceKm * baseRate;
  const weightCost = weightKg * weightRate;
  
  return Math.ceil((distanceCost + weightCost) * expressMultiplier);
};

/**
 * Deduct sinking fund (10% of driver payout)
 */
const deductSinkingFund = async (driverId, amount, logisticsId) => {
  const sinkingFund = await SinkingFund.getOrCreateFund(driverId);
  const driverShare = amount * 0.2; // 20% of sinking fund goes to driver's maintenance
  const fundAmount = amount * 0.1; // 10% total contribution
  
  await SinkingFund.contribute(driverId, fundAmount, null, logisticsId);
  
  return {
    contributed: fundAmount,
    driverShare,
    newBalance: (sinkingFund?.balance || 0) + fundAmount,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// LOGISTICS APPLICATION FLOW
// ─────────────────────────────────────────────────────────────────────────────

exports.applyAsLogistics = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const {
      driverMode = 'owner_operator',
      vehiclePlate,
      cargoCapacityKg,
      documentType,
      documentNumber,
      fleetOwnerId,
      gpsLat,
      gpsLng,
    } = req.body;

    if (!vehiclePlate || !cargoCapacityKg || !documentType || !documentNumber) {
      return res.status(400).json({
        success: false,
        message: 'vehiclePlate, cargoCapacityKg, documentType, and documentNumber are required.',
      });
    }

    const files = req.files || {};
    const nationalIdImage = files.nationalIdImage?.[0];
    const businessPermitImage = files.businessPermitImage?.[0];

    if (!nationalIdImage && !businessPermitImage) {
      return res.status(400).json({
        success: false,
        message: 'At least one document image is required (nationalIdImage or businessPermitImage).',
      });
    }

    const uploadedDocs = [];
    if (nationalIdImage) {
      const doc = await uploadLogisticsDocument(nationalIdImage, user._id, 'national_id');
      if (doc) uploadedDocs.push(doc);
    }
    if (businessPermitImage) {
      const doc = await uploadLogisticsDocument(businessPermitImage, user._id, 'business_permit');
      if (doc) uploadedDocs.push(doc);
    }

    const latitude = toFiniteNumber(gpsLat);
    const longitude = toFiniteNumber(gpsLng);
    const geocodedLocation = latitude !== null && longitude !== null
      ? { lat: latitude, lng: longitude }
      : null;
    const geoPoint = geocodedLocation
      ? { type: 'Point', coordinates: [longitude, latitude] }
      : null;
    const existingProfile = getPlainLogisticsProfile(user.logisticsProfile);

    user.role = 'logistics';
    user.businessType = 'logistics';
    user.subscriptionTier = 'mizigo';
    user.logisticsProfile = {
      ...existingProfile,
      verificationStatus: 'pending',
      documentType,
      documentNumber,
      vehiclePlate: String(vehiclePlate).trim().toUpperCase(),
      cargoCapacityKg: Number(cargoCapacityKg),
      driverMode,
      fleetOwner: driverMode === 'hired_driver' && fleetOwnerId ? fleetOwnerId : undefined,
      documents: uploadedDocs.length ? uploadedDocs : (user.logisticsProfile?.documents || []),
      currentLocation: geocodedLocation || existingProfile.currentLocation,
      isOnline: true,
      applicationSubmittedAt: new Date(),
      reviewedAt: null,
      reviewedBy: null,
      reviewNotes: '',
      verifiedAt: null,
    };

    if (geoPoint) {
      user.logisticsProfile.location = geoPoint;
    } else {
      delete user.logisticsProfile.location;
    }

    await user.save();

    // Create sinking fund for driver
    await SinkingFund.getOrCreateFund(user._id);

    res.status(200).json({
      success: true,
      message: 'Logistics application submitted successfully. Awaiting admin verification.',
      data: {
        verificationStatus: user.logisticsProfile.verificationStatus,
        applicationSubmittedAt: user.logisticsProfile.applicationSubmittedAt,
        driverMode: user.logisticsProfile.driverMode,
        vehiclePlate: user.logisticsProfile.vehiclePlate,
        currentLocation: geocodedLocation,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.getMyLogisticsApplication = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select(
      'role businessType logisticsProfile subscriptionTier'
    );
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    res.status(200).json({
      success: true,
      data: {
        role: user.role,
        businessType: user.businessType,
        subscriptionTier: user.subscriptionTier,
        logisticsProfile: user.logisticsProfile || { verificationStatus: 'unverified' },
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CREATE LOGISTICS WITH GPS & DRIVER MATCHING
// ─────────────────────────────────────────────────────────────────────────────

exports.geocodeAddress = async (req, res, next) => {
  try {
    const result = await routeOptimizer.geocodeAddress(req.body.address);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    if (err.code?.startsWith?.('GOOGLE_GEOCODING_') || err.code === 'GOOGLE_MAPS_API_KEY_MISSING') {
      return res.status(err.statusCode || 503).json({
        success: false,
        message: err.message,
        code: err.code,
        googleStatus: err.googleStatus,
        remediation: err.remediation,
      });
    }
    return next(err);
  }
};

exports.placeAutocomplete = async (req, res, next) => {
  try {
    const predictions = await routeOptimizer.placeAutocomplete(req.query.input);

    return res.status(200).json({
      success: true,
      data: predictions,
    });
  } catch (err) {
    next(err);
  }
};

exports.getNearbyDrivers = async (req, res, next) => {
  try {
    const drivers = await routeOptimizer.getNearbyDrivers({
      lat: req.query.lat,
      lng: req.query.lng,
      maxDistanceKm: req.query.maxDistance || 10,
      cargoWeightKg: req.query.weight,
    });

    return res.status(200).json({
      success: true,
      data: drivers,
    });
  } catch (err) {
    next(err);
  }
};

exports.calculateRoute = async (req, res, next) => {
  try {
    const route = await routeOptimizer.calculateRoute(req.params.id);

    return res.status(200).json({
      success: true,
      message: 'Route calculated successfully',
      data: route,
    });
  } catch (err) {
    next(err);
  }
};

exports.getRoute = async (req, res, next) => {
  try {
    const logistics = await Logistics.findById(req.params.id)
      .populate('driver', 'name phone logisticsProfile.currentLocation')
      .select('seller buyer driver orderNumber status pickupAddress shippingAddress routeInfo metadata estimatedDelivery actualDelivery shippingCost gpsTracking');

    if (!logistics) {
      return res.status(404).json({ success: false, message: 'Logistics record not found.' });
    }

    const userId = req.user._id || req.user.id;
    const isSeller = logistics.seller?.toString() === userId.toString();
    const isBuyer = logistics.buyer?.toString() === userId.toString();
    const isDriver = logistics.driver?._id?.toString() === userId.toString() || logistics.driver?.toString() === userId.toString();
    const isAdmin = req.user.role === 'admin';
    const isLogistics = req.user.role === 'logistics';

    if (!isSeller && !isBuyer && !isDriver && !isAdmin && !isLogistics) {
      return res.status(403).json({ success: false, message: 'Not authorized to view this route.' });
    }

    const pickup = {
      lat: logistics.pickupAddress?.gpsLat,
      lng: logistics.pickupAddress?.gpsLng,
      address: logistics.pickupAddress?.label || `${logistics.pickupAddress?.town || ''}, ${logistics.pickupAddress?.county || ''}`.replace(/^,\s*|,\s*$/g, ''),
    };

    const delivery = {
      lat: logistics.shippingAddress?.gpsLat,
      lng: logistics.shippingAddress?.gpsLng,
      address: logistics.shippingAddress?.label || `${logistics.shippingAddress?.town || ''}, ${logistics.shippingAddress?.county || ''}`.replace(/^,\s*|,\s*$/g, ''),
    };

    const routePath = [];
    if (pickup.lat && pickup.lng) routePath.push([pickup.lat, pickup.lng]);
    if (delivery.lat && delivery.lng) routePath.push([delivery.lat, delivery.lng]);

    const waypoints = logistics.routeInfo?.waypoints?.length
      ? logistics.routeInfo.waypoints
      : routePath.map(([lat, lng], index) => ({
          location: { lat, lng },
          type: index === 0 ? 'pickup' : 'dropoff',
          sequence: index,
        }));

    return res.status(200).json({
      success: true,
      data: {
        logisticsId: logistics._id,
        orderNumber: logistics.orderNumber,
        status: logistics.status,
        pickup,
        delivery,
        routePath,
        waypoints,
        distanceKm: logistics.routeInfo?.totalDistanceKm ?? logistics.metadata?.distanceKm ?? null,
        estimatedDurationMin: logistics.routeInfo?.estimatedDurationMin ?? logistics.metadata?.etaMinutes ?? null,
        estimatedDelivery: logistics.estimatedDelivery,
        actualDelivery: logistics.actualDelivery,
        shippingCost: logistics.shippingCost,
        polyline: logistics.routeInfo?.polyline || null,
        driver: logistics.driver ? {
          id: logistics.driver._id,
          name: logistics.driver.name,
          phone: logistics.driver.phone,
          currentLocation: logistics.driver.logisticsProfile?.currentLocation || logistics.gpsTracking?.current || null,
        } : null,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.updateLocation = async (req, res, next) => {
  try {
    const result = await routeOptimizer.updateLocation(
      req.params.id,
      req.user._id || req.user.id,
      req.body
    );

    return res.status(200).json({
      success: true,
      message: 'Location updated',
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

exports.getCurrentLocation = async (req, res, next) => {
  try {
    const location = await routeOptimizer.getCurrentLocation(req.params.id);

    return res.status(200).json({
      success: true,
      data: location,
    });
  } catch (err) {
    next(err);
  }
};

exports.getTrackingHistory = async (req, res, next) => {
  try {
    const history = await routeOptimizer.getTrackingHistory(req.params.id, {
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
    });

    return res.status(200).json({
      success: true,
      data: history,
    });
  } catch (err) {
    next(err);
  }
};

exports.validateDeliveryLocation = async (req, res, next) => {
  try {
    const validation = await routeOptimizer.validateDeliveryLocation(
      req.params.id,
      req.body.lat,
      req.body.lng
    );

    return res.status(validation.isValid ? 200 : 400).json({
      success: validation.isValid,
      data: validation,
      message: validation.message,
    });
  } catch (err) {
    next(err);
  }
};

exports.createLogistics = async (req, res, next) => {
  try {
    const { 
      orderId, 
      carrier, 
      pickupAddress, 
      shippingAddress, 
      weight, 
      weightUnit, 
      dimensions, 
      cargoType, 
      isExpress, 
      notes,
      gpsLat,
      gpsLng,
    } = req.body;

    const order = await Order.findById(orderId).populate('seller buyer');
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    const userId = req.user._id || req.user.id;
    const isSeller = order.seller._id.toString() === userId.toString();
    const isBuyer = order.buyer._id.toString() === userId.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isSeller && !isBuyer && !isAdmin) {
      return res.status(403).json({ 
        success: false, 
        message: 'You can only create logistics for your own orders.' 
      });
    }

    const existing = await Logistics.findOne({ order: orderId });
    if (existing) {
      return res.status(409).json({ success: false, message: 'A logistics record already exists for this order.' });
    }

    const orderNumber = getOrderNumber(order);
    if (!order.orderNumber) {
      await Order.updateOne({ _id: order._id }, { $set: { orderNumber } });
    }

    const orderDeliveryAddress = order.deliveryAddress?.toObject
      ? order.deliveryAddress.toObject()
      : order.deliveryAddress;

    // Normalize addresses with GPS
    const normalizedPickup = normalizeAddress(pickupAddress);
    const normalizedShipping = normalizeAddress(shippingAddress, orderDeliveryAddress);

    // Geocode addresses if GPS missing
    let pickupGps = normalizedPickup.gpsLat && normalizedPickup.gpsLng 
      ? { lat: normalizedPickup.gpsLat, lng: normalizedPickup.gpsLng }
      : null;
    let shippingGps = normalizedShipping.gpsLat && normalizedShipping.gpsLng
      ? { lat: normalizedShipping.gpsLat, lng: normalizedShipping.gpsLng }
      : null;

    if (!pickupGps && normalizedPickup.town) {
      const geocoded = await geocodeAddress(normalizedPickup);
      if (geocoded) {
        pickupGps = { lat: geocoded.lat, lng: geocoded.lng };
        normalizedPickup.gpsLat = geocoded.lat;
        normalizedPickup.gpsLng = geocoded.lng;
      }
    }

    if (!shippingGps && normalizedShipping.town) {
      const geocoded = await geocodeAddress(normalizedShipping);
      if (geocoded) {
        shippingGps = { lat: geocoded.lat, lng: geocoded.lng };
        normalizedShipping.gpsLat = geocoded.lat;
        normalizedShipping.gpsLng = geocoded.lng;
      }
    }

    // Calculate distance and ETA between pickup and delivery
    let distanceKm = null;
    let etaMinutes = null;
    let shippingCost = null;

    if (pickupGps && shippingGps) {
      distanceKm = calculateDistance(pickupGps.lat, pickupGps.lng, shippingGps.lat, shippingGps.lng);
      const eta = await getETA(pickupGps.lat, pickupGps.lng, shippingGps.lat, shippingGps.lng);
      if (eta) {
        etaMinutes = eta.durationMinutes;
      }
      shippingCost = calculateShippingCost(distanceKm, weight || 100, isExpress);
    } else {
      shippingCost = 500; // Default minimum
    }

    // Find nearest available drivers
    let nearestDrivers = [];
    if (pickupGps) {
      nearestDrivers = await findNearestDrivers(pickupGps.lat, pickupGps.lng, 10, 5);
    }

    const logistics = await Logistics.create({
      order: orderId,
      orderNumber,
      seller: order.seller._id,
      buyer: order.buyer._id,
      carrier: carrier ?? 'solo_owner_operator',
      pickupAddress: normalizedPickup,
      shippingAddress: normalizedShipping,
      weight: weight || 100,
      weightUnit: weightUnit || 'kg',
      dimensions,
      cargoType: cargoType || 'General cargo',
      isExpress: isExpress ?? false,
      notes,
      status: 'pending',
      shippingCost,
      estimatedDelivery: etaMinutes ? new Date(Date.now() + etaMinutes * 60000) : null,
      metadata: {
        distanceKm,
        etaMinutes,
        nearestDrivers: nearestDrivers.map(d => ({
          driverId: d.driver._id,
          name: d.driver.name,
          distance: d.distance,
        })),
      },
    });

    const qrTokens = await qrChainSvc.generateTripTokens(logistics);

    // Notify nearest drivers about available trip
    for (const driverInfo of nearestDrivers) {
      await dispatchSvc.dispatch({
        userIds: [driverInfo.driver._id],
        channels: ['push', 'sms'],
        title: '🚛 New Trip Available',
        body: `${cargoType || 'Cargo'} from ${normalizedPickup.town} to ${normalizedShipping.town}. Distance: ${distanceKm?.toFixed(1) || '?'}km. Fare: KES ${shippingCost}. Accept within 3 min.`,
        data: { 
          logisticsId: logistics._id.toString(),
          distance: driverInfo.distance,
          fare: shippingCost,
        },
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Logistics record created.',
      data: {
        logistics,
        shippingCost,
        distanceKm: distanceKm?.toFixed(2),
        etaMinutes,
        nearestDrivers: nearestDrivers.map(d => ({
          driverId: d.driver._id,
          name: d.driver.name,
          phone: d.driver.phone,
          distanceKm: d.distance.toFixed(2),
        })),
        qrTokens: {
          pickup: qrTokens.pickupToken,
          delivery: qrTokens.deliveryToken,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// READ
// ─────────────────────────────────────────────────────────────────────────────

exports.getAllLogistics = async (req, res, next) => {
  try {
    const { status, carrier, driverId, startDate, endDate, page = 1, limit = 20, nearLat, nearLng, radiusKm } = req.query;
    const query = {};
    const userId = req.user._id || req.user.id;

    if (status && status !== 'all') query.status = status;
    if (carrier && carrier !== 'all') query.carrier = carrier;
    if (driverId) query.driver = driverId;

    if (req.user.role === 'logistics' && !driverId) {
      query.$or = [
        { driver: userId },
        { status: 'pending', driver: { $exists: false } },
        { status: 'pending', driver: null },
      ];
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    let logisticsQuery = Logistics.find(query)
      .populate('order', 'orderNumber total')
      .populate('seller', 'name phone')
      .populate('buyer', 'name phone')
      .populate('driver', 'name phone logisticsProfile.currentLocation')
      .sort('-createdAt');

    // Filter by proximity if coordinates provided
    if (nearLat && nearLng && radiusKm) {
      const logisticsList = await logisticsQuery.lean();
      const filtered = logisticsList.filter(log => {
        const shippingGps = log.shippingAddress?.gpsLat && log.shippingAddress?.gpsLng
          ? { lat: log.shippingAddress.gpsLat, lng: log.shippingAddress.gpsLng }
          : null;
        if (!shippingGps) return false;
        const distance = calculateDistance(
          parseFloat(nearLat), parseFloat(nearLng),
          shippingGps.lat, shippingGps.lng
        );
        return distance <= parseFloat(radiusKm);
      });
      
      const total = filtered.length;
      const paginated = filtered.slice((page - 1) * limit, page * limit);
      
      return res.status(200).json({
        success: true,
        data: paginated,
        pagination: {
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
          total,
          pages: Math.ceil(total / limit),
        },
      });
    }

    const [records, total, stats] = await Promise.all([
      logisticsQuery.skip((page - 1) * limit).limit(parseInt(limit, 10)),
      Logistics.countDocuments(query),
      Logistics.getDeliveryStats(startDate, endDate),
    ]);

    return res.status(200).json({
      success: true,
      data: records,
      stats,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.getLogisticsById = async (req, res, next) => {
  try {
    const logistics = await Logistics.findById(req.params.id)
      .populate('order')
      .populate('seller buyer driver fleetOwner', 'name phone email logisticsProfile.currentLocation');

    if (!logistics) {
      return res.status(404).json({ success: false, message: 'Logistics record not found.' });
    }

    // Calculate current position if driver assigned and online
    let currentPosition = null;
    if (logistics.driver && logistics.status === 'in_transit') {
      const driver = await User.findById(logistics.driver._id);
      if (driver?.logisticsProfile?.currentLocation) {
        currentPosition = driver.logisticsProfile.currentLocation;
        
        // Calculate remaining distance and ETA
        if (currentPosition.lat && currentPosition.lng && 
            logistics.shippingAddress?.gpsLat && logistics.shippingAddress?.gpsLng) {
          const remainingDistance = calculateDistance(
            currentPosition.lat, currentPosition.lng,
            logistics.shippingAddress.gpsLat, logistics.shippingAddress.gpsLng
          );
          const eta = await getETA(
            currentPosition.lat, currentPosition.lng,
            logistics.shippingAddress.gpsLat, logistics.shippingAddress.gpsLng
          );
          
          currentPosition.remainingDistanceKm = remainingDistance.toFixed(2);
          currentPosition.etaMinutes = eta?.durationMinutes || null;
        }
      }
    }

    return res.status(200).json({ 
      success: true, 
      data: {
        ...logistics.toObject(),
        currentPosition,
        googleMapsApiKey: GOOGLE_MAPS_API_KEY ? 'configured' : null,
      } 
    });
  } catch (err) {
    next(err);
  }
};

exports.getLogisticsByOrder = async (req, res, next) => {
  try {
    const logistics = await Logistics.findOne({ order: req.params.orderId })
      .populate('order')
      .populate('seller buyer driver', 'name phone email logisticsProfile.currentLocation');

    if (!logistics) {
      return res.status(404).json({ success: false, message: 'No logistics record found for this order.' });
    }

    return res.status(200).json({ success: true, data: logistics });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE DRIVER LOCATION (GPS TRACKING)
// ─────────────────────────────────────────────────────────────────────────────

exports.updateDriverLocation = async (req, res, next) => {
  try {
    const { lat, lng, heading, speed } = req.body;
    const userId = req.user._id || req.user.id;

    if (!lat || !lng) {
      return res.status(400).json({ 
        success: false, 
        message: 'Latitude and longitude are required.' 
      });
    }

    // Update driver's current location
    const driver = await User.findById(userId);
    if (!driver || driver.role !== 'logistics') {
      return res.status(403).json({ 
        success: false, 
        message: 'Only logistics drivers can update location.' 
      });
    }

    driver.logisticsProfile = driver.logisticsProfile || {};
    driver.logisticsProfile.currentLocation = {
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      accuracy: req.body.accuracy,
      heading: heading || 0,
      speed: speed || 0,
      updatedAt: new Date(),
    };
    driver.logisticsProfile.location = {
      type: 'Point',
      coordinates: [parseFloat(lng), parseFloat(lat)],
    };
    driver.logisticsProfile.isOnline = true;
    await driver.save();

    // Update active logistics records for this driver
    const activeLogistics = await Logistics.find({
      driver: userId,
      status: { $in: ['driver_assigned', 'en_route_to_pickup', 'in_transit', 'out_for_delivery'] },
    });

    for (const logistics of activeLogistics) {
      // Check if driver is within 50m of delivery location
      if (logistics.status === 'out_for_delivery' && 
          logistics.shippingAddress?.gpsLat && logistics.shippingAddress?.gpsLng) {
        const isAtDestination = isWithinDeliveryRadius(
          lat, lng,
          logistics.shippingAddress.gpsLat,
          logistics.shippingAddress.gpsLng,
          50
        );
        
        if (isAtDestination && !logistics.deliveryQrConfirmed) {
          // Trigger arrival notification
          await dispatchSvc.dispatch({
            userIds: [logistics.buyer],
            channels: ['push', 'sms'],
            title: '📦 Driver has arrived!',
            body: `${driver.name} is at your location. Please scan the QR code to confirm delivery.`,
            data: { logisticsId: logistics._id.toString() },
          });
        }
      }

      // Update tracking history with location
      logistics.trackingHistory.push({
        status: logistics.status,
        location: `Current: ${lat}, ${lng}`,
        gpsCoords: { lat, lng },
        updatedBy: userId,
        timestamp: new Date(),
      });
      await logistics.save();
    }

    return res.status(200).json({
      success: true,
      message: 'Location updated',
      data: {
        lat,
        lng,
        heading,
        speed,
        activeTrips: activeLogistics.length,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET DRIVER TRACKING MAP DATA
// ─────────────────────────────────────────────────────────────────────────────

exports.getTrackingMapData = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const logistics = await Logistics.findById(id)
      .populate('driver', 'name phone logisticsProfile.currentLocation')
      .populate('seller', 'name location')
      .populate('buyer', 'name location');

    if (!logistics) {
      return res.status(404).json({ success: false, message: 'Logistics record not found.' });
    }

    // Check authorization
    const userId = req.user._id || req.user.id;
    const isSeller = logistics.seller._id.toString() === userId.toString();
    const isBuyer = logistics.buyer._id.toString() === userId.toString();
    const isDriver = logistics.driver && logistics.driver._id.toString() === userId.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isSeller && !isBuyer && !isDriver && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    const mapData = {
      logisticsId: logistics._id,
      orderNumber: logistics.orderNumber,
      status: logistics.status,
      
      // Pickup location
      pickup: {
        lat: logistics.pickupAddress?.gpsLat,
        lng: logistics.pickupAddress?.gpsLng,
        address: logistics.pickupAddress?.label || `${logistics.pickupAddress?.town}, ${logistics.pickupAddress?.county}`,
        confirmed: logistics.pickupQrConfirmed,
        confirmedAt: logistics.qrScans.find(s => s.step === 'pickup')?.scannedAt,
      },
      
      // Delivery location
      delivery: {
        lat: logistics.shippingAddress?.gpsLat,
        lng: logistics.shippingAddress?.gpsLng,
        address: logistics.shippingAddress?.label || `${logistics.shippingAddress?.town}, ${logistics.shippingAddress?.county}`,
        confirmed: logistics.deliveryQrConfirmed,
        confirmedAt: logistics.qrScans.find(s => s.step === 'delivery')?.scannedAt,
      },
      
      // Driver current location (if available)
      driver: logistics.driver ? {
        id: logistics.driver._id,
        name: logistics.driver.name,
        phone: logistics.driver.phone,
        currentLocation: logistics.driver.logisticsProfile?.currentLocation || null,
        lastUpdated: logistics.driver.logisticsProfile?.currentLocation?.updatedAt,
      } : null,
      
      // Route information
      route: {
        distanceKm: logistics.metadata?.distanceKm,
        estimatedMinutes: logistics.metadata?.etaMinutes,
        estimatedDelivery: logistics.estimatedDelivery,
        actualDelivery: logistics.actualDelivery,
      },
      
      // Tracking history
      trackingHistory: logistics.trackingHistory.map(t => ({
        status: t.status,
        location: t.location,
        timestamp: t.timestamp,
        gpsCoords: t.gpsCoords,
      })),
      
      // Expose configuration state only. The server-side API key must never leave the backend.
      googleMapsApiKey: GOOGLE_MAPS_API_KEY ? 'configured' : null,
    };

    // Calculate route path if both coordinates exist
    if (mapData.pickup.lat && mapData.pickup.lng && 
        mapData.delivery.lat && mapData.delivery.lng) {
      mapData.routePath = [
        [mapData.pickup.lat, mapData.pickup.lng],
        [mapData.delivery.lat, mapData.delivery.lng],
      ];
      
      // Add driver position if available
      if (mapData.driver?.currentLocation?.lat && mapData.driver?.currentLocation?.lng) {
        mapData.driverPosition = [
          mapData.driver.currentLocation.lat,
          mapData.driver.currentLocation.lng,
        ];
      }
    }

    return res.status(200).json({ success: true, data: mapData });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE — STATUS
// ─────────────────────────────────────────────────────────────────────────────

exports.updateLogisticsStatus = async (req, res, next) => {
  try {
    const { status, location, notes, gpsCoords } = req.body;

    const logistics = await Logistics.findById(req.params.id);
    if (!logistics) {
      return res.status(404).json({ success: false, message: 'Logistics record not found.' });
    }

    // Verify GPS for delivery status
    if (status === 'delivered' && logistics.shippingAddress?.gpsLat && gpsCoords) {
      const isWithinRadius = isWithinDeliveryRadius(
        gpsCoords.lat, gpsCoords.lng,
        logistics.shippingAddress.gpsLat,
        logistics.shippingAddress.gpsLng,
        50
      );
      
      if (!isWithinRadius) {
        return res.status(400).json({
          success: false,
          message: 'Delivery GPS verification failed. You must be within 50 meters of the delivery location to confirm delivery.',
          requiredRadiusMeters: 50,
          currentDistanceMeters: calculateDistance(
            gpsCoords.lat, gpsCoords.lng,
            logistics.shippingAddress.gpsLat,
            logistics.shippingAddress.gpsLng
          ) * 1000,
        });
      }
    }

    await logistics.updateStatus(status, { location, notes, gpsCoords, updatedBy: req.user._id });

    if (status === 'delivered') {
      await Order.findByIdAndUpdate(logistics.order, { status: 'delivered', deliveredAt: new Date() });
      
      // Deduct sinking fund from driver payout (10%)
      if (logistics.driver && logistics.shippingCost) {
        const sinkingResult = await deductSinkingFund(logistics.driver, logistics.shippingCost * 0.7, logistics._id);
        
        // Notify driver about sinking fund deduction
        await dispatchSvc.dispatch({
          userIds: [logistics.driver],
          channels: ['push', 'sms'],
          title: '💰 Sinking Fund Contribution',
          body: `KES ${sinkingResult.contributed} has been added to your Sinking Fund. Balance: KES ${sinkingResult.newBalance.toFixed(2)}`,
          data: { sinkingFund: sinkingResult },
        });
      }
      
      // Notify parties
      await dispatchSvc.dispatch({
        userIds: [logistics.seller, logistics.buyer],
        channels: ['push', 'sms'],
        title: '✅ Delivery Confirmed',
        body: `Your shipment ${logistics.orderNumber} has been delivered successfully.`,
        data: { logisticsId: logistics._id.toString(), status: 'delivered' },
      });
    } else if (status === 'in_transit') {
      await Order.findByIdAndUpdate(logistics.order, { status: 'dispatched' });
    } else if (status === 'disputed') {
      await Order.findByIdAndUpdate(logistics.order, { status: 'disputed' });
    }

    return res.status(200).json({ success: true, message: 'Status updated.', data: logistics });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE — DRIVER ASSIGNMENT
// ─────────────────────────────────────────────────────────────────────────────

exports.acceptTrip = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const verificationStatus = req.user.logisticsProfile?.verificationStatus;

    if (verificationStatus !== 'verified') {
      return res.status(403).json({
        success: false,
        message: 'Logistics verification is required before accepting trips.',
      });
    }

    const logistics = await Logistics.findById(req.params.id);
    if (!logistics) {
      return res.status(404).json({ success: false, message: 'Logistics record not found.' });
    }

    const assignedDriverId = logistics.driver?.toString();
    const currentDriverId = userId.toString();

    if (assignedDriverId && assignedDriverId !== currentDriverId) {
      return res.status(409).json({
        success: false,
        message: 'This trip has already been accepted by another driver.',
      });
    }

    const alreadyAcceptedStatuses = [
      'driver_assigned',
      'en_route_to_pickup',
      'picked_up',
      'in_transit',
      'out_for_delivery',
    ];

    if (assignedDriverId === currentDriverId && alreadyAcceptedStatuses.includes(logistics.status)) {
      return res.status(200).json({
        success: true,
        message: 'Trip already accepted.',
        data: logistics,
      });
    }

    if (!['pending', 'driver_assigned'].includes(logistics.status)) {
      return res.status(400).json({
        success: false,
        message: `Trips with status "${logistics.status}" cannot be accepted.`,
      });
    }

    logistics.driver = userId;
    logistics.driverName = req.user.fullName || req.user.name || req.user.businessName || 'Logistics driver';
    logistics.driverPhone = req.user.phone;

    // Calculate ETA from driver's current location to pickup
    let etaToPickup = null;
    if (req.user.logisticsProfile?.currentLocation?.lat && 
        req.user.logisticsProfile?.currentLocation?.lng &&
        logistics.pickupAddress?.gpsLat && logistics.pickupAddress?.gpsLng) {
      const eta = await getETA(
        req.user.logisticsProfile.currentLocation.lat,
        req.user.logisticsProfile.currentLocation.lng,
        logistics.pickupAddress.gpsLat,
        logistics.pickupAddress.gpsLng
      );
      if (eta) {
        etaToPickup = eta.durationMinutes;
        logistics.metadata = logistics.metadata || {};
        logistics.metadata.driverEtaToPickup = etaToPickup;
      }
    }

    const fleetOwnerId = req.user.employer || req.user.logisticsProfile?.fleetOwner || req.user.ownerAccount;
    if (fleetOwnerId) {
      logistics.fleetOwner = fleetOwnerId;
      logistics.carrier = 'fleet_managed';
    } else {
      logistics.carrier = 'solo_owner_operator';
    }

    await QRToken.updateOne(
      { logistics: logistics._id, type: 'DELIVERY', isUsed: false },
      { $set: { holder: userId } }
    );

    await logistics.updateStatus('driver_assigned', {
      notes: `Driver accepted trip${etaToPickup ? `, ETA to pickup: ${etaToPickup} min` : ''}`,
      updatedBy: userId,
    });

    if (dispatchSvc && logistics.seller) {
      await dispatchSvc.dispatch({
        userIds: [logistics.seller],
        channels: ['push', 'sms'],
        title: '🚛 Driver accepted your shipment',
        body: `${logistics.driverName} has accepted shipment ${logistics.orderNumber}.${etaToPickup ? ` ETA to pickup: ${etaToPickup} minutes.` : ''}`,
        data: { shipmentId: logistics._id.toString(), driverId: currentDriverId, etaToPickup },
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Trip accepted. Proceed to pickup QR scan.',
      data: {
        logistics,
        etaToPickup,
        pickupLocation: logistics.pickupAddress,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.assignDriver = async (req, res, next) => {
  try {
    const { driverId, driverName, driverPhone } = req.body;
    const userId = req.user._id || req.user.id;

    const logistics = await Logistics.findById(req.params.id);
    if (!logistics) {
      return res.status(404).json({ success: false, message: 'Logistics record not found.' });
    }

    const assignedDriverId = logistics.driver?.toString();
    const currentUserId = userId.toString();
    const requestedDriverId = driverId || (!driverName && !driverPhone && req.user.role === 'logistics' ? currentUserId : null);
    const activeStatuses = [
      'driver_assigned',
      'en_route_to_pickup',
      'picked_up',
      'in_transit',
      'out_for_delivery',
    ];

    if (assignedDriverId && requestedDriverId && assignedDriverId !== requestedDriverId.toString()) {
      return res.status(409).json({
        success: false,
        message: 'This trip has already been assigned to another driver.',
      });
    }

    if (assignedDriverId && assignedDriverId === requestedDriverId?.toString() && activeStatuses.includes(logistics.status)) {
      return res.status(200).json({
        success: true,
        message: 'Driver already assigned.',
        data: logistics,
      });
    }

    let etaToPickup = null;

    if (requestedDriverId) {
      const driver = await User.findById(requestedDriverId);
      if (!driver || driver.role !== 'logistics') {
        return res.status(400).json({ success: false, message: 'User is not a registered logistics driver.' });
      }

      logistics.driver = requestedDriverId;
      logistics.driverName = driver.name;
      logistics.driverPhone = driver.phone;

      // Calculate ETA
      if (driver.logisticsProfile?.currentLocation?.lat && 
          driver.logisticsProfile?.currentLocation?.lng &&
          logistics.pickupAddress?.gpsLat && logistics.pickupAddress?.gpsLng) {
        const eta = await getETA(
          driver.logisticsProfile.currentLocation.lat,
          driver.logisticsProfile.currentLocation.lng,
          logistics.pickupAddress.gpsLat,
          logistics.pickupAddress.gpsLng
        );
        if (eta) {
          etaToPickup = eta.durationMinutes;
          logistics.metadata = logistics.metadata || {};
          logistics.metadata.driverEtaToPickup = etaToPickup;
        }
      }

      const fleetOwnerId = driver.employer || driver.logisticsProfile?.fleetOwner || driver.ownerAccount;
      if (fleetOwnerId) {
        logistics.fleetOwner = fleetOwnerId;
        logistics.carrier = 'fleet_managed';
      } else {
        logistics.carrier = 'solo_owner_operator';
      }

      await QRToken.updateOne(
        { logistics: logistics._id, type: 'DELIVERY', isUsed: false },
        { $set: { holder: requestedDriverId } }
      );
    } else {
      if (!driverName && !driverPhone) {
        return res.status(400).json({
          success: false,
          message: 'Provide driverId, driverName/driverPhone, or call as a logistics user to assign yourself.',
        });
      }

      logistics.driverName = driverName;
      logistics.driverPhone = driverPhone;
      logistics.carrier = 'third_party';
    }

    await logistics.updateStatus('driver_assigned', { 
      updatedBy: userId,
      notes: etaToPickup ? `Driver assigned, ETA to pickup: ${etaToPickup} min` : 'Driver assigned',
    });

    const order = await Order.findById(logistics.order);
    if (order) {
      const etaText = logistics.estimatedDelivery
        ? logistics.estimatedDelivery.toLocaleDateString('en-KE', { timeZone: 'Africa/Nairobi' })
        : etaToPickup ? `${etaToPickup} minutes to pickup` : 'TBC';

      await dispatchSvc.dispatch({
        userIds: [logistics.seller],
        channels: ['push', 'sms'],
        title: `🚛 Driver assigned to your shipment`,
        body: `${logistics.driverName} (${logistics.driverPhone}) will collect your cargo. ${etaText}`,
        data: { shipmentId: logistics._id.toString(), driverName: logistics.driverName, etaToPickup },
      });
    }

    return res.status(200).json({ 
      success: true, 
      message: 'Driver assigned.', 
      data: { logistics, etaToPickup } 
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE — TRACKING INFO
// ─────────────────────────────────────────────────────────────────────────────

exports.updateTracking = async (req, res, next) => {
  try {
    const { trackingNumber, carrier, estimatedDelivery } = req.body;

    const logistics = await Logistics.findById(req.params.id);
    if (!logistics) {
      return res.status(404).json({ success: false, message: 'Logistics record not found.' });
    }

    if (trackingNumber) logistics.trackingNumber = trackingNumber;
    if (carrier) logistics.carrier = carrier;
    if (estimatedDelivery) logistics.estimatedDelivery = new Date(estimatedDelivery);

    await logistics.save();

    return res.status(200).json({ success: true, message: 'Tracking information updated.', data: logistics });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// QR TOKEN MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

exports.generateQrTokens = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const logistics = await Logistics.findById(id);
    
    if (!logistics) {
      return res.status(404).json({ 
        success: false, 
        message: 'Logistics record not found.' 
      });
    }

    const userId = req.user._id || req.user.id;
    const isSeller = logistics.seller.toString() === userId.toString();
    const isAdmin = req.user.role === 'admin';
    
    if (!isSeller && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only the seller or admin can generate QR tokens.'
      });
    }

    const deletedResult = await QRToken.deleteMany({ logistics: logistics._id });
    logger.info(`Deleted ${deletedResult.deletedCount} existing QR tokens for logistics ${id}`);

    logistics.pickupQrConfirmed = false;
    logistics.deliveryQrConfirmed = false;
    logistics.pickupQrScannedAt = null;
    logistics.deliveryQrScannedAt = null;
    logistics.pickupQrScannedBy = null;
    logistics.deliveryQrScannedBy = null;
    logistics.pickupQrToken = null;
    logistics.deliveryQrToken = null;
    await logistics.save();

    const qrTokens = await qrChainSvc.generateTripTokens(logistics);

    logistics.pickupQrToken = qrTokens.pickupToken;
    logistics.deliveryQrToken = qrTokens.deliveryToken;
    await logistics.save();

    return res.status(200).json({
      success: true,
      message: 'QR tokens generated successfully',
      data: {
        pickupToken: qrTokens.pickupToken,
        deliveryToken: qrTokens.deliveryToken,
        logisticsId: logistics._id
      }
    });
  } catch (err) {
    logger.error('Error generating QR tokens:', err);
    
    if (err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Duplicate key error. Please try again.',
        errors: [{ message: 'QR tokens already exist. Retrying generation...' }]
      });
    }
    
    next(err);
  }
};

exports.getQrTokens = async (req, res, next) => {
  try {
    const logistics = await Logistics.findById(req.params.id);
    
    if (!logistics) {
      return res.status(404).json({ 
        success: false, 
        message: 'Logistics record not found.' 
      });
    }

    const userId = req.user._id || req.user.id;
    const isSeller = logistics.seller.toString() === userId.toString();
    const isBuyer = logistics.buyer.toString() === userId.toString();
    const isDriver = logistics.driver && logistics.driver.toString() === userId.toString();
    const isAdmin = req.user.role === 'admin';
    
    if (!isSeller && !isBuyer && !isDriver && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view QR tokens for this shipment.'
      });
    }

    const qrTokens = await QRToken.find({
      logistics: logistics._id,
      isUsed: false,
      $or: [{ expiresAt: { $exists: false } }, { expiresAt: { $gt: new Date() } }]
    });

    return res.status(200).json({
      success: true,
      data: {
        logisticsId: logistics._id,
        pickupQrConfirmed: logistics.pickupQrConfirmed || false,
        deliveryQrConfirmed: logistics.deliveryQrConfirmed || false,
        availableTokens: qrTokens.map(t => ({
          type: t.type,
          token: t.token,
          expiresAt: t.expiresAt
        }))
      }
    });
  } catch (err) {
    logger.error('Error getting QR tokens:', err);
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// QR HANDSHAKE WITH GPS VERIFICATION
// ─────────────────────────────────────────────────────────────────────────────

exports.processQrScan = async (req, res, next) => {
  try {
    const { token, gpsCoords } = req.body;
    const requestedStep = typeof req.body.step === 'string' ? req.body.step.toLowerCase() : null;
    let step = requestedStep;

    if (!token) {
      return res.status(400).json({ 
        success: false, 
        message: 'Validation failed',
        errors: [{ 
          message: 'token is required. Please provide the QR token.',
          hint: 'Generate QR tokens first using POST /api/v1/logistics/:id/generate-qr-tokens'
        }]
      });
    }

    const normalizedToken = qrChainSvc.normalizeToken(token);
    const qrTokenForStep = normalizedToken
      ? await QRToken.findOne({ token: normalizedToken }).select('type logistics')
      : null;

    if (qrTokenForStep?.type) {
      const inferredStep = qrTokenForStep.type.toLowerCase();
      if (step && step !== inferredStep) {
        logger.info('QR scan step mismatch detected', {
          requestedStep: step,
          inferredStep,
          logisticsId: req.params.id,
        });
        return res.status(400).json({
          success: false,
          message: 'Wrong QR token for this scan.',
          code: 'QR_TOKEN_WRONG_TYPE',
          errors: [{
            message: `The provided QR token is for ${qrTokenForStep.type}, but this scan requested ${step}.`,
            details: {
              requestedStep: step,
              inferredStep,
              logisticsId: req.params.id,
            },
          }],
        });
      }
      step = inferredStep;
    }

    if (qrTokenForStep && qrTokenForStep.logistics.toString() !== req.params.id) {
      return res.status(400).json({
        success: false,
        message: 'QR token belongs to a different logistics shipment.',
        code: 'QR_TOKEN_WRONG_LOGISTICS',
        errors: [{
          message: 'Use the QR token generated for this logistics shipment.',
          details: {
            expectedLogisticsId: req.params.id,
            actualLogisticsId: qrTokenForStep.logistics.toString(),
          },
        }],
      });
    }

    if (!step) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: [{
          message: 'step is required when the QR token cannot be found. Must be "pickup" or "delivery".'
        }]
      });
    }

    if (!['pickup', 'delivery'].includes(step)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Validation failed',
        errors: [{ message: 'step must be either "pickup" or "delivery".' }]
      });
    }

    const logistics = await Logistics.findById(req.params.id)
      .populate('order')
      .populate('seller buyer driver fleetOwner', 'fullName name phone location role logisticsProfile');

    if (!logistics) {
      return res.status(404).json({ 
        success: false, 
        message: 'Logistics record not found.',
        errors: [{ message: `No logistics record found with ID: ${req.params.id}` }]
      });
    }

    if (step === 'delivery' && !logistics.pickupQrConfirmed) {
      return res.status(409).json({
        success: false,
        message: 'Pickup must be confirmed before the delivery QR token can be scanned.',
        code: 'PICKUP_NOT_CONFIRMED',
        errors: [{
          message: 'Scan the seller PICKUP QR token first, then scan the DELIVERY token at drop-off.'
        }]
      });
    }

    if (step === 'pickup' && logistics.pickupQrConfirmed) {
      return res.status(400).json({
        success: false,
        message: 'Pickup already confirmed',
        errors: [{ 
          message: 'QR code for pickup has already been scanned.',
          scannedAt: logistics.pickupQrScannedAt
        }]
      });
    }

    if (step === 'delivery' && logistics.deliveryQrConfirmed) {
      return res.status(400).json({
        success: false,
        message: 'Delivery already confirmed',
        errors: [{ 
          message: 'QR code for delivery has already been scanned.',
          scannedAt: logistics.deliveryQrScannedAt
        }]
      });
    }

    const userId = req.user._id || req.user.id;
    const userRole = req.user.role;
    
    // For delivery, either driver or buyer can scan
    if (step === 'delivery') {
      const isBuyer = logistics.buyer._id.toString() === userId.toString();
      const isDriver = logistics.driver && logistics.driver._id.toString() === userId.toString();
      const isAdmin = userRole === 'admin';
      
      if (!isBuyer && !isDriver && !isAdmin) {
        return res.status(403).json({ 
          success: false, 
          message: 'Not authorized',
          errors: [{ 
            message: 'Only the buyer, assigned driver, or admin can scan delivery QR codes.',
            details: {
              userId: userId.toString(),
              buyerId: logistics.buyer._id.toString(),
              driverId: logistics.driver?._id?.toString(),
              role: userRole
            }
          }]
        });
      }
    } else {
      // For pickup, only driver or admin
      const isDriver = logistics.driver && logistics.driver._id.toString() === userId.toString();
      const isAdmin = userRole === 'admin';
      
      if (!isDriver && !isAdmin) {
        return res.status(403).json({ 
          success: false, 
          message: 'Not authorized',
          errors: [{ 
            message: 'Only the assigned driver or admin can scan pickup QR codes.',
            details: {
              userId: userId.toString(),
              driverId: logistics.driver?._id?.toString(),
              role: userRole
            }
          }]
        });
      }
    }

    // GPS VERIFICATION for delivery
    if (step === 'delivery') {
      if (!gpsCoords || !gpsCoords.lat || !gpsCoords.lng) {
        return res.status(400).json({
          success: false,
          message: 'GPS coordinates required for delivery confirmation',
          errors: [{ message: 'Please enable GPS on your device to confirm delivery.' }]
        });
      }

      const destinationLat = logistics.shippingAddress?.gpsLat;
      const destinationLng = logistics.shippingAddress?.gpsLng;
      
      if (destinationLat && destinationLng) {
        const distanceMeters = calculateDistance(
          gpsCoords.lat, gpsCoords.lng,
          destinationLat, destinationLng
        ) * 1000;
        
        if (distanceMeters > 50) {
          return res.status(400).json({
            success: false,
            message: 'Delivery GPS verification failed',
            errors: [{
              message: `You must be within 50 meters of the delivery location to confirm delivery. Current distance: ${distanceMeters.toFixed(0)} meters.`,
              currentDistanceMeters: distanceMeters,
              requiredRadiusMeters: 50
            }]
          });
        }
      }
    }

    let verificationResult;
    try {
      if (step === 'delivery') {
        const buyerFence = logistics.buyer?.location?.coordinates?.length === 2
          ? { lng: logistics.buyer.location.coordinates[0], lat: logistics.buyer.location.coordinates[1] }
          : { lat: logistics.shippingAddress?.gpsLat, lng: logistics.shippingAddress?.gpsLng };

        verificationResult = await qrChainSvc.consumeToken({
          token,
          type: 'DELIVERY',
          logisticsId: logistics._id,
          scannedBy: userId,
          gpsCoords,
          buyerFence,
        });
      } else {
        verificationResult = await qrChainSvc.consumeToken({
          token,
          type: 'PICKUP',
          logisticsId: logistics._id,
          scannedBy: userId,
          gpsCoords,
        });
      }
    } catch (qrError) {
      if (qrError.code?.startsWith?.('QR_TOKEN_')) {
        logger.warn('QR verification failed:', qrError);
      } else {
        logger.error('QR verification failed:', qrError);
      }

      const qrErrorResponses = {
        QR_TOKEN_NOT_FOUND: {
          status: 404,
          message: 'QR token was not found. Generate fresh QR tokens for this shipment and scan the pickup token.',
        },
        QR_TOKEN_WRONG_LOGISTICS: {
          status: 400,
          message: 'QR token belongs to a different logistics shipment.',
        },
        QR_TOKEN_WRONG_TYPE: {
          status: 400,
          message: `Wrong QR token for this scan. Use the ${step === 'pickup' ? 'PICKUP' : 'DELIVERY'} token.`,
        },
        QR_TOKEN_ALREADY_USED: {
          status: 409,
          message: 'QR token has already been used. Each QR code can only be used once.',
        },
        QR_TOKEN_EXPIRED: {
          status: 410,
          message: 'QR token has expired. Please generate new QR tokens.',
        },
        QR_TOKEN_CONSUME_RACE: {
          status: 409,
          message: 'QR token was already consumed by another scan. Refresh the trip and try again if needed.',
        },
      };
      const response = qrErrorResponses[qrError.code] || {
        status: 400,
        message: 'QR verification failed',
      };
      
      return res.status(response.status).json({
        success: false, 
        message: response.message,
        code: qrError.code,
        errors: [{ message: qrError.message, details: qrError.details }]
      });
    }

    if (step === 'pickup') {
      logistics.pickupQrConfirmed = true;
      logistics.pickupQrScannedAt = new Date();
      logistics.pickupQrScannedBy = userId;
    } else {
      logistics.deliveryQrConfirmed = true;
      logistics.deliveryQrScannedAt = new Date();
      logistics.deliveryQrScannedBy = userId;
    }

    if (!logistics.qrScans) {
      logistics.qrScans = [];
    }
    logistics.qrScans.push({
      step,
      token,
      scannedBy: userId,
      gpsCoords,
      timestamp: new Date()
    });

    if (step === 'pickup') {
      logistics.status = 'in_transit';
      logistics.pickupTime = new Date();
      await logistics.save();

      if (escrowService && escrowService.markInTransit) {
        try {
          await escrowService.markInTransit(logistics.order._id || logistics.order, userId, gpsCoords);
        } catch (escrowError) {
          logger.warn('Escrow update failed:', escrowError);
        }
      }

      await Order.findByIdAndUpdate(logistics.order, { 
        status: 'dispatched',
        dispatchedAt: new Date()
      });

      if (dispatchSvc && logistics.seller) {
        await dispatchSvc.dispatch({
          userIds: [logistics.seller._id || logistics.seller],
          channels: ['push', 'sms'],
          title: '📦 Pickup confirmed',
          body: `${logistics.cargoType || 'Cargo'} is now in transit to ${logistics.shippingAddress?.town || 'destination'}.`,
          data: { 
            shipmentId: logistics._id.toString(), 
            status: 'in_transit',
            timestamp: new Date().toISOString()
          },
        });
      }

    } else if (step === 'delivery') {
      logistics.status = 'delivered';
      logistics.actualDelivery = new Date();
      logistics.escrowReleaseDue = new Date(Date.now() + 72 * 60 * 60 * 1000);
      await logistics.save();

      if (escrowService && escrowService.markDelivered) {
        try {
          await escrowService.markDelivered(logistics.order._id || logistics.order, userId, gpsCoords);
        } catch (escrowError) {
          logger.warn('Escrow update failed:', escrowError);
        }
      }

      await Order.findByIdAndUpdate(logistics.order, { 
        status: 'delivered', 
        deliveredAt: new Date() 
      });

      // Deduct sinking fund
      if (logistics.driver && logistics.shippingCost) {
        await deductSinkingFund(logistics.driver, logistics.shippingCost * 0.7, logistics._id);
      }

      const recipients = [];
      if (logistics.seller) recipients.push(logistics.seller._id || logistics.seller);
      if (logistics.buyer) recipients.push(logistics.buyer._id || logistics.buyer);
      
      if (dispatchSvc && recipients.length > 0) {
        await dispatchSvc.dispatch({
          userIds: recipients,
          channels: ['push', 'sms'],
          title: '✅ Delivery confirmed',
          body: `${logistics.cargoType || 'Cargo'} has been delivered successfully. Payment will be released to seller.`,
          data: { 
            shipmentId: logistics._id.toString(), 
            status: 'delivered',
            deliveredAt: new Date().toISOString()
          },
        });
      }
    }

    return res.status(200).json({ 
      success: true, 
      message: `QR step "${step}" recorded successfully.`, 
      data: {
        logisticsId: logistics._id,
        status: logistics.status,
        step: step,
        qrConfirmed: step === 'pickup' ? logistics.pickupQrConfirmed : logistics.deliveryQrConfirmed,
        timestamp: new Date().toISOString(),
        gpsVerified: step === 'delivery' ? true : null,
      }
    });
  } catch (err) {
    logger.error('QR scan processing error:', err);
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ESCROW & DISPUTES
// ─────────────────────────────────────────────────────────────────────────────

exports.releaseEscrow = async (req, res, next) => {
  try {
    const { triggeredBy = 'auto' } = req.body;

    const logistics = await Logistics.findById(req.params.id);
    if (!logistics) {
      return res.status(404).json({ success: false, message: 'Logistics record not found.' });
    }

    if (logistics.status !== 'delivered') {
      return res.status(400).json({ success: false, message: 'Can only release escrow for delivered shipments.' });
    }

    if (logistics.escrow?.status === 'released') {
      return res.status(400).json({ success: false, message: 'Escrow already released.' });
    }

    if (!logistics.escrow) {
      logistics.escrow = {};
    }

    logistics.escrow.status = 'released';
    logistics.escrow.releasedAt = new Date();
    
    if (!logistics.step3_autoRelease) {
      logistics.step3_autoRelease = {};
    }
    logistics.step3_autoRelease.releasedAt = new Date();
    logistics.step3_autoRelease.triggeredBy = triggeredBy;

    await logistics.save();

    // Notify seller about payment release
    await dispatchSvc.dispatch({
      userIds: [logistics.seller],
      channels: ['push', 'sms'],
      title: '💰 Payment Released',
      body: `KES ${logistics.shippingCost || '0'} has been released to your wallet for shipment ${logistics.orderNumber}.`,
      data: { logisticsId: logistics._id.toString(), amount: logistics.shippingCost },
    });

    return res.status(200).json({ success: true, message: 'Escrow released.', data: logistics });
  } catch (err) {
    next(err);
  }
};

exports.openDispute = async (req, res, next) => {
  try {
    const logistics = await Logistics.findById(req.params.id);
    if (!logistics) {
      return res.status(404).json({ success: false, message: 'Logistics record not found.' });
    }

    logistics.status = 'disputed';
    
    if (!logistics.escrow) {
      logistics.escrow = {};
    }
    logistics.escrow.status = 'disputed';

    await logistics.save();

    // Notify admin about dispute
    const admins = await User.find({ role: 'admin' }).select('_id');
    await dispatchSvc.dispatch({
      userIds: admins.map(a => a._id),
      channels: ['push'],
      title: '⚠️ Dispute Opened',
      body: `Dispute opened for shipment ${logistics.orderNumber}. Please review.`,
      data: { logisticsId: logistics._id.toString() },
    });

    return res.status(200).json({ success: true, message: 'Dispute opened. Escrow frozen.', data: logistics });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// STATS
// ─────────────────────────────────────────────────────────────────────────────

exports.getDeliveryStats = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    let dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    const byStatus = await Logistics.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    const onTimeResult = await Logistics.aggregate([
      {
        $match: {
          status: 'delivered',
          actualDelivery: { $exists: true },
          estimatedDelivery: { $exists: true },
          ...dateFilter,
        },
      },
      {
        $project: {
          onTime: { $lte: ['$actualDelivery', '$estimatedDelivery'] },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          onTime: { $sum: { $cond: ['$onTime', 1, 0] } },
        },
      },
    ]);

    const totalDelivered = onTimeResult[0]?.total || 0;
    const onTimeCount = onTimeResult[0]?.onTime || 0;
    const onTimeRate = totalDelivered > 0 ? ((onTimeCount / totalDelivered) * 100).toFixed(1) : '0.0';

    const statusMap = {};
    byStatus.forEach(item => {
      statusMap[item._id] = item.count;
    });

    // Calculate average delivery distance
    const distanceStats = await Logistics.aggregate([
      { $match: { 'metadata.distanceKm': { $exists: true, $ne: null }, ...dateFilter } },
      {
        $group: {
          _id: null,
          avgDistanceKm: { $avg: '$metadata.distanceKm' },
          totalDistanceKm: { $sum: '$metadata.distanceKm' },
        },
      },
    ]);

    return res.status(200).json({
      success: true,
      data: {
        byStatus: statusMap,
        onTimeDeliveryRate: parseFloat(onTimeRate),
        totalDelivered,
        totalOnTime: onTimeCount,
        totalLate: totalDelivered - onTimeCount,
        averageDistanceKm: distanceStats[0]?.avgDistanceKm?.toFixed(2) || 0,
        totalDistanceKm: distanceStats[0]?.totalDistanceKm?.toFixed(2) || 0,
      },
    });
  } catch (err) {
    logger.error('Error getting delivery stats:', err);
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GROUP TRIP / SHARED LOGISTICS
// ─────────────────────────────────────────────────────────────────────────────

exports.createGroupTrip = async (req, res, next) => {
  try {
    const { 
      originLat, originLng, 
      destinationLat, destinationLng,
      maxCapacityKg,
      deadlineHours,
      cargoType,
      notes 
    } = req.body;

    const userId = req.user._id || req.user.id;

    if (!originLat || !originLng || !destinationLat || !destinationLng) {
      return res.status(400).json({ 
        success: false, 
        message: 'Origin and destination GPS coordinates are required.' 
      });
    }

    const distance = calculateDistance(originLat, originLng, destinationLat, destinationLng);
    const baseFare = calculateShippingCost(distance, 100, false);
    const eta = await getETA(originLat, originLng, destinationLat, destinationLng);
    const tripId = `GROUP-${Date.now().toString(36).toUpperCase()}`;

    const groupTrip = await GroupTrip.create({
      tripId,
      initiator: userId,
      origin: { lat: originLat, lng: originLng },
      destination: { lat: destinationLat, lng: destinationLng },
      distanceKm: distance,
      baseFare,
      maxCapacityKg: maxCapacityKg || 3000,
      currentCapacityKg: 0,
      participants: [{
        user: userId,
        weightKg: 0,
        share: 0,
        joinedAt: new Date(),
      }],
      deadline: new Date(Date.now() + (deadlineHours || 4) * 60 * 60 * 1000),
      cargoType: cargoType || 'Mixed cargo',
      status: 'open',
      notes,
      etaMinutes: eta?.durationMinutes,
    });

    // Notify nearby potential participants
    const nearbyUsers = await User.find({
      'location.coordinates': {
        $near: {
          $geometry: { type: 'Point', coordinates: [originLng, originLat] },
          $maxDistance: 10000, // 10km radius
        },
      },
      role: { $in: ['wholesaler', 'retailer', 'farmer'] },
    }).limit(20);

    for (const nearbyUser of nearbyUsers) {
      await dispatchSvc.dispatch({
        userIds: [nearbyUser._id],
        channels: ['push', 'sms'],
        title: '🚚 Group Trip Available!',
        body: `Join shared trip from your area to ${destinationLat},${destinationLng}. Save up to 60% on delivery costs.`,
        data: { groupTripId: groupTrip.tripId },
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Group trip created successfully',
      data: groupTrip,
    });
  } catch (err) {
    next(err);
  }
};

exports.joinGroupTrip = async (req, res, next) => {
  try {
    const { groupTripId, weightKg } = req.body;
    const userId = req.user._id || req.user.id;

    const groupTrip = await GroupTrip.findOne({ tripId: groupTripId, status: 'open' });
    if (!groupTrip) {
      return res.status(404).json({ success: false, message: 'Group trip not found or already closed.' });
    }

    if (new Date() > groupTrip.deadline) {
      groupTrip.status = 'expired';
      await groupTrip.save();
      return res.status(400).json({ success: false, message: 'Group trip deadline has passed.' });
    }

    const alreadyJoined = groupTrip.participants.find((participant) => (
      participant.user.toString() === userId.toString()
    ));
    if (alreadyJoined) {
      return res.status(409).json({
        success: false,
        message: 'You have already joined this group trip.',
      });
    }

    const newTotalWeight = groupTrip.currentCapacityKg + weightKg;
    if (newTotalWeight > groupTrip.maxCapacityKg) {
      return res.status(400).json({ 
        success: false, 
        message: `Not enough capacity. Available: ${groupTrip.maxCapacityKg - groupTrip.currentCapacityKg}kg` 
      });
    }

    const user = await User.findById(userId);
    const weightShare = weightKg / newTotalWeight;
    const costShare = groupTrip.baseFare * weightShare;

    groupTrip.participants.push({
      user: userId,
      weightKg,
      share: costShare,
      joinedAt: new Date(),
    });
    groupTrip.currentCapacityKg = newTotalWeight;

    // Update all participants' cost shares
    for (const participant of groupTrip.participants) {
      const participantWeightShare = groupTrip.currentCapacityKg > 0
        ? participant.weightKg / groupTrip.currentCapacityKg
        : 0;
      participant.share = Math.round(groupTrip.baseFare * participantWeightShare);
    }

    await groupTrip.save();

    // Check if capacity is reached
    if (groupTrip.currentCapacityKg >= groupTrip.maxCapacityKg * 0.8) {
      await dispatchSvc.dispatch({
        userIds: groupTrip.participants.map((p) => p.user),
        channels: ['push', 'sms'],
        title: '🎉 Group Trip Almost Ready!',
        body: `Your group trip is at ${Math.round((groupTrip.currentCapacityKg / groupTrip.maxCapacityKg) * 100)}% capacity. Dispatching soon.`,
        data: { groupTripId: groupTrip.tripId },
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Joined group trip successfully',
      data: {
        groupTripId: groupTrip.tripId,
        yourShare: costShare,
        totalParticipants: groupTrip.participants.length,
        fillPercentage: (groupTrip.currentCapacityKg / groupTrip.maxCapacityKg) * 100,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// BULK
// ─────────────────────────────────────────────────────────────────────────────

exports.bulkUpdateStatus = async (req, res, next) => {
  try {
    const { logisticsIds, status, notes } = req.body;

    if (!logisticsIds || !Array.isArray(logisticsIds) || logisticsIds.length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'logisticsIds array is required.' 
      });
    }

    if (!status) {
      return res.status(400).json({ 
        success: false, 
        message: 'status is required.' 
      });
    }

    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Only admins can perform bulk updates.' 
      });
    }

    const results = [];
    let succeeded = 0;

    for (const id of logisticsIds) {
      try {
        const logistics = await Logistics.findById(id);
        if (!logistics) {
          results.push({ id, success: false, error: 'Logistics record not found' });
          continue;
        }

        await logistics.updateStatus(status, { 
          notes, 
          updatedBy: req.user._id || req.user.id 
        });
        
        results.push({ id, success: true });
        succeeded++;
      } catch (error) {
        results.push({ id, success: false, error: error.message });
      }
    }

    return res.status(200).json({
      success: true,
      message: `Updated ${succeeded} of ${logisticsIds.length} records.`,
      data: {
        succeeded,
        failed: logisticsIds.length - succeeded,
        details: results,
      },
    });
  } catch (err) {
    logger.error('Bulk update error:', err);
    next(err);
  }
};
