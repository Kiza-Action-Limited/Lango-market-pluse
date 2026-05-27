'use strict';

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
    const { orderId, carrier, pickupAddress, shippingAddress, weight, weightUnit, dimensions, cargoType, isExpress, notes } = req.body;

    const order = await Order.findById(orderId).populate('seller buyer');
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found.' });
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
      order           : orderId,
      orderNumber,
      seller          : order.seller._id,
      buyer           : order.buyer._id,
      carrier         : carrier ?? 'solo_owner_operator',
      pickupAddress   : normalizeAddress(pickupAddress),
      shippingAddress : normalizeAddress(shippingAddress, orderDeliveryAddress),
      weight,
      weightUnit,
      dimensions,
      cargoType,
      isExpress       : isExpress ?? false,
      notes,
      status          : 'pending',
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

    const [records, total, stats] = await Promise.all([
      Logistics.find(query)
        .populate('order', 'orderNumber total')
        .populate('seller',  'name phone')
        .populate('buyer',   'name phone')
        .populate('driver',  'name phone')
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

      logistics.driver      = driverId;
      logistics.driverName  = driver.name;
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

    await logistics.updateStatus('driver_assigned', { updatedBy: req.user._id });

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
