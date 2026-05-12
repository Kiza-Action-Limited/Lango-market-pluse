// src/pages/Categories.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { FaTag, FaStore, FaArrowRight, FaBrain } from 'react-icons/fa';

const Categories = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/categories');
      setCategories(response.data.categories);
    } catch (error) {
      console.error('Error fetching categories:', error);
    } finally {
      setLoading(false);
    }
  };

  // Category color mapping for gradient backgrounds
  const categoryGradients = [
    'from-[#F97316] to-[#FB923C]',
    'from-[#FB923C] to-[#F97316]',
    'from-[#16A34A] to-[#F97316]',
    'from-[#F97316] to-[#FB923C]',
    'from-[#F97316] to-[#16A34A]',
    'from-[#FB923C] to-[#F97316]',
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#F97316]"></div>
      </div>
    );
  }

  return (
    <div className="bg-[#F9FAFB] min-h-screen py-8">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-2">
            <FaTag className="text-[#F97316] text-3xl" />
            <h1 className="text-3xl font-bold text-[#F97316]">Shop by Category</h1>
          </div>
          <p className="text-[#6B7280] max-w-2xl mx-auto">
            Lango Lako la Biashara Smart — Browse products across diverse categories from trusted sellers
          </p>
        </div>
        
        {/* Categories Grid */}
        {categories.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-12 text-center">
            <div className="text-6xl mb-4">📦</div>
            <h3 className="text-xl font-semibold text-[#111827] mb-2">No Categories Available</h3>
            <p className="text-[#6B7280]">Check back soon for new product categories</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {categories.map((category, index) => {
              const gradient = categoryGradients[index % categoryGradients.length];
              const productCount = category.productCount || 0;
              
              return (
                <Link
                  key={category.id}
                  to={`/products?category=${category.id}`}
                  className="group bg-white rounded-xl shadow-md overflow-hidden hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
                >
                  <div className={`h-40 bg-linear-to-r ${gradient} flex items-center justify-center relative overflow-hidden`}>
                    <span className="text-7xl transform group-hover:scale-110 transition-transform duration-300">
                      {category.icon || '📦'}
                    </span>
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                  </div>
                  <div className="p-5">
                    <h2 className="text-xl font-bold mb-2 text-[#111827] group-hover:text-[#F97316] transition-colors">
                      {category.name}
                    </h2>
                    <p className="text-[#6B7280] text-sm mb-3 line-clamp-2">
                      {category.description || `Explore our ${category.name} collection`}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-[#FB923C] bg-[#FB923C]/10 px-3 py-1 rounded-full">
                        {productCount} {productCount === 1 ? 'product' : 'products'}
                      </span>
                      <span className="flex items-center gap-1 text-[#F97316] font-medium text-sm group-hover:gap-2 transition-all">
                        Browse <FaArrowRight size={12} />
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
        
        {/* Featured Business Types Section */}
        {categories.length > 0 && (
          <div className="mt-12 bg-linear-to-r from-[#F97316]/5 to-[#FB923C]/5 rounded-xl p-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <FaStore className="text-[#F97316] text-2xl" />
                <div>
                  <h3 className="font-semibold text-[#111827]">Multi-Vendor Marketplace</h3>
                  <p className="text-sm text-[#6B7280]">Products from brands, wholesalers, retailers, farmers & small businesses</p>
                </div>
              </div>
              <Link 
                to="/products" 
                className="px-4 py-2 bg-[#F97316] text-white rounded-lg text-sm font-medium hover:bg-[#F97316]/90 transition-colors"
              >
                Browse All Products
              </Link>
            </div>
          </div>
        )}
        
        {/* AI Intelligence Tip */}
        {categories.length > 3 && (
           <div className="mt-8 bg-linear-to-r from-[#FB923C]/10 to-[#F97316]/10 rounded-xl p-4 border border-[#FB923C]/20">
            <div className="flex items-start gap-3">
              <FaBrain className="text-[#FB923C] text-xl mt-0.5" />
              <div>
                <h4 className="font-semibold text-[#111827] mb-1">AI Intelligence Insight</h4>
                <p className="text-sm text-[#6B7280]">
                  Based on browsing trends, <span className="font-medium text-[#16A34A]">{categories[0]?.name}</span> and{' '}
                  <span className="font-medium text-[#16A34A]">{categories[1]?.name}</span> are the most popular categories this week.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Categories;