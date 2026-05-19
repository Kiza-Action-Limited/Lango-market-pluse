import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { FaEnvelope, FaLock, FaBrain, FaArrowRight, FaEye, FaEyeSlash, FaUser, FaStore } from 'react-icons/fa';
import marketPulseLogo from '../assets/Marketpulse-logo.png';
import { createPrefetchHandlers } from '../utils/prefetch';

const ADMIN_LOGIN_EMAIL = String(import.meta.env.VITE_ADMIN_LOGIN_EMAIL || 'admin@langomarket.com').toLowerCase();

const Login = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [accountType, setAccountType] = useState('buyer');
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const isAdminLogin = location.pathname.startsWith('/admin');

  useEffect(() => {
    if (isAdminLogin) {
      setAccountType('admin');
      return;
    }

    const roleParam = searchParams.get('role');
    if (roleParam === 'seller' || roleParam === 'buyer') {
      setAccountType(roleParam);
    }
  }, [isAdminLogin, searchParams]);

  const selectAccountType = (nextType) => {
    setAccountType(nextType);
    const params = new URLSearchParams(searchParams);
    params.set('role', nextType);
    setSearchParams(params, { replace: true });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanIdentifier = identifier.trim();
    const cleanPassword = password;
    if (!cleanIdentifier || !cleanPassword) return;

    if (cleanIdentifier.toLowerCase() === ADMIN_LOGIN_EMAIL) {
      toast.error('Unauthorised credential!.');
      return;
    }

    setLoading(true);

    const result = await login(cleanIdentifier, cleanPassword);
    if (result.success) {
      const resolvedRole = String(result?.user?.role || '').toLowerCase();
      const resolvedBusinessType = String(result?.user?.businessType || '').toLowerCase();
      const isAdminUser = resolvedRole === 'admin';
      const isSellerUser =
        resolvedRole === 'seller' ||
        ['wholesaler', 'retailer', 'farmer', 'manufacturer'].includes(resolvedRole) ||
        ['wholesaler', 'retailer', 'farmer', 'manufacturer'].includes(resolvedBusinessType);

      if (isAdminUser) {
        navigate('/admin');
      } else if (isSellerUser) {
        navigate('/seller');
      } else {
        navigate('/');
      }
    }

    setLoading(false);
  };

  const cards = [
    {
      key: 'buyer',
      title: 'Buyer Sign In',
      subtitle: 'Shop and place orders quickly',
      icon: FaUser,
      activeClass: 'border-[#16A34A] bg-[#16A34A]/5',
      iconClass: 'text-[#16A34A]',
    },
    {
      key: 'seller',
      title: 'Seller Sign In',
      subtitle: 'Manage products and sales',
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
            Smart trade connections and intelligence for every business.
          </p>
        </div>

        <div className="w-full max-w-xl mx-auto space-y-6">
          <div className="text-center lg:text-left">
            <h2 className="text-3xl font-extrabold text-[#F97316]">
              {isAdminLogin ? 'Admin sign in' : 'Sign in to your account'}
            </h2>
            <p className="mt-2 text-sm text-[#6B7280] italic">Lango Lako la Biashara Smart</p>
          </div>

          {!isAdminLogin && <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {cards.map((card) => {
              const Icon = card.icon;
              const isActive = accountType === card.key;
              return (
                <button
                  key={card.key}
                  type="button"
                  onClick={() => selectAccountType(card.key)}
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
          </div>}

          <form className="space-y-4 rounded-xl border border-gray-200 bg-white p-5" onSubmit={handleSubmit}>
            <p className="text-sm font-semibold text-[#111827]">
              {accountType === 'admin' ? 'Admin credentials' : accountType === 'seller' ? 'Seller credentials' : 'Buyer credentials'}
            </p>

            <div className="relative">
              <FaEnvelope className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280] text-sm" />
              <input
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="block w-full pl-10 pr-3 py-3 border border-gray-300 text-[#111827] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F97316] focus:border-transparent sm:text-sm"
                placeholder="Phone (2547...) or email"
              />
            </div>

            <div className="relative">
              <FaLock className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280] text-sm" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full pl-10 pr-10 py-3 border border-gray-300 text-[#111827] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F97316] focus:border-transparent sm:text-sm"
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
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 text-[#F97316] focus:ring-[#F97316] border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-[#6B7280]">Remember me</span>
              </label>

              <Link to="/forgot-password" className="text-sm font-medium text-[#FB923C] hover:text-[#F97316] transition-colors">
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center gap-2 py-3 px-4 text-sm font-semibold rounded-lg text-white bg-[#F97316] hover:bg-[#F97316]/90 disabled:opacity-50 transition-colors"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Signing in...
                </>
              ) : (
                <>
                  {accountType === 'admin' ? 'Sign in as Admin' : accountType === 'seller' ? 'Sign in as Seller' : 'Sign in as Buyer'}
                  <FaArrowRight size={14} />
                </>
              )}
            </button>
          </form>

          <div className="p-4 bg-linear-to-r from-[#FB923C]/5 to-[#F97316]/5 rounded-lg border border-[#FB923C]/20">
            <div className="flex items-center gap-2 mb-2">
              <FaBrain className="text-[#FB923C] text-sm" />
              <span className="text-xs font-semibold text-[#FB923C] uppercase tracking-wide">AI Intelligence</span>
            </div>
            <p className="text-xs text-[#6B7280]">
              Your Trade and Intelligence OS with personalized recommendations and market insights.
            </p>
          </div>

          {!isAdminLogin && <p className="text-center text-sm text-[#6B7280]">
            Do not have an account?{' '}
            <Link
              to={`/register?role=${accountType}`}
              className="font-medium text-[#F97316] hover:text-[#F97316]/80 transition-colors"
              {...createPrefetchHandlers('/register')}
            >
              Create {accountType === 'seller' ? 'Seller' : 'Buyer'} account
            </Link>
          </p>}
        </div>
      </div>
    </div>
  );
};

export default Login;
