// src/layouts/AdminLayout.jsx
import React, { Suspense } from 'react';
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
  FaLayerGroup,
  FaBalanceScale,
  FaUserCircle,
  FaSignOutAlt,
  FaUser,
  FaIdBadge,
} from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import NotificationBell from '../components/NotificationBell';

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
    { path: '/admin/logistics-tools', label: 'Logistics Tools', icon: FaLayerGroup },
    { path: '/admin/finance-audit', label: 'Finance & Audit', icon: FaBalanceScale },
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
      <aside className="group fixed inset-y-0 left-0 z-40 hidden w-20 overflow-hidden bg-primary text-white transition-all duration-200 hover:w-64 md:flex md:flex-col">
        <div className="border-b border-white/15 p-4">
          <h2 className="flex h-8 items-center justify-center whitespace-nowrap text-xl font-bold group-hover:justify-start">
            <span className="group-hover:hidden">MP</span>
            <span className="hidden group-hover:inline">Admin Panel</span>
          </h2>
          <p className="mt-1 max-w-0 overflow-hidden whitespace-nowrap text-xs text-white/70 opacity-0 transition-all duration-200 group-hover:max-w-56 group-hover:opacity-100">
            Lango MarketPulse OS
          </p>
        </div>

        <nav className="mt-4 flex-1 space-y-1 px-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                title={item.label}
                className={`flex items-center justify-center rounded-lg px-3 py-2.5 transition group-hover:justify-start ${
                  isActive ? 'bg-primary-dark' : 'hover:bg-primary-dark/80'
                }`}
              >
                <Icon className="shrink-0 text-lg group-hover:mr-3" />
                <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-200 group-hover:max-w-44 group-hover:opacity-100">
                  {item.label}
                </span>
              </Link>
            );
          })}
          <button
            onClick={handleLogout}
            title="Logout"
            className="mt-2 flex w-full items-center justify-center rounded-lg px-3 py-2.5 text-left transition hover:bg-primary-dark/80 group-hover:justify-start"
          >
            <FaSignOutAlt className="shrink-0 text-lg group-hover:mr-3" />
            <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-200 group-hover:max-w-44 group-hover:opacity-100">
              Logout
            </span>
          </button>
        </nav>

        <div className="border-t border-white/15 p-4">
          <div className="mb-3 rounded-lg bg-white/10 p-3">
            <div className="flex items-center justify-center gap-3 group-hover:justify-start">
              {profileImage ? (
                <img src={profileImage} alt="Admin profile" className="h-10 w-10 shrink-0 rounded-full object-cover border border-white/20" />
              ) : (
                <FaUserCircle className="shrink-0 text-3xl text-white/90" />
              )}
              <div className="min-w-0 max-w-0 overflow-hidden opacity-0 transition-all duration-200 group-hover:max-w-40 group-hover:opacity-100">
                <p className="truncate text-sm font-semibold">{user?.name || user?.fullName || 'Admin User'}</p>
                <p className="truncate text-xs text-white/70">{user?.email || 'admin@marketpulse.local'}</p>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Link
              to="/admin/profile"
              title="Profile"
              className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-white/20 px-3 py-2 text-sm hover:bg-white/10"
            >
              <FaUser />
              <span className="hidden group-hover:inline">Profile</span>
            </Link>
            <button
              onClick={handleLogout}
              title="Logout"
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#F97316] px-3 py-2 text-sm font-medium hover:bg-[#FB923C]"
            >
              <FaSignOutAlt />
              <span className="hidden group-hover:inline">Logout</span>
            </button>
          </div>
        </div>
      </aside>

      <div className="md:ml-20">
        <header className="fixed left-0 right-0 top-0 z-30 border-b border-gray-200 bg-white/95 backdrop-blur md:left-20">
          <div className="flex h-16 items-center justify-between px-4 sm:px-6">
            <div>
              <p className="text-sm text-gray-500">Admin Workspace</p>
              <h1 className="text-lg font-semibold text-[#111827]">Lango MarketPulse</h1>
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
                  <p className="text-sm font-medium text-[#111827]">Admin</p>
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
