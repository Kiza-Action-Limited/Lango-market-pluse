<<<<<<< HEAD
'use strict';
=======
const Logistics = require('../models/Logistics.model');
const Order     = require('../models/Order.model');
const User      = require('../models/User.model');
const { uploadToCloudinary } = require('../config/cloudinary.config');
const { validationResult } = require('express-validator');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const notFound = (res, msg = 'Logistics record not found') =>
  res.status(404).json({ success: false, message: msg });

const extractGps = (body) => ({
  lat: parseFloat(body.lat  ?? body.latitude  ?? 0),
  lng: parseFloat(body.lng  ?? body.longitude ?? 0)
});

const ensureDriverOwnsTrip = (logistics, user) => {
  if (!user) return 'Authentication required';
  if (user.role === 'admin') return null;
  if (user.role !== 'logistics') return 'Only logistics users can perform this action';

  if (!logistics.driver) {
    return 'This shipment has not been accepted by a driver yet.';
  }

  if (String(logistics.driver) !== String(user._id || user.id)) {
    return 'You are not assigned to this shipment.';
  }

  return null;
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

// ─── Logistics Application Flow ───────────────────────────────────────────────

/**
 * POST /api/v1/logistics/apply
 * Registers a user into the logistics verification pipeline.
 */
exports.applyAsLogistics = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const {
      driverMode = 'owner_operator',
      vehiclePlate,
      cargoCapacityKg,
      documentType,
      documentNumber,
      fleetOwnerId,
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

    user.role = 'logistics';
    user.businessType = 'logistics';
    user.subscriptionTier = 'mizigo';
    user.logisticsProfile = {
      ...(user.logisticsProfile?.toObject?.() || user.logisticsProfile || {}),
      verificationStatus: 'pending',
      documentType,
      documentNumber,
      vehiclePlate: String(vehiclePlate).trim().toUpperCase(),
      cargoCapacityKg: Number(cargoCapacityKg),
      driverMode,
      fleetOwner: driverMode === 'hired_driver' && fleetOwnerId ? fleetOwnerId : undefined,
      documents: uploadedDocs.length ? uploadedDocs : (user.logisticsProfile?.documents || []),
      applicationSubmittedAt: new Date(),
      reviewedAt: null,
      reviewedBy: null,
      reviewNotes: '',
      verifiedAt: null,
    };
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Logistics application submitted successfully. Awaiting admin verification.',
      data: {
        verificationStatus: user.logisticsProfile.verificationStatus,
        applicationSubmittedAt: user.logisticsProfile.applicationSubmittedAt,
        driverMode: user.logisticsProfile.driverMode,
        vehiclePlate: user.logisticsProfile.vehiclePlate,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/logistics/me/application
 * Returns the current logistics application state.
 */
exports.getMyLogisticsApplication = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select(
      'role businessType logisticsProfile subscriptionTier'
    );
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

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

/**
 * PUT /api/v1/logistics/:id/accept
 * Approved logistics drivers accept a pending order assignment.
 */
exports.acceptLogisticsOrder = async (req, res, next) => {
  try {
    const logistics = await Logistics.findById(req.params.id);
    if (!logistics) return notFound(res);

    if (logistics.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot accept order in "${logistics.status}" status.`,
      });
    }

    if (logistics.driver && String(logistics.driver) !== String(req.user._id)) {
      return res.status(409).json({
        success: false,
        message: 'This order is already accepted by another driver.',
      });
    }

    const driver = await User.findById(req.user.id);
    if (!driver) return res.status(404).json({ success: false, message: 'Driver not found' });

    logistics.driver = driver._id;
    logistics.driverName = driver.fullName || driver.name;
    logistics.driverPhone = driver.phone;

    const driverMode = driver.logisticsProfile?.driverMode || 'owner_operator';
    logistics.driverType = driverMode;
    if (driverMode === 'hired_driver') {
      logistics.fleetOwner = driver.logisticsProfile?.fleetOwner || null;
      logistics.payoutRecipient = logistics.fleetOwner || null;
      logistics.payoutRecipientType = 'fleet_owner';
    } else {
      logistics.payoutRecipient = driver._id;
      logistics.payoutRecipientType = 'driver';
    }

    logistics.trackingHistory.push({
      status: 'pending',
      location: logistics.currentLocation,
      notes: 'Driver accepted logistics order',
      timestamp: new Date(),
      updatedBy: driver._id,
    });

    await logistics.save();

    res.status(200).json({
      success: true,
      message: 'Order accepted successfully. Proceed to pickup QR scan.',
      data: logistics,
    });
  } catch (err) {
    next(err);
  }
};

// ─── Create ───────────────────────────────────────────────────────────────────
>>>>>>> a4ca05ef18bdd6473e0d7b4cf68582b8dde40cd6

/**
 * Lango MarketPulse — Logistics Controller
 * Kakuma–Kitale Corridor | Plan 4 "Mizigo"
 *
 * Handles all HTTP logic for logistics records.
 * Business logic (escrow, QR, notifications) lives in services.
 */

const Logistics  = require('../models/Logistics.model');
const Order      = require('../models/Order.model');
const User       = require('../models/User.model');
const dispatchSvc = require('../services/notification/dispatch.service');
const logger     = require('../utils/logger');

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
    gpsLat: source.gpsLat || fallback.gpsLat,
    gpsLng: source.gpsLng || fallback.gpsLng,
    country: source.country || fallback.country || 'Kenya',
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// CREATE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a new logistics record for an approved order.
 * POST /api/v1/logistics
 */
exports.createLogistics = async (req, res, next) => {
  try {
<<<<<<< HEAD
    const { orderId, carrier, pickupAddress, shippingAddress, weight, weightUnit, dimensions, cargoType, isExpress, notes } = req.body;
=======
    const {
      orderId, driverType = 'owner_operator',
      shippingAddress, weight, dimensions, notes,
      escrowAmount, commissionRate, driverId, fleetOwnerId
    } = req.body;
>>>>>>> a4ca05ef18bdd6473e0d7b4cf68582b8dde40cd6

    const order = await Order.findById(orderId).populate('seller buyer');
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
    }

    const existing = await Logistics.findOne({ order: orderId });
    if (existing) {
      return res.status(409).json({ success: false, message: 'A logistics record already exists for this order.' });
    }

<<<<<<< HEAD
    const orderNumber = getOrderNumber(order);
    if (!order.orderNumber) {
      await Order.updateOne({ _id: order._id }, { $set: { orderNumber } });
    }

    const orderDeliveryAddress = order.deliveryAddress?.toObject
      ? order.deliveryAddress.toObject()
      : order.deliveryAddress;

    const logistics = await Logistics.create({
      order           : orderId,
      orderNumber,
      seller          : order.seller._id,
      buyer           : order.buyer._id,
      carrier         : carrier ?? 'solo_owner_operator',
      pickupAddress   : normalizeAddress(pickupAddress),
      shippingAddress : normalizeAddress(shippingAddress, orderDeliveryAddress),
=======
    const normalizedCommission = commissionRate === undefined ? 0.075 : Number(commissionRate);
    if (Number.isNaN(normalizedCommission) || normalizedCommission < 0.05 || normalizedCommission > 0.10) {
      return res.status(400).json({ success: false, message: 'Commission rate must be between 5% and 10%.' });
    }

    const logistics = new Logistics({
      order:           orderId,
      orderNumber:     order.orderNumber,
      driverType,
      driver:          driverId || null,
      fleetOwner:      fleetOwnerId || null,
      payoutRecipient: driverType === 'hired_driver' ? (fleetOwnerId || null) : (driverId || null),
      payoutRecipientType: driverType === 'hired_driver' ? 'fleet_owner' : 'driver',
      shippingAddress: shippingAddress || order.shippingAddress,
>>>>>>> a4ca05ef18bdd6473e0d7b4cf68582b8dde40cd6
      weight,
      weightUnit,
      dimensions,
      cargoType,
      isExpress       : isExpress ?? false,
      notes,
<<<<<<< HEAD
      status          : 'pending',
=======
      status:          'pending',
      escrow: {
        totalAmount:          escrowAmount || order.totalAmount || 0,
        platformCommissionRate: normalizedCommission
      }
>>>>>>> a4ca05ef18bdd6473e0d7b4cf68582b8dde40cd6
    });

    return res.status(201).json({
      success : true,
      message : 'Logistics record created.',
      data    : logistics,
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// READ
// ─────────────────────────────────────────────────────────────────────────────

/**
 * List all logistics records with optional filters and pagination.
 * GET /api/v1/logistics
 */
<<<<<<< HEAD
=======
exports.scanPickup = async (req, res, next) => {
  try {
    const { qrPayload } = req.body;
    const logistics = await Logistics.findById(req.params.id);
    if (!logistics) return notFound(res);

    const ownershipError = ensureDriverOwnsTrip(logistics, req.user);
    if (ownershipError) {
      return res.status(403).json({ success: false, message: ownershipError });
    }

    // Validate QR payload matches
    if (logistics.sellerQrCode !== qrPayload) {
      return res.status(400).json({ success: false, message: 'Invalid QR code for this shipment' });
    }

    await logistics.recordPickupScan({
      scannedBy:  req.user._id,
      ...extractGps(req.body),
      ipAddress:  req.ip
    });

    // TODO: emit socket / push notification to seller here

    res.status(200).json({
      success: true,
      message: 'Pickup confirmed. Stock is now IN_TRANSIT. Seller has been notified.',
      data: {
        status:       logistics.status,
        driverQrCode: logistics.driverQrCode,  // driver shows this to buyer on delivery
        trackingNumber: logistics.trackingNumber,
        step1_pickupScan: logistics.step1_pickupScan
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/logistics/:id/scan/delivery
 * Step 2 — Buyer scans Driver's QR.
 * Body: { qrPayload, lat, lng }
 * Marks DELIVERED, calculates payouts, starts 72-hr escrow countdown.
 */
exports.scanDelivery = async (req, res, next) => {
  try {
    const { qrPayload } = req.body;
    const logistics = await Logistics.findById(req.params.id);
    if (!logistics) return notFound(res);

    if (logistics.driverQrCode !== qrPayload) {
      return res.status(400).json({ success: false, message: 'Invalid QR code for this shipment' });
    }

    await logistics.recordDeliveryScan({
      scannedBy:  req.user._id,
      ...extractGps(req.body),
      ipAddress:  req.ip
    });

    // Sync order status
    await Order.findByIdAndUpdate(logistics.order, {
      status:      'delivered',
      deliveredAt: logistics.actualDelivery
    });

    // TODO: schedule auto-release job at logistics.step3_autoRelease.scheduledAt

    res.status(200).json({
      success: true,
      message: 'Delivery confirmed. Escrow will auto-release in 72 hours unless a dispute is opened.',
      data: {
        status:        logistics.status,
        actualDelivery: logistics.actualDelivery,
        escrow:         logistics.escrow,
        autoReleaseAt:  logistics.step3_autoRelease.scheduledAt,
        step2_deliveryScan: logistics.step2_deliveryScan
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/logistics/:id/escrow/release
 * Step 3 — Release escrow (called by cron job OR buyer early-confirm OR admin).
 * Body: { triggeredBy: 'buyer_confirm' | 'auto' | 'admin' }
 */
exports.releaseEscrow = async (req, res, next) => {
  try {
    const triggeredBy = req.body.triggeredBy || 'auto';
    const logistics = await Logistics.findById(req.params.id);
    if (!logistics) return notFound(res);

    await logistics.releaseEscrow(triggeredBy);

    res.status(200).json({
      success: true,
      message: 'Escrow released successfully.',
      data: {
        escrow:             logistics.escrow,
        step3_autoRelease:  logistics.step3_autoRelease
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v1/logistics/:id/dispute
 * Freeze escrow and flag shipment as disputed.
 */
exports.openDispute = async (req, res, next) => {
  try {
    const logistics = await Logistics.findById(req.params.id);
    if (!logistics) return notFound(res);

    await logistics.openDispute(req.user._id);

    res.status(200).json({
      success: true,
      message: 'Dispute opened. Escrow is frozen pending resolution.',
      data: { status: logistics.status, escrow: logistics.escrow }
    });
  } catch (err) {
    next(err);
  }
};

// ─── Read ─────────────────────────────────────────────────────────────────────

>>>>>>> a4ca05ef18bdd6473e0d7b4cf68582b8dde40cd6
exports.getAllLogistics = async (req, res, next) => {
  try {
    const { status, carrier, driverId, startDate, endDate, page = 1, limit = 20 } = req.query;
    const query = {};

    if (status   && status   !== 'all') query.status  = status;
    if (carrier  && carrier  !== 'all') query.carrier = carrier;
    if (driverId) query.driver = driverId;

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate)   query.createdAt.$lte = new Date(endDate);
    }

<<<<<<< HEAD
    const [records, total, stats] = await Promise.all([
      Logistics.find(query)
        .populate('order', 'orderNumber total')
        .populate('seller',  'name phone')
        .populate('buyer',   'name phone')
        .populate('driver',  'name phone')
=======
    if (req.user.role === 'logistics') {
      const userId = req.user._id || req.user.id;
      q.$or = [
        { driver: userId },
        { status: 'pending', driver: null },
      ];
    }

    const [logistics, total, stats] = await Promise.all([
      Logistics.find(q)
        .populate('order', 'orderNumber total customer')
        .populate('driver', 'name email phone')
>>>>>>> a4ca05ef18bdd6473e0d7b4cf68582b8dde40cd6
        .sort('-createdAt')
        .skip((page - 1) * limit)
        .limit(parseInt(limit, 10)),
      Logistics.countDocuments(query),
      Logistics.getDeliveryStats(startDate, endDate),
    ]);

    return res.status(200).json({
      success    : true,
      data       : records,
      stats,
      pagination : {
        page  : parseInt(page, 10),
        limit : parseInt(limit, 10),
        total,
        pages : Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/logistics/:id
 */
exports.getLogisticsById = async (req, res, next) => {
  try {
    const logistics = await Logistics.findById(req.params.id)
      .populate('order')
      .populate('seller buyer driver fleetOwner', 'name phone email');

    if (!logistics) {
      return res.status(404).json({ success: false, message: 'Logistics record not found.' });
    }

    return res.status(200).json({ success: true, data: logistics });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/logistics/order/:orderId
 */
exports.getLogisticsByOrder = async (req, res, next) => {
  try {
    const logistics = await Logistics.findOne({ order: req.params.orderId })
      .populate('order')
      .populate('seller buyer driver', 'name phone email');

    if (!logistics) {
      return res.status(404).json({ success: false, message: 'No logistics record found for this order.' });
    }

    return res.status(200).json({ success: true, data: logistics });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE — STATUS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Update logistics status with tracking history entry.
 * PUT /api/v1/logistics/:id/status
 */
exports.updateLogisticsStatus = async (req, res, next) => {
  try {
    const { status, location, notes, gpsCoords } = req.body;

    const logistics = await Logistics.findById(req.params.id);
    if (!logistics) {
      return res.status(404).json({ success: false, message: 'Logistics record not found.' });
    }

    await logistics.updateStatus(status, { location, notes, gpsCoords, updatedBy: req.user._id });

    // Mirror status to associated order
    if (status === 'delivered') {
      await Order.findByIdAndUpdate(logistics.order, { status: 'delivered', deliveredAt: new Date() });
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

/**
 * Assign or re-assign a driver to a shipment.
 * PUT /api/v1/logistics/:id/assign-driver
 */
exports.assignDriver = async (req, res, next) => {
  try {
<<<<<<< HEAD
    const { driverId, driverName, driverPhone } = req.body;

=======
    const { driverId, driverName, driverPhone, driverType, fleetOwnerId } = req.body;
>>>>>>> a4ca05ef18bdd6473e0d7b4cf68582b8dde40cd6
    const logistics = await Logistics.findById(req.params.id);
    if (!logistics) {
      return res.status(404).json({ success: false, message: 'Logistics record not found.' });
    }

    if (driverId) {
      const driver = await User.findById(driverId);
      if (!driver || driver.role !== 'logistics') {
        return res.status(400).json({ success: false, message: 'User is not a registered logistics driver.' });
      }
<<<<<<< HEAD

=======
      if (driver.logisticsProfile?.verificationStatus !== 'verified') {
        return res.status(400).json({
          success: false,
          message: 'Selected driver is not yet approved for logistics operations.',
        });
      }
>>>>>>> a4ca05ef18bdd6473e0d7b4cf68582b8dde40cd6
      logistics.driver      = driverId;
      logistics.driverName  = driver.fullName;
      logistics.driverPhone = driver.phone;

      // Determine payment routing
      if (driver.fleetOwner) {
        logistics.fleetOwner = driver.fleetOwner;
        logistics.carrier    = 'fleet_managed';
      } else {
        logistics.carrier = 'solo_owner_operator';
      }
    } else {
      // Manual override (external driver without a platform account)
      logistics.driverName  = driverName;
      logistics.driverPhone = driverPhone;
      logistics.carrier     = 'third_party';
    }

<<<<<<< HEAD
    await logistics.updateStatus('driver_assigned', { updatedBy: req.user._id });
=======
    if (driverType) logistics.driverType = driverType;
    if (fleetOwnerId) logistics.fleetOwner = fleetOwnerId;
    if (logistics.driverType === 'hired_driver') {
      logistics.payoutRecipient = logistics.fleetOwner || null;
      logistics.payoutRecipientType = 'fleet_owner';
    } else {
      logistics.payoutRecipient = logistics.driver || null;
      logistics.payoutRecipientType = 'driver';
    }
>>>>>>> a4ca05ef18bdd6473e0d7b4cf68582b8dde40cd6

    // Notify the buyer that a driver has been assigned
    const order = await Order.findById(logistics.order);
    if (order) {
      const eta = logistics.estimatedDelivery
        ? logistics.estimatedDelivery.toLocaleDateString('en-KE', { timeZone: 'Africa/Nairobi' })
        : 'TBC';

      // Notify seller that pickup is imminent
      await dispatchSvc.dispatch({
        userIds : [logistics.seller],
        type    : 'push',
        channel : 'logistics',
        title   : `Driver assigned to your shipment`,
        body    : `${logistics.driverName} (${logistics.driverPhone}) will collect your cargo. ETA: ${eta}.`,
        data    : { shipmentId: logistics._id.toString(), driverName: logistics.driverName },
      });
    }

    return res.status(200).json({ success: true, message: 'Driver assigned.', data: logistics });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE — TRACKING INFO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Update tracking number, carrier, and estimated delivery date.
 * PUT /api/v1/logistics/:id/tracking
 */
exports.updateTracking = async (req, res, next) => {
  try {
    const { trackingNumber, carrier, estimatedDelivery } = req.body;

    const logistics = await Logistics.findById(req.params.id);
    if (!logistics) {
      return res.status(404).json({ success: false, message: 'Logistics record not found.' });
    }

    if (trackingNumber)   logistics.trackingNumber  = trackingNumber;
    if (carrier)          logistics.carrier         = carrier;
    if (estimatedDelivery) logistics.estimatedDelivery = new Date(estimatedDelivery);

    await logistics.save();

    return res.status(200).json({ success: true, message: 'Tracking information updated.', data: logistics });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// QR HANDSHAKE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Process a QR scan event (pickup or delivery step of the 3-way handshake).
 * POST /api/v1/logistics/:id/qr-scan
 *
 * Body: { step: 'pickup' | 'delivery', gpsCoords: { lat, lng } }
 */
exports.processQrScan = async (req, res, next) => {
  try {
    const { step, gpsCoords } = req.body;

    const logistics = await Logistics.findById(req.params.id)
      .populate('order')
      .populate('seller buyer driver', 'name phone');

    if (!logistics) {
      return res.status(404).json({ success: false, message: 'Logistics record not found.' });
    }

    await logistics.recordQrScan(step, req.user._id, gpsCoords);

    if (step === 'pickup') {
      await Order.findByIdAndUpdate(logistics.order._id || logistics.order, { status: 'dispatched' });

      // Notify seller that cargo is in transit
      await dispatchSvc.dispatch({
        userIds : [logistics.seller._id || logistics.seller],
        type    : 'logistics_pickup_confirmed',
        title   : 'Cargo pickup confirmed',
        body    : `${logistics.cargoType ?? 'Cargo'} is now in transit to ${logistics.shippingAddress.town}.`,
        data    : { shipmentId: logistics._id.toString(), status: 'in_transit' },
      });
    } else if (step === 'delivery') {
      await Order.findByIdAndUpdate(logistics.order._id || logistics.order, { status: 'delivered', deliveredAt: new Date() });

      await dispatchSvc.dispatch({
        userIds : [logistics.seller._id || logistics.seller, logistics.driver?._id || logistics.driver].filter(Boolean),
        type    : 'logistics_delivery_confirmed',
        title   : 'Delivery confirmed',
        body    : `${logistics.cargoType ?? 'Cargo'} was delivered and is ready for buyer confirmation.`,
        data    : { shipmentId: logistics._id.toString(), status: 'delivered' },
      });
    }

    return res.status(200).json({ success: true, message: `QR step "${step}" recorded.`, data: logistics });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// STATS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/logistics/stats/delivery
 */
exports.getDeliveryStats = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    const [byStatus, onTimeResult] = await Promise.all([
      Logistics.getDeliveryStats(startDate, endDate),
      Logistics.aggregate([
        {
          $match: {
            status            : 'delivered',
            actualDelivery    : { $exists: true },
            estimatedDelivery : { $exists: true },
          },
        },
        {
          $project: {
            onTime: { $lte: ['$actualDelivery', '$estimatedDelivery'] },
          },
        },
        {
          $group: {
            _id    : null,
            total  : { $sum: 1 },
            onTime : { $sum: { $cond: ['$onTime', 1, 0] } },
          },
        },
      ]),
    ]);

    const onTimeRate = onTimeResult[0]
      ? ((onTimeResult[0].onTime / onTimeResult[0].total) * 100).toFixed(1)
      : '0.0';

    return res.status(200).json({
      success : true,
      data    : {
        byStatus,
        onTimeDeliveryRate : parseFloat(onTimeRate),
        totalDelivered     : onTimeResult[0]?.total ?? 0,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// BULK
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Bulk status update (admin only).
 * POST /api/v1/logistics/bulk-update
 */
exports.bulkUpdateStatus = async (req, res, next) => {
  try {
    const { logisticsIds, status, notes } = req.body;

    const outcomes = await Promise.allSettled(
      logisticsIds.map(async (id) => {
        const logistics = await Logistics.findById(id);
        if (!logistics) return { id, success: false, error: 'Not found' };
        await logistics.updateStatus(status, { notes, updatedBy: req.user._id });
        return { id, success: true };
      })
    );

    const results   = outcomes.map((o) => (o.status === 'fulfilled' ? o.value : { success: false, error: o.reason?.message }));
    const succeeded = results.filter((r) => r.success).length;

    return res.status(200).json({
      success : true,
      message : `Updated ${succeeded} of ${logisticsIds.length} records.`,
      data    : results,
    });
  } catch (err) {
    next(err);
  }
};
