// services/subscription/plan.service.js
const Subscription = require('../../models/Subscription.model');
const {
  PLANS,
  PLAN_IDS,
  normalizePlanId,
  meetsTier,
} = require('../../config/subscriptionPlans');

const REPORT_TYPES = Object.freeze({
  VITALS: 'vitals',
  PERFORMANCE: 'performance',
  AUDIT: 'audit',
  VERIFIED_TRIP: 'verified-trip',
});

const REPORT_ALIASES = Object.freeze({
  vitals: REPORT_TYPES.VITALS,
  'vitals-pdf': REPORT_TYPES.VITALS,
  vitalspdf: REPORT_TYPES.VITALS,
  performance: REPORT_TYPES.PERFORMANCE,
  'performance-pdf': REPORT_TYPES.PERFORMANCE,
  performancepdf: REPORT_TYPES.PERFORMANCE,
  audit: REPORT_TYPES.AUDIT,
  'audit-pdf': REPORT_TYPES.AUDIT,
  auditpdf: REPORT_TYPES.AUDIT,
  'verified-trip': REPORT_TYPES.VERIFIED_TRIP,
  'verified-trip-pdf': REPORT_TYPES.VERIFIED_TRIP,
  verifiedtrip: REPORT_TYPES.VERIFIED_TRIP,
  verifiedtrippdf: REPORT_TYPES.VERIFIED_TRIP,
});

const REPORT_REQUIRED_PLAN = Object.freeze({
  [REPORT_TYPES.VITALS]: PLAN_IDS.SOLO,
  [REPORT_TYPES.PERFORMANCE]: PLAN_IDS.SMART,
  [REPORT_TYPES.AUDIT]: PLAN_IDS.GROWTH,
});

const normalizeReportType = (reportType) => {
  const normalized = String(reportType || '')
    .trim()
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/_/g, '-')
    .toLowerCase();

  return REPORT_ALIASES[normalized] || normalized;
};

const httpError = (message, statusCode, details = {}) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  Object.assign(error, details);
  return error;
};

const PLAN_FEATURES = {
  solo: {
    maxProducts: 30,
    hasSMS: false,
    hasRegionalGuardian: false,
    hasBillGuardian: false,
    hasAssetTracking: false,
    hasStaffRoles: false,
    hasDailyBurn: false,
    hasNetProfitGauge: false,
    reportType: 'vitals'
  },
  smart: {
    maxProducts: Infinity,
    hasSMS: true,
    hasRegionalGuardian: true,
    hasBillGuardian: false,
    hasAssetTracking: false,
    hasStaffRoles: false,
    hasDailyBurn: false,
    hasNetProfitGauge: true,
    reportType: 'performance'
  },
  growth: {
    maxProducts: Infinity,
    hasSMS: true,
    hasRegionalGuardian: true,
    hasBillGuardian: true,
    hasAssetTracking: true,
    hasStaffRoles: true,
    hasDailyBurn: true,
    hasNetProfitGauge: true,
    reportType: 'audit'
  },
  mizigo: {
    maxProducts: 0,
    hasSMS: false,
    hasRegionalGuardian: false,
    hasBillGuardian: false,
    hasAssetTracking: true,
    hasStaffRoles: false,
    hasDailyBurn: true,
    hasNetProfitGauge: false,
    reportType: 'verified-trip'
  }
};

const LOCKED_FEATURES = {
  solo: {
    'Send SMS': { plan: 'smart', price: 2500, prompt: 'Upgrade to Plan 2 to message your customers.' },
    'Restock Alert': { plan: 'smart', price: 2500, prompt: 'Upgrade to Plan 2 to get restock alerts.' },
    'Net Profit Gauge': { plan: 'smart', price: 2500, prompt: 'Upgrade to Plan 2 to see your net profit.' },
    'Regional Scarcity Alerts': { plan: 'smart', price: 2500, prompt: 'Upgrade to Plan 2 to monitor regional stock.' },
    'Staff Roles': { plan: 'growth', price: 6500, prompt: 'Upgrade to Plan 3 to manage staff access.' },
    'Bill Guardian': { plan: 'growth', price: 6500, prompt: 'Upgrade to Plan 3 to get bill reminders.' }
  },
  smart: {
    'Staff Roles': { plan: 'growth', price: 6500, prompt: 'Upgrade to Plan 3 to manage staff access.' },
    'Bill Guardian': { plan: 'growth', price: 6500, prompt: 'Upgrade to Plan 3 to get bill reminders.' },
    'Asset Tracking': { plan: 'growth', price: 6500, prompt: 'Upgrade to Plan 3 to track your assets.' },
    'Daily Burn Tracker': { plan: 'growth', price: 6500, prompt: 'Upgrade to Plan 3 to track daily expenses.' }
  },
  growth: {
    // All features unlocked
  },
  mizigo: {
    // Separate feature set for logistics
  }
};

