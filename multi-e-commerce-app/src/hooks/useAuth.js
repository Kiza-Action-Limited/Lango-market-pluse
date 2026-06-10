// src/hooks/useAuth.js
import { useAuth as useAuthContext } from '../context/AuthContext';
import { isBuyerUser, isSellerUser } from '../utils/userCategory';

export const useAuth = () => {
  const auth = useAuthContext();
  
  const hasRole = (role) => {
    return auth.user?.role === role;
  };
  
  const hasAnyRole = (roles) => {
    return roles.includes(auth.user?.role);
  };
  
  const isSeller = () => {
    return isSellerUser(auth.user);
  };
  
  const isAdmin = () => {
    return auth.user?.role === 'admin';
  };
  
  const isBuyer = () => {
    return isBuyerUser(auth.user);
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
