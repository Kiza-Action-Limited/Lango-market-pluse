import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import {
  FaArrowRight,
  FaBrain,
  FaEnvelope,
  FaEye,
  FaEyeSlash,
  FaLock,
  FaStore,
  FaTruck,
  FaUser,
} from 'react-icons/fa';
import buyerImage from '../assets/images/240_F_725819555_bH4Tv8G1KWOdwC60nwFHDZtGAmTHa2V8.jpg';
import sellerImage from '../assets/images/240_F_736429436_NpVWpeNSbzAx35soBFulMc5N4MUO30NV.jpg';
import logisticsImage from '../assets/images/240_F_1774361843_6YgNSKGVwKOPZSrhZ4P326nfhq8atTuG.jpg';
import platformImage from '../assets/images/1000_F_1388403127_VLbGx3CB7xsMA56fZaMgN2TdpDTVY556.webp';
import { createPrefetchHandlers } from '../utils/prefetch';
import { isBuyerUser, isLogisticsUser, isSellerUser } from '../utils/userCategory';

const ADMIN_LOGIN_EMAIL = String(import.meta.env.VITE_ADMIN_LOGIN_EMAIL || 'admin@langomarket.com').toLowerCase();

const INITIAL_CREDENTIALS = {
  buyer: { identifier: '', password: '', remember: false },
  seller: { identifier: '', password: '', remember: false },
  logistics: { identifier: '', password: '', remember: false },
  admin: { identifier: '', password: '', remember: false },
};

const portalConfig = {
  buyer: {
    title: 'Buyer Sign In',
    credentialsLabel: 'Buyer credentials',
    subtitle: 'Shop and place orders quickly',
    helper: 'Browse trusted products, save favorites, and track purchases from your buyer account.',
    icon: FaUser,
    image: buyerImage,
    color: '#16A34A',
    buttonClass: 'bg-[#16A34A] hover:bg-[#15803D]',
    registerLabel: 'Create Buyer account',
  },
  seller: {
    title: 'Seller Sign In',
    credentialsLabel: 'Seller credentials',
    subtitle: 'Manage products and sales',
    helper: 'Control your storefront, stock, orders, wallet, and business growth tools.',
    icon: FaStore,
    image: sellerImage,
    color: '#F97316',
    buttonClass: 'bg-[#F97316] hover:bg-[#EA580C]',
    registerLabel: 'Create Seller account',
  },
  logistics: {
    title: 'Logistics Provider',
    credentialsLabel: 'Logistics credentials',
    subtitle: 'Deliver orders and earn',
    helper: 'Manage trips, delivery scans, routes, live location updates, and logistics payouts.',
    icon: FaTruck,
    image: logisticsImage,
    color: '#0B2D55',
    buttonClass: 'bg-[#0B2D55] hover:bg-[#071F3D]',
    registerLabel: 'Create Logistics account',
  },
};

const authPortalRoles = ['buyer', 'seller', 'logistics'];
const getForgotPasswordPath = (role) => `/forgot-password?role=${role}`;

