// src/layouts/AdminLayout.jsx
import React from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  FaTachometerAlt,
  FaUsers,
  FaBox,
  FaShoppingCart,
  FaTags,
  FaEnvelopeOpenText,
  FaChartLine,
  FaTruck,
  FaUserCircle,
  FaSignOutAlt,
  FaUser,
  FaIdBadge,
} from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';

const AdminLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const profileKey = `marketpulse_admin_profile_image_${user?._id || user?.id || 'default'}`;
  const profileImage = localStorage.getItem(profileKey);

  const navItems = [
    { path: '/admin', label: 'Dashboard', icon: FaTachometerAlt },
    { path: '/admin/users', label: 'Users', icon: FaUsers },
    { path: '/admin/products', label: 'Products', icon: FaBox },
    { path: '/admin/orders', label: 'Orders', icon: FaShoppingCart },
    { path: '/admin/analytics', label: 'Analytics', icon: FaChartLine },
    { path: '/admin/logistics', label: 'Logistics', icon: FaTruck },
    { path: '/admin/profile', label: 'Profile', icon: FaIdBadge },
    { path: '/admin/categories', label: 'Categories', icon: FaTags },
    { path: '/admin/contact-queue', label: 'Contact Queue', icon: FaEnvelopeOpenText },
  ];

  const handleLogout = () => {
    logout();
    navigate('/admin');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 bg-primary text-white md:flex md:flex-col">
        <div className="border-b border-white/15 p-6">
          <h2 className="text-xl font-bold">Admin Panel</h2>
          <p className="mt-1 text-xs text-white/70">Lango MarketPulse OS</p>
        </div>

        <nav className="mt-4 flex-1 space-y-1 px-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center rounded-lg px-3 py-2.5 transition ${
                  isActive ? 'bg-primary-dark' : 'hover:bg-primary-dark/80'
                }`}
              >
                <Icon className="mr-3" />
                <span>{item.label}</span>
              </Link>
            );
          })}
          <button
            onClick={handleLogout}
            className="mt-2 flex w-full items-center rounded-lg px-3 py-2.5 text-left transition hover:bg-primary-dark/80"
          >
            <FaSignOutAlt className="mr-3" />
            <span>Logout</span>
          </button>
        </nav>

        <div className="border-t border-white/15 p-4">
          <div className="mb-3 rounded-lg bg-white/10 p-3">
            <div className="flex items-center gap-3">
              {profileImage ? (
                <img src={profileImage} alt="Admin profile" className="h-11 w-11 rounded-full object-cover border border-white/20" />
              ) : (
                <FaUserCircle className="text-3xl text-white/90" />
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{user?.name || user?.fullName || 'Admin User'}</p>
                <p className="truncate text-xs text-white/70">{user?.email || 'admin@marketpulse.local'}</p>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Link
              to="/admin/profile"
              className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-white/20 px-3 py-2 text-sm hover:bg-white/10"
            >
              <FaUser />
              Profile
            </Link>
            <button
              onClick={handleLogout}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#F97316] px-3 py-2 text-sm font-medium hover:bg-[#FB923C]"
            >
              <FaSignOutAlt />
              Logout
            </button>
          </div>
        </div>
      </aside>

      <div className="md:ml-64">
        <header className="fixed left-0 right-0 top-0 z-30 border-b border-gray-200 bg-white/95 backdrop-blur md:left-64">
          <div className="flex h-16 items-center justify-between px-4 sm:px-6">
            <div>
              <p className="text-sm text-gray-500">Admin Workspace</p>
              <h1 className="text-lg font-semibold text-[#111827]">Lango MarketPulse</h1>
            </div>
            <Link to="/admin/profile" className="ml-3 inline-flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-100">
              {profileImage ? (
                <img src={profileImage} alt="Admin profile" className="h-9 w-9 rounded-full object-cover border border-gray-200" />
              ) : (
                <FaUserCircle className="text-2xl text-[#6B7280]" />
              )}
              <div className="text-right">
                <p className="text-sm font-medium text-[#111827]">Admin</p>
                <p className="text-xs text-gray-500">Administrator</p>
              </div>
            </Link>
          </div>
        </header>

        <main className="min-h-[calc(100vh-4rem)] pt-16">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
