import React from 'react';
import { Link } from 'react-router-dom';
import { FaCheckCircle, FaRegCommentDots, FaBoxOpen, FaCalendarAlt, FaPhoneAlt } from 'react-icons/fa';

const SupplierCard = ({ supplier }) => {
  const badgeTags = supplier?.aiPrediction?.tags || [];
  const cover = supplier.coverImage || supplier.products?.[0]?.image;

  return (
    <article className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="bg-[#E5D0BC] px-4 py-3 border-b border-[#d8c0aa]">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="h-14 w-14 rounded-full border-2 border-white shadow overflow-hidden bg-[#111827]">
              {cover ? (
                <img src={cover} alt={`${supplier.name} logo`} className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full bg-[#1F2937]" />
              )}
            </div>
            <div>
              <h3 className="text-xl font-bold text-[#1f2937]">{supplier.name}</h3>
              <p className="text-sm text-[#4b5563]">We supply quality products at competitive prices.</p>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-[#4b5563]">
                <span className="inline-flex items-center gap-1 rounded-full bg-[#facc15] px-2 py-0.5 font-semibold text-[#111827]">
                  <FaCheckCircle size={10} />
                  Verified
                </span>
                <span className="inline-flex items-center gap-1">
                  <FaBoxOpen size={10} />
                  {supplier.products.length}+ Products
                </span>
                <span className="inline-flex items-center gap-1">
                  <FaCalendarAlt size={10} />
                  Joined Feb 2026
                </span>
                <span className="inline-flex items-center gap-1">
                  <FaRegCommentDots size={10} />
                  {supplier.businessType}
                </span>
              </div>
            </div>
          </div>
          <div className="shrink-0 flex flex-col gap-2">
            <Link
              to={`/businesses/${supplier.id}`}
              className="inline-flex items-center justify-center rounded-md border border-[#111827] bg-white px-4 py-2 text-sm font-semibold text-[#111827] hover:bg-gray-50"
            >
              View Business
            </Link>
            <Link
              to={`/contact?type=partnership&subject=${encodeURIComponent(`Supplier inquiry: ${supplier.name}`)}`}
              className="inline-flex items-center gap-1 rounded-md border border-[#111827] bg-[#0f2d4a] px-4 py-2 text-sm font-semibold text-[#f59e0b] hover:opacity-95"
            >
              <FaPhoneAlt size={12} />
              Contact Vendor
            </Link>
          </div>
        </div>
      </div>

      <div className="p-3 md:p-4">
        <div className="mb-3 flex flex-wrap gap-2 text-xs text-[#4B5563]">
          <span className="font-semibold text-[#111827]">AI Match {supplier.aiPrediction?.confidence || 0}%</span>
          <span>Rating {supplier.rating}/5 ({supplier.reviews})</span>
          <span>{supplier.annualSales}</span>
          {badgeTags.slice(0, 2).map((tag) => (
            <span key={tag} className="rounded-full bg-[#ECFDF5] px-2 py-0.5 text-[#166534]">{tag}</span>
          ))}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {supplier.products.map((product) => (
            <Link
              key={product.id}
              to={`/products/${product.id}`}
              className="rounded-md border border-[#f59e0b] bg-[#fdfdfd] overflow-hidden hover:shadow-md transition"
            >
              <div className="relative h-28 bg-gray-100">
                <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
                <span className="absolute left-1 top-1 rounded bg-[#10b981] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  New
                </span>
              </div>
              <div className="p-2">
                <p className="text-xs font-medium text-[#111827] line-clamp-1">{product.name}</p>
                <p className="mt-1 text-sm font-semibold text-[#374151]">{product.priceText}</p>
                <div className="mt-1 flex items-center justify-between text-[10px] text-[#6b7280]">
                  <span>New</span>
                  <span className="text-[#15803d] font-medium">In Stock</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </article>
  );
};

export default SupplierCard;
