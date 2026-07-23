// controllers/subscription.controller.js
const subscriptionService = require('../services/subscription/plan.service');
const billingService = require('../services/subscription/billing.service');
const { validationResult } = require('express-validator');
const User = require('../models/User.model');
const Product = require('../models/Product.model');
const { isSellerUser } = require('../utils/userCategory');

const sendValidationErrors = (req, res) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) return false;

  res.status(400).json({
    success: false,
    message: 'Validation failed',
    errors: errors.array()
  });
  return true;
};

const getSmsCreditBalance = (subscription) => {
  const allocated = Number(subscription.features?.smsCreditsAllocated || 0);
  const used = Number(subscription.features?.smsCreditsUsed || 0);
  return Math.max(0, allocated - used);
};

const isSellerAccount = (user) => isSellerUser(user);

const buildProviderSnapshot = (provider) => {
  if (!provider) return null;
  const profile = provider.logisticsProfile || {};
  return {
    id: provider._id,
    name: provider.fullName || provider.name || provider.businessName || 'Registered logistics provider',
    phone: provider.phone || '',
    email: provider.email || '',
    hub: profile.baseHub || profile.locationHub || provider.locationHub || provider.city || '',
    vehiclePlate: profile.vehiclePlate || provider.vehiclePlate || '',
    cargoCapacityKg: profile.cargoCapacityKg || provider.cargoCapacityKg || null,
    verificationStatus: profile.verificationStatus || provider.verificationStatus || 'unverified',
  };
};

const defaultSellerLogisticsAddon = (user) => ({
  active: false,
  planId: 'mizigo',
  selectedProviderId: '',
  selectedProvider: null,
  sellerHub: user?.locationHub || user?.city || user?.address || '',
  activatedAt: null,
  pausedAt: null,
  updatedAt: null,
});

const normalizeSellerLogisticsAddon = (user) => {
  const addon = user?.sellerLogisticsAddon || {};
  const selectedProvider = addon.selectedProvider && typeof addon.selectedProvider === 'object'
    ? buildProviderSnapshot(addon.selectedProvider)
    : addon.selectedProviderSnapshot || null;

  return {
    ...defaultSellerLogisticsAddon(user),
    active: Boolean(addon.active),
    planId: addon.planId || 'mizigo',
    selectedProviderId: addon.selectedProvider?._id || addon.selectedProvider || '',
    selectedProvider,
    sellerHub: addon.sellerHub || user?.locationHub || user?.city || user?.address || '',
    activatedAt: addon.activatedAt || null,
    pausedAt: addon.pausedAt || null,
    updatedAt: addon.updatedAt || null,
  };
};

const findVerifiedLogisticsProvider = async (providerId) => {
  if (!providerId) return null;

  const provider = await User.findOne({
    _id: providerId,
    role: 'logistics',
    $or: [
      { 'logisticsProfile.verificationStatus': 'verified' },
      { verificationStatus: { $in: ['verified', 'gold'] } },
    ],
  }).select('fullName name businessName phone email city locationHub logisticsProfile verificationStatus subscriptionTier');

  return provider;
};

