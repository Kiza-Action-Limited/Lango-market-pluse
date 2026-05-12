const mongoose = require('mongoose');

const CartItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    image: { type: String, default: null },
    quantity: { type: Number, required: true, min: 1 },
    variant: { type: mongoose.Schema.Types.Mixed, default: null },
    stock: { type: Number, default: 0, min: 0 },
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    minOrderQuantity: { type: Number, default: 1, min: 1 },
  },
  { _id: true }
);

const CartSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    items: {
      type: [CartItemSchema],
      default: [],
    },
    coupon: {
      code: { type: String, default: null },
      type: { type: String, enum: ['percentage', 'fixed'], default: null },
      value: { type: Number, default: null },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Cart || mongoose.model('Cart', CartSchema);

