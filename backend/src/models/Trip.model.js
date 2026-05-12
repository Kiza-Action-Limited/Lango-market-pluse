const mongoose = require('mongoose');

const TripSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      unique: true,
    },
    logisticsProvider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    pickupLocation: {
      type: {
        type: String,
        enum: ['Point'],
        required: true,
      },
      coordinates: {
        type: [Number],
        required: true,
      },
      address: String,
    },
    deliveryLocation: {
      type: {
        type: String,
        enum: ['Point'],
        required: true,
      },
      coordinates: {
        type: [Number],
        required: true,
      },
      address: String,
    },
    status: {
      type: String,
      enum: ['assigned', 'picked_up', 'in_transit', 'delivered', 'failed'],
      default: 'assigned',
      index: true,
    },
    estimatedDistanceKm: Number,
    estimatedDurationMin: Number,
    actualDistanceKm: Number,
    startedAt: Date,
    pickedUpAt: Date,
    deliveredAt: Date,
    currentLocation: {
      type: {
        type: String,
        enum: ['Point'],
      },
      coordinates: [Number],
    },
    locationHistory: [
      {
        coordinates: [Number],
        timestamp: Date,
      },
    ],
    trackingToken: String, // For customer tracking
  },
  {
    timestamps: true,
  }
);

TripSchema.index({ pickupLocation: '2dsphere' });
TripSchema.index({ deliveryLocation: '2dsphere' });
TripSchema.index({ status: 1, logisticsProvider: 1 });

module.exports = mongoose.model('Trip', TripSchema);