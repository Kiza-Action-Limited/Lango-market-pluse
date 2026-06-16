// src/pages/Profile.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { FaUser, FaEnvelope, FaPhone, FaMapMarkerAlt, FaStore, FaSave, FaBrain, FaShieldAlt, FaCrown } from 'react-icons/fa';
import NotificationPreferencesCard from '../components/NotificationPreferencesCard';

const Profile = () => {
  const { user, token, activePlan, availablePlans, switchPlan, isSeller } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: ''
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        address: user.address || ''
      });
    }
  }, [user]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const response = await axios.put(
        'http://localhost:5000/api/profile',
        formData,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Profile updated successfully');
    } catch (error) {
      toast.error('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  // Get role badge styling
  const getRoleBadge = () => {
    switch (user?.role) {
      case 'admin':
        return { bg: 'bg-[#FB923C]/10', text: 'text-[#FB923C]', label: 'Administrator' };
      case 'seller':
        return { bg: 'bg-[#F97316]/10', text: 'text-[#F97316]', label: 'Seller' };
      default:
        return { bg: 'bg-[#16A34A]/10', text: 'text-[#16A34A]', label: 'Buyer' };
    }
  };

  const roleBadge = getRoleBadge();

  return (
    <div className="bg-[#F9FAFB] min-h-screen py-8">
      <div className="container mx-auto px-4 max-w-2xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <FaUser className="text-[#F97316] text-3xl" />
            <h1 className="text-3xl font-bold text-[#F97316]">My Profile</h1>
          </div>
          <p className="text-[#6B7280]">Lango Lako la Biashara Smart — Manage your account details</p>
        </div>

        {activePlan && user?.role !== 'buyer' && (
          <div className="mb-6 bg-white rounded-xl shadow-md p-5 border border-[#F97316]/20">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="flex items-center gap-2">
                  <FaCrown className="text-[#F97316]" />
                  <h3 className="font-semibold text-[#111827]">Current Plan: {activePlan.name}</h3>
                </div>
                <p className="text-sm text-[#6B7280] mt-1">
                  {activePlan.differentiator} • {activePlan.priceLabel}
                </p>
              </div>
              <select
                value={activePlan.id}
                onChange={(e) => switchPlan(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-[#111827] bg-white"
              >
                {(availablePlans || []).map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {isSeller && (
          <div className="mb-6 bg-white rounded-xl shadow-md p-5 border border-[#16A34A]/20">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h3 className="font-semibold text-[#111827]">Seller Quick Access</h3>
                <p className="text-sm text-[#6B7280] mt-1">
                  Go to your dashboard to manage products, orders, and subscription.
                </p>
              </div>
              <Link
                to="/seller"
                className="px-4 py-2 rounded-lg bg-[#16A34A] text-white font-medium hover:bg-[#15803D] transition"
              >
                Open Seller Dashboard
              </Link>
            </div>
          </div>
        )}

        <div className="mb-6">
          <NotificationPreferencesCard
            title="Notification Preferences"
            description="Control how you receive order updates, scarcity alerts, and account activity right from your profile dashboard."
          />
        </div>

        {/* Profile Card */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          {/* Profile Header */}
          <div className="bg-linear-to-r from-[#F97316] to-[#FB923C] px-6 py-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-lg">
                <span className="text-2xl font-bold text-[#F97316]">
                  {user?.name?.charAt(0).toUpperCase() || 'U'}
                </span>
              </div>
              <div className="text-white">
                <h2 className="text-xl font-semibold">{user?.name}</h2>
                <p className="text-white/80 text-sm">{user?.email}</p>
                <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${roleBadge.bg} ${roleBadge.text} bg-white/20`}>
                  {roleBadge.label}
                </span>
              </div>
            </div>
          </div>
          
          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6">
            <div className="space-y-5">
              {/* Full Name */}
              <div>
                <label className="text-sm font-medium mb-2 text-[#111827] flex items-center gap-2">
                  <FaUser className="text-[#F97316] text-sm" />
                  Full Name
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F97316] focus:border-transparent text-[#111827]"
                  placeholder="Your full name"
                />
              </div>
              
              {/* Email (disabled) */}
              <div>
                <label className="text-sm font-medium mb-2 text-[#111827] flex items-center gap-2">
                  <FaEnvelope className="text-[#FB923C] text-sm" />
                  Email Address
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  disabled
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-[#6B7280] cursor-not-allowed"
                />
                <p className="text-xs text-[#6B7280] mt-1">Email address cannot be changed</p>
              </div>
              
              {/* Phone Number */}
              <div>
                <label className="text-sm font-medium mb-2 text-[#111827] flex items-center gap-2">
                  <FaPhone className="text-[#16A34A] text-sm" />
                  Phone Number
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#16A34A] focus:border-transparent text-[#111827]"
                  placeholder="+254 700 000000"
                />
              </div>
              
              {/* Address */}
              <div>
                <label className="text-sm font-medium mb-2 text-[#111827] flex items-center gap-2">
                  <FaMapMarkerAlt className="text-[#F97316] text-sm" />
                  Address
                </label>
                <textarea
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  rows="3"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F97316] focus:border-transparent text-[#111827]"
                  placeholder="Your shipping address"
                />
              </div>
              
              {/* Business Type (for sellers) */}
              {(user?.role === 'seller' || user?.role === 'farmer') && (
                <div className="bg-[#F97316]/5 rounded-lg p-4 border border-[#F97316]/20">
                  <label className="text-sm font-medium mb-2 text-[#111827] flex items-center gap-2">
                    <FaStore className="text-[#F97316] text-sm" />
                    Business Type
                  </label>
                  <input
                    type="text"
                    value={user.businessType ? user.businessType.charAt(0).toUpperCase() + user.businessType.slice(1) : ''}
                    disabled
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-[#111827] font-medium cursor-not-allowed"
                  />
                  <p className="text-xs text-[#6B7280] mt-2">
                    Your business category helps customers find your products
                  </p>
                </div>
              )}
              
              {/* Save Button */}
              <div className="pt-4 border-t border-gray-200">
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#F97316] text-white rounded-lg font-semibold hover:bg-[#F97316]/90 transition-colors disabled:opacity-50 shadow-md"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <FaSave size={16} />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
        
        {/* AI Intelligence Tip */}
        <div className="mt-6 bg-linear-to-r from-[#FB923C]/10 to-[#F97316]/10 rounded-xl p-4 border border-[#FB923C]/20">
          <div className="flex items-start gap-3">
            <FaBrain className="text-[#FB923C] text-xl mt-0.5" />
            <div>
              <h4 className="font-semibold text-[#111827] mb-1">AI Intelligence Tip</h4>
              <p className="text-sm text-[#6B7280]">
                Keeping your profile updated helps us provide better recommendations and faster checkout experiences.
                {user?.role === 'seller' && ' Complete your store details to increase visibility by up to 40%.'}
              </p>
            </div>
          </div>
        </div>
        
        {/* Security Note */}
        <div className="mt-4 text-center text-xs text-[#6B7280] flex items-center justify-center gap-2">
          <FaShieldAlt className="text-[#16A34A]" />
          <span>Your information is secure and never shared with third parties</span>
        </div>
      </div>
    </div>
  );
};

export default Profile;
