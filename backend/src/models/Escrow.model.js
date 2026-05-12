const mongoose = require('mongoose');

const DisputeSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      unique: true,
    },
    raisedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    reason: {
      type: String,
      enum: ['product_not_received', 'quality_issue', 'quantity_mismatch', 'other'],
      required: true,
    },
    description: String,
    evidence: [String], // URLs to images/docs
    status: {
      type: String,
      enum: ['open', 'under_review', 'resolved_buyer', 'resolved_seller', 'closed'],
      default: 'open',
      index: true,
    },
    resolution: {
      type: String,
      enum: ['refund_buyer', 'release_to_seller', 'partial_refund', 'cancelled'],
    },
    resolutionAmount: Number,
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    resolvedAt: Date,
    messages: [
      {
        sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        message: String,
        timestamp: Date,
        isAdmin: Boolean,
      },
    ],
  },
  {
    timestamps: true,
  }
);

DisputeSchema.index({ order: 1 });
DisputeSchema.index({ status: 1, createdAt: 1 });

module.exports = mongoose.model('Dispute', DisputeSchema);