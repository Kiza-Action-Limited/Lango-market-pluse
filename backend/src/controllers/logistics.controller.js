'use strict';

/**
 * Lango MarketPulse — Logistics Controller
 * Kakuma–Kitale Corridor | Plan 4 "Mizigo"
 */

const Logistics = require('../models/Logistics.model');
const Order = require('../models/Order.model');
const User = require('../models/User.model');
const { uploadToCloudinary } = require('../config/cloudinary.config');
const { validationResult } = require('express-validator');
const dispatchSvc = require('../services/notification/dispatch.service');
const qrChainSvc = require('../services/order/qrChain.service');
const escrowService = require('../services/order/escrow.service');
const QRToken = require('../models/QRToken.model');
const logger = require('../utils/logger');

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

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
// CREATE
// ─────────────────────────────────────────────────────────────────────────────

exports.createLogistics = async (req, res, next) => {
  try {
    const { orderId, carrier, pickupAddress, shippingAddress, weight, weightUnit, dimensions, cargoType, isExpress, notes } = req.body;

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

    const logistics = await Logistics.create({
      order: orderId,
      orderNumber,
      seller: order.seller._id,
      buyer: order.buyer._id,
      carrier: carrier ?? 'solo_owner_operator',
      pickupAddress: normalizeAddress(pickupAddress),
      shippingAddress: normalizeAddress(shippingAddress, orderDeliveryAddress),
      weight,
      weightUnit,
      dimensions,
      cargoType,
      isExpress: isExpress ?? false,
      notes,
      status: 'pending',
    });

    const qrTokens = await qrChainSvc.generateTripTokens(logistics);

    return res.status(201).json({
      success: true,
      message: 'Logistics record created.',
      data: {
        logistics,
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
    const { status, carrier, driverId, startDate, endDate, page = 1, limit = 20 } = req.query;
    const query = {};

    if (status && status !== 'all') query.status = status;
    if (carrier && carrier !== 'all') query.carrier = carrier;
    if (driverId) query.driver = driverId;

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const [records, total, stats] = await Promise.all([
      Logistics.find(query)
        .populate('order', 'orderNumber total')
        .populate('seller', 'name phone')
        .populate('buyer', 'name phone')
        .populate('driver', 'name phone')
        .sort('-createdAt')
        .skip((page - 1) * limit)
        .limit(parseInt(limit, 10)),
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
      .populate('seller buyer driver fleetOwner', 'name phone email');

    if (!logistics) {
      return res.status(404).json({ success: false, message: 'Logistics record not found.' });
    }

    return res.status(200).json({ success: true, data: logistics });
  } catch (err) {
    next(err);
  }
};

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

exports.updateLogisticsStatus = async (req, res, next) => {
  try {
    const { status, location, notes, gpsCoords } = req.body;

    const logistics = await Logistics.findById(req.params.id);
    if (!logistics) {
      return res.status(404).json({ success: false, message: 'Logistics record not found.' });
    }

    await logistics.updateStatus(status, { location, notes, gpsCoords, updatedBy: req.user._id });

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

exports.assignDriver = async (req, res, next) => {
  try {
    const { driverId, driverName, driverPhone } = req.body;

    const logistics = await Logistics.findById(req.params.id);
    if (!logistics) {
      return res.status(404).json({ success: false, message: 'Logistics record not found.' });
    }

    if (driverId) {
      const driver = await User.findById(driverId);
      if (!driver || driver.role !== 'logistics') {
        return res.status(400).json({ success: false, message: 'User is not a registered logistics driver.' });
      }

      logistics.driver = driverId;
      logistics.driverName = driver.name;
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
        { $set: { holder: driverId } }
      );
    } else {
      logistics.driverName = driverName;
      logistics.driverPhone = driverPhone;
      logistics.carrier = 'third_party';
    }

    await logistics.updateStatus('driver_assigned', { updatedBy: req.user._id });

    const order = await Order.findById(logistics.order);
    if (order) {
      const eta = logistics.estimatedDelivery
        ? logistics.estimatedDelivery.toLocaleDateString('en-KE', { timeZone: 'Africa/Nairobi' })
        : 'TBC';

      await dispatchSvc.dispatch({
        userIds: [logistics.seller],
        channels: ['push'],
        title: `Driver assigned to your shipment`,
        body: `${logistics.driverName} (${logistics.driverPhone}) will collect your cargo. ETA: ${eta}.`,
        data: { shipmentId: logistics._id.toString(), driverName: logistics.driverName },
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
// QR TOKEN MANAGEMENT (FIXED - WITH DELETE EXISTING TOKENS)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate QR tokens for existing logistics record
 * POST /api/v1/logistics/:id/generate-qr-tokens
 */
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

    // Check if user has permission
    const userId = req.user._id || req.user.id;
    const isSeller = logistics.seller.toString() === userId.toString();
    const isAdmin = req.user.role === 'admin';
    
    if (!isSeller && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only the seller or admin can generate QR tokens.'
      });
    }

    // CRITICAL FIX: Delete existing QR tokens to avoid duplicate key error
    const deletedResult = await QRToken.deleteMany({ logistics: logistics._id });
    logger.info(`Deleted ${deletedResult.deletedCount} existing QR tokens for logistics ${id}`);

    // Reset QR confirmation flags
    logistics.pickupQrConfirmed = false;
    logistics.deliveryQrConfirmed = false;
    logistics.pickupQrScannedAt = null;
    logistics.deliveryQrScannedAt = null;
    logistics.pickupQrScannedBy = null;
    logistics.deliveryQrScannedBy = null;
    logistics.pickupQrToken = null;
    logistics.deliveryQrToken = null;
    await logistics.save();

    // Generate new QR tokens
    const qrTokens = await qrChainSvc.generateTripTokens(logistics);

    // Update logistics with QR token references
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
    
    // Handle duplicate key error specifically
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

/**
 * Get QR tokens for a logistics record
 * GET /api/v1/logistics/:id/qr-tokens
 */
exports.getQrTokens = async (req, res, next) => {
  try {
    const logistics = await Logistics.findById(req.params.id);
    
    if (!logistics) {
      return res.status(404).json({ 
        success: false, 
        message: 'Logistics record not found.' 
      });
    }

    // Check authorization
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

    // Find QR tokens from database
    const qrTokens = await QRToken.find({
      logistics: logistics._id,
      isUsed: false,
      expiresAt: { $gt: new Date() }
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
// QR HANDSHAKE (IMPROVED VERSION)
// ─────────────────────────────────────────────────────────────────────────────

exports.processQrScan = async (req, res, next) => {
  try {
    const { step, token, gpsCoords } = req.body;

    // Validate required fields
    if (!step) {
      return res.status(400).json({ 
        success: false, 
        message: 'Validation failed',
        errors: [{ 
          message: 'step is required. Must be "pickup" or "delivery".' 
        }]
      });
    }

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

    if (!['pickup', 'delivery'].includes(step)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Validation failed',
        errors: [{ 
          message: 'step must be either "pickup" or "delivery".' 
        }]
      });
    }

    const logistics = await Logistics.findById(req.params.id)
      .populate('order')
      .populate('seller buyer driver fleetOwner', 'fullName name phone location role');

    if (!logistics) {
      return res.status(404).json({ 
        success: false, 
        message: 'Logistics record not found.',
        errors: [{ message: `No logistics record found with ID: ${req.params.id}` }]
      });
    }

    // Check if this step has already been confirmed
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

    // Check authorization - only driver or admin can scan
    const userId = req.user._id || req.user.id;
    const userRole = req.user.role;
    
    const isDriver = logistics.driver && logistics.driver._id.toString() === userId.toString();
    const isAdmin = userRole === 'admin';
    
    if (!isDriver && !isAdmin) {
      return res.status(403).json({ 
        success: false, 
        message: 'Not authorized',
        errors: [{ 
          message: 'Only the assigned driver or admin can scan QR codes.',
          details: {
            userId: userId.toString(),
            driverId: logistics.driver?._id?.toString(),
            role: userRole
          }
        }]
      });
    }

    // Verify QR token
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
      logger.error('QR verification failed:', qrError);
      
      let errorMessage = 'QR verification failed';
      if (qrError.message.includes('expired')) {
        errorMessage = 'QR token has expired. Please generate new QR tokens.';
      } else if (qrError.message.includes('already used')) {
        errorMessage = 'QR token has already been used. Each QR code can only be used once.';
      } else if (qrError.message.includes('invalid')) {
        errorMessage = 'Invalid QR token. Please check the token and try again.';
      }
      
      return res.status(400).json({ 
        success: false, 
        message: errorMessage,
        errors: [{ message: qrError.message }]
      });
    }

    // Mark QR as confirmed in logistics
    if (step === 'pickup') {
      logistics.pickupQrConfirmed = true;
      logistics.pickupQrScannedAt = new Date();
      logistics.pickupQrScannedBy = userId;
    } else {
      logistics.deliveryQrConfirmed = true;
      logistics.deliveryQrScannedAt = new Date();
      logistics.deliveryQrScannedBy = userId;
    }

    // Record the QR scan in logistics history
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

    // Handle business logic based on step
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
          channels: ['push', 'email'],
          title: 'Cargo pickup confirmed',
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

      const recipients = [];
      if (logistics.seller) recipients.push(logistics.seller._id || logistics.seller);
      if (logistics.buyer) recipients.push(logistics.buyer._id || logistics.buyer);
      
      if (dispatchSvc && recipients.length > 0) {
        await dispatchSvc.dispatch({
          userIds: recipients,
          channels: ['push', 'email'],
          title: 'Delivery confirmed',
          body: `${logistics.cargoType || 'Cargo'} has been delivered successfully.`,
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
        timestamp: new Date().toISOString()
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

    return res.status(200).json({
      success: true,
      data: {
        byStatus: statusMap,
        onTimeDeliveryRate: parseFloat(onTimeRate),
        totalDelivered,
        totalOnTime: onTimeCount,
        totalLate: totalDelivered - onTimeCount,
      },
    });
  } catch (err) {
    logger.error('Error getting delivery stats:', err);
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