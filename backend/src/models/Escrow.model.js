const mongoose = require('mongoose');

const payoutSchema = new mongoose.Schema(
  {
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    role: {
      type: String,
      enum: ['seller', 'driver', 'fleet_owner', 'buyer_refund'],
      required: true,
    },
    amount: { type: Number, min: 0, default: 0 },
    mpesaConversationId: { type: String, trim: true },
    mpesaTransactionId: { type: String, trim: true },
    status: {
      type: String,
      enum: ['pending', 'queued', 'sent', 'completed', 'failed'],
      default: 'pending',
      index: true,
    },
    failureReason: { type: String, trim: true },
    requestedAt: Date,
    completedAt: Date,
  },
  { _id: true }
);

const escrowSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      unique: true,
      index: true,
    },
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    logistics: { type: mongoose.Schema.Types.ObjectId, ref: 'Logistics', index: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'KES' },
    status: {
      type: String,
      enum: [
        'AWAITING_PAYMENT',
        'HELD',
        'IN_TRANSIT',
        'DELIVERED',
        'DISPUTED',
        'RELEASED',
        'REFUNDED',
        'PARTIAL_REFUND',
        'FAILED',
        'EXPIRED',
      ],
      default: 'AWAITING_PAYMENT',
      index: true,
    },
    mpesaCheckoutId: { type: String, trim: true, sparse: true, index: true },
    merchantRequestId: { type: String, trim: true },
    mpesaReceiptNumber: { type: String, trim: true },
    paidAt: Date,
    heldAt: Date,
    deliveredAt: Date,
    autoReleaseAt: Date,
    releasedAt: Date,
    refundedAt: Date,
    platformFeeRate: { type: Number, min: 0, max: 1, default: 0.075 },
    platformFee: { type: Number, min: 0, default: 0 },
    sellerPayout: { type: Number, min: 0, default: 0 },
    driverPayout: { type: Number, min: 0, default: 0 },
    sinkingFundAmount: { type: Number, min: 0, default: 0 },
    refundAmount: { type: Number, min: 0, default: 0 },
    payoutDestination: {
      driverType: { type: String, enum: ['solo', 'fleet', 'none'], default: 'none' },
      driverRecipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      recipientPhone: { type: String, trim: true },
    },
    payouts: [payoutSchema],
    metadata: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

escrowSchema.index({ status: 1, autoReleaseAt: 1 });
escrowSchema.index({ buyer: 1, createdAt: -1 });
escrowSchema.index({ seller: 1, createdAt: -1 });

module.exports = mongoose.model('Escrow', escrowSchema);
