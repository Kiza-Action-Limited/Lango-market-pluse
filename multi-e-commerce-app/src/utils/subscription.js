import { ALL_PLANS, MIZIGO_PLANS, SUBSCRIPTION_TRACKS, TRADER_PLANS } from '../config/subscriptionPlans';

const PLAN_OVERRIDE_KEY = 'marketpulse_plan_override';

export const getPlanById = (planId) => ALL_PLANS.find((plan) => plan.id === planId) || null;

export const getPlansByTrack = (track) => {
  if (track === SUBSCRIPTION_TRACKS.MIZIGO) return MIZIGO_PLANS;
  return TRADER_PLANS;
};

export const getDefaultTrackForUser = (user) => {
  const businessType = String(user?.businessType || '').toLowerCase();
  const role = String(user?.role || '').toLowerCase();

  if (businessType.includes('logistics') || businessType.includes('transport') || role === 'logistics') {
    return SUBSCRIPTION_TRACKS.MIZIGO;
  }

  return SUBSCRIPTION_TRACKS.TRADER;
};

export const getDefaultPlanIdForUser = (user) => {
  if (user?.subscription?.planId) return user.subscription.planId;
  if (user?.planId) return user.planId;

  const track = getDefaultTrackForUser(user);
  return track === SUBSCRIPTION_TRACKS.MIZIGO ? 'mizigo_solo' : 'trader_solo';
};

const getOverrideStorageKey = (user) => {
  const identity = user?.id || user?._id || user?.email || 'anonymous';
  return `${PLAN_OVERRIDE_KEY}:${identity}`;
};

export const getStoredPlanOverride = (user) => {
  try {
    if (!user) return null;
    return localStorage.getItem(getOverrideStorageKey(user));
  } catch (error) {
    return null;
  }
};

export const setStoredPlanOverride = (user, planId) => {
  try {
    if (!user) return;
    localStorage.setItem(getOverrideStorageKey(user), planId);
  } catch (error) {
    // Ignore storage errors in unsupported environments
  }
};

export const clearStoredPlanOverride = (user) => {
  try {
    if (!user) return;
    localStorage.removeItem(getOverrideStorageKey(user));
  } catch (error) {
    // Ignore storage errors in unsupported environments
  }
};

export const resolveActivePlan = (user) => {
  const overridePlanId = getStoredPlanOverride(user);
  const defaultPlanId = getDefaultPlanIdForUser(user);
  const planId = overridePlanId || defaultPlanId;
  return getPlanById(planId) || getPlanById(defaultPlanId) || TRADER_PLANS[0];
};

export const hasFeatureAccess = (plan, featureKey) => {
  if (!plan || !featureKey) return false;
  return plan.featureKeys.includes(featureKey);
};
