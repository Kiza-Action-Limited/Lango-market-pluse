const mongoose = require('mongoose');

const WalletEntrySchema = new mongoose.Schema(
  {
    wallet: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallet', index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    direction: { type: String, enum: ['credit', 'debit'], required: true, index: true },
    type: { type: String, required: true, trim: true, index: true },
    amount: { type: Number, min: 0, required: true },
    amountMinor: { type: Number, min: 0, required: true },
    balanceBefore: { type: Number, min: 0, default: 0 },
    balanceBeforeMinor: { type: Number, min: 0, default: 0 },
    balanceAfter: { type: Number, min: 0, default: 0 },
    balanceAfterMinor: { type: Number, min: 0, default: 0 },
    reference: { type: String, trim: true, index: true },
    idempotencyKey: { type: String, trim: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', index: true },
    relatedTransaction: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'reversed'],
      default: 'completed',
      index: true,
    },
    description: String,
    metadata: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

WalletEntrySchema.index({ user: 1, createdAt: -1 });
WalletEntrySchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });

WalletEntrySchema.pre(['updateOne', 'updateMany', 'findOneAndUpdate', 'deleteOne', 'deleteMany', 'findOneAndDelete'], function () {
  throw new Error('Wallet entries are append-only records and cannot be updated or deleted');
});

module.exports = mongoose.model('WalletEntry', WalletEntrySchema);
