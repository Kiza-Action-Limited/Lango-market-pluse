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
const GroupTripRoute = require('../models/GroupTripRoute.model');
const Payment = require('../models/Payment.model');
const QRToken = require('../models/QRToken.model');
const Escrow = require('../models/Escrow.model');
const Transaction = require('../models/Transaction.model');
const LogisticsLocation = require('../models/LogisticsLocation.model');
const SinkingFund = require('../services/logistics/sinkingfund.service');
const walletService = require('../services/payment/wallet.service');
const { uploadToCloudinary } = require('../config/cloudinary.config');
const { validationResult } = require('express-validator');
const dispatchSvc = require('../services/notification/dispatch.service');
const qrChainSvc = require('../services/order/qrChain.service');
const escrowService = require('../services/order/escrow.service');
const auditService = require('../services/audit.service');
const trustPolicy = require('../services/trustPolicy.service');
const routeOptimizer = require('../services/logistics/routeOptimizer.service');
const localGeocoder = require('../services/maps/localGeocoder.service');
const logger = require('../utils/logger');
const { hashToken } = require('../utils/hash');

// ─────────────────────────────────────────────────────────────────────────────
// GOOGLE MAPS & GPS HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

const ACTIVE_TRIP_STATUSES = [
  'pending',
  'driver_assigned',
  'en_route_to_pickup',
  'picked_up',
  'in_transit',
  'out_for_delivery',
];

const recordLogisticsLocation = async ({ logistics, logisticsId, orderId, driverId, gpsCoords, source, req }) => {
  if (!gpsCoords?.lat || !gpsCoords?.lng) return null;

  const lat = Number(gpsCoords.lat);
  const lng = Number(gpsCoords.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  try {
    return await LogisticsLocation.create({
      logistics: logistics?._id || logisticsId,
      order: orderId || logistics?.order?._id || logistics?.order,
      driver: driverId,
      lat,
      lng,
      point: { type: 'Point', coordinates: [lng, lat] },
      accuracy: gpsCoords.accuracy,
      speed: gpsCoords.speed,
      heading: gpsCoords.heading,
      source,
      requestId: req?.id,
    });
  } catch (error) {
    logger.warn('Failed to persist logistics location point', {
      logisticsId: logistics?._id || logisticsId,
      error: error.message,
    });
    return null;
  }
};

const KENYA_ROUTE_POINTS = {
  Nairobi: { lat: -1.2921, lng: 36.8219 },
  Nakuru: { lat: -0.3031, lng: 36.0800 },
  Eldoret: { lat: 0.5143, lng: 35.2698 },
  Kitale: { lat: 1.0157, lng: 35.0062 },
  Kapenguria: { lat: 1.2389, lng: 35.1119 },
  Lodwar: { lat: 3.1191, lng: 35.5966 },
  Kakuma: { lat: 3.7167, lng: 34.8667 },
  Lokichoggio: { lat: 4.2041, lng: 34.3539 },
  Kisumu: { lat: -0.0917, lng: 34.7680 },
  Garissa: { lat: -0.4536, lng: 39.6401 },
  Mombasa: { lat: -4.0435, lng: 39.6682 },
  Malindi: { lat: -3.2192, lng: 40.1169 },
  Busia: { lat: 0.4608, lng: 34.1115 },
};

const buildDefaultRoute = ({ routeId, routeCode, stops, cargoType }) => {
  const originName = stops[0];
  const destinationName = stops[stops.length - 1];
  return {
    routeId,
    routeCode,
    label: stops.join(' to '),
    originName,
    destinationName,
    origin: KENYA_ROUTE_POINTS[originName],
    destination: KENYA_ROUTE_POINTS[destinationName],
    stops,
    cargoType,
    isDefault: true,
    isActive: true,
  };
};

const DEFAULT_GROUP_TRIP_ROUTES = [
  buildDefaultRoute({ routeId: 'eldoret-kitale', stops: ['Eldoret', 'Kitale'], cargoType: 'Northern Kenya corridor cargo' }),
  buildDefaultRoute({ routeId: 'kitale-lodwar', stops: ['Kitale', 'Kapenguria', 'Lodwar'], cargoType: 'Northern Kenya corridor cargo' }),
  buildDefaultRoute({ routeId: 'lodwar-kakuma', stops: ['Lodwar', 'Kakuma'], cargoType: 'Northern Kenya corridor cargo' }),
  buildDefaultRoute({ routeId: 'kakuma-lodwar', stops: ['Kakuma', 'Lodwar'], cargoType: 'Northern Kenya corridor cargo' }),
  buildDefaultRoute({ routeId: 'kakuma-lokichoggio', stops: ['Kakuma', 'Lokichoggio'], cargoType: 'Northern Kenya corridor cargo' }),
  buildDefaultRoute({ routeId: 'lokichoggio-kakuma', stops: ['Lokichoggio', 'Kakuma'], cargoType: 'Northern Kenya corridor cargo' }),
  buildDefaultRoute({ routeId: 'lodwar-lokichoggio', stops: ['Lodwar', 'Kakuma', 'Lokichoggio'], cargoType: 'Northern Kenya corridor cargo' }),
  buildDefaultRoute({ routeId: 'lokichoggio-lodwar', stops: ['Lokichoggio', 'Kakuma', 'Lodwar'], cargoType: 'Northern Kenya corridor cargo' }),
  buildDefaultRoute({ routeId: 'gt-001-nairobi-nakuru-eldoret', routeCode: 'GT-001', stops: ['Nairobi', 'Nakuru', 'Eldoret'], cargoType: 'Shared truck load' }),
  buildDefaultRoute({ routeId: 'gt-002-nairobi-nakuru-kisumu', routeCode: 'GT-002', stops: ['Nairobi', 'Nakuru', 'Kisumu'], cargoType: 'Shared truck load' }),
  buildDefaultRoute({ routeId: 'gt-003-nairobi-garissa', routeCode: 'GT-003', stops: ['Nairobi', 'Garissa'], cargoType: 'Shared truck load' }),
  buildDefaultRoute({ routeId: 'gt-004-mombasa-malindi', routeCode: 'GT-004', stops: ['Mombasa', 'Malindi'], cargoType: 'Shared truck load' }),
  buildDefaultRoute({ routeId: 'gt-005-kisumu-busia', routeCode: 'GT-005', stops: ['Kisumu', 'Busia'], cargoType: 'Shared truck load' }),
  buildDefaultRoute({ routeId: 'gt-006-eldoret-kitale-lodwar', routeCode: 'GT-006', stops: ['Eldoret', 'Kitale', 'Lodwar'], cargoType: 'Shared truck load' }),
  buildDefaultRoute({ routeId: 'gt-007-lodwar-kakuma', routeCode: 'GT-007', stops: ['Lodwar', 'Kakuma'], cargoType: 'Shared truck load' }),
  buildDefaultRoute({ routeId: 'gt-008-kakuma-lokichoggio', routeCode: 'GT-008', stops: ['Kakuma', 'Lokichoggio'], cargoType: 'Shared truck load' }),
  buildDefaultRoute({ routeId: 'gt-009-nairobi-kitale-lodwar-kakuma', routeCode: 'GT-009', stops: ['Nairobi', 'Kitale', 'Lodwar', 'Kakuma'], cargoType: 'Shared truck load' }),
  buildDefaultRoute({ routeId: 'gt-010-nairobi-eldoret-lodwar-kakuma-lokichoggio', routeCode: 'GT-010', stops: ['Nairobi', 'Eldoret', 'Lodwar', 'Kakuma', 'Lokichoggio'], cargoType: 'Shared truck load' }),
];

const num = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const sameId = (left, right) => {
  if (!left || !right) return false;
  const leftValue = typeof left === 'object' ? left._id || left.id || left : left;
  const rightValue = typeof right === 'object' ? right._id || right.id || right : right;
  return String(leftValue) === String(rightValue);
};

const hasQrStep = (trip, step) => {
  const scans = Array.isArray(trip?.qrScans) ? trip.qrScans : [];
  return Boolean(
    scans.some((scan) => scan.step === step && scan.verified !== false) ||
    trip?.[`${step}QrConfirmed`] ||
    trip?.[`${step}QrScannedAt`]
  );
};

const getAddressLabel = (address = {}) => (
  address.label ||
  [address.town, address.county].filter(Boolean).join(', ') ||
  address.street ||
  ''
);

const buildRouteId = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 80);

const omitUndefinedFields = (value = {}) => Object.fromEntries(
  Object.entries(value).filter(([, fieldValue]) => fieldValue !== undefined)
);

const ensureDefaultGroupTripRoutes = async () => {
  const activeDefaultRouteIds = DEFAULT_GROUP_TRIP_ROUTES.map((route) => route.routeId);
  const operations = DEFAULT_GROUP_TRIP_ROUTES.map((route) => {
    const setFields = omitUndefinedFields({
      routeCode: route.routeCode,
      label: route.label,
      originName: route.originName,
      destinationName: route.destinationName,
      origin: route.origin,
      destination: route.destination,
      stops: route.stops,
      cargoType: route.cargoType,
      isDefault: true,
      isActive: true,
    });
    const update = {
      $setOnInsert: { routeId: route.routeId },
      $set: setFields,
    };

    if (!route.routeCode) {
      update.$unset = { routeCode: '' };
    }

    return {
      updateOne: {
        filter: { routeId: route.routeId },
        update,
        upsert: true,
      },
    };
  });

  try {
    if (operations.length) {
      await GroupTripRoute.bulkWrite(operations, { ordered: false });
      await GroupTripRoute.updateMany(
        {
          isDefault: true,
          routeId: { $nin: activeDefaultRouteIds },
        },
        { $set: { isActive: false } }
      );
    }
  } catch (error) {
    logger.warn('Default group trip route sync failed; continuing with available routes', {
      message: error.message,
      code: error.code,
      keyValue: error.keyValue,
    });
  }
};

const serializeGroupTripRoute = (route) => ({
  id: route._id,
  routeId: route.routeId,
  routeCode: route.routeCode,
  label: route.label,
  originName: route.originName,
  destinationName: route.destinationName,
  origin: route.origin,
  destination: route.destination,
  stops: route.stops || [],
  cargoType: route.cargoType,
  isDefault: Boolean(route.isDefault),
  isActive: Boolean(route.isActive),
  createdAt: route.createdAt,
  updatedAt: route.updatedAt,
});

const getCoordinatePair = (source = {}) => {
  const lat = Number(source.lat ?? source.gpsLat);
  const lng = Number(source.lng ?? source.gpsLng);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
};

const buildGoogleMapsUrl = (points = []) => {
  const validPoints = points.filter((point) => point?.lat && point?.lng);
  if (!validPoints.length) return null;
  if (validPoints.length === 1) {
    return `https://www.google.com/maps/search/?api=1&query=${validPoints[0].lat},${validPoints[0].lng}`;
  }
  const [origin, ...rest] = validPoints;
  const destination = rest[rest.length - 1];
  return `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}`;
};

