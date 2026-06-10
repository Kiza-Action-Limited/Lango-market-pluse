const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true
    },

    slug: {
      type: String,
      unique: true
    },

    description: {
      type: String,
      trim: true
    },

    image: {
      type: String,
      default: ''
    },

    categoryType: {
      type: String,
      enum: [
        'brand',
        'farmer',
        'wholesaler',
        'retailer',
        'manufacturer',
        'small_business',
        'logistics',
        'general'
      ],
      default: 'general'
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },

    createdByRole: {
      type: String,
      enum: ['brand', 'farmer', 'wholesaler', 'retailer', 'manufacturer', 'small_business', 'logistics', 'admin', 'seller'],
      required: true
    },

    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

// Index for better query performance
categorySchema.index({ createdBy: 1, isActive: 1 });
categorySchema.index({ categoryType: 1, isActive: 1 });

module.exports = mongoose.model('Category', categorySchema);
