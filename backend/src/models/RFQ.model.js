const mongoose = require('mongoose');

const rfqHistorySchema = new mongoose.Schema(
  {
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    action: {
      type: String,
      enum: ['created', 'quoted', 'accepted', 'declined', 'cancelled'],
      required: true,
    },
    message: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    quantity: {
      type: Number,
      min: 0,
    },
    targetPrice: {
      type: Number,
      min: 0,
    },
    unitPrice: {
      type: Number,
      min: 0,
    },
    totalPrice: {
      type: Number,
      min: 0,
    },
  },
  { timestamps: true }
);

const rfqSchema = new mongoose.Schema(
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
      index: true,
    },
    rfqNumber: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      index: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    unit: {
      type: String,
      trim: true,
      required: true,
    },
    targetPrice: {
      type: Number,
      min: 0,
      default: null,
    },
    deliveryLocation: {
      type: String,
      trim: true,
      maxlength: 240,
      default: '',
    },
    neededBy: {
      type: Date,
      default: null,
    },
    message: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },
    status: {
      type: String,
      enum: ['open', 'quoted', 'accepted', 'declined', 'cancelled', 'expired'],
      default: 'open',
      index: true,
    },
    quote: {
      unitPrice: { type: Number, min: 0 },
      totalPrice: { type: Number, min: 0 },
      availableQuantity: { type: Number, min: 0 },
      validUntil: Date,
      deliveryWindowDays: { type: Number, min: 0 },
      sellerMessage: {
        type: String,
        trim: true,
        maxlength: 1000,
      },
      respondedAt: Date,
    },
    negotiationHistory: {
      type: [rfqHistorySchema],
      default: [],
    },
  },
  { timestamps: true }
);

rfqSchema.pre('validate', function setRfqNumber(next) {
  if (!this.rfqNumber && this._id) {
    this.rfqNumber = `RFQ-${this._id.toString().slice(-8).toUpperCase()}`;
  }
  if (this.quote?.unitPrice != null && this.quantity) {
    this.quote.totalPrice = Number(this.quote.unitPrice) * Number(this.quantity);
  }
  if (typeof next === 'function') next();
});

rfqSchema.index({ seller: 1, status: 1, createdAt: -1 });
rfqSchema.index({ buyer: 1, status: 1, createdAt: -1 });
rfqSchema.index({ product: 1, createdAt: -1 });

module.exports = mongoose.models.RFQ || mongoose.model('RFQ', rfqSchema);
