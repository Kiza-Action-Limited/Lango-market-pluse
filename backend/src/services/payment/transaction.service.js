const Transaction = require('../../models/Transaction.model');
const Wallet = require('../../models/Wallet.model');
const mongoose = require('mongoose');

class TransactionService {
  /**
   * Get user transactions with filters
   */
  async getUserTransactions(userId, options = {}) {
    const {
      page = 1, 
      limit = 20,
      type = null,
      startDate = null,
      endDate = null,
      status = 'completed', 
      minAmount = null,
      maxAmount = null,
    } = options;

    const query = { user: userId };

    if (type) query.type = type;
    if (status) query.status = status;

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    if (minAmount || maxAmount) {
      query.amount = {};
      if (minAmount) query.amount.$gte = minAmount;
      if (maxAmount) query.amount.$lte = maxAmount;
    }

    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      Transaction.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('relatedTransactionId', 'type amount status')
        .lean(),
      Transaction.countDocuments(query),
    ]);

    return {
      transactions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get single transaction by ID
   */
  async getTransactionById(transactionId, userId, isAdmin = false) {
    const transaction = await Transaction.findById(transactionId)
      .populate('user', 'name email phone')
      .populate('orderId', 'orderNumber totalAmount status')
      .populate('processedBy', 'name email');

    if (!transaction) {
      throw new Error('Transaction not found');
    }

    if (!isAdmin && transaction.user.toString() !== userId.toString()) {
      throw new Error('Unauthorized to view this transaction');
    }

    return transaction;
  }

  /**
   * Get transaction summary
   */
  async getTransactionSummary(userId, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const transactions = await Transaction.find({
      user: userId,
      status: 'completed',
      createdAt: { $gte: startDate },
    }).lean();

    const summary = {
      totalCredit: 0,
      totalDebit: 0,
      netChange: 0,
      byType: {},
      daily: {},
      transactionCount: transactions.length,
    };

    transactions.forEach(tx => {
      const isCredit = [
        'deposit',
        'refund',
        'escrow_release',
        'commission',
        'group_buy_payout',
        'sinking_fund_withdrawal',
      ].includes(tx.type);
      const amount = tx.amount;

      if (isCredit) {
        summary.totalCredit += amount;
      } else {
        summary.totalDebit += amount;
      }

      // Group by type
      if (!summary.byType[tx.type]) {
        summary.byType[tx.type] = { count: 0, total: 0 };
      }
      summary.byType[tx.type].count++;
      summary.byType[tx.type].total += amount;

      // Group by day
      const day = tx.createdAt.toISOString().split('T')[0];
      if (!summary.daily[day]) {
        summary.daily[day] = { credit: 0, debit: 0 };
      }
      if (isCredit) {
        summary.daily[day].credit += amount;
      } else {
        summary.daily[day].debit += amount;
      }
    });

    summary.netChange = summary.totalCredit - summary.totalDebit;
    summary.period = {
      startDate: startDate.toISOString(),
      endDate: new Date().toISOString(),
      days,
    };

    return summary;
  }

  /**
   * Get current user balance
   */
  async getUserBalance(userId) {
    const wallet = await Wallet.findOne({ user: userId });
    if (!wallet) {
      return 0;
    }
    return wallet.balance;
  }

  /**
   * Reverse a transaction (refund)
   */
  async reverseTransaction(transactionId, userId, reason, isAdmin = false) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const originalTransaction = await Transaction.findById(transactionId).session(session);

      if (!originalTransaction) {
        throw new Error('Transaction not found');
      }

      // Check authorization
      if (!isAdmin && originalTransaction.user.toString() !== userId.toString()) {
        throw new Error('Unauthorized to reverse this transaction');
      }

      // Only allow reversing completed transactions
      if (originalTransaction.status !== 'completed') {
        throw new Error('Can only reverse completed transactions');
      }

      // Cannot reverse reversals
      if (originalTransaction.type === 'reversal') {
        throw new Error('Cannot reverse a reversal');
      }

      // Get wallet
      const wallet = await Wallet.findOne({ user: originalTransaction.user }).session(session);
      if (!wallet) {
        throw new Error('Wallet not found');
      }

      // Determine reversal type
      const isCredit = [
        'deposit',
        'refund',
        'escrow_release',
        'commission',
        'group_buy_payout',
      ].includes(originalTransaction.type);

      // Create reversal transaction
      const reversalTransaction = await Transaction.create(
        [
          {
            user: originalTransaction.user,
            type: 'reversal',
            amount: originalTransaction.amount,
            status: 'completed',
            reference: `REVERSAL_${originalTransaction._id}`,
            description: `Reversal of ${originalTransaction.type}: ${reason}`,
            relatedTransactionId: originalTransaction._id,
            balanceBefore: wallet.balance,
            processedBy: userId,
          },
        ],
        { session }
      );

      // Reverse the balance impact
      if (isCredit) {
        wallet.balance -= originalTransaction.amount;
      } else {
        wallet.balance += originalTransaction.amount;
      }

      reversalTransaction[0].balanceAfter = wallet.balance;
      await wallet.save({ session });
      await reversalTransaction[0].save({ session });

      // Mark original transaction as reversed
      originalTransaction.status = 'reversed';
      await originalTransaction.save({ session });

      await session.commitTransaction();

      return {
        originalTransaction,
        reversalTransaction: reversalTransaction[0],
      };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Get user's account balance
   */
  async getBalance(userId) {
    const wallet = await Wallet.findOne({ user: userId }).lean();
    return wallet ? wallet.balance : 0;
  }

  /**
   * Export transactions as CSV
   */
  async exportTransactions(userId, options = {}) {
    const { type, startDate, endDate } = options;

    const query = { user: userId, status: 'completed' };
    if (type) query.type = type;

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const transactions = await Transaction.find(query)
      .sort({ createdAt: -1 })
      .limit(10000)
      .lean();

    const csv = [
      ['Date', 'Type', 'Amount', 'Balance After', 'Status', 'Reference', 'Description'],
      ...transactions.map(tx => [
        new Date(tx.createdAt).toISOString(),
        tx.type,
        tx.amount.toFixed(2),
        tx.balanceAfter.toFixed(2),
        tx.status,
        tx.reference || 'N/A',
        tx.description || 'N/A',
      ]),
    ];

    return csv.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
  }
}

module.exports = new TransactionService();
