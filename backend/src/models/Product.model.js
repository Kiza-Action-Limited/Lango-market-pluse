const mongoose = require('mongoose');

const compactCode = (value, fallback = 'GEN') => {
  const normalized = String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

  if (!normalized) return fallback;

  const withoutVowels = normalized.replace(/[AEIOU]/g, '');
  return (withoutVowels || normalized).slice(0, 3).padEnd(3, 'X');
};

const buildSkuBase = (product) => {
  const location = compactCode(product.locationHub, 'ORG');
  const category = compactCode(product.category, 'CAT');
  const productCode = compactCode(product.name, 'PRD');
  const quantity = Math.max(1, Math.round(Number(product.quantityAvailable || 0)));
  const unit = String(product.unit || 'UNIT').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) || 'UNIT';

  return `${location}-${category}-${productCode}-${quantity}${unit}`;
};

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
    title: {
      type: String,
      trim: true,
      maxlength: 100,
      default: '',
    },
    comment: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      index: true,
    },
    verified: {
      type: Boolean,
      default: false,
    },
    helpful: {
      type: Number,
      default: 0,
      min: 0,
    },
    unhelpful: {
      type: Number,
      default: 0,
      min: 0,
    },
    sellerResponse: {
      comment: {
        type: String,
        trim: true,
        maxlength: 1000,
      },
      respondedAt: Date,
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
        'grains-cereals',
        'food-staples',
        'sugar-baking',
        'cooking-oil',
        'dairy-eggs',
        'meat-fish',
        'beverages',
        'household',
        'farm-inputs',
        'other',
      ],
      index: true,
    },
    description: String,
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    wholesale: {
      minimumOrderQuantity: {
        type: Number,
        min: 1,
        default: 1,
      },
      rfqEnabled: {
        type: Boolean,
        default: true,
      },
      terms: {
        type: String,
        trim: true,
        maxlength: 1000,
        default: '',
      },
      priceTiers: [
        {
          minQuantity: {
            type: Number,
            min: 1,
            required: true,
          },
          unitPrice: {
            type: Number,
            min: 0,
            required: true,
          },
          label: {
            type: String,
            trim: true,
            maxlength: 80,
          },
        },
      ],
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
    minThreshold: {
      type: Number,
      default: 10,
      min: 0,
    },
    sku: {
      type: String,
      trim: true,
      uppercase: true,
      // REMOVED: index: true - now defined only in schema.index() below
    },
    skuBase: {
      type: String,
      trim: true,
      uppercase: true,
    },
    skuVersion: {
      type: Number,
      default: 1,
      min: 1,
    },
    inventoryHistory: {
      type: [
        {
          onHand: { type: Number, default: 0, min: 0 },
          reserved: { type: Number, default: 0, min: 0 },
          available: { type: Number, default: 0, min: 0 },
          unit: String,
          event: {
            type: String,
            enum: ['created', 'inventory_adjusted', 'reservation_changed', 'sale_committed', 'sale_restocked'],
            default: 'inventory_adjusted',
          },
          recordedAt: {
            type: Date,
            default: Date.now,
          },
        },
      ],
      default: [],
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
    warehouseStatus: {
      type: String,
      enum: ['seller_storage', 'warehouse_pending', 'warehouse_received', 'dispatch_ready', 'restricted'],
      default: 'seller_storage',
      index: true,
    },
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

ProductSchema.virtual('trackingSku').get(function () {
  if (this.sku) return this.sku;
  const idSuffix = String(this._id || '').slice(-4).toUpperCase();
  return `${buildSkuBase(this)}${idSuffix ? `-${idSuffix}` : ''}`;
});

ProductSchema.virtual('minimumOrderQuantity').get(function () {
  return this.wholesale?.minimumOrderQuantity || 1;
});

ProductSchema.virtual('rfqEnabled').get(function () {
  return this.wholesale?.rfqEnabled !== false;
});

ProductSchema.virtual('priceTiers').get(function () {
  return this.wholesale?.priceTiers || [];
});

ProductSchema.virtual('inventoryGraph').get(function () {
  const history = Array.isArray(this.inventoryHistory) ? this.inventoryHistory : [];
  if (history.length > 0) {
    return history.map((entry) => ({
      onHand: entry.onHand || 0,
      reserved: entry.reserved || 0,
      available: entry.available || 0,
      unit: entry.unit || this.unit,
      event: entry.event,
      recordedAt: entry.recordedAt,
    }));
  }

  return [{
    onHand: this.quantityAvailable || 0,
    reserved: this.reservedQuantity || 0,
    available: this.availableQuantity,
    unit: this.unit,
    event: 'created',
    recordedAt: this.createdAt || new Date(),
  }];
});

ProductSchema.pre('validate', async function() {
  const skuRelevantFieldsChanged = this.isNew ||
    this.isModified('name') ||
    this.isModified('category') ||
    this.isModified('quantityAvailable') ||
    this.isModified('unit') ||
    this.isModified('locationHub');

  if (!this.sku || skuRelevantFieldsChanged) {
    const skuBase = buildSkuBase(this);
    let sku = skuBase;
    let version = 1;

    while (await this.constructor.exists({ sku, _id: { $ne: this._id } })) {
      version += 1;
      sku = `${skuBase}-V${version}`;
    }

    this.skuBase = skuBase;
    this.sku = sku;
    this.skuVersion = version;
  }
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

    if (
      this.isNew ||
      this.isModified('quantityAvailable') ||
      this.isModified('reservedQuantity') ||
      this.isModified('unit')
    ) {
      const history = Array.isArray(this.inventoryHistory) ? this.inventoryHistory : [];
      const event = this.isNew
        ? 'created'
        : this.isModified('reservedQuantity')
          ? 'reservation_changed'
          : 'inventory_adjusted';

      history.push({
        onHand: this.quantityAvailable || 0,
        reserved: this.reservedQuantity || 0,
        available: Math.max(0, (this.quantityAvailable || 0) - (this.reservedQuantity || 0)),
        unit: this.unit,
        event,
        recordedAt: new Date(),
      });

      this.inventoryHistory = history.slice(-30);
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
ProductSchema.index({ sku: 1 }, { unique: true, sparse: true }); // Only define index here

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
