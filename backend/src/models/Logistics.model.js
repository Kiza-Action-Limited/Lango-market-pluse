'use strict';

/**
 * Lango MarketPulse — Logistics Model
 * Kakuma–Kitale Corridor | Plan 4 "Mizigo"
 *
 * Tracks every shipment from warehouse to doorstep with:
 *  - 3-way QR handshake (pickup → delivery → auto-release)
 *  - M-Pesa escrow integration hooks
 *  - GPS verification at delivery (50 m radius enforced in service layer)
 *  - Sinking fund deduction on every payout
 *  - Fleet-owner vs solo-driver payment routing
 */

const mongoose = require('mongoose');
const User = require('./User.model');
const Transaction = require('./Transaction.model');

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const STATUSES = Object.freeze([
  'pending',
  'driver_assigned',
  'en_route_to_pickup',
  'picked_up',       // QR Step 1 complete — seller's QR scanned
  'in_transit',
  'out_for_delivery',
  'delivered',       // QR Step 2 complete — buyer's QR scanned
  'auto_released',   // Escrow released after 72-hr window
  'failed',
  'returned',
  'disputed',
]);

const CARRIERS = Object.freeze([
  'solo_owner_operator',  // Driver owns the vehicle; receives payment directly
  'fleet_managed',        // Fleet owner receives payment; driver gets wage
  'third_party',          // External carrier (DHL, local courier, etc.)
  'other',
]);

const WEIGHT_UNITS  = Object.freeze(['kg', 'g', 'lb', 'tons']);
const DIM_UNITS     = Object.freeze(['cm', 'in']);

// ─────────────────────────────────────────────────────────────────────────────
// SUB-SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────

<<<<<<< HEAD
/**
 * A single entry in the immutable tracking history log.
 * Every status change appends a new entry; entries are never mutated.
 */
