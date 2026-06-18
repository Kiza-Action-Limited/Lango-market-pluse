// src/context/AuthContext.jsx
import React, { createContext, useState, useContext, useEffect } from 'react';
import { authService } from '../services/authService';
import { handleApiError } from '../utils/errorHandler';
import toast from 'react-hot-toast';
import {
  getPlanById,
  getPlansByTrack,
  hasFeatureAccess,
  resolveActivePlan,
} from '../utils/subscription';
import { subscriptionService } from '../services/subscriptionService';
import { isBuyerUser, isSellerUser } from '../utils/userCategory';

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
      return currentUser;
    } catch (error) {
      console.error('Error fetching user:', error);
      logout();
      return null;
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
      return { success: true, user };
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

  const switchPlan = async (nextPlanId, paymentMeta = {}) => {
    const nextPlan = getPlanById(nextPlanId);
    if (!nextPlan || !user) return { success: false, message: 'Plan not found' };
    if (isBuyerUser(user) || !isSellerUser(user)) {
      const message = 'Register as a seller before activating a seller subscription plan.';
      toast.error(message);
      return { success: false, message };
    }

    try {
      await subscriptionService.subscribe({
        planId: nextPlan.id,
        paymentMethod: paymentMeta.paymentMethod || 'mpesa',
        paymentCompleted: paymentMeta.paymentCompleted ?? true,
        paymentReference: paymentMeta.paymentReference,
      });

      const refreshedUser = await authService.getCurrentUser();
      setUser(refreshedUser);
      setActivePlan(resolveActivePlan(refreshedUser));
      toast.success(`Plan changed to ${nextPlan.name}`);
      return { success: true, plan: nextPlan };
    } catch (error) {
      const message = handleApiError(error)?.message || 'Failed to update subscription plan';
      toast.error(message);
      return { success: false, message };
    }
  };

  const resetPlanToDefault = () => {
    if (!user) return { success: false };
    const resolved = resolveActivePlan(user);
    setActivePlan(resolved);
    toast.success('Plan reset to your default tier');
    return { success: true };
  };

  const cancelSubscription = async (reason = '') => {
    if (!user) return { success: false, message: 'Login required' };

    try {
      const result = await subscriptionService.cancel(reason);
      const refreshedUser = await authService.getCurrentUser();
      setUser(refreshedUser);
      setActivePlan(resolveActivePlan(refreshedUser));
      toast.success(result?.message || 'Subscription cancelled');
      return { success: true, data: result };
    } catch (error) {
      const message = handleApiError(error)?.message || 'Failed to cancel subscription';
      toast.error(message);
      return { success: false, message };
    }
  };

  const hasFeature = (featureKey) => hasFeatureAccess(activePlan, featureKey);
  const value = {
    user,
    loading,
    token,
    login,
    register,
    logout,
    updateUser,
    refreshUser: fetchUser,
    activePlan,
    availablePlans: getPlansByTrack(activePlan?.track),
    hasFeature,
    switchPlan,
    cancelSubscription,
    resetPlanToDefault,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
    isSeller: isSellerUser(user),
    isBuyer: isBuyerUser(user)
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
