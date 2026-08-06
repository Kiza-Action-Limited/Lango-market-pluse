// src/layouts/AdminLayout.jsx
import React, { Suspense, useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  FaTachometerAlt,
  FaUsers,
  FaBox,
  FaShoppingCart,
  FaTags,
  FaEnvelopeOpenText,
  FaClipboardList,
  FaChartLine,
  FaTruck,
  FaLayerGroup,
  FaBalanceScale,
  FaUserCircle,
  FaSignOutAlt,
  FaIdBadge,
  FaCrown,
  FaBars,
  FaAngleDoubleLeft,
  FaAngleDoubleRight,
  FaTimes,
  FaShieldAlt,
  FaImages,
} from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import NotificationBell from '../components/NotificationBell';

const AdminLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const profileKey = `marketpulse_admin_profile_image_${user?._id || user?.id || 'default'}`;
  const profileImage = localStorage.getItem(profileKey);

  const navSections = [
    {
      title: 'Command',
      items: [
        { path: '/admin/dashboard', label: 'Dashboard', icon: FaTachometerAlt, hint: 'Platform overview' },
        { path: '/admin/analytics', label: 'Analytics', icon: FaChartLine, hint: 'Revenue and trends' },
        { path: '/admin/finance-audit', label: 'Finance & Audit', icon: FaBalanceScale, hint: 'Escrow and reports' },
      ],
    },
    {
      title: 'Marketplace',
      items: [
        { path: '/admin/users', label: 'Users', icon: FaUsers, hint: 'KYC and documents' },
        { path: '/admin/documents', label: 'Documents', icon: FaClipboardList, hint: 'All user files' },
        { path: '/admin/products', label: 'Products', icon: FaBox, hint: 'Active and inactive' },
        { path: '/admin/homepage-ads', label: 'Homepage Ads', icon: FaImages, hint: 'Slider and ad cards' },
        { path: '/admin/orders', label: 'Orders', icon: FaShoppingCart, hint: 'Order operations' },
        { path: '/admin/categories', label: 'Categories', icon: FaTags, hint: 'Catalog structure' },
        { path: '/admin/subscriptions', label: 'Subscriptions', icon: FaCrown, hint: 'Seller plans' },
        { path: '/admin/agent-referrals', label: 'Agent Referrals', icon: FaIdBadge, hint: 'Seller referrals' },
      ],
    },
    {
      title: 'Operations',
      items: [
        { path: '/admin/logistics', label: 'Logistics Hub', icon: FaTruck, hint: 'Trips and GPS' },
        { path: '/admin/logistics-tools', label: 'Logistics Tools', icon: FaLayerGroup, hint: 'QR and routing' },
        { path: '/admin/contact-queue', label: 'Contact Queue', icon: FaEnvelopeOpenText, hint: 'Messages and SMS' },
        { path: '/admin/profile', label: 'Admin Profile', icon: FaIdBadge, hint: 'Account settings' },
      ],
    },
  ];

  const handleLogout = () => {
    logout();
    navigate('/admin');
  };

  const showSidebarLabels = isSidebarOpen || isMobileSidebarOpen;
  const sidebarWidthClass = isSidebarOpen ? 'md:w-72' : 'md:w-20';
  const contentOffsetClass = isSidebarOpen ? 'md:ml-72' : 'md:ml-20';
  const labelClass = showSidebarLabels ? 'max-w-44 opacity-100' : 'max-w-0 opacity-0';
  const detailClass = showSidebarLabels ? 'max-w-44 opacity-100' : 'max-w-0 opacity-0';
  const itemJustifyClass = showSidebarLabels ? 'justify-start' : 'justify-center';
  const adminName = user?.name || user?.fullName || user?.businessName || 'Admin User';

  const renderNavItem = (item) => {
    const Icon = item.icon;
    const isActive = location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);

    return (
      <Link
        key={item.path}
        to={item.path}
        title={item.label}
        onClick={() => setIsMobileSidebarOpen(false)}
        className={`group/item flex min-h-12 items-center rounded-md px-3 py-2.5 transition ${itemJustifyClass} ${
              isActive
                ? 'bg-[#F97316] text-white shadow-sm'
                : 'text-white hover:bg-white/10 hover:text-white'
            }`}
      >
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${isActive ? 'text-white' : 'text-white/80 group-hover/item:text-white'}`}>
          <Icon className="text-base" />
        </span>
        <span className={`ml-3 min-w-0 overflow-hidden transition-all duration-200 ${labelClass}`}>
          <span className="block truncate text-sm font-semibold">{item.label}</span>
          <span className={`block truncate text-[11px] ${isActive ? 'text-gray-500' : 'text-gray-400'} transition-all duration-200 ${detailClass}`}>
            {item.hint}
          </span>
        </span>
      </Link>
    );
  };

  const sidebarContent = (
    <>
      <div className="border-b border-white/10 p-4">
        <div className={`flex items-center gap-3 ${showSidebarLabels ? 'justify-between' : 'justify-center'}`}>
          <Link to="/admin/dashboard" onClick={() => setIsMobileSidebarOpen(false)} className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-[#F97316] text-base font-bold text-white shadow-sm">
              LM
            </div>
            <div className={`min-w-0 overflow-hidden transition-all duration-200 ${labelClass}`}>
              <p className="truncate text-sm font-bold text-white">Lango Market</p>
              <p className="truncate text-xs text-white/80">Admin Command</p>
            </div>
          </Link>
          <button
            type="button"
            onClick={() => setIsSidebarOpen((current) => !current)}
            className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/10 text-gray-300 hover:bg-white/10 hover:text-white md:flex"
            aria-label={isSidebarOpen ? 'Collapse admin sidebar' : 'Expand admin sidebar'}
            title={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {isSidebarOpen ? <FaAngleDoubleLeft /> : <FaAngleDoubleRight />}
          </button>
          <button
            type="button"
            onClick={() => setIsMobileSidebarOpen(false)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/10 text-gray-300 hover:bg-white/10 hover:text-white md:hidden"
            aria-label="Close admin sidebar"
          >
            <FaTimes />
          </button>
        </div>

        <div className={`mt-4 overflow-hidden rounded-md border border-white/10 bg-white/5 p-3 transition-all duration-200 ${showSidebarLabels ? 'opacity-100' : 'h-0 border-0 p-0 opacity-0'}`}>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase text-white">
            <FaShieldAlt className="text-white" />
            Secure Admin
          </div>
          <p className="mt-1 text-xs text-gray-400">Live marketplace operations, finance, documents, and logistics.</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-5">
          {navSections.map((section) => (
            <div key={section.title}>
              <p className={`mb-2 overflow-hidden px-3 text-[11px] font-bold uppercase tracking-wide text-gray-500 transition-all duration-200 ${labelClass}`}>
                {section.title}
              </p>
              <div className="space-y-1">
                {section.items.map(renderNavItem)}
              </div>
            </div>
          ))}
        </div>
      </nav>

      <div className="border-t border-white/10 p-4">
        <Link
          to="/admin/profile"
          onClick={() => setIsMobileSidebarOpen(false)}
          className={`mb-3 flex items-center rounded-md border border-white/10 bg-white/5 p-3 transition hover:bg-white/10 ${itemJustifyClass}`}
        >
          {profileImage ? (
            <img src={profileImage} alt="Admin profile" className="h-10 w-10 shrink-0 rounded-full border border-white/20 object-cover" />
          ) : (
            <FaUserCircle className="shrink-0 text-3xl text-gray-300" />
          )}
          <div className={`ml-3 min-w-0 overflow-hidden transition-all duration-200 ${labelClass}`}>
            <p className="truncate text-sm font-semibold text-white">{adminName}</p>
            <p className="truncate text-xs text-gray-400">{user?.email || 'admin@lango.local'}</p>
          </div>
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          title="Logout"
          className={`flex w-full items-center rounded-md border border-red-400/20 bg-red-500/10 px-3 py-2.5 text-left text-red-100 transition hover:bg-red-500/20 ${itemJustifyClass}`}
        >
          <FaSignOutAlt className="shrink-0 text-base" />
          <span className={`ml-3 overflow-hidden whitespace-nowrap text-sm font-semibold transition-all duration-200 ${labelClass}`}>
            Logout
          </span>
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {isMobileSidebarOpen && (
        <button
          type="button"
          aria-label="Close admin menu overlay"
          onClick={() => setIsMobileSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
        />
      )}

      <aside className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col overflow-hidden bg-[#0B2D55] text-white shadow-xl transition-transform duration-200 md:z-40 ${sidebarWidthClass} ${
        isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      }`}>
        {sidebarContent}
      </aside>

      <div className={contentOffsetClass}>
        <header className={`fixed left-0 right-0 top-0 z-30 border-b border-gray-200 bg-white/95 backdrop-blur transition-all duration-200 ${isSidebarOpen ? 'md:left-72' : 'md:left-20'}`}>
          <div className="flex h-16 items-center justify-between px-4 sm:px-6">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsMobileSidebarOpen(true)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-gray-200 text-gray-700 hover:bg-gray-50 md:hidden"
                aria-label="Open admin sidebar"
              >
                <FaBars />
              </button>
              <div>
                <p className="text-sm text-gray-500">Admin Workspace</p>
                <h1 className="text-lg font-semibold text-[#111827]">Lango MarketPulse</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <NotificationBell />
              <Link to="/admin/profile" className="ml-1 inline-flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-100">
                {profileImage ? (
                  <img src={profileImage} alt="Admin profile" className="h-9 w-9 rounded-full object-cover border border-gray-200" />
                ) : (
                  <FaUserCircle className="text-2xl text-[#6B7280]" />
                )}
                <div className="hidden text-right sm:block">
                  <p className="text-sm font-medium text-[#111827]">{adminName}</p>
                  <p className="text-xs text-gray-500">Administrator</p>
                </div>
              </Link>
            </div>
          </div>
        </header>

        <main className="min-h-[calc(100vh-4rem)] pt-16">
          <Suspense
            fallback={
              <div className="p-6">
                <div className="h-8 w-64 rounded bg-gray-200 skeleton-shimmer mb-4" />
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {Array.from({ length: 6 }).map((_, idx) => (
                    <div key={idx} className="h-36 rounded-xl bg-white border border-gray-100 skeleton-shimmer" />
                  ))}
                </div>
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