const trackingEventSchema = new mongoose.Schema(
  {
    status    : { type: String, enum: STATUSES, required: true },
    location  : { type: String, trim: true },
    notes     : { type: String, trim: true },
    gpsCoords : {
      lat : { type: Number },
      lng : { type: Number },
=======
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
  fleetOwner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  payoutRecipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  payoutRecipientType: {
    type: String,
    enum: ['driver', 'fleet_owner'],
    default: 'driver'
  },

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
>>>>>>> a4ca05ef18bdd6473e0d7b4cf68582b8dde40cd6
    },
    updatedBy : { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    timestamp : { type: Date, default: Date.now },
  },
  { _id: true }
);

/**
 * QR token record for the 3-way handshake.
 * Each of the two physical scans gets its own entry when completed.
 */
const qrScanSchema = new mongoose.Schema(
  {
    step      : { type: String, enum: ['pickup', 'delivery'], required: true },
    scannedBy : { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    scannedAt : { type: Date, default: Date.now },
    gpsCoords : {
      lat : { type: Number },
      lng : { type: Number },
    },
    verified  : { type: Boolean, default: true },
  },
  { _id: true }
);

/**
 * Financial settlement record for the escrow release.
 */
const settlementSchema = new mongoose.Schema(
  {
    totalEscrowed    : { type: Number, min: 0, default: 0 },    // KES held
    platformFee      : { type: Number, min: 0, default: 0 },    // 5–10%
    sinkingFund      : { type: Number, min: 0, default: 0 },    // 10% of driver payout
    sellerPayout     : { type: Number, min: 0, default: 0 },
    driverPayout     : { type: Number, min: 0, default: 0 },
    fleetOwnerPayout : { type: Number, min: 0, default: 0 },    // if fleet_managed
    releasedAt       : { type: Date },
    releaseMethod    : { type: String, enum: ['qr_confirmed', 'auto_72h', 'admin_override'] },
    mpesaReference   : { type: String, trim: true },
  },
  { _id: false }
);

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCHEMA
// ─────────────────────────────────────────────────────────────────────────────

const logisticsSchema = new mongoose.Schema(
  {
    // ── Relationships ────────────────────────────────────────────────────────
    order : {
      type     : mongoose.Schema.Types.ObjectId,
      ref      : 'Order',
      required : true,
      unique   : true,
    },
    orderNumber : {
      type     : String,
      required : true,
      index    : true,
    },

    // ── Parties ──────────────────────────────────────────────────────────────
    /** User who created the cargo request (farmer / wholesaler / manufacturer) */
    seller : {
      type     : mongoose.Schema.Types.ObjectId,
      ref      : 'User',
      required : true,
    },
    /** User who will receive the cargo (retailer / wholesaler) */
    buyer : {
      type     : mongoose.Schema.Types.ObjectId,
      ref      : 'User',
      required : true,
    },
    /** Assigned driver account */
    driver : {
      type : mongoose.Schema.Types.ObjectId,
      ref  : 'User',
    },
    /** For fleet_managed carrier type — payment goes here, not to driver */
    fleetOwner : {
      type : mongoose.Schema.Types.ObjectId,
      ref  : 'User',
    },
    driverName  : { type: String, trim: true },
    driverPhone : { type: String, trim: true },

    // ── Tracking ─────────────────────────────────────────────────────────────
    trackingNumber : {
      type   : String,
      unique : true,
      sparse : true,
      trim   : true,
    },
    status : {
      type     : String,
      enum     : STATUSES,
      default  : 'pending',
      required : true,
      index    : true,
    },
    carrier : {
      type    : String,
      enum    : CARRIERS,
      default : 'solo_owner_operator',
    },
    currentLocation : {
      type    : String,
      trim    : true,
      default : 'Warehouse',
    },
    trackingHistory : [trackingEventSchema],
    qrScans         : [qrScanSchema],

    // ── Cargo ─────────────────────────────────────────────────────────────────
    cargoType    : { type: String, trim: true },    // e.g. "Maize"
    weight       : { type: Number, min: 0 },
    weightUnit   : { type: String, enum: WEIGHT_UNITS, default: 'kg' },
    dimensions   : {
      length : { type: Number, min: 0 },
      width  : { type: Number, min: 0 },
      height : { type: Number, min: 0 },
      unit   : { type: String, enum: DIM_UNITS, default: 'cm' },
    },

    // ── Addresses ─────────────────────────────────────────────────────────────
    pickupAddress : {
      label   : { type: String, trim: true },   // e.g. "Kakuma Market Gate 3"
      county  : { type: String, trim: true },
      town    : { type: String, trim: true },
      gpsLat  : { type: Number },
      gpsLng  : { type: Number },
    },
    shippingAddress : {
      label   : { type: String, trim: true },
      county  : { type: String, required: true, trim: true },
      town    : { type: String, required: true, trim: true },
      street  : { type: String, trim: true },
      gpsLat  : { type: Number },
      gpsLng  : { type: Number },
      country : { type: String, default: 'Kenya' },
    },

    // ── Scheduling ────────────────────────────────────────────────────────────
    estimatedDelivery : { type: Date },
    actualDelivery    : { type: Date },
    escrowReleaseDue  : { type: Date },   // createdAt + 72h — set on delivery

    // ── Financials ────────────────────────────────────────────────────────────
    shippingCost : { type: Number, min: 0, default: 0 },
    insurance    : {
      enabled : { type: Boolean, default: false },
      value   : { type: Number,  min: 0, default: 0 },
    },
    settlement : settlementSchema,

    // ── Group-Buy / Shared Trip ────────────────────────────────────────────────
    groupTrip   : {
      enabled    : { type: Boolean, default: false },
      tripId     : { type: String },
      cargoShare : { type: Number, min: 0 },     // kg assigned to this booking
      costShare  : { type: Number, min: 0 },     // KES proportional share
    },

    // ── Flags ─────────────────────────────────────────────────────────────────
    isExpress : { type: Boolean, default: false }, // 3-min accept window
    isReturn  : { type: Boolean, default: false }, // return-leg shipment

    // ── Misc ──────────────────────────────────────────────────────────────────
    notes    : { type: String, trim: true },
    metadata : { type: Map, of: mongoose.Schema.Types.Mixed, default: {} },
  },
  {
    timestamps  : true,
    toJSON      : { virtuals: true },
    toObject    : { virtuals: true },
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// INDEXES
// ─────────────────────────────────────────────────────────────────────────────

logisticsSchema.index({ status: 1, createdAt: -1 });
logisticsSchema.index({ carrier: 1, status: 1 });
logisticsSchema.index({ driver: 1, status: 1 });
logisticsSchema.index({ seller: 1 });
logisticsSchema.index({ buyer: 1 });
logisticsSchema.index({ estimatedDelivery: 1 });
logisticsSchema.index({ escrowReleaseDue: 1 });         // for auto-release cron job
logisticsSchema.index({ 'groupTrip.tripId': 1 });

// ─────────────────────────────────────────────────────────────────────────────
// VIRTUALS
// ─────────────────────────────────────────────────────────────────────────────

/** Delivery duration in days (only available after delivery). */
logisticsSchema.virtual('deliveryDurationDays').get(function () {
  if (!this.actualDelivery || !this.createdAt) return null;
  return Math.ceil((this.actualDelivery - this.createdAt) / (1000 * 60 * 60 * 24));
});

/** True once QR Step 1 (pickup) has been scanned. */
logisticsSchema.virtual('pickupQrConfirmed').get(function () {
  return this.qrScans.some((s) => s.step === 'pickup' && s.verified);
});

/** True once QR Step 2 (delivery) has been scanned. */
logisticsSchema.virtual('deliveryQrConfirmed').get(function () {
  return this.qrScans.some((s) => s.step === 'delivery' && s.verified);
});

// ─────────────────────────────────────────────────────────────────────────────
// INSTANCE METHODS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Transition to a new status and append to the immutable tracking log.
 *
 * @param {string} status      - Must be a valid STATUSES entry
 * @param {Object} [opts]
 * @param {string} [opts.location]
 * @param {string} [opts.notes]
 * @param {{lat:number,lng:number}} [opts.gpsCoords]
 * @param {string} [opts.updatedBy]  - User ObjectId
 */
logisticsSchema.methods.updateStatus = async function (status, opts = {}) {
  const { location, notes, gpsCoords, updatedBy } = opts;

  if (!STATUSES.includes(status)) {
    throw new Error(`Invalid logistics status: "${status}"`);
  }

<<<<<<< HEAD
=======
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
  if (!this.payoutRecipient) {
    if (this.driverType === 'hired_driver' && this.fleetOwner) {
      this.payoutRecipient = this.fleetOwner;
      this.payoutRecipientType = 'fleet_owner';
    } else if (this.driver) {
      this.payoutRecipient = this.driver;
      this.payoutRecipientType = 'driver';
    }
  }

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
  if (!this.payoutRecipient) {
    throw new Error('Cannot release escrow: payout recipient is not configured');
  }

  const recipient = await User.findById(this.payoutRecipient);
  if (!recipient) {
    throw new Error('Cannot release escrow: payout recipient not found');
  }

  this.escrow.status = 'released';
  this.escrow.releasedAt = new Date();
  this.step3_autoRelease.releasedAt = new Date();
  this.step3_autoRelease.triggeredBy = triggeredBy;

  const payoutAmount = Number(this.escrow.driverPayout || 0);
  const sinkingAmount = Number(this.escrow.sinkingFundDeduction || 0);
  const commissionAmount = Number(this.escrow.platformCommission || 0);

  recipient.walletBalance = Number(recipient.walletBalance || 0) + payoutAmount;
  recipient.sinkingFundBalance = Number(recipient.sinkingFundBalance || 0) + sinkingAmount;
  await recipient.save();

  await Transaction.create({
    user: recipient._id,
    type: 'escrow_release',
    amount: payoutAmount,
    balanceAfter: recipient.walletBalance,
    reference: String(this._id),
    description: `Logistics payout release for trip ${this.orderNumber}`,
    metadata: new Map([
      ['driverType', this.driverType],
      ['payoutRecipientType', this.payoutRecipientType],
      ['sinkingFundDeduction', sinkingAmount],
      ['platformCommission', commissionAmount],
    ]),
  });

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
>>>>>>> a4ca05ef18bdd6473e0d7b4cf68582b8dde40cd6
  this.status = status;
  if (location) this.currentLocation = location;

  if (status === 'delivered' && !this.actualDelivery) {
    this.actualDelivery   = new Date();
    this.escrowReleaseDue = new Date(Date.now() + 72 * 60 * 60 * 1000);
  }

  this.trackingHistory.push({
    status,
    location   : location ?? this.currentLocation,
    notes,
    gpsCoords,
    updatedBy,
    timestamp  : new Date(),
  });

  return this.save();
};

/**
 * Record a QR scan event for the 3-way handshake.
 *
 * @param {'pickup'|'delivery'} step
 * @param {string}   scannedBy     - User ObjectId who performed the scan
 * @param {{lat:number,lng:number}} [gpsCoords]
 */
logisticsSchema.methods.recordQrScan = async function (step, scannedBy, gpsCoords) {
  if (!['pickup', 'delivery'].includes(step)) {
    throw new Error(`Invalid QR step: "${step}"`);
  }

  this.qrScans.push({ step, scannedBy, gpsCoords, scannedAt: new Date() });

  // Auto-advance status
  if (step === 'pickup') {
    await this.updateStatus('picked_up', { notes: 'QR Step 1 — seller QR scanned', gpsCoords, updatedBy: scannedBy });
  } else if (step === 'delivery') {
    await this.updateStatus('delivered', { notes: 'QR Step 2 — buyer QR scanned', gpsCoords, updatedBy: scannedBy });
  }

  return this.save();
};

// ─────────────────────────────────────────────────────────────────────────────
// STATIC METHODS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Aggregated delivery statistics, optionally filtered by date range.
 *
 * @param {Date|string} [startDate]
 * @param {Date|string} [endDate]
 * @returns {Promise<Array>}
 */
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
        _id   : '$status',
        count : { $sum: 1 },
        avgDeliveryMs : {
          $avg: {
            $cond: [
              { $and: [{ $ne: ['$actualDelivery', null] }, { $ne: ['$createdAt', null] }] },
              { $subtract: ['$actualDelivery', '$createdAt'] },
              null,
            ],
          },
        },
        totalRevenue : { $sum: '$settlement.sellerPayout' },
      },
    },
  ]);
};