const monthFromNow = () => {
  const endDate = new Date();
  endDate.setMonth(endDate.getMonth() + 1);
  return endDate;
};

const getSmsCreditBalanceFromSubscription = (subscription) => {
  if (!subscription) return 0;
  const allocated = Number(subscription.features?.smsCreditsAllocated || 0);
  const used = Number(subscription.features?.smsCreditsUsed || 0);
  return Math.max(0, allocated - used);
};

class PlanService {
  getPlans() {
    return Object.values(PLANS).map((plan) => ({
      id: plan.id,
      name: plan.name,
      price: plan.price,
      currency: plan.currency,
      billingModel: plan.billingModel,
      description: plan.description,
      features: PLAN_FEATURES[plan.id],
      lockedFeatures: LOCKED_FEATURES[plan.id] || {},
      smsCreditsIncluded: plan.id === 'smart' ? 500 : (plan.id === 'growth' ? 2000 : 0),
      targetAudience: this.getTargetAudience(plan.id)
    }));
  }

  getTargetAudience(planId) {
    const targets = {
      solo: 'Farmers, Small Manufacturers, Micro-Retailers',
      smart: 'Growing Retailers, Wholesalers, Distributors',
      growth: 'Large Manufacturers, Wholesalers, Property Owners',
      mizigo: 'Truck Drivers, Fleet Owners'
    };
    return targets[planId] || '';
  }

  getPlan(planId) {
    const normalizedId = normalizePlanId(planId);
    return PLANS[normalizedId] || null;
  }

  normalizePlanId(planId) {
    return normalizePlanId(planId);
  }

  async getUserSubscription(userId) {
    let subscription = await Subscription.findOne({ user: userId });

    if (!subscription) {
      // Create default Solo plan subscription
      const plan = PLANS[PLAN_IDS.SOLO];
      subscription = await Subscription.create({
        user: userId,
        plan: plan.id,
        planName: plan.displayName || plan.name,
        billingModel: plan.billingModel,
        price: plan.price,
        currency: plan.currency,
        status: 'active',
        startDate: new Date(),
        endDate: monthFromNow(),
        features: PLAN_FEATURES.solo,
        smsCredits: {
          balance: 0,
          includedPerCycle: 0,
          usedThisCycle: 0,
          purchasedThisCycle: 0,
        },
        autoRenew: false
      });
    }

    return subscription;
  }

  async getEntitlements(userId) {
    const subscription = await this.getUserSubscription(userId);
    const planId = normalizePlanId(subscription.plan);
    const isActive = this.isSubscriptionActive(subscription);
    
    const features = PLAN_FEATURES[planId] || PLAN_FEATURES.solo;
    const lockedFeatures = isActive ? (LOCKED_FEATURES[planId] || {}) : LOCKED_FEATURES.solo;
    
    return {
      planId,
      planName: subscription.planName,
      active: isActive,
      billingModel: subscription.billingModel,
      maxProducts: isActive ? features.maxProducts : 0,
      smsCredits: {
        balance: getSmsCreditBalanceFromSubscription(subscription),
        includedPerCycle: subscription.features?.smsCreditsAllocated || 0,
        usedThisCycle: subscription.features?.smsCreditsUsed || 0,
      },
      features: isActive ? features : {},
      lockedFeatures,
      nextPlan: this.getNextPlan(planId),
      subscription: {
        id: subscription._id,
        status: subscription.status,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        autoRenew: subscription.autoRenew
      }
    };
  }

  async getLockedFeatures(userId, currentPlanId) {
    const locked = LOCKED_FEATURES[currentPlanId] || {};
    
    return Object.entries(locked).map(([feature, info]) => ({
      feature,
      requiredPlan: info.plan,
      price: info.price,
      prompt: info.prompt,
      upgradePath: this.getUpgradePath(currentPlanId, info.plan)
    }));
  }