const toFiniteLimit = (value) => {
  if (value === Infinity || value === null || value === undefined) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const daysUntil = (dateValue) => {
  if (!dateValue) return null;
  const timestamp = new Date(dateValue).getTime();
  if (Number.isNaN(timestamp)) return null;
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.ceil((timestamp - Date.now()) / msPerDay);
};

const buildBillingSnapshot = (subscription, entitlements) => {
  const daysRemaining = daysUntil(subscription?.endDate);
  let renewalState = 'inactive';

  if (entitlements.active) {
    renewalState = daysRemaining !== null && daysRemaining <= 3 ? 'due_soon' : 'active';
  } else if (subscription?.status && subscription.status !== 'inactive') {
    renewalState = 'expired';
  }

  return {
    status: subscription?.status || 'inactive',
    billingModel: subscription?.billingModel || entitlements.billingModel || null,
    price: subscription?.price || 0,
    currency: subscription?.currency || 'KES',
    autoRenew: Boolean(subscription?.autoRenew),
    startDate: subscription?.startDate || null,
    endDate: subscription?.endDate || null,
    nextBillingDate: subscription?.nextBillingDate || null,
    daysRemaining,
    renewalState,
    needsPayment: !entitlements.active || renewalState === 'expired' || renewalState === 'due_soon',
  };
};

const buildProductUsage = async (userId, entitlements) => {
  const totalProducts = await Product.countDocuments({ seller: userId });
  const productLimit = toFiniteLimit(entitlements.maxProducts);
  const isUnlimited = productLimit === null && entitlements.maxProducts !== 0;
  const remainingSlots = isUnlimited ? null : Math.max(0, productLimit - totalProducts);

  return {
    totalProducts,
    visibleProducts: isUnlimited ? totalProducts : Math.min(totalProducts, productLimit),
    productLimit,
    isUnlimited,
    remainingSlots,
    upgradeRequired: !isUnlimited && totalProducts >= productLimit,
  };
};

const buildPrimaryAction = (entitlements, productUsage, upgradeOptions = []) => {
  if (!entitlements.active) {
    return {
      type: 'activate',
      label: 'Activate Subscription',
      planId: 'solo',
      path: '/seller/subscription-plans?plan=solo',
      message: 'Activate Solo, Smart, or Growth to unlock more seller tools.',
    };
  }

  if (productUsage.upgradeRequired && entitlements.nextPlan?.id) {
    return {
      type: 'upgrade',
      label: `Upgrade to ${entitlements.nextPlan.name}`,
      planId: entitlements.nextPlan.id,
      path: `/seller/subscription-plans?plan=${entitlements.nextPlan.id}`,
      message: `Your catalog has reached the ${entitlements.planName} product limit.`,
    };
  }

  const nextOption = upgradeOptions[0];
  if (nextOption?.id) {
    return {
      type: 'upgrade',
      label: `Upgrade to ${nextOption.name}`,
      planId: nextOption.id,
      path: `/seller/subscription-plans?plan=${nextOption.id}`,
      message: 'Upgrade when you need more automation, SMS, or controls.',
    };
  }

  return {
    type: 'manage',
    label: 'Manage Subscription',
    planId: entitlements.planId,
    path: '/seller/subscription-plans',
    message: 'Your current subscription is active.',
  };
};

/**
 * Get available subscription plans
 * GET /api/v1/subscriptions/plans
 */
exports.getPlans = async (req, res, next) => {
  try {
    const plans = await subscriptionService.getPlans();
    res.status(200).json({
      success: true,
      data: plans,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Subscribe to a plan
 * POST /api/v1/subscriptions/subscribe
 */
exports.subscribe = async (req, res, next) => {
  try {
    if (sendValidationErrors(req, res)) return;

    const { planId, paymentMethod, paymentCompleted, paymentReference, agentNationalId } = req.body;
    
    // Special handling for Mizigo (commission-based)
    if (planId === 'mizigo') {
      const subscription = await billingService.subscribeToCommissionPlan(
        req.user.id, 
        planId, 
        {
          paymentCompleted,
          paymentReference,
          agentNationalId,
          userRole: req.user.role // 'DRIVER' or 'FLEET_OWNER'
        }
      );
      return res.status(200).json({
        success: true,
        message: 'Mizigo plan activated successfully. You earn 90% per delivery (10% goes to Sinking Fund)',
        data: subscription,
      });
    }

    // Regular paid plans (Solo, Smart, Growth)
    const subscription = await billingService.subscribe(req.user.id, planId, paymentMethod, {
      paymentCompleted,
      paymentReference,
      agentNationalId,
    });
    
    res.status(200).json({
      success: true,
      message: `Subscribed to ${subscription.planName} plan successfully. ${
        getSmsCreditBalance(subscription) ? `You have ${getSmsCreditBalance(subscription)} SMS credits.` : ''
      }`,
      data: subscription,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get current user's effective entitlements with feature gating
 * GET /api/v1/subscriptions/entitlements
 */
exports.getMyEntitlements = async (req, res, next) => {
  try {
    const entitlements = await subscriptionService.getEntitlements(req.user.id);
    
    // Add locked features information for upgrade prompts
    const lockedFeatures = await subscriptionService.getLockedFeatures(req.user.id, entitlements.planId);
    
    res.status(200).json({
      success: true,
      data: {
        ...entitlements,
        lockedFeatures, // Shows what's greyed out with upgrade prompts
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get current user's subscription with SMS credit balance
 * GET /api/v1/subscriptions/me
 */
exports.getMySubscription = async (req, res, next) => {
  try {
    const subscription = await subscriptionService.getUserSubscription(req.user.id);
    const entitlements = await subscriptionService.getEntitlements(req.user.id);
    subscription.features = {
      ...(subscription.features?.toObject ? subscription.features.toObject() : subscription.features || {}),
      maxProducts: entitlements.maxProducts,
    };
    
    // Add SMS credit info for Solo, Smart, and Growth
    if (['solo', 'smart', 'growth'].includes(subscription.plan)) {
      const smsBalance = await subscriptionService.getSmsCreditBalance(req.user.id);
      subscription.smsCreditsRemaining = smsBalance;
    }
    
    // Add Sinking Fund info for Mizigo
    if (subscription.plan === 'mizigo') {
      const sinkingFund = await subscriptionService.getSinkingFundBalance(req.user.id);
      subscription.sinkingFundBalance = sinkingFund;
    }
    
    res.status(200).json({
      success: true,
      data: subscription,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get a complete subscription account overview for dashboards and plan screens
 * GET /api/v1/subscriptions/overview
 */
exports.getOverview = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const [plans, subscription, entitlements] = await Promise.all([
      subscriptionService.getPlans(),
      subscriptionService.getUserSubscription(userId),
      subscriptionService.getEntitlements(userId),
    ]);

    const lockPromptPlanId = entitlements.planId || 'solo';
    const [lockedFeatures, upgradePayload, productUsage] = await Promise.all([
      subscriptionService.getLockedFeatures(userId, lockPromptPlanId),
      subscriptionService.getUpgradePaths(entitlements.planId),
      buildProductUsage(userId, entitlements),
    ]);

    let sellerLogisticsAddon = null;
    if (isSellerAccount(req.user)) {
      const user = await User.findById(userId)
        .populate('sellerLogisticsAddon.selectedProvider', 'fullName name businessName phone email city locationHub logisticsProfile verificationStatus subscriptionTier');
      sellerLogisticsAddon = normalizeSellerLogisticsAddon(user);
    }

    const smsCredits = {
      ...entitlements.smsCredits,
      unit: 'credits',
      rate: '1 credit = 1 SMS',
    };
    const upgradeOptions = Array.isArray(upgradePayload) ? upgradePayload : [];

    res.status(200).json({
      success: true,
      data: {
        subscription,
        entitlements: {
          ...entitlements,
          maxProducts: productUsage.isUnlimited ? null : productUsage.productLimit,
          lockedFeatures,
        },
        usage: {
          products: productUsage,
          smsCredits,
        },
        billing: buildBillingSnapshot(subscription, entitlements),
        upgradeOptions,
        plans,
        sellerLogisticsAddon,
        primaryAction: buildPrimaryAction(entitlements, productUsage, upgradeOptions),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get seller logistics add-on settings
 * GET /api/v1/subscriptions/seller-logistics-addon
 */
exports.getSellerLogisticsAddon = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id)
      .populate('sellerLogisticsAddon.selectedProvider', 'fullName name businessName phone email city locationHub logisticsProfile verificationStatus subscriptionTier');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (!isSellerAccount(user)) {
      return res.status(403).json({
        success: false,
        message: 'Only seller accounts can configure the seller logistics add-on.',
      });
    }

    return res.status(200).json({
      success: true,
      data: normalizeSellerLogisticsAddon(user),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update seller logistics add-on settings
 * PUT /api/v1/subscriptions/seller-logistics-addon
 */
exports.updateSellerLogisticsAddon = async (req, res, next) => {
  try {
    if (sendValidationErrors(req, res)) return;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (!isSellerAccount(user)) {
      return res.status(403).json({
        success: false,
        message: 'Only seller accounts can configure the seller logistics add-on.',
      });
    }

    const nextActive = req.body.active !== undefined ? Boolean(req.body.active) : Boolean(user.sellerLogisticsAddon?.active);
    const sellerHub = req.body.sellerHub !== undefined
      ? String(req.body.sellerHub || '').trim()
      : user.sellerLogisticsAddon?.sellerHub || user.locationHub || user.city || user.address || '';
    const hasProviderUpdate = Object.prototype.hasOwnProperty.call(req.body, 'selectedProviderId');

    let selectedProvider = user.sellerLogisticsAddon?.selectedProvider || null;
    let selectedProviderSnapshot = user.sellerLogisticsAddon?.selectedProviderSnapshot || null;

    if (hasProviderUpdate) {
      if (!req.body.selectedProviderId) {
        selectedProvider = null;
        selectedProviderSnapshot = null;
      } else {
        const provider = await findVerifiedLogisticsProvider(req.body.selectedProviderId);
        if (!provider) {
          return res.status(404).json({
            success: false,
            message: 'Verified logistics provider not found.',
          });
        }
        selectedProvider = provider._id;
        selectedProviderSnapshot = buildProviderSnapshot(provider);
      }
    }

    user.sellerLogisticsAddon = {
      ...(user.sellerLogisticsAddon?.toObject ? user.sellerLogisticsAddon.toObject() : user.sellerLogisticsAddon || {}),
      active: nextActive,
      planId: 'mizigo',
      sellerHub,
      selectedProvider,
      selectedProviderSnapshot,
      activatedAt: nextActive && !user.sellerLogisticsAddon?.activatedAt ? new Date() : user.sellerLogisticsAddon?.activatedAt,
      pausedAt: nextActive ? null : new Date(),
      updatedAt: new Date(),
    };

    await user.save();
    await user.populate('sellerLogisticsAddon.selectedProvider', 'fullName name businessName phone email city locationHub logisticsProfile verificationStatus subscriptionTier');

    return res.status(200).json({
      success: true,
      message: nextActive ? 'Seller logistics add-on saved.' : 'Seller logistics add-on paused.',
      data: normalizeSellerLogisticsAddon(user),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Cancel subscription
 * DELETE /api/v1/subscriptions/me
 */
exports.cancelSubscription = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const result = await billingService.cancelSubscription(req.user.id, reason);
    res.status(200).json({
      success: true,
      message: result?.message || 'Subscription cancelled successfully.',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Change subscription plan (upgrade/downgrade)
 * PUT /api/v1/subscriptions/change-plan
 */
exports.changePlan = async (req, res, next) => {
  try {
    if (sendValidationErrors(req, res)) return;

    const { newPlanId, paymentCompleted, paymentReference } = req.body;
    
    // Get current plan to determine if this is upgrade or downgrade
    const currentSubscription = await subscriptionService.getUserSubscription(req.user.id);
    
    const subscription = await billingService.changePlan(req.user.id, newPlanId, {
      paymentCompleted,
      paymentReference,
      isUpgrade: subscriptionService.isUpgrade(currentSubscription.plan, newPlanId)
    });
    
    let message = `Plan changed to ${subscription.planName}`;
    if (subscription.features?.smsCreditsAllocated) {
      message += `. You now have ${subscription.features.smsCreditsAllocated} SMS credits available.`;
    }
    
    res.status(200).json({
      success: true,
      message,
      data: subscription,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Top up SMS credits (for Solo, Smart, and Growth users)
 * POST /api/v1/subscriptions/topup-sms
 */
exports.topupSmsCredits = async (req, res, next) => {
  try {
    if (sendValidationErrors(req, res)) return;

    const { amount, paymentReference } = req.body;
    const result = await billingService.topupSmsCredits(req.user.id, amount, paymentReference);
    res.status(200).json({
      success: true,
      message: `Successfully added ${result.creditsAdded} SMS credits`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get SMS credit balance
 * GET /api/v1/subscriptions/sms-balance
 */
exports.getSmsBalance = async (req, res, next) => {
  try {
    const balance = await subscriptionService.getSmsCreditBalance(req.user.id);
    res.status(200).json({
      success: true,
      data: {
        balance,
        remaining: balance,
        unit: 'credits',
        rate: '1 credit = 1 SMS'
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get sinking fund balance (for Mizigo drivers)
 * GET /api/v1/subscriptions/sinking-fund
 */
exports.getSinkingFund = async (req, res, next) => {
  try {
    const subscription = await subscriptionService.getUserSubscription(req.user.id);

    if (subscription.plan !== 'mizigo') {
      return res.status(200).json({
        success: true,
        data: {
          available: false,
          plan: subscription.plan,
          requiredPlan: 'mizigo',
          balance: 0,
          nextMaintenanceKm: null,
          currentKm: 0,
          kmUntilMaintenance: null,
          canCoverMaintenance: false,
          upgradePrompt: 'Switch to Mizigo to unlock sinking fund maintenance tracking.',
        },
      });
    }

    const sinkingFund = await subscriptionService.getSinkingFundBalance(req.user.id);
    const mileage = await subscriptionService.getVehicleMileage(req.user.id);
    
    res.status(200).json({
      success: true,
      data: {
        available: true,
        plan: subscription.plan,
        balance: sinkingFund,
        nextMaintenanceKm: 5000,
        currentKm: mileage,
        kmUntilMaintenance: Math.max(0, 5000 - (mileage % 5000)),
        canCoverMaintenance: sinkingFund >= 2500, // Estimated oil change cost
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Check if user has access to a specific feature (for frontend gating)
 * GET /api/v1/subscriptions/check-feature/:feature
 */
exports.checkFeatureAccess = async (req, res, next) => {
  try {
    const { feature } = req.params;
    const hasAccess = await subscriptionService.checkFeatureAccess(req.user.id, feature);
    
    const nextPlan = await subscriptionService.getUpgradePlanForFeature(feature);
    
    res.status(200).json({
      success: true,
      data: {
        hasAccess,
        feature,
        nextPlan: nextPlan ? nextPlan.name : null,
        upgradePrompt: nextPlan ? `Upgrade to ${nextPlan.name} to unlock ${feature}` : null,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Webhook for subscription billing (M-Pesa auto-renewal)
 * POST /api/v1/subscriptions/webhook
 */
exports.billingWebhook = async (req, res, next) => {
  try {
    const { event, data } = req.body;
    
    // Handle different webhook events
    switch(event) {
      case 'payment.success':
        await billingService.handleSuccessfulPayment(data);
        break;
      case 'payment.failed':
        await billingService.handleFailedPayment(data);
        break;
      case 'subscription.renewal':
        await billingService.handleAutoRenewal(data);
        break;
      case 'sms.topup':
        await billingService.handleSmsTopup(data);
        break;
      default:
        await billingService.handleWebhook(req.body);
    }
    
    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
};

/**
 * Get upgrade options with pricing
 * GET /api/v1/subscriptions/upgrade-options
 */
exports.getUpgradeOptions = async (req, res, next) => {
  try {
    const currentPlan = await subscriptionService.getUserSubscription(req.user.id);
    const upgradeOptions = await subscriptionService.getUpgradePaths(currentPlan.plan);
    
    res.status(200).json({
      success: true,
      data: {
        currentPlan: currentPlan.planName,
        upgradeOptions,
        pricing: {
          solo: 500,
          smart: 2500,
          growth: 6500,
          mizigo: '5-10% commission'
        }
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get performance report (CSV-ready report endpoint)
 * GET /api/v1/subscriptions/report/:type
 */
exports.getReport = async (req, res, next) => {
  try {
    const { type } = req.params; // 'vitals', 'performance', 'audit', 'verified-trip'
    const { period } = req.query; // 'month', 'quarter', 'year'
    
    const report = await subscriptionService.generateReport(req.user.id, type, period);
    
    res.status(200).json({
      success: true,
      data: report,
      message: `${type.charAt(0).toUpperCase() + type.slice(1)} report generated successfully`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Record daily operational expenses (for Plan 3 Growth)
 * POST /api/v1/subscriptions/daily-burn
 */
exports.recordDailyBurn = async (req, res, next) => {
  try {
    if (sendValidationErrors(req, res)) return;

    const { expenseType, amount, description } = req.body;
    const validTypes = ['Lunch/Tea', 'Airtime', 'Fuel', 'Boda Fares'];
    
    if (!validTypes.includes(expenseType)) {
      return res.status(400).json({ error: 'Invalid expense type' });
    }
    
    const expense = await billingService.recordDailyBurn(req.user.id, {
      type: expenseType,
      amount,
      description,
      date: new Date()
    });
    
    // Update CFO health gauge
    const updatedMetrics = await subscriptionService.updateFinancialMetrics(req.user.id);
    
    res.status(200).json({
      success: true,
      message: `${expenseType} expense recorded: KES ${amount}`,
      data: {
        expense,
        updatedMetrics
      },
    });
  } catch (error) {
    next(error);
  }
};
