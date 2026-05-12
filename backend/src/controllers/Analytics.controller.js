const Analytics = require('../models/Analytics.model');
const Order = require('../models/Order.model');
const User = require('../models/User.model');
const Product = require('../models/Product.model');
const Logistics = require('../models/Logistics.model');

/**
 * Generate daily analytics
 * POST /api/v1/analytics/generate
 */
exports.generateDailyAnalytics = async (req, res, next) => {
  try {
    const { date } = req.body;
    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);
    
    const nextDate = new Date(targetDate);
    nextDate.setDate(nextDate.getDate() + 1);
    
    // Check if analytics already exists
    const existing = await Analytics.findOne({ date: targetDate });
    if (existing && !req.body.force) {
      return res.status(400).json({ 
        success: false, 
        message: 'Analytics already generated for this date. Use force=true to regenerate' 
      });
    }
    
    // Sales Analytics
    const salesData = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: targetDate, $lt: nextDate },
          status: { $ne: 'cancelled' }
        }
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$total' },
          totalOrders: { $sum: 1 },
          avgOrderValue: { $avg: '$total' },
          totalProductsSold: { $sum: { $sum: '$items.quantity' } },
          refunds: { $sum: { $cond: [{ $eq: ['$status', 'refunded'] }, 1, 0] } },
          refundAmount: { $sum: { $cond: [{ $eq: ['$status', 'refunded'] }, '$total', 0] } }
        }
      }
    ]);
    
    // User Analytics
    const previousDate = new Date(targetDate);
    previousDate.setDate(previousDate.getDate() - 1);
    
    const [totalUsers, newUsers, activeUsers, roleStats, userTypeStats] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ createdAt: { $gte: targetDate, $lt: nextDate } }),
      User.countDocuments({ lastLogin: { $gte: targetDate, $lt: nextDate } }),
      User.aggregate([
        { $group: { _id: '$role', count: { $sum: 1 } } }
      ]),
      User.aggregate([
        { $group: { _id: '$userType', count: { $sum: 1 } } }
      ])
    ]);
    
    // Order Analytics by Status
    const orderStatusData = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: targetDate, $lt: nextDate }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    const paymentStatusData = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: targetDate, $lt: nextDate }
        }
      },
      {
        $group: {
          _id: '$paymentStatus',
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Processing & Delivery Times
    const timeData = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: targetDate, $lt: nextDate },
          deliveredAt: { $exists: true }
        }
      },
      {
        $project: {
          processingTime: {
            $divide: [
              { $subtract: ['$confirmedAt', '$createdAt'] },
              1000 * 60 * 60
            ]
          },
          deliveryTime: {
            $divide: [
              { $subtract: ['$deliveredAt', '$shippedAt'] },
              1000 * 60 * 60 * 24
            ]
          }
        }
      },
      {
        $group: {
          _id: null,
          avgProcessingTime: { $avg: '$processingTime' },
          avgDeliveryTime: { $avg: '$deliveryTime' }
        }
      }
    ]);
    
    // Product Analytics
    const totalProducts = await Product.countDocuments();
    const activeProducts = await Product.countDocuments({ isActive: true });
    const outOfStock = await Product.countDocuments({ stock: 0 });
    const lowStock = await Product.countDocuments({ stock: { $lt: 10, $gt: 0 } });
    
    // Top Selling Products
    const topProducts = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: targetDate, $lt: nextDate },
          status: 'delivered'
        }
      },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product',
          quantitySold: { $sum: '$items.quantity' },
          revenue: { $sum: { $multiply: ['$items.quantity', '$items.price'] } }
        }
      },
      { $sort: { quantitySold: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'product'
        }
      },
      { $unwind: '$product' },
      {
        $project: {
          productId: '$_id',
          name: '$product.name',
          quantitySold: 1,
          revenue: 1
        }
      }
    ]);
    
    // Logistics Analytics
    const logisticsStats = await Logistics.aggregate([
      {
        $match: {
          createdAt: { $gte: targetDate, $lt: nextDate }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Revenue by Payment Method
    const revenueByMethod = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: targetDate, $lt: nextDate },
          status: 'delivered'
        }
      },
      {
        $group: {
          _id: '$paymentMethod',
          amount: { $sum: '$total' }
        }
      }
    ]);
    
    // Create or update analytics record
    const analytics = await Analytics.findOneAndUpdate(
      { date: targetDate },
      {
        date: targetDate,
        sales: {
          totalRevenue: salesData[0]?.totalRevenue || 0,
          totalOrders: salesData[0]?.totalOrders || 0,
          averageOrderValue: salesData[0]?.avgOrderValue || 0,
          totalProductsSold: salesData[0]?.totalProductsSold || 0,
          refunds: salesData[0]?.refunds || 0,
          refundAmount: salesData[0]?.refundAmount || 0
        },
        users: {
          total: totalUsers,
          new: newUsers,
          active: activeUsers,
          byRole: {
            farmer: roleStats.find(r => r._id === 'farmer')?.count || 0,
            wholesaler: roleStats.find(r => r._id === 'wholesaler')?.count || 0,
            retailer: roleStats.find(r => r._id === 'retailer')?.count || 0,
            consumer: roleStats.find(r => r._id === 'consumer')?.count || 0,
            logistics: roleStats.find(r => r._id === 'logistics')?.count || 0
          },
          byUserType: {
            individual: userTypeStats.find(u => u._id === 'individual')?.count || 0,
            business: userTypeStats.find(u => u._id === 'business')?.count || 0
          }
        },
        products: {
          total: totalProducts,
          active: activeProducts,
          outOfStock,
          lowStock,
          topSelling: topProducts,
          topCategories: []
        },
        orders: {
          byStatus: {
            pending: orderStatusData.find(s => s._id === 'pending')?.count || 0,
            processing: orderStatusData.find(s => s._id === 'processing')?.count || 0,
            shipped: orderStatusData.find(s => s._id === 'shipped')?.count || 0,
            delivered: orderStatusData.find(s => s._id === 'delivered')?.count || 0,
            cancelled: orderStatusData.find(s => s._id === 'cancelled')?.count || 0
          },
          byPaymentStatus: {
            pending: paymentStatusData.find(p => p._id === 'pending')?.count || 0,
            completed: paymentStatusData.find(p => p._id === 'completed')?.count || 0,
            failed: paymentStatusData.find(p => p._id === 'failed')?.count || 0,
            refunded: paymentStatusData.find(p => p._id === 'refunded')?.count || 0
          },
          averageProcessingTime: timeData[0]?.avgProcessingTime || 0,
          averageDeliveryTime: timeData[0]?.avgDeliveryTime || 0
        },
        logistics: {
          totalShipments: logisticsStats.reduce((sum, l) => sum + l.count, 0),
          delivered: logisticsStats.find(l => l._id === 'delivered')?.count || 0,
          inTransit: logisticsStats.find(l => l._id === 'in_transit')?.count || 0,
          failed: logisticsStats.find(l => l._id === 'failed')?.count || 0,
          averageDeliveryTime: 0,
          onTimeDelivery: 0,
          byCarrier: new Map()
        },
        revenue: {
          total: salesData[0]?.totalRevenue || 0,
          byPaymentMethod: revenueByMethod.reduce((map, item) => {
            map.set(item._id, item.amount);
            return map;
          }, new Map()),
          byUserType: new Map(),
          platformFee: 0,
          deliveryFee: 0
        },
        platform: {
          conversionRate: 0,
          cartAbandonmentRate: 0,
          customerRetentionRate: 0,
          returningCustomers: 0
        },
        summary: {
          visits: 0,
          uniqueVisitors: 0,
          pageViews: 0,
          bounceRate: 0
        }
      },
      { upsert: true, new: true }
    );
    
    res.status(200).json({
      success: true,
      message: 'Analytics generated successfully',
      data: analytics
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get analytics by date range
 * GET /api/v1/analytics
 */
exports.getAnalytics = async (req, res, next) => {
  try {
    const { startDate, endDate, period = 'day' } = req.query;
    
    let query = {};
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    
    const analytics = await Analytics.find(query).sort({ date: 1 });
    
    // Calculate trends
    const trends = {
      revenue: analytics.map(a => ({ date: a.date, value: a.sales.totalRevenue })),
      orders: analytics.map(a => ({ date: a.date, value: a.sales.totalOrders })),
      users: analytics.map(a => ({ date: a.date, value: a.users.new }))
    };
    
    // Summary for period
    const summary = {
      totalRevenue: analytics.reduce((sum, a) => sum + a.sales.totalRevenue, 0),
      totalOrders: analytics.reduce((sum, a) => sum + a.sales.totalOrders, 0),
      totalUsers: analytics[analytics.length - 1]?.users.total || 0,
      averageOrderValue: analytics.length > 0 
        ? analytics.reduce((sum, a) => sum + a.sales.averageOrderValue, 0) / analytics.length 
        : 0
    };
    
    res.status(200).json({
      success: true,
      data: analytics,
      trends,
      summary,
      period
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get dashboard overview
 * GET /api/v1/analytics/dashboard
 */
exports.getDashboardOverview = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const startOfWeek = new Date(today);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    const [todayData, weekData, monthData, allTimeData] = await Promise.all([
      Analytics.findOne({ date: today }),
      Analytics.getPeriodSummary(startOfWeek, today),
      Analytics.getPeriodSummary(startOfMonth, today),
      Analytics.getPeriodSummary(new Date('2020-01-01'), today)
    ]);
    
    // Get real-time stats
    const [pendingOrders, activeUsers, lowStockProducts, inTransitDeliveries] = await Promise.all([
      Order.countDocuments({ status: 'pending' }),
      User.countDocuments({ isActive: true, lastLogin: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }),
      Product.countDocuments({ stock: { $lt: 10, $gt: 0 } }),
      Logistics.countDocuments({ status: 'in_transit' })
    ]);
    
    res.status(200).json({
      success: true,
      data: {
        today: todayData,
        week: weekData,
        month: monthData,
        allTime: allTimeData,
        realtime: {
          pendingOrders,
          activeUsers,
          lowStockProducts,
          inTransitDeliveries
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get sales analytics
 * GET /api/v1/analytics/sales
 */
exports.getSalesAnalytics = async (req, res, next) => {
  try {
    const { period = 'month', year, month } = req.query;
    
    let matchStage = {};
    
    if (period === 'month' && year && month) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);
      matchStage = {
        createdAt: { $gte: startDate, $lte: endDate }
      };
    }
    
    const salesData = await Order.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          revenue: { $sum: '$total' },
          orders: { $sum: 1 },
          productsSold: { $sum: { $sum: '$items.quantity' } }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);
    
    res.status(200).json({
      success: true,
      data: salesData
    });
  } catch (error) {
    next(error);
  }
};