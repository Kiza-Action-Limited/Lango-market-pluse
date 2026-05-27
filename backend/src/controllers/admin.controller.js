const User = require('../models/User.model');
const Order = require('../models/Order.model');
const Product = require('../models/Product.model');
const Category = require('../models/Category.model');
const Transaction = require('../models/Transaction.model');
const Logistics = require('../models/Logistics.model');
const Analytics = require('../models/Analytics.model');

/**
 * Get comprehensive system statistics
 * GET /api/v1/admin/stats
 */
exports.getStats = async (req, res, next) => {
  try {
    // User statistics by role
    const totalUsers = await User.countDocuments();
    const farmers = await User.countDocuments({ role: 'farmer' });
    const wholesalers = await User.countDocuments({ role: 'wholesaler' });
    const retailers = await User.countDocuments({ role: 'retailer' });
    const consumers = await User.countDocuments({ role: 'consumer' });
    const logistics = await User.countDocuments({ role: 'logistics' });
    
    // Product statistics
    const totalProducts = await Product.countDocuments();
    const activeProducts = await Product.countDocuments({ isActive: true });
    const outOfStock = await Product.countDocuments({ stock: 0 });
    
    // Order statistics
    const totalOrders = await Order.countDocuments();
    const pendingOrders = await Order.countDocuments({ status: 'pending' });
    const processingOrders = await Order.countDocuments({ status: 'processing' });
    const shippedOrders = await Order.countDocuments({ status: 'shipped' });
    const deliveredOrders = await Order.countDocuments({ status: 'delivered' });
    const cancelledOrders = await Order.countDocuments({ status: 'cancelled' });
    
    // Revenue statistics
    const revenueResult = await Order.aggregate([
      { $match: { status: { $ne: 'cancelled' }, paymentStatus: 'completed' } },
      { $group: { _id: null, total: { $sum: '$total' } } }
    ]);
    const totalRevenue = revenueResult[0]?.total || 0;
    
    // Payment statistics
    const paymentStats = await Order.aggregate([
      { $group: { 
        _id: '$paymentStatus', 
        count: { $sum: 1 },
        amount: { $sum: '$total' }
      }}
    ]);
    
    // Logistics statistics
    const activeDeliveries = await Logistics.countDocuments({ status: 'in_transit' });
    const completedDeliveries = await Logistics.countDocuments({ status: 'delivered' });
    
    // Recent activity
    const recentOrders = await Order.find()
      .sort('-createdAt')
      .limit(5)
      .populate('customer', 'name');

    res.status(200).json({
      success: true,
      data: {
        users: { total: totalUsers, farmers, wholesalers, retailers, consumers, logistics },
        products: { total: totalProducts, active: activeProducts, outOfStock },
        orders: { total: totalOrders, pending: pendingOrders, processing: processingOrders, shipped: shippedOrders, delivered: deliveredOrders, cancelled: cancelledOrders },
        revenue: { total: totalRevenue, averageOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0 },
        payments: paymentStats,
        logistics: { activeDeliveries, completedDeliveries },
        recentActivity: recentOrders
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get users with advanced filtering
 * GET /api/v1/admin/users
 */
exports.getAllUsers = async (req, res, next) => {
  try {
    const { role, status, search, page = 1, limit = 20 } = req.query;
    const query = {};
    
    if (role && role !== 'all') query.role = role;
    if (status === 'active') query.isActive = true;
    if (status === 'blocked') query.isBlocked = true;
    if (status === 'verified') query.isVerified = true;
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { businessName: { $regex: search, $options: 'i' } }
      ];
    }
    
    const users = await User.find(query)
      .select('-password')
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    
    const total = await User.countDocuments(query);
    
    res.status(200).json({
      success: true,
      users,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get user details with analytics
 * GET /api/v1/admin/users/:userId
 */
exports.getUserDetails = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.userId).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    // Get user specific analytics
    const orderStats = await Order.aggregate([
      { $match: { $or: [{ customer: user._id }, { seller: user._id }] } },
      { $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        totalSpent: { $sum: '$total' },
        avgOrderValue: { $avg: '$total' }
      }}
    ]);
    
    const recentOrders = await Order.find({ $or: [{ customer: user._id }, { seller: user._id }] })
      .sort('-createdAt')
      .limit(10)
      .populate('items.product', 'name');
    
    res.status(200).json({
      success: true,
      user,
      analytics: orderStats[0] || { totalOrders: 0, totalSpent: 0, avgOrderValue: 0 },
      recentOrders
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update user (block, verify, change role)
 * PUT /api/v1/admin/users/:userId
 */
exports.updateUser = async (req, res, next) => {
  try {
    const { role, isBlocked, isVerified, userType, businessName, phone, address } = req.body;
    const updates = {};
    
    if (role) updates.role = role;
    if (isBlocked !== undefined) updates.isBlocked = isBlocked;
    if (isVerified !== undefined) updates.isVerified = isVerified;
    if (userType) updates.userType = userType;
    if (businessName) updates.businessName = businessName;
    if (phone) updates.phone = phone;
    if (address) updates.address = address;
    
    updates.updatedAt = new Date();
    
    const user = await User.findByIdAndUpdate(req.params.userId, updates, { new: true }).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      user
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get logistics applications queue
 * GET /api/v1/admin/logistics/applications
 */
exports.getLogisticsApplications = async (req, res, next) => {
  try {
    const { status = 'pending', page = 1, limit = 20 } = req.query;
    const filter = { role: 'logistics' };

    if (status && status !== 'all') {
      filter['logisticsProfile.verificationStatus'] = status;
    }

    const applications = await User.find(filter)
      .select('fullName email phone logisticsProfile createdAt updatedAt')
      .sort({ 'logisticsProfile.applicationSubmittedAt': -1, createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    const total = await User.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: applications,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Review logistics application (approve/reject)
 * PUT /api/v1/admin/logistics/applications/:userId/review
 */
exports.reviewLogisticsApplication = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { action, notes = '' } = req.body;

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Use "approve" or "reject".',
      });
    }

    const candidate = await User.findById(userId);
    if (!candidate) {
      return res.status(404).json({ success: false, message: 'Logistics applicant not found' });
    }

    const nextStatus = action === 'approve' ? 'verified' : 'rejected';
    candidate.role = 'logistics';
    candidate.businessType = 'logistics';
    candidate.subscriptionTier = 'mizigo';
    candidate.logisticsProfile = {
      ...(candidate.logisticsProfile?.toObject?.() || candidate.logisticsProfile || {}),
      verificationStatus: nextStatus,
      reviewedAt: new Date(),
      reviewedBy: req.user._id,
      reviewNotes: notes,
      verifiedAt: action === 'approve' ? new Date() : null,
    };

    await candidate.save();

    res.status(200).json({
      success: true,
      message: `Application ${action}d successfully.`,
      data: {
        userId: candidate._id,
        verificationStatus: candidate.logisticsProfile.verificationStatus,
        reviewedAt: candidate.logisticsProfile.reviewedAt,
        notes: candidate.logisticsProfile.reviewNotes,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get comprehensive orders with filters
 * GET /api/v1/admin/orders
 */
exports.getAllOrders = async (req, res, next) => {
  try {
    const { status, paymentStatus, userType, startDate, endDate, page = 1, limit = 20 } = req.query;
    const query = {};
    
    if (status && status !== 'all') query.status = status;
    if (paymentStatus && paymentStatus !== 'all') query.paymentStatus = paymentStatus;
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    
    let orders = await Order.find(query)
      .populate('customer', 'name email phone userType')
      .populate('seller', 'name businessName')
      .populate('items.product', 'name images')
      .populate('logistics', 'trackingNumber status carrier')
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    
    // Filter by user type if specified
    if (userType && userType !== 'all') {
      orders = orders.filter(order => order.customer?.userType === userType);
    }
    
    const total = await Order.countDocuments(query);
    
    // Enhanced order data with analytics
    const enhancedOrders = orders.map(order => ({
      ...order.toObject(),
      timeline: getOrderTimeline(order),
      estimatedDelivery: calculateEstimatedDelivery(order.createdAt),
      paymentBreakdown: {
        subtotal: order.subtotal,
        tax: order.tax,
        shipping: order.shipping,
        total: order.total
      }
    }));
    
    res.status(200).json({
      success: true,
      orders: enhancedOrders,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update order status with tracking
 * PUT /api/v1/admin/orders/:orderId/status
 */
exports.updateOrderStatus = async (req, res, next) => {
  try {
    const { status, trackingNumber, carrier, notes } = req.body;
    const order = await Order.findById(req.params.orderId);
    
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    
    order.status = status;
    order.updatedAt = new Date();
    
    // Add status history
    if (!order.statusHistory) order.statusHistory = [];
    order.statusHistory.push({
      status,
      timestamp: new Date(),
      notes: notes || '',
      updatedBy: req.user._id
    });
    
    // Update logistics if shipped
    if (status === 'shipped' && trackingNumber) {
      order.trackingNumber = trackingNumber;
      order.carrier = carrier;
    }
    
    // Update payment status if delivered
    if (status === 'delivered') {
      order.paymentStatus = 'completed';
      order.deliveredAt = new Date();
    }
    
    await order.save();
    
    res.status(200).json({
      success: true,
      message: 'Order status updated successfully',
      order
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all products with advanced filtering
 * GET /api/v1/admin/products
 */
exports.getAllProducts = async (req, res, next) => {
  try {
    const { category, status, minPrice, maxPrice, farmer, page = 1, limit = 20 } = req.query;
    const query = {};
    
    if (category && category !== 'all') query.category = category;
    if (status === 'active') query.isActive = true;
    if (status === 'inactive') query.isActive = false;
    if (minPrice) query.price = { $gte: parseFloat(minPrice) };
    if (maxPrice) query.price = { ...query.price, $lte: parseFloat(maxPrice) };
    if (farmer) query.seller = farmer;
    
    const products = await Product.find(query)
      .populate('seller', 'name businessName email rating')
      .populate('category', 'name')
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    
    const total = await Product.countDocuments(query);
    
    // Enhanced product analytics
    const enhancedProducts = await Promise.all(products.map(async (product) => {
      const salesData = await Order.aggregate([
        { $unwind: '$items' },
        { $match: { 'items.product': product._id, status: 'delivered' } },
        { $group: {
          _id: null,
          totalSold: { $sum: '$items.quantity' },
          totalRevenue: { $sum: { $multiply: ['$items.quantity', '$items.price'] } }
        }}
      ]);
      
      return {
        ...product.toObject(),
        analytics: {
          totalSold: salesData[0]?.totalSold || 0,
          totalRevenue: salesData[0]?.totalRevenue || 0,
          rating: product.rating || 0
        }
      };
    }));
    
    res.status(200).json({
      success: true,
      products: enhancedProducts,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get logistics and delivery tracking
 * GET /api/v1/admin/logistics
 */
exports.getLogistics = async (req, res, next) => {
  try {
    const { status, carrier, page = 1, limit = 20 } = req.query;
    const query = {};
    
    if (status && status !== 'all') query.status = status;
    if (carrier && carrier !== 'all') query.carrier = carrier;
    
    const logistics = await Logistics.find(query)
      .populate('order', 'orderNumber customer total')
      .populate('driver', 'name phone')
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    
    const total = await Logistics.countDocuments(query);
    
    res.status(200).json({
      success: true,
      logistics,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update logistics tracking
 * PUT /api/v1/admin/logistics/:logisticsId/tracking
 */
exports.updateLogisticsTracking = async (req, res, next) => {
  try {
    const { status, location, notes, estimatedDelivery } = req.body;
    const logistics = await Logistics.findById(req.params.logisticsId);
    
    if (!logistics) {
      return res.status(404).json({ success: false, message: 'Logistics record not found' });
    }
    
    logistics.status = status;
    logistics.currentLocation = location;
    if (estimatedDelivery) logistics.estimatedDelivery = new Date(estimatedDelivery);
    
    // Add tracking history
    if (!logistics.trackingHistory) logistics.trackingHistory = [];
    logistics.trackingHistory.push({
      status,
      location,
      notes,
      timestamp: new Date()
    });
    
    await logistics.save();
    
    // Update associated order status
    if (status === 'delivered') {
      await Order.findByIdAndUpdate(logistics.order, { status: 'delivered' });
    }
    
    res.status(200).json({
      success: true,
      message: 'Logistics tracking updated',
      logistics
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get analytics dashboard data
 * GET /api/v1/admin/analytics
 */
exports.getAnalytics = async (req, res, next) => {
  try {
    const { period = 'month', startDate, endDate } = req.query;
    
    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter = {
        createdAt: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      };
    }
    
    // Sales by user type
    const salesByUserType = await Order.aggregate([
      { $match: { ...dateFilter, status: 'delivered' } },
      { $lookup: {
        from: 'users',
        localField: 'customer',
        foreignField: '_id',
        as: 'customerData'
      }},
      { $unwind: '$customerData' },
      { $group: {
        _id: '$customerData.userType',
        totalSales: { $sum: '$total' },
        orderCount: { $sum: 1 },
        averageOrderValue: { $avg: '$total' }
      }}
    ]);
    
    // Top selling products
    const topProducts = await Order.aggregate([
      { $match: { ...dateFilter, status: 'delivered' } },
      { $unwind: '$items' },
      { $group: {
        _id: '$items.product',
        totalSold: { $sum: '$items.quantity' },
        revenue: { $sum: { $multiply: ['$items.quantity', '$items.price'] } }
      }},
      { $sort: { totalSold: -1 } },
      { $limit: 10 },
      { $lookup: {
        from: 'products',
        localField: '_id',
        foreignField: '_id',
        as: 'product'
      }},
      { $unwind: '$product' }
    ]);
    
    // Weekly/Monthly trends
    const trends = await Order.aggregate([
      { $match: { ...dateFilter, status: 'delivered' } },
      { $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          week: { $week: '$createdAt' }
        },
        totalRevenue: { $sum: '$total' },
        orderCount: { $sum: 1 }
      }},
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.week': 1 } }
    ]);
    
    // Farmer performance
    const farmerPerformance = await Order.aggregate([
      { $match: { ...dateFilter, status: 'delivered' } },
      { $unwind: '$items' },
      { $group: {
        _id: '$items.farmer',
        totalSold: { $sum: '$items.quantity' },
        revenue: { $sum: { $multiply: ['$items.quantity', '$items.price'] } },
        orders: { $addToSet: '$_id' }
      }},
      { $project: {
        farmerId: '$_id',
        totalSold: 1,
        revenue: 1,
        orderCount: { $size: '$orders' }
      }},
      { $lookup: {
        from: 'users',
        localField: 'farmerId',
        foreignField: '_id',
        as: 'farmer'
      }},
      { $unwind: '$farmer' }
    ]);
    
    res.status(200).json({
      success: true,
      data: {
        salesByUserType,
        topProducts,
        trends,
        farmerPerformance,
        summary: {
          totalRevenue: trends.reduce((sum, t) => sum + t.totalRevenue, 0),
          totalOrders: trends.reduce((sum, t) => sum + t.orderCount, 0),
          averageOrderValue: trends.length > 0 ? 
            trends.reduce((sum, t) => sum + t.totalRevenue, 0) / trends.reduce((sum, t) => sum + t.orderCount, 0) : 0
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get payment transactions
 * GET /api/v1/admin/payments
 */
exports.getPayments = async (req, res, next) => {
  try {
    const { status, method, startDate, endDate, page = 1, limit = 20 } = req.query;
    const query = {};
    
    if (status && status !== 'all') query.status = status;
    if (method && method !== 'all') query.paymentMethod = method;
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    
    const payments = await Transaction.find(query)
      .populate('user', 'name email')
      .populate('order', 'orderNumber')
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    
    const total = await Transaction.countDocuments(query);
    
    // Payment summary
    const summary = await Transaction.aggregate([
      { $match: query },
      { $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' }
      }}
    ]);
    
    res.status(200).json({
      success: true,
      payments,
      summary,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Broadcast notification to users
 * POST /api/v1/admin/broadcast
 */
exports.broadcastNotification = async (req, res, next) => {
  try {
    const { type, title, message, targetRole, targetUserType } = req.body;
    
    const query = {};
    if (targetRole && targetRole !== 'all') query.role = targetRole;
    if (targetUserType && targetUserType !== 'all') query.userType = targetUserType;
    
    const targetUsers = await User.find(query).select('email phone');
    
    // Here you would integrate with your notification service
    // For now, we'll just log and return success
    
    res.status(200).json({
      success: true,
      message: `Broadcast notification sent to ${targetUsers.length} users`,
      recipients: targetUsers.length
    });
  } catch (error) {
    next(error);
  }
};

// Helper functions
function getOrderTimeline(order) {
  const timeline = [];
  if (order.createdAt) timeline.push({ status: 'Order Placed', date: order.createdAt });
  if (order.confirmedAt) timeline.push({ status: 'Confirmed', date: order.confirmedAt });
  if (order.processingAt) timeline.push({ status: 'Processing', date: order.processingAt });
  if (order.shippedAt) timeline.push({ status: 'Shipped', date: order.shippedAt });
  if (order.deliveredAt) timeline.push({ status: 'Delivered', date: order.deliveredAt });
  return timeline;
}

function calculateEstimatedDelivery(createdAt) {
  const estimated = new Date(createdAt);
  estimated.setDate(estimated.getDate() + 5); // 5 days delivery estimate
  return estimated;
}