  getUpgradePath(fromPlan, toPlan) {
    const planOrder = ['solo', 'smart', 'growth'];
    const fromIndex = planOrder.indexOf(fromPlan);
    const toIndex = planOrder.indexOf(toPlan);
    
    if (fromIndex === -1 || toIndex === -1) return null;
    if (toIndex <= fromIndex) return null;
    
    return planOrder.slice(fromIndex + 1, toIndex + 1);
  }

  getNextPlan(currentPlanId) {
    const upgradeMap = {
      solo: { id: 'smart', name: 'Smart', price: 2500, features: ['SMS credits', 'Net Profit Gauge', 'Regional Guardian'] },
      smart: { id: 'growth', name: 'Growth', price: 6500, features: ['Staff roles', 'Bill Guardian', 'Asset tracking'] },
      growth: null,
      mizigo: null
    };
    
    return upgradeMap[currentPlanId];
  }

  async getSmsCreditBalance(userId) {
    const subscription = await this.getUserSubscription(userId);
    return getSmsCreditBalanceFromSubscription(subscription);
  }

  async getSinkingFundBalance(userId) {
    const subscription = await Subscription.findOne({ user: userId });
    if (!subscription || subscription.plan !== 'mizigo') {
      return 0;
    }
    return subscription.features?.sinkingFundBalance || subscription.commission?.sinkingFundBalance || 0;
  }

  async getVehicleMileage(userId) {
    const subscription = await Subscription.findOne({ user: userId });
    if (!subscription || subscription.plan !== 'mizigo') {
      return 0;
    }
    return subscription.vehicleInfo?.mileage || subscription.metadata?.vehicleMileage || 0;
  }

  async checkFeatureAccess(userId, feature) {
    const entitlements = await this.getEntitlements(userId);
    if (!entitlements.active) return false;
    
    const featureMap = {
      'sendSms': entitlements.features.hasSMS,
      'restockAlert': entitlements.features.hasSMS,
      'netProfitGauge': entitlements.features.hasNetProfitGauge,
      'regionalGuardian': entitlements.features.hasRegionalGuardian,
      'billGuardian': entitlements.features.hasBillGuardian,
      'assetTracking': entitlements.features.hasAssetTracking,
      'staffRoles': entitlements.features.hasStaffRoles,
      'dailyBurn': entitlements.features.hasDailyBurn
    };
    
    return featureMap[feature] || false;
  }

  async getUpgradePlanForFeature(feature) {
    const featureToPlan = {
      'sendSms': { id: 'smart', name: 'Smart', price: 2500 },
      'restockAlert': { id: 'smart', name: 'Smart', price: 2500 },
      'netProfitGauge': { id: 'smart', name: 'Smart', price: 2500 },
      'regionalGuardian': { id: 'smart', name: 'Smart', price: 2500 },
      'staffRoles': { id: 'growth', name: 'Growth', price: 6500 },
      'billGuardian': { id: 'growth', name: 'Growth', price: 6500 },
      'assetTracking': { id: 'growth', name: 'Growth', price: 6500 },
      'dailyBurn': { id: 'growth', name: 'Growth', price: 6500 }
    };
    
    return featureToPlan[feature] || null;
  }

  async getUpgradePaths(currentPlanId) {
    const paths = [];
    const planOrder = ['solo', 'smart', 'growth'];
    const currentIndex = planOrder.indexOf(currentPlanId);
    
    if (currentIndex === -1) return paths;
    
    for (let i = currentIndex + 1; i < planOrder.length; i++) {
      const planId = planOrder[i];
      paths.push({
        id: planId,
        name: PLANS[planId.toUpperCase()]?.name || planId,
        price: PLANS[planId.toUpperCase()]?.price || 0,
        features: this.getNewFeatures(currentPlanId, planId)
      });
    }
    
    return paths;
  }

  getNewFeatures(fromPlan, toPlan) {
    const allFeatures = {
      solo: ['Basic Inventory', 'QR Sync', 'Vitals PDF'],
      smart: ['500 SMS/month', 'Net Profit Gauge', 'Regional Guardian', 'Restock Alerts'],
      growth: ['2000 SMS/month', 'Staff Roles', 'Bill Guardian', 'Asset Tracking', 'Daily Burn']
    };
    
    return allFeatures[toPlan] || [];
  }

