const Product = require('../../models/Product.model');
const ScarcityAlert = require('../../models/ScarcityAlert.model');
const { smsQueue } = require('../../config/redis');
const logger = require('../../utils/logger');

const LOW_STOCK_SENSITIVITY_RULES = [
  { threshold: 50, terms: ['maize', 'corn', 'unga', 'posho', 'grains-cereals', 'food-staples'] },
  { threshold: 45, terms: ['sugar', 'jaggery', 'sugar-baking'] },
  { threshold: 40, terms: ['rice', 'beans', 'wheat', 'flour', 'millet', 'sorghum'] },
  { threshold: 25, terms: ['cooking oil', 'oil', 'cooking-oil'] },
  { threshold: 20, terms: ['milk', 'dairy', 'eggs', 'dairy-eggs'] },
  { threshold: 18, terms: ['vegetables', 'tomato', 'onion', 'potato', 'cabbage', 'fresh'] },
  { threshold: 15, terms: ['beverage', 'water', 'juice', 'soda', 'beverages'] },
  { threshold: 12, terms: ['household', 'soap', 'detergent', 'tissue'] },
  { threshold: 10, terms: ['farm-inputs', 'seed', 'fertilizer', 'feed'] },
];

const getAutoLowStockThreshold = (product = {}) => {
  const haystack = `${product.name || ''} ${product.category || ''}`.toLowerCase();
  const matchedRule = LOW_STOCK_SENSITIVITY_RULES.find((rule) => (
    rule.terms.some((term) => haystack.includes(term))
  ));

  return matchedRule?.threshold || 10;
};

const getEffectiveLowStockThreshold = (product = {}) => {
  const configured = Number(product.minThreshold);
  if (Number.isFinite(configured) && configured === 0) return 0;
  const autoThreshold = getAutoLowStockThreshold(product);
  if (!Number.isFinite(configured) || configured < 0) return autoThreshold;
  return Math.max(configured, autoThreshold);
};

class ThresholdService {
  /**
   * Monitor products and trigger alerts when stock falls below threshold
   */
  async monitorAndAlert() {
    const candidates = await Product.find({
      quantityAvailable: { $gt: 0 },
      isPublished: true,
    }).populate('seller');
    const lowStockProducts = candidates.filter((product) => {
      const threshold = getEffectiveLowStockThreshold(product);
      return threshold > 0 && Number(product.quantityAvailable || 0) <= threshold;
    });

    for (const product of lowStockProducts) {
      const threshold = getEffectiveLowStockThreshold(product);
      const severity = product.quantityAvailable <= Math.max(1, Math.ceil(threshold / 2)) ? 'critical' : 'low';
      await this.createAlert(product, severity, threshold);
    }
  }

  async createAlert(product, severity, effectiveThreshold = getEffectiveLowStockThreshold(product)) {
    // Check if unresolved alert already exists
    const existing = await ScarcityAlert.findOne({
      product: product._id,
      resolvedAt: null,
    });
    if (existing) return;

    const alert = await ScarcityAlert.create({
      product: product._id,
      threshold: effectiveThreshold,
      severity,
      triggeredAt: new Date(),
    });

    // Notify seller
    await smsQueue.add('send', {
      to: product.seller.phone,
      message: `Scarcity alert: ${product.name} stock is ${severity} (${product.quantityAvailable} left, threshold ${effectiveThreshold}). Restock soon!`,
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
