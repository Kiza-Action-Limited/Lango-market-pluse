const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'KES',
      enum: ['KES', 'USD'],
    },
    paymentMethod: {
      type: String,
      enum: ['verto'],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed', 'refunded', 'cancelled'],
      default: 'pending',
      index: true,
    },
    transactionId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    provider: {
      type: String,
      trim: true,
      index: true,
    },
    providerPaymentReference: {
      type: String,
      trim: true,
      index: true,
      unique: true,
      sparse: true,
    },
    providerStatus: {
      type: String,
      trim: true,
      index: true,
    },
    amountMinor: {
      type: Number,
      min: 0,
    },
    providerFee: {
      type: Number,
      min: 0,
      default: 0,
    },
    platformCommission: {
      type: Number,
      min: 0,
      default: 0,
    },
    sellerAllocation: {
      type: Number,
      min: 0,
      default: 0,
    },
    logisticsAllocation: {
      type: Number,
      min: 0,
      default: 0,
    },
    holdStatus: {
      type: String,
      enum: ['not_supported', 'not_held', 'pending', 'held', 'released', 'failed'],
      default: 'not_supported',
      index: true,
    },
    releaseStatus: {
      type: String,
      enum: ['not_supported', 'not_requested', 'pending', 'authorized', 'processing', 'completed', 'failed'],
      default: 'not_supported',
      index: true,
    },
    payoutStatus: {
      type: String,
      enum: ['not_supported', 'not_requested', 'pending', 'processing', 'completed', 'failed'],
      default: 'not_supported',
      index: true,
    },
    reconciliationStatus: {
      type: String,
      enum: ['pending', 'matched', 'mismatch', 'requires_review', 'not_required'],
      default: 'pending',
      index: true,
    },
    checkoutRequestId: String,
    phoneNumber: String,
    description: String,
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },
    failureReason: String,
    failureCode: String,
    retryCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastRetryAt: Date,
    paidAt: Date,
    refundedAt: Date,
    refundAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    refundReason: String,
  },
  {
    timestamps: true,
  }
);

PaymentSchema.index({ user: 1, createdAt: -1 });
PaymentSchema.index({ order: 1, createdAt: -1 });
PaymentSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Payment', PaymentSchema);
