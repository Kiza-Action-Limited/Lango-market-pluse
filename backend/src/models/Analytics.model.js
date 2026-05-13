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
  
  // User Analytics for Lango Market Roles
  users: {
    total: { type: Number, default: 0 },
    new: { type: Number, default: 0 },
    active: { type: Number, default: 0 },
    byRole: {
      farmer: { type: Number, default: 0 },
      wholesaler: { type: Number, default: 0 },
      manufacturer: { type: Number, default: 0 },
      retailer: { type: Number, default: 0 },
      admin: { type: Number, default: 0 }
    },
    byUserType: {
      individual: { type: Number, default: 0 },
      cooperative: { type: Number, default: 0 },
      business: { type: Number, default: 0 }
    },
    byRegion: {
      type: Map,
      of: Number,
      default: {}
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
      revenue: Number,
      category: String
    }],
    topCategories: [{
      categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
      name: String,
      productsSold: Number,
      revenue: Number
    }],
    byCategory: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  
  // Farmer-specific Analytics
  farmers: {
    total: { type: Number, default: 0 },
    active: { type: Number, default: 0 },
    newFarmers: { type: Number, default: 0 },
    topPerformers: [{
      farmerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      name: String,
      farmName: String,
      totalSales: Number,
      totalOrders: Number,
      rating: Number,
      productsSold: Number
    }],
    byCropType: {
      type: Map,
      of: Number,
      default: {}
    },
    byRegion: {
      type: Map,
      of: Number,
      default: {}
    },
    averageRating: { type: Number, default: 0 },
    totalHarvestVolume: { type: Number, default: 0 }, // in tons
    revenueShare: { type: Number, default: 0 } // percentage of platform revenue
  },
  
  // Wholesaler Analytics
  wholesalers: {
    total: { type: Number, default: 0 },
    active: { type: Number, default: 0 },
    topPerformers: [{
      wholesalerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      companyName: String,
      totalPurchaseVolume: Number,
      totalOrders: Number,
      distributionReach: Number // number of retailers served
    }],
    byRegion: {
      type: Map,
      of: Number,
      default: {}
    },
    averageOrderSize: { type: Number, default: 0 }
  },
  
  // Manufacturer Analytics
  manufacturers: {
    total: { type: Number, default: 0 },
    active: { type: Number, default: 0 },
    topPerformers: [{
      manufacturerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      companyName: String,
      totalSales: Number,
      productsManufactured: Number,
      qualityRating: Number
    }],
    byProductType: {
      type: Map,
      of: Number,
      default: {}
    },
    productionVolume: { type: Number, default: 0 },
    processingCapacity: { type: Number, default: 0 } // percentage
  },
  
  // Retailer Analytics
  retailers: {
    total: { type: Number, default: 0 },
    active: { type: Number, default: 0 },
    topPerformers: [{
      retailerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      storeName: String,
      totalSales: Number,
      customerBase: Number,
      rating: Number
    }],
    byRegion: {
      type: Map,
      of: Number,
      default: {}
    },
    averageTransactionValue: { type: Number, default: 0 }
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
    averageProcessingTime: { type: Number, default: 0 },
    averageDeliveryTime: { type: Number, default: 0 },
    byRole: {
      farmerToWholesaler: { type: Number, default: 0 },
      wholesalerToRetailer: { type: Number, default: 0 },
      manufacturerToDistributor: { type: Number, default: 0 },
      directToConsumer: { type: Number, default: 0 }
    }
  },
  
  // Market Analytics for Lango
  market: {
    totalMarketVolume: { type: Number, default: 0 }, // in tons
    averagePrices: {
      type: Map,
      of: Number,
      default: {}
    },
    priceTrends: [{
      product: String,
      price: Number,
      change: Number, // percentage
      date: Date
    }],
    demandForecast: {
      type: Map,
      of: Number,
      default: {}
    },
    seasonalTrends: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {}
    },
    popularRegions: [{
      region: String,
      demandScore: Number,
      supplyScore: Number
    }]
  },
  
  // Supply Chain Analytics
  supplyChain: {
    efficiency: { type: Number, default: 0 }, // percentage
    averageLeadTime: { type: Number, default: 0 }, // days
    wastageRate: { type: Number, default: 0 }, // percentage
    coldChainUtilization: { type: Number, default: 0 }, // percentage
    logistics: {
      totalShipments: { type: Number, default: 0 },
      delivered: { type: Number, default: 0 },
      inTransit: { type: Number, default: 0 },
      delayed: { type: Number, default: 0 },
      averageDeliveryTime: { type: Number, default: 0 },
      onTimeDelivery: { type: Number, default: 0 }
    },
    byCarrier: {
      type: Map,
      of: Number,
      default: {}
    }
  },
  
  // Revenue Breakdown
  revenue: {
    total: { type: Number, default: 0 },
    byPaymentMethod: {
      type: Map,
      of: Number,
      default: {}
    },
    byRole: {
      farmers: { type: Number, default: 0 },
      wholesalers: { type: Number, default: 0 },
      manufacturers: { type: Number, default: 0 },
      retailers: { type: Number, default: 0 }
    },
    platformFee: { type: Number, default: 0 },
    commissionCollected: { type: Number, default: 0 }
  },
  
  // Platform Metrics
  platform: {
    conversionRate: { type: Number, default: 0 },
    cartAbandonmentRate: { type: Number, default: 0 },
    customerRetentionRate: { type: Number, default: 0 },
    returningCustomers: { type: Number, default: 0 },
    userSatisfaction: { type: Number, default: 0 }, // average rating
    transactionSuccess: { type: Number, default: 0 } // percentage
  },
  
  // Regional Analytics
  regions: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {}
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
analyticsSchema.index({ 'market.totalMarketVolume': -1 });
analyticsSchema.index({ 'users.byRole.farmer': -1 });

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
        avgOrderValue: { $avg: '$sales.averageOrderValue' },
        marketVolume: { $avg: '$market.totalMarketVolume' },
        farmerRevenue: { $sum: '$revenue.byRole.farmers' },
        wholesalerRevenue: { $sum: '$revenue.byRole.wholesalers' },
        manufacturerRevenue: { $sum: '$revenue.byRole.manufacturers' }
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
    userGrowth: ((this.users.new - previous.users.new) / previous.users.new) * 100,
    marketVolumeGrowth: ((this.market.totalMarketVolume - previous.market.totalMarketVolume) / previous.market.totalMarketVolume) * 100
  };
};

// Get role-specific analytics
analyticsSchema.statics.getRoleAnalytics = async function(role, startDate, endDate) {
  const roleField = role === 'farmer' ? 'farmers' : 
                    role === 'wholesaler' ? 'wholesalers' :
                    role === 'manufacturer' ? 'manufacturers' :
                    role === 'retailer' ? 'retailers' : null;
  
  if (!roleField) return null;
  
  return await this.aggregate([
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
        total: { $avg: `$${roleField}.total` },
        active: { $avg: `$${roleField}.active` },
        topPerformers: { $first: `$${roleField}.topPerformers` },
        averageRating: { $avg: `$${roleField}.averageRating` }
      }
    }
  ]);
};

module.exports = mongoose.model('Analytics', analyticsSchema);