const Login = () => {
  const [credentials, setCredentials] = useState(INITIAL_CREDENTIALS);
  const [showPassword, setShowPassword] = useState({ buyer: false, seller: false, logistics: false, admin: false });
  const [loadingRole, setLoadingRole] = useState(null);
  const [accountType, setAccountType] = useState('buyer');
  const { login, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const isAdminLogin = location.pathname.startsWith('/admin');
  const isSellerLogin = location.pathname.startsWith('/seller/login');
  const isBuyerLogin = location.pathname.startsWith('/buyer/login');
  const isLogisticsLogin = location.pathname.startsWith('/logistics/login');
  const fromPath = location.state?.from?.pathname;

  useEffect(() => {
    if (isAdminLogin) {
      setAccountType('admin');
      return;
    }

    if (fromPath?.startsWith('/logistics')) {
      setAccountType('logistics');
      return;
    }

    if (isSellerLogin) {
      setAccountType('seller');
      return;
    }

    if (isBuyerLogin) {
      setAccountType('buyer');
      return;
    }

    if (isLogisticsLogin) {
      setAccountType('logistics');
      return;
    }

    const roleParam = searchParams.get('role');
    if (roleParam === 'seller' || roleParam === 'buyer' || roleParam === 'logistics') {
      setAccountType(roleParam);
    }
  }, [fromPath, isAdminLogin, isBuyerLogin, isLogisticsLogin, isSellerLogin, searchParams]);

  const activeRole = isAdminLogin || accountType === 'admin' ? 'admin' : accountType;
  const activePortalConfig = activeRole === 'admin'
    ? {
        title: 'Admin Sign In',
        subtitle: 'Secure platform control',
        helper: 'Access administration tools, marketplace controls, reports, and trust operations.',
        image: platformImage,
      }
    : portalConfig[activeRole] || portalConfig.buyer;

  const authFormGridClass = useMemo(() => (
    isAdminLogin ? 'mx-auto max-w-xl' : 'grid gap-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-start'
  ), [isAdminLogin]);

  const updateCredential = (role, field, value) => {
    setCredentials((current) => ({
      ...current,
      [role]: {
        ...current[role],
        [field]: value,
      },
    }));
  };

  const syncSelectedRole = (nextType) => {
    setAccountType(nextType);

    if (nextType === 'admin' || isAdminLogin) return;

    if (isSellerLogin || isBuyerLogin || isLogisticsLogin) {
      navigate(`/login?role=${nextType}`, { replace: true });
      return;
    }

    const params = new URLSearchParams(searchParams);
    params.set('role', nextType);
    setSearchParams(params, { replace: true });
  };

  const handleSubmit = async (event, role) => {
    event.preventDefault();
    syncSelectedRole(role);

    const cleanIdentifier = credentials[role].identifier.trim();
    const cleanPassword = credentials[role].password;
    if (!cleanIdentifier || !cleanPassword) return;

    if (cleanIdentifier.toLowerCase() === ADMIN_LOGIN_EMAIL && role !== 'admin') {
      toast.error('Invalid credential!');
      return;
    }

    setLoadingRole(role);

    const result = await login(cleanIdentifier, cleanPassword, { silentSuccess: true });
    if (result.success) {
      const resolvedRole = String(result?.user?.role || '').toLowerCase();
      const isAdminUser = resolvedRole === 'admin';
      const isBuyerAccount = isBuyerUser(result.user);
      const isLogisticsAccount = isLogisticsUser(result.user);
      const isSellerAccount = !isAdminUser && !isLogisticsAccount && isSellerUser(result.user);

      const portalAllowed =
        (role === 'buyer' && isBuyerAccount) ||
        (role === 'seller' && isSellerAccount) ||
        (role === 'logistics' && isLogisticsAccount) ||
        (role === 'admin' && isAdminUser);

      if (!portalAllowed) {
        logout({ silent: true });
        toast.error('Invalid credential!');
        setLoadingRole(null);
        return;
      }

      const defaultPath = result.redirectTo || (isAdminUser ? '/admin/dashboard' : isLogisticsAccount ? '/logistics/dashboard' : isSellerAccount ? '/seller' : '/');
      const blockedReturnPaths = ['/login', '/buyer/login', '/seller/login', '/logistics/login', '/register'];
      const nextPath = fromPath && !blockedReturnPaths.includes(fromPath) && !isLogisticsAccount
        ? fromPath
        : defaultPath;
      toast.success('Login successful! Welcome back!');
      navigate(nextPath, { replace: true });
    }

    setLoadingRole(null);
  };

  const renderLoginForm = (role) => {
    const config = role === 'admin'
      ? {
          title: 'Admin Sign In',
          credentialsLabel: 'Admin credentials',
          subtitle: 'Secure platform control',
          helper: 'Access administration tools, marketplace controls, reports, and trust operations.',
          icon: FaLock,
          image: platformImage,
          color: '#111827',
          buttonClass: 'bg-[#111827] hover:bg-black',
        }
      : portalConfig[role];
    const Icon = config.icon;
    const isLoading = loadingRole === role;
    const isSelected = accountType === role;

    return (
      <form
        key={role}
        className={`group overflow-hidden rounded-lg border bg-white shadow-lg transition hover:-translate-y-1 hover:shadow-xl ${
          isSelected ? 'border-[#F97316]/50 ring-2 ring-[#F97316]/10' : 'border-white/20'
        }`}
        onSubmit={(event) => handleSubmit(event, role)}
      >
        <div className="relative min-h-44 overflow-hidden">
          <img src={config.image} alt={config.title} className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105" />
          <div className="absolute inset-0 bg-[#0B1220]/68" />
          <div className="relative flex min-h-44 flex-col justify-between p-5 text-white">
            <div className="flex items-start justify-between gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-md bg-white text-xl" style={{ color: config.color }}>
                <Icon />
              </span>
              <span className="rounded-md bg-white/15 px-2.5 py-1 text-xs font-semibold backdrop-blur">
                {config.subtitle}
              </span>
            </div>
            <div>
              <h2 className="text-2xl font-bold">{config.title}</h2>
              <p className="mt-2 text-sm leading-6 text-gray-100">{config.helper}</p>
            </div>
          </div>
        </div>

        <div className="p-5">
          <p className="text-sm font-semibold text-[#111827]">{config.credentialsLabel}</p>

          <div className="mt-4 space-y-3">
            <div className="relative">
              <FaEnvelope className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280] text-sm" />
              <input
                type="text"
                required
                value={credentials[role].identifier}
                onFocus={() => setAccountType(role)}
                onChange={(event) => updateCredential(role, 'identifier', event.target.value)}
                className="block w-full rounded-md border border-gray-300 py-3 pl-10 pr-3 text-[#111827] outline-none transition focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 sm:text-sm"
                placeholder="Phone (2547...) or email"
              />
            </div>

            <div className="relative">
              <FaLock className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280] text-sm" />
              <input
                type={showPassword[role] ? 'text' : 'password'}
                required
                value={credentials[role].password}
                onFocus={() => setAccountType(role)}
                onChange={(event) => updateCredential(role, 'password', event.target.value)}
                className="block w-full rounded-md border border-gray-300 py-3 pl-10 pr-10 text-[#111827] outline-none transition focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20 sm:text-sm"
                placeholder="Password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => ({ ...current, [role]: !current[role] }))}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#F97316]"
                aria-label={showPassword[role] ? 'Hide password' : 'Show password'}
              >
                {showPassword[role] ? <FaEyeSlash size={14} /> : <FaEye size={14} />}
              </button>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <label className="flex items-center">
              <input
                name={`${role}-remember-me`}
                type="checkbox"
                checked={credentials[role].remember}
                onChange={(event) => updateCredential(role, 'remember', event.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-[#F97316] focus:ring-[#F97316]"
              />
              <span className="ml-2 text-sm text-[#6B7280]">Remember me</span>
            </label>

            <Link to={getForgotPasswordPath(role)} className="text-sm font-medium text-[#F97316] transition hover:text-[#EA580C]">
              Forgot password?
            </Link>
          </div>

          <button
            type="submit"
            disabled={Boolean(loadingRole)}
            className={`mt-5 flex w-full items-center justify-center gap-2 rounded-md px-4 py-3 text-sm font-semibold text-white transition disabled:opacity-50 ${config.buttonClass}`}
          >
            {isLoading ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Signing in...
              </>
            ) : (
              <>
                Sign in as {role === 'logistics' ? 'Logistics' : role === 'admin' ? 'Admin' : role === 'seller' ? 'Seller' : 'Buyer'}
                <FaArrowRight size={14} />
              </>
            )}
          </button>

          {role !== 'admin' && (
            <p className="mt-4 text-center text-sm text-[#6B7280]">
              Do not have an account?{' '}
              <Link
                to={`/register?role=${role}`}
                className="font-semibold text-[#F97316] transition hover:text-[#EA580C]"
                {...createPrefetchHandlers('/register')}
              >
                {config.registerLabel}
              </Link>
            </p>
          )}
        </div>
      </form>
    );
  };

  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-[#0B1220] px-4 py-8 sm:px-6 lg:px-8">
      <img src={activePortalConfig.image} alt={activePortalConfig.title} className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-[#0B1220]/82" />
      <div className="relative mx-auto max-w-screen-2xl">
        <div className="mb-8 grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
          <div className="text-white">
            <p className="max-w-2xl text-3xl font-bold leading-tight sm:text-4xl">
              Smart trade connections and intelligence for every business.
            </p>
            {!isAdminLogin && (
              <div className="mt-6 flex flex-wrap gap-2">
                {authPortalRoles.map((role) => {
                  const config = portalConfig[role];
                  const Icon = config.icon;
                  const selected = activeRole === role;
                  return (
                    <Link
                      key={role}
                      to={`/login?role=${role}`}
                      onClick={() => setAccountType(role)}
                      className={`inline-flex min-h-11 items-center gap-2 rounded-md border px-3 text-sm font-semibold transition ${
                        selected
                          ? 'border-[#FDBA74] bg-[#F97316] text-white'
                          : 'border-white/20 bg-white/10 text-gray-100 hover:bg-white/20'
                      }`}
                    >
                      <Icon size={13} />
                      {config.title}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-white/10 bg-white/10 p-5 text-white shadow-xl backdrop-blur">
            <div className="flex items-center gap-2">
              <FaBrain className="text-[#FDBA74]" />
              <span className="text-xs font-semibold uppercase tracking-wide text-[#FDBA74]">AI Intelligence</span>
            </div>
            <p className="mt-2 text-sm leading-6 text-gray-100">
              Your Trade and Intelligence OS with personalized recommendations, marketplace visibility, and operational insights.
            </p>
          </div>
        </div>

        <div className={authFormGridClass}>
          {!isAdminLogin && (
            <aside className="rounded-lg border border-white/10 bg-white/10 p-5 text-white shadow-xl backdrop-blur">
              <div className="overflow-hidden rounded-md border border-white/10">
                <img src={activePortalConfig.image} alt={activePortalConfig.title} className="h-64 w-full object-cover" />
              </div>
              <p className="mt-5 text-sm font-semibold uppercase tracking-wide text-[#FDBA74]">Selected portal</p>
              <h2 className="mt-2 text-3xl font-bold">{activePortalConfig.title}</h2>
              <p className="mt-3 text-sm leading-6 text-gray-200">{activePortalConfig.helper}</p>
              <div className="mt-5 grid gap-2">
                {authPortalRoles.map((role) => {
                  const config = portalConfig[role];
                  const Icon = config.icon;
                  const selected = activeRole === role;
                  return (
                    <Link
                      key={`side-${role}`}
                      to={`/login?role=${role}`}
                      onClick={() => setAccountType(role)}
                      className={`flex min-h-12 items-center justify-between rounded-md border px-3 text-sm font-semibold transition ${
                        selected
                          ? 'border-[#FDBA74] bg-white text-[#111827]'
                          : 'border-white/10 bg-white/5 text-white hover:bg-white/10'
                      }`}
                    >
                      <span className="inline-flex items-center gap-2">
                        <Icon size={14} />
                        {config.title}
                      </span>
                      <FaArrowRight size={12} />
                    </Link>
                  );
                })}
              </div>
            </aside>
          )}
          <div className={isAdminLogin ? '' : 'mx-auto w-full max-w-xl'}>
            {renderLoginForm(activeRole)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
