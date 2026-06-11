const Transaction = require('../models/Transaction.model');
const mongoose = require('mongoose');

class TransactionService {
  /**
   * Create a new transaction with balance tracking
   */
  async createTransaction(userId, data, session = null) {
    const options = session ? { session } : {};
    
    // Get current balance
    const currentBalance = await Transaction.getUserBalance(userId);
    
    const transaction = new Transaction({
      user: userId,
      balanceBefore: currentBalance,
      balanceAfter: this.calculateNewBalance(currentBalance, data.type, data.amount),
      ...data,
    });
    
    await transaction.save(options);
    return transaction;
  }

  /**
   * Calculate new balance based on transaction type
   */
  calculateNewBalance(currentBalance, type, amount) {
    const creditTypes = ['deposit', 'refund', 'escrow_release', 'commission', 'group_buy_payout'];
    if (creditTypes.includes(type)) {
      return currentBalance + amount;
    }
    return currentBalance - amount;
  }

  /**
   * Get user transactions with pagination and filters
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
   * Get transaction by ID with permission check
   */
  async getTransactionById(transactionId, userId, isAdmin = false) {
    const transaction = await Transaction.findById(transactionId)
      .populate('user', 'name email phone')
      .populate('orderId', 'orderNumber totalAmount status')
      .populate('processedBy', 'name email');
    
    if (!transaction) {
      throw new Error('Transaction not found');
    }
    
    // Check permission
    if (!isAdmin && transaction.user.toString() !== userId.toString()) {
      throw new Error('Unauthorized to view this transaction');
    }
    
    return transaction;
  }

  /**
   * Reverse a transaction (refund)
   */
  async reverseTransaction(transactionId, userId, reason, isAdmin = false) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      const originalTx = await Transaction.findById(transactionId).session(session);
      
      if (!originalTx) {
        throw new Error('Transaction not found');
      }
      
      if (!isAdmin && originalTx.user.toString() !== userId.toString()) {
        throw new Error('Unauthorized to reverse this transaction');
      }
      
      if (originalTx.status === 'reversed') {
        throw new Error('Transaction already reversed');
      }
      
      if (originalTx.status !== 'completed') {
        throw new Error('Cannot reverse a pending or failed transaction');
      }
      
      // Create reversal transaction
      const reversalType = originalTx.type === 'payment' ? 'refund' : 
                          originalTx.type === 'withdrawal' ? 'deposit' : 
                          `reverse_${originalTx.type}`;
      
      const reversalTx = await this.createTransaction(
        originalTx.user,
        {
          type: reversalType,
          amount: originalTx.amount,
          reference: `REV_${originalTx.reference || originalTx._id}`,
          description: `Reversal of transaction ${originalTx._id}: ${reason}`,
          status: 'completed',
          relatedTransactionId: originalTx._id,
          processedBy: userId,
          reversalReason: reason,
          metadata: {
            reversedTransactionId: originalTx._id,
            reversedAt: new Date(),
            reversedBy: userId,
            reversalReason: reason,
          },
        },
        session
      );
      
      // Update original transaction
      originalTx.status = 'reversed';
      originalTx.reversalReason = reason;
      originalTx.metadata = {
        ...originalTx.metadata,
        reversedBy: userId,
        reversedAt: new Date(),
        reversalTransactionId: reversalTx._id,
      };
      await originalTx.save({ session });
      
      await session.commitTransaction();
      
      return { originalTransaction: originalTx, reversalTransaction: reversalTx };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Get transaction summary for dashboard
   */
  async getTransactionSummary(userId, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const transactions = await Transaction.find({
      user: userId,
      status: 'completed',
      createdAt: { $gte: startDate },
    });
    
    const summary = {
      totalCredit: 0,
      totalDebit: 0,
      netChange: 0,
      byType: {},
      daily: {},
    };
    
    transactions.forEach(tx => {
      const isCredit = ['deposit', 'refund', 'escrow_release', 'commission', 'group_buy_payout'].includes(tx.type);
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
    
    return summary;
  }

  /**
   * Bulk create transactions (for batch processing)
   */
  async bulkCreateTransactions(transactionsData, session = null) {
    const options = session ? { session } : {};
    
    const transactions = [];
    for (const data of transactionsData) {
      const currentBalance = await Transaction.getUserBalance(data.user);
      const transaction = new Transaction({
        balanceBefore: currentBalance,
        balanceAfter: this.calculateNewBalance(currentBalance, data.type, data.amount),
        ...data,
      });
      transactions.push(transaction);
    }
    
    if (transactions.length > 0) {
      await Transaction.insertMany(transactions, options);
    }
    
    return transactions;
  }

  /**
   * Get pending transactions
   */
  async getPendingTransactions(olderThanMinutes = 30) {
    const cutoffTime = new Date();
    cutoffTime.setMinutes(cutoffTime.getMinutes() - olderThanMinutes);
    
    return Transaction.find({
      status: 'pending',
      createdAt: { $lte: cutoffTime },
    });
  }

  /**
   * Update transaction status
   */
  async updateTransactionStatus(transactionId, status, metadata = {}) {
    const transaction = await Transaction.findById(transactionId);
    
    if (!transaction) {
      throw new Error('Transaction not found');
    }
    
    transaction.status = status;
    transaction.metadata = { ...transaction.metadata, ...metadata };
    
    await transaction.save();
    
    return transaction;
  }
}

module.exports = new TransactionService();
