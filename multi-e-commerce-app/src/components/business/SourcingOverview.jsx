import React from 'react';
import { Link } from 'react-router-dom';
import { FaChevronRight, FaClipboardList, FaIndustry, FaUserCircle } from 'react-icons/fa';

const SourcingOverview = ({ categories = [], products = [], topSuppliers = [] }) => {
  const sampleProducts = products.slice(0, 2);
  const rankingProducts = products.slice(2, 6);

  return (
    <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
      <article className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="font-semibold text-[#111827] mb-3">Source by category</h3>
        <ul className="space-y-2">
          {categories.slice(0, 6).map((category) => (
            <li key={category.id}>
              <Link to={`/products?category=${category.id}`} className="flex items-center justify-between text-sm text-[#374151] hover:text-[#F97316]">
                <span>{category.name}</span>
                <FaChevronRight size={12} />
              </Link>
            </li>
          ))}
        </ul>
      </article>

      <article className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="font-semibold text-[#111827] mb-3">Get samples</h3>
        <div className="grid grid-cols-2 gap-2">
          {sampleProducts.map((product) => (
            <div key={product.id} className="rounded-lg bg-gray-50 p-2">
              <img src={product.images?.[0]} alt={product.name} className="w-full h-20 object-cover rounded-md" />
              <p className="mt-2 text-xs text-[#111827] line-clamp-2">{product.name}</p>
            </div>
          ))}
        </div>
      </article>

      <article className="bg-white rounded-xl border border-gray-200 p-4">
        <h3 className="font-semibold text-[#111827] mb-3">Top-ranking manufacturers</h3>
        <div className="grid grid-cols-2 gap-2">
          {rankingProducts.map((product) => (
            <div key={product.id} className="rounded-lg bg-gray-50 p-2">
              <img src={product.images?.[0]} alt={product.name} className="w-full h-20 object-cover rounded-md" />
              <p className="mt-2 text-xs text-[#111827] line-clamp-1">{product.name}</p>
            </div>
          ))}
        </div>
      </article>

      <article className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-2 text-[#6B7280] mb-4">
          <FaUserCircle />
          <p className="text-sm">Welcome! Guest</p>
        </div>
        <div className="flex gap-2 mb-4">
          <Link to="/login" className="flex-1 text-center px-3 py-2 rounded-full bg-[#F97316] text-white text-sm font-semibold hover:bg-[#EA580C]">
            Sign in
          </Link>
          <Link to="/register" className="flex-1 text-center px-3 py-2 rounded-full bg-[#FB923C] text-white text-sm font-semibold hover:opacity-90">
            Join for free
          </Link>
        </div>
        <div className="text-xs text-[#6B7280] mb-2">One request, multiple quotes</div>
        <Link to="/contact" className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-full border-2 border-[#111827] text-sm font-semibold hover:bg-gray-50">
          <FaClipboardList />
          Request for Quotation
        </Link>
        <div className="mt-3 text-xs text-[#6B7280]">
          Top suppliers now: <span className="font-semibold text-[#111827]">{topSuppliers.length}</span>
        </div>
      </article>
    </section>
  );
};

export default SourcingOverview;