/**
 * Find all shipments whose 72-hour auto-release window has passed
 * and are still in 'delivered' status (no dispute raised).
 *
 * @returns {Promise<Array>}
 */
logisticsSchema.statics.findPendingAutoRelease = async function () {
  return this.find({
    status           : 'delivered',
    escrowReleaseDue : { $lte: new Date() },
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// MIDDLEWARE
// ─────────────────────────────────────────────────────────────────────────────

/** Auto-generate a tracking number on first status change away from 'pending'. */
logisticsSchema.pre('save', function (next) {
  if (!this.trackingNumber && this.status !== 'pending') {
    const prefix    = 'LMP';   // Lango MarketPulse
    const timestamp = Date.now().toString().slice(-8);
    const random    = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    this.trackingNumber = `${prefix}${timestamp}${random}`;
  }
  if (typeof next === 'function') next();
});

// ─────────────────────────────────────────────────────────────────────────────

<<<<<<< HEAD
module.exports = mongoose.model('Logistics', logisticsSchema);
=======
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

  const grossDriverPayout = parseFloat((total - e.platformCommission).toFixed(2));
  e.sinkingFundDeduction = parseFloat((grossDriverPayout * 0.10).toFixed(2));
  e.driverPayout = parseFloat((grossDriverPayout - e.sinkingFundDeduction).toFixed(2));
  e.sellerPayout = 0;
}

function _generateQrPayload(prefix, logisticsId) {
  const ts     = Date.now().toString(36).toUpperCase();
  const rand   = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `${prefix}-${logisticsId}-${ts}-${rand}`;
}

module.exports = mongoose.model('Logistics', logisticsSchema);

>>>>>>> a4ca05ef18bdd6473e0d7b4cf68582b8dde40cd6
