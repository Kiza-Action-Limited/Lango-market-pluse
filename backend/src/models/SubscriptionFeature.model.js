const mongoose = require('mongoose');

const subscriptionFeatureSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    category: {
      type: String,
      trim: true,
      default: 'seller_tools',
    },
    planIds: [{
      type: String,
      enum: ['solo', 'smart', 'growth', 'mizigo'],
    }],
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

subscriptionFeatureSchema.index({ category: 1, sortOrder: 1 });
subscriptionFeatureSchema.index({ planIds: 1, isActive: 1 });

module.exports = mongoose.model('SubscriptionFeature', subscriptionFeatureSchema);
