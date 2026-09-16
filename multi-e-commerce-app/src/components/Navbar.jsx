import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { FaBriefcase, FaChevronDown, FaHome, FaInfoCircle, FaSearch, FaShoppingBag, FaShoppingCart, FaSignInAlt, FaStore, FaTh, FaTimes, FaTruck, FaUser, FaUserPlus } from 'react-icons/fa';
import { createPrefetchHandlers } from '../utils/prefetch';

const categoryOptions = [
  { label: 'All Categories', to: '/products' },
  { label: 'Electronics', to: '/products?category=electronics' },
  { label: 'Fashion', to: '/products?category=fashion' },
  { label: 'Home and Garden', to: '/products?category=home-garden' },
  { label: 'Beauty and Health', to: '/products?category=beauty-health' },
  { label: 'Sports and Outdoor', to: '/products?category=sports-outdoor' },
];

const currencyOptions = [
  { label: 'KSH', code: 'KSH' }
  
];

const partnerLinks = [
  {
    label: 'Sell on Lango Market Pulse',
    to: '/seller-plans',
    icon: FaStore,
    prefetch: true,
  },
  {
    label: 'Deliver on Lango Market Pulse',
    to: '/logistics-partners',
    icon: FaTruck,
  },
];

const Navbar = () => {
  const { user, isAuthenticated, isSeller, isAdmin, logout } = useAuth();
  const { getCartCount } = useCart();
  const [query, setQuery] = useState('');
  const [currency, setCurrency] = useState(currencyOptions[0]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const menuRef = useRef(null);

  const cartCount = getCartCount();
  const userRole = String(user?.role || '').toLowerCase();
  const isLogisticsUser = userRole === 'logistics';
  const isBuyerAccount = ['buyer', 'consumer'].includes(userRole) && !isSeller && !isAdmin && !isLogisticsUser;
  const accountLabel = user?.fullName || user?.name || 'My Account';
  const mobileQuickLinks = [
    { label: 'Home', to: '/', icon: FaHome },
    { label: 'Shop', to: '/products', icon: FaShoppingBag, prefetch: true },
    { label: 'Sell', to: '/seller-plans', icon: FaBriefcase, prefetch: true },
  ];

  useEffect(() => {
    const onClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpenDropdown(null);
      }
    };

    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const toggleDropdown = (name) => {
    setOpenDropdown((prev) => (prev === name ? null : name));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    navigate(`/products?search=${encodeURIComponent(trimmed)}`);
    setIsMobileMenuOpen(false);
  };

  const handleAuthAction = () => {
    if (isAuthenticated) {
      logout();
      navigate('/');
      return;
    }
    navigate('/login');
  };

  const closeAllMenus = () => {
    setIsMobileMenuOpen(false);
    setOpenDropdown(null);
  };

  return (
    <header ref={menuRef} className="fixed inset-x-0 top-0 z-50 w-full pt-[env(safe-area-inset-top)] shadow-sm">
      <div className="bg-[#F2871A] text-white">
        <div className="mx-auto flex max-w-[1366px] items-center gap-3 px-3 py-2 text-sm md:flex-nowrap">
          <Link to="/" className="flex min-w-0 items-center gap-2 hover:opacity-90" onClick={closeAllMenus}>
            
            <span className="truncate rounded-sm bg-[#0B2D55] px-2 py-1 text-xs font-extrabold leading-none tracking-wide min-[380px]:text-sm sm:text-lg">
              <img src="/marketpulse-logo.png" alt="MarketPulse Logo" className="h-4 w-4 sm:h-5 sm:w-5 inline-block mr-1" />
              LANGO <span className="text-[#F9B233]">MARKET PULSE</span>
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-2 lg:gap-3 ml-auto flex-wrap lg:flex-nowrap">
            {isAuthenticated ? (
              <div
                className="relative"
                onMouseEnter={() => setOpenDropdown('account')}
                onMouseLeave={() => setOpenDropdown(null)}
              >
                <button
                  onClick={() => toggleDropdown('account')}
                  className="bg-[#E97A12] px-3 py-2 rounded flex items-center gap-2 font-semibold"
                  aria-expanded={openDropdown === 'account'}
                  aria-haspopup="menu"
                >
                  <FaUser />
                  <span className="max-w-32 truncate">{accountLabel}</span>
                  <FaChevronDown size={12} />
                </button>

                {openDropdown === 'account' && (
                  <div className="absolute right-0 mt-2 w-56 bg-white text-[#111827] rounded-lg shadow-lg border border-gray-200 py-1">
                    <Link to="/profile" className="block px-4 py-2 hover:bg-gray-100" onClick={closeAllMenus}>Profile</Link>
                    {isLogisticsUser && (
                      <Link to="/logistics/status" className="block px-4 py-2 hover:bg-gray-100" onClick={closeAllMenus}>Logistics Status</Link>
                    )}
                    {isSeller && (
                      <Link to="/seller" className="block px-4 py-2 hover:bg-gray-100" onClick={closeAllMenus} {...createPrefetchHandlers('/seller')}>Seller Dashboard</Link>
                    )}
                    {isAdmin && (
                      <Link to="/admin/dashboard" className="block px-4 py-2 hover:bg-gray-100" onClick={closeAllMenus} {...createPrefetchHandlers('/admin/dashboard')}>Admin Dashboard</Link>
                    )}
                    <Link to="/buyer/orders" className="block px-4 py-2 hover:bg-gray-100" onClick={closeAllMenus}>Orders</Link>
                    <Link to="/notifications/preferences" className="block px-4 py-2 hover:bg-gray-100" onClick={closeAllMenus}>Notification Preferences</Link>
                    <Link to="/wishlist" className="block px-4 py-2 hover:bg-gray-100" onClick={closeAllMenus}>Wishlist</Link>
                    <button onClick={handleAuthAction} className="w-full text-left px-4 py-2 hover:bg-gray-100">Sign out</button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="flex items-center gap-2 rounded px-3 py-2 font-semibold hover:bg-[#E97A12]"
                  onClick={closeAllMenus}
                  {...createPrefetchHandlers('/login')}
                >
                  <FaSignInAlt size={14} />
                  <span>Sign in</span>
                </Link>
                <Link
                  to="/register"
                  className="flex items-center gap-2 rounded bg-[#0B2D55] px-3 py-2 font-semibold text-white hover:bg-[#123E72]"
                  onClick={closeAllMenus}
                  {...createPrefetchHandlers('/register')}
                >
                  <FaUserPlus size={14} />
                  <span>Create account</span>
                </Link>
              </div>
            )}

            <Link to="/products" className="font-semibold hover:opacity-90" {...createPrefetchHandlers('/products')}>Shop</Link>
            {isAuthenticated && !isBuyerAccount && (
              <Link to="/mizigo-engine" className="font-semibold hover:opacity-90" onClick={closeAllMenus}>
                Plan 4 Mizigo
              </Link>
            )}

            <div
              className="relative"
              onMouseEnter={() => setOpenDropdown('category')}
              onMouseLeave={() => setOpenDropdown(null)}
            >
              <button
                onClick={() => toggleDropdown('category')}
                className="bg-[#E97A12] px-3 py-2 rounded flex items-center gap-2"
              >
                <span>All</span>
                <FaChevronDown size={12} />
              </button>
              {openDropdown === 'category' && (
                <div className="absolute right-0 mt-2 w-56 bg-white text-[#111827] rounded-lg shadow-lg border border-gray-200 py-1">
                  {categoryOptions.map((option) => (
                    <Link key={option.label} to={option.to} className="block px-4 py-2 hover:bg-gray-100" onClick={closeAllMenus}>
                      {option.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div
              className="relative"
              onMouseEnter={() => setOpenDropdown('currency')}
              onMouseLeave={() => setOpenDropdown(null)}
            >
              <button
                onClick={() => toggleDropdown('currency')}
                className="bg-[#E97A12] px-3 py-2 rounded flex items-center gap-2"
              >
                <span>{currency.label}</span>
                <FaChevronDown size={12} />
              </button>
              {openDropdown === 'currency' && (
                <div className="absolute right-0 mt-2 w-40 bg-white text-[#111827] rounded-lg shadow-lg border border-gray-200 py-1">
                  {currencyOptions.map((option) => (
                    <button
                      key={option.code}
                      onClick={() => {
                        setCurrency(option);
                        setOpenDropdown(null);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-gray-100"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Link to="/cart" className="relative hover:opacity-90" onClick={closeAllMenus}>
              <FaShoppingCart size={20} />
              {cartCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-[#111827] text-white text-[10px] h-4 w-4 rounded-full flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </Link>
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-1.5 md:hidden">
            {isAuthenticated ? (
              <>
                <Link
                  to="/profile"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/70 bg-[#0B2D55] text-white shadow-sm"
                  onClick={closeAllMenus}
                  aria-label="Profile"
                >
                  <FaUser size={15} />
                </Link>
              </>
            ) : (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    toggleDropdown('authMobileTop');
                  }}
                  className="inline-flex h-9 items-center gap-1 rounded-full border border-white/70 bg-[#0B2D55] px-2.5 text-white shadow-sm"
                  aria-expanded={openDropdown === 'authMobileTop'}
                  aria-haspopup="menu"
                  aria-label="Account actions"
                >
                  <FaUser size={14} />
                  <FaChevronDown size={10} />
                </button>
                {openDropdown === 'authMobileTop' && (
                  <div className="absolute right-0 top-11 z-50 w-44 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 text-[#111827] shadow-xl">
                    <Link
                      to="/login"
                      className="flex items-center gap-2 px-3 py-2 text-sm font-semibold hover:bg-gray-100"
                      onClick={closeAllMenus}
                      {...createPrefetchHandlers('/login')}
                    >
                      <FaSignInAlt className="text-[#F2871A]" size={13} />
                      <span>Login</span>
                    </Link>
                    <Link
                      to="/register"
                      className="flex items-center gap-2 px-3 py-2 text-sm font-semibold hover:bg-gray-100"
                      onClick={closeAllMenus}
                      {...createPrefetchHandlers('/register')}
                    >
                      <FaUserPlus className="text-[#F2871A]" size={13} />
                      <span>Register</span>
                    </Link>
                  </div>
                )}
              </div>
            )}
            <Link to="/cart" className="relative inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#E97A12] text-white shadow-sm" onClick={closeAllMenus} aria-label="Cart">
              <FaShoppingCart size={17} />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#0B2D55] text-[10px] text-white">
                  {cartCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      </div>

      <div className="bg-[#2F4258] px-3 py-3">
        <div className="mx-auto flex max-w-[1366px] flex-col gap-2 lg:flex-row lg:items-center lg:justify-center">
          <Link
            to="/about"
            className="hidden h-10 items-center justify-center gap-2 rounded-full border border-white/20 bg-white px-4 text-sm font-extrabold text-[#0B2D55] shadow-sm transition hover:bg-[#FFF4E7] hover:text-[#E97A12] md:inline-flex"
            onClick={closeAllMenus}
            {...createPrefetchHandlers('/about')}
          >
            <FaInfoCircle className="shrink-0 text-[#F2871A]" size={15} />
            <span>About</span>
          </Link>
          <form onSubmit={handleSubmit} className="flex h-11 w-full items-center rounded-full bg-white pl-4 pr-2 shadow-sm lg:max-w-md xl:max-w-xl">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm text-gray-700 outline-none"
              placeholder="Search products..."
              type="text"
            />
            <button type="submit" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F2871A] text-white">
              <FaSearch size={14} />
            </button>
          </form>
          <nav className="hidden grid-cols-2 gap-2 md:grid lg:flex lg:shrink-0" aria-label="Partner actions">
            {partnerLinks.map(({ label, to, icon: Icon, prefetch }) => (
              <Link
                key={to}
                to={to}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-white/20 bg-white px-3 text-xs font-extrabold text-[#0B2D55] shadow-sm transition hover:bg-[#FFF4E7] hover:text-[#E97A12] xl:px-4 xl:text-sm"
                onClick={closeAllMenus}
                {...(prefetch ? createPrefetchHandlers(to) : {})}
              >
                <Icon className="shrink-0 text-[#F2871A]" size={15} />
                <span className="whitespace-nowrap">{label}</span>
              </Link>
            ))}
          </nav>
        </div>
      </div>

      {isMobileMenuOpen && (
        <div className="max-h-[calc(100dvh-112px)] overflow-y-auto border-t border-[#E97A12] bg-[#F2871A] text-white md:hidden">
          <div className="space-y-3 px-4 py-3">
            {isAuthenticated && (
              <>
                <button onClick={() => toggleDropdown('accountMobile')} className="flex w-full items-center justify-between rounded bg-[#E97A12] px-3 py-2 font-semibold">
                  <span className="truncate">{accountLabel}</span>
                  <FaChevronDown size={12} />
                </button>
                {openDropdown === 'accountMobile' && (
                  <div className="bg-white text-[#111827] rounded-lg py-1">
                    <Link to="/profile" className="block px-4 py-2 hover:bg-gray-100" onClick={closeAllMenus}>Profile</Link>
                    {isLogisticsUser && (
                      <Link to="/logistics/status" className="block px-4 py-2 hover:bg-gray-100" onClick={closeAllMenus}>Logistics Status</Link>
                    )}
                    {isSeller && (
                      <Link to="/seller" className="block px-4 py-2 hover:bg-gray-100" onClick={closeAllMenus} {...createPrefetchHandlers('/seller')}>Seller Dashboard</Link>
                    )}
                    {isAdmin && (
                      <Link to="/admin/dashboard" className="block px-4 py-2 hover:bg-gray-100" onClick={closeAllMenus} {...createPrefetchHandlers('/admin/dashboard')}>Admin Dashboard</Link>
                    )}
                    <Link to="/buyer/orders" className="block px-4 py-2 hover:bg-gray-100" onClick={closeAllMenus}>Orders</Link>
                    <Link to="/notifications/preferences" className="block px-4 py-2 hover:bg-gray-100" onClick={closeAllMenus}>Notification Preferences</Link>
                    <Link to="/wishlist" className="block px-4 py-2 hover:bg-gray-100" onClick={closeAllMenus}>Wishlist</Link>
                    <button onClick={handleAuthAction} className="w-full text-left px-4 py-2 hover:bg-gray-100">Sign out</button>
                  </div>
                )}
              </>
            )}

            <Link to="/about" className="block font-semibold" onClick={closeAllMenus} {...createPrefetchHandlers('/about')}>About</Link>
            {isAuthenticated && !isBuyerAccount && (
              <Link to="/mizigo-engine" className="block font-semibold" onClick={closeAllMenus}>
                Plan 4 Mizigo
              </Link>
            )}

            <div className="grid gap-2">
              {partnerLinks.map(({ label, to, icon: Icon, prefetch }) => (
                <Link
                  key={to}
                  to={to}
                  className="flex items-center gap-2 rounded bg-white px-3 py-2 font-semibold text-[#0B2D55]"
                  onClick={closeAllMenus}
                  {...(prefetch ? createPrefetchHandlers(to) : {})}
                >
                  <Icon className="text-[#F2871A]" size={14} />
                  <span>{label}</span>
                </Link>
              ))}
            </div>

            <button onClick={() => toggleDropdown('categoryMobile')} className="w-full bg-[#E97A12] px-3 py-2 rounded flex items-center justify-between">
              <span>Categories</span>
              <FaChevronDown size={12} />
            </button>
            {openDropdown === 'categoryMobile' && (
              <div className="bg-white text-[#111827] rounded-lg py-1">
                {categoryOptions.map((option) => (
                  <Link key={option.label} to={option.to} className="block px-4 py-2 hover:bg-gray-100" onClick={closeAllMenus}>
                    {option.label}
                  </Link>
                ))}
              </div>
            )}

            <button onClick={() => toggleDropdown('currencyMobile')} className="w-full bg-[#E97A12] px-3 py-2 rounded flex items-center justify-between">
              <span>{currency.label}</span>
              <FaChevronDown size={12} />
            </button>
            {openDropdown === 'currencyMobile' && (
              <div className="bg-white text-[#111827] rounded-lg py-1">
                {currencyOptions.map((option) => (
                  <button
                    key={option.code}
                    onClick={() => {
                      setCurrency(option);
                      setOpenDropdown(null);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-gray-100"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}

          </div>
        </div>
      )}
      <nav className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-4 border-t-2 border-[#F2871A] bg-[#2F4258] px-1 pb-[calc(env(safe-area-inset-bottom)+0.2rem)] pt-1.5 shadow-[0_-10px_28px_rgba(11,45,85,0.18)] md:hidden" aria-label="Mobile quick navigation">
        {mobileQuickLinks.map(({ label, to, icon: Icon, prefetch }) => {
          const isActive = location.pathname === to || (to === '/products' && location.pathname.startsWith('/products')) || (to === '/seller-plans' && location.pathname.startsWith('/seller-plans'));
          return (
            <Link
              key={to}
              to={to}
              className={`relative flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-sm text-[10px] font-semibold transition ${
                isActive ? 'text-white' : 'text-white/55 hover:text-white'
              }`}
              onClick={closeAllMenus}
              {...(prefetch ? createPrefetchHandlers(to) : {})}
            >
              <Icon size={20} />
              <span className="max-w-full truncate leading-none">{label}</span>
              <span className={`absolute bottom-0 h-1 w-5 rounded-full bg-[#F2871A] transition ${isActive ? 'opacity-100' : 'opacity-0'}`} />
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => {
            setOpenDropdown(null);
            setIsMobileMenuOpen((prev) => !prev);
          }}
          className={`relative flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-sm text-[10px] font-semibold transition ${
            isMobileMenuOpen ? 'text-white' : 'text-white/55 hover:text-white'
          }`}
          aria-expanded={isMobileMenuOpen}
          aria-label={isMobileMenuOpen ? 'Close mobile menu' : 'Open mobile menu'}
        >
          {isMobileMenuOpen ? <FaTimes size={20} /> : <FaTh size={20} />}
          <span className="leading-none">More</span>
          <span className={`absolute bottom-0 h-1 w-5 rounded-full bg-[#F2871A] transition ${isMobileMenuOpen ? 'opacity-100' : 'opacity-0'}`} />
        </button>
      </nav>
    </header>
  );
};

export default Navbar;
