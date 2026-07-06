const Product = require('../../models/Product.model');
const User = require('../../models/User.model');
const { scarcityQueue } = require('../../config/redis');
const logger = require('../../utils/logger');

const PRODUCT_LIMIT_MAX = 100;
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

const getProductId = (productOrId) => productOrId?._id || productOrId;

const normalizeQuantity = (quantity) => {
  const normalized = Number(quantity);
  if (!Number.isFinite(normalized) || normalized <= 0) {
    throw new Error('Quantity must be greater than zero');
  }
  return normalized;
};

class ProductService {
  async createProduct(data) {
    const product = await Product.create(data);
    // Trigger scarcity check if quantity low
    await this.checkScarcity(product);
    return product;
  }

  async getProducts(filters) {
    const {
      page = 1,
      limit = 20,
      category,
      minPrice,
      maxPrice,
      search,
      seller,
      sortBy = 'newest',
      businessType,
    } = filters;

    const query = { isPublished: true };

    if (category) query.category = category;
    if (seller) query.seller = seller;

    if (businessType) {
      const normalizedBusinessType = String(businessType).trim().toLowerCase();
      const matchingSellers = await User.find({
        $or: [
          { businessType: normalizedBusinessType },
          { role: normalizedBusinessType },
        ],
      }).select('_id');
      const sellerIds = matchingSellers.map((u) => u._id);
      query.seller = { $in: sellerIds };
    }

    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice !== undefined && minPrice !== null && minPrice !== '') {
        query.price.$gte = Number(minPrice);
      }
      if (maxPrice !== undefined && maxPrice !== null && maxPrice !== '') {
        query.price.$lte = Number(maxPrice);
      }
    }

    if (search) {
      query.$text = { $search: search };
    }

    const pageNum = Number(page) > 0 ? Number(page) : 1;
    const limitNum = Math.min(Number(limit) > 0 ? Number(limit) : 20, PRODUCT_LIMIT_MAX);
    const skip = (pageNum - 1) * limitNum;

    const sortMap = {
      newest: { createdAt: -1 },
      price_asc: { price: 1, createdAt: -1 },
      price_desc: { price: -1, createdAt: -1 },
      popular: { soldCount: -1, createdAt: -1 },
      rating: { rating: -1, createdAt: -1 },
    };
    const resolvedSort = sortMap[sortBy] || sortMap.newest;

    const products = await Product.find(query)
      .populate('seller', 'fullName phone location businessType businessName')
      .skip(skip)
      .limit(limitNum)
      .sort(resolvedSort);

    const total = await Product.countDocuments(query);

    return {
      data: products,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
    };
  }

  async getProductById(id) {
    const product = await Product.findById(id).populate('seller', 'fullName phone businessType businessName');
    if (!product) throw new Error('Product not found');
    return product;
  }

  async updateProduct(id, sellerId, updates) {
    const product = await Product.findOne({ _id: id, seller: sellerId });
    if (!product) throw new Error('Product not found or unauthorized');

    Object.assign(product, updates);
    await product.save();
    await this.checkScarcity(product);
    return product;
  }

  async deleteProduct(id, sellerId) {
    const product = await Product.findOneAndDelete({ _id: id, seller: sellerId });
    if (!product) throw new Error('Product not found or unauthorized');
    return product;
  }

  async getLowStockProducts(sellerId, threshold = 10) {
    const explicitThreshold = Number(threshold) > 0 ? Number(threshold) : null;
    const products = await Product.find({
      seller: sellerId,
      quantityAvailable: { $gt: 0 },
    });
    return products.filter((product) => {
      const alertThreshold = explicitThreshold || getEffectiveLowStockThreshold(product);
      return alertThreshold > 0 && Number(product.quantityAvailable || 0) <= alertThreshold;
    });
  }

  async checkScarcity(product) {
    const alertThreshold = getEffectiveLowStockThreshold(product);
    const threshold = alertThreshold > 0 && product.quantityAvailable <= alertThreshold
      ? product.quantityAvailable <= Math.max(1, Math.ceil(alertThreshold / 2)) ? 'critical' : 'low'
      : null;
    if (threshold) {
      await scarcityQueue.add('check', {
        productId: product._id,
        threshold,
        alertThreshold,
        quantity: product.quantityAvailable,
      });
    }
  }

  async reserveStock(productId, quantity) {
    const normalizedQuantity = normalizeQuantity(quantity);
    const product = await Product.findById(getProductId(productId));
    if (!product) throw new Error('Product not found');
    if (product.quantityAvailable - product.reservedQuantity < normalizedQuantity) {
      throw new Error('Insufficient stock');
    }
    product.reservedQuantity += normalizedQuantity;
    await product.save();
    return product;
  }

  async releaseReservedStock(productId, quantity) {
    const normalizedQuantity = normalizeQuantity(quantity);
    const product = await Product.findById(getProductId(productId));
    if (!product) throw new Error('Product not found');
    product.reservedQuantity = Math.max(0, product.reservedQuantity - normalizedQuantity);
    await product.save();
    return product;
  }

  async commitReservedStock(productId, quantity) {
    const normalizedQuantity = normalizeQuantity(quantity);
    const product = await Product.findOneAndUpdate(
      {
        _id: getProductId(productId),
        reservedQuantity: { $gte: normalizedQuantity },
        quantityAvailable: { $gte: normalizedQuantity },
      },
      {
        $inc: {
          quantityAvailable: -normalizedQuantity,
          reservedQuantity: -normalizedQuantity,
          soldCount: normalizedQuantity,
        },
      },
      { new: true }
    );

    if (!product) {
      throw new Error('Cannot complete sale because reserved stock is no longer available');
    }

    const history = Array.isArray(product.inventoryHistory) ? product.inventoryHistory : [];
    history.push({
      onHand: product.quantityAvailable || 0,
      reserved: product.reservedQuantity || 0,
      available: Math.max(0, (product.quantityAvailable || 0) - (product.reservedQuantity || 0)),
      unit: product.unit,
      event: 'sale_committed',
      recordedAt: new Date(),
    });
    product.inventoryHistory = history.slice(-30);
    await product.save();
    return product;
  }

  async restoreCommittedStock(productId, quantity) {
    const normalizedQuantity = normalizeQuantity(quantity);
    const product = await Product.findByIdAndUpdate(
      getProductId(productId),
      { $inc: { quantityAvailable: normalizedQuantity, soldCount: -normalizedQuantity } },
      { new: true }
    );
    if (!product) throw new Error('Product not found');
    if (product.soldCount < 0) product.soldCount = 0;

    const history = Array.isArray(product.inventoryHistory) ? product.inventoryHistory : [];
    history.push({
      onHand: product.quantityAvailable || 0,
      reserved: product.reservedQuantity || 0,
      available: Math.max(0, (product.quantityAvailable || 0) - (product.reservedQuantity || 0)),
      unit: product.unit,
      event: 'sale_restocked',
      recordedAt: new Date(),
    });
    product.inventoryHistory = history.slice(-30);
    await product.save();
    return product;
  }
}

module.exports = new ProductService();
