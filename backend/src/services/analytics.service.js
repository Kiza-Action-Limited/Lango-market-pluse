const Analytics = require('../../models/Analytics.model');
const Order = require('../../models/Order.model');
const Product = require('../../models/Product.model');
const User = require('../../models/User.model');
const Transaction = require('../../models/Transaction.model');

class AnalyticsService {
  /**
   * Track product view
   */
  async trackProductView(productId, userId = null) {
    return Analytics.create({
      event: 'product_view',
      product: productId,
      user: userId,
      metadata: {},
    });
  }

  /**
   * Track product purchase
   */
  async trackProductPurchase(orderId, userId, productId) {
    return Analytics.create({
      event: 'product_purchase',
      order: orderId,
      product: productId,
      user: userId,
    });
  }

  /**
   * Get dashboard statistics
   */
  async getDashboardStats(userId, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [orders, revenue, transactions, products] = await Promise.all([
      Order.countDocuments({
        seller: userId,
        createdAt: { $gte: startDate },
      }),
      Order.aggregate([
        {
          $match: {
            seller: userId,
            createdAt: { $gte: startDate },
            status: { $in: ['RELEASED', 'DELIVERED', 'completed'] },
          },
        },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } },
      ]),
      Transaction.countDocuments({
        user: userId,
        createdAt: { $gte: startDate },
        status: 'completed',
      }),
      Product.countDocuments({ seller: userId }),
    ]);

    return {
      totalOrders: orders,
      totalRevenue: revenue.length > 0 ? revenue[0].total : 0,
      totalTransactions: transactions,
      activeProducts: products,
    };
  }

  /**
   * Get top products
   */
  async getTopProducts(limit = 10, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: '$product',
          sales: { $sum: '$quantity' },
          revenue: { $sum: '$totalAmount' },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'product',
        },
      },
      { $unwind: '$product' },
    ]);
  }

  /**
   * Get sales by category
   */
  async getSalesByCategory(days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return Order.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
        },
      },
      {
        $lookup: {
          from: 'products',
          localField: 'product',
          foreignField: '_id',
          as: 'product',
        },
      },
      { $unwind: '$product' },
      {
        $group: {
          _id: '$product.category',
          sales: { $sum: '$quantity' },
          revenue: { $sum: '$totalAmount' },
        },
      },
      {
        $lookup: {
          from: 'categories',
          localField: '_id',
          foreignField: '_id',
          as: 'category',
        },
      },
    ]);
  }

  /**
   * Get user activity
   */
  async getUserActivity(userId, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [views, purchases, clicks] = await Promise.all([
      Analytics.countDocuments({
        user: userId,
        event: 'product_view',
        createdAt: { $gte: startDate },
      }),
      Analytics.countDocuments({
        user: userId,
        event: 'product_purchase',
        createdAt: { $gte: startDate },
      }),
      Analytics.countDocuments({
        user: userId,
        event: 'product_click',
        createdAt: { $gte: startDate },
      }),
    ]);

    return { views, purchases, clicks };
  }

  /**
   * Generate sales report
   */
  async generateSalesReport(userId, startDate, endDate) {
    const orders = await Order.find({
      seller: userId,
      createdAt: { $gte: startDate, $lte: endDate },
    }).populate('product buyer');

    const summary = {
      totalOrders: orders.length,
      totalRevenue: 0,
      averageOrderValue: 0,
      byStatus: {},
    };

    orders.forEach((order) => {
      summary.totalRevenue += order.totalAmount;
      summary.byStatus[order.status] = (summary.byStatus[order.status] || 0) + 1;
    });

    summary.averageOrderValue = summary.totalRevenue / summary.totalOrders || 0;

    return { orders, summary };
  }
}

module.exports = new AnalyticsService();
