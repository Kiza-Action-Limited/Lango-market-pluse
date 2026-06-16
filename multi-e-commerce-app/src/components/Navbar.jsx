import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { FaBars, FaChevronDown, FaSearch, FaShoppingCart, FaTimes, FaUser } from 'react-icons/fa';
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
  { code: 'KES', label: 'KSh KES' },
  { code: 'USD', label: '$ USD' },
  { code: 'EUR', label: 'EUR' },
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
    <header ref={menuRef} className="fixed top-0 inset-x-0 z-50 w-full shadow-sm">
      <div className="bg-[#F2871A] text-white">
        <div className="mx-auto max-w-341.5 px-3 py-2 flex flex-wrap md:flex-nowrap items-center gap-3 text-sm">
          <Link to="/" className="flex items-center gap-2 min-w-max hover:opacity-90" onClick={closeAllMenus}>
            <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-[#0B2D55] border-2 border-[#06182f]" />
            <span className="font-extrabold text-sm sm:text-lg leading-none tracking-wide bg-[#0B2D55] px-2 py-1 rounded-sm">
              LANGO <span className="text-[#F9B233]">MARKET PULSE</span>
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-2 lg:gap-3 ml-auto flex-wrap lg:flex-nowrap">
            <div className="relative">
              <button
                onClick={() => toggleDropdown('account')}
                className="bg-[#E97A12] px-3 py-2 rounded flex items-center gap-2 font-semibold"
              >
                <FaUser />
                <span className="max-w-28 truncate">{isAuthenticated ? user?.name || 'My Account' : 'My Account'}</span>
                <FaChevronDown size={12} />
              </button>

              {openDropdown === 'account' && (
                <div className="absolute right-0 mt-2 w-48 bg-white text-[#111827] rounded-lg shadow-lg border border-gray-200 py-1">
                  {isAuthenticated ? (
                    <>
                      <Link to="/profile" className="block px-4 py-2 hover:bg-gray-100" onClick={closeAllMenus}>Profile</Link>
                      {isLogisticsUser && (
                        <Link to="/logistics/status" className="block px-4 py-2 hover:bg-gray-100" onClick={closeAllMenus}>Logistics Status</Link>
                      )}
                      {isSeller && (
                        <Link to="/seller" className="block px-4 py-2 hover:bg-gray-100" onClick={closeAllMenus} {...createPrefetchHandlers('/seller')}>Seller Dashboard</Link>
                      )}
                      {isAdmin && (
                        <Link to="/admin" className="block px-4 py-2 hover:bg-gray-100" onClick={closeAllMenus} {...createPrefetchHandlers('/admin')}>Admin Dashboard</Link>
                      )}
                      <Link to="/orders" className="block px-4 py-2 hover:bg-gray-100" onClick={closeAllMenus}>Orders</Link>
                      <Link to="/notifications/preferences" className="block px-4 py-2 hover:bg-gray-100" onClick={closeAllMenus}>Notification Preferences</Link>
                      <Link to="/wishlist" className="block px-4 py-2 hover:bg-gray-100" onClick={closeAllMenus}>Wishlist</Link>
                      <button onClick={handleAuthAction} className="w-full text-left px-4 py-2 hover:bg-gray-100">Sign out</button>
                    </>
                  ) : (
                    <>
                      <Link to="/login" className="block px-4 py-2 hover:bg-gray-100" onClick={closeAllMenus} {...createPrefetchHandlers('/login')}>Sign in</Link>
                      <Link to="/register" className="block px-4 py-2 hover:bg-gray-100" onClick={closeAllMenus} {...createPrefetchHandlers('/register')}>Create account</Link>
                    </>
                  )}
                </div>
              )}
            </div>

            <Link to="/products" className="font-semibold hover:opacity-90" {...createPrefetchHandlers('/products')}>Shop</Link>

            <div className="relative">
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

            <div className="relative">
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

            <Link to="/register?role=seller" className="font-semibold hover:opacity-90" {...createPrefetchHandlers('/register')}>
              Sell on Lango Market Pulse
            </Link>

            <Link to="/cart" className="relative hover:opacity-90" onClick={closeAllMenus}>
              <FaShoppingCart size={20} />
              {cartCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-[#111827] text-white text-[10px] h-4 w-4 rounded-full flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </Link>
          </div>

          <div className="md:hidden ml-auto flex items-center gap-3">
            <Link to="/cart" className="relative hover:opacity-90" onClick={closeAllMenus}>
              <FaShoppingCart size={20} />
              {cartCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-[#111827] text-white text-[10px] h-4 w-4 rounded-full flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </Link>
            <button onClick={() => setIsMobileMenuOpen((prev) => !prev)} className="p-2 rounded bg-[#E97A12]">
              {isMobileMenuOpen ? <FaTimes size={16} /> : <FaBars size={16} />}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-[#2F4258] px-3 py-3">
        <div className="mx-auto max-w-341.5">
          <form onSubmit={handleSubmit} className="mx-auto w-full max-w-xl bg-white rounded-full h-11 flex items-center pl-4 pr-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 bg-transparent outline-none text-sm text-gray-700"
              placeholder="Search products..."
              type="text"
            />
            <button type="submit" className="h-8 w-8 rounded-full bg-[#F2871A] text-white flex items-center justify-center">
              <FaSearch size={14} />
            </button>
          </form>
        </div>
      </div>

      {isMobileMenuOpen && (
        <div className="md:hidden bg-[#F2871A] text-white border-t border-[#E97A12]">
          <div className="px-4 py-3 space-y-3">
            <button onClick={() => toggleDropdown('accountMobile')} className="w-full bg-[#E97A12] px-3 py-2 rounded flex items-center justify-between font-semibold">
              <span>{isAuthenticated ? user?.name || 'My Account' : 'My Account'}</span>
              <FaChevronDown size={12} />
            </button>
            {openDropdown === 'accountMobile' && (
              <div className="bg-white text-[#111827] rounded-lg py-1">
                {isAuthenticated ? (
                  <>
                    <Link to="/profile" className="block px-4 py-2 hover:bg-gray-100" onClick={closeAllMenus}>Profile</Link>
                    {isLogisticsUser && (
                      <Link to="/logistics/status" className="block px-4 py-2 hover:bg-gray-100" onClick={closeAllMenus}>Logistics Status</Link>
                    )}
                    {isSeller && (
                      <Link to="/seller" className="block px-4 py-2 hover:bg-gray-100" onClick={closeAllMenus} {...createPrefetchHandlers('/seller')}>Seller Dashboard</Link>
                    )}
                    {isAdmin && (
                      <Link to="/admin" className="block px-4 py-2 hover:bg-gray-100" onClick={closeAllMenus} {...createPrefetchHandlers('/admin')}>Admin Dashboard</Link>
                    )}
                    <Link to="/orders" className="block px-4 py-2 hover:bg-gray-100" onClick={closeAllMenus}>Orders</Link>
                    <Link to="/notifications/preferences" className="block px-4 py-2 hover:bg-gray-100" onClick={closeAllMenus}>Notification Preferences</Link>
                    <Link to="/wishlist" className="block px-4 py-2 hover:bg-gray-100" onClick={closeAllMenus}>Wishlist</Link>
                    <button onClick={handleAuthAction} className="w-full text-left px-4 py-2 hover:bg-gray-100">Sign out</button>
                  </>
                ) : (
                  <>
                    <Link to="/login" className="block px-4 py-2 hover:bg-gray-100" onClick={closeAllMenus} {...createPrefetchHandlers('/login')}>Sign in</Link>
                    <Link to="/register" className="block px-4 py-2 hover:bg-gray-100" onClick={closeAllMenus} {...createPrefetchHandlers('/register')}>Create account</Link>
                  </>
                )}
              </div>
            )}

            <Link to="/products" className="block font-semibold" onClick={closeAllMenus} {...createPrefetchHandlers('/products')}>Shop</Link>

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

            <Link to="/register?role=seller" className="block font-semibold" onClick={closeAllMenus} {...createPrefetchHandlers('/register')}>
              Sell on Lango Market Pulse
            </Link>
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;
