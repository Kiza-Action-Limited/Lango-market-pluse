import React, { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  FaBox,
  FaCalendarAlt,
  FaChartLine,
  FaCheckCircle,
  FaClipboardCheck,
  FaEnvelope,
  FaGlobe,
  FaPhoneAlt,
  FaShieldAlt,
  FaStar,
  FaTag,
  FaTruck,
  FaUsers,
} from 'react-icons/fa';
import { useRealtimeManufacturers } from '../hooks/useRealtimeManufacturers';
import Modal from '../components/Modal';

const BusinessProfile = () => {
  const { businessId } = useParams();
  const { baseSuppliers, loading } = useRealtimeManufacturers();
  const [selectedProduct, setSelectedProduct] = useState(null);

  const business = useMemo(
    () => baseSuppliers.find((item) => item.id === businessId) || null,
    [baseSuppliers, businessId]
  );

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#F97316]" />
      </div>
    );
  }

  if (!business) {
    return (
      <div className="container mx-auto px-4 py-12">
        <h1 className="text-2xl font-bold text-[#111827]">Business not found</h1>
        <Link to="/businesses" className="text-[#F97316] hover:underline mt-2 inline-block">
          Back to business directory
        </Link>
      </div>
    );
  }

  const contactEmail = business.premiumProfile?.businessEmail || business.contactEmail || 'business@marketpulse.co.ke';
  const contactPhone = business.contactPhone || '+254 700 000000';
  const contactWebsite = business.website || business.premiumProfile?.businessUrls?.[0] || '';
  const defaultSubject = encodeURIComponent(`Business inquiry: ${business.name}`);
  const joinedLabel = business.createdAt
    ? new Date(business.createdAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
    : `${business.years || 1} yrs active`;
  const hasOrderTerms = business.moqOptions?.length > 0 || business.farmerOptional;
  const profileStats = [
    {
      label: 'Rating',
      value: `${business.rating}/5`,
      detail: `${business.reviews} reviews`,
      icon: FaStar,
      tone: 'text-[#B45309] bg-[#FEF3C7]',
    },
    {
      label: 'Annual sales',
      value: business.annualSales,
      detail: 'reported volume',
      icon: FaChartLine,
      tone: 'text-[#047857] bg-[#D1FAE5]',
    },
    {
      label: 'Team size',
      value: business.staffRange,
      detail: `${business.years} years active`,
      icon: FaUsers,
      tone: 'text-[#1D4ED8] bg-[#DBEAFE]',
    },
  ];

  return (
    <div className="bg-[#F9FAFB] min-h-screen py-8">
      <div className="container mx-auto px-4 space-y-4">
        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-200 bg-[#111827] px-6 py-6 text-white">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#16A34A] px-3 py-1 text-xs font-semibold text-white">
                    <FaCheckCircle size={12} />
                    Verified
                  </span>
                  <span className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-white/90">
                    {business.businessType}
                  </span>
                  <span className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-white/90">
                    {business.years} years
                  </span>
                </div>
                <h1 className="text-3xl font-bold leading-tight md:text-4xl">{business.name}</h1>
                <p className="mt-2 max-w-2xl text-sm text-white/70">
                  Verified {String(business.businessType).toLowerCase()} profile with business capability, sales, and order-term
                  details for sourcing decisions.
                </p>
              </div>
              <Link
                to={`/contact?type=partnership&subject=${defaultSubject}`}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#F97316] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#EA580C]"
              >
                <FaEnvelope size={12} />
                Contact Vendor
              </Link>
            </div>
          </div>

          <div className="grid gap-3 p-4 md:grid-cols-3 md:p-6">
            {profileStats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="rounded-lg border border-gray-200 bg-[#F9FAFB] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase text-[#6B7280]">{stat.label}</p>
                      <p className="mt-1 text-xl font-bold text-[#111827]">{stat.value}</p>
                      <p className="mt-1 text-xs text-[#6B7280]">{stat.detail}</p>
                    </div>
                    <span className={`inline-flex h-10 w-10 items-center justify-center rounded-full ${stat.tone}`}>
                      <Icon size={16} />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className={`grid gap-4 ${hasOrderTerms ? 'lg:grid-cols-[1fr_360px]' : ''}`}>
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <div className="mb-4 flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#EEF2FF] text-[#4338CA]">
                <FaShieldAlt size={16} />
              </span>
              <div>
                <h2 className="text-xl font-semibold text-[#111827]">Business profile</h2>
                <p className="text-sm text-[#6B7280]">Verified capabilities and service strengths</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {business.capabilities.map((capability) => (
                <div
                  key={capability}
                  className="flex items-start gap-3 rounded-lg border border-gray-200 bg-[#F9FAFB] p-3"
                >
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#DCFCE7] text-[#15803D]">
                    <FaClipboardCheck size={12} />
                  </span>
                  <p className="text-sm font-medium text-[#374151]">{capability}</p>
                </div>
              ))}
            </div>
          </div>

          {hasOrderTerms && (
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <div className="mb-4 flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#FFF7ED] text-[#EA580C]">
                  <FaTruck size={16} />
                </span>
                <div>
                  <h3 className="text-xl font-semibold text-[#111827]">Order terms</h3>
                  <p className="text-sm text-[#6B7280]">Minimum order guidance</p>
                </div>
              </div>
              {business.moqOptions?.length > 0 && (
                <div className="space-y-3">
                  {business.moqOptions.map((option) => (
                    <div
                      key={`${business.id}-${option.label}`}
                      className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-[#F9FAFB] px-4 py-3"
                    >
                      <span className="rounded-full bg-[#111827] px-3 py-1 text-xs font-semibold text-white">
                        {option.label}
                      </span>
                      <span className="text-right text-sm font-semibold text-[#111827]">{option.value}</span>
                    </div>
                  ))}
                </div>
              )}
              {business.farmerOptional && (
                <p className="text-xs mt-2 inline-flex px-2 py-1 rounded-full bg-[#16A34A]/10 text-[#166534] font-semibold">
                  Farmer orders are optional
                </p>
              )}
            </div>
          )}
        </section>

        {business.premiumProfile && (
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="p-4 rounded-lg border border-[#16A34A]/30 bg-[#16A34A]/5">
              <h3 className="font-semibold text-[#166534] mb-2">Premium verified information</h3>
              <p className="text-sm text-[#1F2937]">Government Name: {business.premiumProfile.governmentBusinessName}</p>
              <p className="text-sm text-[#1F2937]">Business Email: {business.premiumProfile.businessEmail}</p>
              {!!business.premiumProfile.businessUrls?.length && (
                <div className="mt-2">
                  <p className="text-sm font-medium text-[#1F2937]">Valid URLs:</p>
                  <ul className="space-y-1 mt-1">
                    {business.premiumProfile.businessUrls.map((url) => (
                      <li key={url}>
                        <a href={url} target="_blank" rel="noreferrer" className="text-xs text-[#2563EB] hover:underline break-all inline-flex items-center gap-1">
                          <FaGlobe size={10} />
                          {url}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>
        )}

        <section className="bg-[#E7CFB1] rounded-xl border border-[#D8B98F] p-4 md:p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <div className="h-16 w-16 rounded-full overflow-hidden border-2 border-[#F59E0B] bg-[#111827] shrink-0">
                {business.coverImage ? (
                  <img src={business.coverImage} alt={`${business.name} logo`} className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full bg-[#1F2937]" />
                )}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-[#111827]">{business.name}</h2>
                <p className="text-sm text-[#4B5563]">{business.businessType} supplier</p>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[#374151]">
                  <span className="inline-flex items-center gap-1 rounded bg-[#FACC15] px-2 py-0.5 font-semibold text-[#111827]">
                    <FaCheckCircle size={10} />
                    Verified
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <FaBox size={10} />
                    {business.products.length} Products
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <FaCalendarAlt size={10} />
                    Joined {joinedLabel}
                  </span>
                </div>
              </div>
            </div>
            <Link
              to={`/contact?type=partnership&subject=${defaultSubject}`}
              className="inline-flex items-center gap-2 rounded-lg bg-[#111827] px-4 py-2 text-sm font-semibold text-[#F59E0B] hover:opacity-95"
            >
              <FaEnvelope size={12} />
              Contact Vendor
            </Link>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
            {business.products.map((product) => (
              <button
                type="button"
                onClick={() => setSelectedProduct(product)}
                key={product.id}
                className="group text-left rounded-lg overflow-hidden border border-[#F59E0B] bg-white hover:shadow-md transition-shadow"
              >
                <div className="relative">
                  <img src={product.image} alt={product.name} className="h-28 w-full object-cover" />
                  <span className="absolute left-1.5 top-1.5 rounded bg-[#16A34A] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    New
                  </span>
                </div>
                <div className="p-2.5">
                  <p className="text-xs font-semibold text-[#111827] line-clamp-1">{product.name}</p>
                  <p className="mt-1 text-sm font-semibold text-[#111827]">{product.priceText}</p>
                  <div className="mt-2 flex items-center justify-between text-[10px] text-[#6B7280]">
                    <span>New</span>
                    <span className="inline-flex items-center gap-1 text-[#15803D]">
                      <FaTag size={8} />
                      In Stock
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-[#111827] mb-3">Business contacts</h2>
          <div className="space-y-2 text-sm text-[#374151]">
            <p className="inline-flex items-center gap-2">
              <FaEnvelope className="text-[#F97316]" />
              {contactEmail}
            </p>
            <p className="inline-flex items-center gap-2">
              <FaPhoneAlt className="text-[#F97316]" />
              {contactPhone}
            </p>
            {contactWebsite && (
              <a href={contactWebsite} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-[#2563EB] hover:underline break-all">
                <FaGlobe className="text-[#F97316]" />
                {contactWebsite}
              </a>
            )}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <a href={`mailto:${contactEmail}?subject=${defaultSubject}`} className="px-4 py-2 rounded-lg bg-[#111827] text-white text-sm font-semibold hover:opacity-95">
              Email Vendor
            </a>
            <a href={`tel:${contactPhone.replace(/\s+/g, '')}`} className="px-4 py-2 rounded-lg border border-[#111827] text-sm font-semibold hover:bg-gray-50">
              Call Vendor
            </a>
            <Link to={`/contact?type=partnership&subject=${defaultSubject}`} className="px-4 py-2 rounded-lg border border-[#F97316] text-[#F97316] text-sm font-semibold hover:bg-[#FFF7ED]">
              Contact Form
            </Link>
          </div>
        </section>
      </div>

      <Modal
        isOpen={Boolean(selectedProduct)}
        onClose={() => setSelectedProduct(null)}
        title="Product quick view"
        size="sm"
      >
        {selectedProduct && (
          <div>
            <img
              src={selectedProduct.image}
              alt={selectedProduct.name}
              className="w-full h-52 object-cover rounded-lg border border-gray-200"
            />
            <h4 className="mt-4 text-xl font-semibold text-[#111827]">{selectedProduct.name}</h4>
            <p className="mt-1 text-[#F97316] font-bold">{selectedProduct.priceText}</p>
            <p className="mt-1 text-sm text-[#6B7280]">{selectedProduct.minOrder}</p>
            <p className="mt-3 text-sm text-[#374151]">
              Seller: <span className="font-semibold">{business.name}</span>
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                to={`/products/${selectedProduct.id}`}
                className="px-4 py-2 rounded-lg bg-[#111827] text-white text-sm font-semibold hover:opacity-95"
                onClick={() => setSelectedProduct(null)}
              >
                Open Full Product
              </Link>
              <Link
                to={`/contact?type=partnership&subject=${defaultSubject}`}
                className="px-4 py-2 rounded-lg border border-[#F97316] text-[#F97316] text-sm font-semibold hover:bg-[#FFF7ED]"
                onClick={() => setSelectedProduct(null)}
              >
                Contact Vendor
              </Link>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default BusinessProfile;
