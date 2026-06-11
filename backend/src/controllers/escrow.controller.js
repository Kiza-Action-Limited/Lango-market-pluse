const escrowService = require('../services/order/escrow.service');
const { validationResult } = require('express-validator');

/**
 * Release escrow funds to the seller (admin only, or after dispute resolution)
 * POST /api/v1/escrow/release/:orderId
 * Access: Admin or system (auto-release job)
 */
exports.releaseEscrow = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { forceRelease = false } = req.body; // forceRelease bypasses 72h wait (admin only)
    
    // Check if user is admin for force release
    const isAdmin = req.user.role === 'admin';
    if (forceRelease && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only admins can force release escrow',
      });
    }

    const result = await escrowService.releasePayment(orderId, {
      releasedBy: req.user.id,
      forceRelease,
    });

    res.status(200).json({
      success: true,
      message: 'Escrow funds released successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Place escrow on hold (admin only, e.g., during dispute)
 * POST /api/v1/escrow/hold/:orderId
 * Access: Admin
 */
exports.holdEscrow = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { orderId } = req.params;
    const { reason } = req.body;

    // Only admin can hold escrow
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can place escrow on hold',
      });
    }

    const result = await escrowService.holdEscrow(orderId, reason, req.user.id);

    res.status(200).json({
      success: true,
      message: 'Escrow placed on hold',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get escrow status for an order (buyer, seller, or admin)
 * GET /api/v1/escrow/status/:orderId
 */
exports.getEscrowStatus = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    const status = await escrowService.getEscrowStatus(orderId, userId, userRole);

    res.status(200).json({
      success: true,
      data: status,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Partially release a portion of escrow (for partial deliveries)
 * POST /api/v1/escrow/partial-release/:orderId
 * Access: Admin or seller (with buyer consent in future)
 */
exports.partialRelease = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { orderId } = req.params;
    const { amount, reason } = req.body;

    // Only admin or seller can request partial release
    if (req.user.role !== 'admin' && req.user.role !== 'seller') {
      return res.status(403).json({
        success: false,
        message: 'Only admin or seller can request partial release',
      });
    }

    const result = await escrowService.partialRelease(orderId, amount, req.user.id, reason);

    res.status(200).json({
      success: true,
      message: `KES ${amount} released from escrow`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Cancel escrow and refund buyer (admin only, e.g., order cancellation)
 * POST /api/v1/escrow/cancel/:orderId
 * Access: Admin
 */
exports.cancelEscrow = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;

    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only admins can cancel escrow',
      });
    }

    const result = await escrowService.cancelEscrow(orderId, reason, req.user.id);

    res.status(200).json({
      success: true,
      message: 'Escrow cancelled and buyer refunded',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all escrow transactions for the authenticated user (buyer/seller)
 * GET /api/v1/escrow/transactions
 */
exports.getUserEscrowTransactions = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const userId = req.user.id;

    const result = await escrowService.getUserEscrowTransactions(userId, {
      page: parseInt(page),
      limit: parseInt(limit),
    });

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get escrow summary (total held, released, etc.)
 * GET /api/v1/escrow/summary
 */
exports.getEscrowSummary = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const summary = await escrowService.getEscrowSummary(userId);
    res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (error) {
    next(error);
  }
};

exports.resolveDispute = async (req, res, next) => {
  try {
    const result = await escrowService.resolveDispute(req.params.id, req.user.id, req.body);
    res.status(200).json({
      success: true,
      message: 'Dispute resolved',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
