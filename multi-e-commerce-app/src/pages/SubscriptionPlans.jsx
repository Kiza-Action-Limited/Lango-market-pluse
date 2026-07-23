import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  FaBoxOpen,
  FaCalendarAlt,
  FaCheckCircle,
  FaChevronDown,
  FaChevronUp,
  FaCrown,
  FaExclamationTriangle,
  FaIdCard,
  FaLock,
  FaMapMarkerAlt,
  FaRoute,
  FaSms,
  FaTimesCircle,
  FaTruck,
} from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { FEATURE_LABELS, FEATURE_TOOLTIPS, MIZIGO_PLANS, PLAN_IDS, TRADER_PLANS } from '../config/subscriptionPlans';
import { logisticsService } from '../services/logisticsService';
import { subscriptionService } from '../services/subscriptionService';
import {
  activateSellerLogisticsAddon,
  deactivateSellerLogisticsAddon,
  getSellerLogisticsAddon,
  rankProvidersByDistance,
  saveSellerLogisticsAddon,
} from '../utils/logisticsAddon';
import { hasPremiumVerification } from '../utils/premiumSellerProfile';
import { listPendingSubscriptionPayments } from '../utils/subscriptionPaymentRecovery';

const PlanCard = ({ plan, isActive, onActivate, featureLimit, isExpanded, onToggleExpand, isHighlighted, lockTooltip }) => (
  <div
    id={`plan-card-${plan.id}`}
    className={`rounded-xl border p-5 shadow-sm transition ${
      isActive ? 'border-[#F97316] bg-[#FFF7ED]' : 'border-gray-200 bg-white'
    } ${isHighlighted ? 'ring-2 ring-[#FB923C] ring-offset-2' : ''}`}
  >
    <div className="flex items-start justify-between gap-3">
      <div>
        <h3 className="text-xl font-semibold text-[#111827]">{plan.name}</h3>
        <p className="text-sm text-[#6B7280]">{plan.differentiator}</p>
      </div>
      {isActive ? (
        <FaCrown className="text-[#F97316] text-xl" />
      ) : (
        <span title={lockTooltip}>
          <FaLock className="text-[#9CA3AF] text-lg" />
        </span>
      )}
    </div>

    <div className="mt-4">
      <p className="text-2xl font-bold text-[#111827]">{plan.priceLabel}</p>
      <p className="text-sm text-[#6B7280] mt-1">{plan.description}</p>
    </div>

    <ul className="mt-4 space-y-2">
      {plan.featureKeys.slice(0, isExpanded ? plan.featureKeys.length : featureLimit).map((featureKey) => (
        <li key={featureKey} className="flex items-start gap-2 text-sm text-[#374151]">
          <FaCheckCircle className="text-[#16A34A] mt-0.5 shrink-0" />
          <span>{FEATURE_LABELS[featureKey] || featureKey}</span>
        </li>
      ))}
    </ul>

    {plan.featureKeys.length > featureLimit && (
      <button
        type="button"
        onClick={() => onToggleExpand(plan.id)}
        className="mt-3 inline-flex items-center gap-2 text-xs text-[#F97316] hover:text-[#EA580C] font-medium"
      >
        {isExpanded ? (
          <>
            View less <FaChevronUp size={11} />
          </>
        ) : (
          <>
            View more features <FaChevronDown size={11} />
          </>
        )}
      </button>
    )}

    <button
      type="button"
      onClick={onActivate}
      disabled={isActive}
      title={isActive ? 'Already active' : lockTooltip}
      className={`w-full mt-5 px-4 py-2 rounded-lg font-medium transition ${
        isActive
          ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
          : 'bg-[#F97316] text-white hover:bg-[#EA580C]'
      }`}
    >
      {isActive ? 'Active Plan' : 'Choose Plan'}
    </button>
  </div>
);

