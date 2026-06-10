// src/pages/Products.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import { FaFilter, FaTimes } from 'react-icons/fa';
import { productService } from '../services/productService';

const CATEGORY_LABELS = {
  electronics: 'Electronics',
  fashion: 'Fashion',
  'home-garden': 'Home and Garden',
  'beauty-health': 'Beauty and Health',
  'sports-outdoor': 'Sports and Outdoor',
  grocery: 'Grocery',
};

const toTitleCase = (value) =>
  String(value)
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

const getCategoryId = (category) => {
  if (!category) return 'uncategorized';
  if (typeof category === 'object') {
    return String(category.id || category._id || category.slug || category.value || category.name || 'uncategorized');
  }
  return String(category);
};

const getCategoryName = (category) => {
  if (!category) return 'Uncategorized';
  if (typeof category === 'object') {
    return category.name || category.title || category.label || toTitleCase(getCategoryId(category));
  }
  return CATEGORY_LABELS[category] || toTitleCase(category);
};

const Products = ({ seller = false }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const initialFilters = useMemo(() => ({
    search: searchParams.get('search') || '',
    category: searchParams.get('category') || '',
    minPrice: searchParams.get('minPrice') || '',
    maxPrice: searchParams.get('maxPrice') || '',
    sortBy: searchParams.get('sortBy') || 'newest',
    businessType: searchParams.get('businessType') || '',
  }), [searchParams]);

  const [filters, setFilters] = useState({
    ...initialFilters,
  });
  const [debouncedSearch, setDebouncedSearch] = useState(initialFilters.search);
  const [categories, setCategories] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    totalPages: 1,
    total: 0
  });

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(filters.search), 300);
    return () => clearTimeout(timer);
  }, [filters.search]);

  useEffect(() => {
    setFilters({
      search: searchParams.get('search') || '',
      category: searchParams.get('category') || '',
      minPrice: searchParams.get('minPrice') || '',
      maxPrice: searchParams.get('maxPrice') || '',
      sortBy: searchParams.get('sortBy') || 'newest',
      businessType: searchParams.get('businessType') || '',
    });
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, [searchParams]);

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [debouncedSearch, filters.category, filters.minPrice, filters.maxPrice, filters.sortBy, filters.businessType, pagination.page]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.append('search', debouncedSearch);
      if (filters.category) params.append('category', filters.category);
      if (filters.minPrice) params.append('minPrice', filters.minPrice);
      if (filters.maxPrice) params.append('maxPrice', filters.maxPrice);
      if (filters.sortBy) params.append('sortBy', filters.sortBy);
      if (filters.businessType) params.append('businessType', filters.businessType);
      params.append('page', pagination.page);
      params.append('limit', 12);

      const payload = await productService.getAll({
        search: debouncedSearch || undefined,
        category: filters.category || undefined,
        minPrice: filters.minPrice || undefined,
        maxPrice: filters.maxPrice || undefined,
        sortBy: filters.sortBy || undefined,
        businessType: filters.businessType || undefined,
        page: pagination.page,
        limit: 12,
      });
      const productsData = payload.products || payload.data || payload.items || [];
      const paginationData = payload.pagination || {};

      setProducts(Array.isArray(productsData) ? productsData : []);
      setPagination({
        page: Number(payload.currentPage || payload.page || paginationData.page || 1),
        totalPages: Number(payload.totalPages || paginationData.pages || 1),
        total: Number(payload.totalProducts || payload.total || paginationData.total || 0),
      });
    } catch (error) {
      console.error('Error fetching products:', error);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const payload = await productService.getAll({ page: 1, limit: 120 });
      const liveProducts = payload?.products || payload?.data || payload?.items || [];
      const categoriesById = new Map();

      liveProducts.forEach((item) => {
        if (!item?.category) return;
        const id = getCategoryId(item.category);
        if (id === 'uncategorized' || categoriesById.has(id)) return;
        categoriesById.set(id, { id, name: getCategoryName(item.category) });
      });

      setCategories(Array.from(categoriesById.values()));
    } catch (error) {
      console.error('Error fetching categories:', error);
      setCategories([]);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => {
      const next = { ...prev, [key]: value };
      const nextQuery = new URLSearchParams();
      if (next.search) nextQuery.set('search', next.search);
      if (next.category) nextQuery.set('category', next.category);
      if (next.minPrice) nextQuery.set('minPrice', next.minPrice);
      if (next.maxPrice) nextQuery.set('maxPrice', next.maxPrice);
      if (next.sortBy && next.sortBy !== 'newest') nextQuery.set('sortBy', next.sortBy);
      if (next.businessType) nextQuery.set('businessType', next.businessType);
      setSearchParams(nextQuery, { replace: true });
      return next;
    });
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const clearFilters = () => {
    const next = {
      search: '',
      category: '',
      minPrice: '',
      maxPrice: '',
      sortBy: 'newest',
      businessType: '',
    };
    setFilters(next);
    setSearchParams(new URLSearchParams(), { replace: true });
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const categoryOptions = useMemo(
    () =>
      categories.map((cat) => ({
        id: getCategoryId(cat),
        name: getCategoryName(cat),
      })),
    [categories]
  );

  const categoryNameById = useMemo(
    () => new Map(categoryOptions.map((cat) => [cat.id, cat.name])),
    [categoryOptions]
  );

  const groupedProducts = useMemo(() => {
    const groupsByCategory = new Map();

    products.forEach((product) => {
      const categoryId = getCategoryId(product.category);
      const categoryName = categoryNameById.get(categoryId) || getCategoryName(product.category);

      if (!groupsByCategory.has(categoryId)) {
        groupsByCategory.set(categoryId, {
          id: categoryId,
          name: categoryName,
          products: [],
        });
      }

      groupsByCategory.get(categoryId).products.push(product);
    });

    return Array.from(groupsByCategory.values());
  }, [products, categoryNameById]);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">
          {seller ? 'My Products' : 'All Products'}
        </h1>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="md:hidden btn-secondary flex items-center space-x-2"
        >
          <FaFilter />
          <span>Filters</span>
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Filters Sidebar */}
        <div className={`${showFilters ? 'block' : 'hidden'} md:block w-full md:w-64 bg-white rounded-lg shadow-md p-4`}>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Filters</h2>
            <button onClick={clearFilters} className="text-sm text-primary hover:underline">
              Clear All
            </button>
            <button className="md:hidden" onClick={() => setShowFilters(false)}>
              <FaTimes />
            </button>
          </div>

          {/* Search */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Search</label>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              placeholder="Product name..."
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>

          {/* Category */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Category</label>
            <select
              value={filters.category}
              onChange={(e) => handleFilterChange('category', e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="">All Categories</option>
              {categoryOptions.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          {/* Price Range */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Price Range</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={filters.minPrice}
                onChange={(e) => handleFilterChange('minPrice', e.target.value)}
                placeholder="Min"
                className="w-1/2 px-3 py-2 border rounded-lg"
              />
              <input
                type="number"
                value={filters.maxPrice}
                onChange={(e) => handleFilterChange('maxPrice', e.target.value)}
                placeholder="Max"
                className="w-1/2 px-3 py-2 border rounded-lg"
              />
            </div>
          </div>

          {/* Sort By */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Sort By</label>
            <select
              value={filters.sortBy}
              onChange={(e) => handleFilterChange('sortBy', e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="newest">Newest First</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="popular">Most Popular</option>
              <option value="rating">Highest Rated</option>
            </select>
          </div>
        </div>

        {/* Products Grid */}
        <div className="flex-1">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 9 }).map((_, idx) => (
                <div key={idx} className="rounded-xl bg-white border border-gray-100 p-4">
                  <div className="h-44 rounded-md bg-gray-200 skeleton-shimmer" />
                  <div className="mt-4 h-4 w-4/5 rounded bg-gray-200 skeleton-shimmer" />
                  <div className="mt-2 h-4 w-2/3 rounded bg-gray-200 skeleton-shimmer" />
                  <div className="mt-4 h-8 w-1/2 rounded bg-gray-200 skeleton-shimmer" />
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">No products found</p>
              <button
                onClick={clearFilters}
                className="mt-4 btn-primary"
              >
                Clear Filters
              </button>
            </div>
          ) : (
            <>
              <div className="space-y-10">
                {groupedProducts.map((group) => (
                  <section key={group.id}>
                    <div className="mb-4 flex flex-wrap items-end justify-between gap-2 border-b border-gray-200 pb-3">
                      <div>
                        <h2 className="text-xl font-semibold text-[#111827]">{group.name}</h2>
                        <p className="text-sm text-gray-500">
                          {group.products.length} {group.products.length === 1 ? 'product' : 'products'}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                      {group.products.map((product) => (
                        <ProductCard key={product.id || product._id} product={product} />
                      ))}
                    </div>
                  </section>
                ))}
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="flex justify-center mt-8 space-x-2">
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                    disabled={pagination.page === 1}
                    className="px-4 py-2 border rounded-lg disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span className="px-4 py-2">
                    Page {pagination.page} of {pagination.totalPages}
                  </span>
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                    disabled={pagination.page === pagination.totalPages}
                    className="px-4 py-2 border rounded-lg disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Products;
