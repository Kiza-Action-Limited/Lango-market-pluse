const crypto = require('crypto');
const QRToken = require('../../models/QRToken.model');
const { generateQR } = require('../../utils/qrGenerator');
const { distanceBetween } = require('../../utils/geofence');

class QRChainService {
  normalizeToken(rawToken) {
    if (rawToken && typeof rawToken === 'object') {
      return rawToken.token || rawToken.qrPayload || '';
    }

    const token = String(rawToken || '').trim();
    if (!token) return '';

    try {
      const parsed = JSON.parse(token);
      return parsed?.token || token;
    } catch {
      return token;
    }
  }

  async generateTripTokens(logistics) {
    const pickupToken = await this.createToken(logistics, 'PICKUP', logistics.seller);
    const deliveryToken = await this.createToken(logistics, 'DELIVERY', logistics.driver);
    return { pickupToken, deliveryToken };
  }

  async createToken(logistics, type, holder) {
    const token = crypto.randomUUID();
    const payload = {
      token,
      type,
      orderId: logistics.order.toString(),
      logisticsId: logistics._id.toString(),
    };

    return QRToken.create({
      token,
      type,
      order: logistics.order,
      logistics: logistics._id,
      holder,
      qrImage: await generateQR(payload),
    });
  }

  async consumeToken({ token, type, logisticsId, scannedBy, gpsCoords, buyerFence, skipGpsValidation = false }) {
    const normalizedToken = this.normalizeToken(token);
    const qrToken = await QRToken.findOne({ token: normalizedToken });

    if (!qrToken) {
      const error = new Error('QR token was not found. Generate a fresh QR token for this shipment and try again.');
      error.code = 'QR_TOKEN_NOT_FOUND';
      throw error;
    }

    if (qrToken.logistics.toString() !== logisticsId.toString()) {
      const error = new Error('QR token belongs to a different logistics shipment.');
      error.code = 'QR_TOKEN_WRONG_LOGISTICS';
      error.details = {
        expectedLogisticsId: logisticsId.toString(),
        actualLogisticsId: qrToken.logistics.toString(),
      };
      throw error;
    }

    if (qrToken.type !== type) {
      const error = new Error(`QR token is for ${qrToken.type}, but this scan expects ${type}.`);
      error.code = 'QR_TOKEN_WRONG_TYPE';
      error.details = { expectedType: type, actualType: qrToken.type };
      throw error;
    }

    if (qrToken.isUsed) {
      const error = new Error(`QR token was already used${qrToken.usedAt ? ` at ${qrToken.usedAt.toISOString()}` : ''}.`);
      error.code = 'QR_TOKEN_ALREADY_USED';
      error.details = {
        usedAt: qrToken.usedAt,
        scannedBy: qrToken.scannedBy,
      };
      throw error;
    }

    if (qrToken.expiresAt && qrToken.expiresAt <= new Date()) {
      const error = new Error(`QR token expired at ${qrToken.expiresAt.toISOString()}.`);
      error.code = 'QR_TOKEN_EXPIRED';
      error.details = { expiresAt: qrToken.expiresAt };
      throw error;
    }

    const updatedToken = await QRToken.findOneAndUpdate(
      {
        _id: qrToken._id,
        type,
        logistics: logisticsId,
        isUsed: false,
        $or: [{ expiresAt: { $exists: false } }, { expiresAt: { $gt: new Date() } }],
      },
      {
        $set: {
          isUsed: true,
          usedAt: new Date(),
          scannedBy,
          gpsAtScan: {
            lat: gpsCoords?.lat,
            lng: gpsCoords?.lng,
          },
        },
      },
      { returnDocument: 'after' }
    );

    if (!updatedToken) {
      const error = new Error('QR token could not be consumed. It may have just been used by another scan.');
      error.code = 'QR_TOKEN_CONSUME_RACE';
      throw error;
    }

    // Skip GPS validation if requested or for pickup scans
    if (type === 'DELIVERY' && !skipGpsValidation) {
      try {
        const distanceMeters = this.assertDeliveryFence(gpsCoords, buyerFence);
        updatedToken.gpsAtScan.distanceMeters = distanceMeters;
        await updatedToken.save();
      } catch (error) {
        console.warn('GPS validation failed but continuing:', error.message);
        // Don't throw error, just log warning
      }
    }

    return updatedToken;
  }

  assertDeliveryFence(gpsCoords, buyerFence) {
    // Make GPS validation optional - return 0 if missing
    if (!gpsCoords?.lat || !gpsCoords?.lng || !buyerFence?.lat || !buyerFence?.lng) {
      console.warn('Missing GPS coordinates - skipping fence validation');
      return 0; // Return 0 meters distance as fallback
    }

    const distanceKm = distanceBetween(
      Number(gpsCoords.lat),
      Number(gpsCoords.lng),
      Number(buyerFence.lat),
      Number(buyerFence.lng)
    );
    const distanceMeters = Math.round(distanceKm * 1000);

    // Only throw error if we have coordinates and they're too far
    if (distanceMeters > 50) {
      throw new Error(`Must be within 50m. Currently ${distanceMeters}m away.`);
    }

    return distanceMeters;
  }
}

module.exports = new QRChainService();
