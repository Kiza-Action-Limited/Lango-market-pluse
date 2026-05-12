const groupBuyService = require('../services/logistics/groupBuy.service');
const { validationResult } = require('express-validator');

/**
 * Create a group buy (initiated by buyer)
 * POST /api/v1/groupbuy
 */
exports.createGroupBuy = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const groupBuyData = { ...req.body, initiator: req.user.id };
    const groupBuy = await groupBuyService.createGroupBuy(groupBuyData);
    res.status(201).json({
      success: true,
      message: 'Group buy created successfully',
      data: groupBuy,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Join an existing group buy
 * POST /api/v1/groupbuy/:id/join
 */
exports.joinGroupBuy = async (req, res, next) => {
  try {
    const { quantity } = req.body;
    const groupBuy = await groupBuyService.joinGroupBuy(req.params.id, req.user.id, quantity);
    res.status(200).json({
      success: true,
      message: 'Joined group buy successfully',
      data: groupBuy,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all active group buys
 * GET /api/v1/groupbuy
 */
exports.getGroupBuys = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status = 'active' } = req.query;
    const result = await groupBuyService.getGroupBuys({ page, limit, status });
    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get group buy details by ID
 * GET /api/v1/groupbuy/:id
 */
exports.getGroupBuyById = async (req, res, next) => {
  try {
    const groupBuy = await groupBuyService.getGroupBuyById(req.params.id);
    res.status(200).json({
      success: true,
      data: groupBuy,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Fulfill group buy (automatically called when target reached)
 * POST /api/v1/groupbuy/:id/fulfill
 */
exports.fulfillGroupBuy = async (req, res, next) => {
  try {
    const result = await groupBuyService.fulfillGroupBuy(req.params.id);
    res.status(200).json({
      success: true,
      message: 'Group buy fulfilled, orders being created',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};