  isUpgrade(fromPlan, toPlan) {
    const tierOrder = { solo: 1, smart: 2, growth: 3, mizigo: 4 };
    return (tierOrder[toPlan] || 0) > (tierOrder[fromPlan] || 0);
  }

  isSubscriptionActive(subscription) {
    if (subscription.plan === 'mizigo') {
      return subscription.status === 'active';
    }
    return subscription.status === 'active' && 
           (!subscription.endDate || subscription.endDate > new Date());
  }

  hasReportAccess(planId, reportType) {
    const normalizedPlanId = normalizePlanId(planId);
    const normalizedReportType = normalizeReportType(reportType);

    if (normalizedReportType === REPORT_TYPES.VERIFIED_TRIP) {
      return normalizedPlanId === PLAN_IDS.MIZIGO;
    }

    const requiredPlanId = REPORT_REQUIRED_PLAN[normalizedReportType];
    return Boolean(requiredPlanId && meetsTier(normalizedPlanId, requiredPlanId));
  }

  async generateReport(userId, reportType, period = 'month') {
    const subscription = await this.getUserSubscription(userId);
    const entitlements = await this.getEntitlements(userId);
    const normalizedPlanId = normalizePlanId(subscription.plan);
    const normalizedReportType = normalizeReportType(reportType);
    
    if (!Object.values(REPORT_TYPES).includes(normalizedReportType)) {
      throw httpError(`Unsupported report type: ${reportType}`, 400, {
        reportType,
        supportedReportTypes: Object.values(REPORT_TYPES),
      });
    }

    if (!entitlements.active) {
      throw httpError('An active subscription is required to generate reports', 403, {
        currentPlan: normalizedPlanId,
      });
    }

    if (!this.hasReportAccess(normalizedPlanId, normalizedReportType)) {
      const requiredPlan = REPORT_REQUIRED_PLAN[normalizedReportType] || PLAN_IDS.MIZIGO;
      throw httpError(`Report type ${normalizedReportType} not available on your plan`, 403, {
        reportType: normalizedReportType,
        currentPlan: normalizedPlanId,
        requiredPlan,
      });
    }
    
    // Generate report based on type
    const report = {
      type: normalizedReportType,
      period,
      generatedAt: new Date(),
      user: userId,
      plan: subscription.planName
    };
    
    switch(normalizedReportType) {
      case 'vitals':
        report.data = await this.generateVitalsReport(userId, period);
        break;
      case 'performance':
        report.data = await this.generatePerformanceReport(userId, period);
        break;
      case 'audit':
        report.data = await this.generateAuditReport(userId, period);
        break;
      case 'verified-trip':
        report.data = await this.generateTripReport(userId, period);
        break;
    }
    
    return report;
  }

  async generateVitalsReport(userId, period) {
    // Implementation for basic financial summary
    return {
      financialSummary: {},
      salesHistory: [],
      purchaseHistory: [],
      inventoryValuation: 0
    };
  }

  async generatePerformanceReport(userId, period) {
    // Implementation for ROI and retention metrics
    return {
      customerRetentionRate: 0,
      marketingROI: 0,
      expenseBreakdown: {},
      netProfit: 0
    };
  }

  async generateAuditReport(userId, period) {
    // Implementation for full audit with balance sheet
    return {
      balanceSheet: {},
      staffEfficiency: [],
      expensePieChart: {},
      netWorth: 0
    };
  }

  async generateTripReport(userId, period) {
    // Implementation for Mizigo trip report
    return {
      totalTrips: 0,
      totalEarnings: 0,
      sinkingFundBalance: 0,
      mileageSummary: {}
    };
  }

  async updateFinancialMetrics(userId) {
    // Update CFO health gauge after daily burn entries
    const subscription = await Subscription.findOne({ user: userId });
    if (!subscription) return null;
    
    const dailyBurn = subscription.metadata?.dailyBurn || { totalToday: 0, expenses: [] };
    
    return {
      dailyBurnTotal: dailyBurn.totalToday,
      expenseCount: dailyBurn.expenses.length,
      lastUpdated: dailyBurn.lastUpdated
    };
  }
}

module.exports = new PlanService();
