const mongoose = require('mongoose');

const ScarcityAlertSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    threshold: {
      type: Number,
      required: true, // e.g., remaining quantity
    },
    severity: {
      type: String,
      enum: ['low', 'critical', 'out_of_stock'],
      required: true,
    },
    triggeredAt: {
      type: Date,
      default: Date.now,
    },
    resolvedAt: Date,
    notifiedUsers: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        notifiedAt: Date,
      },
    ],
    predictedRestockDate: Date,
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

ScarcityAlertSchema.index({ product: 1, resolvedAt: 1 });
ScarcityAlertSchema.index({ severity: 1, triggeredAt: -1 });

module.exports = mongoose.model('ScarcityAlert', ScarcityAlertSchema);