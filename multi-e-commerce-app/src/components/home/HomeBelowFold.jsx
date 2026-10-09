import React from 'react';
import { Link } from 'react-router-dom';
import { FaArrowRight, FaHandshake, FaStore } from 'react-icons/fa';

const normalizePartner = (partner = {}, index = 0) => {
  const id = partner.id || partner._id || partner.sellerId || partner.businessId || `partner-${index}`;
  return {
    id,
    name: partner.name || partner.businessName || partner.sellerName || 'Lango partner',
    logo: partner.logo || partner.businessLogoUrl || partner.logoUrl || '',
  };
};

const uniqueByLogoAndName = (partners = []) => {
  const seen = new Set();
  return partners
    .map(normalizePartner)
    .filter((partner) => {
      if (!partner.logo) return false;
      const key = `${String(partner.name).trim().toLowerCase()}::${String(partner.logo).trim().toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const buildLogoLoop = (items = [], minItems = 8) => {
  if (!items.length) return [];
  const result = [...items];
  while (result.length < minItems) {
    result.push(...items);
  }
  return [...result, ...result];
};

const PartnerLogo = ({ partner, index, prefix }) => (
  <Link
    to={`/businesses/${partner.id}`}
    className="partner-logo-card group"
    aria-label={`View ${partner.name} business profile`}
    title={partner.name}
    style={{ animationDelay: `${(index % 8) * 70}ms` }}
  >
    <span className="partner-logo-ring">
      <img
        src={partner.logo}
        alt={partner.name}
        className="no-image-hover h-14 w-14 rounded-full border border-gray-200 bg-white object-cover md:h-16 md:w-16"
        loading="lazy"
      />
    </span>
    <span className="mt-2 block w-full truncate text-center text-xs font-semibold text-[#374151] md:text-sm">
      {partner.name}
    </span>
    <span className="sr-only">{prefix}</span>
  </Link>
);

const HomeBelowFold = ({ businessPartners = [], loading = false }) => {
  const uniquePartners = uniqueByLogoAndName(businessPartners).slice(0, 10);
  const topRowLoop = buildLogoLoop(uniquePartners);

  return (
    <div className="content-fade-in">
      <section className="bg-white py-16">
        <div className="container mx-auto px-4">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-10 w-10 items-center justify-center rounded-md bg-[#FFF7ED] text-[#F97316]">
                  <FaHandshake />
                </span>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#F97316]">Verified partner network</p>
              </div>
              <h2 className="text-3xl font-bold text-[#111827]">Our Business Partners</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6B7280]">
                Live seller logos move through the marketplace automatically after partners upload their business branding.
              </p>
            </div>
            <Link
              to="/businesses"
              className="inline-flex min-h-10 items-center gap-2 rounded-md border border-gray-300 bg-white px-4 text-sm font-semibold text-[#111827] hover:border-[#F97316] hover:text-[#F97316]"
            >
              View businesses <FaArrowRight size={12} />
            </Link>
          </div>

          <div className="partner-logo-stage rounded-lg border border-gray-200 bg-[#F8FAFC] py-5">
            {loading ? (
              <div className="grid grid-cols-2 gap-4 px-4 md:grid-cols-4 lg:grid-cols-6">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <div key={idx} className="flex flex-col items-center rounded-lg bg-white p-3">
                    <div className="h-14 w-14 rounded-full bg-gray-200 skeleton-shimmer md:h-16 md:w-16" />
                    <div className="mt-2 h-3 w-20 rounded bg-gray-200 skeleton-shimmer" />
                  </div>
                ))}
              </div>
            ) : uniquePartners.length > 0 ? (
              <div>
                <div className="partner-logo-marquee">
                  <div className="partner-logo-track">
                    {topRowLoop.map((partner, index) => (
                      <PartnerLogo key={`top-${partner.id}-${index}`} partner={partner} index={index} prefix="Top row partner" />
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="px-4 py-8 text-center">
                <FaStore className="mx-auto text-3xl text-[#F97316]" />
                <p className="mt-3 text-sm font-semibold text-[#111827]">No seller logos yet</p>
                <p className="mt-1 text-sm text-[#6B7280]">Registered sellers with uploaded logos will appear here automatically.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="bg-linear-to-r from-[#F97316] to-[#FB923C] py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="mb-3 text-3xl font-bold text-white">Ready to Start Your Journey?</h2>
          <p className="mx-auto mb-6 max-w-2xl text-white/90">
            Join thousands of smart businesses and customers on Lango MarketPulse - <span className="font-semibold italic">Lango Lako la Biashara Smart</span>
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link to="/products" className="rounded-lg bg-[#F97316] px-6 py-3 font-medium text-white shadow-lg hover:bg-[#F97316]/90">Start Shopping</Link>
            <Link to="/register?role=seller" className="rounded-lg bg-white px-6 py-3 font-medium text-[#F97316] shadow-lg hover:bg-gray-100">Become a Seller</Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomeBelowFold;
