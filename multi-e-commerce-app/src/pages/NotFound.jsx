// src/pages/NotFound.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { FaHome, FaBrain, FaArrowLeft } from 'react-icons/fa';

const NotFound = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-[#F9FAFB] to-[#E5E7EB] px-4">
      <div className="text-center max-w-md mx-auto">
        {/* Animated 404 */}
        <div className="relative mb-8">
          <h1 className="text-9xl md:text-9xl font-bold bg-linear-to-r from-[#F97316] via-[#FB923C] to-[#F97316] bg-clip-text text-transparent animate-pulse">
            404
          </h1>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full bg-[#F97316]/5 blur-2xl"></div>
        </div>
        
        <h2 className="text-2xl md:text-3xl font-bold text-[#111827] mt-4 mb-2">
          Page Not Found
        </h2>
        
        <p className="text-[#6B7280] mt-2 mb-6 text-base">
          The page you're looking for doesn't exist or has been moved.
        </p>
        
        {/* AI Insight */}
        <div className="bg-linear-to-r from-[#FB923C]/10 to-[#F97316]/10 rounded-xl p-4 mb-8 border border-[#FB923C]/20">
          <div className="flex items-center gap-2 mb-2">
            <FaBrain className="text-[#FB923C] text-sm" />
            <span className="text-xs font-semibold text-[#FB923C] uppercase tracking-wide">AI Intelligence Insight</span>
          </div>
          <p className="text-xs text-[#6B7280]">
            The page you're looking for seems to have wandered off. Our AI suggests checking the URL or heading back to the homepage.
          </p>
        </div>
        
        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link 
            to="/" 
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#F97316] text-white rounded-lg font-semibold hover:bg-[#F97316]/90 transition-colors shadow-md"
          >
            <FaHome size={16} />
            Go Back Home
          </Link>
          <button 
            onClick={() => window.history.back()}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 border-2 border-[#F97316] text-[#F97316] rounded-lg font-semibold hover:bg-[#F97316]/10 transition-colors"
          >
            <FaArrowLeft size={14} />
            Go Back
          </button>
        </div>
        
        {/* Helpful Links */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-sm text-[#6B7280] mb-3">Need help finding something?</p>
          <div className="flex flex-wrap gap-2 justify-center">
            <Link to="/products" className="text-sm text-[#FB923C] hover:text-[#F97316] transition-colors">
              Browse Products
            </Link>
            <span className="text-[#6B7280]">•</span>
            <Link to="/categories" className="text-sm text-[#FB923C] hover:text-[#F97316] transition-colors">
              Shop by Category
            </Link>
            <span className="text-[#6B7280]">•</span>
            <Link to="/contact" className="text-sm text-[#FB923C] hover:text-[#F97316] transition-colors">
              Contact Support
            </Link>
          </div>
        </div>
        
        {/* Brand Tagline */}
        <p className="mt-8 text-xs text-[#6B7280] italic">
          Lango Lako la Biashara Smart — Your Gateway to Smart Business
        </p>
      </div>
    </div>
  );
};

export default NotFound;