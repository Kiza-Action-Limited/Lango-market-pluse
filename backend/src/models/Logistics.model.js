const mongoose = require('mongoose');

// ─── Sub-schemas ────────────────────────────────────────────────────────────

const trackingHistorySchema = new mongoose.Schema({
  status: {
    type: String,
    enum: ['pending', 'in_transit', 'delivered', 'failed', 'returned', 'disputed'],
    required: true
  },
  location: { type: String, trim: true },
  gpsCoordinates: {
    lat: { type: Number },
    lng: { type: Number }
  },
  notes: { type: String, trim: true },
  timestamp: { type: Date, default: Date.now },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { _id: true });

const qrScanSchema = new mongoose.Schema({
  scannedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  scannedAt: { type: Date },
  gpsCoordinates: {
    lat: { type: Number },
    lng: { type: Number }
  },
  ipAddress: { type: String, trim: true },
  verified: { type: Boolean, default: false }
}, { _id: false });

// ─── Main Schema ─────────────────────────────────────────────────────────────

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

  // ── Status ──────────────────────────────────────────────────────────────
  status: {
    type: String,
    enum: ['pending', 'in_transit', 'delivered', 'failed', 'returned', 'disputed'],
    default: 'pending',
    required: true,
    index: true
  },
  currentLocation: { type: String, trim: true, default: 'Warehouse' },
  estimatedDelivery: { type: Date },
  actualDelivery: { type: Date },

  // ── Driver ──────────────────────────────────────────────────────────────
  /**
   * driverType:
   *   'owner_operator' – solo driver who owns their vehicle
   *   'hired_driver'   – works under a fleet / company
   */
  driverType: {
    type: String,
    enum: ['owner_operator', 'hired_driver'],
    required: true,
    default: 'owner_operator'
  },
  driver: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  driverName: { type: String, trim: true },
  driverPhone: { type: String, trim: true },
  fleet: { type: mongoose.Schema.Types.ObjectId, ref: 'Fleet' }, // only for hired_driver

  // ── 3-Way QR Handshake ──────────────────────────────────────────────────
  /**
   * Step 1 – Driver scans Seller's QR  → status becomes IN_TRANSIT
   * Step 2 – Buyer  scans Driver's QR  → status becomes DELIVERED, escrow released
   * Step 3 – AutoRelease after 72 hrs  → funds released if no dispute
   */
  sellerQrCode: { type: String, trim: true },   // QR payload shown to driver at pickup
  driverQrCode: { type: String, trim: true },   // QR payload shown to buyer at delivery

  step1_pickupScan: qrScanSchema,    // Driver scans Seller QR
  step2_deliveryScan: qrScanSchema,  // Buyer  scans Driver QR
  step3_autoRelease: {
    scheduledAt: { type: Date },     // Set when step2 completes (now + 72h)
    releasedAt:  { type: Date },     // Populated when actually released
    triggeredBy: { type: String, enum: ['buyer_confirm', 'auto', 'admin'], default: 'auto' }
  },

  // ── Escrow / Payment ────────────────────────────────────────────────────
  escrow: {
    provider: { type: String, enum: ['mpesa', 'bank', 'cash'], default: 'mpesa' },
    reference: { type: String, trim: true },
    totalAmount: { type: Number, min: 0, default: 0 },
    platformCommissionRate: { type: Number, min: 0, max: 1, default: 0.075 }, // 5–10%, stored as decimal
    platformCommission: { type: Number, min: 0, default: 0 },
    sellerPayout: { type: Number, min: 0, default: 0 },
    driverPayout: { type: Number, min: 0, default: 0 },
    sinkingFundDeduction: { type: Number, min: 0, default: 0 }, // 10% of driverPayout
    status: {
      type: String,
      enum: ['holding', 'released', 'disputed', 'refunded'],
      default: 'holding'
    },
    releasedAt: { type: Date },
    disputeOpenedAt: { type: Date }
  },

  // ── Shipping Address ────────────────────────────────────────────────────
  shippingAddress: {
    street:  { type: String, required: true },
    city:    { type: String, required: true },
    state:   { type: String, required: true },
    zipCode: { type: String, required: true },
    country: { type: String, default: 'Kenya' }
  },

  // ── Package Details ─────────────────────────────────────────────────────
  weight: { type: Number, min: 0 },
  weightUnit: { type: String, enum: ['kg', 'g', 'lb'], default: 'kg' },
  dimensions: {
    length: { type: Number, min: 0 },
    width:  { type: Number, min: 0 },
    height: { type: Number, min: 0 },
    unit:   { type: String, enum: ['cm', 'in'], default: 'cm' }
  },
  shippingCost: { type: Number, min: 0, default: 0 },
  insurance: {
    enabled: { type: Boolean, default: false },
    value:   { type: Number, min: 0, default: 0 }
  },

  // ── History & Meta ──────────────────────────────────────────────────────
  trackingHistory: [trackingHistorySchema],
  notes: { type: String, trim: true },
  metadata: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} }
}, {
  timestamps: true
});

