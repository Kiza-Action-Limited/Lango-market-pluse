// import { TRADER_PLANS, MIZIGO_PLANS, processTripPayment, qrDeliveryScan } from './path/to/file';


// ===============================
// 1. SUBSCRIPTION PLANS (Rearranged to match new table)
// ===============================
export const SUBSCRIPTION_TRACKS = {
  TRADER: 'trader',
  MIZIGO: 'mizigo',
};

export const SUBSCRIPTION_FEATURES = {
  // Core
  INVENTORY_LEDGER: 'inventory-ledger',
  METADATA_BUCKET: 'metadata-bucket',
  ESCROW_CLIENT: 'escrow-client',
  MANUAL_CRM: 'manual-crm',
  REVENUE_TRACKER: 'revenue-tracker',
  QR_HANDSHAKE: 'qr-handshake',
  AUTO_SYNC: 'auto-sync',

  // New table features
  INVENTORY_UNLIMITED: 'inventory-unlimited',
  CRM_ACTIVE: 'crm-active',
  SMS_CREDITS_500: 'sms-credits-500',
  SMS_CREDITS_2000: 'sms-credits-2000',
  CFO_BASIC: 'cfo-basic',
  CFO_SMART: 'cfo-smart',
  CFO_AUDIT: 'cfo-audit',
  STAFF_ROLES: 'staff-roles',
  DAILY_BURN: 'daily-burn',
  ASSET_TRACKING: 'asset-tracking',
  REPORTS_VITALS: 'reports-vitals',
  REPORTS_PERFORMANCE: 'reports-performance',
  REPORTS_AUDIT: 'reports-audit',

  // Logistics / Mizigo specific
  WALLET_SPLITTER: 'wallet-splitter',
  RADIAL_EXPRESS_ALERTS: 'radial-express-alerts',
  GROUP_BUY_MATCHER: 'group-buy-matcher',
  THREE_WAY_QR_HANDSHAKE: 'three-way-qr-handshake',
  TAKE_HOME_GAUGE: 'take-home-gauge',
  MILEAGE_SERVICE_ALERT: 'mileage-service-alert',
  VERIFIED_TRIP_PDF: 'verified-trip-pdf',
  SINKING_FUND: 'sinking-fund',
  LIVE_STATUS_BRIDGE: 'live-status-bridge',
};

const F = SUBSCRIPTION_FEATURES;

// Updated TRADER_PLANS to match the new table (Solo, Smart, Growth)

export const TRADER_PLANS = [
  {
    id: 'trader_solo',
    track: SUBSCRIPTION_TRACKS.TRADER,
    name: 'Solo',
    priceLabel: 'KSh 500',
    targetUser: 'Micro-Retail/Farmer',
    differentiator: 'Manual Operations',
    description: 'Essential digital ledger and transaction tools.',
    featureKeys: [
      F.INVENTORY_LEDGER,     // 30 unique items
      F.AUTO_SYNC,
      F.MANUAL_CRM,           // Capture only (No SMS)
      F.REVENUE_TRACKER,      // Basic (Gross Profit)
      F.QR_HANDSHAKE,
      F.REPORTS_VITALS,       // Vitals PDF (Sales/Purch)
    ],
    limits: { inventoryLimit: 30, smsCredits: 0 },
  },
  {
    id: 'trader_smart',
    track: SUBSCRIPTION_TRACKS.TRADER,
    name: 'Smart',
    priceLabel: 'KSh 2,500',
    targetUser: 'Growing Wholesaler',
    differentiator: 'Predictive Maneuverability',
    description: 'Active CRM and performance dashboards.',
    featureKeys: [
      F.INVENTORY_UNLIMITED,
      F.AUTO_SYNC,
      F.CRM_ACTIVE,           // Restock/Alerts
      F.SMS_CREDITS_500,
      F.CFO_SMART,            // Net Profit Gauge
      F.QR_HANDSHAKE,
      F.REPORTS_PERFORMANCE,  // Performance PDF (ROI)
    ],
    limits: { inventoryLimit: Infinity, smsCredits: 500 },
  },
  {
    id: 'trader_growth',
    track: SUBSCRIPTION_TRACKS.TRADER,
    name: 'Growth',
    priceLabel: 'KSh 6,500',
    targetUser: 'Large Factory/Estate',
    differentiator: 'Macro-Intelligence & Audit',
    description: 'Full wealth tracking, staff roles, and asset management.',
    featureKeys: [
      F.INVENTORY_UNLIMITED,
      F.AUTO_SYNC,
      F.CRM_ACTIVE,
      F.SMS_CREDITS_2000,
      F.CFO_AUDIT,            // Wealth Tracker
      F.STAFF_ROLES,
      F.DAILY_BURN,           // Lunch, Fuel, etc.
      F.ASSET_TRACKING,       // Land & Buildings
      F.QR_HANDSHAKE,
      F.REPORTS_AUDIT,        // Audit PDF (Net Worth)
    ],
    limits: { inventoryLimit: Infinity, smsCredits: 2000 },
  },
];

