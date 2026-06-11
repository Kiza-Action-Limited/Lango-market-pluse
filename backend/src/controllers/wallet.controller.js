const walletService = require('../services/payment/wallet.service');
const ledgerService = require('../services/payment/ledger.service');
const { validationResult } = require('express-validator');

/**
 * Get wallet balance
 * GET /api/v1/wallet/balance
 */
exports.getBalance = async (req, res, next) => {
  try {
    const balance = await walletService.getBalance(req.user.id);
    res.status(200).json({
      success: true,
      data: { balance },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get wallet details
 * GET /api/v1/wallet
 */
exports.getWalletDetails = async (req, res, next) => {
  try {
    const wallet = await walletService.getWallet(req.user.id);
    res.status(200).json({
      success: true,
      data: wallet,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Transfer funds to another user
 * POST /api/v1/wallet/transfer
 */
exports.transfer = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { toUserId, amount, description } = req.body;
    const transaction = await walletService.transfer(
      req.user.id,
      toUserId,
      amount,
      description
    );

    res.status(200).json({
      success: true,
      message: 'Transfer successful',
      data: transaction,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Withdraw to M-Pesa
 * POST /api/v1/wallet/withdraw
 */
exports.withdraw = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { amount, phoneNumber } = req.body;
    const result = await walletService.withdraw(
      req.user.id,
      amount,
      phoneNumber
    );

    res.status(200).json({
      success: true,
      message: 'Withdrawal initiated',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get transaction history
 * GET /api/v1/wallet/transactions
 */
exports.getTransactionHistory = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, type, status } = req.query;
    const result = await ledgerService.getTransactions(req.user.id, {
      page,
      limit,
      type,
      status,
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
 * Add funds to wallet
 * POST /api/v1/wallet/add-funds
 */
exports.addFunds = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { amount, paymentMethod, description } = req.body;
    const result = await walletService.addFunds(
      req.user.id,
      amount,
      paymentMethod,
      description
    );

    res.status(200).json({
      success: true,
      message: 'Funds added successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Lock wallet funds (for escrow)
 * POST /api/v1/wallet/lock
 */
exports.lockFunds = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { amount, orderId, reason } = req.body;
    const result = await walletService.lockFunds(
      req.user.id,
      amount,
      orderId,
      reason
    );

    res.status(200).json({
      success: true,
      message: 'Funds locked successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Unlock wallet funds (after escrow release)
 * POST /api/v1/wallet/unlock
 */
exports.unlockFunds = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { orderId, amount } = req.body;
    const result = await walletService.unlockFunds(req.user.id, orderId, amount);

    res.status(200).json({
      success: true,
      message: 'Funds unlocked successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get wallet statement
 * GET /api/v1/wallet/statement
 */
exports.getStatement = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const statement = await walletService.getStatement(
      req.user.id,
      startDate,
      endDate
    );

    res.status(200).json({
      success: true,
      data: statement,
    });
  } catch (error) {
    next(error);
  }
};
