/* eslint-disable react-hooks/rules-of-hooks */
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FaCheckCircle, FaCreditCard } from 'react-icons/fa';
import { ALL_PLANS } from '../config/subscriptionPlans';
import { useAuth } from '../context/AuthContext';
import { getPremiumProfileForUser } from '../utils/premiumSellerProfile';

const SellerPremiumPayment = () => {
  const { user, switchPlan } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [activating, setActivating] = useState(false);

  const planId = searchParams.get('plan') || '';
  const selectedPlan = useMemo(() => ALL_PLANS.find((plan) => plan.id === planId) || null, [planId]);
  const profile = useMemo(() => getPremiumProfileForUser(user), [user]);

  if (!selectedPlan) {
    return (
      <div className="p-8 text-center">
        <p className="text-[#6B7280]">Plan not found.</p>
      </div>
    );
  }

  useEffect(() => {
    if (!profile) {
      navigate(`/seller/premium-verification?plan=${encodeURIComponent(planId)}`, { replace: true });
    }
  }, [profile, navigate, planId]);

  if (!profile) return null;

  const activatePlan = async () => {
    setActivating(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 700));
      switchPlan(selectedPlan.id);
      toast.success(`${selectedPlan.name} activated successfully`);
      navigate(`/seller/subscription-plans?plan=${encodeURIComponent(selectedPlan.id)}`);
    } finally {
      setActivating(false);
    }
  };

  return (
    <div className="bg-[#F9FAFB] min-h-screen py-8">
      <div className="container mx-auto px-4 max-w-3xl space-y-4">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h1 className="text-2xl font-bold text-[#111827]">Premium Plan Payment Activation</h1>
          <p className="text-sm text-[#6B7280] mt-1">Final step before your premium tools go live.</p>

          <div className="mt-5 rounded-lg bg-[#FFF7ED] border border-[#FDBA74] p-4">
            <p className="font-semibold text-[#9A3412]">{selectedPlan.name}</p>
            <p className="text-sm text-[#7C2D12] mt-1">
              Price: {selectedPlan.priceLabel} | Differentiator: {selectedPlan.differentiator}
            </p>
          </div>

          <div className="mt-4 rounded-lg bg-white border border-gray-200 p-4">
            <h2 className="font-semibold text-[#111827] mb-2">Verified Business Information</h2>
            <ul className="space-y-1 text-sm text-[#374151]">
              <li className="inline-flex items-center gap-2"><FaCheckCircle className="text-[#16A34A]" /> Storefront: {profile.storefrontName}</li>
              <li className="inline-flex items-center gap-2"><FaCheckCircle className="text-[#16A34A]" /> Registered Name: {profile.governmentBusinessName}</li>
              <li className="inline-flex items-center gap-2"><FaCheckCircle className="text-[#16A34A]" /> Email: {profile.businessEmail}</li>
              <li className="inline-flex items-center gap-2"><FaCheckCircle className="text-[#16A34A]" /> License: {profile.licenseFileName}</li>
            </ul>
          </div>

          <button
            type="button"
            onClick={activatePlan}
            disabled={activating}
            className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#F97316] text-white font-semibold hover:bg-[#EA580C] disabled:opacity-60"
          >
            <FaCreditCard />
            {activating ? 'Activating...' : 'Proceed To Payment & Activate'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SellerPremiumPayment;
