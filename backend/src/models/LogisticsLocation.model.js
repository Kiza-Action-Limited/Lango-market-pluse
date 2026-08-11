const mongoose = require('mongoose');

const LogisticsLocationSchema = new mongoose.Schema(
  {
    logistics: { type: mongoose.Schema.Types.ObjectId, ref: 'Logistics', required: true, index: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', index: true },
    driver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    lat: { type: Number, required: true, min: -90, max: 90 },
    lng: { type: Number, required: true, min: -180, max: 180 },
    point: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: true },
    },
    accuracy: Number,
    speed: Number,
    heading: Number,
    source: { type: String, enum: ['driver_location', 'pickup_scan', 'delivery_scan', 'admin_update'], default: 'driver_location' },
    recordedAt: { type: Date, default: Date.now, index: true },
    requestId: String,
    metadata: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

LogisticsLocationSchema.index({ point: '2dsphere' });
LogisticsLocationSchema.index({ logistics: 1, recordedAt: -1 });

module.exports = mongoose.model('LogisticsLocation', LogisticsLocationSchema);
