const transactionService = require('../services/payment/transaction.service');
const { validationResult } = require('express-validator');

/**
 * Get user's transaction history
 * GET /api/v1/transactions
 */
exports.getTransactions = async (req, res, next) => {
  try {
    const { page, limit, type, startDate, endDate, status, minAmount, maxAmount } = req.query;
    
    const result = await transactionService.getUserTransactions(req.user.id, {
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
      type,
      startDate,
      endDate,
      status,
      minAmount: minAmount ? parseFloat(minAmount) : null,
      maxAmount: maxAmount ? parseFloat(maxAmount) : null,
    });
    
    res.status(200).json({
      success: true,
      data: result.transactions,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single transaction by ID
 * GET /api/v1/transactions/:id
 */
exports.getTransactionById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const isAdmin = req.user.role === 'admin';
    
    const transaction = await transactionService.getTransactionById(id, req.user.id, isAdmin);
    
    res.status(200).json({
      success: true,
      data: transaction,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get transaction summary for dashboard
 * GET /api/v1/transactions/summary
 */
exports.getTransactionSummary = async (req, res, next) => {
  try {
    const { days = 30 } = req.query;
    
    const summary = await transactionService.getTransactionSummary(req.user.id, parseInt(days));
    
    res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reverse a transaction (refund)
 * POST /api/v1/transactions/:id/reverse
 */
exports.reverseTransaction = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { id } = req.params;
    const { reason } = req.body;
    const isAdmin = req.user.role === 'admin';
    
    const result = await transactionService.reverseTransaction(id, req.user.id, reason, isAdmin);
    
    res.status(200).json({
      success: true,
      message: 'Transaction reversed successfully',
      data: {
        originalTransaction: result.originalTransaction,
        reversalTransaction: result.reversalTransaction,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get user's current balance
 * GET /api/v1/transactions/balance
 */
exports.getBalance = async (req, res, next) => {
  try {
    const Transaction = require('../models/Transaction.model');
    const balance = await Transaction.getUserBalance(req.user.id);
    
    // Also get pending balance if needed
    const pendingTransactions = await Transaction.find({
      user: req.user.id,
      status: 'pending',
    });
    
    const pendingCredit = pendingTransactions
      .filter(tx => ['deposit', 'refund'].includes(tx.type))
      .reduce((sum, tx) => sum + tx.amount, 0);
    
    const pendingDebit = pendingTransactions
      .filter(tx => ['payment', 'withdrawal'].includes(tx.type))
      .reduce((sum, tx) => sum + tx.amount, 0);
    
    res.status(200).json({
      success: true,
      data: {
        availableBalance: balance,
        pendingBalance: pendingCredit - pendingDebit,
        totalBalance: balance + (pendingCredit - pendingDebit),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Export transactions as CSV
 * GET /api/v1/transactions/export
 */
exports.exportTransactions = async (req, res, next) => {
  try {
    const { startDate, endDate, type } = req.query;
    
    const result = await transactionService.getUserTransactions(req.user.id, {
      limit: 10000, // Max export limit
      type,
      startDate,
      endDate,
      status: 'completed',
    });
    
    const transactions = result.transactions;
    
    // Generate CSV
    const csvHeaders = ['ID', 'Date', 'Type', 'Amount', 'Currency', 'Balance Before', 'Balance After', 'Description', 'Reference', 'Status'];
    const csvRows = transactions.map(tx => [
      tx._id,
      tx.createdAt.toISOString(),
      tx.type,
      tx.amount,
      tx.currency,
      tx.balanceBefore,
      tx.balanceAfter,
      tx.description || '',
      tx.reference || '',
      tx.status,
    ]);
    
    const csvContent = [csvHeaders, ...csvRows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=transactions_${Date.now()}.csv`);
    res.status(200).send(csvContent);
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Get all transactions (system-wide)
 * GET /api/v1/transactions/admin/all
 */
exports.adminGetAllTransactions = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, userId, type, status, startDate, endDate } = req.query;
    
    const query = {};
    if (userId) query.user = userId;
    if (type) query.type = type;
    if (status) query.status = status;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const Transaction = require('../models/Transaction.model');
    const [transactions, total] = await Promise.all([
      Transaction.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate('user', 'name email phone')
        .populate('orderId', 'orderNumber')
        .lean(),
      Transaction.countDocuments(query),
    ]);
    
    res.status(200).json({
      success: true,
      data: transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Admin: Get system-wide transaction stats
 * GET /api/v1/transactions/admin/stats
 */
exports.adminGetTransactionStats = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    
    const match = { status: 'completed' };
    if (startDate || endDate) {
      match.createdAt = {};
      if (startDate) match.createdAt.$gte = new Date(startDate);
      if (endDate) match.createdAt.$lte = new Date(endDate);
    }
    
    const Transaction = require('../models/Transaction.model');
    const stats = await Transaction.aggregate([
      { $match: match },
      { $group: {
        _id: '$type',
        totalAmount: { $sum: '$amount' },
        count: { $sum: 1 },
        averageAmount: { $avg: '$amount' },
      }},
      { $sort: { totalAmount: -1 } },
    ]);
    
    const totals = await Transaction.aggregate([
      { $match: match },
      { $group: {
        _id: null,
        totalVolume: { $sum: '$amount' },
        totalCount: { $sum: 1 },
      }},
    ]);
    
    res.status(200).json({
      success: true,
      data: {
        summary: totals[0] || { totalVolume: 0, totalCount: 0 },
        breakdown: stats,
      },
    });
  } catch (error) {
    next(error);
  }
};