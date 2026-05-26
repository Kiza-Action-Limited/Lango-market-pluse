const PLAN_IDS = {
  SOLO: 'solo',
  SMART: 'smart',
  GROWTH: 'growth',
  MIZIGO: 'mizigo',
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
    },
  },
  [PLAN_IDS.SMART]: {
    id: PLAN_IDS.SMART,
    name: 'Lango Smart',
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
    },
  },
  [PLAN_IDS.GROWTH]: {
    id: PLAN_IDS.GROWTH,
    name: 'Lango Growth',
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
  },
  [PLAN_IDS.MIZIGO]: {
    id: PLAN_IDS.MIZIGO,
    name: 'Lango Mizigo',
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
};
