const userService = require('../services/auth/user.service'); // to be created
const { validationResult } = require('express-validator');

/**
 * Get current user profile
 * GET /api/v1/users/me
 */
exports.getMe = async (req, res, next) => {
  try {
    const user = await userService.getUserById(req.user.id);
    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update current user profile
 * PUT /api/v1/users/me
 */
exports.updateMe = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const updatedUser = await userService.updateUser(req.user.id, req.body);
    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get user by ID (admin only)
 * GET /api/v1/users/:id
 */
exports.getUserById = async (req, res, next) => {
  try {
    const user = await userService.getUserById(req.params.id);
    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all users with pagination (admin only)
 * GET /api/v1/users
 */
exports.getAllUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, role, isActive } = req.query;
    const result = await userService.getAllUsers({ page, limit, role, isActive });
    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update user wallet balance (admin only)
 * PUT /api/v1/users/:id/wallet
 */
exports.updateWallet = async (req, res, next) => {
  try {
    const { amount, operation } = req.body; // operation: 'credit' or 'debit'
    const updated = await userService.updateWallet(req.params.id, amount, operation);
    res.status(200).json({
      success: true,
      message: 'Wallet updated successfully',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Deactivate user account
 * DELETE /api/v1/users/me
 */
exports.deactivateAccount = async (req, res, next) => {
  try {
    await userService.deactivateUser(req.user.id);
    res.status(200).json({
      success: true,
      message: 'Account deactivated successfully',
    });
  } catch (error) {
    next(error);
  }
};