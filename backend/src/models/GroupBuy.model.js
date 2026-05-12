const mongoose = require('mongoose');

const GroupBuySchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    initiator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    targetQuantity: {
      type: Number,
      required: true,
      min: 1,
    },
    currentQuantity: {
      type: Number,
      default: 0,
    },
    unitPrice: {
      type: Number,
      required: true,
    },
    deadline: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'fulfilled', 'expired', 'cancelled'],
      default: 'active',
      index: true,
    },
    participants: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        quantity: Number,
        joinedAt: Date,
      },
    ],
    discountApplied: Number, // Per unit discount vs regular price
  },
  {
    timestamps: true,
  }
);

GroupBuySchema.index({ product: 1, status: 1 });
GroupBuySchema.index({ deadline: 1 });

module.exports = mongoose.model('GroupBuy', GroupBuySchema);