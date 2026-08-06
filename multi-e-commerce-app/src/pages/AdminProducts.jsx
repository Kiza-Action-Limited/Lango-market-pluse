// src/pages/AdminProducts.jsx
import React, { useEffect, useState } from 'react';
import api from '../config/axios';
import { FaSearch, FaBox, FaStore, FaChartLine, FaFilter, FaEdit, FaTrash, FaSave, FaTimes, FaFileCsv } from 'react-icons/fa';
import toast from 'react-hot-toast';
import { formatCurrency } from '../utils/formatters';
import BulkProductCsvJournal from '../components/BulkProductCsvJournal';
import { getEffectiveUserCategory } from '../utils/userCategory';

const AdminProducts = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [editingProduct, setEditingProduct] = useState(null);
  const [editForm, setEditForm] = useState({
    name: '',
    category: 'other',
    price: '',
    quantityAvailable: '',
    minThreshold: '',
    unit: 'piece',
    locationHub: '',
    description: '',
    isPublished: true,
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [sellerOptions, setSellerOptions] = useState([]);
  const [selectedSellerId, setSelectedSellerId] = useState('');

  const productCategories = [
    'electronics',
    'fashion',
    'home-garden',
    'beauty-health',
    'sports-outdoor',
    'grocery',
    'vegetables',
    'grains-cereals',
    'food-staples',
    'sugar-baking',
    'cooking-oil',
    'dairy-eggs',
    'meat-fish',
    'beverages',
    'household',
    'farm-inputs',
    'other',
  ];
  const units = ['kg', 'g', 'ton', 'piece', 'bunch', 'litre'];

  const getProductId = (product) => product?._id || product?.id;
  const isProductActive = (product) => {
    if (typeof product?.isPublished === 'boolean') return product.isPublished;
    if (typeof product?.isActive === 'boolean') return product.isActive;
    if (typeof product?.active === 'boolean') return product.active;
    if (typeof product?.status === 'string') return product.status.toLowerCase() === 'active';
    return false;
  };
  const getStock = (product) => product?.stock ?? product?.quantityAvailable ?? product?.quantity ?? product?.inventory ?? product?.inventoryCount ?? 0;
  const getThreshold = (product) => Number(product?.minThreshold ?? product?.lowStockThreshold ?? 10);
  const getSku = (product) => product?.sku || product?.trackingSku || product?.SKU || product?.stockKeepingUnit || 'SKU pending';
  const getInventoryGraph = (product) => {
    const graph = Array.isArray(product?.inventoryGraph)
      ? product.inventoryGraph
      : Array.isArray(product?.inventoryHistory)
        ? product.inventoryHistory
        : [];

    if (graph.length > 0) {
      return graph.map((point) => ({
        onHand: Number(point.onHand ?? point.quantityAvailable ?? point.quantity ?? 0),
        reserved: Number(point.reserved ?? point.reservedQuantity ?? 0),
        available: Number(point.available ?? point.availableQuantity ?? point.onHand ?? 0),
        recordedAt: point.recordedAt || point.createdAt,
      })).slice(-12);
    }

    const stock = Number(getStock(product) || 0);
    return [{ onHand: stock, reserved: Number(product?.reservedQuantity || 0), available: stock }];
  };
  const getSellerName = (product) =>
    product?.seller?.businessName ||
    product?.seller?.name ||
    product?.sellerName ||
    product?.vendorName ||
    'Unknown Seller';
  const getSellerUserId = (seller) => seller?._id || seller?.id || seller?.userId;
  const getSellerDisplayName = (seller) => seller?.businessName || seller?.fullName || seller?.name || seller?.email || seller?.phone || 'Unnamed seller';
  const getImage = (product) => product?.images?.[0]?.url || product?.images?.[0] || '';
  const formatOption = (value) => String(value || '').replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

  useEffect(() => {
    fetchProducts();
    fetchSellerOptions();
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

  const fetchSellerOptions = async () => {
    try {
      const response = await api.get('/v1/admin/users', {
        params: { role: 'all', status: 'all', limit: 200 },
      });
      const users = Array.isArray(response.data?.users) ? response.data.users : [];
      const sellerCategories = new Set(['brand', 'wholesaler', 'manufacturer', 'retailer', 'farmer', 'small_business']);
      const sellers = users.filter((user) => getSellerUserId(user) && sellerCategories.has(getEffectiveUserCategory(user)));
      setSellerOptions(sellers);
      setSelectedSellerId((current) => current || getSellerUserId(sellers[0]) || '');
    } catch (error) {
      console.error('Error fetching sellers for product helper:', error);
      setSellerOptions([]);
    }
  };

  const createProductForSeller = async (formData) => {
    const requests = [
      () => api.post('/v1/admin/products', formData),
      () => api.post('/admin/products', formData),
    ];
    let lastError;

    for (const request of requests) {
      try {
        return await request();
      } catch (error) {
        lastError = error;
        if (error.response?.status === 401 || error.response?.status === 403) {
          throw error;
        }
      }
    }

    throw lastError;
  };

  const openEditProduct = (product) => {
    setEditingProduct(product);
    setEditForm({
      name: product?.name || '',
      category: product?.category || 'other',
      price: product?.price ?? '',
      quantityAvailable: getStock(product),
      minThreshold: product?.minThreshold ?? getThreshold(product),
      unit: product?.unit || 'piece',
      locationHub: product?.locationHub || '',
      description: product?.description || '',
      isPublished: isProductActive(product),
    });
  };

  const handleEditChange = (event) => {
    const { name, value, type, checked } = event.target;
    setEditForm((previous) => ({ ...previous, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleUpdateProduct = async (event) => {
    event.preventDefault();
    const productId = getProductId(editingProduct);
    if (!productId) return;

    setSavingEdit(true);
    try {
      const payload = {
        ...editForm,
        price: Number(editForm.price),
        quantityAvailable: Number(editForm.quantityAvailable),
        minThreshold: Number(editForm.minThreshold),
      };
      await api.put(`/v1/admin/products/${productId}`, payload);
      toast.success('Product updated');
      setEditingProduct(null);
      fetchProducts();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update product');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteProduct = async (product) => {
    const productId = getProductId(product);
    if (!productId) return;
    const confirmed = window.confirm(`Delete "${product?.name || 'this product'}"? This removes it from the platform.`);
    if (!confirmed) return;

    setDeletingId(productId);
    try {
      await api.delete(`/v1/admin/products/${productId}`);
      toast.success('Product deleted');
      setProducts((currentProducts) => currentProducts.filter((row) => getProductId(row) !== productId));
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete product');
    } finally {
      setDeletingId(null);
    }
  };

  const exportAdminReport = async () => {
    try {
      const response = await api.get('/v1/admin/reports/summary.csv', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `admin_report_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to export CSV report');
    }
  };
  const topInventoryProducts = [...products]
    .sort((a, b) => Number(getStock(b) || 0) - Number(getStock(a) || 0))
    .slice(0, 8);

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

  const InventoryQuantityGraph = ({ product, compact = false }) => {
    const points = getInventoryGraph(product);
    const maxValue = Math.max(...points.map((point) => point.onHand), 1);

    return (
      <div className={compact ? '' : 'rounded-lg border border-gray-100 bg-gray-50 p-3'}>
        {!compact && (
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Inventory graph</p>
            <p className="text-xs font-medium text-[#111827]">{getStock(product)} {product?.unit || 'units'}</p>
          </div>
        )}
        <div className={`${compact ? 'h-10' : 'h-20'} flex items-end gap-1`}>
          {points.map((point, index) => (
            <div
              key={`${point.recordedAt || 'inventory'}-${index}`}
              title={`${point.onHand} on hand, ${point.available} available, ${point.reserved} reserved`}
              className="min-w-1 flex-1 rounded-t bg-[#F97316]"
              style={{ height: `${Math.max(6, (point.onHand / maxValue) * 100)}%` }}
            />
          ))}
        </div>
        {!compact && (
          <div className="mt-2 flex items-center justify-between text-[11px] text-gray-500">
            <span>Oldest</span>
            <span>Quantity, not percentage</span>
            <span>Latest</span>
          </div>
        )}
      </div>
    );
  };

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
          <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <FaBox className="text-[#F97316] text-3xl" />
              <h1 className="text-3xl font-bold text-[#F97316]">Manage Products</h1>
            </div>
            <button
              type="button"
              onClick={exportAdminReport}
              className="inline-flex items-center gap-2 rounded-lg bg-[#111827] px-4 py-2 text-sm font-semibold text-white hover:bg-black"
            >
              <FaFileCsv />
              Export CSV Report
            </button>
          </div>
          <p className="text-[#6B7280]">Lango Lako la Biashara Smart - Oversee all products listed on the platform</p>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <BulkProductCsvJournal
            title="Admin Seller Journal"
            description="Select a seller, then upload a CSV list to help them add up to 50 products with full inventory details."
            storageKey="marketpulse_admin_product_csv_journal"
            createProduct={createProductForSeller}
            extraFields={{
              sellerId: selectedSellerId,
              seller: selectedSellerId,
              createdForSellerId: selectedSellerId,
            }}
            disabled={!selectedSellerId}
            disabledMessage="Choose a seller before creating products for them."
            onComplete={fetchProducts}
          />
          <aside className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-[#F97316]/10 text-[#F97316]">
                <FaStore />
              </span>
              <div>
                <h2 className="text-base font-bold text-[#111827]">Seller assignment</h2>
                <p className="text-sm text-gray-500">Admin-created rows are assigned here.</p>
              </div>
            </div>
            <label className="block text-sm font-semibold text-[#111827]">
              Seller
              <select
                value={selectedSellerId}
                onChange={(event) => setSelectedSellerId(event.target.value)}
                className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20"
              >
                <option value="">Choose seller</option>
                {sellerOptions.map((seller) => {
                  const sellerId = getSellerUserId(seller);
                  return (
                    <option key={sellerId} value={sellerId}>
                      {getSellerDisplayName(seller)}
                    </option>
                  );
                })}
              </select>
            </label>
            <p className="mt-3 text-xs text-gray-500">
              Existing products can still be edited below with the Edit button on each product card.
            </p>
          </aside>
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

        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-[#111827]">SKU Inventory Health</h2>
              <p className="text-sm text-[#6B7280]">Top inventory SKUs shown as quantity graphs, not percentages.</p>
            </div>
          </div>
          {topInventoryProducts.length ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              {topInventoryProducts.map((product) => (
                <div key={getProductId(product) || getSku(product)} className="rounded-lg border border-gray-200 p-3">
                  <div className="mb-3">
                    <p className="truncate text-sm font-semibold text-[#111827]" title={product.name}>{product.name}</p>
                    <p className="mt-1 truncate font-mono text-xs text-[#F97316]" title={getSku(product)}>{getSku(product)}</p>
                  </div>
                  <InventoryQuantityGraph product={product} compact />
                  <div className="mt-2 flex justify-between text-xs text-gray-500">
                    <span>On hand</span>
                    <span className="font-semibold text-[#111827]">{getStock(product)} {product?.unit || ''}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[#6B7280]">No inventory data available.</p>
          )}
        </div>

        {filteredProducts.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-12 text-center">
            <div className="text-6xl mb-4">No products</div>
            <h3 className="text-xl font-semibold text-[#111827] mb-2">No Products Found</h3>
            <p className="text-[#6B7280]">{search ? `No results for "${search}"` : 'No products are currently listed'}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {filteredProducts.map((product) => {
              const active = isProductActive(product);
              const stock = getStock(product);
              const id = getProductId(product);
              const image = getImage(product);
              return (
                <article key={id || `${product.name}-${Math.random()}`} className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                  <div className="flex gap-3">
                    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-md bg-gray-100">
                      {image ? (
                        <img src={image} alt={product.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="grid h-full place-items-center text-gray-400">
                          <FaBox className="text-2xl" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="truncate text-sm font-bold text-[#111827]" title={product.name}>{product.name}</h3>
                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${active ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                              {active ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                          <div className="mt-1 flex min-w-0 items-center gap-1 text-xs text-gray-500">
                            <FaStore className="shrink-0" />
                            <span className="truncate" title={getSellerName(product)}>{getSellerName(product)}</span>
                          </div>
                        </div>
                        <p className="shrink-0 text-sm font-bold text-[#F97316]">{formatCurrency(Number(product.price) || 0)}</p>
                      </div>

                      <div className="mt-3 grid grid-cols-[minmax(0,1.3fr)_auto_auto] items-center gap-2">
                        <div className="min-w-0 rounded-md bg-gray-50 px-2 py-1.5">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">SKU</p>
                          <p className="truncate font-mono text-[11px] font-semibold text-[#111827]" title={getSku(product)}>{getSku(product)}</p>
                        </div>
                        <div className="rounded-md bg-gray-50 px-2 py-1.5 text-right">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">On hand</p>
                          <p className={`text-xs font-bold ${getThreshold(product) > 0 && stock <= getThreshold(product) && stock > 0 ? 'text-[#F97316]' : 'text-[#111827]'}`}>
                            {stock}{getThreshold(product) > 0 && stock <= getThreshold(product) && stock > 0 ? ' Low' : ''}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleProductStatus(id, active)}
                          className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${active ? 'bg-[#16A34A]' : 'bg-gray-300'}`}
                          title={active ? 'Deactivate product' : 'Activate product'}
                        >
                          <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${active ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                      </div>

                      <div className="mt-3 grid grid-cols-[1fr_auto] items-end gap-3">
                        <InventoryQuantityGraph product={product} compact />
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditProduct(product)}
                            className="grid h-8 w-8 place-items-center rounded-md border border-gray-200 text-[#F97316] hover:bg-[#FFF7ED]"
                            title="Edit product"
                          >
                            <FaEdit size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteProduct(product)}
                            disabled={deletingId === id}
                            className="grid h-8 w-8 place-items-center rounded-md border border-red-100 text-red-600 hover:bg-red-50 disabled:opacity-60"
                            title={deletingId === id ? 'Deleting product' : 'Delete product'}
                          >
                            <FaTrash size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
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
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 p-5">
              <div>
                <h2 className="text-xl font-bold text-[#111827]">Edit Product</h2>
                <p className="text-sm text-[#6B7280]">{editingProduct.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
                aria-label="Close edit product modal"
              >
                <FaTimes />
              </button>
            </div>

            <form onSubmit={handleUpdateProduct} className="space-y-5 p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block text-sm font-semibold text-[#111827]">
                  Product Name
                  <input
                    name="name"
                    value={editForm.name}
                    onChange={handleEditChange}
                    className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-[#F97316]"
                    required
                  />
                </label>
                <label className="block text-sm font-semibold text-[#111827]">
                  Category
                  <select
                    name="category"
                    value={editForm.category}
                    onChange={handleEditChange}
                    className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-[#F97316]"
                  >
                    {productCategories.map((category) => (
                      <option key={category} value={category}>{formatOption(category)}</option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm font-semibold text-[#111827]">
                  Price
                  <input
                    name="price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={editForm.price}
                    onChange={handleEditChange}
                    className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-[#F97316]"
                    required
                  />
                </label>
                <label className="block text-sm font-semibold text-[#111827]">
                  Unit
                  <select
                    name="unit"
                    value={editForm.unit}
                    onChange={handleEditChange}
                    className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-[#F97316]"
                  >
                    {units.map((unit) => (
                      <option key={unit} value={unit}>{formatOption(unit)}</option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm font-semibold text-[#111827]">
                  Quantity Available
                  <input
                    name="quantityAvailable"
                    type="number"
                    min="0"
                    value={editForm.quantityAvailable}
                    onChange={handleEditChange}
                    className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-[#F97316]"
                    required
                  />
                </label>
                <label className="block text-sm font-semibold text-[#111827]">
                  Low Stock Threshold
                  <input
                    name="minThreshold"
                    type="number"
                    min="0"
                    value={editForm.minThreshold}
                    onChange={handleEditChange}
                    className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-[#F97316]"
                  />
                </label>
                <label className="block text-sm font-semibold text-[#111827] md:col-span-2">
                  Location Hub
                  <input
                    name="locationHub"
                    value={editForm.locationHub}
                    onChange={handleEditChange}
                    className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-[#F97316]"
                    placeholder="Kakuma, Kitale, Nairobi..."
                  />
                </label>
                <label className="block text-sm font-semibold text-[#111827] md:col-span-2">
                  Description
                  <textarea
                    name="description"
                    rows="4"
                    value={editForm.description}
                    onChange={handleEditChange}
                    className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-[#F97316]"
                  />
                </label>
              </div>

              <label className="inline-flex items-center gap-2 text-sm font-semibold text-[#111827]">
                <input
                  name="isPublished"
                  type="checkbox"
                  checked={editForm.isPublished}
                  onChange={handleEditChange}
                  className="h-4 w-4 rounded border-gray-300 text-[#F97316] focus:ring-[#F97316]"
                />
                Active product listing
              </label>

              <div className="flex flex-wrap justify-end gap-3 border-t border-gray-200 pt-5">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  <FaTimes />
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#F97316] px-4 py-2 text-sm font-semibold text-white hover:bg-[#EA580C] disabled:opacity-60"
                >
                  <FaSave />
                  {savingEdit ? 'Saving...' : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminProducts;
