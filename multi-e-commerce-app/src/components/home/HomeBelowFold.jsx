import React from 'react';
import { Link } from 'react-router-dom';
import { FaTruck, FaShieldAlt, FaMoneyBillWave, FaHeadset, FaBrain, FaChartLine, FaBell, FaStore } from 'react-icons/fa';

const HomeBelowFold = ({ categories = [], businessPartners = [] }) => {
  const features = [
    { icon: FaTruck, title: 'Free Shipping', desc: 'On orders over KSh 50', color: '#F97316' },
    { icon: FaShieldAlt, title: 'Secure Payment', desc: '100% secure transactions', color: '#FB923C' },
    { icon: FaMoneyBillWave, title: 'Money Back', desc: '30 days guarantee', color: '#16A34A' },
    { icon: FaHeadset, title: '24/7 Support', desc: 'Dedicated support team', color: '#F97316' }
  ];

  const intelligenceFeatures = [
    { icon: FaBrain, title: 'AI Market Insights', desc: 'Smart predictions and trend analysis', color: '#FB923C' },
    { icon: FaChartLine, title: 'Profit Indicators', desc: 'Real-time growth tracking', color: '#16A34A' },
    { icon: FaBell, title: 'Smart Alerts', desc: 'Instant notifications on opportunities', color: '#F97316' },
  ];

  const marqueeLogos = [...businessPartners, ...businessPartners];

  return (
    <div className="content-fade-in">
      <section className="py-8 bg-linear-to-r from-[#111827] to-[#111827]">
        <div className="container mx-auto px-4 text-center">
          <p className="text-white/90 text-sm md:text-base font-medium">
            <span className="font-bold">Lango MarketPulse Trade & Intelligence OS</span>
            AI-powered insights meet seamless commerce. <span className="text-[#F97316]">Lango Lako la Biashara Smart</span>
          </p>
        </div>
      </section>
      <section className="py-16 bg-white"><div className="container mx-auto px-4"><div className="text-center mb-10"><h2 className="text-3xl font-bold text-[#F97316] mb-2">Why Choose Lango MarketPulse</h2><p className="text-[#6B7280]">Your trusted gateway to smart business and intelligent commerce</p></div><div className="grid grid-cols-1 md:grid-cols-4 gap-8">{features.map((feature, index) => (<div key={index} className="hover-card text-center p-6 rounded-xl bg-[#F9FAFB]"><feature.icon className="text-4xl mx-auto mb-4" style={{ color: feature.color }} /><h3 className="text-xl font-semibold mb-2 text-[#111827]">{feature.title}</h3><p className="text-[#6B7280]">{feature.desc}</p></div>))}</div></div></section>
      <section className="py-16 bg-linear-to-br from-[#FB923C]/5 to-[#F97316]/5"><div className="container mx-auto px-4"><div className="text-center mb-10"><div className="inline-block px-4 py-1 bg-[#FB923C]/10 rounded-full mb-3"><span className="text-[#FB923C] text-sm font-semibold">Intelligence Layer</span></div><h2 className="text-3xl font-bold text-[#F97316] mb-2">AI-Powered Smart Commerce</h2><p className="text-[#6B7280] max-w-2xl mx-auto">Powered by predictive analytics and real-time insights to help you make smarter decisions</p></div><div className="grid grid-cols-1 md:grid-cols-3 gap-8">{intelligenceFeatures.map((feature, index) => (<div key={index} className="hover-card text-center p-6 bg-white rounded-xl shadow-md border-t-4" style={{ borderTopColor: feature.color }}><feature.icon className="text-4xl mx-auto mb-4" style={{ color: feature.color }} /><h3 className="text-xl font-semibold mb-2 text-[#111827]">{feature.title}</h3><p className="text-[#6B7280]">{feature.desc}</p></div>))}</div></div></section>
      <section className="py-14 bg-[#F3F4F6]"><div className="container mx-auto px-4"><div className="bg-white rounded-2xl border border-gray-200 p-6 md:p-8"><div className="flex flex-col lg:flex-row justify-between gap-6"><div className="max-w-2xl"><p className="text-sm font-semibold text-[#F97316] mb-2">Factory Sourcing Experience</p><h2 className="text-2xl md:text-3xl font-bold text-[#111827] mb-3">Browse verified businesses on Lango Market Pulse</h2><p className="text-[#6B7280]">Source by category, compare business capabilities, and request quotations using your existing Lango Market Pulse product and category data.</p><div className="mt-5 flex flex-wrap gap-2">{categories.slice(0, 5).map((category) => (<span key={category.id} className="px-3 py-1 rounded-full bg-gray-100 text-sm text-[#374151]">{category.name}</span>))}</div></div><div className="flex items-center"><Link to="/business" className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-linear-to-r from-[#F97316] to-[#FB923C] text-white font-semibold shadow-lg hover:opacity-95">Explore Verified Businesses</Link></div></div></div></div></section>
      <section className="py-16 bg-white"><div className="container mx-auto px-4"><div className="text-center mb-10"><div className="flex items-center justify-center gap-2 mb-3"><FaStore className="text-[#F97316] text-2xl" /><h2 className="text-3xl font-bold text-[#F97316]">Our Business Partners</h2></div><p className="text-[#6B7280] max-w-2xl mx-auto">Business logos from registered partners appear here. Sellers must upload a business logo at signup.</p></div><div className="overflow-hidden rounded-2xl border border-gray-200 bg-[#F9FAFB] py-5">{marqueeLogos.length > 0 ? (<div className="logo-marquee-track">{marqueeLogos.map((logo, index) => (<Link key={`${logo.id}-${index}`} to={`/businesses/${logo.id}`} className="logo-marquee-item hover-card-soft" aria-label={`View ${logo.name} business profile`}><img src={logo.logo} alt={logo.name} className="h-14 w-14 md:h-16 md:w-16 rounded-full object-cover border border-gray-200" loading="lazy" /><p className="text-xs md:text-sm font-semibold text-[#374151] mt-2 text-center line-clamp-2 min-h-10">{logo.name}</p></Link>))}</div>) : (<p className="text-center text-sm text-[#6B7280] px-4">No seller logos yet. Registered sellers with uploaded logos will appear here automatically.</p>)}</div></div></section>
      <section className="py-16 bg-linear-to-r from-[#F97316] to-[#FB923C]"><div className="container mx-auto px-4 text-center"><h2 className="text-3xl font-bold text-white mb-3">Ready to Start Your Journey?</h2><p className="text-white/90 mb-6 max-w-2xl mx-auto">Join thousands of smart businesses and customers on Lango MarketPulse - <span className="font-semibold italic">Lango Lako la Biashara Smart</span></p><div className="flex flex-col sm:flex-row items-center justify-center gap-4"><Link to="/products" className="px-6 py-3 bg-[#F97316] text-white font-medium rounded-lg hover:bg-[#F97316]/90 transition-colors shadow-lg">Start Shopping</Link><Link to="/register?role=seller" className="px-6 py-3 bg-white text-[#F97316] font-medium rounded-lg hover:bg-gray-100 transition-colors shadow-lg">Become a Seller</Link></div></div></section>
    </div>
  );
};

export default HomeBelowFold;
