// src/context/AuthContext.jsx
import React, { createContext, useState, useContext, useEffect } from 'react';
import { authService } from '../services/authService';
import { handleApiError } from '../utils/errorHandler';
import toast from 'react-hot-toast';
import {
  clearStoredPlanOverride,
  getPlanById,
  getPlansByTrack,
  hasFeatureAccess,
  resolveActivePlan,
  setStoredPlanOverride,
} from '../utils/subscription';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [activePlan, setActivePlan] = useState(null);

  useEffect(() => {
    if (token) {
      fetchUser();
    } else {
      setActivePlan(null);
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!user) {
      setActivePlan(null);
      return;
    }
    setActivePlan(resolveActivePlan(user));
  }, [user]);

  const fetchUser = async () => {
    try {
      const currentUser = await authService.getCurrentUser();
      setUser(currentUser);
    } catch (error) {
      console.error('Error fetching user:', error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (identifier, password) => {
    try {
      const response = await authService.login(identifier, password);
      const { token, user } = response;
      localStorage.setItem('token', token);
      setToken(token);
      setUser(user);
      toast.success('Login successful! Welcome back!');
      return { success: true };
    } catch (error) {
      const errorMessage = handleApiError(error);
      toast.error(errorMessage.message || 'Login failed');
      return { success: false, error: errorMessage.message };
    }
  };

  const register = async (userData) => {
    try {
      const payload = {
        ...userData,
        fullName: userData.fullName || userData.name,
      };
      const response = await authService.register(payload);
      const { token, user } = response;
      localStorage.setItem('token', token);
      setToken(token);
      setUser(user);
      toast.success('Registration successful! Welcome to MultiVendor Hub!');
      return { success: true };
    } catch (error) {
      const errorMessage = handleApiError(error);
      toast.error(errorMessage.message || 'Registration failed');
      return { success: false, error: errorMessage.message };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setActivePlan(null);
    toast.success('Logged out successfully');
  };

  const updateUser = (updatedData) => {
    setUser(prev => ({ ...prev, ...updatedData }));
  };

  const switchPlan = (nextPlanId) => {
    const nextPlan = getPlanById(nextPlanId);
    if (!nextPlan || !user) return;
    setStoredPlanOverride(user, nextPlanId);
    setActivePlan(nextPlan);
    toast.success(`Active plan changed to ${nextPlan.name}`);
  };

  const resetPlanToDefault = () => {
    if (!user) return;
    clearStoredPlanOverride(user);
    const resolved = resolveActivePlan(user);
    setActivePlan(resolved);
    toast.success('Plan reset to your default tier');
  };

  const hasFeature = (featureKey) => hasFeatureAccess(activePlan, featureKey);
  const roleValue = String(user?.role || '').toLowerCase();
  const businessTypeValue = String(user?.businessType || '').toLowerCase();
  const sellerCategories = new Set(['seller', 'wholesaler', 'farmer', 'retailer', 'manufacturer']);
  const buyerCategories = new Set(['buyer', 'consumer']);

  const value = {
    user,
    loading,
    token,
    login,
    register,
    logout,
    updateUser,
    activePlan,
    availablePlans: getPlansByTrack(activePlan?.track),
    hasFeature,
    switchPlan,
    resetPlanToDefault,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
    isSeller: user?.role === 'admin' || sellerCategories.has(roleValue) || sellerCategories.has(businessTypeValue),
    isBuyer: buyerCategories.has(roleValue) || buyerCategories.has(businessTypeValue)
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
