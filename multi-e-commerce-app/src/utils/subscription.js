import {
  MIZIGO_PLANS,
  SUBSCRIPTION_TRACKS,
  TRADER_PLANS,
  getPlanById as getPlanByIdFromConfig,
  normalizePlanId,
} from '../config/subscriptionPlans';
import { getEffectiveUserCategory, isSellerUser } from './userCategory';

const canUseSubscriptionPlans = (user) => {
  const category = getEffectiveUserCategory(user);
  return isSellerUser(user) || category === 'logistics';
};

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
  if (!canUseSubscriptionPlans(user)) return null;

  const rawPlanId = user?.subscription?.planId || user?.planId || user?.subscriptionTier;
  if (rawPlanId) return normalizePlanId(rawPlanId);

  return null;
};

export const resolveActivePlan = (user) => {
  if (!canUseSubscriptionPlans(user)) return null;

  const subscription = user?.subscription;
  const isExplicitlyActive =
    subscription?.active === true ||
    subscription?.status === 'active' ||
    user?.subscriptionStatus === 'active';
  const expiresAt = subscription?.expiresAt || user?.subscriptionExpiry || null;
  const notExpired = !expiresAt || new Date(expiresAt) > new Date();

  if (!isExplicitlyActive || !notExpired) return null;

  return getPlanById(getDefaultPlanIdForUser(user));
};

export const hasFeatureAccess = (plan, featureKey) => {
  if (!plan || !featureKey) return false;
  return plan.featureKeys.includes(featureKey);
};
