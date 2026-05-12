const mongoose = require('mongoose');

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
    paymentIntentId: String,
    deliveryAddress: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Trip',
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

// Auto-update timeline on status change
OrderSchema.pre('save', function (next) {
  if (this.isModified('status')) {
    this.timeline.push({
      status: this.status,
      timestamp: new Date(),
    });
  }
  next();
});

// Calculate total before saving
OrderSchema.pre('save', function (next) {
  this.totalAmount = this.quantity * this.unitPrice;
  next();
});

// Indexes
OrderSchema.index({ buyer: 1, createdAt: -1 });
OrderSchema.index({ seller: 1, createdAt: -1 });
OrderSchema.index({ status: 1, escrowReleaseDate: 1 });

module.exports = mongoose.model('Order', OrderSchema);