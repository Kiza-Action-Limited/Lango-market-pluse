// src/layouts/SellerLayout.jsx
import React, { Suspense } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { FaTachometerAlt, FaPlus, FaBox, FaShoppingCart, FaCrown, FaBroadcastTower, FaUser, FaSignOutAlt, FaHome } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';

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
      <aside className="w-64 bg-primary text-white sticky top-0 h-screen overflow-y-auto">
        <div className="p-6">
          <h2 className="text-xl font-bold">Seller Panel</h2>
        </div>
        <nav className="mt-6">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center px-6 py-3 hover:bg-primary-dark transition ${isActive ? 'bg-primary-dark' : ''}`}
              >
                <Icon className="mr-3" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="mt-8 border-t border-white/20 pt-4">
          <Link
            to="/seller/profile"
            className="flex items-center px-6 py-3 hover:bg-primary-dark transition"
          >
            <FaUser className="mr-3" />
            <span>Profile</span>
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center px-6 py-3 hover:bg-primary-dark transition text-left"
          >
            <FaSignOutAlt className="mr-3" />
            <span>Logout</span>
          </button>
        </div>
      </aside>
      
      {/* Main Content */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <header className="sticky top-0 z-20 bg-white border-b border-gray-200 px-6 py-4">
          <h1 className="text-xl font-semibold text-gray-900">{pageTitle}</h1>
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
