const mongoose = require('mongoose');

const QRTokenSchema = new mongoose.Schema(
  {
    token: { type: String, required: true, unique: true, index: true },
    type: { type: String, enum: ['PICKUP', 'DELIVERY'], required: true, index: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    logistics: { type: mongoose.Schema.Types.ObjectId, ref: 'Logistics', required: true, index: true },
    holder: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isUsed: { type: Boolean, default: false, index: true },
    usedAt: Date,
    scannedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    gpsAtScan: {
      lat: Number,
      lng: Number,
      distanceMeters: Number,
    },
    qrImage: String,
    expiresAt: Date,
  },
  { timestamps: true }
);

QRTokenSchema.index({ logistics: 1, type: 1 }, { unique: true });

module.exports = mongoose.model('QRToken', QRTokenSchema);
