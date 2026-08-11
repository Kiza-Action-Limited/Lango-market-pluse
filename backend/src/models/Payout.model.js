const mongoose = require('mongoose');

const PayoutSchema = new mongoose.Schema(
  {
    escrow: { type: mongoose.Schema.Types.ObjectId, ref: 'Escrow', index: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', index: true },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    role: {
      type: String,
      enum: ['seller', 'driver', 'fleet_owner', 'buyer_refund', 'platform', 'sinking_fund'],
      required: true,
      index: true,
    },
    channel: { type: String, enum: ['wallet', 'mpesa_b2c', 'manual'], default: 'wallet' },
    amount: { type: Number, min: 0, required: true },
    amountMinor: { type: Number, min: 0, required: true },
    currency: { type: String, default: 'KES' },
    status: {
      type: String,
      enum: ['pending', 'queued', 'submitted', 'completed', 'failed', 'timeout', 'cancelled'],
      default: 'pending',
      index: true,
    },
    originatorConversationId: { type: String, trim: true },
    conversationId: { type: String, trim: true, index: true },
    mpesaReceiptNumber: String,
    failureReason: String,
    requestedAt: { type: Date, default: Date.now },
    submittedAt: Date,
    completedAt: Date,
    metadata: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

PayoutSchema.index({ order: 1, recipient: 1, role: 1, status: 1 });
PayoutSchema.index({ originatorConversationId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Payout', PayoutSchema);
