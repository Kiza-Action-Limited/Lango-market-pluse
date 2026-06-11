const mongoose = require('mongoose');

const AddressSchema = new mongoose.Schema(
  {
    label: { type: String, trim: true },
    county: { type: String, trim: true },
    town: { type: String, trim: true },
    street: { type: String, trim: true },
    country: { type: String, default: 'Kenya', trim: true },
    gpsLat: { type: Number },
    gpsLng: { type: Number },
  },
  { _id: false }
);

const OrderSchema = new mongoose.Schema(
  {
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    seller: {

      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,

    },

    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      
    },
    orderNumber: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      index: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0.001,
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: [
        'AWAITING_PAYMENT',
        'FUNDS_HELD',
        'IN_TRANSIT',
        'DELIVERED',
        'RELEASED',
        'DISPUTED',
        'REFUNDED',
        'PARTIAL_REFUND',
        'EXPIRED',
        'pending_payment',
        'payment_escrowed',
        'processing',
        'dispatched',
        'delivered',
        'completed',
        'cancelled',
        'disputed',
      ],
      default: 'pending_payment',
      index: true,
    },
    escrowReleaseDate: Date,
    paidAt: Date,
    deliveredAt: Date,
    releasedAt: Date,
    paymentIntentId: String,
    deliveryAddress: AddressSchema,
    deliveryAddressText: {
      type: String,
      trim: true,
    },
    qrChain: {
      type: String,
      unique: true,
      sparse: true,
    },
    dispute: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Dispute',
    },
    timeline: [
      {
        status: String,
        timestamp: { type: Date, default: Date.now },
        note: String,
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Calculate total before validation so required totalAmount is satisfied.
OrderSchema.pre('validate', function (next) {
  if (this.quantity != null && this.unitPrice != null) {
    this.totalAmount = Number(this.quantity) * Number(this.unitPrice);
  }
  if (!this.orderNumber && this._id) {
    this.orderNumber = `ORD-${this._id.toString().slice(-8).toUpperCase()}`;
  }
  if (typeof next === 'function') next();
});

// Auto-update timeline on status change
OrderSchema.pre('save', function (next) {
  if (this.isModified('status')) {
    this.timeline.push({
      status: this.status,
      timestamp: new Date(),
    });
  }
  if (typeof next === 'function') next();
});

// Indexes
OrderSchema.index({ buyer: 1, createdAt: -1 });
OrderSchema.index({ seller: 1, createdAt: -1 });
OrderSchema.index({ status: 1, escrowReleaseDate: 1 });

module.exports = mongoose.model('Order', OrderSchema);
