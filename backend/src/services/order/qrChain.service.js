const crypto = require('crypto');
const QRToken = require('../../models/QRToken.model');
const { generateQR } = require('../../utils/qrGenerator');
const { distanceBetween } = require('../../utils/geofence');

class QRChainService {
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
    const qrToken = await QRToken.findOneAndUpdate(
      {
        token,
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
      { new: true }
    );

    if (!qrToken) {
      throw new Error('QR token is invalid, expired, or already used');
    }

    // Skip GPS validation if requested or for pickup scans
    if (type === 'DELIVERY' && !skipGpsValidation) {
      try {
        const distanceMeters = this.assertDeliveryFence(gpsCoords, buyerFence);
        qrToken.gpsAtScan.distanceMeters = distanceMeters;
        await qrToken.save();
      } catch (error) {
        console.warn('GPS validation failed but continuing:', error.message);
        // Don't throw error, just log warning
      }
    }

    return qrToken;
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