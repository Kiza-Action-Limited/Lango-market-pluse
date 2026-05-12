import React from 'react';
import { Link, Navigate, Outlet } from 'react-router-dom';
import { FaCrown, FaLock } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { FEATURE_LABELS } from '../config/subscriptionPlans';

const SubscriptionGate = ({ requiredFeatures = [], requireAny = false, children }) => {
  const { isAuthenticated, loading, hasFeature, activePlan } = useAuth();

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!requiredFeatures.length) {
    return children || <Outlet />;
  }

  const enabledCount = requiredFeatures.filter((featureKey) => hasFeature(featureKey)).length;
  const hasAccess = requireAny ? enabledCount > 0 : enabledCount === requiredFeatures.length;

  if (hasAccess) {
    return children || <Outlet />;
  }

  const missingFeatures = requiredFeatures.filter((featureKey) => !hasFeature(featureKey));

  return (
    <div className="bg-[#F9FAFB] min-h-[60vh] py-10 px-4">
      <div className="max-w-2xl mx-auto bg-white border border-gray-200 rounded-xl shadow-md p-6">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-[#F97316]/10 text-[#F97316] flex items-center justify-center">
            <FaLock />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-[#111827]">Feature Locked By Subscription</h2>
            <p className="text-sm text-[#6B7280] mt-1">
              Your current plan is <span className="font-medium text-[#111827]">{activePlan?.name || 'Unknown'}</span>.
              Upgrade to unlock this area.
            </p>
          </div>
        </div>

        <div className="mt-5">
          <p className="text-sm font-medium text-[#111827] mb-2">Missing capabilities</p>
          <ul className="space-y-2">
            {missingFeatures.map((featureKey) => (
              <li key={featureKey} className="text-sm text-[#374151]">
                - {FEATURE_LABELS[featureKey] || featureKey}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to="/seller/subscription-plans"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#F97316] text-white rounded-lg hover:bg-[#EA580C] transition"
          >
            <FaCrown />
            View Upgrade Options
          </Link>
          <Link
            to="/seller"
            className="px-4 py-2 border border-gray-300 rounded-lg text-[#111827] hover:bg-gray-50 transition"
          >
            Back To Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionGate;