// MIZIGO_PLANS (Logistics focus – Owner‑Operator / Fleet)
export const MIZIGO_PLANS = [
  {
    id: 'mizigo_solo',
    track: SUBSCRIPTION_TRACKS.MIZIGO,
    name: 'Owner‑Operator',
    priceLabel: 'Entry',
    differentiator: 'Manual Booking & Verification',
    description: 'For independent drivers managing one truck.',
    featureKeys: [
      F.DIGITAL_WAYBILL,
      F.QR_HANDSHAKE,
      F.UNIFIED_BOOKING_QUEUE,
      F.REVENUE_TRACKER,
      F.TAKE_HOME_GAUGE,
      F.VERIFIED_TRIP_PDF,
    ],
  },
  {
    id: 'mizigo_pro',
    track: SUBSCRIPTION_TRACKS.MIZIGO,
    name: 'Fleet Pro',
    priceLabel: 'Custom',
    differentiator: 'Reactive Efficiency',
    description: 'Load factor optimisation & shared‑cost automation.',
    featureKeys: [

      F.DIGITAL_WAYBILL,
      F.QR_HANDSHAKE,
      F.UNIFIED_BOOKING_QUEUE,
      F.REVENUE_TRACKER,
      F.GROUP_BUY_MATCHER,
      F.SHARED_COST_CALCULATOR,
      F.ROUTE_INTELLIGENCE_LITE,
      F.MIZIGO_CFO_HOOK,
      F.TAKE_HOME_GAUGE,
      F.MILEAGE_SERVICE_ALERT,
      F.SINKING_FUND,
      F.VERIFIED_TRIP_PDF,

    ],
  },
  {
    id: 'mizigo_enterprise',
    track: SUBSCRIPTION_TRACKS.MIZIGO,
    name: 'Fleet Enterprise',
    priceLabel: 'Custom',
    differentiator: 'Predictive Logistics & Asset Protection',
    description: 'Predictive routing, maintenance, scarcity bridge.',
    featureKeys: [
      F.DIGITAL_WAYBILL,
      F.QR_HANDSHAKE,
      F.UNIFIED_BOOKING_QUEUE,
      F.REVENUE_TRACKER,
      F.GROUP_BUY_MATCHER,
      F.SHARED_COST_CALCULATOR,
      F.ROUTE_INTELLIGENCE_LITE,
      F.MIZIGO_CFO_HOOK,
      F.PREDICTIVE_ROUTE_INTELLIGENCE,
      F.CAPEX_MAINTENANCE_GUARD,
      F.MACRO_SCARCITY_BRIDGE,
      F.FLEET_API,
      F.TAKE_HOME_GAUGE,
      F.MILEAGE_SERVICE_ALERT,
      F.SINKING_FUND,
      F.VERIFIED_TRIP_PDF,
      F.LIVE_STATUS_BRIDGE,

    ],
  },
];

export const ALL_PLANS = [...TRADER_PLANS, ...MIZIGO_PLANS];

