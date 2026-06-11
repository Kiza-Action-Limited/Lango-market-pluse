const mongoose = require('mongoose');

const contributionSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    logistics: { type: mongoose.Schema.Types.ObjectId, ref: 'Logistics' },
    amount: { type: Number, min: 0, required: true },
    driverShare: { type: Number, min: 0, default: 0 },
    contributedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const SinkingFundSchema = new mongoose.Schema(
  {
    driver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    balance: { type: Number, min: 0, default: 0 },
    totalContributed: { type: Number, min: 0, default: 0 },
    mileageKm: { type: Number, min: 0, default: 0 },
    nextServiceKm: { type: Number, min: 0, default: 5000 },
    lastServiceAlertAt: Date,
    contributions: [contributionSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model('SinkingFund', SinkingFundSchema);