const buildGoogleMapsEmbedUrl = (points = []) => {
  const validPoints = points.filter((point) => point?.lat && point?.lng);
  if (!validPoints.length) return null;
  const driverPoint = validPoints.find((point) => point.label === 'driver');
  const target = driverPoint || validPoints[validPoints.length - 1];
  return `https://maps.google.com/maps?q=${target.lat},${target.lng}&z=13&output=embed`;
};

const hoursBetween = (start, end) => {
  if (!start || !end) return null;
  const value = (new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60);
  return Number.isFinite(value) && value >= 0 ? value : null;
};

const getEscrowForTrip = (trip, escrowByOrder, escrowByLogistics) => {
  const orderId = trip?.order?._id || trip?.order;
  const logisticsId = trip?._id;
  return escrowByOrder.get(String(orderId || '')) || escrowByLogistics.get(String(logisticsId || '')) || null;
};

const buildPayoutSnapshot = (trip, escrow, userId) => {
  const isFleetOwner = sameId(trip?.fleetOwner, userId);
  const isDriver = sameId(trip?.driver, userId);
  const role = isFleetOwner ? 'fleet_owner' : isDriver ? 'driver' : 'available_driver';
  const completedPayout = escrow?.payouts?.find((payout) => (
    sameId(payout.recipient, userId) && ['driver', 'fleet_owner'].includes(payout.role)
  ));
  const settlementAmount = isFleetOwner
    ? num(trip?.settlement?.fleetOwnerPayout || escrow?.driverPayout)
    : num(trip?.settlement?.driverPayout || escrow?.driverPayout);
  const expectedAmount = settlementAmount || num(trip?.shippingCost);
  const released = completedPayout?.status === 'completed' || Boolean(trip?.settlement?.releasedAt);

  return {
    role,
    expectedAmount,
    status: completedPayout?.status || (released ? 'completed' : escrow?.status === 'DISPUTED' ? 'frozen' : 'pending'),
    released,
    releasedAt: completedPayout?.completedAt || trip?.settlement?.releasedAt || escrow?.releasedAt || null,
    reference: completedPayout?.mpesaTransactionId || completedPayout?._id || null,
  };
};

const serializeDashboardTrip = (trip, escrow, userId) => {
  const pickupConfirmed = hasQrStep(trip, 'pickup');
  const deliveryConfirmed = hasQrStep(trip, 'delivery');
  const payout = buildPayoutSnapshot(trip, escrow, userId);
  const pickupCoords = getCoordinatePair(trip.pickupAddress);
  const deliveryCoords = getCoordinatePair(trip.shippingAddress);
  const driverCoords = getCoordinatePair(trip.driver?.logisticsProfile?.currentLocation || trip.gpsTracking?.current);
  const routePoints = [pickupCoords, driverCoords, deliveryCoords].filter(Boolean);

  return {
    _id: trip._id,
    tripId: trip.tripId,
    bookingReference: trip.bookingReference,
    order: trip.order,
    orderNumber: trip.orderNumber || trip.order?.orderNumber,
    status: trip.status,
    carrier: trip.carrier,
    cargoType: trip.cargoType,
    weight: trip.weight,
    weightUnit: trip.weightUnit,
    pickupAddress: trip.pickupAddress,
    shippingAddress: trip.shippingAddress,
    route: {
      pickup: getAddressLabel(trip.pickupAddress),
      delivery: getAddressLabel(trip.shippingAddress),
      distanceKm: num(trip.routeInfo?.totalDistanceKm),
      etaMinutes: num(trip.routeInfo?.estimatedDurationMin),
      pickupCoords,
      deliveryCoords,
      driverCoords,
      routePath: routePoints,
      googleMapsUrl: buildGoogleMapsUrl([pickupCoords, deliveryCoords]),
      liveGoogleMapsUrl: buildGoogleMapsUrl(routePoints),
    },
    seller: trip.seller,
    buyer: trip.buyer,
    driver: trip.driver,
    fleetOwner: trip.fleetOwner,
    driverName: trip.driverName,
    driverPhone: trip.driverPhone,
    shippingCost: num(trip.shippingCost),
    escrowReleaseDue: trip.escrowReleaseDue || escrow?.autoReleaseAt || null,
    actualDelivery: trip.actualDelivery,
    estimatedDelivery: trip.estimatedDelivery,
    createdAt: trip.createdAt,
    updatedAt: trip.updatedAt,
    qr: {
      pickupConfirmed,
      deliveryConfirmed,
      pickupAt: trip.qrScans?.find((scan) => scan.step === 'pickup')?.scannedAt || trip.pickupQrScannedAt || null,
      deliveryAt: trip.qrScans?.find((scan) => scan.step === 'delivery')?.scannedAt || trip.deliveryQrScannedAt || null,
      nextStep: !pickupConfirmed ? 'pickup' : !deliveryConfirmed ? 'delivery' : 'complete',
    },
    escrow: escrow ? {
      _id: escrow._id,
      status: escrow.status,
      amount: num(escrow.amount),
      sellerPayout: num(escrow.sellerPayout),
      driverPayout: num(escrow.driverPayout),
      sinkingFundAmount: num(escrow.sinkingFundAmount),
      autoReleaseAt: escrow.autoReleaseAt,
      releasedAt: escrow.releasedAt,
      deliveredAt: escrow.deliveredAt,
    } : null,
    payout,
    timeline: (trip.trackingHistory || [])
      .slice(-6)
      .reverse()
      .map((event) => ({
        status: event.status,
        location: event.location,
        notes: event.notes,
        gpsCoords: event.gpsCoords,
        timestamp: event.timestamp,
      })),
    proofOfDelivery: {
      qrConfirmed: deliveryConfirmed,
      confirmedAt: trip.qrScans?.find((scan) => scan.step === 'delivery')?.scannedAt || trip.deliveryQrScannedAt || null,
      confirmedBy: trip.qrScans?.find((scan) => scan.step === 'delivery')?.scannedBy || trip.deliveryQrScannedBy || null,
      gpsVerified: Boolean(deliveryConfirmed && (
        trip.gpsTracking?.deliveryGeofence?.enteredAt ||
        trip.qrScans?.some((scan) => scan.step === 'delivery' && scan.gpsCoords?.lat && scan.gpsCoords?.lng)
      )),
    },
  };
};

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

const getVerifiedLogisticsProvider = async (providerId) => {
  if (!providerId) return null;
  const provider = await User.findOne({
    _id: providerId,
    role: 'logistics',
    $or: [
      { verificationStatus: { $in: ['verified', 'gold'] } },
      { 'logisticsProfile.verificationStatus': 'verified' },
    ],
  }).select('fullName name businessName phone email locationHub city verificationStatus logisticsProfile employer ownerAccount role');

  return provider || null;
};

const buildProviderAssignment = (provider) => {
  if (!provider?._id) return {};
  const driverMode = String(provider.logisticsProfile?.driverMode || '').toLowerCase();
  const fleetOwner = provider.employer || provider.ownerAccount || provider.logisticsProfile?.fleetOwner;
  const isFleetManaged = driverMode === 'hired_driver' || Boolean(fleetOwner);

  return {
    driver: provider._id,
    ...(isFleetManaged && fleetOwner ? { fleetOwner } : {}),
    driverName: provider.businessName || provider.fullName || provider.name || 'Logistics provider',
    driverPhone: provider.phone || '',
    carrier: isFleetManaged ? 'fleet_managed' : 'solo_owner_operator',
  };
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

const uploadLogisticsDocument = async (file, userId, documentType, documentNumber) => {
  if (!file?.buffer) return null;

  const result = await uploadToCloudinary(
    file.buffer,
    `logistics/${userId}/documents`,
    file.mimetype
  );

  return {
    documentType,
    documentNumber,
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
    url: result.secure_url,
    publicId: result.public_id,
    source: 'logistics_application',
    uploadedAt: new Date(),
  };
};

const normalizeStringList = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 12);
  }

  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12);
};

