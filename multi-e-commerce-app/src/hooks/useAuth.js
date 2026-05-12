// src/hooks/useAuth.js
import { useAuth as useAuthContext } from '../context/AuthContext';

export const useAuth = () => {
  const auth = useAuthContext();
  const roleValue = String(auth.user?.role || '').toLowerCase();
  const businessTypeValue = String(auth.user?.businessType || '').toLowerCase();
  const sellerCategories = new Set(['seller', 'wholesaler', 'farmer', 'retailer', 'manufacturer']);
  const buyerCategories = new Set(['buyer', 'consumer']);
  
  const hasRole = (role) => {
    return auth.user?.role === role;
  };
  
  const hasAnyRole = (roles) => {
    return roles.includes(auth.user?.role);
  };
  
  const isSeller = () => {
    return auth.user?.role === 'admin' || sellerCategories.has(roleValue) || sellerCategories.has(businessTypeValue);
  };
  
  const isAdmin = () => {
    return auth.user?.role === 'admin';
  };
  
  const isBuyer = () => {
    return buyerCategories.has(roleValue) || buyerCategories.has(businessTypeValue);
  };
  
  const getBusinessType = () => {
    return auth.user?.businessType;
  };
  
  return {
    ...auth,
    hasRole,
    hasAnyRole,
    isSeller,
    isAdmin,
    isBuyer,
    getBusinessType
  };
};
