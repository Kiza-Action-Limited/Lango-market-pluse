// src/layouts/SellerLayout.jsx
import React, { Suspense } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { FaTachometerAlt, FaPlus, FaBox, FaShoppingCart, FaCrown, FaBroadcastTower, FaUser, FaSignOutAlt, FaHome } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import NotificationBell from '../components/NotificationBell';

const SellerLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  
  const navItems = [
    { path: '/', label: 'Home', icon: FaHome },
    { path: '/seller', label: 'Dashboard', icon: FaTachometerAlt },
    { path: '/seller/add-product', label: 'Add Product', icon: FaPlus },
    { path: '/seller/products', label: 'My Products', icon: FaBox },
    { path: '/seller/orders', label: 'Orders', icon: FaShoppingCart },
    { path: '/seller/scarcity-board', label: 'Scarcity Board', icon: FaBroadcastTower },
    { path: '/seller/subscription-plans', label: 'Subscription', icon: FaCrown },
  ];
  const currentNav = navItems.find((item) => item.path === location.pathname);
  const pageTitle = currentNav?.label || 'Seller Workspace';
  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="group sticky top-0 h-screen w-20 shrink-0 overflow-hidden bg-primary text-white transition-all duration-200 hover:w-64">
        <div className="border-b border-white/15 p-4">
          <h2 className="flex h-8 items-center justify-center whitespace-nowrap text-xl font-bold group-hover:justify-start">
            <span className="group-hover:hidden">SP</span>
            <span className="hidden group-hover:inline">Seller Panel</span>
          </h2>
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
                className={`flex items-center justify-center rounded-lg px-3 py-2.5 hover:bg-primary-dark transition group-hover:justify-start ${isActive ? 'bg-primary-dark' : ''}`}
              >
                <Icon className="shrink-0 text-lg group-hover:mr-3" />
                <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-200 group-hover:max-w-44 group-hover:opacity-100">
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
            className="flex items-center justify-center rounded-lg px-3 py-2.5 hover:bg-primary-dark transition group-hover:justify-start"
          >
            <FaUser className="shrink-0 text-lg group-hover:mr-3" />
            <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-200 group-hover:max-w-44 group-hover:opacity-100">
              Profile
            </span>
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            title="Logout"
            className="w-full flex items-center justify-center rounded-lg px-3 py-2.5 hover:bg-primary-dark transition text-left group-hover:justify-start"
          >
            <FaSignOutAlt className="shrink-0 text-lg group-hover:mr-3" />
            <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-200 group-hover:max-w-44 group-hover:opacity-100">
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
