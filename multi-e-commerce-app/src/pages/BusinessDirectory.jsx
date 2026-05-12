import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FaStore } from 'react-icons/fa';
import { useRealtimeManufacturers } from '../hooks/useRealtimeManufacturers';

const BusinessDirectory = () => {
  const [searchParams] = useSearchParams();
  const initialType = searchParams.get('type') || 'all';
  const [activeType, setActiveType] = useState(initialType);
  const { baseSuppliers, loading } = useRealtimeManufacturers();

  const businessTypes = useMemo(() => {
    const types = Array.from(new Set(baseSuppliers.map((item) => item.businessType).filter(Boolean)));
    return ['all', ...types];
  }, [baseSuppliers]);

  const visibleBusinesses = useMemo(() => {
    if (activeType === 'all') return baseSuppliers;
    return baseSuppliers.filter(
      (item) => String(item.businessType || '').toLowerCase() === activeType.toLowerCase()
    );
  }, [baseSuppliers, activeType]);

  return (
    <div className="bg-[#F9FAFB] min-h-screen py-8">
      <div className="container mx-auto px-4">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-[#111827]">Business Directory</h1>
          <p className="text-[#6B7280] mt-1">Browse by business type and open each business profile with products.</p>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {businessTypes.map((type) => (
            <button
              key={type}
              onClick={() => setActiveType(type)}
              className={`px-3 py-1.5 rounded-full border text-sm ${
                activeType === type
                  ? 'bg-[#111827] border-[#111827] text-white'
                  : 'bg-white border-gray-300 text-[#374151] hover:border-[#F97316] hover:text-[#F97316]'
              }`}
            >
              {type === 'all' ? 'All business types' : type}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#F97316]" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {visibleBusinesses.map((business) => (
              <article key={business.id} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <FaStore className="text-[#F97316]" />
                  <h2 className="font-semibold text-[#111827]">{business.name}</h2>
                </div>
                <p className="text-xs text-[#6B7280] mb-3">
                  {business.businessType} | {business.years} yr | {business.staffRange}
                </p>
                <p className="text-sm text-[#374151] mb-3">
                  Rating: <span className="font-semibold">{business.rating}/5</span> ({business.reviews} reviews)
                </p>
                <div className="mb-3">
                  <p className="text-xs text-[#6B7280] mb-2">Products in this business:</p>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {business.products.slice(0, 6).map((product) => (
                      <Link
                        key={product.id}
                        to={`/products/${product.id}`}
                        className="w-28 shrink-0 rounded-md border border-gray-200 bg-gray-50 p-1.5 hover:ring-2 hover:ring-[#FB923C]/40"
                      >
                        <img src={product.image} alt={product.name} className="h-16 w-full object-cover rounded" />
                        <p className="text-[11px] text-[#111827] font-medium mt-1 line-clamp-1">{product.name}</p>
                        <p className="text-[11px] text-[#F97316] font-semibold">{product.priceText}</p>
                      </Link>
                    ))}
                  </div>
                </div>
                <Link
                  to={`/businesses/${business.id}`}
                  className="inline-flex items-center justify-center w-full px-3 py-2 rounded-lg bg-[#F97316] text-white text-sm font-semibold hover:bg-[#EA580C]"
                >
                  View Business Profile
                </Link>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default BusinessDirectory;
