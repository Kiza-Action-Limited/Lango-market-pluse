const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        'deposit',
        'withdrawal',
        'payment',
        'refund',
        'escrow_hold',
        'escrow_release',
        'fee',
        'subscription_payment',
        'sms_topup',
        'commission',
        'sinking_fund',
        'group_buy_payout',
        'payout',
      ],
      required: true,
    },
    balanceBefore: {
      type: Number,
      default: 0,
    },
    amount: {
      type: Number,
      required: true,
    },
    balanceAfter: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: 'KES',
    },
    reference: {
      type: String, // Order ID, M-Pesa reference, etc.
      index: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      index: true,
    },
    relatedTransactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
    },
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    reversalReason: String,
    description: String,
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'reversed'],
      default: 'completed',
    },
  },
  {
    timestamps: true,
  }
);

// Index for ledger queries
TransactionSchema.index({ user: 1, createdAt: -1 });

TransactionSchema.statics.getUserBalance = async function (userId) {
  const latest = await this.findOne({ user: userId }).sort({ createdAt: -1 });
  return latest?.balanceAfter || 0;
};

module.exports = mongoose.model('Transaction', TransactionSchema);
