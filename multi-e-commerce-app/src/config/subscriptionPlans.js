export const SUBSCRIPTION_TRACKS = {
  TRADER: 'trader',
  MIZIGO: 'mizigo',
};

export const PLAN_IDS = {
  SOLO: 'solo',
  SMART: 'smart',
  GROWTH: 'growth',
  MIZIGO: 'mizigo',
};

export const LEGACY_PLAN_ALIASES = {
  free: PLAN_IDS.SOLO,
  v3: PLAN_IDS.SMART,
  v4: PLAN_IDS.GROWTH,
  trader_solo: PLAN_IDS.SOLO,
  trader_smart: PLAN_IDS.SMART,
  trader_growth: PLAN_IDS.GROWTH,
  mizigo_solo: PLAN_IDS.MIZIGO,
  mizigo_pro: PLAN_IDS.MIZIGO,
  mizigo_enterprise: PLAN_IDS.MIZIGO,
};

export const SUBSCRIPTION_FEATURES = {
  INVENTORY_LEDGER: 'inventory_ledger',
  QR_AUTO_SYNC: 'qr_auto_sync',
  CRM_CAPTURE: 'crm_capture',
  ACTIVE_SMS_CAMPAIGNS: 'active_sms_campaigns',
  SMS_CREDITS_500: 'sms_credits_500',
  SMS_CREDITS_2000: 'sms_credits_2000',
  NET_PROFIT_GAUGE: 'net_profit_gauge',
  REGIONAL_GUARDIAN: 'regional_guardian',
  STAFF_RBAC: 'staff_rbac',
  BILL_GUARDIAN: 'bill_guardian',
  DAILY_BURN_TRACKER: 'daily_burn_tracker',
  ASSET_TRACKING: 'asset_tracking',
  AUDIT_PDF: 'audit_pdf',
  MIZIGO_QR_HANDSHAKE: 'mizigo_qr_handshake',
  MIZIGO_GROUP_MATCHER: 'mizigo_group_matcher',
  MIZIGO_EXPRESS_ALERT: 'mizigo_express_alert',
  TAKE_HOME_GAUGE: 'take_home_gauge',
  SINKING_FUND: 'sinking_fund',
  VERIFIED_TRIP_PDF: 'verified_trip_pdf',

  // Dashboard aliases used across older UI blocks.
  GUARDIAN_REGIONAL_ALARM: 'regional_guardian',
  CFO_LITE_HOOK: 'net_profit_gauge',
  CLEARANCE_AGENT: 'active_sms_campaigns',
  CASHFLOW_PREDICTION: 'bill_guardian',
};

const F = SUBSCRIPTION_FEATURES;

export const TRADER_PLANS = [
  {
    id: PLAN_IDS.SOLO,
    track: SUBSCRIPTION_TRACKS.TRADER,
    name: 'Solo',
    priceLabel: 'KES 500 / month',
    targetUser: 'Farmers · Small Manufacturers · Micro-Retailers',
    differentiator: 'Digital Ledger',
    description: 'Record stock and sales with a clean digital paper trail.',
    featureKeys: [
      F.INVENTORY_LEDGER,
      F.QR_AUTO_SYNC,
      F.CRM_CAPTURE,
    ],
    limits: { inventoryLimit: 30, smsCredits: 0 },
  },
  {
    id: PLAN_IDS.SMART,
    track: SUBSCRIPTION_TRACKS.TRADER,
    name: 'Smart',
    priceLabel: 'KES 2,500 / month',
    targetUser: 'Growing Retailers · Wholesalers · Distributors',
    differentiator: 'Assistant Tier',
    description: 'Add outbound SMS tools and stronger profit visibility.',
    featureKeys: [
      F.INVENTORY_LEDGER,
      F.QR_AUTO_SYNC,
      F.CRM_CAPTURE,
      F.ACTIVE_SMS_CAMPAIGNS,
      F.SMS_CREDITS_500,
      F.NET_PROFIT_GAUGE,
      F.REGIONAL_GUARDIAN,
    ],
    limits: { inventoryLimit: Infinity, smsCredits: 500 },
  },
  {
    id: PLAN_IDS.GROWTH,
    track: SUBSCRIPTION_TRACKS.TRADER,
    name: 'Growth',
    priceLabel: 'KES 6,500 / month',
    targetUser: 'Large Manufacturers · Wholesalers · Property Owners',
    differentiator: 'Control Tier',
    description: 'Staff, bills, burn, asset tracking, and full audit control.',
    featureKeys: [
      F.INVENTORY_LEDGER,
      F.QR_AUTO_SYNC,
      F.CRM_CAPTURE,
      F.ACTIVE_SMS_CAMPAIGNS,
      F.SMS_CREDITS_2000,
      F.NET_PROFIT_GAUGE,
      F.REGIONAL_GUARDIAN,
      F.STAFF_RBAC,
      F.BILL_GUARDIAN,
      F.DAILY_BURN_TRACKER,
      F.ASSET_TRACKING,
      F.AUDIT_PDF,
    ],
    limits: { inventoryLimit: Infinity, smsCredits: 2000 },
  },
];

export const MIZIGO_PLANS = [
  {
    id: PLAN_IDS.MIZIGO,
    track: SUBSCRIPTION_TRACKS.MIZIGO,
    name: 'Mizigo',
    priceLabel: '5% - 10% commission per verified delivery',
    targetUser: 'Truck Drivers · Fleet Owners',
    differentiator: 'Logistics Bridge',
    description: 'No monthly fee. Commission only on verified delivery scans.',
    featureKeys: [
      F.MIZIGO_QR_HANDSHAKE,
      F.MIZIGO_GROUP_MATCHER,
      F.MIZIGO_EXPRESS_ALERT,
      F.TAKE_HOME_GAUGE,
      F.SINKING_FUND,
      F.VERIFIED_TRIP_PDF,
    ],
    limits: { inventoryLimit: 0, smsCredits: 0 },
  },
];

