const QRToken = require('../../models/QRToken.model');
const Order = require('../../models/Order.model');

class QRTokenService {
  async generateToken(orderId, logisticsId, type, req) {
    // Check for existing valid token
    const existingToken = await QRToken.findOne({
      order: orderId,
      type,
      isUsed: false,
      expiresAt: { $gt: new Date() },
    });

    if (existingToken) {
      return existingToken;
    }

    // Generate new token
    const token = `${type}-${orderId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    return QRToken.create({
      token,
      type,
      order: orderId,
      logistics: logisticsId,
      holder: req.user.id,
      expiresAt,
    });
  }

  async markTokenAsUsed(token, scannedBy, gpsData) {
    const qrToken = await QRToken.findOne({ token });
    
    if (!qrToken) {
      throw new Error('Token not found');
    }

    if (qrToken.isUsed) {
      throw new Error('Token already used');
    }

    if (new Date() > qrToken.expiresAt) {
      throw new Error('Token expired');
    }

    qrToken.isUsed = true;
    qrToken.usedAt = new Date();
    qrToken.scannedBy = scannedBy;
    
    if (gpsData) {
      qrToken.gpsAtScan = {
        lat: gpsData.lat,
        lng: gpsData.lng,
        distanceMeters: gpsData.distanceMeters || 0,
      };
    }

    await qrToken.save();
    return qrToken;
  }

  async getTokensByOrder(orderId) {
    return QRToken.find({ order: orderId })
      .populate('logistics')
      .populate('scannedBy', 'name phone')
      .sort({ createdAt: -1 });
  }

  async expireOldTokens() {
    return QRToken.updateMany(
      {
        isUsed: false,
        expiresAt: { $lt: new Date() },
      },
      {
        isUsed: true,
        usedAt: new Date(),
      }
    );
  }

  async getQRStats(filters = {}) {
    const matchStage = {};
    if (filters.startDate || filters.endDate) {
      matchStage.createdAt = {};
      if (filters.startDate) matchStage.createdAt.$gte = new Date(filters.startDate);
      if (filters.endDate) matchStage.createdAt.$lte = new Date(filters.endDate);
    }
    if (filters.logisticsId) {
      matchStage.logistics = require('mongoose').Types.ObjectId(filters.logisticsId);
    }

    return QRToken.aggregate([
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
  }
}

module.exports = new QRTokenService();
