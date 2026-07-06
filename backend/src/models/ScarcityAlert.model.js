const mongoose = require('mongoose');

const ScarcityAlertSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    threshold: {
      type: Number,
      required: true,
      min: 0,
    },
    severity: {
      type: String,
      enum: ['low', 'critical'],
      default: 'low',
      index: true,
    },
    triggeredAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    resolvedAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  { timestamps: true }
);

ScarcityAlertSchema.index({ product: 1, resolvedAt: 1 });
ScarcityAlertSchema.index({ severity: 1, triggeredAt: -1 });

module.exports = mongoose.model('ScarcityAlert', ScarcityAlertSchema);
