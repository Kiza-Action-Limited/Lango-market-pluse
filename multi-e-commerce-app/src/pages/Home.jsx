import React, { Suspense, lazy } from 'react';
import ProductCard from '../components/ProductCard';
import UnimartStyleShowcase from '../components/MarketPulseShowcase';
import LazyOnVisible from '../components/LazyOnVisible';
import { useFetchData } from '../hooks/useFetchData';
import { fetchHomePayload, HOME_DATA_KEY } from '../services/homeDataService';

const HomeBelowFold = lazy(() => import('../components/home/HomeBelowFold'));

const Home = () => {
  const { data, loading } = useFetchData(HOME_DATA_KEY, fetchHomePayload, {
    initialData: { featuredProducts: [], categories: [], businessPartners: [] },
  });

  const featuredProducts = data?.featuredProducts || [];

  return (
    <div className="bg-[#F9FAFB] animate-fade-in">
      <UnimartStyleShowcase />


      <LazyOnVisible
        fallback={<div className="h-60 bg-white border-y border-gray-100 skeleton-shimmer" />}
      >
        <Suspense fallback={<div className="h-60 bg-white border-y border-gray-100 skeleton-shimmer" />}>
          <HomeBelowFold
            categories={data?.categories || []}
            businessPartners={data?.businessPartners || []}
          />
        </Suspense>
      </LazyOnVisible>
      
      <section className="py-16 bg-[#F9FAFB]">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-4 text-[#F97316]">Featured Products</h2>
          <p className="text-center text-[#6B7280] mb-12">Curated selections from trusted sellers across Kenya</p>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 content-fade-in">
              {featuredProducts.map((product) => (
                <ProductCard key={product.id || product._id} product={product} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default Home;