// ─── Indexes ──────────────────────────────────────────────────────────────────
logisticsSchema.index({ status: 1, createdAt: -1 });
logisticsSchema.index({ driver: 1, status: 1 });
logisticsSchema.index({ estimatedDelivery: 1 });
logisticsSchema.index({ 'escrow.status': 1 });

// ─── Virtuals ─────────────────────────────────────────────────────────────────
logisticsSchema.virtual('deliveryDuration').get(function () {
  if (this.actualDelivery && this.createdAt) {
    return Math.ceil((this.actualDelivery - this.createdAt) / (1000 * 60 * 60 * 24));
  }
  return null;
});

logisticsSchema.virtual('autoReleaseDeadline').get(function () {
  if (this.step3_autoRelease?.scheduledAt) return this.step3_autoRelease.scheduledAt;
  if (this.step2_deliveryScan?.scannedAt) {
    return new Date(this.step2_deliveryScan.scannedAt.getTime() + 72 * 60 * 60 * 1000);
  }
  return null;
});

// ─── Instance Methods ─────────────────────────────────────────────────────────

/**
 * Step 1 — Driver scans Seller's QR code at pickup.
 * Marks shipment IN_TRANSIT and notifies seller.
 */
logisticsSchema.methods.recordPickupScan = async function ({ scannedBy, lat, lng, ipAddress }) {
  if (this.status !== 'pending') {
    throw new Error(`Cannot record pickup scan: current status is "${this.status}"`);
  }

  this.step1_pickupScan = {
    scannedBy,
    scannedAt: new Date(),
    gpsCoordinates: { lat, lng },
    ipAddress,
    verified: true
  };

  await this.updateStatus('in_transit', null, 'Driver scanned seller QR at pickup', scannedBy);

  // Generate driver's own QR for the buyer scan
  if (!this.driverQrCode) {
    this.driverQrCode = _generateQrPayload('DRV', this._id);
  }

  await this.save();
  return this;
};

/**
 * Step 2 — Buyer scans Driver's QR code on delivery.
 * Marks shipment DELIVERED, calculates payouts, schedules 72-hr auto-release.
 */
logisticsSchema.methods.recordDeliveryScan = async function ({ scannedBy, lat, lng, ipAddress }) {
  if (this.status !== 'in_transit') {
    throw new Error(`Cannot record delivery scan: current status is "${this.status}"`);
  }

  this.step2_deliveryScan = {
    scannedBy,
    scannedAt: new Date(),
    gpsCoordinates: { lat, lng },
    ipAddress,
    verified: true
  };

  this.actualDelivery = new Date();

  // Schedule 72-hour auto-release
  const autoReleaseAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
  this.step3_autoRelease.scheduledAt = autoReleaseAt;

  // Calculate escrow splits
  _calculatePayouts(this);

  await this.updateStatus('delivered', null, 'Buyer scanned driver QR on delivery', scannedBy);
  await this.save();
  return this;
};

/**
 * Step 3 — Release escrow funds.
 * Called by a scheduled job after 72 hrs, or earlier by buyer confirmation / admin.
 */
logisticsSchema.methods.releaseEscrow = async function (triggeredBy = 'auto') {
  if (this.escrow.status !== 'holding') {
    throw new Error(`Escrow already in state "${this.escrow.status}"`);
  }
  if (this.status !== 'delivered') {
    throw new Error('Cannot release escrow: delivery not confirmed');
  }
  if (this.escrow.disputeOpenedAt) {
    throw new Error('Cannot auto-release: a dispute is open');
  }

  this.escrow.status = 'released';
  this.escrow.releasedAt = new Date();
  this.step3_autoRelease.releasedAt = new Date();
  this.step3_autoRelease.triggeredBy = triggeredBy;

  await this.save();
  return this;
};

