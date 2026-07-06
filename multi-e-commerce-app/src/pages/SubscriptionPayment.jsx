// src/pages/SubscriptionPayment.jsx
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaCheckCircle, FaCreditCard, FaShieldAlt } from 'react-icons/fa';
import { ALL_PLANS, FEATURE_LABELS, PLAN_IDS } from '../config/subscriptionPlans';
import { useAuth } from '../context/AuthContext';
import { hasPremiumVerification } from '../utils/premiumSellerProfile';

export const SubscriptionPayment = () => {
  const navigate = useNavigate();
  const { user, isSeller } = useAuth();
  const [selectedPlanId, setSelectedPlanId] = useState(PLAN_IDS.SOLO);

  const selectedPlan = useMemo(
    () => ALL_PLANS.find((plan) => plan.id === selectedPlanId) || ALL_PLANS[0],
    [selectedPlanId]
  );

  const continueToVerifiedFlow = () => {
    if (!isSeller) {
      navigate(`/register?role=seller&plan=${encodeURIComponent(selectedPlan.id)}`);
      return;
    }

    if (selectedPlan.id === PLAN_IDS.MIZIGO) {
      navigate(`/seller/subscription-plans?plan=${encodeURIComponent(selectedPlan.id)}`);
      return;
    }

    const needsVerification = selectedPlan.id === PLAN_IDS.SMART || selectedPlan.id === PLAN_IDS.GROWTH;
    if (needsVerification && !hasPremiumVerification(user)) {
      navigate(`/seller/premium-verification?plan=${encodeURIComponent(selectedPlan.id)}`);
      return;
    }

    navigate(`/seller/premium-payment?plan=${encodeURIComponent(selectedPlan.id)}`);
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] py-10">
      <div className="container mx-auto max-w-6xl px-4">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-[#111827]">Choose Subscription Payment</h1>
            <p className="mt-2 text-sm text-[#6B7280]">
              Paid seller plans continue through the server-verified M-Pesa checkout before activation.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm font-semibold text-green-800">
            <FaShieldAlt />
            Verified activation only
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          {ALL_PLANS.map((plan) => {
            const selected = selectedPlan?.id === plan.id;
            return (
              <button
                type="button"
                key={plan.id}
                onClick={() => setSelectedPlanId(plan.id)}
                className={`rounded-xl border bg-white p-5 text-left shadow-sm transition ${
                  selected ? 'border-[#F97316] ring-2 ring-[#FB923C]/40' : 'border-gray-200 hover:border-[#FDBA74]'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold text-[#111827]">{plan.name}</h2>
                    <p className="mt-1 text-xs font-semibold uppercase text-[#F97316]">{plan.track}</p>
                  </div>
                  {selected && <FaCheckCircle className="text-[#16A34A]" />}
                </div>
                <p className="mt-4 text-lg font-bold text-[#111827]">{plan.priceLabel}</p>
                <p className="mt-2 text-sm text-[#6B7280]">{plan.description}</p>
                <ul className="mt-4 space-y-2">
                  {plan.featureKeys.slice(0, 4).map((featureKey) => (
                    <li key={featureKey} className="flex items-start gap-2 text-sm text-[#374151]">
                      <FaCheckCircle className="mt-0.5 shrink-0 text-[#16A34A]" />
                      <span>{FEATURE_LABELS[featureKey] || featureKey}</span>
                    </li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>

        <div className="mt-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm text-[#6B7280]">Selected plan</p>
              <h2 className="text-2xl font-bold text-[#111827]">{selectedPlan.name}</h2>
              <p className="mt-1 text-sm text-[#6B7280]">{selectedPlan.priceLabel}</p>
            </div>
            <button
              type="button"
              onClick={continueToVerifiedFlow}
              className="inline-flex items-center gap-2 rounded-lg bg-[#F97316] px-5 py-3 text-sm font-semibold text-white hover:bg-[#EA580C]"
            >
              <FaCreditCard />
              Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionPayment;
