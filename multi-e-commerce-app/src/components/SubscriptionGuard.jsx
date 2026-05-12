import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useSubscription } from '../context/SubscriptionContext';

export const SubscriptionGuard = ({ children }) => {

  const { subscription, loading } = useSubscription();

  if (loading) {
    return <div className="flex justify-center items-center h-screen">Checking subscription...</div>;
  }

  if (!subscription?.active) {
    
    // Redirect to the subscription plans page
    return <Navigate to="/seller/subscription-plans" replace />;
  }

  return children || <Outlet />;
};
