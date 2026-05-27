const Analytics = require('../models/Analytics.model');
const Order = require('../models/Order.model');
const User = require('../models/User.model');
const Product = require('../models/Product.model');
const Logistics = require('../models/Logistics.model');
const mongoose = require('mongoose');

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
    
    // User Analytics for Lango Roles
    const previousDate = new Date(targetDate);
    previousDate.setDate(previousDate.getDate() - 1);
    
    const [totalUsers, newUsers, activeUsers, roleStats, userTypeStats, regionStats] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ createdAt: { $gte: targetDate, $lt: nextDate } }),
      User.countDocuments({ lastLogin: { $gte: targetDate, $lt: nextDate } }),
      User.aggregate([
        { $group: { _id: '$role', count: { $sum: 1 } } }
      ]),
      User.aggregate([
        { $group: { _id: '$userType', count: { $sum: 1 } } }
      ]),
      User.aggregate([
        { $group: { _id: '$region', count: { $sum: 1 } } }
      ])
    ]);
    
    // Farmer Analytics
    const farmerStats = await User.aggregate([
      { $match: { role: 'farmer', createdAt: { $gte: targetDate, $lt: nextDate } } },
      {
        $group: {
          _id: null,
          totalFarmers: { $sum: 1 },
          totalHarvestVolume: { $sum: '$harvestVolume' },
          avgRating: { $avg: '$rating' }
        }
      }
    ]);
    
    // Top Performing Farmers
    const topFarmers = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: targetDate, $lt: nextDate },
          status: 'delivered'
        }
      },
      {
        $group: {
          _id: '$farmerId',
          totalSales: { $sum: '$total' },
          totalOrders: { $sum: 1 },
          productsSold: { $sum: { $sum: '$items.quantity' } }
        }
      },
      { $sort: { totalSales: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'farmer'
        }
      },
      { $unwind: '$farmer' }
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
          category: '$product.category',
          quantitySold: 1,
          revenue: 1
        }
      }
    ]);
    
    // Market Analytics
    const marketVolume = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: targetDate, $lt: nextDate },
          status: 'delivered'
        }
      },
      {
        $group: {
          _id: null,
          totalVolume: { $sum: { $sum: '$items.quantity' } }
        }
      }
    ]);
    
    // Convert region stats to Map with string keys
    const regionMap = new Map();
    regionStats.forEach(r => {
      if (r._id) regionMap.set(String(r._id), r.count);
    });
    
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
            manufacturer: roleStats.find(r => r._id === 'manufacturer')?.count || 0,
            retailer: roleStats.find(r => r._id === 'retailer')?.count || 0,
            admin: roleStats.find(r => r._id === 'admin')?.count || 0
          },
          byUserType: {
            individual: userTypeStats.find(u => u._id === 'individual')?.count || 0,
            cooperative: userTypeStats.find(u => u._id === 'cooperative')?.count || 0,
            business: userTypeStats.find(u => u._id === 'business')?.count || 0
          },
          byRegion: regionMap
        },
        farmers: {
          total: farmerStats[0]?.totalFarmers || 0,
          active: await User.countDocuments({ role: 'farmer', isActive: true }),
          newFarmers: newUsers,
          topPerformers: topFarmers.map(f => ({
            farmerId: f._id,
            name: f.farmer.name,
            farmName: f.farmer.farmName,
            totalSales: f.totalSales,
            totalOrders: f.totalOrders,
            rating: f.farmer.rating,
            productsSold: f.productsSold
          })),
          byCropType: new Map(),
          byRegion: new Map(),
          averageRating: farmerStats[0]?.avgRating || 0,
          totalHarvestVolume: farmerStats[0]?.totalHarvestVolume || 0,
          revenueShare: ((farmerStats[0]?.totalHarvestVolume || 0) / (marketVolume[0]?.totalVolume || 1)) * 100
        },
        products: {
          total: totalProducts,
          active: activeProducts,
          outOfStock,
          lowStock,
          topSelling: topProducts,
          topCategories: [],
          byCategory: new Map()
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
          averageDeliveryTime: timeData[0]?.avgDeliveryTime || 0,
          byRole: {
            farmerToWholesaler: 0,
            wholesalerToRetailer: 0,
            manufacturerToDistributor: 0,
            directToConsumer: 0
          }
        },
        market: {
          totalMarketVolume: marketVolume[0]?.totalVolume || 0,
          averagePrices: new Map(),
          priceTrends: [],
          demandForecast: new Map(),
          seasonalTrends: new Map(),
          popularRegions: []
        },
        supplyChain: {
          efficiency: 0,
          averageLeadTime: 0,
          wastageRate: 0,
          coldChainUtilization: 0,
          logistics: {
            totalShipments: 0,
            delivered: 0,
            inTransit: 0,
            delayed: 0,
            averageDeliveryTime: 0,
            onTimeDelivery: 0
          },
          byCarrier: new Map()
        },
        revenue: {
          total: salesData[0]?.totalRevenue || 0,
          byPaymentMethod: new Map(),
          byRole: {
            farmers: farmerStats[0]?.totalHarvestVolume || 0,
            wholesalers: 0,
            manufacturers: 0,
            retailers: 0
          },
          platformFee: 0,
          commissionCollected: 0
        },
        platform: {
          conversionRate: 0,
          cartAbandonmentRate: 0,
          customerRetentionRate: 0,
          returningCustomers: 0,
          userSatisfaction: 0,
          transactionSuccess: 0
        },
        regions: new Map()
      },
      { upsert: true, new: true }
    );
    
    res.status(200).json({
      success: true,
      message: 'Analytics generated successfully for Lango Market',
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
    const { startDate, endDate, period = 'day', role } = req.query;
    
    let query = {};
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    
    let analytics = await Analytics.find(query).sort({ date: 1 });
    
    // Filter by role if specified
    if (role && role !== 'admin') {
      analytics = analytics.map(a => ({
        date: a.date,
        sales: a.sales,
        [`${role}s`]: a[`${role}s`],
        revenue: a.revenue.byRole[`${role}s`],
        market: a.market
      }));
    }
    
    // Calculate trends
    const trends = {
      revenue: analytics.map(a => ({ date: a.date, value: a.sales.totalRevenue })),
      orders: analytics.map(a => ({ date: a.date, value: a.sales.totalOrders })),
      users: analytics.map(a => ({ date: a.date, value: a.users.new })),
      marketVolume: analytics.map(a => ({ date: a.date, value: a.market?.totalMarketVolume || 0 }))
    };
    
    // Summary for period
    const summary = {
      totalRevenue: analytics.reduce((sum, a) => sum + a.sales.totalRevenue, 0),
      totalOrders: analytics.reduce((sum, a) => sum + a.sales.totalOrders, 0),
      totalUsers: analytics[analytics.length - 1]?.users.total || 0,
      averageOrderValue: analytics.length > 0 
        ? analytics.reduce((sum, a) => sum + a.sales.averageOrderValue, 0) / analytics.length 
        : 0,
      totalMarketVolume: analytics.reduce((sum, a) => sum + (a.market?.totalMarketVolume || 0), 0)
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
      Analytics.findOne({ date: startOfWeek }),
      Analytics.findOne({ date: startOfMonth }),
      Analytics.findOne().sort({ date: 1 })
    ]);
    
    // Get real-time stats
    const [pendingOrders, activeUsers, lowStockProducts, inTransitDeliveries, farmersOnline] = await Promise.all([
      Order.countDocuments({ status: 'pending' }),
      User.countDocuments({ isActive: true, lastLogin: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }),
      Product.countDocuments({ stock: { $lt: 10, $gt: 0 } }),
      Logistics.countDocuments({ status: 'in_transit' }),
      User.countDocuments({ role: 'farmer', isActive: true, lastLogin: { $gte: new Date(Date.now() - 60 * 60 * 1000) } })
    ]);
    
    // Role-based KPIs
    const roleKPIs = {
      farmers: {
        total: await User.countDocuments({ role: 'farmer' }),
        active: await User.countDocuments({ role: 'farmer', isActive: true }),
        online: farmersOnline,
        revenueShare: todayData?.revenue.byRole.farmers || 0
      },
      wholesalers: {
        total: await User.countDocuments({ role: 'wholesaler' }),
        active: await User.countDocuments({ role: 'wholesaler', isActive: true }),
        revenueShare: todayData?.revenue.byRole.wholesalers || 0
      },
      manufacturers: {
        total: await User.countDocuments({ role: 'manufacturer' }),
        active: await User.countDocuments({ role: 'manufacturer', isActive: true }),
        revenueShare: todayData?.revenue.byRole.manufacturers || 0
      },
      retailers: {
        total: await User.countDocuments({ role: 'retailer' }),
        active: await User.countDocuments({ role: 'retailer', isActive: true }),
        revenueShare: todayData?.revenue.byRole.retailers || 0
      }
    };
    
    res.status(200).json({
      success: true,
      data: {
        today: todayData,
        week: weekData,
        month: monthData,
        allTime: allTimeData,
        roleKPIs,
        realtime: {
          pendingOrders,
          activeUsers,
          lowStockProducts,
          inTransitDeliveries,
          farmersOnline
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
    const { period = 'month', year, month, farmerId, productCategory } = req.query;
    
    let matchStage = {};
    
    if (period === 'month' && year && month) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);
      matchStage = {
        createdAt: { $gte: startDate, $lte: endDate }
      };
    }
    
    if (farmerId) {
      matchStage.farmerId = new mongoose.Types.ObjectId(farmerId);
    }
    
    let salesData = await Order.aggregate([
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
    
    // Add category filter if specified
    if (productCategory) {
      salesData = salesData.filter(data => data.category === productCategory);
    }
    
    res.status(200).json({
      success: true,
      data: salesData
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get farmer analytics
 * GET /api/v1/analytics/farmers
 */
exports.getFarmerAnalytics = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    
    const query = {};
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    
    const analytics = await Analytics.find(query).select('date farmers').sort({ date: 1 });
    
    const summary = {
      totalFarmers: analytics[analytics.length - 1]?.farmers.total || 0,
      averageRating: analytics.length > 0 ? analytics.reduce((sum, a) => sum + (a.farmers.averageRating || 0), 0) / analytics.length : 0,
      totalHarvestVolume: analytics.reduce((sum, a) => sum + (a.farmers.totalHarvestVolume || 0), 0),
      topPerformers: analytics[analytics.length - 1]?.farmers.topPerformers || []
    };
    
    res.status(200).json({
      success: true,
      data: analytics,
      summary
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get manufacturer analytics
 * GET /api/v1/analytics/manufacturers
 */
exports.getManufacturerAnalytics = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    
    const query = {};
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    
    const analytics = await Analytics.find(query).select('date manufacturers').sort({ date: 1 });
    
    const summary = {
      totalManufacturers: analytics[analytics.length - 1]?.manufacturers.total || 0,
      productionVolume: analytics.reduce((sum, a) => sum + (a.manufacturers.productionVolume || 0), 0),
      topPerformers: analytics[analytics.length - 1]?.manufacturers.topPerformers || []
    };
    
    res.status(200).json({
      success: true,
      data: analytics,
      summary
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get market trends
 * GET /api/v1/analytics/market-trends
 */
exports.getMarketTrends = async (req, res, next) => {
  try {
    const { category, region } = req.query;
    
    const analytics = await Analytics.find()
      .sort({ date: -1 })
      .limit(30)
      .select('date market sales');
    
    const trends = {
      volume: analytics.map(a => ({ date: a.date, value: a.market?.totalMarketVolume || 0 })),
      revenue: analytics.map(a => ({ date: a.date, value: a.sales.totalRevenue })),
      priceTrends: analytics[0]?.market.priceTrends || []
    };
    
    res.status(200).json({
      success: true,
      data: trends,
      currentMarket: analytics[0]?.market || null
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get supply chain analytics
 * GET /api/v1/analytics/supply-chain
 */
exports.getSupplyChainAnalytics = async (req, res, next) => {
  try {
    const analytics = await Analytics.find()
      .sort({ date: -1 })
      .limit(7)
      .select('date supplyChain');
    
    const efficiency = analytics.length > 0 ? analytics.reduce((sum, a) => sum + (a.supplyChain?.efficiency || 0), 0) / analytics.length : 0;
    const avgLeadTime = analytics.length > 0 ? analytics.reduce((sum, a) => sum + (a.supplyChain?.averageLeadTime || 0), 0) / analytics.length : 0;
    
    res.status(200).json({
      success: true,
      data: {
        weeklyData: analytics,
        averages: {
          efficiency,
          averageLeadTime: avgLeadTime,
          wastageRate: analytics[0]?.supplyChain.wastageRate || 0,
          coldChainUtilization: analytics[0]?.supplyChain.coldChainUtilization || 0
        },
        logistics: analytics[0]?.supplyChain.logistics || null
      }
    });
  } catch (error) {
    next(error);
  }
};
