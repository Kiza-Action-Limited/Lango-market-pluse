const Dispute = require('../models/Dispute.model');
const Order = require('../models/Order.model');
const Escrow = require('../models/Escrow.model');
const { validationResult } = require('express-validator');

/**
 * Create a new dispute
 * POST /api/v1/disputes
 */
exports.createDispute = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { orderId, reason, description, evidence, evidenceUrls } = req.body;

    // Check if order exists
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Check if user is involved in the order
    const userId = req.user.id;
    const isBuyer = order.buyer.toString() === userId;
    const isSeller = order.seller.toString() === userId;

    if (!isBuyer && !isSeller) {
      return res.status(403).json({ success: false, message: 'Not authorized to create dispute for this order' });
    }

    // Check if dispute already exists for this order
    const existingDispute = await Dispute.findOne({ order: orderId, status: { $ne: 'closed' } });
    if (existingDispute) {
      return res.status(400).json({ success: false, message: 'A dispute already exists for this order' });
    }

    // Find escrow for this order
    const escrow = await Escrow.findOne({ order: orderId });
    if (!escrow) {
      return res.status(404).json({ success: false, message: 'Escrow not found for this order' });
    }

    // Create dispute
    const dispute = new Dispute({
      order: orderId,
      escrow: escrow._id,
      raisedBy: userId,
      reason,
      description,
      evidence: evidence || [],
      evidenceUrls: evidenceUrls || [],
      status: 'open',
    });

    await dispute.save();

    // Update escrow status
    escrow.status = 'disputed';
    await escrow.save();

    // Add initial message
    dispute.messages.push({
      sender: userId,
      message: `Dispute created: ${reason}. ${description || 'No description provided.'}`,
      timestamp: new Date(),
      isAdmin: false,
    });
    await dispute.save();

    res.status(201).json({
      success: true,
      data: dispute,
      message: 'Dispute created successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all disputes with filters
 * GET /api/v1/disputes
 */
exports.getDisputes = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      reason,
      orderId,
      raisedBy,
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = -1,
    } = req.query;

    const query = {};

    // Role-based filtering
    if (req.user.role !== 'admin') {
      // Users can only see disputes they're involved in
      const userOrders = await Order.find({
        $or: [{ buyer: req.user.id }, { seller: req.user.id }]
      }).select('_id');
      
      const orderIds = userOrders.map(o => o._id);
      query.order = { $in: orderIds };
    }

    if (status) query.status = status;
    if (reason) query.reason = reason;
    if (orderId) query.order = orderId;
    if (raisedBy) query.raisedBy = raisedBy;

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;

    const [disputes, total] = await Promise.all([
      Dispute.find(query)
        .populate('order', 'orderNumber totalAmount status buyer seller')
        .populate('raisedBy', 'name email phone')
        .populate('faultParty', 'name email')
        .populate('resolvedBy', 'name email')
        .populate('messages.sender', 'name email role')
        .sort({ [sortBy]: parseInt(sortOrder) })
        .skip(skip)
        .limit(parseInt(limit)),
      Dispute.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: disputes,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get dispute by ID
 * GET /api/v1/disputes/:id
 */
exports.getDisputeById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const dispute = await Dispute.findById(id)
      .populate('order', 'orderNumber totalAmount status items shippingAddress buyer seller')
      .populate('escrow', 'amount status')
      .populate('raisedBy', 'name email phone avatar')
      .populate('faultParty', 'name email')
      .populate('resolvedBy', 'name email')
      .populate('messages.sender', 'name email role avatar');

    if (!dispute) {
      return res.status(404).json({ success: false, message: 'Dispute not found' });
    }

    // Check authorization
    const order = await Order.findById(dispute.order);
    if (req.user.role !== 'admin' && 
        order.buyer.toString() !== req.user.id && 
        order.seller.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to view this dispute' });
    }

    res.status(200).json({
      success: true,
      data: dispute,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Add message to dispute
 * POST /api/v1/disputes/:id/messages
 */
exports.addMessage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ success: false, message: 'Message is required' });
    }

    const dispute = await Dispute.findById(id);
    if (!dispute) {
      return res.status(404).json({ success: false, message: 'Dispute not found' });
    }

    // Check authorization
    const order = await Order.findById(dispute.order);
    const isAdmin = req.user.role === 'admin';
    const isBuyer = order.buyer.toString() === req.user.id;
    const isSeller = order.seller.toString() === req.user.id;

    if (!isAdmin && !isBuyer && !isSeller) {
      return res.status(403).json({ success: false, message: 'Not authorized to add messages' });
    }

    // Add message
    dispute.messages.push({
      sender: req.user.id,
      message,
      timestamp: new Date(),
      isAdmin: isAdmin,
    });

    // If dispute is open and admin messages, change status to under_review
    if (isAdmin && dispute.status === 'open') {
      dispute.status = 'under_review';
    }

    await dispute.save();

    res.status(200).json({
      success: true,
      data: dispute.messages[dispute.messages.length - 1],
      message: 'Message added successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Add evidence to dispute
 * POST /api/v1/disputes/:id/evidence
 */
exports.addEvidence = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { evidence, evidenceUrl } = req.body;

    const dispute = await Dispute.findById(id);
    if (!dispute) {
      return res.status(404).json({ success: false, message: 'Dispute not found' });
    }

    // Check authorization
    const order = await Order.findById(dispute.order);
    const isBuyer = order.buyer.toString() === req.user.id;
    const isSeller = order.seller.toString() === req.user.id;

    if (req.user.role !== 'admin' && !isBuyer && !isSeller) {
      return res.status(403).json({ success: false, message: 'Not authorized to add evidence' });
    }

    if (evidence) {
      dispute.evidence.push(evidence);
    }
    if (evidenceUrl) {
      dispute.evidenceUrls.push(evidenceUrl);
    }

    dispute.messages.push({
      sender: req.user.id,
      message: `Evidence added to dispute`,
      timestamp: new Date(),
      isAdmin: req.user.role === 'admin',
    });

    await dispute.save();

    res.status(200).json({
      success: true,
      data: { evidence: dispute.evidence, evidenceUrls: dispute.evidenceUrls },
      message: 'Evidence added successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Resolve dispute (admin only)
 * PUT /api/v1/disputes/:id/resolve
 */
exports.resolveDispute = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      resolution,
      resolutionAmount,
      faultParty,
      notes,
    } = req.body;

    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const dispute = await Dispute.findById(id);
    if (!dispute) {
      return res.status(404).json({ success: false, message: 'Dispute not found' });
    }

    if (dispute.status === 'closed') {
      return res.status(400).json({ success: false, message: 'Dispute is already closed' });
    }

    const order = await Order.findById(dispute.order);
    const escrow = await Escrow.findById(dispute.escrow);

    // Update dispute resolution
    dispute.resolution = resolution;
 dispute.resolutionAmount = resolutionAmount;
    dispute.faultParty = faultParty;
    dispute.resolvedBy = req.user.id;
    dispute.resolvedAt = new Date();

    // Handle based on resolution type
    switch (resolution) {
      case 'refund_buyer':
        dispute.status = 'resolved_buyer';
        dispute.refundAmount = escrow.amount;
        
        // Update escrow
        escrow.status = 'refunded';
        escrow.refundAmount = escrow.amount;
        escrow.refundReason = 'Dispute resolved in buyer\'s favor';
        await escrow.save();
        break;

      case 'release_to_seller':
        dispute.status = 'resolved_seller';
        
        // Update escrow
        escrow.status = 'released';
        escrow.releasedAt = new Date();
        await escrow.save();
        break;

      case 'partial_refund':
        dispute.status = 'partial_refund';
        dispute.refundAmount = resolutionAmount || escrow.amount * 0.5;
        
        // Update escrow
        escrow.status = 'partial_refund';
        escrow.refundAmount = resolutionAmount || escrow.amount * 0.5;
        escrow.releasedAmount = escrow.amount - (resolutionAmount || escrow.amount * 0.5);
        await escrow.save();
        break;

      case 'cancelled':
        dispute.status = 'closed';
        escrow.status = 'cancelled';
        await escrow.save();
        break;
    }

    // Add resolution message
    dispute.messages.push({
      sender: req.user.id,
      message: `Dispute resolved: ${resolution}. ${notes || 'No additional notes.'}`,
      timestamp: new Date(),
      isAdmin: true,
    });

    await dispute.save();

    res.status(200).json({
      success: true,
      data: dispute,
      message: 'Dispute resolved successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update dispute status
 * PUT /api/v1/disputes/:id/status
 */
exports.updateStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const dispute = await Dispute.findById(id);
    if (!dispute) {
      return res.status(404).json({ success: false, message: 'Dispute not found' });
    }

    dispute.status = status;

    dispute.messages.push({
      sender: req.user.id,
      message: `Dispute status updated to: ${status}`,
      timestamp: new Date(),
      isAdmin: true,
    });

    await dispute.save();

    res.status(200).json({
      success: true,
      data: dispute,
      message: 'Dispute status updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get dispute statistics
 * GET /api/v1/disputes/stats
 */
exports.getDisputeStats = async (req, res, next) => {
  try {
    let query = {};

    // Non-admins only see their own disputes
    if (req.user.role !== 'admin') {
      const userOrders = await Order.find({
        $or: [{ buyer: req.user.id }, { seller: req.user.id }]
      }).select('_id');
      const orderIds = userOrders.map(o => o._id);
      query.order = { $in: orderIds };
    }

    const stats = await Dispute.aggregate([
      { $match: query },
      {
        $facet: {
          totalDisputes: [{ $count: 'count' }],
          byStatus: [
            { $group: { _id: '$status', count: { $sum: 1 } } }
          ],
          byReason: [
            { $group: { _id: '$reason', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
          ],
          recentDisputes: [
            { $match: { createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } },
            { $count: 'count' }
          ],
          averageResolutionTime: [
            { $match: { resolvedAt: { $exists: true } } },
            {
              $project: {
                resolutionTime: { $subtract: ['$resolvedAt', '$createdAt'] }
              }
            },
            {
              $group: {
                _id: null,
                avgTime: { $avg: '$resolutionTime' }
              }
            }
          ]
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        total: stats[0].totalDisputes[0]?.count || 0,
        byStatus: stats[0].byStatus,
        byReason: stats[0].byReason,
        recent30Days: stats[0].recentDisputes[0]?.count || 0,
        averageResolutionTime: stats[0].averageResolutionTime[0]?.avgTime || null,
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get my disputes (for logged-in user)
 * GET /api/v1/disputes/my-disputes
 */
exports.getMyDisputes = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status } = req.query;

    // Get user's orders
    const userOrders = await Order.find({
      $or: [{ buyer: req.user.id }, { seller: req.user.id }]
    }).select('_id');

    const orderIds = userOrders.map(o => o._id);
    
    const query = { order: { $in: orderIds } };
    if (status) query.status = status;

    const skip = (page - 1) * limit;

    const [disputes, total] = await Promise.all([
      Dispute.find(query)
        .populate('order', 'orderNumber totalAmount status')
        .populate('raisedBy', 'name email')
        .populate('messages.sender', 'name email role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Dispute.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: disputes,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete/Close dispute (admin only)
 * DELETE /api/v1/disputes/:id
 */
exports.closeDispute = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }

    const dispute = await Dispute.findById(id);
    if (!dispute) {
      return res.status(404).json({ success: false, message: 'Dispute not found' });
    }

    dispute.status = 'closed';
    await dispute.save();

    res.status(200).json({
      success: true,
      message: 'Dispute closed successfully',
    });
  } catch (error) {
    next(error);
  }
};