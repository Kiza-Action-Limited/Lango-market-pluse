// src/pages/Categories.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FaArrowRight,
  FaBoxes,
  FaGem,
  FaHeartbeat,
  FaHome,
  FaLaptop,
  FaLeaf,
  FaRunning,
  FaSearch,
  FaSeedling,
  FaShieldAlt,
  FaStore,
  FaThLarge,
  FaTruck,
} from 'react-icons/fa';
import api from '../config/axios';

const fallbackCategories = [
  { id: 'electronics', name: 'Electronics', description: 'Phones, devices, accessories, and daily tech.', icon: FaLaptop, tone: 'bg-blue-50 text-blue-700 border-blue-100' },
  { id: 'fashion', name: 'Fashion', description: 'Clothing, shoes, bags, and style essentials.', icon: FaGem, tone: 'bg-pink-50 text-pink-700 border-pink-100' },
  { id: 'home-garden', name: 'Home and Garden', description: 'Household goods, decor, tools, and garden items.', icon: FaHome, tone: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  { id: 'beauty-health', name: 'Beauty and Health', description: 'Care products, wellness supplies, and beauty picks.', icon: FaHeartbeat, tone: 'bg-rose-50 text-rose-700 border-rose-100' },
  { id: 'sports-outdoor', name: 'Sports and Outdoor', description: 'Fitness, travel, outdoor, and active living gear.', icon: FaRunning, tone: 'bg-orange-50 text-orange-700 border-orange-100' },
  { id: 'vegetables', name: 'Fresh Produce', description: 'Farm produce, grocery supply, and fresh essentials.', icon: FaSeedling, tone: 'bg-lime-50 text-lime-700 border-lime-100' },
  { id: 'agriculture', name: 'Agri Supplies', description: 'Supplies for growers, traders, and farm businesses.', icon: FaLeaf, tone: 'bg-green-50 text-green-700 border-green-100' },
  { id: 'other', name: 'Marketplace Finds', description: 'Explore more goods from verified marketplace sellers.', icon: FaBoxes, tone: 'bg-gray-50 text-gray-700 border-gray-100' },
];

const getCategoryId = (category = {}) => category.id || category._id || category.slug || category.name || '';
const getCategoryName = (category = {}) => category.name || category.title || category.label || getCategoryId(category);

const normalizeCategories = (rows = []) => {
  const source = Array.isArray(rows) && rows.length ? rows : fallbackCategories;
  return source.map((category, index) => {
    const fallback = fallbackCategories[index % fallbackCategories.length];
    const id = getCategoryId(category) || fallback.id;
    return {
      ...fallback,
      ...category,
      id,
      name: getCategoryName(category) || fallback.name,
      description: category.description || fallback.description,
      productCount: Number(category.productCount || category.productsCount || category.count || 0),
      icon: fallback.icon,
      tone: fallback.tone,
    };
  });
};

const CategorySkeleton = () => (
  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
    {Array.from({ length: 8 }).map((_, index) => (
      <div key={index} className="rounded-lg border border-gray-100 bg-white p-5 shadow-sm">
        <div className="h-12 w-12 rounded-md bg-gray-200 skeleton-shimmer" />
        <div className="mt-5 h-5 w-2/3 rounded bg-gray-200 skeleton-shimmer" />
        <div className="mt-3 h-4 w-full rounded bg-gray-200 skeleton-shimmer" />
        <div className="mt-2 h-4 w-3/4 rounded bg-gray-200 skeleton-shimmer" />
      </div>
    ))}
  </div>
);

const Categories = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await api.get('/categories');
      const rows = response.data?.categories || response.data?.data || [];
      setCategories(normalizeCategories(rows));
    } catch (error) {
      console.error('Error fetching categories:', error);
      setCategories(normalizeCategories([]));
    } finally {
      setLoading(false);
    }
  };

  const filteredCategories = useMemo(() => {
    const value = search.trim().toLowerCase();
    if (!value) return categories;
    return categories.filter((category) => (
      category.name.toLowerCase().includes(value) ||
      String(category.description || '').toLowerCase().includes(value)
    ));
  }, [categories, search]);

  const totalProducts = categories.reduce((sum, category) => sum + Number(category.productCount || 0), 0);

  return (
    <div className="min-h-screen bg-[#F7F8FA]">
      <section className="border-b border-gray-200 bg-white">
        <div className="container mx-auto grid gap-8 px-4 py-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#F97316]">Lango departments</p>
            <h1 className="mt-3 max-w-3xl text-3xl font-bold text-[#111827] sm:text-4xl">Shop categories built for real marketplace movement</h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-[#6B7280]">
              Move from product discovery to checkout, Verto escrow, QR delivery, and verified seller fulfillment from one organized marketplace.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-gray-200 bg-[#F9FAFB] p-4">
              <p className="text-xs font-semibold uppercase text-gray-500">Categories</p>
              <p className="mt-2 text-2xl font-bold text-[#111827]">{categories.length || fallbackCategories.length}</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-[#F9FAFB] p-4">
              <p className="text-xs font-semibold uppercase text-gray-500">Products</p>
              <p className="mt-2 text-2xl font-bold text-[#111827]">{totalProducts || 'Live'}</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-[#F9FAFB] p-4">
              <p className="text-xs font-semibold uppercase text-gray-500">Escrow</p>
              <p className="mt-2 text-2xl font-bold text-[#111827]">Verto</p>
            </div>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="relative min-w-0 flex-1 sm:max-w-md">
            <FaSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-11 w-full rounded-md border border-gray-300 bg-white pl-10 pr-3 text-sm outline-none transition focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20"
              placeholder="Search categories"
            />
          </div>
          <Link to="/products" className="inline-flex h-11 items-center gap-2 rounded-md bg-[#111827] px-4 text-sm font-semibold text-white transition hover:bg-black">
            Browse products <FaArrowRight size={12} />
          </Link>
        </div>

        {loading ? (
          <CategorySkeleton />
        ) : filteredCategories.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center">
            <FaThLarge className="mx-auto text-3xl text-[#F97316]" />
            <h3 className="mt-3 text-lg font-semibold text-[#111827]">No matching categories</h3>
            <p className="mt-1 text-sm text-[#6B7280]">Try a different search or browse all products.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {filteredCategories.map((category, index) => {
              const Icon = category.icon || FaThLarge;
              return (
                <Link
                  key={category.id || category.name}
                  to={`/products?category=${encodeURIComponent(category.id || category.name)}`}
                  className="category-landing-card group rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
                  style={{ animationDelay: `${index * 45}ms` }}
                >
                  <span className={`flex h-12 w-12 items-center justify-center rounded-md border ${category.tone}`}>
                    <Icon size={19} />
                  </span>
                  <div className="mt-5 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-lg font-bold text-[#111827] group-hover:text-[#F97316]">{category.name}</h2>
                      <p className="mt-2 line-clamp-3 min-h-[3.75rem] text-sm leading-5 text-[#6B7280]">{category.description}</p>
                    </div>
                    <FaArrowRight className="mt-1 shrink-0 text-[#F97316] transition group-hover:translate-x-1" size={14} />
                  </div>
                  <div className="mt-5 flex items-center justify-between border-t border-gray-100 pt-4 text-xs">
                    <span className="font-semibold text-[#111827]">{category.productCount ? `${category.productCount} products` : 'Live catalog'}</span>
                    <span className="font-semibold text-[#F97316]">Shop now</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section className="container mx-auto px-4 pb-12">
        <div className="grid gap-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm md:grid-cols-3">
          <div className="flex gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#FFF7ED] text-[#F97316]"><FaStore /></span>
            <div>
              <h3 className="font-semibold text-[#111827]">Verified sellers</h3>
              <p className="mt-1 text-sm text-[#6B7280]">Discover products from sellers with marketplace profiles and active catalogs.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-700"><FaShieldAlt /></span>
            <div>
              <h3 className="font-semibold text-[#111827]">Escrow checkout</h3>
              <p className="mt-1 text-sm text-[#6B7280]">Buyer payment can stay protected while delivery proof is completed.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-green-50 text-green-700"><FaTruck /></span>
            <div>
              <h3 className="font-semibold text-[#111827]">Delivery ready</h3>
              <p className="mt-1 text-sm text-[#6B7280]">Categories connect with logistics workflows, QR handoff, and tracking.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Categories;
