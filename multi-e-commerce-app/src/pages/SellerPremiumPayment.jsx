import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FaBuilding, FaCheckCircle, FaCreditCard, FaMobileAlt, FaSyncAlt } from 'react-icons/fa';
import { ALL_PLANS, PLAN_IDS } from '../config/subscriptionPlans';
import { useAuth } from '../context/AuthContext';
import { getPremiumProfileForUser } from '../utils/premiumSellerProfile';
import { paymentService } from '../services/paymentService';
import {
  clearPendingSubscriptionPayment,
  loadPendingSubscriptionPayment,
  savePendingSubscriptionPayment,
} from '../utils/subscriptionPaymentRecovery';

const SellerPremiumPayment = () => {
  const { user, refreshUser, isSeller } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [activating, setActivating] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkoutRequestId, setCheckoutRequestId] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [mpesaPhone, setMpesaPhone] = useState(user?.phone || '');
  const [statusPollingPaused, setStatusPollingPaused] = useState(false);
  const [payeeAccount, setPayeeAccount] = useState({
    name: 'Lango Market Pulse',
    type: 'platform',
  });

  const planId = searchParams.get('plan') || '';
  const selectedPlan = useMemo(() => ALL_PLANS.find((plan) => plan.id === planId) || null, [planId]);
  const profile = useMemo(() => getPremiumProfileForUser(user), [user]);
  const requiresPremiumVerification = selectedPlan?.id === PLAN_IDS.SMART || selectedPlan?.id === PLAN_IDS.GROWTH;

  const completeActivation = async (statusPayload) => {
    if (!selectedPlan || (!statusPayload?.activated && statusPayload?.status !== 'completed')) return false;

    clearPendingSubscriptionPayment(user, selectedPlan.id);
    await refreshUser?.();
    toast.success(`${selectedPlan.name} activated successfully`);
    navigate(`/seller/subscription-plans?plan=${encodeURIComponent(selectedPlan.id)}`);
    return true;
  };

  const checkPaymentStatus = async (requestId = checkoutRequestId, { silent = false } = {}) => {
    if (!requestId) return;
    setChecking(true);
    try {
      const result = await paymentService.checkSubscriptionMpesaStatus(requestId);
      if (result?.payeeAccount) {
        setPayeeAccount(result.payeeAccount);
      }
      setPaymentStatus(result?.message || result?.status || 'Waiting for M-Pesa confirmation');
      if (result?.code === 'MPESA_ACCESS_TOKEN_BLOCKED') {
        setStatusPollingPaused(true);
      }
      if (selectedPlan && requestId) {
        savePendingSubscriptionPayment(user, selectedPlan.id, {
          checkoutRequestId: requestId,
          phoneNumber: mpesaPhone,
          status: result?.status || 'pending',
          message: result?.message || 'Waiting for M-Pesa confirmation',
          statusPollingPaused: result?.code === 'MPESA_ACCESS_TOKEN_BLOCKED',
          payeeAccount: result?.payeeAccount,
        });
      }

      const activated = await completeActivation(result);
      if (!activated && !silent && result?.status === 'failed') {
        toast.error(result?.message || 'M-Pesa payment was not completed');
      }
    } catch (error) {
      if (!silent) {
        toast.error(error?.response?.data?.message || error?.message || 'Unable to check payment status');
      }
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    if (selectedPlan && requiresPremiumVerification && !profile) {
      navigate(`/seller/premium-verification?plan=${encodeURIComponent(planId)}`, { replace: true });
    }
  }, [profile, navigate, planId, requiresPremiumVerification, selectedPlan]);

  useEffect(() => {
    if (!selectedPlan) return;
    const pendingPayment = loadPendingSubscriptionPayment(user, selectedPlan.id);
    if (!pendingPayment?.checkoutRequestId) return;

    setCheckoutRequestId(pendingPayment.checkoutRequestId);
    setMpesaPhone(pendingPayment.phoneNumber || user?.phone || '');
    setPaymentStatus(pendingPayment.message || 'You have a pending M-Pesa payment. Check status after completing the prompt on your phone.');
    setStatusPollingPaused(Boolean(pendingPayment.statusPollingPaused));
    if (pendingPayment.payeeAccount) {
      setPayeeAccount(pendingPayment.payeeAccount);
    }
  }, [selectedPlan, user]);

  useEffect(() => {
    if (!checkoutRequestId || statusPollingPaused) return undefined;

    const timer = setInterval(() => {
      checkPaymentStatus(checkoutRequestId, { silent: true });
    }, 6000);

    return () => clearInterval(timer);
  }, [checkoutRequestId, statusPollingPaused]);

  if (!selectedPlan) {
    return (
      <div className="p-8 text-center">
        <p className="text-[#6B7280]">Plan not found.</p>
      </div>
    );
  }

  if (!isSeller) {
    return (
      <div className="bg-[#F9FAFB] min-h-screen py-8">
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-950">
            <h1 className="text-2xl font-bold">Seller registration required</h1>
            <p className="mt-2 text-sm">
              Buyer accounts cannot activate seller subscription plans. Register as a seller first, then return to choose a plan.
            </p>
            <button
              type="button"
              onClick={() => navigate('/register?role=seller')}
              className="mt-4 rounded-lg bg-[#F97316] px-4 py-2 text-sm font-semibold text-white hover:bg-[#EA580C]"
            >
              Register As Seller
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (requiresPremiumVerification && !profile) return null;

  const activatePlan = async () => {
    if (!mpesaPhone.trim()) {
      toast.error('Enter the M-Pesa phone number that will receive the STK prompt');
      return;
    }

    setActivating(true);
    setPaymentStatus('');
    try {
      const result = await paymentService.initiateSubscriptionMpesaPayment({
        planId: selectedPlan.id,
        phoneNumber: mpesaPhone.trim(),
      });

      if (result?.checkoutRequestId) {
        if (result?.payeeAccount) {
          setPayeeAccount(result.payeeAccount);
        }
        setCheckoutRequestId(result.checkoutRequestId);
        setStatusPollingPaused(false);
        setPaymentStatus('STK Push sent. Enter your M-Pesa PIN on your phone to complete payment.');
        savePendingSubscriptionPayment(user, selectedPlan.id, {
          checkoutRequestId: result.checkoutRequestId,
          phoneNumber: mpesaPhone.trim(),
          status: result?.status || 'pending',
          message: 'STK Push sent. Enter your M-Pesa PIN on your phone to complete payment.',
          payeeAccount: result?.payeeAccount,
        });
        toast.success('M-Pesa STK Push sent to your phone');
      } else {
        setPaymentStatus(result?.message || 'M-Pesa payment request sent');
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || 'Failed to start M-Pesa payment');
    } finally {
      setActivating(false);
    }
  };

  const clearPendingPayment = () => {
    clearPendingSubscriptionPayment(user, selectedPlan.id);
    setCheckoutRequestId('');
    setPaymentStatus('');
    setStatusPollingPaused(false);
    toast.success('Pending subscription payment cleared');
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

          <div className="mt-4 rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-start gap-3">
              <FaBuilding className="mt-1 text-[#F97316]" />
              <div>
                <h2 className="font-semibold text-[#111827]">Subscription payee account</h2>
                <p className="mt-1 text-sm text-[#374151]">
                  Your subscription payment goes to <span className="font-semibold">{payeeAccount?.name || 'Lango Market Pulse'}</span>.
                </p>
                {(payeeAccount?.mpesaShortCode || payeeAccount?.accountReference) && (
                  <p className="mt-1 text-xs text-[#6B7280]">
                    {payeeAccount?.mpesaShortCode ? `M-Pesa business account: ${payeeAccount.mpesaShortCode}` : ''}
                    {payeeAccount?.mpesaShortCode && payeeAccount?.accountReference ? ' | ' : ''}
                    {payeeAccount?.accountReference ? `Reference: ${payeeAccount.accountReference}` : ''}
                  </p>
                )}
              </div>
            </div>
          </div>

          {profile && (
            <div className="mt-4 rounded-lg bg-white border border-gray-200 p-4">
              <h2 className="font-semibold text-[#111827] mb-2">Verified Business Information</h2>
              <ul className="space-y-1 text-sm text-[#374151]">
                <li className="inline-flex items-center gap-2"><FaCheckCircle className="text-[#16A34A]" /> Storefront: {profile.storefrontName}</li>
                <li className="inline-flex items-center gap-2"><FaCheckCircle className="text-[#16A34A]" /> Registered Name: {profile.governmentBusinessName}</li>
                <li className="inline-flex items-center gap-2"><FaCheckCircle className="text-[#16A34A]" /> Email: {profile.businessEmail}</li>
                <li className="inline-flex items-center gap-2"><FaCheckCircle className="text-[#16A34A]" /> License: {profile.licenseFileName}</li>
              </ul>
            </div>
          )}

          {checkoutRequestId && (
            <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950">
              <p className="font-semibold">Pending M-Pesa checkout</p>
              <p className="mt-1">
                Request #{String(checkoutRequestId).slice(-10)} is saved on this device. Complete the STK prompt, then use I Have Paid to activate the plan.
              </p>
            </div>
          )}

          <div className="mt-4 rounded-lg border border-gray-200 bg-white p-4">
            <label className="block text-sm font-semibold text-[#111827]" htmlFor="mpesaPhone">
              M-Pesa phone number
            </label>
            <div className="relative mt-2">
              <FaMobileAlt className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                id="mpesaPhone"
                type="tel"
                value={mpesaPhone}
                onChange={(event) => setMpesaPhone(event.target.value)}
                placeholder="07XXXXXXXX or 2547XXXXXXXX"
                className="h-11 w-full rounded-lg border border-gray-300 pl-10 pr-3 text-sm outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20"
              />
            </div>
            <p className="mt-2 text-xs text-[#6B7280]">
              An STK Push will appear on this phone. Enter your M-Pesa PIN there to confirm payment.
            </p>
          </div>

          {paymentStatus && (
            <div className="mt-4 rounded-lg border border-[#FDBA74] bg-[#FFF7ED] p-4 text-sm text-[#9A3412]">
              {paymentStatus}
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={activatePlan}
              disabled={activating || checking}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#F97316] text-white font-semibold hover:bg-[#EA580C] disabled:opacity-60"
            >
              <FaCreditCard />
              {activating ? 'Sending STK Push...' : checkoutRequestId ? 'Resend STK Push' : 'Proceed To Payment & Activate'}
            </button>

            {checkoutRequestId && (
              <button
                type="button"
                onClick={() => checkPaymentStatus(checkoutRequestId)}
                disabled={checking}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-5 py-2.5 font-semibold text-[#111827] hover:bg-gray-50 disabled:opacity-60"
              >
                <FaSyncAlt className={checking ? 'animate-spin' : ''} />
                {checking ? 'Checking...' : 'I Have Paid'}
              </button>
            )}

            {checkoutRequestId && (
              <button
                type="button"
                onClick={clearPendingPayment}
                disabled={activating || checking}
                className="rounded-lg border border-red-200 bg-white px-5 py-2.5 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
              >
                Clear Pending
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SellerPremiumPayment;