export const FEATURE_LABELS = {
  [F.INVENTORY_LEDGER]: 'Inventory ledger (up to 30 SKUs)',
  [F.INVENTORY_UNLIMITED]: 'Unlimited inventory items',
  [F.AUTO_SYNC]: 'Auto-sync across buyer/seller devices',
  [F.MANUAL_CRM]: 'Manual CRM – capture only (no SMS)',
  [F.CRM_ACTIVE]: 'Active CRM – restock alerts & campaigns',
  [F.SMS_CREDITS_500]: '500 SMS credits per month',
  [F.SMS_CREDITS_2000]: '2,000 SMS credits per month',
  [F.CFO_BASIC]: 'Basic CFO dashboard (gross profit)',
  [F.CFO_SMART]: 'Smart CFO dashboard (net profit gauge)',
  [F.CFO_AUDIT]: 'Audit CFO dashboard (wealth tracker)',
  [F.STAFF_ROLES]: 'Staff & owner roles',
  [F.DAILY_BURN]: 'Daily burn logging (fuel, lunch, airtime)',
  [F.ASSET_TRACKING]: 'Asset tracking (land & buildings)',
  [F.REPORTS_VITALS]: 'Vitals PDF (sales / purchases)',
  [F.REPORTS_PERFORMANCE]: 'Performance PDF (ROI analysis)',
  [F.REPORTS_AUDIT]: 'Audit PDF (net worth statement)',
  [F.QR_HANDSHAKE]: 'QR handshake',
  [F.WALLET_SPLITTER]: 'Wallet splitter (owner vs hired driver)',
  [F.RADIAL_EXPRESS_ALERTS]: 'Radial express alerts (10km radius)',
  [F.GROUP_BUY_MATCHER]: 'Group‑buy matcher (80% capacity fill)',
  [F.THREE_WAY_QR_HANDSHAKE]: '3‑way QR handshake (escrow release)',
  [F.TAKE_HOME_GAUGE]: '“Take‑Home” gauge (revenue – fuel – daily burn)',
  [F.MILEAGE_SERVICE_ALERT]: 'Mileage & service alert',
  [F.VERIFIED_TRIP_PDF]: 'Verified trip PDF (loan‑ready)',
  [F.SINKING_FUND]: 'Sinking fund (10% locked for maintenance)',
  [F.LIVE_STATUS_BRIDGE]: 'Live status bridge (shared progress bar)',
  // ... (keep any existing labels you had)
};

// ===============================
// 2. LOGISTICS IMPLEMENTATION (Mizigo Core) – Plain JS
// ===============================


export function processTripPayment(trip, driver) {
  const commission = trip.revenue * 0.05; // platform fee 5%
  const netRevenue = trip.revenue - commission;

  if (!driver.employerId) {
    return { driverPayout: netRevenue, ownerPayout: 0 };
  } else {
    return { driverPayout: 0, ownerPayout: netRevenue };
  }
}

// ---------- 2.2 Radial Express Alert (Geo‑based push) ----------
function getDriversWithinRadius(lat, lng, radiusKm) {
  return ['driver_1', 'driver_2'];
}

export function sendExpressAlert(request) {
  if (request.urgency === 'express') {
    const nearbyDrivers = getDriversWithinRadius(request.pickupLat, request.pickupLng, 10);
    console.log(`🚨 Express alert sent to drivers: ${nearbyDrivers.join(', ')}`);
  }
}

// ---------- 2.3 Group‑Buy Matcher (Batch consolidation) ----------
export function matchGroupBuy(orders, truckCapacity) {
  const batches = [];
  let currentBatch = [];
  let currentVolume = 0;

  for (const order of orders) {
    if (currentVolume + order.volume <= truckCapacity * 0.8) {
      currentBatch.push(order);
      currentVolume += order.volume;
    } else {
      if (currentBatch.length) batches.push(currentBatch);
      currentBatch = [order];
      currentVolume = order.volume;
    }
  }
  if (currentBatch.length) batches.push(currentBatch);

  // Only return batches that are at least 80% full
  return batches.filter(batch => {
    const batchVolume = batch.reduce((sum, o) => sum + o.volume, 0);
    return batchVolume / truckCapacity >= 0.8;
  });
}

// ---------- 2.4 3‑Way QR Handshake + Escrow Release ----------
export const TripStatus = {
  AWAITING_PICKUP: 'awaiting_pickup',
  IN_TRANSIT: 'in_transit',
  ARRIVING_SOON: 'arriving_soon',
  DELIVERED: 'delivered',
};

