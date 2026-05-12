const orderService = require('../services/order/order.service');
const { validationResult } = require('express-validator');

/**
 * Create a new order
 * POST /api/v1/orders
 */
exports.createOrder = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const orderData = { ...req.body, buyer: req.user.id };
    const order = await orderService.createOrder(orderData);
    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get orders for the authenticated user (buyer or seller)
 * GET /api/v1/orders
 */
exports.getOrders = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status, role } = req.query;
    const userId = req.user.id;
    const userRole = req.user.role;

    const result = await orderService.getOrders({
      userId,
      userRole,
      page,
      limit,
      status,
      role, // 'buyer' or 'seller' filter
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
 * Get single order by ID
 * GET /api/v1/orders/:id
 */
exports.getOrderById = async (req, res, next) => {
  try {
    const order = await orderService.getOrderById(req.params.id, req.user.id, req.user.role);
    res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Cancel order (before payment or by seller)
 * PUT /api/v1/orders/:id/cancel
 */
exports.cancelOrder = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const order = await orderService.cancelOrder(req.params.id, req.user.id, req.user.role, reason);
    res.status(200).json({
      success: true,
      message: 'Order cancelled successfully',
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Confirm delivery (buyer confirms receipt)
 * PUT /api/v1/orders/:id/confirm-delivery
 */
exports.confirmDelivery = async (req, res, next) => {
  try {
    const order = await orderService.confirmDelivery(req.params.id, req.user.id);
    res.status(200).json({
      success: true,
      message: 'Delivery confirmed, escrow will be released in 72 hours',
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update order status (seller or admin)
 * PUT /api/v1/orders/:id/status
 */
exports.updateOrderStatus = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { status } = req.body;
    const order = await orderService.updateOrderStatus(req.params.id, req.user.id, req.user.role, status);

    res.status(200).json({
      success: true,
      message: 'Order status updated successfully',
      data: order,
    });
  } catch (error) {
    next(error);
  }
};