const summarizeGroupTrip = (trip, userId) => {
  const currentCapacityKg = Number(trip.currentCapacityKg || 0);
  const maxCapacityKg = Number(trip.maxCapacityKg || 1);
  const participants = Array.isArray(trip.participants) ? trip.participants : [];
  const userParticipant = participants.find((participant) => sameId(participant.user, userId));
  const paymentSummary = participants.reduce((summary, participant) => {
    const status = participant.paymentStatus || 'unpaid';
    const amount = Number(participant.paymentAmount || participant.share || 0);
    summary.totalDue += Number(participant.share || 0);
    if (status === 'paid') summary.paid += amount || Number(participant.share || 0);
    if (status === 'pending') summary.pending += amount || Number(participant.share || 0);
    if (status === 'unpaid') summary.unpaid += Number(participant.share || 0);
    summary.byStatus[status] = (summary.byStatus[status] || 0) + 1;
    return summary;
  }, {
    totalDue: 0,
    paid: 0,
    pending: 0,
    unpaid: 0,
    byStatus: {},
  });

  return {
    id: trip._id,
    tripId: trip.tripId,
    origin: trip.origin,
    destination: trip.destination,
    distanceKm: trip.distanceKm,
    baseFare: trip.baseFare,
    maxCapacityKg,
    currentCapacityKg,
    availableCapacityKg: Math.max(0, maxCapacityKg - currentCapacityKg),
    fillPercentage: Math.round((currentCapacityKg / maxCapacityKg) * 100),
    participantCount: participants.length,
    participants: participants.map((participant) => ({
      user: participant.user,
      weightKg: participant.weightKg,
      share: participant.share,
      paymentStatus: participant.paymentStatus || 'unpaid',
      paymentMethod: participant.paymentMethod || 'mpesa',
      paymentReference: participant.paymentReference || '',
      paymentPhone: participant.paymentPhone || '',
      paymentAmount: participant.paymentAmount || participant.share || 0,
      paidAt: participant.paidAt || null,
      paymentConfirmedBy: participant.paymentConfirmedBy || null,
      paymentNotes: participant.paymentNotes || '',
      joinedAt: participant.joinedAt,
    })),
    paymentSummary,
    initiator: trip.initiator,
    joined: Boolean(userParticipant),
    yourShare: userParticipant?.share || 0,
    yourWeightKg: userParticipant?.weightKg || 0,
    yourPaymentStatus: userParticipant?.paymentStatus || (userParticipant ? 'unpaid' : null),
    yourPaymentMethod: userParticipant?.paymentMethod || null,
    yourPaymentReference: userParticipant?.paymentReference || '',
    yourPaymentAmount: userParticipant?.paymentAmount || userParticipant?.share || 0,
    yourPaidAt: userParticipant?.paidAt || null,
    routeCode: trip.routeCode,
    routeLabel: trip.routeLabel,
    stops: trip.stops || [],
    deadline: trip.deadline,
    cargoType: trip.cargoType,
    status: trip.status,
    notes: trip.notes,
    etaMinutes: trip.etaMinutes,
    createdAt: trip.createdAt,
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
      businessName,
      baseHub,
      locationHub,
      operatingAddress,
      serviceAreas,
      vehicleType,
      fleetSize,
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
    const driverLicenseImage = files.driverLicenseImage?.[0];
    const vehicleLogbookImage = files.vehicleLogbookImage?.[0];
    const insuranceCertificateImage = files.insuranceCertificateImage?.[0];
    const kraPinCertificateImage = files.kraPinCertificateImage?.[0];

    if (!nationalIdImage || !businessPermitImage) {
      return res.status(400).json({
        success: false,
        message: 'National ID and vehicle/business permit documents are both required.',
      });
    }

    const uploadedDocs = [];
    const documentUploads = [
      ['national_id', nationalIdImage],
      ['business_permit', businessPermitImage],
      ['driver_license', driverLicenseImage],
      ['vehicle_logbook', vehicleLogbookImage],
      ['insurance_certificate', insuranceCertificateImage],
      ['kra_pin_certificate', kraPinCertificateImage],
    ];

    for (const [docType, file] of documentUploads) {
      if (!file) continue;
      const doc = await uploadLogisticsDocument(file, user._id, docType, documentNumber);
      if (doc) uploadedDocs.push(doc);
    }

    const latitude = toFiniteNumber(gpsLat);
    const longitude = toFiniteNumber(gpsLng);
    if (latitude === null || longitude === null) {
      return res.status(400).json({
        success: false,
        message: 'GPS hub location is required. Capture GPS before submitting.',
      });
    }

    const geocodedLocation = { lat: latitude, lng: longitude };
    const geoPoint = geocodedLocation
      ? { type: 'Point', coordinates: [longitude, latitude] }
      : null;
    const existingProfile = getPlainLogisticsProfile(user.logisticsProfile);
    const normalizedBaseHub = String(baseHub || locationHub || existingProfile.baseHub || user.locationHub || user.city || '').trim();
    const normalizedOperatingAddress = String(operatingAddress || user.address || '').trim();
    const normalizedServiceAreas = normalizeStringList(serviceAreas);
    const normalizedBusinessName = String(businessName || user.businessName || user.fullName || '').trim();

    user.role = 'logistics';
    user.businessType = 'logistics';
    if (normalizedBusinessName) user.businessName = normalizedBusinessName;
    user.locationHub = normalizedBaseHub;
    user.city = normalizedBaseHub || user.city;
    user.address = normalizedOperatingAddress || user.address;
    user.subscriptionTier = 'mizigo';
    user.logisticsProfile = {
      ...existingProfile,
      verificationStatus: 'pending',
      documentType,
      documentNumber,
      baseHub: normalizedBaseHub,
      locationHub: normalizedBaseHub,
      operatingAddress: normalizedOperatingAddress,
      serviceAreas: normalizedServiceAreas.length ? normalizedServiceAreas : existingProfile.serviceAreas || [],
      vehicleType: String(vehicleType || existingProfile.vehicleType || '').trim(),
      fleetSize: Math.max(1, Number(fleetSize || existingProfile.fleetSize || 1)),
      vehiclePlate: String(vehiclePlate).trim().toUpperCase(),
      cargoCapacityKg: Number(cargoCapacityKg),
      driverMode,
      fleetOwner: driverMode === 'hired_driver' && fleetOwnerId ? fleetOwnerId : undefined,
      documents: uploadedDocs.length ? uploadedDocs : (user.logisticsProfile?.documents || []),
      currentLocation: geocodedLocation || existingProfile.currentLocation,
      isOnline: true,
      applicationSubmittedAt: new Date(),
      reviewDueAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
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

    const isResubmission = existingProfile.verificationStatus === 'rejected';
    const noticeTitle = isResubmission ? 'Application Resubmitted' : 'Application Submitted';
    const noticeBody = isResubmission
      ? 'Your updated logistics application is back in the admin review queue.'
      : 'Your logistics application is now in the admin review queue.';

    res.status(200).json({
      success: true,
      message: `${noticeBody} Review is usually completed within 24 hours.`,
      data: {
        notice: {
          type: 'success',
          title: noticeTitle,
          body: `${noticeBody} Review is usually completed within 24 hours.`,
          autoDismissMs: 9000,
        },
        nextAction: {
          type: 'await_review',
          label: 'Wait for admin review',
          detail: 'You can monitor the decision from the logistics dashboard. Trip acceptance unlocks after approval.',
          href: '/logistics/dashboard',
        },
        verificationStatus: user.logisticsProfile.verificationStatus,
        applicationSubmittedAt: user.logisticsProfile.applicationSubmittedAt,
        reviewDueAt: user.logisticsProfile.reviewDueAt,
        reviewSlaHours: 24,
        driverMode: user.logisticsProfile.driverMode,
        businessName: user.businessName,
        baseHub: user.logisticsProfile.baseHub,
        locationHub: user.logisticsProfile.locationHub,
        operatingAddress: user.logisticsProfile.operatingAddress,
        serviceAreas: user.logisticsProfile.serviceAreas || [],
        vehicleType: user.logisticsProfile.vehicleType,
        fleetSize: user.logisticsProfile.fleetSize,
        vehiclePlate: user.logisticsProfile.vehiclePlate,
        documents: user.logisticsProfile.documents || [],
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
        reviewSlaHours: 24,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CREATE LOGISTICS WITH GPS & DRIVER MATCHING
// ─────────────────────────────────────────────────────────────────────────────

exports.getLogisticsDashboard = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const role = String(req.user.role || '').toLowerCase();
    const userPhone = req.user.phone;
    const numericLimit = Math.min(150, Math.max(20, Number(req.query.limit) || 80));

    const user = await User.findById(userId).select(
      'role businessType logisticsProfile subscriptionTier name fullName businessName phone'
    ).lean();

    const baseQuery = role === 'admin'
      ? {}
      : {
        $or: [
          { driver: userId },
          { fleetOwner: userId },
          ...(userPhone ? [{ driverPhone: userPhone }] : []),
          { status: 'pending', driver: { $exists: false } },
          { status: 'pending', driver: null },
        ],
      };

    const trips = await Logistics.find(baseQuery)
      .populate('order', 'orderNumber total status paymentStatus paidAt deliveredAt createdAt')
      .populate('seller', 'name fullName businessName phone')
      .populate('buyer', 'name fullName businessName phone')
      .populate('driver', 'name fullName phone logisticsProfile.currentLocation')
      .populate('fleetOwner', 'name fullName businessName phone')
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(numericLimit)
      .lean({ virtuals: true });

    const orderIds = trips.map((trip) => trip.order?._id || trip.order).filter(Boolean);
    const logisticsIds = trips.map((trip) => trip._id).filter(Boolean);

    const [escrows, walletBalance, walletTransactions, sinkingFund] = await Promise.all([
      Escrow.find({
        $or: [
          { order: { $in: orderIds } },
          { logistics: { $in: logisticsIds } },
          { 'payouts.recipient': userId },
        ],
      }).lean(),
      walletService.getBalance(userId),
      Transaction.find({
        user: userId,
        type: { $in: ['payout', 'escrow_release', 'withdrawal', 'sinking_fund', 'refund'] },
      })
        .sort({ createdAt: -1 })
        .limit(12)
        .lean(),
      SinkingFund.getOrCreateFund(userId).catch(() => null),
    ]);

    const escrowByOrder = new Map(escrows.filter((escrow) => escrow.order).map((escrow) => [String(escrow.order), escrow]));
    const escrowByLogistics = new Map(escrows.filter((escrow) => escrow.logistics).map((escrow) => [String(escrow.logistics), escrow]));
    const dashboardTrips = trips.map((trip) => serializeDashboardTrip(
      trip,
      getEscrowForTrip(trip, escrowByOrder, escrowByLogistics),
      userId
    ));

    const assignedTrips = dashboardTrips.filter((trip) => (
      sameId(trip.driver, userId) || sameId(trip.fleetOwner, userId) || Boolean(userPhone && trip.driverPhone === userPhone)
    ));
    const activeTrips = dashboardTrips.filter((trip) => ACTIVE_TRIP_STATUSES.includes(trip.status));
    const qrQueue = dashboardTrips.filter((trip) => (
      sameId(trip.driver, userId) &&
      ['driver_assigned', 'en_route_to_pickup', 'picked_up', 'in_transit', 'out_for_delivery'].includes(trip.status) &&
      trip.qr.nextStep !== 'complete'
    ));
    const releaseQueue = dashboardTrips.filter((trip) => (
      trip.status === 'delivered' &&
      trip.escrow &&
      !['RELEASED', 'REFUNDED'].includes(trip.escrow.status)
    ));
    const payoutRows = dashboardTrips
      .filter((trip) => trip.payout.role !== 'available_driver')
      .map((trip) => ({
        logisticsId: trip._id,
        orderNumber: trip.orderNumber,
        route: trip.route,
        status: trip.payout.status,
        expectedAmount: trip.payout.expectedAmount,
        releasedAt: trip.payout.releasedAt,
        escrowStatus: trip.escrow?.status || 'AWAITING_PAYMENT',
        cargoType: trip.cargoType,
      }));
    const assignmentAlerts = dashboardTrips
      .filter((trip) => trip.status === 'pending' && !trip.driver)
      .map((trip) => ({
        logisticsId: trip._id,
        orderNumber: trip.orderNumber,
        seller: {
          id: trip.seller?._id || trip.seller,
          name: trip.seller?.businessName || trip.seller?.fullName || trip.seller?.name || 'Seller',
          phone: trip.seller?.phone || null,
        },
        cargoType: trip.cargoType || 'Cargo',
        weight: trip.weight,
        weightUnit: trip.weightUnit,
        route: trip.route,
        pickupAddress: trip.pickupAddress,
        shippingAddress: trip.shippingAddress,
        shippingCost: trip.shippingCost,
        createdAt: trip.createdAt,
      }))
      .slice(0, 12);
    const routeZonesMap = dashboardTrips.reduce((acc, trip) => {
      const label = trip.route?.delivery || trip.route?.pickup || 'Unmapped route';
      const current = acc.get(label) || {
        label,
        count: 0,
        active: 0,
        delivered: 0,
        totalDistanceKm: 0,
      };
      current.count += 1;
      if (ACTIVE_TRIP_STATUSES.includes(trip.status)) current.active += 1;
      if (trip.status === 'delivered') current.delivered += 1;
      current.totalDistanceKm += num(trip.route?.distanceKm);
      acc.set(label, current);
      return acc;
    }, new Map());
    const routeZones = Array.from(routeZonesMap.values())
      .sort((left, right) => right.count - left.count)
      .slice(0, 8);
    const proofQueue = dashboardTrips
      .filter((trip) => ['delivered', 'auto_released'].includes(trip.status) || trip.proofOfDelivery?.qrConfirmed)
      .map((trip) => ({
        logisticsId: trip._id,
        orderNumber: trip.orderNumber,
        cargoType: trip.cargoType,
        deliveredAt: trip.actualDelivery || trip.proofOfDelivery?.confirmedAt,
        proofOfDelivery: trip.proofOfDelivery,
        escrowStatus: trip.escrow?.status || 'AWAITING_PAYMENT',
      }))
      .slice(0, 8);
    const operationalTimeline = dashboardTrips
      .flatMap((trip) => (trip.timeline || []).map((event) => ({
        ...event,
        logisticsId: trip._id,
        orderNumber: trip.orderNumber,
        cargoType: trip.cargoType,
      })))
      .filter((event) => event.timestamp)
      .sort((left, right) => new Date(right.timestamp) - new Date(left.timestamp))
      .slice(0, 10);

    const summary = dashboardTrips.reduce((acc, trip) => {
      const assignedToUser = trip.payout.role !== 'available_driver';
      if (assignedToUser) acc.assignedTrips += 1;
      if (ACTIVE_TRIP_STATUSES.includes(trip.status)) acc.activeTrips += 1;
      if (trip.status === 'pending') acc.availableTrips += 1;
      if (['driver_assigned', 'en_route_to_pickup'].includes(trip.status)) acc.pickupPending += 1;
      if (['picked_up', 'in_transit', 'out_for_delivery'].includes(trip.status)) acc.deliveryPending += 1;
      if (trip.status === 'delivered') acc.deliveredTrips += 1;
      if (trip.status === 'disputed' || trip.escrow?.status === 'DISPUTED') acc.disputedTrips += 1;
      acc.totalEscrow += num(trip.escrow?.amount);
      acc.sinkingFundAccrued += num(trip.escrow?.sinkingFundAmount);
      if (assignedToUser && trip.payout.released) acc.releasedPayout += num(trip.payout.expectedAmount);
      if (assignedToUser && !trip.payout.released && trip.payout.status !== 'frozen') acc.pendingPayout += num(trip.payout.expectedAmount);
      if (trip.escrow?.status === 'RELEASED') acc.releasedTrips += 1;
      if (trip.escrow && trip.escrow.status !== 'RELEASED') acc.releasePending += 1;
      acc.totalDistanceKm += num(trip.route?.distanceKm);
      if (trip.proofOfDelivery?.qrConfirmed) acc.proofOfDeliveryCount += 1;
      if (trip.proofOfDelivery?.gpsVerified) acc.gpsVerifiedDeliveries += 1;
      const pickupHours = hoursBetween(trip.createdAt, trip.qr?.pickupAt);
      const deliveryHours = hoursBetween(trip.qr?.pickupAt || trip.createdAt, trip.actualDelivery || trip.qr?.deliveryAt);
      if (pickupHours !== null) {
        acc.pickupHoursTotal += pickupHours;
        acc.pickupHoursCount += 1;
      }
      if (deliveryHours !== null) {
        acc.deliveryHoursTotal += deliveryHours;
        acc.deliveryHoursCount += 1;
      }
      return acc;
    }, {
      assignedTrips: 0,
      activeTrips: 0,
      availableTrips: 0,
      pickupPending: 0,
      deliveryPending: 0,
      deliveredTrips: 0,
      releasedTrips: 0,
      releasePending: 0,
      disputedTrips: 0,
      totalEscrow: 0,
      pendingPayout: 0,
      releasedPayout: 0,
      sinkingFundAccrued: 0,
      totalDistanceKm: 0,
      proofOfDeliveryCount: 0,
      gpsVerifiedDeliveries: 0,
      pickupHoursTotal: 0,
      pickupHoursCount: 0,
      deliveryHoursTotal: 0,
      deliveryHoursCount: 0,
    });
    summary.avgPickupHours = summary.pickupHoursCount
      ? Math.round((summary.pickupHoursTotal / summary.pickupHoursCount) * 10) / 10
      : null;
    summary.avgDeliveryHours = summary.deliveryHoursCount
      ? Math.round((summary.deliveryHoursTotal / summary.deliveryHoursCount) * 10) / 10
      : null;
    summary.totalDistanceKm = Math.round(summary.totalDistanceKm * 10) / 10;
    summary.proofOfDeliveryRate = summary.deliveredTrips
      ? Math.round((summary.proofOfDeliveryCount / summary.deliveredTrips) * 100)
      : 0;
    summary.gpsVerificationRate = summary.deliveredTrips
      ? Math.round((summary.gpsVerifiedDeliveries / summary.deliveredTrips) * 100)
      : 0;
    summary.sellerAssignmentRequests = assignmentAlerts.length;
    delete summary.pickupHoursTotal;
    delete summary.pickupHoursCount;
    delete summary.deliveryHoursTotal;
    delete summary.deliveryHoursCount;

    const nextActions = [];
    const currentVerificationStatus = user?.logisticsProfile?.verificationStatus || 'unverified';
    if (currentVerificationStatus !== 'verified') {
      const isPendingReview = currentVerificationStatus === 'pending';
      const isRejectedReview = currentVerificationStatus === 'rejected';
      nextActions.push({
        type: 'verification',
        label: isPendingReview
          ? 'Application under review'
          : isRejectedReview
            ? 'Update and resubmit verification'
            : 'Complete logistics verification',
        detail: isPendingReview
          ? 'Admin is reviewing your logistics documents. Trip acceptance unlocks after approval.'
          : isRejectedReview
            ? (user?.logisticsProfile?.reviewNotes || 'Admin requested changes before approval.')
            : 'Upload documents and wait for admin approval before accepting trips.',
        href: '/logistics/apply',
      });
    } else if (summary.availableTrips > 0) {
      nextActions.push({
        type: 'dispatch',
        label: 'Accept available trips',
        detail: `${summary.availableTrips} pending shipment${summary.availableTrips === 1 ? '' : 's'} can be accepted.`,
      });
    }
    if (qrQueue.length > 0) {
      nextActions.push({
        type: 'qr',
        label: 'Complete QR handoff',
        detail: `${qrQueue.length} trip${qrQueue.length === 1 ? '' : 's'} need pickup or delivery scan.`,
      });
    }
    if (releaseQueue.length > 0) {
      nextActions.push({
        type: 'escrow',
        label: 'Monitor escrow release',
        detail: `${releaseQueue.length} delivered trip${releaseQueue.length === 1 ? '' : 's'} are inside the release window.`,
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        application: {
          role: user?.role || role,
          businessType: user?.businessType,
          subscriptionTier: user?.subscriptionTier,
          logisticsProfile: user?.logisticsProfile || { verificationStatus: 'unverified' },
        },
        summary,
        wallet: {
          balance: walletBalance,
          transactions: walletTransactions,
          sinkingFund: sinkingFund ? {
            balance: num(sinkingFund.balance),
            totalContributed: num(sinkingFund.totalContributed),
            totalWithdrawn: num(sinkingFund.totalWithdrawn),
          } : null,
        },
        trips: dashboardTrips,
        assignedTrips,
        activeTrips,
        qrQueue,
        releaseQueue,
        payoutRows,
        assignmentAlerts,
        routeZones,
        proofQueue,
        operationalTimeline,
        nextActions,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.getOperationsOverview = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const role = String(req.user.role || '').toLowerCase();
    const userPhone = req.user.phone;
    const isAdmin = role === 'admin';
    const visibilityQuery = isAdmin
      ? {}
      : {
        $or: [
          { driver: userId },
          { fleetOwner: userId },
          ...(userPhone ? [{ driverPhone: userPhone }] : []),
          { status: 'pending', driver: { $exists: false } },
          { status: 'pending', driver: null },
        ],
      };
    const activeStatuses = [
      'pending',
      'driver_assigned',
      'en_route_to_pickup',
      'picked_up',
      'in_transit',
      'out_for_delivery',
    ];

    const [statusRows, liveGpsCount, deliveryProofCount, escrowRows] = await Promise.all([
      Logistics.aggregate([
        { $match: visibilityQuery },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Logistics.countDocuments({
        ...visibilityQuery,
        'gpsTracking.current.lat': { $ne: null },
        'gpsTracking.current.lng': { $ne: null },
      }),
      Logistics.countDocuments({
        ...visibilityQuery,
        qrScans: { $elemMatch: { step: 'delivery', verified: { $ne: false } } },
      }),
      Escrow.aggregate([
        { $match: { status: { $in: ['HELD', 'IN_TRANSIT', 'DELIVERED', 'DISPUTED'] } } },
        { $group: { _id: '$status', count: { $sum: 1 }, amount: { $sum: '$amount' } } },
      ]),
    ]);

    const byStatus = statusRows.reduce((acc, row) => {
      acc[row._id || 'unknown'] = row.count;
      return acc;
    }, {});
    const escrowByStatus = escrowRows.reduce((acc, row) => {
      acc[row._id || 'unknown'] = {
        count: row.count,
        amount: row.amount,
      };
      return acc;
    }, {});
    const activeTrips = activeStatuses.reduce((total, status) => total + Number(byStatus[status] || 0), 0);
    const escrowHeldAmount = escrowRows.reduce((total, row) => total + Number(row.amount || 0), 0);

    return res.status(200).json({
      success: true,
      data: {
        title: isAdmin ? 'Admin Logistics Command Center' : 'Logistics Command Center',
        subtitle: 'Manage routing, QR proof, escrow readiness, and driver operations with verified backend data.',
        generatedAt: new Date(),
        metrics: {
          totalTrips: Object.values(byStatus).reduce((total, value) => total + Number(value || 0), 0),
          activeTrips,
          liveGpsCount,
          deliveryProofCount,
          escrowHeldAmount,
        },
        byStatus,
        escrowByStatus,
        actions: [
          { key: 'routes', label: 'Route planning', status: 'available' },
          { key: 'qr', label: 'QR delivery proof', status: 'available' },
          { key: 'escrow', label: 'Escrow controls', status: 'available' },
          { key: 'bulk', label: 'Bulk status updates', status: isAdmin ? 'available' : 'admin_only' },
        ],
      },
    });
  } catch (err) {
    next(err);
  }
};

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

exports.getVerifiedProviders = async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const hasReferencePoint = Number.isFinite(lat) && Number.isFinite(lng);

    const providers = await User.find({
      role: 'logistics',
      $or: [
        { 'logisticsProfile.verificationStatus': 'verified' },
        { verificationStatus: { $in: ['verified', 'gold'] } },
      ],
    })
      .select('fullName name businessName phone email locationHub city address logisticsProfile subscriptionTier')
      .sort({
        'logisticsProfile.isOnline': -1,
        'logisticsProfile.verifiedAt': -1,
        createdAt: -1,
      })
      .limit(limit)
      .lean();

    const normalizedProviders = providers.map((provider) => {
      const currentLocation = provider.logisticsProfile?.currentLocation || {};
      const providerLat = Number(currentLocation.lat);
      const providerLng = Number(currentLocation.lng);
      const hasProviderPoint = Number.isFinite(providerLat) && Number.isFinite(providerLng);
      const providerVerificationStatus = provider.logisticsProfile?.verificationStatus === 'verified' || ['verified', 'gold'].includes(provider.verificationStatus)
        ? 'verified'
        : provider.logisticsProfile?.verificationStatus || provider.verificationStatus || 'unverified';
      const distanceKm = hasReferencePoint && hasProviderPoint
        ? Number(calculateDistance(lat, lng, providerLat, providerLng).toFixed(1))
        : null;

      return {
        id: provider._id,
        _id: provider._id,
        name: provider.businessName || provider.fullName || provider.name || 'Verified logistics provider',
        phone: provider.phone || '',
        email: provider.email || '',
        hub: provider.logisticsProfile?.baseHub || provider.logisticsProfile?.locationHub || provider.locationHub || provider.city || provider.address || 'Hub not set',
        operatingAddress: provider.logisticsProfile?.operatingAddress || provider.address || '',
        serviceAreas: provider.logisticsProfile?.serviceAreas || [],
        verificationStatus: providerVerificationStatus,
        isOnline: Boolean(provider.logisticsProfile?.isOnline),
        vehiclePlate: provider.logisticsProfile?.vehiclePlate || '',
        cargoCapacityKg: provider.logisticsProfile?.cargoCapacityKg || 0,
        driverMode: provider.logisticsProfile?.driverMode || '',
        vehicleType: provider.logisticsProfile?.vehicleType || '',
        fleetSize: provider.logisticsProfile?.fleetSize || 1,
        currentLocation: hasProviderPoint
          ? {
              lat: providerLat,
              lng: providerLng,
              updatedAt: currentLocation.updatedAt,
            }
          : null,
        distanceKm,
        subscriptionTier: provider.subscriptionTier || null,
      };
    }).sort((a, b) => {
      if (a.distanceKm === null && b.distanceKm !== null) return 1;
      if (a.distanceKm !== null && b.distanceKm === null) return -1;
      if (a.distanceKm !== null && b.distanceKm !== null) return a.distanceKm - b.distanceKm;
      return Number(b.isOnline) - Number(a.isOnline);
    });

    return res.status(200).json({
      success: true,
      data: {
        providers: normalizedProviders,
        total: normalizedProviders.length,
      },
      providers: normalizedProviders,
    });
  } catch (err) {
    next(err);
  }
};

const serializeBuyerLogisticsPreference = (user) => {
  const preference = user?.buyerLogisticsPreference || {};
  const provider = preference.selectedProvider;
  const providerObject = provider && typeof provider === 'object' ? provider : null;
  const snapshot = preference.selectedProviderSnapshot || {};
  const profile = providerObject?.logisticsProfile || {};

  return {
    active: Boolean(preference.active && (providerObject?._id || provider)),
    selectedProviderId: providerObject?._id || provider || null,
    selectedProvider: providerObject ? {
      id: providerObject._id,
      _id: providerObject._id,
      name: providerObject.businessName || providerObject.fullName || providerObject.name || snapshot.name || 'Verified logistics provider',
      phone: providerObject.phone || snapshot.phone || '',
      email: providerObject.email || snapshot.email || '',
      hub: profile.baseHub || profile.locationHub || providerObject.locationHub || providerObject.city || snapshot.hub || '',
      vehiclePlate: profile.vehiclePlate || snapshot.vehiclePlate || '',
      vehicleType: profile.vehicleType || snapshot.vehicleType || '',
      cargoCapacityKg: profile.cargoCapacityKg || snapshot.cargoCapacityKg || 0,
      verificationStatus: profile.verificationStatus || providerObject.verificationStatus || snapshot.verificationStatus || 'verified',
    } : null,
    selectedProviderSnapshot: snapshot,
    deliveryHub: preference.deliveryHub || '',
    notes: preference.notes || '',
    updatedAt: preference.updatedAt || null,
  };
};

exports.getBuyerLogisticsPreference = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id || req.user.id)
      .populate('buyerLogisticsPreference.selectedProvider', 'fullName name businessName phone email locationHub city logisticsProfile');

    return res.status(200).json({
      success: true,
      data: serializeBuyerLogisticsPreference(user),
    });
  } catch (err) {
    next(err);
  }
};

exports.updateBuyerLogisticsPreference = async (req, res, next) => {
  try {
    const { active = true, logisticsProviderId, deliveryHub = '', notes = '' } = req.body;
    const userId = req.user._id || req.user.id;

    if (!active) {
      const user = await User.findByIdAndUpdate(
        userId,
        {
          $set: {
            'buyerLogisticsPreference.active': false,
            'buyerLogisticsPreference.selectedProvider': null,
            'buyerLogisticsPreference.selectedProviderSnapshot': {},
            'buyerLogisticsPreference.updatedAt': new Date(),
          },
        },
        { new: true }
      ).populate('buyerLogisticsPreference.selectedProvider', 'fullName name businessName phone email locationHub city logisticsProfile');

      return res.status(200).json({
        success: true,
        message: 'Buyer logistics preference cleared.',
        data: serializeBuyerLogisticsPreference(user),
      });
    }

    const provider = await getVerifiedLogisticsProvider(logisticsProviderId);
    if (!provider) {
      return res.status(404).json({
        success: false,
        message: 'Selected logistics company is not available or verified.',
      });
    }

    const snapshot = {
      name: provider.businessName || provider.fullName || provider.name || 'Verified logistics provider',
      phone: provider.phone || '',
      email: provider.email || '',
      hub: provider.logisticsProfile?.baseHub || provider.logisticsProfile?.locationHub || provider.locationHub || provider.city || '',
      vehiclePlate: provider.logisticsProfile?.vehiclePlate || '',
      vehicleType: provider.logisticsProfile?.vehicleType || '',
      cargoCapacityKg: provider.logisticsProfile?.cargoCapacityKg || 0,
      verificationStatus: provider.logisticsProfile?.verificationStatus || provider.verificationStatus || 'verified',
    };

    const user = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          'buyerLogisticsPreference.active': true,
          'buyerLogisticsPreference.selectedProvider': provider._id,
          'buyerLogisticsPreference.selectedProviderSnapshot': snapshot,
          'buyerLogisticsPreference.deliveryHub': String(deliveryHub || '').trim().slice(0, 120),
          'buyerLogisticsPreference.notes': String(notes || '').trim().slice(0, 300),
          'buyerLogisticsPreference.updatedAt': new Date(),
        },
      },
      { new: true }
    ).populate('buyerLogisticsPreference.selectedProvider', 'fullName name businessName phone email locationHub city logisticsProfile');

    return res.status(200).json({
      success: true,
      message: 'Verified logistics company saved for seller requests.',
      data: serializeBuyerLogisticsPreference(user),
    });
  } catch (err) {
    next(err);
  }
};

exports.getSellerBuyerLogisticsRequests = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const role = String(req.user.role || '').toLowerCase();
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 25, 1), 100);
    const query = {
      'logisticsPreference.selectionSource': 'buyer',
      'logisticsPreference.requestedProvider': { $exists: true, $ne: null },
    };

    if (role !== 'admin') {
      query.seller = userId;
    }

    const orders = await Order.find(query)
      .populate('buyer', 'fullName name businessName phone email')
      .populate('seller', 'fullName name businessName phone email')
      .populate('product', 'name images sku trackingSku')
      .populate('logisticsPreference.requestedProvider', 'fullName name businessName phone email locationHub city logisticsProfile')
      .sort('-createdAt')
      .limit(limit)
      .lean();

    const logisticsRecords = await Logistics.find({ order: { $in: orders.map((order) => order._id) } })
      .select('order status trackingNumber tripId bookingReference driverName driverPhone carrier estimatedDelivery metadata shippingAddress pickupAddress')
      .lean();
    const logisticsByOrder = new Map(logisticsRecords.map((record) => [String(record.order), record]));

    const requests = orders.map((order) => {
      const provider = order.logisticsPreference?.requestedProvider || {};
      const profile = provider.logisticsProfile || {};
      const logistics = logisticsByOrder.get(String(order._id)) || null;
      const destination = order.deliveryAddress || logistics?.shippingAddress || {};

      return {
        id: String(order._id),
        orderId: String(order._id),
        orderNumber: order.orderNumber || `ORD-${String(order._id).slice(-8).toUpperCase()}`,
        createdAt: order.createdAt,
        status: order.status,
        paymentStatus: order.paymentStatus || (order.paidAt ? 'paid' : 'pending'),
        buyer: {
          id: order.buyer?._id || order.buyer,
          name: order.buyer?.businessName || order.buyer?.fullName || order.buyer?.name || 'Buyer',
          phone: order.buyer?.phone || '',
          email: order.buyer?.email || '',
        },
        seller: {
          id: order.seller?._id || order.seller,
          name: order.seller?.businessName || order.seller?.fullName || order.seller?.name || 'Seller',
          phone: order.seller?.phone || '',
        },
        product: {
          id: order.product?._id || order.product,
          name: order.product?.name || 'Order item',
          image: order.product?.images?.[0]?.url || order.product?.images?.[0] || '',
        },
        quantity: order.quantity,
        totalAmount: order.totalAmount,
        logisticsProvider: {
          id: provider._id || order.logisticsPreference?.requestedProvider,
          name: order.logisticsPreference?.providerName || provider.businessName || provider.fullName || provider.name || 'Verified logistics company',
          phone: order.logisticsPreference?.providerPhone || provider.phone || '',
          email: provider.email || '',
          hub: order.logisticsPreference?.providerHub || profile.baseHub || profile.locationHub || provider.locationHub || provider.city || '',
          vehiclePlate: profile.vehiclePlate || '',
          vehicleType: profile.vehicleType || '',
          cargoCapacityKg: profile.cargoCapacityKg || 0,
        },
        destination: {
          label: destination.label || order.deliveryAddressText || '',
          town: destination.town || destination.city || '',
          county: destination.county || destination.state || '',
          country: destination.country || 'Kenya',
        },
        note: order.logisticsPreference?.notes || '',
        message: `Buyer requests this order use ${order.logisticsPreference?.providerName || provider.businessName || provider.fullName || provider.name || 'the selected logistics company'} for transport to ${destination.town || destination.city || destination.label || 'their location'}.`,
        logistics,
        shipmentCreated: Boolean(logistics?._id),
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        requests,
        total: requests.length,
      },
      requests,
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
      .populate('driver', 'fullName name phone logisticsProfile.currentLocation')
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
    if (!trustPolicy.isVerifiedLogisticsUser(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Only verified logistics drivers can update trusted trip GPS.',
        code: 'LOGISTICS_VERIFICATION_REQUIRED',
      });
    }

    const result = await routeOptimizer.updateLocation(
      req.params.id,
      req.user._id || req.user.id,
      req.body
    );

    await recordLogisticsLocation({
      logisticsId: req.params.id,
      orderId: result?.order,
      driverId: req.user._id || req.user.id,
      gpsCoords: req.body,
      source: 'driver_location',
      req,
    });

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
      logisticsProviderId,
      gpsLat,
      gpsLng,
    } = req.body;

    const order = await Order.findById(orderId).populate('seller buyer logisticsPreference.requestedProvider');
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

    const requestedProviderId = logisticsProviderId ||
      order.logisticsPreference?.requestedProvider?._id ||
      order.logisticsPreference?.requestedProvider;
    const requestedProvider = requestedProviderId
      ? await getVerifiedLogisticsProvider(requestedProviderId)
      : null;
    if (requestedProviderId && !requestedProvider) {
      return res.status(404).json({
        success: false,
        message: 'Selected logistics company is not available or verified.',
      });
    }
    const providerAssignment = buildProviderAssignment(requestedProvider);

    const logistics = await Logistics.create({
      order: orderId,
      orderNumber,
      seller: order.seller._id,
      buyer: order.buyer._id,
      carrier: providerAssignment.carrier || carrier || 'solo_owner_operator',
      ...providerAssignment,
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
        selectedProviderId: requestedProvider?._id,
        selectedProviderName: requestedProvider?.businessName || requestedProvider?.fullName || requestedProvider?.name,
        selectedProviderPhone: requestedProvider?.phone,
        selectedBy: order.logisticsPreference?.selectionSource || (logisticsProviderId ? 'seller' : 'default'),
        buyerRequestedProvider: order.logisticsPreference?.selectionSource === 'buyer',
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
      .populate('seller buyer driver', 'name fullName businessName phone email role verificationStatus logisticsProfile.verificationStatus logisticsProfile.currentLocation');

    if (!logistics) {
      return res.status(404).json({ success: false, message: 'No logistics record found for this order.' });
    }

    const userId = String(req.user._id || req.user.id);
    const role = String(req.user.role || '').toLowerCase();
    const allowed = role === 'admin' ||
      role === 'logistics' ||
      String(logistics.seller?._id || logistics.seller) === userId ||
      String(logistics.buyer?._id || logistics.buyer) === userId ||
      String(logistics.driver?._id || logistics.driver) === userId;

    if (!allowed) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to view logistics for this order.',
      });
    }

    const escrow = await Escrow.findOne({ order: req.params.orderId }).lean().catch(() => null);
    const payload = logistics.toObject ? logistics.toObject({ virtuals: true }) : logistics;
    payload.trust = trustPolicy.buildTrustChecks({ order: payload.order, logistics: payload, escrow });

    return res.status(200).json({ success: true, data: payload });
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

    if (!trustPolicy.isVerifiedLogisticsUser(driver)) {
      return res.status(403).json({
        success: false,
        message: 'Only verified logistics drivers can share trusted live GPS.',
        code: 'LOGISTICS_VERIFICATION_REQUIRED',
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
      logistics.gpsTracking = logistics.gpsTracking || {};
      logistics.gpsTracking.current = {
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        accuracy: req.body.accuracy,
        lastUpdate: new Date(),
      };
      logistics.gpsTracking.history = logistics.gpsTracking.history || [];
      logistics.gpsTracking.history.push({
        location: { lat: parseFloat(lat), lng: parseFloat(lng) },
        accuracy: req.body.accuracy,
        speed: speed || 0,
        heading: heading || 0,
        recordedBy: userId,
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
    const isSeller = logistics.seller?._id?.toString() === userId.toString();
    const isBuyer = logistics.buyer?._id?.toString() === userId.toString();
    const isDriver = logistics.driver && logistics.driver._id.toString() === userId.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isSeller && !isBuyer && !isDriver && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    const pickupCoords = getCoordinatePair(logistics.pickupAddress);
    const deliveryCoords = getCoordinatePair(logistics.shippingAddress);
    const driverCurrentLocation = getCoordinatePair(logistics.gpsTracking?.current)
      || getCoordinatePair(logistics.driver?.logisticsProfile?.currentLocation);
    const gpsHistory = (logistics.gpsTracking?.history || [])
      .slice(-50)
      .map((entry) => ({
        lat: Number(entry.location?.lat),
        lng: Number(entry.location?.lng),
        accuracy: entry.accuracy,
        speed: entry.speed,
        heading: entry.heading,
        timestamp: entry.timestamp,
        label: 'history',
      }))
      .filter((entry) => Number.isFinite(entry.lat) && Number.isFinite(entry.lng));
    const liveRoutePoints = [
      pickupCoords ? { ...pickupCoords, label: 'pickup' } : null,
      ...gpsHistory,
      driverCurrentLocation ? { ...driverCurrentLocation, label: 'driver' } : null,
      deliveryCoords ? { ...deliveryCoords, label: 'delivery' } : null,
    ].filter(Boolean);

    const mapData = {
      logisticsId: logistics._id,
      orderNumber: logistics.orderNumber,
      status: logistics.status,
      
      // Pickup location
      pickup: {
        lat: pickupCoords?.lat,
        lng: pickupCoords?.lng,
        address: logistics.pickupAddress?.label || `${logistics.pickupAddress?.town}, ${logistics.pickupAddress?.county}`,
        confirmed: logistics.pickupQrConfirmed,
        confirmedAt: logistics.qrScans.find(s => s.step === 'pickup')?.scannedAt,
      },
      
      // Delivery location
      delivery: {
        lat: deliveryCoords?.lat,
        lng: deliveryCoords?.lng,
        address: logistics.shippingAddress?.label || `${logistics.shippingAddress?.town}, ${logistics.shippingAddress?.county}`,
        confirmed: logistics.deliveryQrConfirmed,
        confirmedAt: logistics.qrScans.find(s => s.step === 'delivery')?.scannedAt,
      },
      
      // Driver current location (if available)
      driver: logistics.driver ? {
        id: logistics.driver._id,
        name: logistics.driver.fullName || logistics.driver.name,
        phone: logistics.driver.phone,
        currentLocation: driverCurrentLocation,
        lastUpdated: logistics.gpsTracking?.current?.lastUpdate || logistics.driver.logisticsProfile?.currentLocation?.updatedAt,
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
      liveTracking: {
        pickup: pickupCoords,
        delivery: deliveryCoords,
        driver: driverCurrentLocation,
        history: gpsHistory,
        routePath: liveRoutePoints,
        lastUpdate: logistics.gpsTracking?.current?.lastUpdate || gpsHistory[gpsHistory.length - 1]?.timestamp || logistics.updatedAt,
        googleMapsUrl: buildGoogleMapsUrl(liveRoutePoints.length ? liveRoutePoints : [pickupCoords, deliveryCoords]),
        embedUrl: buildGoogleMapsEmbedUrl(liveRoutePoints.length ? liveRoutePoints : [pickupCoords, deliveryCoords]),
      },
      
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

    if (status === 'in_transit' && !trustPolicy.hasVerifiedQrScan(logistics, 'pickup')) {
      return res.status(409).json({
        success: false,
        message: 'Pickup QR must be confirmed before marking this shipment in transit.',
        code: 'PICKUP_QR_REQUIRED',
      });
    }

    if (status === 'delivered' && !trustPolicy.hasVerifiedQrScan(logistics, 'delivery')) {
      return res.status(409).json({
        success: false,
        message: 'Delivery QR must be confirmed before marking this shipment delivered.',
        code: 'DELIVERY_QR_REQUIRED',
      });
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

    if (status === 'delivered') {
      if (escrowService?.markDelivered) {
        try {
          await escrowService.markDelivered(logistics.order, req.user._id, gpsCoords);
        } catch (escrowError) {
          return res.status(409).json({
            success: false,
            message: escrowError.message || 'Escrow must be in transit before delivery can be confirmed.',
            code: 'ESCROW_TRANSITION_FAILED',
          });
        }
      }
    } else if (status === 'in_transit') {
      if (escrowService?.markInTransit) {
        try {
          await escrowService.markInTransit(logistics.order, req.user._id, gpsCoords);
        } catch (escrowError) {
          return res.status(409).json({
            success: false,
            message: escrowError.message || 'Payment must be held in escrow before pickup can be confirmed.',
            code: 'ESCROW_TRANSITION_FAILED',
          });
        }
      }
    }

    await logistics.updateStatus(status, { location, notes, gpsCoords, updatedBy: req.user._id });

    if (status === 'delivered') {
      await Order.findByIdAndUpdate(logistics.order, { status: 'DELIVERED', deliveredAt: new Date() });
      
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
      await Order.findByIdAndUpdate(logistics.order, { status: 'IN_TRANSIT' });
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

    if (!trustPolicy.isVerifiedLogisticsUser(req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Logistics verification is required before accepting trips.',
        code: 'LOGISTICS_VERIFICATION_REQUIRED',
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
    const requesterRole = String(req.user.role || '').toLowerCase();
    const isAdmin = requesterRole === 'admin';
    const isLogisticsUser = requesterRole === 'logistics';
    const isShipmentSeller = String(logistics.seller) === currentUserId;

    if (!isAdmin && !isLogisticsUser && !isShipmentSeller) {
      return res.status(403).json({
        success: false,
        message: 'Only admins, logistics users, or the seller that owns this shipment can assign a driver.',
      });
    }

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
      if (!trustPolicy.isVerifiedLogisticsUser(driver)) {
        return res.status(403).json({
          success: false,
          message: 'Only verified logistics drivers can be assigned to trusted shipments.',
          code: 'LOGISTICS_VERIFICATION_REQUIRED',
        });
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
    const logistics = await Logistics.findById(req.params.id)
      .populate('seller buyer driver', 'name fullName businessName phone role')
      .populate('qrScans.scannedBy', 'name fullName phone role');
    
    if (!logistics) {
      return res.status(404).json({ 
        success: false, 
        message: 'Logistics record not found.' 
      });
    }

    const userId = req.user._id || req.user.id;
    const sellerId = logistics.seller?._id || logistics.seller;
    const buyerId = logistics.buyer?._id || logistics.buyer;
    const driverId = logistics.driver?._id || logistics.driver;
    const isSeller = sellerId?.toString() === userId.toString();
    const isBuyer = buyerId?.toString() === userId.toString();
    const isDriver = driverId && driverId.toString() === userId.toString();
    const isAdmin = req.user.role === 'admin';
    
    if (!isSeller && !isBuyer && !isDriver && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view QR tokens for this shipment.'
      });
    }

    const qrTokens = await QRToken.find({ logistics: logistics._id })
      .populate('holder scannedBy', 'name fullName phone role')
      .sort({ type: 1, createdAt: -1 });

    const now = Date.now();
    const scanAudit = (logistics.qrScans || []).map((scan) => ({
      id: scan._id,
      step: scan.step,
      scannedAt: scan.scannedAt,
      scannedBy: scan.scannedBy,
      gpsCoords: scan.gpsCoords,
      verified: scan.verified !== false,
    })).sort((a, b) => new Date(b.scannedAt || 0) - new Date(a.scannedAt || 0));

    const tokenPayload = qrTokens.map((t) => {
      const expired = Boolean(t.expiresAt && t.expiresAt.getTime() <= now);
      return {
        id: t._id,
        type: t.type,
        token: t.token,
        qrImage: t.qrImage,
        holder: t.holder,
        isUsed: t.isUsed,
        status: t.isUsed ? 'used' : expired ? 'expired' : 'active',
        usedAt: t.usedAt,
        scannedBy: t.scannedBy,
        gpsAtScan: t.gpsAtScan,
        expiresAt: t.expiresAt,
        createdAt: t.createdAt,
        secondsUntilExpiry: t.expiresAt ? Math.max(0, Math.floor((t.expiresAt.getTime() - now) / 1000)) : null,
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        logisticsId: logistics._id,
        pickupQrConfirmed: logistics.pickupQrConfirmed || false,
        deliveryQrConfirmed: logistics.deliveryQrConfirmed || false,
        nextStep: logistics.pickupQrConfirmed ? (logistics.deliveryQrConfirmed ? 'complete' : 'delivery') : 'pickup',
        activeTokens: tokenPayload.filter((token) => token.status === 'active'),
        availableTokens: tokenPayload.filter((token) => token.status === 'active'),
        tokens: tokenPayload,
        scanAudit,
        lastGpsScan: scanAudit.find((scan) => scan.gpsCoords?.lat && scan.gpsCoords?.lng) || null,
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
      ? await QRToken.findOne({
        $or: [
          { tokenHash: hashToken(normalizedToken) },
          { token: normalizedToken },
        ],
      }).select('type logistics')
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

    // GPS proof is required for both handoff steps so the shared timeline is trusted.
    if (!gpsCoords || !gpsCoords.lat || !gpsCoords.lng) {
      return res.status(400).json({
        success: false,
        message: step === 'pickup'
          ? 'GPS coordinates required for pickup confirmation'
          : 'GPS coordinates required for delivery confirmation',
        errors: [{ message: 'Please enable GPS on your device before scanning this QR code.' }]
      });
    }

    if (step === 'pickup') {
      const isAdmin = userRole === 'admin';
      const scannerIsVerifiedDriver = trustPolicy.isVerifiedLogisticsUser(req.user);
      const assignedDriverIsVerified = trustPolicy.isVerifiedLogisticsUser(logistics.driver);

      if (!isAdmin && (!scannerIsVerifiedDriver || !assignedDriverIsVerified)) {
        return res.status(403).json({
          success: false,
          message: 'Only verified logistics drivers can confirm pickup and start live tracking.',
          code: 'LOGISTICS_VERIFICATION_REQUIRED',
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

    if (escrowService?.getEscrowByOrder) {
      try {
        const escrow = await escrowService.getEscrowByOrder(logistics.order._id || logistics.order);
        const expectedEscrowStatus = step === 'pickup' ? 'HELD' : 'IN_TRANSIT';
        if (escrow.status !== expectedEscrowStatus) {
          return res.status(409).json({
            success: false,
            message: step === 'pickup'
              ? 'Payment must be held in escrow before pickup QR can be scanned.'
              : 'Pickup escrow handoff must be completed before delivery QR can be scanned.',
            code: 'ESCROW_NOT_READY',
            errors: [{
              message: `Escrow status must be ${expectedEscrowStatus}. Current status: ${escrow.status}.`,
              details: {
                step,
                escrowStatus: escrow.status,
                expectedEscrowStatus,
                logisticsId: logistics._id,
                orderId: logistics.order?._id || logistics.order,
              },
            }],
          });
        }
      } catch (escrowError) {
        return res.status(409).json({
          success: false,
          message: escrowError.message || 'Escrow record is required before QR handoff.',
          code: 'ESCROW_NOT_READY',
          errors: [{
            message: 'Complete buyer payment and escrow hold before scanning logistics QR codes.',
            details: {
              step,
              logisticsId: logistics._id,
              orderId: logistics.order?._id || logistics.order,
            },
          }],
        });
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
      scannedBy: userId,
      gpsCoords,
      verified: true,
      scannedAt: new Date()
    });
    logistics.gpsTracking = logistics.gpsTracking || {};
    logistics.gpsTracking.history = logistics.gpsTracking.history || [];
    logistics.gpsTracking.history.push({
      location: { lat: Number(gpsCoords.lat), lng: Number(gpsCoords.lng) },
      accuracy: gpsCoords.accuracy,
      speed: gpsCoords.speed,
      heading: gpsCoords.heading,
      recordedBy: userId,
      timestamp: new Date(),
    });
    logistics.gpsTracking.current = {
      lat: Number(gpsCoords.lat),
      lng: Number(gpsCoords.lng),
      accuracy: gpsCoords.accuracy,
      lastUpdate: new Date(),
    };

    await recordLogisticsLocation({
      logistics,
      driverId: userId,
      gpsCoords,
      source: step === 'pickup' ? 'pickup_scan' : 'delivery_scan',
      req,
    });

    let escrowRelease = null;

    if (step === 'pickup') {
      logistics.status = 'in_transit';
      logistics.pickupTime = new Date();

      if (escrowService && escrowService.markInTransit) {
        try {
          await escrowService.markInTransit(logistics.order._id || logistics.order, userId, gpsCoords);
        } catch (escrowError) {
          logger.warn('Escrow update failed:', escrowError);
          return res.status(409).json({
            success: false,
            message: escrowError.message || 'Pickup QR accepted, but escrow could not move to in-transit.',
            code: 'ESCROW_TRANSITION_FAILED',
            errors: [{
              message: 'Payment must be held in escrow before pickup can be confirmed.',
              details: {
                step,
                logisticsId: logistics._id,
                orderId: logistics.order?._id || logistics.order,
              },
            }],
          });
        }
      }

      await logistics.save();

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

      if (escrowService && escrowService.markDelivered) {
        try {
          await escrowService.markDelivered(logistics.order._id || logistics.order, userId, gpsCoords);
        } catch (escrowError) {
          logger.warn('Escrow update failed:', escrowError);
          return res.status(409).json({
            success: false,
            message: escrowError.message || 'Delivery QR accepted, but escrow could not enter the delivery release window.',
            code: 'ESCROW_TRANSITION_FAILED',
            errors: [{
              message: 'Escrow must be in transit before delivery can be confirmed.',
              details: {
                step,
                logisticsId: logistics._id,
                orderId: logistics.order?._id || logistics.order,
              },
            }],
          });
        }
      }

      await logistics.save();

      await Order.findByIdAndUpdate(logistics.order, { 
        status: 'DELIVERED',
        deliveredAt: new Date() 
      });

      if (escrowService && escrowService.releasePayment) {
        escrowRelease = {
          released: false,
          releaseWindowActive: true,
          releaseDue: logistics.escrowReleaseDue,
        };
      }

      const recipients = [];
      if (logistics.seller) recipients.push(logistics.seller._id || logistics.seller);
      if (logistics.buyer) recipients.push(logistics.buyer._id || logistics.buyer);
      
      if (dispatchSvc && recipients.length > 0) {
        await dispatchSvc.dispatch({
          userIds: recipients,
          channels: ['push', 'sms'],
          title: '✅ Delivery confirmed',
          body: `${logistics.cargoType || 'Cargo'} has been delivered successfully. Escrow remains protected during the review window.`,
          data: { 
            shipmentId: logistics._id.toString(), 
            status: 'delivered',
            deliveredAt: new Date().toISOString()
          },
        });
      }
    }

    const trust = trustPolicy.buildTrustChecks({ order: logistics.order, logistics });
    await auditService.record({
      entityType: 'Logistics',
      entityId: logistics._id,
      action: step === 'pickup' ? 'PICKUP_QR_GPS_CONFIRMED' : 'DELIVERY_QR_GPS_CONFIRMED',
      actor: userId,
      newValue: {
        step,
        gpsCoords,
        logisticsStatus: logistics.status,
        trust,
      },
      req,
    });

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
        gpsAtScan: verificationResult?.gpsAtScan || null,
        trust,
        tokenStatus: {
          id: verificationResult?._id,
          type: verificationResult?.type,
          usedAt: verificationResult?.usedAt,
          expiresAt: verificationResult?.expiresAt,
        },
        escrowRelease: escrowRelease ? {
          released: escrowRelease.released,
          alreadyReleased: escrowRelease.alreadyReleased,
          split: escrowRelease.split,
          payouts: escrowRelease.payouts,
        } : null,
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

exports.getGroupTripRoutes = async (req, res, next) => {
  try {
    await ensureDefaultGroupTripRoutes();
    const includeInactive = String(req.query.includeInactive || '').toLowerCase() === 'true';
    const query = includeInactive ? {} : { isActive: true };
    let routes = await GroupTripRoute.find(query).sort({ isDefault: -1, label: 1 }).lean();

    if (!routes.length && !includeInactive) {
      routes = DEFAULT_GROUP_TRIP_ROUTES.map((route) => omitUndefinedFields({
        ...route,
        _id: route.routeId,
      }));
    }

    return res.status(200).json({
      success: true,
      data: routes.map(serializeGroupTripRoute),
    });
  } catch (err) {
    next(err);
  }
};

exports.createGroupTripRoute = async (req, res, next) => {
  try {
    const {
      label,
      originName,
      destinationName,
      originLat,
      originLng,
      destinationLat,
      destinationLng,
      cargoType,
      routeCode,
      stops,
    } = req.body;

    const resolvedLabel = String(label || `${originName} to ${destinationName}`).trim();
    const routeId = buildRouteId(resolvedLabel);
    const normalizedStops = Array.isArray(stops)
      ? stops.map((stop) => String(stop).trim()).filter(Boolean)
      : String(stops || '')
        .split(',')
        .map((stop) => stop.trim())
        .filter(Boolean);

    if (!routeId) {
      return res.status(400).json({ success: false, message: 'Route label is required.' });
    }

    const existing = await GroupTripRoute.findOne({ routeId });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'A route with this name already exists.',
      });
    }

    const route = await GroupTripRoute.create({
      routeId,
      label: resolvedLabel,
      originName,
      destinationName,
      origin: { lat: Number(originLat), lng: Number(originLng) },
      destination: { lat: Number(destinationLat), lng: Number(destinationLng) },
      routeCode: routeCode ? String(routeCode).trim().toUpperCase() : undefined,
      stops: normalizedStops.length ? normalizedStops : [originName, destinationName],
      cargoType: cargoType || `Mixed ${resolvedLabel} cargo`,
      createdBy: req.user._id || req.user.id,
    });

    return res.status(201).json({
      success: true,
      message: 'Group trip route created successfully.',
      data: serializeGroupTripRoute(route),
    });
  } catch (err) {
    next(err);
  }
};

exports.deleteGroupTripRoute = async (req, res, next) => {
  try {
    const route = await GroupTripRoute.findOne({
      $or: [
        { routeId: req.params.routeId },
        { _id: req.params.routeId.match(/^[0-9a-fA-F]{24}$/) ? req.params.routeId : undefined },
      ].filter((condition) => Object.values(condition)[0]),
    });

    if (!route) {
      return res.status(404).json({ success: false, message: 'Group trip route not found.' });
    }

    if (route.isDefault) {
      route.isActive = false;
      await route.save();
    } else {
      await route.deleteOne();
    }

    return res.status(200).json({
      success: true,
      message: 'Group trip route deleted successfully.',
      data: { routeId: route.routeId },
    });
  } catch (err) {
    next(err);
  }
};

exports.getOpenGroupTrips = async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 8, 1), 50);
    const originLat = Number(req.query.originLat);
    const originLng = Number(req.query.originLng);
    const destinationLat = Number(req.query.destinationLat);
    const destinationLng = Number(req.query.destinationLng);
    const maxDistanceKm = Math.min(Math.max(Number(req.query.maxDistanceKm || 25), 1), 500);
    const hasOrigin = Number.isFinite(originLat) && Number.isFinite(originLng);
    const hasDestination = Number.isFinite(destinationLat) && Number.isFinite(destinationLng);

    await GroupTrip.updateMany(
      { status: 'open', deadline: { $lt: new Date() } },
      { $set: { status: 'expired' } }
    );

    const trips = await GroupTrip.find({
      status: 'open',
      deadline: { $gte: new Date() },
    })
      .populate('initiator', 'fullName name businessName phone role')
      .populate('participants.user', 'fullName name businessName phone role')
      .sort({ deadline: 1, createdAt: -1 })
      .limit(100);

    const filtered = trips
      .map((trip) => {
        const originDistanceKm = hasOrigin
          ? calculateDistance(originLat, originLng, trip.origin.lat, trip.origin.lng)
          : null;
        const destinationDistanceKm = hasDestination
          ? calculateDistance(destinationLat, destinationLng, trip.destination.lat, trip.destination.lng)
          : null;

        return {
          trip,
          originDistanceKm,
          destinationDistanceKm,
        };
      })
      .filter(({ originDistanceKm, destinationDistanceKm }) => (
        (!hasOrigin || originDistanceKm <= maxDistanceKm) &&
        (!hasDestination || destinationDistanceKm <= maxDistanceKm)
      ))
      .sort((left, right) => {
        if (hasOrigin) return left.originDistanceKm - right.originDistanceKm;
        return new Date(left.trip.deadline).getTime() - new Date(right.trip.deadline).getTime();
      })
      .slice(0, limit)
      .map(({ trip, originDistanceKm, destinationDistanceKm }) => ({
        ...summarizeGroupTrip(trip, req.user._id || req.user.id),
        originDistanceKm,
        destinationDistanceKm,
      }));

    return res.status(200).json({
      success: true,
      data: filtered,
      meta: {
        count: filtered.length,
        maxDistanceKm,
        origin: hasOrigin ? { lat: originLat, lng: originLng } : null,
        destination: hasDestination ? { lat: destinationLat, lng: destinationLng } : null,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.createGroupTrip = async (req, res, next) => {
  try {
    const { 
      originLat, originLng, 
      destinationLat, destinationLng,
      maxCapacityKg,
      deadlineHours,
      cargoType,
      notes,
      routeCode,
      routeLabel,
      stops,
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
    const normalizedStops = Array.isArray(stops)
      ? stops.map((stop) => String(stop).trim()).filter(Boolean)
      : String(stops || '')
        .split(',')
        .map((stop) => stop.trim())
        .filter(Boolean);

    const groupTrip = await GroupTrip.create({
      tripId,
      initiator: userId,
      origin: { lat: originLat, lng: originLng },
      destination: { lat: destinationLat, lng: destinationLng },
      routeCode: routeCode ? String(routeCode).trim().toUpperCase() : undefined,
      routeLabel: routeLabel || undefined,
      stops: normalizedStops,
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
      $or: [
        { role: { $in: ['seller', 'farmer'] } },
        { businessType: { $in: ['wholesaler', 'retailer', 'farmer'] } },
      ],
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

    const weightShare = weightKg / newTotalWeight;
    const costShare = groupTrip.baseFare * weightShare;

    groupTrip.participants.push({
      user: userId,
      weightKg,
      share: costShare,
      paymentStatus: 'unpaid',
      paymentMethod: 'mpesa',
      paymentAmount: costShare,
      joinedAt: new Date(),
    });
    groupTrip.currentCapacityKg = newTotalWeight;

    // Update all participants' cost shares
    for (const participant of groupTrip.participants) {
      const participantWeightShare = groupTrip.currentCapacityKg > 0
        ? participant.weightKg / groupTrip.currentCapacityKg
        : 0;
      participant.share = Math.round(groupTrip.baseFare * participantWeightShare);
      if (!['paid', 'refunded'].includes(participant.paymentStatus)) {
        participant.paymentAmount = participant.share;
      }
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
        yourShare: groupTrip.participants.find((participant) => sameId(participant.user, userId))?.share || costShare,
        paymentStatus: 'unpaid',
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

exports.recordGroupTripPayment = async (req, res, next) => {
  try {
    const {
      participantUserId,
      paymentStatus,
      paymentMethod = 'mpesa',
      paymentReference = '',
      paymentPhone = '',
      amount,
      notes = '',
    } = req.body;
    const currentUserId = req.user._id || req.user.id;
    const role = String(req.user.role || '').toLowerCase();
    const canManagePayment = ['admin', 'logistics'].includes(role);
    const targetUserId = canManagePayment && participantUserId ? participantUserId : currentUserId;
    const requestedStatus = String(paymentStatus || (canManagePayment ? 'paid' : 'pending')).toLowerCase();
    const normalizedStatus = canManagePayment
      ? requestedStatus
      : (requestedStatus === 'failed' ? 'failed' : 'pending');
    const normalizedMethod = String(paymentMethod || 'mpesa').toLowerCase();
    const allowedStatuses = ['unpaid', 'pending', 'paid', 'failed', 'refunded'];
    const allowedMethods = ['mpesa', 'cash', 'wallet', 'bank_transfer', 'card'];

    if (!allowedStatuses.includes(normalizedStatus)) {
      return res.status(400).json({ success: false, message: 'Invalid group trip payment status.' });
    }

    if (!allowedMethods.includes(normalizedMethod)) {
      return res.status(400).json({ success: false, message: 'Invalid group trip payment method.' });
    }

    const tripIdentifier = String(req.params.tripId || '').trim();
    const tripQuery = /^[0-9a-fA-F]{24}$/.test(tripIdentifier)
      ? { $or: [{ _id: tripIdentifier }, { tripId: tripIdentifier }] }
      : { tripId: tripIdentifier };

    const groupTrip = await GroupTrip.findOne(tripQuery);
    if (!groupTrip) {
      return res.status(404).json({ success: false, message: 'Group trip not found.' });
    }

    const participant = groupTrip.participants.find((item) => sameId(item.user, targetUserId));
    if (!participant) {
      return res.status(404).json({
        success: false,
        message: 'Participant is not part of this group trip.',
      });
    }

    if (!canManagePayment && !sameId(participant.user, currentUserId)) {
      return res.status(403).json({
        success: false,
        message: 'You can only update your own group trip payment.',
      });
    }

    const paymentAmount = Number.isFinite(Number(amount)) && Number(amount) > 0
      ? Number(amount)
      : Number(participant.share || 0);
    const now = new Date();

    participant.paymentStatus = normalizedStatus;
    participant.paymentMethod = normalizedMethod;
    participant.paymentReference = String(paymentReference || '').trim();
    participant.paymentPhone = String(paymentPhone || '').trim();
    participant.paymentAmount = paymentAmount;
    participant.paymentNotes = String(notes || '').trim();
    participant.paidAt = normalizedStatus === 'paid' ? now : undefined;
    participant.paymentConfirmedBy = normalizedStatus === 'paid' ? currentUserId : undefined;

    await groupTrip.save();

    let payment = null;
    if (['pending', 'paid'].includes(normalizedStatus) && paymentAmount > 0) {
      payment = await Payment.create({
        user: participant.user,
        amount: paymentAmount,
        currency: 'KES',
        paymentMethod: normalizedMethod,
        status: normalizedStatus === 'paid' ? 'completed' : 'pending',
        transactionId: `GT-${groupTrip.tripId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        phoneNumber: participant.paymentPhone || undefined,
        mpesaReceiptNumber: normalizedMethod === 'mpesa' && participant.paymentReference ? participant.paymentReference : undefined,
        description: `Group trip payment for ${groupTrip.routeLabel || groupTrip.tripId}`,
        paidAt: normalizedStatus === 'paid' ? now : undefined,
        metadata: {
          purpose: 'group_trip_logistics',
          groupTripId: groupTrip.tripId,
          participantUserId: String(participant.user),
          confirmedBy: String(currentUserId),
          paymentReference: participant.paymentReference,
        },
      });
    }

    try {
      await dispatchSvc.dispatch({
        userIds: [participant.user],
        channels: ['push'],
        title: normalizedStatus === 'paid' ? 'Group trip payment confirmed' : 'Group trip payment updated',
        body: normalizedStatus === 'paid'
          ? `Your ${groupTrip.tripId} logistics payment of KES ${Math.round(paymentAmount).toLocaleString()} has been confirmed.`
          : `Your ${groupTrip.tripId} logistics payment is marked ${normalizedStatus}.`,
        data: {
          groupTripId: groupTrip.tripId,
          paymentStatus: normalizedStatus,
          paymentId: payment?._id?.toString(),
        },
      });
    } catch (notifyError) {
      logger.warn('Group trip payment notification failed', {
        error: notifyError.message,
        groupTripId: groupTrip.tripId,
        participantUserId: String(participant.user),
      });
    }

    await groupTrip.populate('initiator', 'fullName name businessName phone role');
    await groupTrip.populate('participants.user', 'fullName name businessName phone role');

    return res.status(200).json({
      success: true,
      message: normalizedStatus === 'paid'
        ? 'Group trip payment confirmed successfully.'
        : 'Group trip payment updated successfully.',
      data: {
        groupTrip: summarizeGroupTrip(groupTrip, currentUserId),
        payment,
      },
    });
  } catch (err) {
    next(err);
  }
};

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
