const Product = require('../../models/Product.model');
const User = require('../../models/User.model');
const { scarcityQueue } = require('../../config/redis');
const logger = require('../../utils/logger');

const PRODUCT_LIMIT_MAX = 100;

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
    const products = await Product.find({
      seller: sellerId,
      quantityAvailable: { $lte: threshold },
    });
    return products;
  }

  async checkScarcity(product) {
    const threshold = product.quantityAvailable <= 5 ? 'critical' : product.quantityAvailable <= 20 ? 'low' : null;
    if (threshold) {
      await scarcityQueue.add('check', {
        productId: product._id,
        threshold,
        quantity: product.quantityAvailable,
      });
    }
  }

  async reserveStock(productId, quantity) {
    const product = await Product.findById(productId);
    if (!product) throw new Error('Product not found');
    if (product.quantityAvailable - product.reservedQuantity < quantity) {
      throw new Error('Insufficient stock');
    }
    product.reservedQuantity += quantity;
    await product.save();
    return product;
  }

  async releaseReservedStock(productId, quantity) {
    const product = await Product.findById(productId);
    if (!product) throw new Error('Product not found');
    product.reservedQuantity = Math.max(0, product.reservedQuantity - quantity);
    await product.save();
    return product;
  }
}

module.exports = new ProductService();
