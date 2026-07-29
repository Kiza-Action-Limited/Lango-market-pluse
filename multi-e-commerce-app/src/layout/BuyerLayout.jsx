import React, { Suspense, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  FaAngleDoubleLeft,
  FaAngleDoubleRight,
  FaBars,
  FaBell,
  FaEnvelopeOpenText,
  FaFileInvoiceDollar,
  FaHeart,
  FaHome,
  FaStar,
  FaSearch,
  FaShoppingCart,
  FaSignOutAlt,
  FaStore,
  FaTimes,
  FaTruck,
  FaUser,
} from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import NotificationBell from '../components/NotificationBell';

const BuyerLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const profileItem = { path: '/buyer/profile', label: 'Profile', icon: FaUser };
  const navItems = [
    { path: '/buyer', label: 'Dashboard', icon: FaHome },
    { path: '/products', label: 'Browse Market', icon: FaSearch },
    { path: '/buyer/orders', label: 'Order Tracking', icon: FaTruck },
    { path: '/buyer/logistics', label: 'Verified Logistics', icon: FaTruck },
    { path: '/buyer/rfqs', label: 'RFQ Inbox', icon: FaFileInvoiceDollar },
    { path: '/buyer/sellers', label: 'My Sellers', icon: FaStore },
    { path: '/buyer/reviews', label: 'Reviews', icon: FaStar },
    { path: '/buyer/product-alerts', label: 'Product Alerts', icon: FaBell },
    { path: '/cart', label: 'Cart', icon: FaShoppingCart },
    { path: '/buyer/wishlist', label: 'Wishlist', icon: FaHeart },
    { path: '/buyer/notifications/preferences', label: 'Notifications', icon: FaBell },
    { path: '/buyer/support', label: 'Support Message', icon: FaEnvelopeOpenText },
  ];
  const mobileNavItems = [
    navItems.find((item) => item.path === '/buyer'),
    navItems.find((item) => item.path === '/products'),
    navItems.find((item) => item.path === '/buyer/orders'),
    navItems.find((item) => item.path === '/cart'),
    profileItem,
  ];

  const currentNav = [...navItems, profileItem].find((item) => (
    location.pathname.startsWith(item.path)
  ));
  const pageTitle = currentNav?.label || (location.pathname.includes('/track') ? 'Track Order' : 'Buyer Workspace');
  const sidebarLabelClass = isSidebarOpen
    ? 'ml-3 max-w-44 opacity-100'
    : 'ml-0 max-w-0 opacity-0';
  const sidebarItemClass = isSidebarOpen ? 'justify-start' : 'justify-center';
  const mobileSidebarLabelClass = 'ml-3 max-w-44 opacity-100';
  const contentOffsetClass = isSidebarOpen ? 'md:ml-64' : 'md:ml-20';

  const handleLogout = () => {
    logout();
    navigate('/buyer/login');
  };

  const renderNavLinks = (labelClass, itemClass, onNavigate) => navItems.map((item) => {
    const Icon = item.icon;
    const isActive = item.path === '/buyer'
      ? location.pathname === '/buyer'
      : location.pathname.startsWith(item.path);

    return (
      <Link
        key={item.path}
        to={item.path}
        title={item.label}
        onClick={onNavigate}
        className={`flex items-center rounded-lg px-3 py-2.5 transition hover:bg-[#F97316] ${itemClass} ${isActive ? 'bg-[#F97316]' : ''}`}
      >
        <Icon className="shrink-0 text-lg text-white" />
        <span className={`overflow-hidden whitespace-nowrap text-white transition-all duration-200 ${labelClass}`}>
          {item.label}
        </span>
      </Link>
    );
  });

  const renderSidebarFooter = (labelClass, itemClass, onNavigate) => (
    <div className="border-t border-white/20 px-3 py-4">
      <Link
        to={profileItem.path}
        title={profileItem.label}
        onClick={onNavigate}
        className={`flex items-center rounded-lg px-3 py-2.5 transition hover:bg-[#F97316] ${itemClass} ${location.pathname.startsWith(profileItem.path) ? 'bg-[#F97316]' : ''}`}
      >
        <FaUser className="shrink-0 text-lg text-white" />
        <span className={`overflow-hidden whitespace-nowrap text-white transition-all duration-200 ${labelClass}`}>
          Profile
        </span>
      </Link>
      <button
        type="button"
        onClick={() => {
          if (onNavigate) onNavigate();
          handleLogout();
        }}
        title="Logout"
        className={`flex w-full items-center rounded-lg px-3 py-2.5 text-left transition hover:bg-[#F97316] ${itemClass}`}
      >
        <FaSignOutAlt className="shrink-0 text-lg text-white" />
        <span className={`overflow-hidden whitespace-nowrap text-white transition-all duration-200 ${labelClass}`}>
          Logout
        </span>
      </button>
    </div>
  );

  return (
    <div className="min-h-dvh bg-gray-50">
      {isMobileSidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-slate-950/40 md:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
          aria-label="Close buyer sidebar overlay"
        />
      )}

      <aside className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col overflow-hidden bg-[#0B2D55] text-white shadow-xl transition-transform duration-200 md:hidden ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="border-b border-white/15 p-4">
          <div className="flex h-9 items-center justify-between gap-3">
            <Link to="/buyer" onClick={() => setIsMobileSidebarOpen(false)} className="flex min-w-0 items-center gap-2">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#F97316]">
                <FaTruck />
              </span>
              <span className="truncate text-lg font-bold">Buyer Hub</span>
            </Link>
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(false)}
              title="Close sidebar"
              aria-label="Close buyer sidebar"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-white hover:bg-[#F97316] focus:outline-none focus:ring-2 focus:ring-white/70"
            >
              <FaTimes />
            </button>
          </div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {renderNavLinks(mobileSidebarLabelClass, 'justify-start', () => setIsMobileSidebarOpen(false))}
        </nav>
        {renderSidebarFooter(mobileSidebarLabelClass, 'justify-start', () => setIsMobileSidebarOpen(false))}
      </aside>

      <aside className={`fixed inset-y-0 left-0 z-40 hidden h-dvh shrink-0 overflow-hidden bg-[#0B2D55] text-white transition-all duration-200 md:flex md:flex-col ${isSidebarOpen ? 'w-64' : 'w-20'}`}>
        <div className="border-b border-white/15 p-4">
          <div className={`flex h-9 items-center gap-3 ${isSidebarOpen ? 'justify-between' : 'justify-center'}`}>
            <Link to="/buyer" className={`min-w-0 items-center gap-2 ${isSidebarOpen ? 'flex' : 'sr-only'}`}>
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#F97316]">
                <FaTruck />
              </span>
              <span className="truncate text-lg font-bold">Buyer Hub</span>
            </Link>
            <button
              type="button"
              onClick={() => setIsSidebarOpen((current) => !current)}
              title={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
              aria-label={isSidebarOpen ? 'Collapse buyer sidebar' : 'Expand buyer sidebar'}
              aria-expanded={isSidebarOpen}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-white hover:bg-[#F97316] focus:outline-none focus:ring-2 focus:ring-white/70"
            >
              {isSidebarOpen ? <FaAngleDoubleLeft /> : <FaAngleDoubleRight />}
            </button>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {renderNavLinks(sidebarLabelClass, sidebarItemClass)}
        </nav>

        {renderSidebarFooter(sidebarLabelClass, sidebarItemClass)}
      </aside>

      <div className={`min-w-0 transition-all duration-200 ${contentOffsetClass}`}>
        <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-gray-200 bg-white px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={() => setIsMobileSidebarOpen(true)}
            title="Open sidebar"
            aria-label="Open buyer sidebar"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-gray-200 text-[#0B2D55] transition hover:bg-gray-50 md:hidden"
          >
            <FaBars />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-semibold text-gray-900">{pageTitle}</h1>
            <p className="truncate text-sm text-gray-500">
              {user?.fullName || user?.name ? `Welcome back, ${user.fullName || user.name}` : 'Orders, delivery, and account controls'}
            </p>
          </div>
          <NotificationBell />
        </header>
        <div className="pb-24 md:pb-0">
          <Suspense
            fallback={
              <div className="p-6">
                <div className="mb-4 h-8 w-56 rounded bg-gray-200 skeleton-shimmer" />
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {Array.from({ length: 4 }).map((_, idx) => (
                    <div key={idx} className="h-40 rounded-lg border border-gray-100 bg-white skeleton-shimmer" />
                  ))}
                </div>
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </div>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.35rem)] pt-2 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
          {mobileNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.path === '/buyer'
              ? location.pathname === '/buyer'
              : location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex min-h-14 flex-col items-center justify-center rounded-md px-1 text-[11px] font-semibold transition ${isActive ? 'bg-[#F97316] text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                aria-label={item.label}
              >
                <Icon className="mb-1 text-lg" />
                <span className="max-w-full truncate">{item.label.replace(' Tracking', '')}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

export default BuyerLayout;