/**
 * Open a dispute — freezes auto-release.
 */
logisticsSchema.methods.openDispute = async function (openedBy) {
  if (['delivered', 'in_transit'].indexOf(this.status) === -1) {
    throw new Error('Disputes can only be opened on in-transit or delivered shipments');
  }

  this.status = 'disputed';
  this.escrow.disputeOpenedAt = new Date();
  this.escrow.status = 'disputed';

  this.trackingHistory.push({
    status: 'disputed',
    notes: 'Dispute opened — escrow frozen',
    timestamp: new Date(),
    updatedBy: openedBy
  });

  await this.save();
  return this;
};

/**
 * General status update with full tracking history entry.
 */
logisticsSchema.methods.updateStatus = async function (status, location, notes, updatedBy) {
  this.status = status;
  if (location) this.currentLocation = location;
  if (status === 'delivered' && !this.actualDelivery) this.actualDelivery = new Date();

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

// ─── Static Methods ───────────────────────────────────────────────────────────

logisticsSchema.statics.getDeliveryStats = async function (startDate, endDate) {
  const match = {};
  if (startDate || endDate) {
    match.createdAt = {};
    if (startDate) match.createdAt.$gte = new Date(startDate);
    if (endDate)   match.createdAt.$lte = new Date(endDate);
  }

  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalEscrow: { $sum: '$escrow.totalAmount' },
        totalPlatformCommission: { $sum: '$escrow.platformCommission' },
        totalSinkingFund: { $sum: '$escrow.sinkingFundDeduction' },
        avgDeliveryTime: {
          $avg: {
            $cond: [
              { $and: [{ $ne: ['$actualDelivery', null] }, { $ne: ['$createdAt', null] }] },
              { $subtract: ['$actualDelivery', '$createdAt'] },
              null
            ]
          }
        }
      }
    }
  ]);
};

/**
 * Find all shipments whose auto-release window has expired and escrow is still holding.
 */
logisticsSchema.statics.findPendingAutoReleases = async function () {
  return this.find({
    status: 'delivered',
    'escrow.status': 'holding',
    'escrow.disputeOpenedAt': { $exists: false },
    'step3_autoRelease.scheduledAt': { $lte: new Date() },
    'step3_autoRelease.releasedAt': { $exists: false }
  });
};

// ─── Pre-save Middleware ──────────────────────────────────────────────────────

logisticsSchema.pre('save', async function (next) {
  // Auto-generate Seller QR when logistics record is first created
  if (this.isNew && !this.sellerQrCode) {
    this.sellerQrCode = _generateQrPayload('SEL', this._id);
  }

  // Auto-generate human-readable tracking number once picked up
  if (!this.trackingNumber && this.status !== 'pending') {
    const prefix = this.driverType === 'owner_operator' ? 'OOP' : 'HDP';
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    this.trackingNumber = `${prefix}${timestamp}${random}`;
  }

  next();
});

// ─── Helpers (module-private) ─────────────────────────────────────────────────

/**
 * Calculates platform commission (5–10%), driver payout, seller payout,
 * and 10% sinking fund deduction from driver payout.
 * All stored on this.escrow — caller must save().
 */
function _calculatePayouts(logisticsDoc) {
  const e = logisticsDoc.escrow;
  const total = e.totalAmount || 0;
  const rate  = e.platformCommissionRate || 0.075;

  e.platformCommission = parseFloat((total * rate).toFixed(2));

  const remainder = total - e.platformCommission;

  // 60% seller / 40% driver of the remainder (adjust to your business rules)
  const rawDriverPayout  = parseFloat((remainder * 0.40).toFixed(2));
  const rawSellerPayout  = parseFloat((remainder * 0.60).toFixed(2));

  // 10% of driver payout → Maintenance / Sinking Fund
  e.sinkingFundDeduction = parseFloat((rawDriverPayout * 0.10).toFixed(2));
  e.driverPayout         = parseFloat((rawDriverPayout - e.sinkingFundDeduction).toFixed(2));
  e.sellerPayout         = rawSellerPayout;
}

function _generateQrPayload(prefix, logisticsId) {
  const ts     = Date.now().toString(36).toUpperCase();
  const rand   = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `${prefix}-${logisticsId}-${ts}-${rand}`;
}

module.exports = mongoose.model('Logistics', logisticsSchema);