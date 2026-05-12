import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FaCheckCircle, FaChevronDown, FaChevronUp, FaCrown, FaLock, FaSyncAlt } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { FEATURE_LABELS, MIZIGO_PLANS, TRADER_PLANS } from '../config/subscriptionPlans';
import { hasPremiumVerification } from '../utils/premiumSellerProfile';

const PlanCard = ({ plan, isActive, onActivate, featureLimit, isExpanded, onToggleExpand, isHighlighted }) => (
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
      {isActive ? <FaCrown className="text-[#F97316] text-xl" /> : <FaLock className="text-[#9CA3AF] text-lg" />}
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
      className={`w-full mt-5 px-4 py-2 rounded-lg font-medium transition ${
        isActive
          ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
          : 'bg-[#F97316] text-white hover:bg-[#EA580C]'
      }`}
    >
      {isActive ? 'Active Plan' : 'Activate in UI'}
    </button>
  </div>
);

const SubscriptionPlans = () => {
  const { activePlan, switchPlan, resetPlanToDefault, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedPlanId = searchParams.get('plan');
  const [expandedPlanId, setExpandedPlanId] = useState(null);

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
    const isPremiumPlan = !plan.id.endsWith('_solo');
    if (!isPremiumPlan) {
      switchPlan(plan.id);
      return;
    }

    if (!hasPremiumVerification(user)) {
      navigate(`/seller/premium-verification?plan=${encodeURIComponent(plan.id)}`);
      return;
    }

    navigate(`/seller/premium-payment?plan=${encodeURIComponent(plan.id)}`);
  };

  return (
    <div className="bg-[#F9FAFB] min-h-screen py-8">
      <div className="container mx-auto px-4">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-[#111827]">Lango Subscription Matrix</h1>
            <p className="text-[#6B7280] mt-2">Basic tiers provide the tools. Paid tiers unlock the intelligence agents.</p>
          </div>
          <button
            type="button"
            onClick={resetPlanToDefault}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
          >
            <FaSyncAlt />
            Reset To Default
          </button>
        </div>

        {activePlan && (
          <div className="mb-6 bg-[#111827] text-white rounded-xl p-4">
            <p className="text-sm">Current Active Tier</p>
            <p className="text-xl font-semibold">
              {activePlan.name} <span className="text-white/70 text-sm">({activePlan.track.toUpperCase()})</span>
            </p>
          </div>
        )}

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
              />
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-[#111827] mb-4">Mizigo Logistics Track</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {MIZIGO_PLANS.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                isActive={activePlan?.id === plan.id}
                onActivate={() => handleActivatePlan(plan)}
                featureLimit={6}
                isExpanded={expandedPlanId === plan.id}
                onToggleExpand={handleToggleExpand}
                isHighlighted={highlightedPlanId === plan.id}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default SubscriptionPlans;
