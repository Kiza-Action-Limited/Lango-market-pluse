const mongoose = require('mongoose');

const trackingHistorySchema = new mongoose.Schema({
  status: {
    type: String,
    enum: ['pending', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'failed'],
    required: true
  },
  location: {
    type: String,
    trim: true
  },
  notes: {
    type: String,
    trim: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { _id: true });

const logisticsSchema = new mongoose.Schema({
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true,
    unique: true
  },
  orderNumber: {
    type: String,
    required: true,
    index: true
  },
  trackingNumber: {
    type: String,
    unique: true,
    sparse: true,
    trim: true
  },
  carrier: {
    type: String,
    enum: ['fedex', 'dhl', 'ups', 'usps', 'local_courier', 'other'],
    default: 'local_courier'
  },
  status: {
    type: String,
    enum: ['pending', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'failed', 'returned'],
    default: 'pending',
    required: true,
    index: true
  },
  currentLocation: {
    type: String,
    trim: true,
    default: 'Warehouse'
  },
  estimatedDelivery: {
    type: Date
  },
  actualDelivery: {
    type: Date
  },
  driver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  driverName: {
    type: String,
    trim: true
  },
  driverPhone: {
    type: String,
    trim: true
  },
  shippingAddress: {
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    zipCode: { type: String, required: true },
    country: { type: String, default: 'Kenya' }
  },
  trackingHistory: [trackingHistorySchema],
  weight: {
    type: Number,
    min: 0
  },
  weightUnit: {
    type: String,
    enum: ['kg', 'g', 'lb'],
    default: 'kg'
  },
  dimensions: {
    length: { type: Number, min: 0 },
    width: { type: Number, min: 0 },
    height: { type: Number, min: 0 },
    unit: { type: String, enum: ['cm', 'in'], default: 'cm' }
  },
  shippingCost: {
    type: Number,
    min: 0,
    default: 0
  },
  insurance: {
    enabled: { type: Boolean, default: false },
    value: { type: Number, min: 0, default: 0 }
  },
  notes: {
    type: String,
    trim: true
  },
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Indexes for better query performance
logisticsSchema.index({ status: 1, createdAt: -1 });
logisticsSchema.index({ carrier: 1, status: 1 });
logisticsSchema.index({ driver: 1, status: 1 });
logisticsSchema.index({ estimatedDelivery: 1 });

// Virtual for delivery duration
logisticsSchema.virtual('deliveryDuration').get(function() {
  if (this.actualDelivery && this.createdAt) {
    const duration = this.actualDelivery - this.createdAt;
    return Math.ceil(duration / (1000 * 60 * 60 * 24)); // in days
  }
  return null;
});

// Method to update status with tracking
logisticsSchema.methods.updateStatus = async function(status, location, notes, updatedBy) {
  this.status = status;
  if (location) this.currentLocation = location;
  
  if (status === 'delivered' && !this.actualDelivery) {
    this.actualDelivery = new Date();
  }
  
  this.trackingHistory.push({
    status,
    location: location || this.currentLocation,
    notes,
    timestamp: new Date(),
    updatedBy
  });
  
  await this.save();
  return this;
};

// Static method to get delivery stats
logisticsSchema.statics.getDeliveryStats = async function(startDate, endDate) {
  const match = {};
  if (startDate || endDate) {
    match.createdAt = {};
    if (startDate) match.createdAt.$gte = new Date(startDate);
    if (endDate) match.createdAt.$lte = new Date(endDate);
  }
  
  return await this.aggregate([
    { $match: match },
    { $group: {
      _id: '$status',
      count: { $sum: 1 },
      averageDeliveryTime: {
        $avg: {
          $cond: [
            { $and: [{ $ne: ['$actualDelivery', null] }, { $ne: ['$createdAt', null] }] },
            { $subtract: ['$actualDelivery', '$createdAt'] },
            null
          ]
        }
      }
    }}
  ]);
};

// Pre-save middleware to generate tracking number
logisticsSchema.pre('save', async function(next) {
  if (!this.trackingNumber && this.status !== 'pending') {
    const prefix = this.carrier.substring(0, 3).toUpperCase();
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    this.trackingNumber = `${prefix}${timestamp}${random}`;
  }
  next();
});

module.exports = mongoose.model('Logistics', logisticsSchema);