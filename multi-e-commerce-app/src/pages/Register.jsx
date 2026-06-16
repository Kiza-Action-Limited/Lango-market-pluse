import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/authService';
import {
  FaUser,
  FaEnvelope,
  FaLock,
  FaStore,
  FaBrain,
  FaArrowRight,
  FaArrowLeft,
  FaEye,
  FaEyeSlash,
  FaPhone,
  FaCheckCircle,
  FaTruck,
} from 'react-icons/fa';
import marketPulseLogo from '../assets/Marketpulse-logo.png';
import { createPrefetchHandlers } from '../utils/prefetch';
import {
  mergeRegistrationData,
  resetRegistrationProgress,
  setRegistrationStep,
} from '../redux/slices/uiSlice';

const DEFAULT_REGISTRATION_DATA = {
  verificationMethod: 'email',
  verificationValue: '',
  verificationCode: '',
  isVerified: false,
  name: '',
  phone: '',
  email: '',
  password: '',
  confirmPassword: '',
  role: 'buyer',
  businessType: '',
  businessName: '',
  businessLogoUrl: '',
};

const Register = () => {
  const dispatch = useDispatch();
  const registrationProgress = useSelector((state) => state?.ui?.registrationProgress);
  const persistedStep = registrationProgress?.step;
  const persistedData = registrationProgress?.data;
  const [formData, setFormData] = useState({
    ...DEFAULT_REGISTRATION_DATA,
    ...(persistedData || {}),
  });
  const [businessLogoName, setBusinessLogoName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPasswordStrength, setShowPasswordStrength] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const { register } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [step, setStep] = useState(Number(persistedStep) || 1);

  const businessTypes = ['Wholesaler', 'Manufacturer', 'Retailer', 'Farmer', 'Other Business'];

  useEffect(() => {
    dispatch(mergeRegistrationData(formData));
  }, [dispatch, formData]);

  useEffect(() => {
    dispatch(setRegistrationStep(step));
  }, [dispatch, step]);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = setInterval(() => {
      setCooldownSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownSeconds]);

  useEffect(() => {
    const roleParam = searchParams.get('role');
    if (roleParam === 'seller' || roleParam === 'buyer' || roleParam === 'logistics') {
      setFormData((prev) => ({
        ...prev,
        role: roleParam,
        businessType: roleParam === 'seller' ? prev.businessType : '',
        businessName: roleParam === 'seller' ? prev.businessName : '',
      }));
    }
  }, [searchParams]);

  const selectRole = (role) => {
    setFormData((prev) => ({
      ...prev,
      role,
      businessType: role === 'seller' ? prev.businessType : '',
      businessName: role === 'seller' ? prev.businessName : '',
    }));

    const params = new URLSearchParams(searchParams);
    params.set('role', role);
    setSearchParams(params, { replace: true });
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'verificationMethod') {
      setFormData((prev) => ({
        ...prev,
        verificationMethod: value,
        verificationValue: '',
        verificationCode: '',
        isVerified: false,
      }));
      setOtpSent(false);
      setCooldownSeconds(0);
      return;
    }

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSendVerificationCode = async () => {
    const method = formData.verificationMethod;
    const value = formData.verificationValue.trim();
    const kenyaPhoneRegex = /^\+?254[0-9]{9}$/;

    if (method === 'email') {
      if (!/^\S+@\S+\.\S+$/.test(value)) {
        setError('Enter a valid email for verification');
        return;
      }
      setFormData((prev) => ({ ...prev, email: value.toLowerCase() }));
    } else {
      if (!kenyaPhoneRegex.test(value)) {
        setError('Phone verification needs format 2547XXXXXXXX or +2547XXXXXXXX');
        return;
      }
      setFormData((prev) => ({ ...prev, phone: value }));
    }
    setVerificationLoading(true);
    try {
      await authService.sendOtp({ channel: method, value });
      const cooldown = await authService.getOtpCooldown({ channel: method, value });
      setCooldownSeconds(Number(cooldown?.cooldownSeconds) || 0);
      setOtpSent(true);
      setFormData((prev) => ({ ...prev, verificationCode: '', isVerified: false }));
      setError('');
    } catch (sendError) {
      const message = sendError?.response?.data?.message || 'Failed to send verification code';
      setError(message);
    } finally {
      setVerificationLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!otpSent) {
      setError('Send verification code first');
      return;
    }
    const enteredCode = formData.verificationCode.trim();
    if (!/^\d{6}$/.test(enteredCode)) {
      setError('Enter a valid 6-digit code');
      return;
    }
    setVerificationLoading(true);
    try {
      await authService.verifyOtp({
        channel: formData.verificationMethod,
        value: formData.verificationValue.trim(),
        code: enteredCode,
      });
      setFormData((prev) => ({ ...prev, isVerified: true }));
      setStep((prev) => Math.min(4, prev + 1));
      setError('');
    } catch (verifyError) {
      const message = verifyError?.response?.data?.message || 'Verification failed';
      setError(message);
    } finally {
      setVerificationLoading(false);
    }
  };

  const handleResendCode = async () => {
    const channel = formData.verificationMethod;
    const value = formData.verificationValue.trim();
    if (!value) return;
    setVerificationLoading(true);
    try {
      await authService.resendOtp({ channel, value });
      const cooldown = await authService.getOtpCooldown({ channel, value });
      setCooldownSeconds(Number(cooldown?.cooldownSeconds) || 0);
      setError('');
    } catch (resendError) {
      const message = resendError?.response?.data?.message || 'Failed to resend verification code';
      setError(message);
    } finally {
      setVerificationLoading(false);
    }
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

  const validateStep = (targetStep) => {
    if (targetStep === 2) {
      if (!formData.isVerified) {
        setError('Verify your email or phone number first');
        return false;
      }
    }

    if (targetStep === 3) {
      if (!formData.role) {
        setError('Please choose Buyer, Seller, or Logistics');
        return false;
      }
      if (!formData.name.trim() || !formData.email.trim() || !formData.phone.trim()) {
        setError('Please complete full name, email, and phone number');
        return false;
      }
    }

    if (targetStep === 4 && formData.role === 'seller') {
      if (!formData.businessName.trim()) {
        setError('Please enter your business name');
        return false;
      }
      if (!formData.businessType) {
        setError('Please select your business type');
        return false;
      }
      if (!formData.businessLogoUrl) {
        setError('Please upload your business logo');
        return false;
      }
    }
    setError('');
    return true;
  };

  const nextStep = () => {
    const target = Math.min(4, step + 1);
    if (validateStep(target)) setStep(target);
  };

  const prevStep = () => {
    setError('');
    setStep((prev) => Math.max(1, prev - 1));
  };

  const steps = useMemo(
    () => [
      { id: 1, label: 'Verify' },
      { id: 2, label: 'Account' },
      { id: 3, label: 'Business' },
      { id: 4, label: 'Security' },
    ],
    []
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const normalizedBusinessName = formData.businessName.trim().replace(/\s+/g, ' ');

    if (formData.role === 'seller' && !formData.businessType) {
      setError('Please select your business type');
      return;
    }

    if (
      formData.role === 'seller' &&
      (normalizedBusinessName.length < 2 || normalizedBusinessName.length > 120)
    ) {
      setError('Business name must be 2-120 characters');
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
    const registerData = {
      fullName: formData.name.trim().replace(/\s+/g, ' '),
      email: formData.email.trim().toLowerCase(),
      phone: phoneValue,
      password: formData.password,
      role: formData.role,
      businessName: formData.role === 'seller' ? normalizedBusinessName : '',
      businessType: formData.role === 'seller' ? formData.businessType : formData.role === 'logistics' ? 'logistics' : 'consumer',
      businessLogoUrl: formData.role === 'seller' ? formData.businessLogoUrl : '',
    };

    const result = await register(registerData);
    if (result.success) {
      dispatch(resetRegistrationProgress());
      const requestedPlan = searchParams.get('plan');
      if (registerData.role === 'seller') {
        navigate(
          requestedPlan
            ? `/seller/subscription-plans?plan=${encodeURIComponent(requestedPlan)}`
            : '/seller/subscription-plans'
        );
      } else if (registerData.role === 'logistics') {
        navigate('/logistics/apply');
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
    {
      key: 'logistics',
      title: 'Logistics Provider',
      subtitle: 'Deliver orders and earn',
      icon: FaTruck,
      activeClass: 'border-[#3B82F6] bg-[#3B82F6]/5',
      iconClass: 'text-[#3B82F6]',
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

          <div className="flex items-center gap-2">
            {steps.map((item) => (
              <div key={item.id} className="flex-1">
                <div className={`h-2 rounded-full ${step >= item.id ? 'bg-[#F97316]' : 'bg-gray-200'}`} />
                <p className="mt-1 text-xs text-[#6B7280]">{item.label}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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

            {step === 1 && (
              <div className="space-y-4">
                <p className="text-sm font-semibold text-[#111827]">Verify your contact first</p>
                {!otpSent && (
                  <div className="rounded-lg border border-gray-200 p-3 space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">Contact</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleChange({ target: { name: 'verificationMethod', value: 'email' } })}
                        className={`py-2 rounded-lg border text-sm ${
                          formData.verificationMethod === 'email'
                            ? 'border-[#F97316] bg-[#F97316]/10 text-[#F97316]'
                            : 'border-gray-300 text-[#374151]'
                        }`}
                      >
                        Verify with Email
                      </button>
                      <button
                        type="button"
                        onClick={() => handleChange({ target: { name: 'verificationMethod', value: 'phone' } })}
                        className={`py-2 rounded-lg border text-sm ${
                          formData.verificationMethod === 'phone'
                            ? 'border-[#F97316] bg-[#F97316]/10 text-[#F97316]'
                            : 'border-gray-300 text-[#374151]'
                        }`}
                      >
                        Verify with Number
                      </button>
                    </div>

                    <div className="relative">
                      {formData.verificationMethod === 'email' ? (
                        <FaEnvelope className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280] text-sm" />
                      ) : (
                        <FaPhone className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280] text-sm" />
                      )}
                      <input
                        type={formData.verificationMethod === 'email' ? 'email' : 'tel'}
                        name="verificationValue"
                        required
                        value={formData.verificationValue}
                        onChange={handleChange}
                        className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F97316] text-[#111827]"
                        placeholder={formData.verificationMethod === 'email' ? 'Email address' : 'Phone number (2547XXXXXXXX)'}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleSendVerificationCode}
                      disabled={verificationLoading}
                      className="w-full py-2 rounded-lg border border-[#F97316] text-[#F97316] font-semibold hover:bg-[#F97316]/10 disabled:opacity-50"
                    >
                      {verificationLoading ? 'Sending...' : 'Send Verification Code'}
                    </button>
                  </div>
                )}

                {otpSent && (
                  <div className="rounded-lg border border-gray-200 p-3 space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">OTP Verification</p>
                    <input
                      type="text"
                      name="verificationCode"
                      value={formData.verificationCode}
                      onChange={handleChange}
                      className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F97316] text-[#111827]"
                      placeholder="Enter 6-digit code"
                    />
                    <button
                      type="button"
                      onClick={handleVerifyCode}
                      disabled={verificationLoading}
                      className="w-full py-2 rounded-lg bg-[#16A34A] text-white font-semibold hover:bg-[#15803D] disabled:opacity-50"
                    >
                      {verificationLoading ? 'Verifying...' : 'Verify Contact'}
                    </button>
                    <button
                      type="button"
                      onClick={handleResendCode}
                      disabled={verificationLoading || cooldownSeconds > 0}
                      className="w-full py-2 rounded-lg border border-gray-300 text-[#374151] font-semibold hover:bg-gray-100 disabled:opacity-50"
                    >
                      {cooldownSeconds > 0 ? `Resend in ${cooldownSeconds}s` : 'Resend Code'}
                    </button>
                  </div>
                )}

                {formData.isVerified && (
                  <p className="text-sm text-[#166534] flex items-center gap-2">
                    <FaCheckCircle /> Verified successfully
                  </p>
                )}
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div className="relative">
                  <FaUser className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280] text-sm" />
                  <input
                    type="text"
                    name="name"
                    required
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F97316] text-[#111827]"
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
                    className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F97316] text-[#111827]"
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
                    className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F97316] text-[#111827]"
                    placeholder="Phone number (2547XXXXXXXX)"
                  />
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                {formData.role === 'seller' ? (
                  <div className="space-y-3">
                    <div className="relative">
                      <FaStore className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280] text-sm" />
                      <input
                        type="text"
                        name="businessName"
                        required
                        minLength={2}
                        maxLength={120}
                        value={formData.businessName}
                        onChange={handleChange}
                        className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F97316] text-[#111827]"
                        placeholder="Business name customers will see"
                      />
                    </div>
                    <div className="relative">
                      <FaStore className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280] text-sm" />
                      <select
                        name="businessType"
                        value={formData.businessType}
                        onChange={handleChange}
                        required
                        className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F97316] text-[#111827] appearance-none"
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
                        required
                        onChange={handleBusinessLogoChange}
                        className="block w-full text-sm text-[#374151] file:mr-3 file:rounded-md file:border-0 file:bg-[#F97316]/10 file:px-3 file:py-2 file:text-[#F97316] file:font-semibold hover:file:bg-[#F97316]/20"
                      />
                      <p className="mt-2 text-xs text-[#6B7280]">Upload a clear logo (max 2MB).</p>
                      {businessLogoName && <p className="mt-1 text-xs text-[#16A34A]">Selected: {businessLogoName}</p>}
                    </div>
                  </div>
                ) : formData.role === 'logistics' ? (
                  <div className="p-3 bg-[#3B82F6]/5 border border-[#3B82F6]/20 rounded-lg text-sm text-[#1D4ED8]">
                    Logistics account selected. Continue to create your password, then complete your provider application.
                  </div>
                ) : (
                  <div className="p-3 bg-[#16A34A]/5 border border-[#16A34A]/20 rounded-lg text-sm text-[#166534]">
                    Buyer account selected. You can continue to create your password.
                  </div>
                )}
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4">
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
                    className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F97316] text-[#111827]"
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

                <div className="relative">
                  <FaLock className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280] text-sm" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    required
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F97316] text-[#111827]"
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
              </div>
            )}

            <div className="p-3 bg-linear-to-r from-[#FB923C]/5 to-[#F97316]/5 rounded-lg border border-[#FB923C]/20">
              <div className="flex items-center gap-2 mb-1">
                <FaBrain className="text-[#FB923C] text-xs" />
                <span className="text-xs font-semibold text-[#FB923C] uppercase tracking-wide">AI Powered Platform</span>
              </div>
              <p className="text-xs text-[#6B7280]">
                Get personalized recommendations, market insights, and smart alerts when you join Lango MarketPulse.
              </p>
            </div>

            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={prevStep}
                disabled={step === 1 || loading}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-lg border border-gray-300 text-[#374151] disabled:opacity-50"
              >
                <FaArrowLeft size={12} /> Back
              </button>

              {step < 4 ? (
                <button
                  type="button"
                  onClick={nextStep}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg text-white bg-[#F97316] hover:bg-[#F97316]/90"
                >
                  Continue <FaArrowRight size={12} />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg text-white bg-[#F97316] hover:bg-[#F97316]/90 disabled:opacity-50"
                >
                  {loading ? 'Creating account...' : formData.role === 'seller' ? 'Sign up as Seller' : formData.role === 'logistics' ? 'Sign up as Logistics' : 'Sign up as Buyer'}
                </button>
              )}
            </div>
          </form>

          <p className="text-center text-sm text-[#6B7280]">
            Already have an account?{' '}
            <Link
              to={`/login?role=${formData.role || 'buyer'}`}
              className="font-medium text-[#F97316] hover:text-[#F97316]/80 transition-colors"
              {...createPrefetchHandlers('/login')}
            >
              Sign in as {formData.role === 'seller' ? 'Seller' : formData.role === 'logistics' ? 'Logistics' : 'Buyer'}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
