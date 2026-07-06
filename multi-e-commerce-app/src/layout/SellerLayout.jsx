// src/layouts/SellerLayout.jsx
import React, { Suspense, useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { FaTachometerAlt, FaPlus, FaBox, FaShoppingCart, FaCrown, FaBroadcastTower, FaUser, FaSignOutAlt, FaAngleDoubleLeft, FaAngleDoubleRight, FaFileInvoiceDollar, FaWallet, FaEnvelopeOpenText } from 'react-icons/fa';
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
    { path: '/seller/rfqs', label: 'RFQs', icon: FaFileInvoiceDollar },
    { path: '/seller/finance', label: 'Finance', icon: FaWallet },
    { path: '/seller/support', label: 'Message Admin', icon: FaEnvelopeOpenText },
    { path: '/seller/scarcity-board', label: 'Scarcity Board', icon: FaBroadcastTower },
    { path: '/seller/subscription-plans', label: 'Subscription', icon: FaCrown },
  ];
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
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <aside className={`sticky top-0 h-screen shrink-0 overflow-hidden bg-[#0B2D55] text-white transition-all duration-200 ${isSidebarOpen ? 'w-64' : 'w-20'}`}>
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
        <header className="sticky top-0 z-20 flex items-center justify-between gap-4 bg-white border-b border-gray-200 px-6 py-3">
          <h1 className="text-xl font-semibold text-gray-900">{pageTitle}</h1>
          <NotificationBell />
        </header>
        <div className="flex-1 overflow-y-auto">
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
    </div>
  );
};

export default SellerLayout;
