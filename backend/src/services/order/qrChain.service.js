const QRCode = require('qrcode');
const crypto = require('crypto');
const Order = require('../../models/Order.model');

class QRChainService {
  /**
   * Generate QR code for product custody chain
   */
  async generateQRCode(orderId, productId, batchNumber) {
    const payload = {
      orderId,
      productId,
      batchNumber,
      timestamp: Date.now(),
      hash: this.generateHash(orderId, productId, batchNumber),
    };
    const qrDataUrl = await QRCode.toDataURL(JSON.stringify(payload));
    return qrDataUrl;
  }

  generateHash(orderId, productId, batchNumber) {
    const data = `${orderId}-${productId}-${batchNumber}-${process.env.QR_SECRET}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Verify QR code authenticity
   */
  verifyQRCode(qrData) {
    const payload = JSON.parse(qrData);
    const expectedHash = this.generateHash(payload.orderId, payload.productId, payload.batchNumber);
    return payload.hash === expectedHash;
  }

  /**
   * Update custody chain (when product changes hands)
   */
  async updateCustody(orderId, newCustodian, location) {
    const order = await Order.findById(orderId);
    if (!order) throw new Error('Order not found');

    // Append to custody chain (store in metadata or separate collection)
    const custodyEntry = {
      custodian: newCustodian,
      location,
      timestamp: new Date(),
    };
    order.qrChain = JSON.stringify(custodyEntry); // Simplified
    await order.save();
    return order;
  }
}

module.exports = new QRChainService();