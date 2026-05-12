const mongoose = require('mongoose');

const analyticsSchema = new mongoose.Schema({
  // Date of analytics record
  date: {
    type: Date,
    required: true,
    unique: true,
    index: true
  },
  
  // Sales Analytics
  sales: {
    totalRevenue: { type: Number, default: 0 },
    totalOrders: { type: Number, default: 0 },
    averageOrderValue: { type: Number, default: 0 },
    totalProductsSold: { type: Number, default: 0 },
    refunds: { type: Number, default: 0 },
    refundAmount: { type: Number, default: 0 }
  },
  
  // User Analytics
  users: {
    total: { type: Number, default: 0 },
    new: { type: Number, default: 0 },
    active: { type: Number, default: 0 },
    byRole: {
      farmer: { type: Number, default: 0 },
      wholesaler: { type: Number, default: 0 },
      retailer: { type: Number, default: 0 },
      consumer: { type: Number, default: 0 },
      logistics: { type: Number, default: 0 }
    },
    byUserType: {
      individual: { type: Number, default: 0 },
      business: { type: Number, default: 0 }
    }
  },
  
  // Product Analytics
  products: {
    total: { type: Number, default: 0 },
    active: { type: Number, default: 0 },
    outOfStock: { type: Number, default: 0 },
    lowStock: { type: Number, default: 0 },
    topSelling: [{
      productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
      name: String,
      quantitySold: Number,
      revenue: Number
    }],
    topCategories: [{
      categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
      name: String,
      productsSold: Number,
      revenue: Number
    }]
  },
  
  // Order Analytics
  orders: {
    byStatus: {
      pending: { type: Number, default: 0 },
      processing: { type: Number, default: 0 },
      shipped: { type: Number, default: 0 },
      delivered: { type: Number, default: 0 },
      cancelled: { type: Number, default: 0 }
    },
    byPaymentStatus: {
      pending: { type: Number, default: 0 },
      completed: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
      refunded: { type: Number, default: 0 }
    },
    averageProcessingTime: { type: Number, default: 0 }, // in hours
    averageDeliveryTime: { type: Number, default: 0 } // in days
  },
  
  // Logistics Analytics
  logistics: {
    totalShipments: { type: Number, default: 0 },
    delivered: { type: Number, default: 0 },
    inTransit: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    averageDeliveryTime: { type: Number, default: 0 },
    onTimeDelivery: { type: Number, default: 0 }, // percentage
    byCarrier: {
      type: Map,
      of: Number,
      default: {}
    }
  },
  
  // Farmer Analytics
  farmers: {
    total: { type: Number, default: 0 },
    active: { type: Number, default: 0 },
    topPerformers: [{
      farmerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      name: String,
      totalSales: Number,
      totalOrders: Number,
      rating: Number
    }],
    averageRating: { type: Number, default: 0 }
  },
  
  // Revenue Breakdown
  revenue: {
    total: { type: Number, default: 0 },
    byPaymentMethod: {
      type: Map,
      of: Number,
      default: {}
    },
    byUserType: {
      type: Map,
      of: Number,
      default: {}
    },
    platformFee: { type: Number, default: 0 },
    deliveryFee: { type: Number, default: 0 }
  },
  
  // Platform Metrics
  platform: {
    conversionRate: { type: Number, default: 0 }, // percentage
    cartAbandonmentRate: { type: Number, default: 0 },
    customerRetentionRate: { type: Number, default: 0 },
    returningCustomers: { type: Number, default: 0 }
  },
  
  // Daily Summary
  summary: {
    visits: { type: Number, default: 0 },
    uniqueVisitors: { type: Number, default: 0 },
    pageViews: { type: Number, default: 0 },
    bounceRate: { type: Number, default: 0 }
  },
  
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Indexes
analyticsSchema.index({ date: -1 });
analyticsSchema.index({ 'sales.totalRevenue': -1 });
analyticsSchema.index({ 'users.total': -1 });

// Static method to get analytics for date range
analyticsSchema.statics.getAnalyticsByDateRange = async function(startDate, endDate) {
  return await this.find({
    date: {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    }
  }).sort({ date: 1 });
};

// Static method to get summary for period
analyticsSchema.statics.getPeriodSummary = async function(startDate, endDate) {
  const results = await this.aggregate([
    {
      $match: {
        date: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      }
    },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: '$sales.totalRevenue' },
        totalOrders: { $sum: '$sales.totalOrders' },
        totalUsers: { $avg: '$users.total' },
        newUsers: { $sum: '$users.new' },
        avgOrderValue: { $avg: '$sales.averageOrderValue' }
      }
    }
  ]);
  
  return results[0] || null;
};

// Method to compare with previous period
analyticsSchema.methods.compareWithPrevious = async function() {
  const previousDate = new Date(this.date);
  previousDate.setDate(previousDate.getDate() - 1);
  
  const previous = await this.constructor.findOne({ date: previousDate });
  if (!previous) return null;
  
  return {
    revenueGrowth: ((this.sales.totalRevenue - previous.sales.totalRevenue) / previous.sales.totalRevenue) * 100,
    orderGrowth: ((this.sales.totalOrders - previous.sales.totalOrders) / previous.sales.totalOrders) * 100,
    userGrowth: ((this.users.new - previous.users.new) / previous.users.new) * 100
  };
};

module.exports = mongoose.model('Analytics', analyticsSchema);