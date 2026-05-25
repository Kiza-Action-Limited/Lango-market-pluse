const Logistics = require('../models/Logistics.model');
const Order     = require('../models/Order.model');
const User      = require('../models/User.model');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const notFound = (res, msg = 'Logistics record not found') =>
  res.status(404).json({ success: false, message: msg });

const extractGps = (body) => ({
  lat: parseFloat(body.lat  ?? body.latitude  ?? 0),
  lng: parseFloat(body.lng  ?? body.longitude ?? 0)
});

// ─── Create ───────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/logistics
 * Creates a new logistics record for an order and returns the Seller QR code
 * that the driver must scan at pickup (Step 1).
 */
exports.createLogistics = async (req, res, next) => {
  try {
    const {
      orderId, driverType = 'owner_operator',
      shippingAddress, weight, dimensions, notes,
      escrowAmount, commissionRate
    } = req.body;

    const order = await Order.findById(orderId);
    if (!order) return notFound(res, 'Order not found');

    const existing = await Logistics.findOne({ order: orderId });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Logistics record already exists for this order' });
    }

    const logistics = new Logistics({
      order:           orderId,
      orderNumber:     order.orderNumber,
      driverType,
      shippingAddress: shippingAddress || order.shippingAddress,
      weight,
      dimensions,
      notes,
      status:          'pending',
      escrow: {
        totalAmount:          escrowAmount || order.total || 0,
        platformCommissionRate: commissionRate || 0.075
      }
    });

    await logistics.save(); // pre-save generates sellerQrCode

    res.status(201).json({
      success: true,
      message: 'Logistics record created. Share sellerQrCode with seller for driver to scan at pickup.',
      data: {
        _id:          logistics._id,
        orderNumber:  logistics.orderNumber,
        status:       logistics.status,
        sellerQrCode: logistics.sellerQrCode,
        escrow:       logistics.escrow
      }
    });
  } catch (err) {
    next(err);
  }
};

// ─── QR Handshake Endpoints ───────────────────────────────────────────────────

/**
 * POST /api/v1/logistics/:id/scan/pickup
 * Step 1 — Driver scans Seller's QR.
 * Body: { qrPayload, lat, lng }
 * Marks status IN_TRANSIT, notifies seller, returns Driver QR for buyer.
 */
exports.scanPickup = async (req, res, next) => {
  try {
    const { qrPayload } = req.body;
    const logistics = await Logistics.findById(req.params.id);
    if (!logistics) return notFound(res);

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

exports.getAllLogistics = async (req, res, next) => {
  try {
    const { status, driverType, driver, startDate, endDate, page = 1, limit = 20 } = req.query;
    const q = {};

    if (status     && status     !== 'all') q.status     = status;
    if (driverType && driverType !== 'all') q.driverType = driverType;
    if (driver) q.driver = driver;

    if (startDate || endDate) {
      q.createdAt = {};
      if (startDate) q.createdAt.$gte = new Date(startDate);
      if (endDate)   q.createdAt.$lte = new Date(endDate);
    }

    const [logistics, total, stats] = await Promise.all([
      Logistics.find(q)
        .populate('order', 'orderNumber total customer')
        .populate('driver', 'name email phone')
        .sort('-createdAt')
        .skip((page - 1) * limit)
        .limit(parseInt(limit)),
      Logistics.countDocuments(q),
      Logistics.getDeliveryStats(startDate, endDate)
    ]);

    res.status(200).json({
      success: true,
      data: logistics,
      stats,
      pagination: {
        page:  parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.getLogisticsById = async (req, res, next) => {
  try {
    const logistics = await Logistics.findById(req.params.id)
      .populate('order')
      .populate('driver', 'name email phone');
    if (!logistics) return notFound(res);
    res.status(200).json({ success: true, data: logistics });
  } catch (err) {
    next(err);
  }
};

exports.getLogisticsByOrder = async (req, res, next) => {
  try {
    const logistics = await Logistics.findOne({ order: req.params.orderId })
      .populate('order')
      .populate('driver', 'name email phone');
    if (!logistics) return notFound(res, 'No logistics record for this order');
    res.status(200).json({ success: true, data: logistics });
  } catch (err) {
    next(err);
  }
};

// ─── Driver Assignment ────────────────────────────────────────────────────────

/**
 * PUT /api/v1/logistics/:id/assign-driver
 * Body: { driverId?, driverName?, driverPhone?, driverType? }
 */
exports.assignDriver = async (req, res, next) => {
  try {
    const { driverId, driverName, driverPhone, driverType } = req.body;
    const logistics = await Logistics.findById(req.params.id);
    if (!logistics) return notFound(res);

    if (driverId) {
      const driver = await User.findById(driverId);
      if (!driver || driver.role !== 'logistics') {
        return res.status(400).json({ success: false, message: 'User not found or does not have logistics role' });
      }
      logistics.driver      = driverId;
      logistics.driverName  = driver.name;
      logistics.driverPhone = driver.phone;
    } else {
      logistics.driverName  = driverName;
      logistics.driverPhone = driverPhone;
    }

    if (driverType) logistics.driverType = driverType;

    await logistics.save();
    res.status(200).json({ success: true, message: 'Driver assigned', data: logistics });
  } catch (err) {
    next(err);
  }
};

// ─── Delivery Stats ───────────────────────────────────────────────────────────

exports.getDeliveryStats = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const [byStatus, onTimeRaw] = await Promise.all([
      Logistics.getDeliveryStats(startDate, endDate),
      Logistics.aggregate([
        {
          $match: {
            status: 'delivered',
            actualDelivery:   { $exists: true },
            estimatedDelivery: { $exists: true }
          }
        },
        {
          $project: {
            onTime: { $lte: ['$actualDelivery', '$estimatedDelivery'] }
          }
        },
        {
          $group: {
            _id:    null,
            total:  { $sum: 1 },
            onTime: { $sum: { $cond: ['$onTime', 1, 0] } }
          }
        }
      ])
    ]);

    const onTimeRate = onTimeRaw[0] ? (onTimeRaw[0].onTime / onTimeRaw[0].total) * 100 : 0;

    res.status(200).json({
      success: true,
      data: {
        byStatus,
        onTimeDeliveryRate: parseFloat(onTimeRate.toFixed(1)),
        totalDelivered:     onTimeRaw[0]?.total || 0
      }
    });
  } catch (err) {
    next(err);
  }
};

// ─── Bulk Update ──────────────────────────────────────────────────────────────

exports.bulkUpdateStatus = async (req, res, next) => {
  try {
    const { logisticsIds, status, notes } = req.body;

    const updates = await Promise.all(
      logisticsIds.map(async (id) => {
        const logistics = await Logistics.findById(id);
        if (!logistics) return { id, success: false, error: 'Not found' };
        await logistics.updateStatus(status, null, notes, req.user._id);
        return { id, success: true };
      })
    );

    const succeeded = updates.filter(u => u.success).length;
    res.status(200).json({
      success: true,
      message: `Updated ${succeeded} of ${logisticsIds.length} records`,
      data: updates
    });
  } catch (err) {
    next(err);
  }
};