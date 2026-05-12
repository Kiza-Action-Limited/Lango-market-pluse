// src/pages/About.jsx
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FaTruck,
  FaShieldAlt,
  FaMoneyBillWave,
  FaHeadset,
  FaStore,
  FaUsers,
  FaChartLine,
  FaHandshake,
  FaBrain,
  FaBolt,
  FaCrown,
  FaChevronDown,
  FaChevronUp,
} from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { FEATURE_LABELS, TRADER_PLANS } from '../config/subscriptionPlans';
import aboutHeroImage from '../assets/images/360_F_273670292_Gcald9BW9G1oHm8fqEcIPfrghFbfXm9d.webp';
import businessImage from '../assets/images/240_F_736429436_NpVWpeNSbzAx35soBFulMc5N4MUO30NV.jpg';
import customerImage from '../assets/images/240_F_725819555_bH4Tv8G1KWOdwC60nwFHDZtGAmTHa2V8.jpg';

const About = () => {
  const { isAuthenticated, isSeller } = useAuth();
  const [expandedPlanId, setExpandedPlanId] = useState(null);

  const trustFeatures = [
    { icon: FaTruck, title: 'Reliable Delivery', desc: 'Trackable shipping with clear order updates.' },
    { icon: FaShieldAlt, title: 'Secure Transactions', desc: 'Protected checkout and trusted payment flows.' },
    { icon: FaMoneyBillWave, title: 'Fair Pricing', desc: 'Direct seller pricing across multiple vendor types.' },
    { icon: FaHeadset, title: 'Platform Support', desc: 'Dedicated support for both buyers and sellers.' },
  ];

  const customerBenefits = [
    'Browse products from brands, wholesalers, retailers, farmers, and small businesses in one place.',
    'Compare options quickly by category, price, business type, and product details.',
    'Save favorites to wishlist, track orders in real time, and manage your purchases from one account.',
    'Shop confidently with transparent listings, ratings, and reliable checkout flow.',
  ];

  const businessBenefits = [
    'Create a storefront and publish products with pricing, stock, images, and variants.',
    'Reach customers actively searching across multiple categories and seller types.',
    'Manage orders, monitor product performance, and update inventory from your dashboard.',
    'Scale from small business to larger operations while keeping full control of your catalog.',
  ];

  const getSellerPlanLink = (planId) => {
    const encodedPlan = encodeURIComponent(planId);

    if (isSeller) {
      return `/seller/subscription-plans?plan=${encodedPlan}`;
    }

    if (isAuthenticated) {
      return `/register?role=seller&plan=${encodedPlan}`;
    }

    return `/register?role=seller&plan=${encodedPlan}`;
  };

  return (
    <div className="bg-[#F9FAFB] text-[#111827]">
      {/* Hero Section with new brand colors */}
      <section className="relative h-75 md:h-90 overflow-hidden">
        <img src={aboutHeroImage} alt="Lango MarketPulse Trade & Intelligence OS" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-linear-to-r from-[#F97316]/90 to-[#FB923C]/80" />
        <div className="absolute inset-0 flex items-center">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl">
              <h1 className="text-3xl md:text-5xl font-bold text-white mb-3">
                About Lango MarketPulse
              </h1>
              <p className="text-white/95 text-base md:text-lg mb-2">
                Lango Lako la Biashara Smart — Your Gateway to Smart Business.
              </p>
              <p className="text-white/90 text-sm md:text-base">
                Trade & Intelligence OS: A unified ecosystem where AI-powered insights meet seamless commerce.
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-10 md:py-14">
        <div className="max-w-6xl mx-auto space-y-10">
          {/* Who We Are - updated brand description */}
          <section className="bg-white rounded-xl shadow-md p-6 md:p-8 border-l-4 border-[#FB923C]">
            <h2 className="text-2xl font-bold mb-4 text-[#F97316]">Who We Are</h2>
            <p className="text-[#111827] mb-4">
              <span className="font-semibold text-[#F97316]">Lango MarketPulse</span> connects customers with a wide network of verified businesses,
              including brands, wholesalers, manufacturers, retailers, farmers, and small businesses.
              Our goal is to make online commerce more transparent, efficient, and intelligent.
            </p>
            <p className="text-[#111827]">
              As a <span className="text-[#FB923C] font-medium">Trade & Intelligence OS</span>, we blend commerce with smart data — empowering buyers
              with AI-driven insights and sellers with predictive tools to optimize performance.
            </p>
          </section>

          {/* For Customers & For Businesses - using new color accents */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-md overflow-hidden border-t-4 border-[#16A34A]">
              <img src={customerImage} alt="Customers shopping on Lango MarketPulse" className="w-full h-56 object-cover" />
              <div className="p-6">
                <div className="flex items-center gap-2 mb-3">
                  <FaUsers className="text-[#16A34A]" />
                  <h3 className="text-xl font-semibold text-[#111827]">For Customers</h3>
                </div>
                <ul className="space-y-2 text-[#6B7280] text-sm md:text-base">
                  {customerBenefits.map((item, index) => (
                    <li key={index}>✓ {item}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-md overflow-hidden border-t-4 border-[#F97316]">
              <img src={businessImage} alt="Businesses selling on Lango MarketPulse" className="w-full h-56 object-cover" />
              <div className="p-6">
                <div className="flex items-center gap-2 mb-3">
                  <FaStore className="text-[#F97316]" />
                  <h3 className="text-xl font-semibold text-[#111827]">For Businesses</h3>
                </div>
                <ul className="space-y-2 text-[#6B7280] text-sm md:text-base">
                  {businessBenefits.map((item, index) => (
                    <li key={index}>✓ {item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          {/* Why Lango MarketPulse - updated with new color palette */}
          <section>
            <h2 className="text-2xl font-bold text-center mb-6 text-[#F97316]">Why Lango MarketPulse</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {trustFeatures.map((feature, index) => (
                <div key={index} className="bg-white rounded-xl shadow-md p-6 text-center hover:shadow-lg transition-shadow">
                  <feature.icon className="text-4xl text-[#F97316] mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2 text-[#111827]">{feature.title}</h3>
                  <p className="text-[#6B7280] text-sm">{feature.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Intelligence OS highlight - using Purple & Green */}
          <section className="bg-linear-to-r from-[#FB923C]/10 to-[#F97316]/10 rounded-xl p-6 md:p-8 border border-[#FB923C]/20">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="flex items-start gap-3">
                <FaBrain className="text-[#FB923C] text-2xl mt-1" />
                <div>
                  <h4 className="font-semibold mb-1 text-[#111827]">AI Intelligence Layer</h4>
                  <p className="text-sm text-[#6B7280]">Predictive analytics, smart alerts, and trend insights to guide decisions.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <FaChartLine className="text-[#16A34A] text-2xl mt-1" />
                <div>
                  <h4 className="font-semibold mb-1 text-[#111827]">Profit & Growth Indicators</h4>
                  <p className="text-sm text-[#6B7280]">Real-time success metrics and performance tracking for sellers.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <FaBolt className="text-[#F97316] text-2xl mt-1" />
                <div>
                  <h4 className="font-semibold mb-1 text-[#111827]">Smart Alerts & Notifications</h4>
                  <p className="text-sm text-[#6B7280]">Instant updates on orders, inventory, and market opportunities.</p>
                </div>
              </div>
            </div>
          </section>

          {/* Trust & growth pillars */}
          <section className="bg-white rounded-xl shadow-md p-6 md:p-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="flex items-start gap-3">
                <FaHandshake className="text-[#F97316] text-2xl mt-1" />
                <div>
                  <h4 className="font-semibold mb-1 text-[#111827]">Trusted Marketplace</h4>
                  <p className="text-sm text-[#6B7280]">Built for long-term customer-business relationships.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <FaChartLine className="text-[#16A34A] text-2xl mt-1" />
                <div>
                  <h4 className="font-semibold mb-1 text-[#111827]">Business Growth Tools</h4>
                  <p className="text-sm text-[#6B7280]">Practical dashboards and order management for sellers.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <FaUsers className="text-[#FB923C] text-2xl mt-1" />
                <div>
                  <h4 className="font-semibold mb-1 text-[#111827]">Customer-First Experience</h4>
                  <p className="text-sm text-[#6B7280]">Easy product discovery, checkout, and post-purchase tracking.</p>
                </div>
              </div>
            </div>
          </section>

          {/* Seller subscription plans preview */}
          <section className="bg-white rounded-xl shadow-md p-6 md:p-8 border border-[#F97316]/20">
            <div className="flex items-center gap-3 mb-2">
              <FaCrown className="text-[#F97316] text-2xl" />
              <h2 className="text-2xl font-bold text-[#F97316]">Seller Subscription Plans</h2>
            </div>
            <p className="text-[#6B7280] mb-6">
              Compare seller tiers, open each plan to view more features, then choose your preferred plan.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {TRADER_PLANS.map((plan) => {
                const expanded = expandedPlanId === plan.id;
                const previewFeatures = plan.featureKeys.slice(0, 4);
                const detailedFeatures = expanded ? plan.featureKeys : previewFeatures;

                return (
                  <article key={plan.id} className="border border-gray-200 rounded-xl p-4 bg-[#F9FAFB]">
                    <h3 className="text-lg font-semibold text-[#111827]">{plan.name}</h3>
                    <p className="text-[#F97316] font-bold mt-1">{plan.priceLabel}</p>
                    <p className="text-xs text-[#6B7280] mt-1">{plan.differentiator}</p>

                    <ul className="mt-3 space-y-1 text-sm text-[#374151]">
                      {detailedFeatures.map((featureKey) => (
                        <li key={featureKey}>• {FEATURE_LABELS[featureKey] || featureKey}</li>
                      ))}
                    </ul>

                    <button
                      type="button"
                      onClick={() => setExpandedPlanId(expanded ? null : plan.id)}
                      className="mt-3 inline-flex items-center gap-2 text-sm text-[#F97316] hover:text-[#EA580C] font-medium"
                    >
                      {expanded ? (
                        <>
                          View less <FaChevronUp size={12} />
                        </>
                      ) : (
                        <>
                          View more features <FaChevronDown size={12} />
                        </>
                      )}
                    </button>

                    <div className="mt-4 flex flex-col gap-2">
                      <Link
                        to={getSellerPlanLink(plan.id)}
                        className="inline-block text-center px-4 py-2 bg-[#F97316] text-white rounded-lg hover:bg-[#EA580C] transition-colors text-sm font-medium"
                      >
                        Choose Plan
                      </Link>
                      {!isAuthenticated && (
                        <Link
                          to={`/login?next=${encodeURIComponent(`/seller/subscription-plans?plan=${plan.id}`)}`}
                          className="inline-block text-center px-4 py-2 border border-gray-300 text-[#111827] rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                        >
                          Sign In As Seller
                        </Link>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          {/* Call to Action with new button colors */}
          <section className="bg-white rounded-xl shadow-md p-8 text-center border border-[#F97316]/20">
            <h2 className="text-2xl font-bold mb-2 text-[#F97316]">Explore Lango MarketPulse</h2>
            <p className="text-[#6B7280] mb-2 italic">Lango Lako la Biashara Smart</p>
            <p className="text-[#111827] mb-6">
              Whether you are buying or selling, Lango MarketPulse gives you the tools, intelligence, and visibility to succeed.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                to="/products"
                className="inline-block px-6 py-3 bg-[#F97316] text-white font-medium rounded-lg hover:bg-[#F97316]/90 transition-colors"
              >
                Start Shopping
              </Link>
              <Link
                to="/register?role=seller"
                className="inline-block px-6 py-3 bg-[#F97316] text-white font-medium rounded-lg hover:bg-[#F97316]/90 transition-colors"
              >
                Start Selling
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default About;
