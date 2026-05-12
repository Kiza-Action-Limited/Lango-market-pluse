// src/components/SellerRoute.jsx
import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const SellerRoute = () => {
  const { isAuthenticated, isSeller, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return isAuthenticated && isSeller ? <Outlet /> : <Navigate to="/" />;
};

export default SellerRoute;