import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isLogisticsUser, isSellerUser } from '../utils/userCategory';

const PublicOnlyRoute = () => {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (isAuthenticated) {
    if (user?.role === 'admin') return <Navigate to="/admin/dashboard" replace />;
    if (isLogisticsUser(user)) return <Navigate to="/logistics/dashboard" replace />;
    if (isSellerUser(user)) return <Navigate to="/seller" replace />;
    return <Navigate to="/buyer" replace />;
  }

  return <Outlet />;
};

export default PublicOnlyRoute;
