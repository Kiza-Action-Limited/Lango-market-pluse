import React, { Suspense, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  FaAngleDoubleLeft,
  FaAngleDoubleRight,
  FaClipboardCheck,
  FaClipboardList,
  FaEnvelopeOpenText,
  FaIdCard,
  FaQrcode,
  FaRoute,
  FaSignOutAlt,
  FaTools,
  FaTruck,
} from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import NotificationBell from '../components/NotificationBell';

const LogisticsLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const navItems = [
    { path: '/logistics/dashboard', label: 'Dashboard', icon: FaTruck },
    { path: '/logistics/assignments', label: 'Seller Assignments', icon: FaClipboardList },
    { path: '/logistics/driver-scanner', label: 'Driver Scanner', icon: FaQrcode },
    { path: '/logistics/hub-scanner', label: 'Hub Scanner', icon: FaRoute },
    { path: '/logistics/status', label: 'Status', icon: FaClipboardCheck },
    { path: '/logistics/tools', label: 'Tools', icon: FaTools },
    { path: '/logistics/support', label: 'Message Admin', icon: FaEnvelopeOpenText },
    { path: '/logistics/apply', label: 'Verification', icon: FaIdCard },
  ];

  const currentNav = navItems.find((item) => item.path === location.pathname);
  const pageTitle = currentNav?.label || 'Logistics Workspace';
  const sidebarLabelClass = isSidebarOpen
    ? 'ml-3 max-w-44 opacity-100'
    : 'ml-0 max-w-0 opacity-0';
  const sidebarItemClass = isSidebarOpen ? 'justify-start' : 'justify-center';
  const handleLogout = () => {
    logout();
    navigate('/logistics/login');
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <aside className={`sticky top-0 h-screen shrink-0 overflow-hidden bg-[#0B2D55] text-white transition-all duration-200 ${isSidebarOpen ? 'w-64' : 'w-20'}`}>
        <div className="border-b border-white/15 p-4">
          <div className={`flex h-9 items-center gap-3 ${isSidebarOpen ? 'justify-between' : 'justify-center'}`}>
            <div className={`min-w-0 items-center gap-2 ${isSidebarOpen ? 'flex' : 'sr-only'}`}>
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-[#F97316]">
                <FaRoute />
              </span>
              <span className="truncate text-lg font-bold">Logistics</span>
            </div>
            <button
              type="button"
              onClick={() => setIsSidebarOpen((current) => !current)}
              title={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
              aria-label={isSidebarOpen ? 'Collapse logistics sidebar' : 'Expand logistics sidebar'}
              aria-expanded={isSidebarOpen}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/70"
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
                className={`flex items-center rounded-lg px-3 py-2.5 transition hover:bg-white/10 ${sidebarItemClass} ${isActive ? 'bg-[#F97316]' : ''}`}
              >
                <Icon className="shrink-0 text-lg" />
                <span className={`overflow-hidden whitespace-nowrap transition-all duration-200 ${sidebarLabelClass}`}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-8 border-t border-white/20 px-3 pt-4">
          <button
            type="button"
            onClick={handleLogout}
            title="Logout"
            className={`flex w-full items-center rounded-lg px-3 py-2.5 text-left transition hover:bg-white/10 ${sidebarItemClass}`}
          >
            <FaSignOutAlt className="shrink-0 text-lg" />
            <span className={`overflow-hidden whitespace-nowrap transition-all duration-200 ${sidebarLabelClass}`}>
              Logout
            </span>
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-gray-200 bg-white px-6 py-3">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold text-gray-900">{pageTitle}</h1>
            <p className="truncate text-sm text-gray-500">Operations workspace</p>
          </div>
          <NotificationBell />
        </header>
        <div className="flex-1 overflow-y-auto">
          <Suspense
            fallback={
              <div className="p-6">
                <div className="mb-4 h-8 w-56 rounded bg-gray-200 skeleton-shimmer" />
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {Array.from({ length: 4 }).map((_, idx) => (
                    <div key={idx} className="h-40 rounded-xl border border-gray-100 bg-white skeleton-shimmer" />
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

export default LogisticsLayout;