const tripsDB = new Map();

function releaseEscrow(trip) {
  // Pay seller and driver/owner simultaneously
  console.log(`💰 Escrow released for trip ${trip.id}: Seller ${trip.sellerId}, Driver ${trip.driverId}`);
}

export function qrPickupScan(tripId, scannerRole) {
  const trip = tripsDB.get(tripId);
  if (!trip) throw new Error('Trip not found');
  if (scannerRole === 'driver' && trip.status === TripStatus.AWAITING_PICKUP) {
    trip.status = TripStatus.IN_TRANSIT;
    console.log(`✅ Pickup verified. Trip ${tripId} is IN_TRANSIT.`);
  }
}

export function qrDeliveryScan(tripId, scannerRole) {
  const trip = tripsDB.get(tripId);
  if (!trip) throw new Error('Trip not found');
  if (scannerRole === 'buyer' && trip.status === TripStatus.IN_TRANSIT) {
    trip.status = TripStatus.DELIVERED;
    // Trigger escrow release
    releaseEscrow(trip);
    console.log(`🎉 Delivery verified. Escrow released: KSh ${trip.escrowAmount}`);
  }
}

// Helper to add a trip to the DB (for testing / integration)
export function addTripToDB(trip) {
  tripsDB.set(trip.id, trip);
}

// ---------- 2.5 CFO Daily Burn & Sinking Fund ----------
const driverFinanceDB = new Map();

export function addTripEarnings(driverId, tripRevenue) {
  const finance = driverFinanceDB.get(driverId);
  if (!finance) return;

  const sinkingContribution = tripRevenue * 0.10;
  finance.sinkingFund += sinkingContribution;
  console.log(`💾 Locked ${sinkingContribution} into sinking fund for driver ${driverId}`);
}

export function logDailyBurn(driverId, type, amount) {
  const finance = driverFinanceDB.get(driverId);
  if (finance) {
    finance.dailyBurn[type] += amount;
    console.log(`📝 ${type}: KSh ${amount} logged for driver ${driverId}`);
  }
}

export function initDriverFinance(driverId) {
  driverFinanceDB.set(driverId, {
    driverId,
    dailyBurn: { fuel: 0, lunch: 0, airtime: 0 },
    sinkingFund: 0,
    totalOdometer: 0,
  });
}

// ---------- 2.6 Mileage Service Alert ----------
export function updateOdometer(driverId, newKm) {
  const finance = driverFinanceDB.get(driverId);
  if (!finance) return;
  const prevKm = finance.totalOdometer;
  finance.totalOdometer = newKm;

  // Check if 5,000 km interval crossed
  if (Math.floor(newKm / 5000) > Math.floor(prevKm / 5000)) {
    console.log(`🔧 Oil change due! Use your sinking fund (KSh ${finance.sinkingFund}) to pay.`);
  }
}

// ---------- 2.7 Performance Report (Monthly PDF) ----------
export function generatePerformanceReport(driverId, month) {
  // In real code: aggregate from trip logs, daily burns, odometer, etc.
  const finance = driverFinanceDB.get(driverId);
  return {
    totalRevenue: 125000,
    totalFuelCost: 45000,
    efficiency: 125000 / 45000,
    onTimeRate: 94.5,
    sinkingFundBalance: finance?.sinkingFund || 0,
    vehicleValue: 850000,
  };
}

// ---------- 2.8 Live Status Bridge (Shared Progress Bar) ----------
export class LiveStatusBridge {
  constructor() {
    this.subscribers = new Map();
  }

  subscribe(tripId, callback) {
    if (!this.subscribers.has(tripId)) this.subscribers.set(tripId, []);
    this.subscribers.get(tripId).push(callback);
  }

  updateStatus(tripId, newStatus) {
    const trip = tripsDB.get(tripId);
    if (trip) trip.status = newStatus;
    const callbacks = this.subscribers.get(tripId) || [];
    callbacks.forEach(cb => cb(newStatus));
    console.log(`📡 Live status for trip ${tripId}: ${newStatus}`);
  }
}

export const liveStatus = new LiveStatusBridge();