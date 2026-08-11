import React from 'react';
import { Link } from 'react-router-dom';
import { FaStore } from 'react-icons/fa';

const HomeBelowFold = ({ businessPartners = [], loading = false }) => {
  const uniquePartners = businessPartners.filter((partner, index, arr) => {
    const key = `${String(partner?.name || '')
      .trim()
      .toLowerCase()}::${String(partner?.logo || '').trim().toLowerCase()}`;
    return arr.findIndex((item) => {
      const itemKey = `${String(item?.name || '')
        .trim()
        .toLowerCase()}::${String(item?.logo || '').trim().toLowerCase()}`;
      return itemKey === key;
    }) === index;
  });

  const buildLoop = (items = [], minItems = 12) => {
    if (!items.length) return [];
    const result = [...items];
    while (result.length < minItems) result.push(...items);
    return [...result, ...result];
  };

  const half = Math.ceil(uniquePartners.length / 2);
  const topRow = uniquePartners.slice(0, half);
  const bottomRow = uniquePartners.slice(half);
  const topRowLoop = buildLoop(topRow);
  const bottomRowLoop = buildLoop(bottomRow.length ? bottomRow : topRow);
  const useInfiniteRows = uniquePartners.length >= 8;

  return (
    <div className="content-fade-in">
      <section className="py-16 bg-white"><div className="container mx-auto px-4"><div className="text-center mb-10"><div className="flex items-center justify-center gap-2 mb-3"><FaStore className="text-[#F97316] text-2xl" /><h2 className="text-3xl font-bold text-[#F97316]">Our Business Partners</h2></div><p className="text-[#6B7280] max-w-2xl mx-auto">Business logos from registered partners appear here. Sellers must upload a business logo at signup.</p></div><div className="overflow-hidden rounded-2xl border border-gray-200 bg-[#F9FAFB] py-5">{loading ? (<div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 px-4">{Array.from({ length: 6 }).map((_, idx) => (<div key={idx} className="flex flex-col items-center"><div className="h-14 w-14 md:h-16 md:w-16 rounded-full bg-gray-200 skeleton-shimmer" /><div className="mt-2 h-3 w-20 rounded bg-gray-200 skeleton-shimmer" /></div>))}</div>) : uniquePartners.length > 0 ? (useInfiniteRows ? (<div className="space-y-3"><div className="logo-marquee-track">{topRowLoop.map((logo, index) => (<Link key={`top-${logo.id}-${index}`} to={`/businesses/${logo.id}`} className="logo-marquee-item hover-card-soft" aria-label={`View ${logo.name} business profile`} title={logo.name}><img src={logo.logo} alt={logo.name} className="h-14 w-14 md:h-16 md:w-16 rounded-full object-cover border border-gray-200" loading="lazy" /><p className="text-xs md:text-sm font-semibold text-[#374151] mt-2 text-center truncate w-full">{logo.name}</p></Link>))}</div><div className="logo-marquee-track logo-marquee-track-reverse">{bottomRowLoop.map((logo, index) => (<Link key={`bottom-${logo.id}-${index}`} to={`/businesses/${logo.id}`} className="logo-marquee-item hover-card-soft" aria-label={`View ${logo.name} business profile`} title={logo.name}><img src={logo.logo} alt={logo.name} className="h-14 w-14 md:h-16 md:w-16 rounded-full object-cover border border-gray-200" loading="lazy" /><p className="text-xs md:text-sm font-semibold text-[#374151] mt-2 text-center truncate w-full">{logo.name}</p></Link>))}</div></div>) : (<div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 px-4">{uniquePartners.map((logo) => (<Link key={`static-${logo.id}`} to={`/businesses/${logo.id}`} className="logo-marquee-item hover-card-soft mx-auto" aria-label={`View ${logo.name} business profile`} title={logo.name}><img src={logo.logo} alt={logo.name} className="h-14 w-14 md:h-16 md:w-16 rounded-full object-cover border border-gray-200" loading="lazy" /><p className="text-xs md:text-sm font-semibold text-[#374151] mt-2 text-center truncate w-full">{logo.name}</p></Link>))}</div>)) : (<p className="text-center text-sm text-[#6B7280] px-4">No seller logos yet. Registered sellers with uploaded logos will appear here automatically.</p>)}</div></div></section>
      <section className="py-16 bg-linear-to-r from-[#F97316] to-[#FB923C]"><div className="container mx-auto px-4 text-center"><h2 className="text-3xl font-bold text-white mb-3">Ready to Start Your Journey?</h2><p className="text-white/90 mb-6 max-w-2xl mx-auto">Join thousands of smart businesses and customers on Lango MarketPulse - <span className="font-semibold italic">Lango Lako la Biashara Smart</span></p><div className="flex flex-col sm:flex-row items-center justify-center gap-4"><Link to="/products" className="px-6 py-3 bg-[#F97316] text-white font-medium rounded-lg hover:bg-[#F97316]/90 transition-colors shadow-lg">Start Shopping</Link><Link to="/register?role=seller" className="px-6 py-3 bg-white text-[#F97316] font-medium rounded-lg hover:bg-gray-100 transition-colors shadow-lg">Become a Seller</Link></div></div></section>
    </div>
  );
};

export default HomeBelowFold;
