const mongoose = require('mongoose');

const IdempotencyKeySchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true },
    scope: { type: String, required: true, trim: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    requestHash: { type: String, required: true },
    status: {
      type: String,
      enum: ['processing', 'completed', 'failed'],
      default: 'processing',
      index: true,
    },
    responseStatus: Number,
    responseBody: mongoose.Schema.Types.Mixed,
    lockedUntil: Date,
    expiresAt: { type: Date, default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) },
  },
  { timestamps: true }
);

IdempotencyKeySchema.index({ key: 1, scope: 1, user: 1 }, { unique: true });
IdempotencyKeySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('IdempotencyKey', IdempotencyKeySchema);
