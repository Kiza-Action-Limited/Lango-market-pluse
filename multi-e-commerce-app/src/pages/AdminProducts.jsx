// src/pages/AdminProducts.jsx
import React, { useEffect, useState } from 'react';
import api from '../config/axios';
import { FaSearch, FaBox, FaStore, FaChartLine, FaFilter } from 'react-icons/fa';
import toast from 'react-hot-toast';
import { formatCurrency } from '../utils/formatters';

const AdminProducts = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  const getProductId = (product) => product?._id || product?.id;
  const isProductActive = (product) => {
    if (typeof product?.isActive === 'boolean') return product.isActive;
    if (typeof product?.active === 'boolean') return product.active;
    if (typeof product?.status === 'string') return product.status.toLowerCase() === 'active';
    return false;
  };
  const getStock = (product) => product?.stock ?? product?.quantity ?? product?.inventory ?? product?.inventoryCount ?? 0;
  const getSellerName = (product) =>
    product?.seller?.businessName ||
    product?.seller?.name ||
    product?.sellerName ||
    product?.vendorName ||
    'Unknown Seller';
  const getImage = (product) => product?.images?.[0]?.url || product?.images?.[0] || '';

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      let response;
      try {
        response = await api.get('/v1/admin/products');
      } catch (error) {
        if (error.response?.status === 404) {
          response = await api.get('/admin/products');
        } else {
          throw error;
        }
      }
      const productsList =
        response.data?.products ||
        response.data?.data?.products ||
        response.data?.data ||
        response.data ||
        [];
      setProducts(Array.isArray(productsList) ? productsList : []);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const toggleProductStatus = async (productId, isActive) => {
    if (!productId) {
      toast.error('Product id is missing');
      return;
    }
    try {
      const candidates = [
        () => api.put(`/v1/admin/products/${productId}/toggle`, {}),
        () => api.put(`/admin/products/${productId}/toggle`, {}),
        () => api.put(`/v1/admin/products/${productId}`, { isActive: !isActive }),
        () => api.put(`/admin/products/${productId}`, { isActive: !isActive }),
      ];

      let lastError;
      for (const request of candidates) {
        try {
          await request();
          lastError = null;
          break;
        } catch (error) {
          lastError = error;
          if (error.response?.status === 401 || error.response?.status === 403) {
            throw error;
          }
        }
      }

      if (lastError) throw lastError;
      toast.success(isActive ? 'Product deactivated' : 'Product activated');
      fetchProducts();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update product status');
    }
  };

  const stats = {
    total: products.length,
    active: products.filter((p) => isProductActive(p)).length,
    inactive: products.filter((p) => !isProductActive(p)).length,
    totalValue: products.reduce((sum, p) => sum + ((Number(p.price) || 0) * getStock(p)), 0),
  };

  const filteredProducts = products.filter((product) => {
    const name = String(product?.name || '').toLowerCase();
    const seller = String(getSellerName(product)).toLowerCase();
    const q = search.toLowerCase();
    const matchesSearch = name.includes(q) || seller.includes(q);
    const matchesFilter =
      filter === 'all' ||
      (filter === 'active' && isProductActive(product)) ||
      (filter === 'inactive' && !isProductActive(product));
    return matchesSearch && matchesFilter;
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#F97316]" />
      </div>
    );
  }

  return (
    <div className="bg-[#F9FAFB] min-h-screen py-8">
      <div className="container mx-auto px-4">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <FaBox className="text-[#F97316] text-3xl" />
            <h1 className="text-3xl font-bold text-[#F97316]">Manage Products</h1>
          </div>
          <p className="text-[#6B7280]">Lango Lako la Biashara Smart - Oversee all products listed on the platform</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-[#F97316]">
            <p className="text-[#6B7280] text-xs uppercase tracking-wide">Total Products</p>
            <p className="text-2xl font-bold text-[#111827]">{stats.total}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-[#16A34A]">
            <p className="text-[#6B7280] text-xs uppercase tracking-wide">Active Products</p>
            <p className="text-2xl font-bold text-[#16A34A]">{stats.active}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-[#F97316]">
            <p className="text-[#6B7280] text-xs uppercase tracking-wide">Inactive Products</p>
            <p className="text-2xl font-bold text-[#F97316]">{stats.inactive}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-[#FB923C]">
            <p className="text-[#6B7280] text-xs uppercase tracking-wide">Inventory Value</p>
            <p className="text-xl font-bold text-[#FB923C]">{formatCurrency(stats.totalValue)}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex-1 min-w-50">
              <div className="relative">
                <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#6B7280]" />
                <input
                  type="text"
                  placeholder="Search by product name or seller..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F97316] focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <FaFilter className="text-[#6B7280]" />
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FB923C] focus:border-transparent"
              >
                <option value="all">All Products</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Only</option>
              </select>
            </div>
          </div>
        </div>

        {stats.inactive > stats.active * 0.5 && (
          <div className="mb-6 bg-linear-to-r from-[#FB923C]/10 to-[#F97316]/10 rounded-xl p-4 border border-[#FB923C]/20">
            <div className="flex items-start gap-3">
              <FaChartLine className="text-[#FB923C] text-xl mt-0.5" />
              <div>
                <h4 className="font-semibold text-[#111827] mb-1">AI Intelligence Insight</h4>
                <p className="text-sm text-[#6B7280]">
                  {stats.inactive} products are currently inactive. Reviewing and reactivating popular items could increase platform revenue.
                </p>
              </div>
            </div>
          </div>
        )}

        {filteredProducts.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-12 text-center">
            <div className="text-6xl mb-4">No products</div>
            <h3 className="text-xl font-semibold text-[#111827] mb-2">No Products Found</h3>
            <p className="text-[#6B7280]">{search ? `No results for "${search}"` : 'No products are currently listed'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts.map((product) => {
              const active = isProductActive(product);
              const stock = getStock(product);
              const id = getProductId(product);
              const image = getImage(product);
              return (
                <div key={id || `${product.name}-${Math.random()}`} className="bg-white rounded-2xl shadow-md overflow-hidden border border-gray-200 hover:shadow-lg transition-all">
                  <div className="h-44 bg-linear-to-br from-gray-100 to-gray-200 relative">
                    {image ? (
                      <img src={image} alt={product.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-[#6B7280]">
                        <FaBox className="text-4xl mb-2" />
                        <span className="text-sm">No Image</span>
                      </div>
                    )}
                    <div className={`absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-medium shadow-sm ${active ? 'bg-[#16A34A] text-white' : 'bg-red-500 text-white'}`}>
                      {active ? 'Active' : 'Inactive'}
                    </div>
                  </div>

                  <div className="p-5">
                    <h3 className="text-lg font-semibold mb-1 text-[#111827] line-clamp-1">{product.name}</h3>
                    <div className="flex items-center gap-2 mb-2">
                      <FaStore className="text-[#6B7280] text-xs" />
                      <p className="text-[#6B7280] text-sm">{getSellerName(product)}</p>
                    </div>
                    <p className="text-[#F97316] font-bold text-xl mb-2">{formatCurrency(Number(product.price) || 0)}</p>
                    <p className={`text-sm mb-5 ${stock < 10 ? 'text-[#F97316]' : 'text-[#6B7280]'}`}>
                      Stock: {stock} {stock < 10 && stock > 0 ? 'Low stock' : ''}
                    </p>

                    <div className="flex items-center justify-between rounded-xl bg-gray-50 border border-gray-200 p-3">
                      <span className="text-sm font-medium text-[#111827]">{active ? 'ON' : 'OFF'}</span>
                      <button
                        type="button"
                        onClick={() => toggleProductStatus(id, active)}
                        className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors ${active ? 'bg-[#16A34A]' : 'bg-gray-300'}`}
                      >
                        <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${active ? 'translate-x-8' : 'translate-x-1'}`} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {filteredProducts.length > 0 && (
          <div className="mt-6 text-center text-sm text-[#6B7280]">
            Showing {filteredProducts.length} of {products.length} products
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminProducts;
