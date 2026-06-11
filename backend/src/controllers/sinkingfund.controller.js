const SinkingFund = require('../models/SinkingFund.model');
const Logistics = require('../models/Logistics.model');
const Order = require('../models/Order.model');
const { validationResult } = require('express-validator');

/**
 * Get driver's sinking fund
 * GET /api/v1/sinking-fund/:driverId
 */
exports.getSinkingFund = async (req, res, next) => {
  try {
    const { driverId } = req.params;

    // Check authorization
    if (req.user.role !== 'admin' && req.user.id !== driverId) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const sinkingFund = await SinkingFund.findOne({ driver: driverId })
      .populate('driver', 'name phone email');

    if (!sinkingFund) {
      return res.status(404).json({ success: false, message: 'Sinking fund not found' });
    }

    res.status(200).json({
      success: true,
      data: sinkingFund,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get current driver's sinking fund
 * GET /api/v1/sinking-fund/me
 */
exports.getMyFund = async (req, res, next) => {
  try {
    let sinkingFund = await SinkingFund.findOne({ driver: req.user.id })
      .populate('driver', 'name phone email');

    if (!sinkingFund) {
      // Create if doesn't exist
      sinkingFund = await SinkingFund.create({ driver: req.user.id });
      sinkingFund = await sinkingFund.populate('driver', 'name phone email');
    }

    res.status(200).json({
      success: true,
      data: sinkingFund,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Record contribution to sinking fund
 * POST /api/v1/sinking-fund/contribute
 */
exports.contributeToFund = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { driverId, amount, orderId, logisticsId } = req.body;

    // Check authorization
    if (req.user.role !== 'admin' && req.user.id !== driverId) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    let sinkingFund = await SinkingFund.findOne({ driver: driverId });
    if (!sinkingFund) {
      sinkingFund = await SinkingFund.create({ driver: driverId });
    }

    // Calculate driver share (typically 20% of contribution goes to driver)
    const driverShare = amount * 0.2;

    // Add contribution
    sinkingFund.contributions.push({
      order: orderId,
      logistics: logisticsId,
      amount,
      driverShare,
      contributedAt: new Date(),
    });

    sinkingFund.balance += amount;
    sinkingFund.totalContributed += amount;
    await sinkingFund.save();

    res.status(200).json({
      success: true,
      message: 'Contribution recorded successfully',
      data: sinkingFund,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update mileage
 * POST /api/v1/sinking-fund/update-mileage
 */
exports.updateMileage = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { driverId, mileageKm } = req.body;

    // Check authorization
    if (req.user.role !== 'admin' && req.user.id !== driverId) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    let sinkingFund = await SinkingFund.findOne({ driver: driverId });
    if (!sinkingFund) {
      sinkingFund = await SinkingFund.create({ driver: driverId });
    }

    const oldMileage = sinkingFund.mileageKm;
    sinkingFund.mileageKm = mileageKm;

    // Check if service is due (every 5000 km)
    const mileageSinceLastService = mileageKm - (oldMileage % sinkingFund.nextServiceKm);
    if (mileageSinceLastService >= sinkingFund.nextServiceKm) {
      sinkingFund.lastServiceAlertAt = new Date();
      sinkingFund.nextServiceKm = mileageKm + 5000;
    }

    await sinkingFund.save();

    res.status(200).json({
      success: true,
      message: 'Mileage updated successfully',
      data: sinkingFund,
      serviceAlert: sinkingFund.lastServiceAlertAt ? 'Service is due' : null,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Withdraw from sinking fund
 * POST /api/v1/sinking-fund/withdraw
 */
exports.withdrawFunds = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { driverId, amount, reason } = req.body;

    // Check authorization
    if (req.user.role !== 'admin' && req.user.id !== driverId) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const sinkingFund = await SinkingFund.findOne({ driver: driverId });
    if (!sinkingFund) {
      return res.status(404).json({ success: false, message: 'Sinking fund not found' });
    }

    if (sinkingFund.balance < amount) {
      return res.status(400).json({ success: false, message: 'Insufficient balance' });
    }

    sinkingFund.balance -= amount;
    sinkingFund.metadata = sinkingFund.metadata || {};
    sinkingFund.metadata.lastWithdrawal = {
      amount,
      reason,
      date: new Date(),
    };

    await sinkingFund.save();

    res.status(200).json({
      success: true,
      message: 'Withdrawal successful',
      data: {
        amount,
        newBalance: sinkingFund.balance,
        reason,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get contribution history
 * GET /api/v1/sinking-fund/:driverId/contributions
 */
exports.getContributions = async (req, res, next) => {
  try {
    const { driverId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    // Check authorization
    if (req.user.role !== 'admin' && req.user.id !== driverId) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const sinkingFund = await SinkingFund.findOne({ driver: driverId });
    if (!sinkingFund) {
      return res.status(404).json({ success: false, message: 'Sinking fund not found' });
    }

    const skip = (page - 1) * limit;
    const contributions = sinkingFund.contributions
      .sort((a, b) => b.contributedAt - a.contributedAt)
      .slice(skip, skip + limit);

    res.status(200).json({
      success: true,
      data: contributions,
      pagination: {
        page,
        limit,
        total: sinkingFund.contributions.length,
        pages: Math.ceil(sinkingFund.contributions.length / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all drivers' sinking funds (admin only)
 * GET /api/v1/sinking-fund/admin/all
 */
exports.getAllFunds = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin only' });
    }

    const { page = 1, limit = 20, sortBy = 'balance' } = req.query;

    const skip = (page - 1) * limit;

    const [funds, total] = await Promise.all([
      SinkingFund.find()
        .populate('driver', 'name phone email')
        .sort({ [sortBy]: -1 })
        .skip(skip)
        .limit(limit),
      SinkingFund.countDocuments(),
    ]);

    // Calculate totals
    const totalBalance = funds.reduce((sum, fund) => sum + fund.balance, 0);
    const totalContributed = funds.reduce((sum, fund) => sum + fund.totalContributed, 0);

    res.status(200).json({
      success: true,
      data: funds,
      totals: {
        totalBalance,
        totalContributed,
      },
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get service alerts (drivers needing maintenance)
 * GET /api/v1/sinking-fund/service-alerts
 */
exports.getServiceAlerts = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin only' });
    }

    const alerts = await SinkingFund.find({
      $expr: { $gte: ['$mileageKm', '$nextServiceKm'] },
    }).populate('driver', 'name phone email vehicleInfo');

    res.status(200).json({
      success: true,
      data: alerts,
      count: alerts.length,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get sinking fund analytics
 * GET /api/v1/sinking-fund/analytics
 */
exports.getAnalytics = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin only' });
    }

    const stats = await SinkingFund.aggregate([
      {
        $group: {
          _id: null,
          totalFunds: { $sum: '$balance' },
          totalContributed: { $sum: '$totalContributed' },
          averageBalance: { $avg: '$balance' },
          maxBalance: { $max: '$balance' },
          minBalance: { $min: '$balance' },
          totalDrivers: { $sum: 1 },
          averageMileage: { $avg: '$mileageKm' },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: stats[0] || {},
    });
  } catch (error) {
    next(error);
  }
};
