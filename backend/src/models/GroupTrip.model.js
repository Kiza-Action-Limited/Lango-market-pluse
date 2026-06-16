'use strict';

const mongoose = require('mongoose');

const participantSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    weightKg: { type: Number, required: true, min: 0 },
    share: { type: Number, required: true, min: 0 },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const GroupTripSchema = new mongoose.Schema(
  {
    tripId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    initiator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    origin: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
    },
    destination: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
    },
    distanceKm: { type: Number, required: true, min: 0 },
    baseFare: { type: Number, required: true, min: 0 },
    maxCapacityKg: { type: Number, required: true, min: 1, default: 3000 },
    currentCapacityKg: { type: Number, default: 0, min: 0 },
    participants: {
      type: [participantSchema],
      default: [],
    },
    deadline: {
      type: Date,
      required: true,
      index: true,
    },
    cargoType: {
      type: String,
      trim: true,
      default: 'Mixed cargo',
    },
    status: {
      type: String,
      enum: ['open', 'closed', 'expired', 'cancelled'],
      default: 'open',
      index: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    etaMinutes: {
      type: Number,
      min: 0,
    },
  },
  { timestamps: true }
);

GroupTripSchema.index({ status: 1, deadline: 1 });

module.exports = mongoose.model('GroupTrip', GroupTripSchema);
