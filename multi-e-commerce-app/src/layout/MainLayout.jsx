// src/layouts/MainLayout.jsx
import React, { Suspense } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import ProfileCompletionReminder from '../components/ProfileCompletionReminder';

const MainLayout = () => {
  const location = useLocation();
  const isAuthPage = location.pathname === '/login' || location.pathname === '/register';
  const isSellerOrAdminView =
    location.pathname.startsWith('/seller') || location.pathname.startsWith('/admin');

  return (
    <div className="min-h-screen flex flex-col">
      {isSellerOrAdminView ? null : isAuthPage ? (
        <nav className="bg-[#F2871A] text-white sticky top-0 z-40 shadow-sm">
          <div className="max-w-screen-2xl mx-auto px-4 md:px-6">
            <div className="h-14 sm:h-16 flex items-center">
              <Link to="/" className="hover:opacity-90 transition font-extrabold text-base sm:text-lg" aria-label="MarketPulse Home">
                Lango Market Pulse
              </Link>
            </div>
          </div>
        </nav>
      ) : (
        <Navbar />
      )}
      <main className={`grow bg-gray-50 ${isAuthPage || isSellerOrAdminView ? '' : 'pt-24 md:pt-26'}`}>
        {!isAuthPage && !isSellerOrAdminView && (
          <div className="max-w-screen-2xl mx-auto px-4 pt-3">
            <ProfileCompletionReminder />
          </div>
        )}
        <Suspense
          fallback={
            <div className="max-w-screen-2xl mx-auto px-4 py-6">
              <div className="h-8 w-56 rounded bg-gray-200 skeleton-shimmer mb-4" />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <div key={idx} className="h-40 rounded-xl bg-white border border-gray-100 skeleton-shimmer" />
                ))}
              </div>
            </div>
          }
        >
          <Outlet />
        </Suspense>
      </main>
      {!isAuthPage && !isSellerOrAdminView && <Footer />}
    </div>
  );
};

export default MainLayout;
