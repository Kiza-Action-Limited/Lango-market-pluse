const mongoose = require('mongoose');

const CallbackEventSchema = new mongoose.Schema(
  {
    provider: { type: String, required: true, index: true },
    eventType: { type: String, required: true, index: true },
    eventId: { type: String, trim: true, index: true },
    payloadHash: { type: String, required: true, index: true },
    checkoutRequestId: { type: String, trim: true, index: true },
    merchantRequestId: { type: String, trim: true, index: true },
    conversationId: { type: String, trim: true, index: true },
    originatorConversationId: { type: String, trim: true, index: true },
    resultCode: { type: String, trim: true, index: true },
    resultDesc: String,
    processingStatus: {
      type: String,
      enum: ['received', 'processing', 'processed', 'failed', 'ignored'],
      default: 'received',
      index: true,
    },
    processedAt: Date,
    failureReason: String,
    sourceIp: String,
    requestId: String,
    rawPayload: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true }
);

CallbackEventSchema.index({ provider: 1, eventType: 1, payloadHash: 1 }, { unique: true });
CallbackEventSchema.index({ createdAt: -1 });

module.exports = mongoose.model('CallbackEvent', CallbackEventSchema);
