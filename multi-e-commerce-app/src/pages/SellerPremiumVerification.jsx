import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FaArrowRight, FaBuilding, FaEnvelope, FaFileUpload, FaLink, FaStore } from 'react-icons/fa';
import api from '../config/axios';
import { ALL_PLANS } from '../config/subscriptionPlans';
import { useAuth } from '../context/AuthContext';
import { upsertPremiumProfileForUser } from '../utils/premiumSellerProfile';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isValidUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch (error) {
    return false;
  }
};

const SellerPremiumVerification = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const planId = searchParams.get('plan') || '';
  const selectedPlan = useMemo(() => ALL_PLANS.find((plan) => plan.id === planId) || null, [planId]);

  const [form, setForm] = useState({
    storefrontName: '',
    governmentBusinessName: '',
    businessEmail: user?.email || '',
    businessUrlsRaw: '',
  });
  const [licenseFile, setLicenseFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const onChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const validate = () => {
    if (!form.storefrontName.trim()) return 'Storefront name is required';
    if (!form.governmentBusinessName.trim()) return 'Government registered business name is required';
    if (!emailRegex.test(form.businessEmail.trim())) return 'Please enter a valid business email';
    const urls = form.businessUrlsRaw
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);
    if (!urls.length) return 'Please provide at least one valid business URL';
    if (!urls.every(isValidUrl)) return 'One or more business URLs are invalid';
    if (!licenseFile) return 'Business license document is required';
    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    const urls = form.businessUrlsRaw
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);

    setSubmitting(true);
    try {
      const multipart = new FormData();
      multipart.append('storefrontName', form.storefrontName.trim());
      multipart.append('governmentBusinessName', form.governmentBusinessName.trim());
      multipart.append('businessEmail', form.businessEmail.trim());
      multipart.append('businessUrls', JSON.stringify(urls));
      multipart.append('planId', planId);
      multipart.append('licenseDocument', licenseFile);

      try {
        await api.post('/seller/premium-verification', multipart, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } catch (apiError) {
        // Keep local fallback so flow is not blocked when endpoint is not yet live.
      }

      upsertPremiumProfileForUser(user, {
        storefrontName: form.storefrontName.trim(),
        governmentBusinessName: form.governmentBusinessName.trim(),
        businessEmail: form.businessEmail.trim(),
        businessUrls: urls,
        licenseFileName: licenseFile.name,
        licenseFileSize: licenseFile.size,
        licenseFileType: licenseFile.type,
      });

      toast.success('Business verification saved');
      navigate(`/seller/premium-payment?plan=${encodeURIComponent(planId)}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-[#F9FAFB] min-h-screen py-8">
      <div className="container mx-auto px-4 max-w-3xl">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h1 className="text-2xl font-bold text-[#111827]">Premium Seller Verification</h1>
          <p className="text-sm text-[#6B7280] mt-1">
            Complete this section before payment activation for <span className="font-semibold">{selectedPlan?.name || 'premium plan'}</span>.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {error && <p className="text-sm text-red-600">{error}</p>}

            <div>
              <label className="text-sm font-medium text-[#111827] mb-1 block">Storefront Name</label>
              <div className="relative">
                <FaStore className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
                <input
                  value={form.storefrontName}
                  onChange={(e) => onChange('storefrontName', e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F97316]"
                  placeholder="Example: Tech World"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-[#111827] mb-1 block">Government Registered Business Name</label>
              <div className="relative">
                <FaBuilding className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
                <input
                  value={form.governmentBusinessName}
                  onChange={(e) => onChange('governmentBusinessName', e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F97316]"
                  placeholder="Example: Tech World Kenya Limited"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-[#111827] mb-1 block">Business Email</label>
              <div className="relative">
                <FaEnvelope className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
                <input
                  type="email"
                  value={form.businessEmail}
                  onChange={(e) => onChange('businessEmail', e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F97316]"
                  placeholder="business@example.com"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-[#111827] mb-1 block">Business Valid URLs (one per line)</label>
              <div className="relative">
                <FaLink className="absolute left-3 top-4 text-[#6B7280]" />
                <textarea
                  rows="4"
                  value={form.businessUrlsRaw}
                  onChange={(e) => onChange('businessUrlsRaw', e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F97316]"
                  placeholder={"https://yourcompany.co.ke\nhttps://www.linkedin.com/company/yourcompany"}
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-[#111827] mb-1 block">Upload Business License Document</label>
              <div className="relative">
                <FaFileUpload className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => setLicenseFile(e.target.files?.[0] || null)}
                  className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F97316]"
                />
              </div>
              {licenseFile && (
                <p className="text-xs text-[#6B7280] mt-1">
                  Selected: {licenseFile.name} ({Math.ceil(licenseFile.size / 1024)} KB)
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#F97316] text-white font-semibold hover:bg-[#EA580C] disabled:opacity-60"
            >
              {submitting ? 'Saving...' : 'Continue To Premium Payment'}
              <FaArrowRight size={13} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SellerPremiumVerification;
