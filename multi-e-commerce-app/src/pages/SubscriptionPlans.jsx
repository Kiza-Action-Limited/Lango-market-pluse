import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FaCheckCircle, FaChevronDown, FaChevronUp, FaCrown, FaLock, FaMapMarkerAlt, FaRoute, FaTimesCircle, FaTruck } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { FEATURE_LABELS, FEATURE_TOOLTIPS, MIZIGO_PLANS, PLAN_IDS, TRADER_PLANS } from '../config/subscriptionPlans';
import { logisticsService } from '../services/logisticsService';
import {
  activateSellerLogisticsAddon,
  deactivateSellerLogisticsAddon,
  getSellerLogisticsAddon,
  rankProvidersByDistance,
  saveSellerLogisticsAddon,
} from '../utils/logisticsAddon';
import { hasPremiumVerification } from '../utils/premiumSellerProfile';

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

const MizigoSellerAddon = ({ user, activePlan, highlightedPlanId, expandedPlanId, onToggleExpand }) => {
  const plan = MIZIGO_PLANS[0];
  const [addon, setAddon] = useState(() => getSellerLogisticsAddon(user));
  const [providers, setProviders] = useState([]);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [sellerHub, setSellerHub] = useState(addon.sellerHub || user?.locationHub || user?.city || '');

  useEffect(() => {
    setAddon(getSellerLogisticsAddon(user));
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

  const activateAddon = () => {
    const nextAddon = activateSellerLogisticsAddon(user, { sellerHub });
    setAddon(nextAddon);
    toast.success('Mizigo Logistics Bridge activated as an add-on');
  };

  const deactivateAddon = () => {
    const nextAddon = deactivateSellerLogisticsAddon(user);
    setAddon(nextAddon);
    toast.success('Mizigo Logistics Bridge paused');
  };

  const saveHub = (value) => {
    setSellerHub(value);
    if (addon.active) {
      setAddon(saveSellerLogisticsAddon(user, { sellerHub: value }));
    }
  };

  const chooseProvider = (provider) => {
    const nextAddon = saveSellerLogisticsAddon(user, {
      active: true,
      sellerHub,
      selectedProviderId: provider.id,
      selectedProvider: provider,
    });
    setAddon(nextAddon);
    toast.success(`${provider.name} selected for seller deliveries`);
  };

  return (
    <section id={`plan-card-${plan.id}`} className={`rounded-xl border bg-white p-5 shadow-sm ${highlightedPlanId === plan.id ? 'ring-2 ring-[#FB923C] ring-offset-2' : 'border-gray-200'}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-[#F97316]">Independent seller add-on</p>
          <h2 className="mt-1 text-2xl font-bold text-[#111827]">Mizigo Logistics Track</h2>
          <p className="mt-1 text-sm text-[#6B7280]">
            Works alongside your {activePlan?.name || 'seller'} plan. It does not change your product, SMS, or intelligence tier.
          </p>
        </div>
        <div className={`rounded-full px-3 py-1 text-xs font-semibold ${addon.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
          {addon.active ? 'Add-on active' : 'Not active'}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-5">
        <div className="xl:col-span-2 rounded-lg border border-gray-200 bg-[#F9FAFB] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold text-[#111827]">{plan.name}</h3>
              <p className="text-sm text-[#6B7280]">{plan.differentiator}</p>
            </div>
            <FaTruck className="text-xl text-[#F97316]" />
          </div>
          <p className="mt-4 text-2xl font-bold text-[#111827]">{plan.priceLabel}</p>
          <p className="mt-1 text-sm text-[#6B7280]">{plan.description}</p>

          <ul className="mt-4 space-y-2">
            {plan.featureKeys.slice(0, expandedPlanId === plan.id ? plan.featureKeys.length : 6).map((featureKey) => (
              <li key={featureKey} className="flex items-start gap-2 text-sm text-[#374151]">
                <FaCheckCircle className="mt-0.5 shrink-0 text-[#16A34A]" />
                <span>{FEATURE_LABELS[featureKey] || featureKey}</span>
              </li>
            ))}
          </ul>

          {plan.featureKeys.length > 6 && (
            <button
              type="button"
              onClick={() => onToggleExpand(plan.id)}
              className="mt-3 inline-flex items-center gap-2 text-xs font-medium text-[#F97316] hover:text-[#EA580C]"
            >
              {expandedPlanId === plan.id ? <>View less <FaChevronUp size={11} /></> : <>View more features <FaChevronDown size={11} /></>}
            </button>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            {addon.active ? (
              <button
                type="button"
                onClick={deactivateAddon}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-[#111827] hover:bg-gray-50"
              >
                Pause Add-on
              </button>
            ) : (
              <button
                type="button"
                onClick={activateAddon}
                className="rounded-lg bg-[#F97316] px-4 py-2 text-sm font-semibold text-white hover:bg-[#EA580C]"
              >
                Activate Logistics Bridge
              </button>
            )}
          </div>
        </div>

        <div className="xl:col-span-3 rounded-lg border border-gray-200 p-4">
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
                    disabled={!addon.active}
                    className="rounded-lg bg-[#111827] px-3 py-2 text-xs font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {addon.selectedProviderId === provider.id ? 'Selected' : 'Choose'}
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
            <p className="mt-3 text-xs text-[#9A3412]">Activate the add-on first, then choose a logistics provider for delivery assignment.</p>
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

  const handleToggleExpand = (planId) => {
    setExpandedPlanId((prev) => (prev === planId ? null : planId));
  };

  const handleActivatePlan = (plan) => {
    const isPremiumTraderPlan = plan.id === PLAN_IDS.SMART || plan.id === PLAN_IDS.GROWTH;
    if (!isPremiumTraderPlan) {
      switchPlan(plan.id);
      return;
    }

    if (!hasPremiumVerification(user)) {
      navigate(`/seller/premium-verification?plan=${encodeURIComponent(plan.id)}`);
      return;
    }

    navigate(`/seller/premium-payment?plan=${encodeURIComponent(plan.id)}`);
  };

  const canCancelCurrentPlan = isSeller && activePlan?.id && activePlan.id !== PLAN_IDS.MIZIGO;

  const handleCancelSubscription = async () => {
    if (!canCancelCurrentPlan || cancelling) return;

    const confirmed = window.confirm(`Cancel your ${activePlan.name} subscription? This seller account will have no active plan until one is activated again.`);
    if (!confirmed) return;

    setCancelling(true);
    try {
      await cancelSubscription(`Cancelled ${activePlan.name} from subscription page`);
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
                    lockTooltip={plan.id === PLAN_IDS.SOLO ? 'Starter plan with 30 SKU cap' : FEATURE_TOOLTIPS[plan.featureKeys[0]] || 'Upgrade to unlock'}
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
