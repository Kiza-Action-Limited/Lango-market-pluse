'use strict';

const mongoose = require('mongoose');

const pointSchema = new mongoose.Schema(
  {
    lat: { type: Number, required: true, min: -90, max: 90 },
    lng: { type: Number, required: true, min: -180, max: 180 },
  },
  { _id: false }
);

const GroupTripRouteSchema = new mongoose.Schema(
  {
    routeId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
      lowercase: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    routeCode: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 24,
      index: true,
      sparse: true,
    },
    originName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    destinationName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    origin: {
      type: pointSchema,
      required: true,
    },
    destination: {
      type: pointSchema,
      required: true,
    },
    stops: {
      type: [String],
      default: [],
      validate: {
        validator: (stops) => stops.length <= 12,
        message: 'Routes can have at most 12 stops',
      },
    },
    cargoType: {
      type: String,
      trim: true,
      maxlength: 120,
      default: 'Mixed market cargo',
    },
    isDefault: {
      type: Boolean,
      default: false,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

GroupTripRouteSchema.index({ isActive: 1, label: 1 });

module.exports = mongoose.model('GroupTripRoute', GroupTripRouteSchema);
