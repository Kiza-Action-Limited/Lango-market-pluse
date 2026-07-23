// src/layouts/SellerLayout.jsx
import React, { Suspense, useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { FaTachometerAlt, FaPlus, FaBox, FaShoppingCart, FaCrown, FaBroadcastTower, FaUser, FaSignOutAlt, FaAngleDoubleLeft, FaAngleDoubleRight, FaFileInvoiceDollar, FaWallet, FaEnvelopeOpenText, FaTruck } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import NotificationBell from '../components/NotificationBell';

const SellerLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  const navItems = [
    { path: '/seller', label: 'Dashboard', icon: FaTachometerAlt },
    { path: '/seller/add-product', label: 'Add Product', icon: FaPlus },
    { path: '/seller/products', label: 'My Products', icon: FaBox },
    { path: '/seller/orders', label: 'Orders', icon: FaShoppingCart },
    { path: '/seller/logistics-requests', label: 'Buyer Logistics', icon: FaTruck },
    { path: '/seller/rfqs', label: 'RFQs', icon: FaFileInvoiceDollar },
    { path: '/seller/finance', label: 'Finance', icon: FaWallet },
    { path: '/seller/support', label: 'Support Message', icon: FaEnvelopeOpenText },
    { path: '/seller/scarcity-board', label: 'Scarcity Board', icon: FaBroadcastTower },
    { path: '/seller/subscription-plans', label: 'Subscription', icon: FaCrown },
  ];
  const mobileNavItems = [navItems[0], navItems[2], navItems[3], navItems[4], navItems[5]];
  const currentNav = navItems.find((item) => item.path === location.pathname);
  const pageTitle = currentNav?.label || 'Seller Workspace';
  const sidebarLabelClass = isSidebarOpen
    ? 'ml-3 max-w-44 opacity-100'
    : 'ml-0 max-w-0 opacity-0';
  const sidebarItemClass = isSidebarOpen ? 'justify-start' : 'justify-center';
  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex min-h-dvh overflow-hidden bg-gray-50 md:h-screen">
      {/* Sidebar */}
      <aside className={`sticky top-0 hidden h-screen shrink-0 overflow-hidden bg-[#0B2D55] text-white transition-all duration-200 md:block ${isSidebarOpen ? 'w-64' : 'w-20'}`}>
        <div className="border-b border-white/15 p-4">
          <div className={`flex h-8 items-center gap-3 ${isSidebarOpen ? 'justify-between' : 'justify-center'}`}>
            <h2 className={`min-w-0 items-center whitespace-nowrap text-xl font-bold ${isSidebarOpen ? 'flex justify-start' : 'sr-only'}`}>
              <span className={`overflow-hidden transition-all duration-200 ${isSidebarOpen ? 'max-w-44 opacity-100' : 'max-w-0 opacity-0'}`}>
                Seller Panel
              </span>
            </h2>
            <button
              type="button"
              onClick={() => setIsSidebarOpen((current) => !current)}
              title={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
              aria-label={isSidebarOpen ? 'Collapse seller sidebar' : 'Expand seller sidebar'}
              aria-expanded={isSidebarOpen}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-white hover:bg-[#F97316] focus:outline-none focus:ring-2 focus:ring-white/70"
            >
              {isSidebarOpen ? <FaAngleDoubleLeft /> : <FaAngleDoubleRight />}
            </button>
          </div>
        </div>
        <nav className="mt-4 space-y-1 px-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                title={item.label}
                className={`flex items-center rounded-lg px-3 py-2.5 hover:bg-[#F97316] transition ${sidebarItemClass} ${isActive ? 'bg-[#F97316]' : ''}`}
              >
                  <Icon className="shrink-0 text-lg text-white" />
                  <span className={`overflow-hidden whitespace-nowrap text-white transition-all duration-200 ${sidebarLabelClass}`}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>
        <div className="mt-8 border-t border-white/20 px-3 pt-4">
          <Link
            to="/seller/profile"
            title="Profile"
              className={`flex items-center rounded-lg px-3 py-2.5 hover:bg-[#F97316] transition ${sidebarItemClass}`}
          >
              <FaUser className="shrink-0 text-lg text-white" />
              <span className={`overflow-hidden whitespace-nowrap text-white transition-all duration-200 ${sidebarLabelClass}`}>
              Profile
            </span>
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            title="Logout"
              className={`w-full flex items-center rounded-lg px-3 py-2.5 hover:bg-[#F97316] transition text-left ${sidebarItemClass}`}
          >
              <FaSignOutAlt className="shrink-0 text-lg text-white" />
              <span className={`overflow-hidden whitespace-nowrap text-white transition-all duration-200 ${sidebarLabelClass}`}>
              Logout
            </span>
          </button>
        </div>
      </aside>
      
      {/* Main Content */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-gray-200 bg-white px-4 py-3 sm:px-6">
          <h1 className="truncate text-xl font-semibold text-gray-900">{pageTitle}</h1>
          <NotificationBell />
        </header>
        <div className="flex-1 overflow-y-auto pb-24 md:pb-0">
          <Suspense
            fallback={
              <div className="p-6">
                <div className="h-8 w-56 rounded bg-gray-200 skeleton-shimmer mb-4" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Array.from({ length: 4 }).map((_, idx) => (
                    <div key={idx} className="h-40 rounded-xl bg-white border border-gray-100 skeleton-shimmer" />
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
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex min-h-14 flex-col items-center justify-center rounded-md px-1 text-[11px] font-semibold transition ${isActive ? 'bg-[#F97316] text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                aria-label={item.label}
              >
                <Icon className="mb-1 text-lg" />
                <span className="max-w-full truncate">{item.label.replace('My ', '')}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

export default SellerLayout;
