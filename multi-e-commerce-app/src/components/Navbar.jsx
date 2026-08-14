import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { FaBars, FaChevronDown, FaSearch, FaShoppingCart, FaSignInAlt, FaTimes, FaUser, FaUserPlus } from 'react-icons/fa';
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

const Navbar = () => {
  const { user, isAuthenticated, isSeller, isAdmin, logout } = useAuth();
  const { getCartCount } = useCart();
  const [query, setQuery] = useState('');
  const [currency, setCurrency] = useState(currencyOptions[0]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null);
  const navigate = useNavigate();
  const menuRef = useRef(null);

  const cartCount = getCartCount();
  const userRole = String(user?.role || '').toLowerCase();
  const isLogisticsUser = userRole === 'logistics';
  const isBuyerAccount = ['buyer', 'consumer'].includes(userRole) && !isSeller && !isAdmin && !isLogisticsUser;
  const accountLabel = user?.fullName || user?.name || 'My Account';

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

            <div
              className="relative"
              onMouseEnter={() => setOpenDropdown('partner')}
              onMouseLeave={() => setOpenDropdown(null)}
            >
              <button
                onClick={() => toggleDropdown('partner')}
                className="bg-[#E97A12] px-3 py-2 rounded flex items-center gap-2 font-semibold"
              >
                <span>Partner With Us</span>
                <FaChevronDown size={12} />
              </button>
              {openDropdown === 'partner' && (
                <div className="absolute right-0 mt-2 w-64 bg-white text-[#111827] rounded-lg shadow-lg border border-gray-200 py-1">
                  <Link to="/seller-plans" className="block px-4 py-2 hover:bg-gray-100" onClick={closeAllMenus} {...createPrefetchHandlers('/seller-plans')}>
                    Sell on Lango Market Pulse
                  </Link>
                  <Link to="/logistics-partners" className="block px-4 py-2 hover:bg-gray-100" onClick={closeAllMenus}>
                    Deliver on Lango Market Pulse
                  </Link>
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

          <div className="ml-auto flex shrink-0 items-center gap-2 md:hidden">
            <Link to="/cart" className="relative hover:opacity-90" onClick={closeAllMenus}>
              <FaShoppingCart size={20} />
              {cartCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-[#111827] text-white text-[10px] h-4 w-4 rounded-full flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </Link>
            <button
              onClick={() => setIsMobileMenuOpen((prev) => !prev)}
              className="inline-flex h-10 w-10 items-center justify-center rounded bg-[#E97A12]"
              aria-label={isMobileMenuOpen ? 'Close mobile menu' : 'Open mobile menu'}
            >
              {isMobileMenuOpen ? <FaTimes size={16} /> : <FaBars size={16} />}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-[#2F4258] px-3 py-3">
        <div className="mx-auto max-w-[1366px]">
          <form onSubmit={handleSubmit} className="mx-auto flex h-11 w-full max-w-xl items-center rounded-full bg-white pl-4 pr-2 shadow-sm">
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
        </div>
      </div>

      {isMobileMenuOpen && (
        <div className="max-h-[calc(100dvh-112px)] overflow-y-auto border-t border-[#E97A12] bg-[#F2871A] text-white md:hidden">
          <div className="space-y-3 px-4 py-3">
            {isAuthenticated ? (
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
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Link
                  to="/login"
                  className="flex items-center justify-center gap-2 rounded bg-[#E97A12] px-3 py-2 font-semibold"
                  onClick={closeAllMenus}
                  {...createPrefetchHandlers('/login')}
                >
                  <FaSignInAlt size={14} />
                  <span>Sign in</span>
                </Link>
                <Link
                  to="/register"
                  className="flex items-center justify-center gap-2 rounded bg-[#0B2D55] px-3 py-2 font-semibold text-white"
                  onClick={closeAllMenus}
                  {...createPrefetchHandlers('/register')}
                >
                  <FaUserPlus size={14} />
                  <span>Create account</span>
                </Link>
              </div>
            )}

            <Link to="/products" className="block font-semibold" onClick={closeAllMenus} {...createPrefetchHandlers('/products')}>Shop</Link>
            {isAuthenticated && !isBuyerAccount && (
              <Link to="/mizigo-engine" className="block font-semibold" onClick={closeAllMenus}>
                Plan 4 Mizigo
              </Link>
            )}

            <button onClick={() => toggleDropdown('categoryMobile')} className="w-full bg-[#E97A12] px-3 py-2 rounded flex items-center justify-between">
              <span>All</span>
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

            <button onClick={() => toggleDropdown('partnerMobile')} className="w-full bg-[#E97A12] px-3 py-2 rounded flex items-center justify-between font-semibold">
              <span>Partner With Us</span>
              <FaChevronDown size={12} />
            </button>
            {openDropdown === 'partnerMobile' && (
              <div className="bg-white text-[#111827] rounded-lg py-1">
                <Link to="/seller-plans" className="block px-4 py-2 hover:bg-gray-100" onClick={closeAllMenus} {...createPrefetchHandlers('/seller-plans')}>
                  Sell on Lango Market Pulse
                </Link>
                <Link to="/logistics-partners" className="block px-4 py-2 hover:bg-gray-100" onClick={closeAllMenus}>
                  Deliver on Lango Market Pulse
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;
