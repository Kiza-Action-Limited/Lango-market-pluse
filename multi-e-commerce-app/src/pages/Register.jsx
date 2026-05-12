import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  FaUser,
  FaEnvelope,
  FaLock,
  FaStore,
  FaBrain,
  FaArrowRight,
  FaEye,
  FaEyeSlash,
  FaPhone,
} from 'react-icons/fa';
import marketPulseLogo from '../assets/Marketpulse-logo.png';

const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'buyer',
    businessType: '',
    businessLogoUrl: '',
  });
  const [businessLogoName, setBusinessLogoName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPasswordStrength, setShowPasswordStrength] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const businessTypes = ['Wholesaler', 'Manufacturer', 'Retailer', 'Farmer', 'Other Business'];

  useEffect(() => {
    const roleParam = searchParams.get('role');
    if (roleParam === 'seller' || roleParam === 'buyer') {
      setFormData((prev) => ({
        ...prev,
        role: roleParam,
        businessType: roleParam === 'seller' ? prev.businessType : '',
      }));
    }
  }, [searchParams]);

  const selectRole = (role) => {
    setFormData((prev) => ({
      ...prev,
      role,
      businessType: role === 'seller' ? prev.businessType : '',
    }));

    const params = new URLSearchParams(searchParams);
    params.set('role', role);
    setSearchParams(params, { replace: true });
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleBusinessLogoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      setBusinessLogoName('');
      setFormData((prev) => ({ ...prev, businessLogoUrl: '' }));
      return;
    }

    if (!file.type.startsWith('image/')) {
      setError('Business logo must be an image file');
      e.target.value = '';
      return;
    }

    const maxSizeBytes = 2 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      setError('Business logo image must be 2MB or less');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData((prev) => ({ ...prev, businessLogoUrl: String(reader.result || '') }));
      setBusinessLogoName(file.name);
      setError('');
    };
    reader.readAsDataURL(file);
  };

  const getPasswordStrength = (password) => {
    if (!password) return { score: 0, label: '', color: '' };
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    if (score <= 1) return { score, label: 'Weak', color: 'text-red-500' };
    if (score <= 2) return { score, label: 'Fair', color: 'text-[#F97316]' };
    if (score <= 3) return { score, label: 'Good', color: 'text-[#FB923C]' };
    return { score, label: 'Strong', color: 'text-[#16A34A]' };
  };

  const passwordStrength = getPasswordStrength(formData.password);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.role) {
      setError('Please choose Buyer or Seller');
      return;
    }

    if (formData.role === 'seller' && !formData.businessType) {
      setError('Please select your business type');
      return;
    }

    if (formData.role === 'seller' && !formData.businessLogoUrl) {
      setError('Please upload your business logo');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    const phoneValue = formData.phone.trim();
    const kenyaPhoneRegex = /^\+?254[0-9]{9}$/;
    if (!kenyaPhoneRegex.test(phoneValue)) {
      setError('Phone number must be in format 2547XXXXXXXX or +2547XXXXXXXX');
      return;
    }

    setLoading(true);
    const { confirmPassword, ...registerData } = formData;
    registerData.phone = phoneValue;
    registerData.businessType = registerData.role === 'seller' ? registerData.businessType : 'consumer';

    const result = await register(registerData);
    if (result.success) {
      const requestedPlan = searchParams.get('plan');
      if (registerData.role === 'seller') {
        navigate(
          requestedPlan
            ? `/seller/subscription-plans?plan=${encodeURIComponent(requestedPlan)}`
            : '/seller/subscription-plans'
        );
      } else {
        navigate('/login?role=buyer');
      }
    } else {
      setError(result.error);
    }

    setLoading(false);
  };

  const accountCards = [
    {
      key: 'buyer',
      title: 'Buyer Sign Up',
      subtitle: 'Shop from trusted suppliers',
      icon: FaUser,
      activeClass: 'border-[#16A34A] bg-[#16A34A]/5',
      iconClass: 'text-[#16A34A]',
    },
    {
      key: 'seller',
      title: 'Seller Sign Up',
      subtitle: 'List products and grow sales',
      icon: FaStore,
      activeClass: 'border-[#F97316] bg-[#F97316]/5',
      iconClass: 'text-[#F97316]',
    },
  ];

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-linear-to-br from-[#F9FAFB] to-[#E5E7EB] py-8 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
        <div className="bg-white rounded-2xl shadow-md p-6 sm:p-8 border border-[#F97316]/15">
          <img src={marketPulseLogo} alt="Lango Market Pulse" className="w-full h-auto max-h-105 object-contain mx-auto" />
          <p className="mt-4 text-sm text-[#6B7280] text-center">
            Join the platform built for smart commerce and trusted growth.
          </p>
        </div>

        <div className="w-full max-w-xl mx-auto space-y-6">
          <div className="text-center lg:text-left">
            <h2 className="text-3xl font-extrabold text-[#F97316]">Create your account</h2>
            <p className="mt-2 text-sm text-[#6B7280] italic">Lango Lako la Biashara Smart</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {accountCards.map((card) => {
              const Icon = card.icon;
              const isActive = formData.role === card.key;
              return (
                <button
                  key={card.key}
                  type="button"
                  onClick={() => selectRole(card.key)}
                  className={`rounded-xl border p-4 text-left transition ${
                    isActive ? card.activeClass : 'border-gray-200 bg-white hover:border-[#FB923C]/60'
                  }`}
                >
                  <Icon className={`mb-2 ${isActive ? card.iconClass : 'text-[#6B7280]'}`} />
                  <p className="text-sm font-semibold text-[#111827]">{card.title}</p>
                  <p className="text-xs text-[#6B7280]">{card.subtitle}</p>
                </button>
              );
            })}
          </div>

          <form className="space-y-5 rounded-xl border border-gray-200 bg-white p-5" onSubmit={handleSubmit}>
            {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

            <p className="text-sm font-semibold text-[#111827]">
              {formData.role === 'seller' ? 'Seller registration form' : 'Buyer registration form'}
            </p>

            <div className="space-y-4">
              <div className="relative">
                <FaUser className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280] text-sm" />
                <input
                  type="text"
                  name="name"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F97316] focus:border-transparent text-[#111827]"
                  placeholder="Full Name"
                />
              </div>

              <div className="relative">
                <FaEnvelope className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280] text-sm" />
                <input
                  type="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F97316] focus:border-transparent text-[#111827]"
                  placeholder="Email address"
                />
              </div>

              <div className="relative">
                <FaPhone className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280] text-sm" />
                <input
                  type="tel"
                  name="phone"
                  required
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F97316] focus:border-transparent text-[#111827]"
                  placeholder="Phone number (2547XXXXXXXX)"
                />
              </div>

              {formData.role === 'seller' && (
                <div className="space-y-3">
                  <div className="relative">
                    <FaStore className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280] text-sm" />
                    <select
                      name="businessType"
                      value={formData.businessType}
                      onChange={handleChange}
                      required
                      className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F97316] focus:border-transparent text-[#111827] appearance-none"
                    >
                      <option value="">Select business type</option>
                      {businessTypes.map((type) => (
                        <option key={type} value={type.toLowerCase().replace(/\s+/g, '_')}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="rounded-lg border border-gray-300 p-3">
                    <label htmlFor="businessLogo" className="block text-sm font-medium text-[#111827] mb-2">
                      Business logo <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="businessLogo"
                      type="file"
                      accept="image/*"
                      required={formData.role === 'seller'}
                      onChange={handleBusinessLogoChange}
                      className="block w-full text-sm text-[#374151] file:mr-3 file:rounded-md file:border-0 file:bg-[#F97316]/10 file:px-3 file:py-2 file:text-[#F97316] file:font-semibold hover:file:bg-[#F97316]/20"
                    />
                    <p className="mt-2 text-xs text-[#6B7280]">Upload a clear logo (max 2MB).</p>
                    {businessLogoName && <p className="mt-1 text-xs text-[#16A34A]">Selected: {businessLogoName}</p>}
                  </div>
                </div>
              )}

              <div className="relative">
                <FaLock className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280] text-sm" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  onFocus={() => setShowPasswordStrength(true)}
                  onBlur={() => setShowPasswordStrength(false)}
                  className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F97316] focus:border-transparent text-[#111827]"
                  placeholder="Password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#F97316]"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <FaEyeSlash size={14} /> : <FaEye size={14} />}
                </button>
                {showPasswordStrength && formData.password && (
                  <div className="absolute right-10 top-1/2 -translate-y-1/2">
                    <span className={`text-xs font-medium ${passwordStrength.color}`}>{passwordStrength.label}</span>
                  </div>
                )}
              </div>

              {formData.password && (
                <div className="mt-1">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map((level) => (
                      <div
                        key={level}
                        className={`h-1 flex-1 rounded-full transition-all ${
                          level <= passwordStrength.score
                            ? passwordStrength.score <= 1
                              ? 'bg-red-500'
                              : passwordStrength.score <= 2
                              ? 'bg-[#F97316]'
                              : passwordStrength.score <= 3
                              ? 'bg-[#FB923C]'
                              : 'bg-[#16A34A]'
                            : 'bg-gray-200'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-[#6B7280] mt-1">Use 8+ chars with letters, numbers and symbols</p>
                </div>
              )}

              <div className="relative">
                <FaLock className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280] text-sm" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  required
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F97316] focus:border-transparent text-[#111827]"
                  placeholder="Confirm Password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#F97316]"
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? <FaEyeSlash size={14} /> : <FaEye size={14} />}
                </button>
              </div>

              {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
              )}
            </div>

            <div className="p-3 bg-linear-to-r from-[#FB923C]/5 to-[#F97316]/5 rounded-lg border border-[#FB923C]/20">
              <div className="flex items-center gap-2 mb-1">
                <FaBrain className="text-[#FB923C] text-xs" />
                <span className="text-xs font-semibold text-[#FB923C] uppercase tracking-wide">AI Powered Platform</span>
              </div>
              <p className="text-xs text-[#6B7280]">
                Get personalized recommendations, market insights, and smart alerts when you join Lango MarketPulse.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center gap-2 py-3 px-4 text-sm font-semibold rounded-lg text-white bg-[#F97316] hover:bg-[#F97316]/90 disabled:opacity-50 transition-colors"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Creating account...
                </>
              ) : (
                <>
                  {formData.role === 'seller' ? 'Sign up as Seller' : 'Sign up as Buyer'}
                  <FaArrowRight size={14} />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-sm text-[#6B7280]">
            Already have an account?{' '}
            <Link
              to={`/login?role=${formData.role || 'buyer'}`}
              className="font-medium text-[#F97316] hover:text-[#F97316]/80 transition-colors"
            >
              Sign in as {formData.role === 'seller' ? 'Seller' : 'Buyer'}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
