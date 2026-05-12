const Logistics = require('../models/Logistics.model');
const Order = require('../models/Order.model');
const User = require('../models/User.model');

/**
 * Create new logistics record for an order
 * POST /api/v1/logistics
 */
exports.createLogistics = async (req, res, next) => {
  try {
    const { orderId, carrier, shippingAddress, weight, dimensions, notes } = req.body;
    
    // Check if order exists
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    
    // Check if logistics already exists for this order
    const existingLogistics = await Logistics.findOne({ order: orderId });
    if (existingLogistics) {
      return res.status(400).json({ success: false, message: 'Logistics record already exists for this order' });
    }
    
    const logistics = new Logistics({
      order: orderId,
      orderNumber: order.orderNumber,
      carrier,
      shippingAddress: shippingAddress || order.shippingAddress,
      weight,
      dimensions,
      notes,
      status: 'pending'
    });
    
    await logistics.save();
    
    res.status(201).json({
      success: true,
      message: 'Logistics record created successfully',
      data: logistics
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all logistics records with filters
 * GET /api/v1/logistics
 */
exports.getAllLogistics = async (req, res, next) => {
  try {
    const { status, carrier, driver, startDate, endDate, page = 1, limit = 20 } = req.query;
    const query = {};
    
    if (status && status !== 'all') query.status = status;
    if (carrier && carrier !== 'all') query.carrier = carrier;
    if (driver) query.driver = driver;
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    
    const logistics = await Logistics.find(query)
      .populate('order', 'orderNumber total customer')
      .populate('driver', 'name email phone')
      .sort('-createdAt')
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    
    const total = await Logistics.countDocuments(query);
    
    // Get statistics
    const stats = await Logistics.getDeliveryStats(startDate, endDate);
    
    res.status(200).json({
      success: true,
      data: logistics,
      stats,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get logistics by ID
 * GET /api/v1/logistics/:id
 */
exports.getLogisticsById = async (req, res, next) => {
  try {
    const logistics = await Logistics.findById(req.params.id)
      .populate('order')
      .populate('driver', 'name email phone');
    
    if (!logistics) {
      return res.status(404).json({ success: false, message: 'Logistics record not found' });
    }
    
    res.status(200).json({
      success: true,
      data: logistics
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get logistics by order ID
 * GET /api/v1/logistics/order/:orderId
 */
exports.getLogisticsByOrder = async (req, res, next) => {
  try {
    const logistics = await Logistics.findOne({ order: req.params.orderId })
      .populate('order')
      .populate('driver', 'name email phone');
    
    if (!logistics) {
      return res.status(404).json({ success: false, message: 'Logistics record not found for this order' });
    }
    
    res.status(200).json({
      success: true,
      data: logistics
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update logistics status with tracking
 * PUT /api/v1/logistics/:id/status
 */
exports.updateLogisticsStatus = async (req, res, next) => {
  try {
    const { status, location, notes } = req.body;
    const logistics = await Logistics.findById(req.params.id);
    
    if (!logistics) {
      return res.status(404).json({ success: false, message: 'Logistics record not found' });
    }
    
    await logistics.updateStatus(status, location, notes, req.user._id);
    
    // Update associated order status if delivered
    if (status === 'delivered') {
      await Order.findByIdAndUpdate(logistics.order, { 
        status: 'delivered',
        deliveredAt: new Date()
      });
    } else if (status === 'in_transit') {
      await Order.findByIdAndUpdate(logistics.order, { status: 'shipped' });
    }
    
    res.status(200).json({
      success: true,
      message: 'Logistics status updated successfully',
      data: logistics
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Assign driver to shipment
 * PUT /api/v1/logistics/:id/assign-driver
 */
exports.assignDriver = async (req, res, next) => {
  try {
    const { driverId, driverName, driverPhone } = req.body;
    const logistics = await Logistics.findById(req.params.id);
    
    if (!logistics) {
      return res.status(404).json({ success: false, message: 'Logistics record not found' });
    }
    
    if (driverId) {
      const driver = await User.findById(driverId);
      if (!driver || driver.role !== 'logistics') {
        return res.status(400).json({ success: false, message: 'Invalid logistics driver' });
      }
      logistics.driver = driverId;
      logistics.driverName = driver.name;
      logistics.driverPhone = driver.phone;
    } else {
      logistics.driverName = driverName;
      logistics.driverPhone = driverPhone;
    }
    
    await logistics.save();
    
    res.status(200).json({
      success: true,
      message: 'Driver assigned successfully',
      data: logistics
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update tracking information
 * PUT /api/v1/logistics/:id/tracking
 */
exports.updateTracking = async (req, res, next) => {
  try {
    const { trackingNumber, carrier, estimatedDelivery } = req.body;
    const logistics = await Logistics.findById(req.params.id);
    
    if (!logistics) {
      return res.status(404).json({ success: false, message: 'Logistics record not found' });
    }
    
    if (trackingNumber) logistics.trackingNumber = trackingNumber;
    if (carrier) logistics.carrier = carrier;
    if (estimatedDelivery) logistics.estimatedDelivery = new Date(estimatedDelivery);
    
    await logistics.save();
    
    res.status(200).json({
      success: true,
      message: 'Tracking information updated',
      data: logistics
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get delivery statistics
 * GET /api/v1/logistics/stats/delivery
 */
exports.getDeliveryStats = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    
    const stats = await Logistics.getDeliveryStats(startDate, endDate);
    
    // Get on-time delivery rate
    const onTimeStats = await Logistics.aggregate([
      {
        $match: {
          status: 'delivered',
          actualDelivery: { $exists: true },
          estimatedDelivery: { $exists: true }
        }
      },
      {
        $project: {
          onTime: {
            $lte: ['$actualDelivery', '$estimatedDelivery']
          }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          onTime: { $sum: { $cond: ['$onTime', 1, 0] } }
        }
      }
    ]);
    
    const onTimeRate = onTimeStats[0] ? (onTimeStats[0].onTime / onTimeStats[0].total) * 100 : 0;
    
    res.status(200).json({
      success: true,
      data: {
        byStatus: stats,
        onTimeDeliveryRate: onTimeRate,
        totalDelivered: onTimeStats[0]?.total || 0
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Bulk update logistics status
 * POST /api/v1/logistics/bulk-update
 */
exports.bulkUpdateStatus = async (req, res, next) => {
  try {
    const { logisticsIds, status, notes } = req.body;
    
    const updates = await Promise.all(
      logisticsIds.map(async (id) => {
        const logistics = await Logistics.findById(id);
        if (logistics) {
          await logistics.updateStatus(status, null, notes, req.user._id);
          return { id, success: true };
        }
        return { id, success: false, error: 'Not found' };
      })
    );
    
    res.status(200).json({
      success: true,
      message: `Updated ${updates.filter(u => u.success).length} of ${logisticsIds.length} records`,
      data: updates
    });
  } catch (error) {
    next(error);
  }
};