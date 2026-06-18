// src/pages/Products.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import {
  FaDollarSign,
  FaFilter,
  FaSearch,
  FaSlidersH,
  FaSortAmountDown,
  FaStore,
  FaTags,
  FaTimes,
  FaUndo,
} from 'react-icons/fa';
import { productService } from '../services/productService';

const CATEGORY_LABELS = {
  electronics: 'Electronics',
  fashion: 'Fashion',
  'home-garden': 'Home and Garden',
  'beauty-health': 'Beauty and Health',
  'sports-outdoor': 'Sports and Outdoor',
  grocery: 'Grocery',
  vegetables: 'Vegetables',
};

const PRODUCT_CATEGORIES = Object.entries(CATEGORY_LABELS).map(([id, name]) => ({ id, name }));
const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'popular', label: 'Most Popular' },
  { value: 'rating', label: 'Highest Rated' },
];
const BUSINESS_TYPE_OPTIONS = [
  { value: '', label: 'Any business type' },
  { value: 'manufacturer', label: 'Manufacturer' },
  { value: 'wholesaler', label: 'Wholesaler' },
  { value: 'retailer', label: 'Retailer' },
  { value: 'farmer', label: 'Farmer' },
  { value: 'distributor', label: 'Distributor' },
];

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
    fetchProducts();
  }, [debouncedSearch, filters.category, filters.minPrice, filters.maxPrice, filters.sortBy, filters.businessType, pagination.page]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
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
    () => PRODUCT_CATEGORIES,
    []
  );

  const categoryNameById = useMemo(
    () => new Map(categoryOptions.map((cat) => [cat.id, cat.name])),
    [categoryOptions]
  );
  const activeFilterChips = useMemo(() => {
    const chips = [];
    if (filters.search) chips.push({ key: 'search', label: `Search: ${filters.search}` });
    if (filters.category) {
      chips.push({ key: 'category', label: categoryNameById.get(filters.category) || toTitleCase(filters.category) });
    }
    if (filters.businessType) chips.push({ key: 'businessType', label: toTitleCase(filters.businessType) });
    if (filters.minPrice) chips.push({ key: 'minPrice', label: `Min: Ksh ${filters.minPrice}` });
    if (filters.maxPrice) chips.push({ key: 'maxPrice', label: `Max: Ksh ${filters.maxPrice}` });
    if (filters.sortBy && filters.sortBy !== 'newest') {
      chips.push({
        key: 'sortBy',
        label: SORT_OPTIONS.find((option) => option.value === filters.sortBy)?.label || toTitleCase(filters.sortBy),
      });
    }
    return chips;
  }, [filters, categoryNameById]);

  const removeFilter = (key) => {
    handleFilterChange(key, key === 'sortBy' ? 'newest' : '');
  };

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
          className="lg:hidden btn-secondary flex items-center space-x-2"
        >
          <FaFilter />
          <span>Filters</span>
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Filters Sidebar */}
        <aside className={`${showFilters ? 'block' : 'hidden'} lg:block w-full lg:w-80`}>
          <div className="sticky top-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-start justify-between gap-3 border-b border-gray-200 pb-4">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[#FFF7ED] text-[#F97316]">
                  <FaSlidersH />
                </span>
                <div>
                  <h2 className="text-lg font-semibold text-[#111827]">Filters</h2>
                  <p className="text-xs text-[#6B7280]">{activeFilterChips.length} active</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-[#374151] hover:border-[#F97316] hover:text-[#F97316]"
                >
                  <FaUndo size={10} />
                  Clear All
                </button>
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-[#374151] lg:hidden"
                  onClick={() => setShowFilters(false)}
                  aria-label="Close filters"
                >
                  <FaTimes />
                </button>
              </div>
            </div>

            {activeFilterChips.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-2">
                {activeFilterChips.map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    onClick={() => removeFilter(chip.key)}
                    className="inline-flex max-w-full items-center gap-1 rounded-full bg-[#F3F4F6] px-3 py-1.5 text-xs font-medium text-[#374151] hover:bg-[#FFE7D3] hover:text-[#C2410C]"
                    title={`Remove ${chip.label}`}
                  >
                    <span className="truncate">{chip.label}</span>
                    <FaTimes size={10} />
                  </button>
                ))}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              {/* Search */}
              <div className="sm:col-span-2 lg:col-span-1">
                <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#111827]">
                  <FaSearch className="text-[#F97316]" size={12} />
                  Search
                </label>
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  placeholder="Product name..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20"
                />
              </div>

              {/* Category */}
              <div>
                <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#111827]">
                  <FaTags className="text-[#F97316]" size={12} />
                  Category
                </label>
                <select
                  value={filters.category}
                  onChange={(e) => handleFilterChange('category', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20"
                >
                  <option value="">All Categories</option>
                  {categoryOptions.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#111827]">
                  <FaStore className="text-[#F97316]" size={12} />
                  Business Type
                </label>
                <select
                  value={filters.businessType}
                  onChange={(e) => handleFilterChange('businessType', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20"
                >
                  {BUSINESS_TYPE_OPTIONS.map((option) => (
                    <option key={option.value || 'all'} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              {/* Price Range */}
              <div className="sm:col-span-2 lg:col-span-1">
                <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#111827]">
                  <FaDollarSign className="text-[#F97316]" size={12} />
                  Price Range
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    min="0"
                    value={filters.minPrice}
                    onChange={(e) => handleFilterChange('minPrice', e.target.value)}
                    placeholder="Min"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20"
                  />
                  <input
                    type="number"
                    min="0"
                    value={filters.maxPrice}
                    onChange={(e) => handleFilterChange('maxPrice', e.target.value)}
                    placeholder="Max"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none transition focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20"
                  />
                </div>
              </div>

              {/* Sort By */}
              <div className="sm:col-span-2 lg:col-span-1">
                <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#111827]">
                  <FaSortAmountDown className="text-[#F97316]" size={12} />
                  Sort By
                </label>
                <select
                  value={filters.sortBy}
                  onChange={(e) => handleFilterChange('sortBy', e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20"
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </aside>

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