export const ALL_PLANS = [...TRADER_PLANS, ...MIZIGO_PLANS];

const TIER_ORDER = {
  [PLAN_IDS.SOLO]: 1,
  [PLAN_IDS.SMART]: 2,
  [PLAN_IDS.GROWTH]: 3,
};

export const FEATURE_LABELS = {
  [F.INVENTORY_LEDGER]: 'Inventory ledger with 30 SKU cap (Solo)',
  [F.QR_AUTO_SYNC]: 'Auto QR sync for sales and stock movement',
  [F.CRM_CAPTURE]: 'Passive CRM capture',
  [F.ACTIVE_SMS_CAMPAIGNS]: 'Active CRM and outbound SMS campaigns',
  [F.SMS_CREDITS_500]: '500 SMS credits per cycle',
  [F.SMS_CREDITS_2000]: '2,000 SMS credits per cycle',
  [F.NET_PROFIT_GAUGE]: 'Net Profit Gauge',
  [F.REGIONAL_GUARDIAN]: 'Regional Guardian scarcity alerts',
  [F.STAFF_RBAC]: 'Staff sub-accounts (OWNER/CLERK RBAC)',
  [F.BILL_GUARDIAN]: 'Bill Guardian alerts',
  [F.DAILY_BURN_TRACKER]: 'Daily operational burn tracker',
  [F.ASSET_TRACKING]: 'Asset and net worth tracking',
  [F.AUDIT_PDF]: 'Full audit PDF reporting',
  [F.MIZIGO_QR_HANDSHAKE]: '3-way QR logistics handshake',
  [F.MIZIGO_GROUP_MATCHER]: 'Group trip matcher',
  [F.MIZIGO_EXPRESS_ALERT]: 'Radial express alert (10km)',
  [F.TAKE_HOME_GAUGE]: 'Driver take-home gauge',
  [F.SINKING_FUND]: '10% sinking fund auto-lock',
  [F.VERIFIED_TRIP_PDF]: 'Verified trip PDF',
};

export const FEATURE_TOOLTIPS = {
  [F.INVENTORY_LEDGER]: 'Plan 1 Solo allows up to 30 SKUs. Upgrade to Smart for unlimited SKUs.',
  [F.ACTIVE_SMS_CAMPAIGNS]: 'Upgrade to Smart to send SMS campaigns and restock alerts.',
  [F.SMS_CREDITS_500]: 'Smart includes 500 SMS credits each cycle.',
  [F.SMS_CREDITS_2000]: 'Growth includes 2,000 SMS credits each cycle.',
  [F.REGIONAL_GUARDIAN]: 'Regional scarcity alarms start at Smart.',
  [F.STAFF_RBAC]: 'OWNER/CLERK access control is available on Growth.',
  [F.BILL_GUARDIAN]: 'Growth includes 10-day bill alerts.',
  [F.ASSET_TRACKING]: 'Asset and net worth tracking is unlocked on Growth.',
  [F.MIZIGO_QR_HANDSHAKE]: 'Mizigo plan required for logistics QR handshake and commission payouts.',
  [F.TAKE_HOME_GAUGE]: 'Mizigo tracks net take-home for each trip in real time.',
};

export const normalizePlanId = (planId) => {
  const normalized = String(planId || '').toLowerCase().trim();
  if (!normalized) return PLAN_IDS.SOLO;
  return LEGACY_PLAN_ALIASES[normalized] || normalized;
};

export const getPlanById = (planId) => {
  const normalized = normalizePlanId(planId);
  return ALL_PLANS.find((plan) => plan.id === normalized) || null;
};

export const getPlanTierLevel = (planId) => {
  const normalized = normalizePlanId(planId);
  return TIER_ORDER[normalized] || 0;
};

export const isTraderPlan = (planId) => {
  const normalized = normalizePlanId(planId);
  return normalized === PLAN_IDS.SOLO || normalized === PLAN_IDS.SMART || normalized === PLAN_IDS.GROWTH;
};

export const getUpgradePlanForFeature = (featureKey) => {
  const featureToPlan = {
    [F.ACTIVE_SMS_CAMPAIGNS]: PLAN_IDS.SMART,
    [F.SMS_CREDITS_500]: PLAN_IDS.SMART,
    [F.REGIONAL_GUARDIAN]: PLAN_IDS.SMART,
    [F.STAFF_RBAC]: PLAN_IDS.GROWTH,
    [F.BILL_GUARDIAN]: PLAN_IDS.GROWTH,
    [F.ASSET_TRACKING]: PLAN_IDS.GROWTH,
    [F.AUDIT_PDF]: PLAN_IDS.GROWTH,
    [F.MIZIGO_QR_HANDSHAKE]: PLAN_IDS.MIZIGO,
    [F.MIZIGO_GROUP_MATCHER]: PLAN_IDS.MIZIGO,
    [F.MIZIGO_EXPRESS_ALERT]: PLAN_IDS.MIZIGO,
    [F.TAKE_HOME_GAUGE]: PLAN_IDS.MIZIGO,
  };

  const planId = featureToPlan[featureKey];
  return planId ? getPlanById(planId) : null;
};

