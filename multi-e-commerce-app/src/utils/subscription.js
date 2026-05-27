import {
  MIZIGO_PLANS,
  PLAN_IDS,
  SUBSCRIPTION_TRACKS,
  TRADER_PLANS,
  getPlanById as getPlanByIdFromConfig,
  normalizePlanId,
} from '../config/subscriptionPlans';

export const getPlanById = (planId) => getPlanByIdFromConfig(planId);

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
  const rawPlanId = user?.subscription?.planId || user?.planId || user?.subscriptionTier;
  if (rawPlanId) return normalizePlanId(rawPlanId);

  const track = getDefaultTrackForUser(user);
  return track === SUBSCRIPTION_TRACKS.MIZIGO ? PLAN_IDS.MIZIGO : PLAN_IDS.SOLO;
};

export const resolveActivePlan = (user) => {
  const defaultPlanId = getDefaultPlanIdForUser(user);
  return getPlanById(defaultPlanId) || TRADER_PLANS[0];
};

export const hasFeatureAccess = (plan, featureKey) => {
  if (!plan || !featureKey) return false;
  return plan.featureKeys.includes(featureKey);
};
