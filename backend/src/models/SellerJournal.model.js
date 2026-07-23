const mongoose = require('mongoose');

const sellerJournalSchema = new mongoose.Schema(
  {
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      index: true,
    },
    entryType: {
      type: String,
      enum: ['offline_sale', 'offline_purchase', 'expense', 'return', 'stock_adjustment'],
      default: 'offline_purchase',
      index: true,
    },
    adjustmentMode: {
      type: String,
      enum: ['add', 'subtract', 'set', 'none'],
      default: 'add',
    },
    quantity: {
      type: Number,
      min: 0,
      default: 0,
    },
    unit: {
      type: String,
      trim: true,
    },
    unitCost: {
      type: Number,
      min: 0,
      default: 0,
    },
    unitPrice: {
      type: Number,
      min: 0,
      default: 0,
    },
    discount: {
      type: Number,
      min: 0,
      default: 0,
    },
    tax: {
      type: Number,
      min: 0,
      default: 0,
    },
    charges: {
      type: Number,
      min: 0,
      default: 0,
    },
    amount: {
      type: Number,
      min: 0,
      default: 0,
    },
    totalAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
    totalCost: {
      type: Number,
      min: 0,
      default: 0,
    },
    stockBefore: {
      type: Number,
      min: 0,
      default: 0,
    },
    stockAfter: {
      type: Number,
      min: 0,
      default: 0,
    },
    stockDelta: {
      type: Number,
      default: 0,
    },
    supplierName: {
      type: String,
      trim: true,
      maxlength: 120,
    },
    partyName: {
      type: String,
      trim: true,
      maxlength: 120,
    },
    partyPhone: {
      type: String,
      trim: true,
      maxlength: 40,
    },
    partyType: {
      type: String,
      trim: true,
      maxlength: 80,
    },
    paymentMethod: {
      type: String,
      trim: true,
      maxlength: 40,
    },
    category: {
      type: String,
      trim: true,
      maxlength: 80,
    },
    inventoryAction: {
      type: String,
      enum: ['increase', 'decrease', 'set', 'none'],
      default: 'increase',
    },
    affectsMainAccount: {
      type: Boolean,
      default: false,
      index: true,
    },
    accountImpact: {
      type: String,
      enum: ['credit', 'debit', 'none'],
      default: 'none',
      index: true,
    },
    accountAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
    returnSettlement: {
      type: String,
      enum: ['customer_refund', 'supplier_refund', 'no_cash'],
      default: 'no_cash',
    },
    walletTransaction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
    },
    status: {
      type: String,
      enum: ['draft', 'completed', 'cancelled', 'refunded'],
      default: 'completed',
      index: true,
    },
    reference: {
      type: String,
      trim: true,
      maxlength: 120,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    purchasedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true }
);

sellerJournalSchema.index({ seller: 1, purchasedAt: -1 });
sellerJournalSchema.index({ seller: 1, product: 1, purchasedAt: -1 });

module.exports = mongoose.model('SellerJournal', sellerJournalSchema);
