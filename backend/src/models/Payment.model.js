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
      enum: ['mpesa', 'card', 'wallet', 'bank_transfer', 'paypal'],
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
    checkoutRequestId: String,
    mpesaReceiptNumber: String,
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
