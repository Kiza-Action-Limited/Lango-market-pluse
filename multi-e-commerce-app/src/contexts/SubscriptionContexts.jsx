import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ALL_PLANS } from '../config/subscriptionPlans';

const SubscriptionContext = createContext();

const resolveSubscriptionFromUser = (user) => {
  if (!user) return { active: false, planId: null, expiresAt: null };

  const planId =
    user?.subscription?.planId ||
    user?.planId ||
    user?.subscriptionTier ||
    null;
  const expiresAt = user?.subscription?.expiresAt || user?.subscriptionExpiry || null;
  const hasKnownPlan = Boolean(planId && ALL_PLANS.some((plan) => plan.id === planId));
  const isLegacyPaidTier = planId === 'v3' || planId === 'v4';
  const isExplicitlyActive = user?.subscription?.active === true;
  const hasPaidTier = hasKnownPlan || isLegacyPaidTier || isExplicitlyActive;
  const notExpired = !expiresAt || new Date(expiresAt) > new Date();

  return {
    active: Boolean(hasPaidTier && notExpired),
    planId,
    expiresAt,
  };
};

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};

export const SubscriptionProvider = ({ children }) => {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState(resolveSubscriptionFromUser(user));
  const [loading] = useState(false);

  useEffect(() => {
    setSubscription(resolveSubscriptionFromUser(user));
  }, [user]);

  const activateSubscription = async () => {
    const resolved = resolveSubscriptionFromUser(user);
    setSubscription(resolved);
    return resolved;
  };

  const refresh = () => {
    setSubscription(resolveSubscriptionFromUser(user));
  };

  return (
    <SubscriptionContext.Provider value={{ subscription, loading, activateSubscription, refresh }}>
      {children}
    </SubscriptionContext.Provider>
  );
};