const formatDate = (value) => {
  if (!value) return 'Not scheduled';
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const formatProductLimit = (usage) => {
  if (!usage) return '0/5';
  if (usage.isUnlimited) return `${usage.totalProducts || 0}/Unlimited`;
  return `${usage.totalProducts || 0}/${usage.productLimit ?? 5}`;
};

const SubscriptionOverviewPanel = ({ overview, loading, pendingPayment, onAction }) => {
  const productUsage = overview?.usage?.products;
  const smsCredits = overview?.usage?.smsCredits;
  const billing = overview?.billing;
  const lockedCount = overview?.entitlements?.lockedFeatures?.length || 0;
  const productLimit = productUsage?.productLimit ?? 5;
  const productTotal = productUsage?.totalProducts || 0;
  const productLimitMessage = overview?.entitlements?.active
    ? `You've reached your ${overview?.subscription?.planName || 'current plan'} product limit. Upgrade your subscription to add more products.`
    : "You've reached your free 5 product limit. Upgrade your subscription to add more products.";
  const progress = productUsage?.isUnlimited
    ? 100
    : Math.min(100, Math.round((productTotal / Math.max(productLimit, 1)) * 100));
  const isWarning = Boolean(productUsage?.upgradeRequired || billing?.renewalState === 'due_soon' || billing?.renewalState === 'expired');

  if (loading) {
    return (
      <section className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="h-5 w-48 animate-pulse rounded bg-gray-200" />
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="h-24 animate-pulse rounded-lg bg-gray-100" />
          ))}
        </div>
      </section>
    );
  }

  if (!overview) return null;

  return (
    <section className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[#F97316]">Subscription account</p>
          <h2 className="mt-1 text-2xl font-bold text-[#111827]">
            {overview.subscription?.planName || 'Free seller allowance'}
          </h2>
          <p className="mt-1 text-sm text-[#6B7280]">
            {overview.primaryAction?.message || 'Your seller subscription, catalog limit, SMS, and billing status are synced from the backend.'}
          </p>
        </div>
        <div className={`rounded-full px-3 py-1 text-xs font-semibold ${overview.entitlements?.active ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-900'}`}>
          {overview.entitlements?.active ? 'Active' : 'Free allowance'}
        </div>
      </div>

      {isWarning && (
        <div className="mt-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          <FaExclamationTriangle className="mt-0.5 shrink-0" />
          <span>
            {productUsage?.upgradeRequired
              ? productLimitMessage
              : 'Your subscription needs attention soon. Review billing before seller tools are interrupted.'}
          </span>
        </div>
      )}

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-[#111827]">Product slots</p>
            <FaBoxOpen className="text-[#F97316]" />
          </div>
          <p className="mt-3 text-2xl font-bold text-[#111827]">{formatProductLimit(productUsage)}</p>
          <div className="mt-3 h-2 rounded-full bg-gray-100">
            <div className="h-2 rounded-full bg-[#F97316]" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-2 text-xs text-[#6B7280]">
            {productUsage?.isUnlimited ? 'Unlimited catalog on this plan' : `${productUsage?.remainingSlots ?? 0} slots remaining`}
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-[#111827]">SMS balance</p>
            <FaSms className="text-[#2563EB]" />
          </div>
          <p className="mt-3 text-2xl font-bold text-[#111827]">{smsCredits?.balance || 0}</p>
          <p className="mt-2 text-xs text-[#6B7280]">
            {smsCredits?.includedPerCycle || 0} included this cycle, {smsCredits?.usedThisCycle || 0} used
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-[#111827]">Billing</p>
            <FaCalendarAlt className="text-[#16A34A]" />
          </div>
          <p className="mt-3 text-2xl font-bold text-[#111827]">
            {billing?.daysRemaining === null || billing?.daysRemaining === undefined ? '--' : `${Math.max(0, billing.daysRemaining)}d`}
          </p>
          <p className="mt-2 text-xs text-[#6B7280]">Next billing: {formatDate(billing?.nextBillingDate || billing?.endDate)}</p>
        </div>

        <div className="rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-[#111827]">Locked tools</p>
            <FaLock className="text-[#6B7280]" />
          </div>
          <p className="mt-3 text-2xl font-bold text-[#111827]">{lockedCount}</p>
          <p className="mt-2 text-xs text-[#6B7280]">
            {overview.sellerLogisticsAddon?.active ? 'Logistics provider selected' : 'Upgrade to unlock more seller tools'}
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
        <p className="text-sm text-[#6B7280]">
          {pendingPayment ? 'A pending M-Pesa payment is saved for this account.' : 'Subscription changes route through the secure seller payment flow.'}
        </p>
        <button
          type="button"
          onClick={() => onAction(overview.primaryAction)}
          className="rounded-lg bg-[#111827] px-4 py-2 text-sm font-semibold text-white hover:bg-black"
        >
          {overview.primaryAction?.label || 'Manage Subscription'}
        </button>
      </div>
    </section>
  );
};

const MizigoSellerAddon = ({ user, activePlan, highlightedPlanId, expandedPlanId, onToggleExpand }) => {
  const plan = MIZIGO_PLANS[0];
  const [addon, setAddon] = useState(() => getSellerLogisticsAddon(user));
  const [providers, setProviders] = useState([]);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [savingAddon, setSavingAddon] = useState(false);
  const [sellerHub, setSellerHub] = useState(addon.sellerHub || user?.locationHub || user?.city || '');

  useEffect(() => {
    const loadAddon = async () => {
      const localAddon = getSellerLogisticsAddon(user);
      setAddon(localAddon);
      setSellerHub(localAddon.sellerHub || user?.locationHub || user?.city || '');

      try {
        const backendAddon = await subscriptionService.getSellerLogisticsAddon();
        if (backendAddon) {
          const mergedAddon = saveSellerLogisticsAddon(user, backendAddon);
          setAddon(mergedAddon);
          setSellerHub(mergedAddon.sellerHub || user?.locationHub || user?.city || '');
        }
      } catch (error) {
        if (error.response?.status !== 404 && error.response?.status !== 403) {
          toast.error(error.response?.data?.message || 'Unable to load saved logistics provider');
        }
      }
    };

    loadAddon();
  }, [user]);

  useEffect(() => {
    const loadProviders = async () => {
      setLoadingProviders(true);
      try {
        const response = await logisticsService.getVerifiedProviders({ limit: 100 });
        setProviders(Array.isArray(response) ? response : []);
      } catch (error) {
        setProviders([]);
      } finally {
        setLoadingProviders(false);
      }
    };

    loadProviders();
  }, []);

  const rankedProviders = useMemo(
    () => rankProvidersByDistance(providers, sellerHub),
    [providers, sellerHub]
  );

  const selectedProvider = rankedProviders.find((provider) => provider.id === addon.selectedProviderId) || addon.selectedProvider;

  const persistAddon = async (payload, fallbackUpdater) => {
    setSavingAddon(true);
    try {
      const backendAddon = await subscriptionService.updateSellerLogisticsAddon(payload);
      const nextAddon = saveSellerLogisticsAddon(user, backendAddon || payload);
      setAddon(nextAddon);
      setSellerHub(nextAddon.sellerHub || '');
      return nextAddon;
    } catch (error) {
      const nextAddon = fallbackUpdater();
      setAddon(nextAddon);
      toast.error(error.response?.data?.message || 'Saved locally. Backend could not update logistics provider.');
      return nextAddon;
    } finally {
      setSavingAddon(false);
    }
  };

  const activateAddon = async () => {
    await persistAddon(
      { active: true, sellerHub },
      () => activateSellerLogisticsAddon(user, { sellerHub })
    );
    toast.success('Logistics provider selector activated');
  };

  const deactivateAddon = async () => {
    await persistAddon(
      { active: false, sellerHub, selectedProviderId: '' },
      () => deactivateSellerLogisticsAddon(user)
    );
    toast.success('Logistics provider selector paused');
  };

  const saveHub = (value) => {
    setSellerHub(value);
    if (addon.active) {
      setAddon(saveSellerLogisticsAddon(user, { sellerHub: value }));
    }
  };

  const chooseProvider = async (provider) => {
    await persistAddon(
      {
        active: true,
        sellerHub,
        selectedProviderId: provider.id,
      },
      () => saveSellerLogisticsAddon(user, {
        active: true,
        sellerHub,
        selectedProviderId: provider.id,
        selectedProvider: provider,
      })
    );
    toast.success(`${provider.name} selected for buyer deliveries`);
  };

  return (
    <section id={`plan-card-${plan.id}`} className={`rounded-xl border bg-white p-5 shadow-sm ${highlightedPlanId === plan.id ? 'ring-2 ring-[#FB923C] ring-offset-2' : 'border-gray-200'}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-[#F97316]">Seller logistics provider</p>
          <h2 className="mt-1 text-2xl font-bold text-[#111827]">Logistics Provider Selector</h2>
          <p className="mt-1 text-sm text-[#6B7280]">
            Works alongside your {activePlan?.name || 'seller'} plan. Buyers pay product plus calculated logistics at checkout, and both amounts stay in escrow until buyer QR delivery confirmation.
          </p>
        </div>
        <div className={`rounded-full px-3 py-1 text-xs font-semibold ${addon.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
          {addon.active ? 'Provider selector active' : 'Not active'}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-5">
        <div className="rounded-lg border border-gray-200 bg-[#F9FAFB] p-4 xl:col-span-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold text-[#111827]">{plan.name}</h3>
              <p className="text-sm text-[#6B7280]">Buyer-paid logistics bridge</p>
            </div>
            <FaTruck className="text-xl text-[#F97316]" />
          </div>
          <p className="mt-4 text-2xl font-bold text-[#111827]">Distance-based logistics fee</p>
          <p className="mt-1 text-sm text-[#6B7280]">Checkout calculates pickup-to-shop delivery cost and holds seller plus logistics payouts in escrow.</p>

          <ul className="mt-4 space-y-2">
            {[
              'Buyer pays product amount and logistics together',
              'Escrow holds both payouts until delivery QR scan',
              'Selected logistics account receives the delivery payout',
              'Seller account receives product payout after delivery proof',
              'QR pickup and buyer shop delivery confirmation',
              'Distance estimate from seller hub to buyer shop',
            ].slice(0, expandedPlanId === plan.id ? 6 : 4).map((label) => (
              <li key={label} className="flex items-start gap-2 text-sm text-[#374151]">
                <FaCheckCircle className="mt-0.5 shrink-0 text-[#16A34A]" />
                <span>{label}</span>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={() => onToggleExpand(plan.id)}
            className="mt-3 inline-flex items-center gap-2 text-xs font-medium text-[#F97316] hover:text-[#EA580C]"
          >
            {expandedPlanId === plan.id ? <>View less <FaChevronUp size={11} /></> : <>View more features <FaChevronDown size={11} /></>}
          </button>

          <div className="mt-5 flex flex-wrap gap-2">
            {addon.active ? (
              <button
                type="button"
                onClick={deactivateAddon}
                disabled={savingAddon}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-[#111827] hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingAddon ? 'Saving...' : 'Pause selector'}
              </button>
            ) : (
              <button
                type="button"
                onClick={activateAddon}
                disabled={savingAddon}
                className="rounded-lg bg-[#F97316] px-4 py-2 text-sm font-semibold text-white hover:bg-[#EA580C] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {savingAddon ? 'Saving...' : 'Activate selector'}
              </button>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 p-4 xl:col-span-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-[#111827]">Choose Registered Logistics</h3>
              <p className="text-sm text-[#6B7280]">Only verified logistics accounts appear here. Nearest providers are ranked first when hub data is available.</p>
            </div>
            <FaRoute className="text-xl text-[#3B82F6]" />
          </div>

          <label className="mt-4 block text-sm font-medium text-[#111827]">
            Seller dispatch hub
            <div className="relative mt-1">
              <FaMapMarkerAlt className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={sellerHub}
                onChange={(event) => saveHub(event.target.value)}
                placeholder="Nairobi, Kisumu, Eldoret..."
                className="h-11 w-full rounded-lg border border-gray-300 pl-10 pr-3 text-sm outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20"
              />
            </div>
          </label>

          {selectedProvider && (
            <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-900">
              Selected: <span className="font-semibold">{selectedProvider.name}</span>
              {selectedProvider.distanceKm !== null && selectedProvider.distanceKm !== undefined ? ` - ${selectedProvider.distanceKm}km from ${sellerHub}` : ''}
            </div>
          )}

          <div className="mt-4 max-h-80 space-y-3 overflow-y-auto pr-1">
            {loadingProviders ? (
              <p className="text-sm text-[#6B7280]">Loading verified logistics providers...</p>
            ) : rankedProviders.length ? (
              rankedProviders.slice(0, 8).map((provider) => (
                <div key={provider.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-[#111827]">{provider.name}</p>
                    <p className="mt-1 text-xs text-[#6B7280]">
                      {provider.hub || 'Hub not set'} {provider.vehiclePlate ? `| ${provider.vehiclePlate}` : ''} {provider.cargoCapacityKg ? `| ${provider.cargoCapacityKg}kg` : ''}
                    </p>
                    <p className="mt-1 text-xs text-[#6B7280]">
                      {provider.distanceKm === null ? 'Distance pending hub/coordinate data' : `${provider.distanceKm}km estimated distance`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => chooseProvider(provider)}
                    disabled={!addon.active || savingAddon}
                    className="rounded-lg bg-[#111827] px-3 py-2 text-xs font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {savingAddon ? 'Saving' : addon.selectedProviderId === provider.id ? 'Selected' : 'Choose'}
                  </button>
                </div>
              ))
            ) : (
              <div className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-[#6B7280]">
                No verified logistics providers are available from the current API yet. Once logistics users register and admin verifies them, they will appear here for seller selection.
              </div>
            )}
          </div>

          {!addon.active && (
            <p className="mt-3 text-xs text-[#9A3412]">Activate the selector first, then choose a logistics provider for buyer delivery assignment.</p>
          )}
        </div>
      </div>
    </section>
  );
};

const SubscriptionPlans = () => {
  const { activePlan, switchPlan, cancelSubscription, user, isSeller } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedPlanId = searchParams.get('plan');
  const [expandedPlanId, setExpandedPlanId] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [pendingSubscriptionPayments, setPendingSubscriptionPayments] = useState([]);
  const [subscriptionOverview, setSubscriptionOverview] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [agentNationalId, setAgentNationalId] = useState('');
  const agentReferralStorageKey = `marketpulse_agent_referral_${user?._id || user?.id || 'guest'}`;

  const allPlanIds = useMemo(
    () => new Set([...TRADER_PLANS, ...MIZIGO_PLANS].map((plan) => plan.id)),
    []
  );

  const highlightedPlanId = useMemo(
    () => (requestedPlanId && allPlanIds.has(requestedPlanId) ? requestedPlanId : null),
    [requestedPlanId, allPlanIds]
  );

  useEffect(() => {
    if (!highlightedPlanId) return;

    setExpandedPlanId(highlightedPlanId);

    const timer = setTimeout(() => {
      const element = document.getElementById(`plan-card-${highlightedPlanId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [highlightedPlanId]);

  useEffect(() => {
    setPendingSubscriptionPayments(listPendingSubscriptionPayments(user));
  }, [user]);

  useEffect(() => {
    if (!isSeller) return;
    setAgentNationalId(localStorage.getItem(agentReferralStorageKey) || '');
  }, [agentReferralStorageKey, isSeller]);

  useEffect(() => {
    let cancelled = false;

    const loadSubscriptionOverview = async () => {
      if (!isSeller) {
        setSubscriptionOverview(null);
        return;
      }

      setOverviewLoading(true);
      try {
        const overview = await subscriptionService.getOverview();
        if (!cancelled) {
          setSubscriptionOverview(overview);
        }
      } catch (error) {
        if (!cancelled) {
          setSubscriptionOverview(null);
          toast.error(error.response?.data?.message || 'Unable to load subscription account status');
        }
      } finally {
        if (!cancelled) {
          setOverviewLoading(false);
        }
      }
    };

    loadSubscriptionOverview();

    return () => {
      cancelled = true;
    };
  }, [isSeller, user?._id, user?.id]);

  const handleToggleExpand = (planId) => {
    setExpandedPlanId((prev) => (prev === planId ? null : planId));
  };

  const handleActivatePlan = (plan) => {
    const normalizedAgentNationalId = String(agentNationalId || '').replace(/\D/g, '');
    if (normalizedAgentNationalId && normalizedAgentNationalId.length < 5) {
      toast.error('Agent National ID must have at least 5 digits');
      return;
    }

    if (normalizedAgentNationalId) {
      localStorage.setItem(agentReferralStorageKey, normalizedAgentNationalId);
    } else {
      localStorage.removeItem(agentReferralStorageKey);
    }

    if (plan.id === PLAN_IDS.MIZIGO) {
      switchPlan(plan.id, { agentNationalId: normalizedAgentNationalId });
      return;
    }

    const requiresPremiumVerification = plan.id === PLAN_IDS.SMART || plan.id === PLAN_IDS.GROWTH;
    if (requiresPremiumVerification && !hasPremiumVerification(user)) {
      navigate(`/seller/premium-verification?plan=${encodeURIComponent(plan.id)}`);
      return;
    }

    const query = new URLSearchParams({ plan: plan.id });
    if (normalizedAgentNationalId) query.set('agentNationalId', normalizedAgentNationalId);
    navigate(`/seller/premium-payment?${query.toString()}`);
  };

  const handleOverviewAction = (action) => {
    if (!action?.path) {
      navigate('/seller/subscription-plans');
      return;
    }

    navigate(action.path);
  };

  const canCancelCurrentPlan = isSeller && activePlan?.id && activePlan.id !== PLAN_IDS.MIZIGO;
  const latestPendingPayment = pendingSubscriptionPayments[0] || null;

  const handleCancelSubscription = async () => {
    if (!canCancelCurrentPlan || cancelling) return;

    const confirmed = window.confirm(`Cancel your ${activePlan.name} subscription? This seller account will have no active plan until one is activated again.`);
    if (!confirmed) return;

    setCancelling(true);
    try {
      await cancelSubscription(`Cancelled ${activePlan.name} from subscription page`);
      const overview = await subscriptionService.getOverview();
      setSubscriptionOverview(overview);
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="bg-[#F9FAFB] min-h-screen py-8">
      <div className="container mx-auto px-4">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-[#111827]">Lango Subscription Matrix</h1>
            <p className="text-[#6B7280] mt-2">Basic tiers provide the tools. Paid tiers unlock the intelligence agents.</p>
          </div>
          {canCancelCurrentPlan && (
            <button
              type="button"
              onClick={handleCancelSubscription}
              disabled={cancelling}
              className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
            >
              <FaTimesCircle />
              {cancelling ? 'Cancelling...' : 'Cancel Subscription'}
            </button>
          )}
        </div>

        <div className="mb-6 bg-[#111827] text-white rounded-xl p-4">
          <p className="text-sm">Current Active Tier</p>
          {activePlan ? (
            <p className="text-xl font-semibold">
              {activePlan.name} <span className="text-white/70 text-sm">({activePlan.track.toUpperCase()})</span>
            </p>
          ) : (
            <p className="text-xl font-semibold">No active subscription</p>
          )}
        </div>

        {isSeller && latestPendingPayment && (
          <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-950">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold">Pending M-Pesa subscription payment</p>
                <p className="mt-1 text-sm">
                  {latestPendingPayment.message || 'Complete your phone STK prompt, then check the saved payment status.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate(`/seller/premium-payment?plan=${encodeURIComponent(latestPendingPayment.planId)}`)}
                className="rounded-lg bg-[#111827] px-4 py-2 text-sm font-semibold text-white hover:bg-black"
              >
                Continue Payment
              </button>
            </div>
          </div>
        )}

        {isSeller && (
          <section className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50 text-[#F97316]">
                  <FaIdCard />
                </span>
                <div>
                  <p className="text-sm font-semibold text-[#111827]">Agent referral (optional)</p>
                  <p className="mt-1 text-sm text-[#6B7280]">
                    If a Lango agent referred this seller account, enter the agent National ID before choosing a plan. Leave it blank if there is no agent referral.
                  </p>
                </div>
              </div>
              <div className="w-full sm:w-72">
                <label className="sr-only" htmlFor="agentNationalId">Agent National ID</label>
                <input
                  id="agentNationalId"
                  type="text"
                  inputMode="numeric"
                  value={agentNationalId}
                  onChange={(event) => setAgentNationalId(event.target.value.replace(/\D/g, '').slice(0, 20))}
                  placeholder="Optional agent National ID"
                  className="h-11 w-full rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20"
                />
              </div>
            </div>
          </section>
        )}

        {isSeller && (
          <SubscriptionOverviewPanel
            overview={subscriptionOverview}
            loading={overviewLoading}
            pendingPayment={latestPendingPayment}
            onAction={handleOverviewAction}
          />
        )}

        {!isSeller && (
          <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
            <h2 className="text-xl font-semibold">Seller registration required</h2>
            <p className="mt-2 text-sm">
              Buyer accounts cannot activate seller subscription plans. Register as a seller first, then choose the plan that matches your business.
            </p>
            <button
              type="button"
              onClick={() => navigate('/register?role=seller')}
              className="mt-4 rounded-lg bg-[#F97316] px-4 py-2 text-sm font-semibold text-white hover:bg-[#EA580C]"
            >
              Register As Seller
            </button>
          </section>
        )}

        {isSeller && (
          <>
            <section className="mb-10">
              <h2 className="text-2xl font-semibold text-[#111827] mb-4">Trader Track</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {TRADER_PLANS.map((plan) => (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    isActive={activePlan?.id === plan.id}
                    onActivate={() => handleActivatePlan(plan)}
                    featureLimit={6}
                    isExpanded={expandedPlanId === plan.id}
                    onToggleExpand={handleToggleExpand}
                    isHighlighted={highlightedPlanId === plan.id}
                    lockTooltip={plan.id === PLAN_IDS.SOLO ? 'Starter plan with 200 product catalog' : FEATURE_TOOLTIPS[plan.featureKeys[0]] || 'Upgrade to unlock'}
                  />
                ))}
              </div>
            </section>

            <MizigoSellerAddon
              user={user}
              activePlan={activePlan}
              highlightedPlanId={highlightedPlanId}
              expandedPlanId={expandedPlanId}
              onToggleExpand={handleToggleExpand}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default SubscriptionPlans;
