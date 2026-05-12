const Product = require('../../models/Product.model');
const ScarcityAlert = require('../../models/ScarcityAlert.model');
const { smsQueue } = require('../../config/redis');
const logger = require('../../utils/logger');

class ThresholdService {
  /**
   * Monitor products and trigger alerts when stock falls below threshold
   */
  async monitorAndAlert() {
    const lowStockProducts = await Product.find({
      quantityAvailable: { $lte: 20 },
      isPublished: true,
    }).populate('seller');

    for (const product of lowStockProducts) {
      const severity = product.quantityAvailable <= 5 ? 'critical' : 'low';
      await this.createAlert(product, severity);
    }
  }

  async createAlert(product, severity) {
    // Check if unresolved alert already exists
    const existing = await ScarcityAlert.findOne({
      product: product._id,
      resolvedAt: null,
    });
    if (existing) return;

    const alert = await ScarcityAlert.create({
      product: product._id,
      threshold: product.quantityAvailable,
      severity,
      triggeredAt: new Date(),
    });

    // Notify seller
    await smsQueue.add('send', {
      to: product.seller.phone,
      message: `Scarcity alert: ${product.name} stock is ${severity} (${product.quantityAvailable} left). Restock soon!`,
    });

    // For V4 users, also send to subscribers
    // await this.notifySubscribers(product, alert);

    return alert;
  }

  async resolveAlert(productId) {
    const alert = await ScarcityAlert.findOneAndUpdate(
      { product: productId, resolvedAt: null },
      { resolvedAt: new Date() },
      { new: true }
    );
    return alert;
  }

  /**
   * Predict restock date based on historical sales velocity
   */
  async predictRestockDate(productId, currentStock) {
    // Call Python microservice for prediction
    const { predictionClient } = require('../intelligence/predictionClient');
    const prediction = await predictionClient.predictRestock(productId, currentStock);
    return prediction.estimatedRestockDate;
  }
}

module.exports = new ThresholdService();