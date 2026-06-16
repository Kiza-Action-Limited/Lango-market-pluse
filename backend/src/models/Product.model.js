const mongoose = require('mongoose');

const ReviewSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
  },
  { timestamps: true }
);

const ProductSchema = new mongoose.Schema(
  {
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    category: {
      type: String,
      required: true,
      enum: [
        'electronics',
        'fashion',
        'home-garden',
        'beauty-health',
        'sports-outdoor',
        'grocery',
        'vegetables',
      ],
      index: true,
    },
    description: String,
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    unit: {
      type: String,
      required: true,
      enum: ['kg', 'g', 'ton', 'piece', 'bunch', 'litre'],
    },
    quantityAvailable: {
      type: Number,
      required: true,
      min: 0,
    },
    reservedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },
    images: [{
      url: String,
      publicId: String,
    }],
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },
    customAttributes: {
      type: Map,
      of: String,
    },
    locationHub: String,
    isPublished: {
      type: Boolean,
      default: true,
    },
    scarcityScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    soldCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    reviews: {
      type: [ReviewSchema],
      default: [],
    },
    lastScarcityUpdate: Date,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Normalize legacy/string images so model validation stays stable.
ProductSchema.pre('validate', function(next) {
  if (Array.isArray(this.images)) {
    this.images = this.images
      .map((image) => {
        if (!image) return null;
        if (typeof image === 'string') {
          if (image.startsWith('blob:')) return null;
          return { url: image };
        }
        if (typeof image === 'object' && image.url) {
          if (String(image.url).startsWith('blob:')) return null;
          return image;
        }
        return null;
      })
      .filter(Boolean);
  }
  if (typeof next === 'function') {
    next();
  }
});

// Virtual for available quantity
ProductSchema.virtual('availableQuantity').get(function () {
  return Math.max(0, (this.quantityAvailable || 0) - (this.reservedQuantity || 0));
});

// Pre-save middleware
ProductSchema.pre('save', function(next) {
  if (typeof next !== 'function') {
    if (this.reservedQuantity > this.quantityAvailable) {
      throw new Error('Reserved quantity cannot exceed available quantity');
    }
    return;
  }
  
  try {
    if (this.reservedQuantity > this.quantityAvailable) {
      const error = new Error('Reserved quantity cannot exceed available quantity');
      error.name = 'ValidationError';
      return next(error);
    }
    next();
  } catch (error) {
    next(error);
  }
});

// Field validation
ProductSchema.path('reservedQuantity').validate(function(value) {
  return value <= this.quantityAvailable;
}, 'Reserved quantity ({VALUE}) cannot exceed available quantity');

// Indexes
ProductSchema.index({ name: 'text', description: 'text' });
ProductSchema.index({ category: 1, price: 1 });
ProductSchema.index({ scarcityScore: -1 });
ProductSchema.index({ seller: 1, createdAt: -1 });
ProductSchema.index({ category: 1, scarcityScore: -1 });

// Static methods
ProductSchema.statics.reduceReservedQuantity = async function(productId, quantity) {
  const product = await this.findById(productId);
  if (!product) throw new Error('Product not found');
  if (quantity > product.reservedQuantity) throw new Error('Cannot reduce reserved quantity below zero');
  product.reservedQuantity -= quantity;
  await product.save();
  return product;
};

// Instance methods
ProductSchema.methods.reserve = async function(quantity) {
  if (quantity > this.availableQuantity) {
    throw new Error(`Cannot reserve ${quantity} units. Only ${this.availableQuantity} available`);
  }
  this.reservedQuantity += quantity;
  await this.save();
  return this;
};

ProductSchema.methods.releaseReservation = async function(quantity) {
  if (quantity > this.reservedQuantity) {
    throw new Error(`Cannot release ${quantity} units. Only ${this.reservedQuantity} reserved`);
  }
  this.reservedQuantity -= quantity;
  await this.save();
  return this;
};

const Product = mongoose.models.Product || mongoose.model('Product', ProductSchema);
module.exports = Product;
