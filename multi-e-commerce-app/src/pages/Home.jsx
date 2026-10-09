import React from 'react';
import { Link } from 'react-router-dom';
import { FaArrowRight, FaGem, FaHeartbeat, FaHome, FaLaptop, FaLeaf, FaRunning, FaSeedling, FaThLarge } from 'react-icons/fa';
import ProductCard from '../components/ProductCard';
import UnimartStyleShowcase from '../components/MarketPulseShowcase';
import LazyOnVisible from '../components/LazyOnVisible';
import MarketplaceTrustFlow from '../components/home/MarketplaceTrustFlow';
import HomeBelowFold from '../components/home/HomeBelowFold';
import { useFetchData } from '../hooks/useFetchData';
import { fetchHomePayload, HOME_DATA_KEY } from '../services/homeDataService';

const categoryFallbacks = [
  { id: 'electronics', name: 'Electronics', detail: 'Phones, gadgets, accessories', icon: FaLaptop, tone: 'bg-blue-50 text-blue-700 border-blue-100' },
  { id: 'fashion', name: 'Fashion', detail: 'Clothing, shoes, and style picks', icon: FaGem, tone: 'bg-pink-50 text-pink-700 border-pink-100' },
  { id: 'home-garden', name: 'Home and Garden', detail: 'Essentials for home and living', icon: FaHome, tone: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  { id: 'beauty-health', name: 'Beauty and Health', detail: 'Wellness and care products', icon: FaHeartbeat, tone: 'bg-rose-50 text-rose-700 border-rose-100' },
  { id: 'sports-outdoor', name: 'Sports and Outdoor', detail: 'Fitness and travel equipment', icon: FaRunning, tone: 'bg-orange-50 text-orange-700 border-orange-100' },
  { id: 'vegetables', name: 'Fresh Produce', detail: 'Farm goods and grocery supply', icon: FaSeedling, tone: 'bg-lime-50 text-lime-700 border-lime-100' },
  { id: 'agriculture', name: 'Agri Supplies', detail: 'Tools for growers and traders', icon: FaLeaf, tone: 'bg-green-50 text-green-700 border-green-100' },
  { id: '', name: 'All Categories', detail: 'Explore the full marketplace', icon: FaThLarge, tone: 'bg-gray-50 text-gray-700 border-gray-100', to: '/categories' },
];

const normalizeCategoryId = (category = {}) => category.id || category._id || category.slug || category.name || '';

const buildHomeCategories = (categories = []) => {
  const liveCategories = categories
    .filter(Boolean)
    .slice(0, 8)
    .map((category, index) => {
      const fallback = categoryFallbacks[index % categoryFallbacks.length];
      const id = normalizeCategoryId(category);
      return {
        ...fallback,
        ...category,
        id,
        name: category.name || category.label || fallback.name,
        detail: category.description || fallback.detail,
        icon: fallback.icon,
        tone: fallback.tone,
        to: category.to || `/products?category=${encodeURIComponent(id)}`,
      };
    });

  return liveCategories.length >= 4 ? liveCategories : categoryFallbacks;
};

const Home = () => {
  const { data, loading } = useFetchData(HOME_DATA_KEY, fetchHomePayload, {
    initialData: { featuredProducts: [], categories: [], businessPartners: [] },
  });

  const featuredProducts = data?.featuredProducts || [];
  const homeCategories = buildHomeCategories(data?.categories || []);

  return (
    <div className="bg-[#F9FAFB] animate-fade-in">
      <MarketplaceTrustFlow />
      <UnimartStyleShowcase homepageAds={data?.homepageAds} />

      <section className="bg-white py-10">
        <div className="container mx-auto px-4">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#F97316]">Shop by category</p>
              <h2 className="mt-2 text-2xl font-bold text-[#111827] sm:text-3xl">Find what your market needs</h2>
              <p className="mt-2 max-w-2xl text-sm text-[#6B7280]">Browse fast-moving products from verified sellers, farmers, retailers, and logistics-ready suppliers.</p>
            </div>
            <Link to="/categories" className="inline-flex min-h-10 items-center gap-2 rounded-md bg-[#111827] px-4 text-sm font-semibold text-white transition hover:bg-black">
              All categories <FaArrowRight size={12} />
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {homeCategories.map((category, index) => {
              const Icon = category.icon || FaThLarge;
              return (
                <Link
                  key={category.id || category.name}
                  to={category.to || `/products?category=${encodeURIComponent(category.id)}`}
                  className="category-landing-card group rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
                  style={{ animationDelay: `${index * 55}ms` }}
                >
                  <span className={`flex h-11 w-11 items-center justify-center rounded-md border ${category.tone}`}>
                    <Icon size={18} />
                  </span>
                  <h3 className="mt-4 truncate text-sm font-bold text-[#111827] group-hover:text-[#F97316] sm:text-base">{category.name}</h3>
                  <p className="mt-1 line-clamp-2 min-h-9 text-xs leading-5 text-[#6B7280]">{category.detail}</p>
                  <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#F97316]">
                    Browse <FaArrowRight size={10} />
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-16 bg-[#F9FAFB]">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-4 text-[#F97316]">Featured Products</h2>
          <p className="text-center text-[#6B7280] mb-12">Curated selections from trusted sellers across Kenya</p>

          {loading ? (
            <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,220px))] justify-center gap-4">
              {Array.from({ length: 8 }).map((_, idx) => (
                <div key={idx} className="rounded-xl bg-white border border-gray-100 p-4">
                  <div className="h-44 rounded-md bg-gray-200 skeleton-shimmer" />
                  <div className="mt-4 h-4 w-4/5 rounded bg-gray-200 skeleton-shimmer" />
                  <div className="mt-2 h-4 w-2/3 rounded bg-gray-200 skeleton-shimmer" />
                  <div className="mt-4 h-8 w-1/2 rounded bg-gray-200 skeleton-shimmer" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,220px))] justify-center gap-4 content-fade-in">
              {featuredProducts.map((product) => (
                <ProductCard key={product.id || product._id} product={product} />
              ))}
            </div>
          )}
        </div>
      </section>

      <LazyOnVisible
        fallback={<div className="h-60 bg-white border-y border-gray-100 skeleton-shimmer" />}
      >
        <HomeBelowFold
          businessPartners={data?.businessPartners || []}
          loading={loading}
        />
      </LazyOnVisible>
    </div>
  );
};

export default Home;
