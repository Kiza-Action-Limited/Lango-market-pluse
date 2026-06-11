const QRToken = require('../models/QRToken.model');
const Order = require('../models/Order.model');
const Logistics = require('../models/Logistics.model');
const QRCode = require('qrcode');
const { validationResult } = require('express-validator');

/**
 * Generate QR token for order pickup/delivery
 * POST /api/v1/qr-tokens/generate
 */
exports.generateQRToken = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { orderId, logisticsId, type } = req.body;

    // Verify order exists and user has access
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Verify logistics exists
    const logistics = await Logistics.findById(logisticsId);
    if (!logistics) {
      return res.status(404).json({ success: false, message: 'Logistics provider not found' });
    }

    // Check for existing unused token
    const existingToken = await QRToken.findOne({
      order: orderId,
      type,
      isUsed: false,
      expiresAt: { $gt: new Date() },
    });

    if (existingToken) {
      return res.status(200).json({
        success: true,
        message: 'Using existing token',
        data: existingToken,
      });
    }

    // Generate unique token
    const token = `${type}-${orderId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Generate QR code
    const qrImage = await QRCode.toDataURL(token);

    // Create expiry (24 hours from now)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const qrToken = await QRToken.create({
      token,
      type,
      order: orderId,
      logistics: logisticsId,
      holder: req.user.id,
      qrImage,
      expiresAt,
    });

    res.status(201).json({
      success: true,
      message: 'QR token generated successfully',
      data: qrToken,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Scan QR token for pickup/delivery
 * POST /api/v1/qr-tokens/scan
 */
exports.scanQRToken = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { token, gpsLat, gpsLng } = req.body;

    // Find token
    const qrToken = await QRToken.findOne({ token })
      .populate('order')
      .populate('logistics');

    if (!qrToken) {
      return res.status(404).json({ success: false, message: 'Invalid or expired QR token' });
    }

    // Check if already used
    if (qrToken.isUsed) {
      return res.status(400).json({ success: false, message: 'QR token already used' });
    }

    // Check if expired
    if (new Date() > qrToken.expiresAt) {
      return res.status(400).json({ success: false, message: 'QR token expired' });
    }

    // Verify driver belongs to the logistics provider
    const driver = await Logistics.findById(qrToken.logistics);
    if (driver.driver.toString() !== req.user.id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized to scan this token' });
    }

    // Calculate distance from location (if GPS provided)
    let distanceMeters = 0;
    if (gpsLat && gpsLng && qrToken.order.pickupLocation) {
      const lat1 = qrToken.order.pickupLocation.coordinates[1];
      const lon1 = qrToken.order.pickupLocation.coordinates[0];
      distanceMeters = calculateDistance(lat1, lon1, gpsLat, gpsLng);
    }

    // Mark as used
    qrToken.isUsed = true;
    qrToken.usedAt = new Date();
    qrToken.scannedBy = req.user.id;
    qrToken.gpsAtScan = {
      lat: gpsLat,
      lng: gpsLng,
      distanceMeters,
    };
    await qrToken.save();

    // Update order status based on QR type
    if (qrToken.type === 'PICKUP') {
      qrToken.order.status = 'in_transit';
      qrToken.order.pickedUpAt = new Date();
    } else if (qrToken.type === 'DELIVERY') {
      qrToken.order.status = 'delivered';
      qrToken.order.deliveredAt = new Date();
    }
    await qrToken.order.save();

    res.status(200).json({
      success: true,
      message: `Order ${qrToken.type === 'PICKUP' ? 'picked up' : 'delivered'} successfully`,
      data: qrToken,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get QR token details
 * GET /api/v1/qr-tokens/:id
 */
exports.getQRToken = async (req, res, next) => {
  try {
    const { id } = req.params;

    const qrToken = await QRToken.findById(id)
      .populate('order')
      .populate('logistics')
      .populate('holder', 'name phone');

    if (!qrToken) {
      return res.status(404).json({ success: false, message: 'QR token not found' });
    }

    res.status(200).json({
      success: true,
      data: qrToken,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * List QR tokens for order
 * GET /api/v1/qr-tokens/order/:orderId
 */
exports.listOrderQRTokens = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const skip = (page - 1) * limit;

    const [tokens, total] = await Promise.all([
      QRToken.find({ order: orderId })
        .populate('logistics', 'name phone')
        .populate('scannedBy', 'name phone')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 }),
      QRToken.countDocuments({ order: orderId }),
    ]);

    res.status(200).json({
      success: true,
      data: tokens,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Resend QR token (for expired tokens)
 * POST /api/v1/qr-tokens/:id/resend
 */
exports.resendQRToken = async (req, res, next) => {
  try {
    const { id } = req.params;

    const oldToken = await QRToken.findById(id);
    if (!oldToken) {
      return res.status(404).json({ success: false, message: 'QR token not found' });
    }

    // Generate new token
    const newToken = `${oldToken.type}-${oldToken.order}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const qrImage = await QRCode.toDataURL(newToken);

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const qrToken = await QRToken.create({
      token: newToken,
      type: oldToken.type,
      order: oldToken.order,
      logistics: oldToken.logistics,
      holder: req.user.id,
      qrImage,
      expiresAt,
    });

    res.status(201).json({
      success: true,
      message: 'New QR token generated',
      data: qrToken,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get statistics for QR token usage
 * GET /api/v1/qr-tokens/stats
 */
exports.getQRStats = async (req, res, next) => {
  try {
    const { startDate, endDate, logisticsId } = req.query;

    const matchStage = {};
    if (startDate || endDate) {
      matchStage.createdAt = {};
      if (startDate) matchStage.createdAt.$gte = new Date(startDate);
      if (endDate) matchStage.createdAt.$lte = new Date(endDate);
    }
    if (logisticsId) matchStage.logistics = require('mongoose').Types.ObjectId(logisticsId);

    const stats = await QRToken.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$type',
          total: { $sum: 1 },
          used: { $sum: { $cond: ['$isUsed', 1, 0] } },
          unused: { $sum: { $cond: ['$isUsed', 0, 1] } },
          averageDistance: { $avg: '$gpsAtScan.distanceMeters' },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Helper function to calculate distance between two GPS coordinates (Haversine formula)
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth's radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in meters
}
