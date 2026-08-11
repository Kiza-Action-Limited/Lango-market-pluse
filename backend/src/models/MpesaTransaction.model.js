const mongoose = require('mongoose');

const MpesaTransactionSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['STK', 'B2C', 'C2B'], required: true, index: true },
    direction: { type: String, enum: ['inbound', 'outbound'], required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', index: true },
    payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', index: true },
    payout: { type: mongoose.Schema.Types.ObjectId, ref: 'Payout', index: true },
    amount: { type: Number, min: 0, default: 0 },
    amountMinor: { type: Number, min: 0, default: 0 },
    currency: { type: String, default: 'KES' },
    phoneNumber: String,
    status: {
      type: String,
      enum: ['initiated', 'submitted', 'processing', 'completed', 'failed', 'timeout', 'reversed'],
      default: 'initiated',
      index: true,
    },
    checkoutRequestId: { type: String, trim: true },
    merchantRequestId: { type: String, trim: true, index: true },
    mpesaReceiptNumber: { type: String, trim: true },
    conversationId: { type: String, trim: true, index: true },
    originatorConversationId: { type: String, trim: true },
    resultCode: String,
    resultDesc: String,
    accountReference: String,
    transactionDesc: String,
    rawRequest: mongoose.Schema.Types.Mixed,
    rawResponse: mongoose.Schema.Types.Mixed,
    callbackEvents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'CallbackEvent' }],
    idempotencyKey: String,
  },
  { timestamps: true }
);

MpesaTransactionSchema.index({ checkoutRequestId: 1 }, { unique: true, sparse: true });
MpesaTransactionSchema.index({ originatorConversationId: 1 }, { unique: true, sparse: true });
MpesaTransactionSchema.index({ mpesaReceiptNumber: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('MpesaTransaction', MpesaTransactionSchema);
