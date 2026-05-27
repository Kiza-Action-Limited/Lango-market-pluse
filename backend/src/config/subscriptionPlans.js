<<<<<<< HEAD
const PLAN_IDS = Object.freeze({
=======
const PLAN_IDS = {
>>>>>>> a4ca05ef18bdd6473e0d7b4cf68582b8dde40cd6
  SOLO: 'solo',
  SMART: 'smart',
  GROWTH: 'growth',
  MIZIGO: 'mizigo',
<<<<<<< HEAD
});

const LEGACY_PLAN_ALIASES = Object.freeze({
  free: PLAN_IDS.SOLO,
  v3: PLAN_IDS.SOLO,
  v4: PLAN_IDS.SMART,
});

const PLAN_ORDER = Object.freeze({
  [PLAN_IDS.SOLO]: 1,
  [PLAN_IDS.SMART]: 2,
  [PLAN_IDS.GROWTH]: 3,
});

const FEATURE_KEYS = Object.freeze({
  AUTO_QR_SYNC: 'autoQrSync',
  INVENTORY_LEDGER: 'inventoryLedger',
  CRM_CAPTURE: 'crmCapture',
  SMS_GATEWAY: 'smsGateway',
  RESTOCK_ALERTS: 'restockAlerts',
  GROSS_PROFIT_DASHBOARD: 'grossProfitDashboard',
  NET_PROFIT_GAUGE: 'netProfitGauge',
  REGIONAL_GUARDIAN: 'regionalGuardian',
  STAFF_ROLES: 'staffRoles',
  BILL_GUARDIAN: 'billGuardian',
  DAILY_BURN_TRACKER: 'dailyBurnTracker',
  ASSET_TRACKING: 'assetTracking',
  TAX_LOGGER: 'taxLogger',
  VITALS_PDF: 'vitalsPdf',
  PERFORMANCE_PDF: 'performancePdf',
  AUDIT_PDF: 'auditPdf',
  LOGISTICS_BRIDGE: 'logisticsBridge',
  EXPRESS_ALERTS: 'radialExpressAlerts',
  GROUP_BUY_MATCHER: 'groupBuyMatcher',
  THREE_WAY_QR: 'threeWayQrHandshake',
  TAKE_HOME_GAUGE: 'takeHomeGauge',
  VERIFIED_TRIP_PDF: 'verifiedTripPdf',
  SINKING_FUND: 'sinkingFund',
});

const baseBusinessFeatures = {
  [FEATURE_KEYS.AUTO_QR_SYNC]: true,
  [FEATURE_KEYS.INVENTORY_LEDGER]: true,
  [FEATURE_KEYS.CRM_CAPTURE]: true,
  [FEATURE_KEYS.GROSS_PROFIT_DASHBOARD]: true,
  [FEATURE_KEYS.VITALS_PDF]: true,
  [FEATURE_KEYS.SMS_GATEWAY]: false,
  [FEATURE_KEYS.RESTOCK_ALERTS]: false,
  [FEATURE_KEYS.NET_PROFIT_GAUGE]: false,
  [FEATURE_KEYS.REGIONAL_GUARDIAN]: false,
  [FEATURE_KEYS.STAFF_ROLES]: false,
  [FEATURE_KEYS.BILL_GUARDIAN]: false,
  [FEATURE_KEYS.DAILY_BURN_TRACKER]: false,
  [FEATURE_KEYS.ASSET_TRACKING]: false,
  [FEATURE_KEYS.TAX_LOGGER]: false,
  [FEATURE_KEYS.PERFORMANCE_PDF]: false,
  [FEATURE_KEYS.AUDIT_PDF]: false,
  [FEATURE_KEYS.LOGISTICS_BRIDGE]: false,
  [FEATURE_KEYS.EXPRESS_ALERTS]: false,
  [FEATURE_KEYS.GROUP_BUY_MATCHER]: false,
  [FEATURE_KEYS.THREE_WAY_QR]: false,
  [FEATURE_KEYS.TAKE_HOME_GAUGE]: false,
  [FEATURE_KEYS.VERIFIED_TRIP_PDF]: false,
  [FEATURE_KEYS.SINKING_FUND]: false,
};

const PLANS = Object.freeze({
  [PLAN_IDS.SOLO]: {
    id: PLAN_IDS.SOLO,
    name: 'Lango Solo',
    displayName: 'Solo',
    tier: 1,
    billingModel: 'monthly',
    price: 500,
    currency: 'KES',
    skuLimit: 30,
    includedSmsCredits: 0,
    target: ['farmers', 'small_manufacturers', 'micro_retailers'],
    reportType: 'vitals_pdf',
    nextPlan: PLAN_IDS.SMART,
    features: { ...baseBusinessFeatures },
    lockedFeatures: {
      [FEATURE_KEYS.SMS_GATEWAY]: 'Upgrade to Plan 2 to message your customers.',
      [FEATURE_KEYS.RESTOCK_ALERTS]: 'Upgrade to Plan 2.',
      [FEATURE_KEYS.NET_PROFIT_GAUGE]: 'Upgrade to Plan 2 to see true net profit.',
      [FEATURE_KEYS.REGIONAL_GUARDIAN]: 'Upgrade to Plan 2 for regional scarcity alerts.',
      [FEATURE_KEYS.STAFF_ROLES]: 'Upgrade to Plan 3 to add staff roles.',
=======
};

const LEGACY_PLAN_ALIASES = {
  free: PLAN_IDS.SOLO,
  v3: PLAN_IDS.SMART,
  v4: PLAN_IDS.GROWTH,
};

const TIER_ORDER = {
  [PLAN_IDS.SOLO]: 1,
  [PLAN_IDS.SMART]: 2,
  [PLAN_IDS.GROWTH]: 3,
};

const PLANS = {
  [PLAN_IDS.SOLO]: {
    id: PLAN_IDS.SOLO,
    name: 'Lango Solo',
    billingType: 'monthly',
    priceKes: 500,
    skuLimit: 30,
    smsCreditsPerCycle: 0,
    features: {
      qrAutoSync: true,
      basicCfoDashboard: true,
      crmCapture: true,
      activeSmsCampaigns: false,
      restockAlerts: false,
      regionalGuardian: false,
      netProfitGauge: false,
      staffRbac: false,
      billGuardian: false,
      assetTracking: false,
      dailyBurnTracker: false,
      fullAuditPdf: false,
      checkCredits: false,
>>>>>>> a4ca05ef18bdd6473e0d7b4cf68582b8dde40cd6
    },
  },
  [PLAN_IDS.SMART]: {
    id: PLAN_IDS.SMART,
    name: 'Lango Smart',
<<<<<<< HEAD
    displayName: 'Smart',
    tier: 2,
    billingModel: 'monthly',
    price: 2500,
    currency: 'KES',
    skuLimit: null,
    includedSmsCredits: 500,
    target: ['growing_retailers', 'wholesalers', 'distributors'],
    reportType: 'performance_pdf',
    nextPlan: PLAN_IDS.GROWTH,
    features: {
      ...baseBusinessFeatures,
      [FEATURE_KEYS.SMS_GATEWAY]: true,
      [FEATURE_KEYS.RESTOCK_ALERTS]: true,
      [FEATURE_KEYS.NET_PROFIT_GAUGE]: true,
      [FEATURE_KEYS.REGIONAL_GUARDIAN]: true,
      [FEATURE_KEYS.PERFORMANCE_PDF]: true,
    },
    lockedFeatures: {
      [FEATURE_KEYS.STAFF_ROLES]: 'Upgrade to Plan 3 to add clerk accounts.',
      [FEATURE_KEYS.BILL_GUARDIAN]: 'Upgrade to Plan 3 for 10-day bill alerts.',
      [FEATURE_KEYS.DAILY_BURN_TRACKER]: 'Upgrade to Plan 3 to track daily burn.',
      [FEATURE_KEYS.ASSET_TRACKING]: 'Upgrade to Plan 3 to track assets and net worth.',
      [FEATURE_KEYS.AUDIT_PDF]: 'Upgrade to Plan 3 for the full audit PDF.',
=======
    billingType: 'monthly',
    priceKes: 2500,
    skuLimit: Number.MAX_SAFE_INTEGER,
    smsCreditsPerCycle: 500,
    features: {
      qrAutoSync: true,
      basicCfoDashboard: true,
      crmCapture: true,
      activeSmsCampaigns: true,
      restockAlerts: true,
      regionalGuardian: true,
      netProfitGauge: true,
      staffRbac: false,
      billGuardian: false,
      assetTracking: false,
      dailyBurnTracker: false,
      fullAuditPdf: false,
      checkCredits: true,
>>>>>>> a4ca05ef18bdd6473e0d7b4cf68582b8dde40cd6
    },
  },
  [PLAN_IDS.GROWTH]: {
    id: PLAN_IDS.GROWTH,
    name: 'Lango Growth',
<<<<<<< HEAD
    displayName: 'Growth',
    tier: 3,
    billingModel: 'monthly',
    price: 6500,
    currency: 'KES',
    skuLimit: null,
    includedSmsCredits: 2000,
    target: ['large_manufacturers', 'wholesalers', 'property_owners'],
    reportType: 'audit_pdf',
    nextPlan: null,
    features: {
      ...baseBusinessFeatures,
      [FEATURE_KEYS.SMS_GATEWAY]: true,
      [FEATURE_KEYS.RESTOCK_ALERTS]: true,
      [FEATURE_KEYS.NET_PROFIT_GAUGE]: true,
      [FEATURE_KEYS.REGIONAL_GUARDIAN]: true,
      [FEATURE_KEYS.PERFORMANCE_PDF]: true,
      [FEATURE_KEYS.STAFF_ROLES]: true,
      [FEATURE_KEYS.BILL_GUARDIAN]: true,
      [FEATURE_KEYS.DAILY_BURN_TRACKER]: true,
      [FEATURE_KEYS.ASSET_TRACKING]: true,
      [FEATURE_KEYS.TAX_LOGGER]: true,
      [FEATURE_KEYS.AUDIT_PDF]: true,
    },
    lockedFeatures: {},
=======
    billingType: 'monthly',
    priceKes: 6500,
    skuLimit: Number.MAX_SAFE_INTEGER,
    smsCreditsPerCycle: 2000,
    features: {
      qrAutoSync: true,
      basicCfoDashboard: true,
      crmCapture: true,
      activeSmsCampaigns: true,
      restockAlerts: true,
      regionalGuardian: true,
      netProfitGauge: true,
      staffRbac: true,
      billGuardian: true,
      assetTracking: true,
      dailyBurnTracker: true,
      fullAuditPdf: true,
      checkCredits: true,
    },
>>>>>>> a4ca05ef18bdd6473e0d7b4cf68582b8dde40cd6
  },
  [PLAN_IDS.MIZIGO]: {
    id: PLAN_IDS.MIZIGO,
    name: 'Lango Mizigo',
<<<<<<< HEAD
    displayName: 'Mizigo',
    tier: null,
    billingModel: 'commission',
    price: 0,
    currency: 'KES',
    commissionRate: { min: 0.05, max: 0.1 },
    sinkingFundRate: 0.1,
    skuLimit: null,
    includedSmsCredits: null,
    target: ['truck_drivers', 'fleet_owners'],
    reportType: 'verified_trip_pdf',
    nextPlan: null,
    standalone: true,
    features: {
      ...Object.fromEntries(Object.keys(baseBusinessFeatures).map((key) => [key, false])),
      [FEATURE_KEYS.AUTO_QR_SYNC]: true,
      [FEATURE_KEYS.LOGISTICS_BRIDGE]: true,
      [FEATURE_KEYS.EXPRESS_ALERTS]: true,
      [FEATURE_KEYS.GROUP_BUY_MATCHER]: true,
      [FEATURE_KEYS.THREE_WAY_QR]: true,
      [FEATURE_KEYS.TAKE_HOME_GAUGE]: true,
      [FEATURE_KEYS.VERIFIED_TRIP_PDF]: true,
      [FEATURE_KEYS.SINKING_FUND]: true,
    },
    lockedFeatures: {},
  },
});

const normalizePlanId = (planId) => LEGACY_PLAN_ALIASES[planId] || planId;

const getPlan = (planId) => PLANS[normalizePlanId(planId)] || null;

const isMonthlyPlan = (planId) => getPlan(planId)?.billingModel === 'monthly';

const meetsTier = (currentPlanId, requiredPlanId) => {
  const current = normalizePlanId(currentPlanId);
  const required = normalizePlanId(requiredPlanId);
  return (PLAN_ORDER[current] || 0) >= (PLAN_ORDER[required] || 0);
};

module.exports = {
  PLAN_IDS,
  PLAN_ORDER,
  FEATURE_KEYS,
  PLANS,
  LEGACY_PLAN_ALIASES,
  normalizePlanId,
  getPlan,
  isMonthlyPlan,
  meetsTier,
=======
    billingType: 'commission',
    commissionMin: 0.05,
    commissionMax: 0.1,
    sinkingFundRate: 0.1,
    smsCreditsPerCycle: 0,
    skuLimit: 0,
    features: {
      logisticsOnly: true,
      radialExpressAlert: true,
      groupTripMatcher: true,
      qrHandshake3Way: true,
      escrowAutoRelease72h: true,
      takeHomeGauge: true,
      verifiedTripPdf: true,
      checkCredits: false,
      staffRbac: false,
    },
  },
};

const normalizePlanId = (input) => {
  const value = String(input || '').toLowerCase().trim();
  if (!value) return PLAN_IDS.SOLO;
  if (LEGACY_PLAN_ALIASES[value]) return LEGACY_PLAN_ALIASES[value];
  if (PLANS[value]) return value;
  return PLAN_IDS.SOLO;
};

const getPlan = (id) => PLANS[normalizePlanId(id)];

module.exports = {
  PLAN_IDS,
  PLANS,
  TIER_ORDER,
  LEGACY_PLAN_ALIASES,
  normalizePlanId,
  getPlan,
>>>>>>> a4ca05ef18bdd6473e0d7b4cf68582b8dde40cd6
};
