// src/pages/SellerProducts.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FaBox, FaChartLine, FaEdit, FaFilter, FaPlus, FaSearch, FaTrash, FaWarehouse } from 'react-icons/fa';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { FEATURE_TOOLTIPS, SUBSCRIPTION_FEATURES } from '../config/subscriptionPlans';
import { DonutGauge, KpiCard, Panel, ProgressRow, StatusPill } from '../components/dashboard/DashboardWidgets';
import BulkProductCsvJournal from '../components/BulkProductCsvJournal';
import { formatRealtimeStamp, useRealtimeRefresh } from '../hooks/useRealtimeRefresh';
import { productService } from '../services/productService';
import { formatCurrency } from '../utils/formatters';
import { formatProductCategory, getEffectiveLowStockThreshold } from '../utils/inventorySensitivity';

const getProductId = (product) => product?._id || product?.id;
const getStock = (product) => Number(product?.quantityAvailable ?? product?.stock ?? product?.quantity ?? product?.inventory ?? 0);
const getSku = (product) => product?.sku || product?.trackingSku || product?.SKU || product?.stockKeepingUnit || 'SKU pending';
const warehouseStatusLabels = {
  seller_storage: 'Seller storage',
  warehouse_pending: 'Warehouse pending',
  warehouse_received: 'Warehouse received',
  dispatch_ready: 'Dispatch ready',
  restricted: 'Restricted hold',
};
const getWarehouseStatus = (product) => warehouseStatusLabels[product?.warehouseStatus] || 'Seller storage';
const getTierPricing = (product) => (
  Array.isArray(product?.priceTiers)
    ? product.priceTiers
    : Array.isArray(product?.wholesale?.priceTiers)
      ? product.wholesale.priceTiers
      : []
);
const getInventoryGraph = (product) => {
  const graph = Array.isArray(product?.inventoryGraph)
    ? product.inventoryGraph
    : Array.isArray(product?.inventoryHistory)
      ? product.inventoryHistory
      : [];

  if (graph.length > 0) {
    return graph
      .map((point) => ({
        onHand: Number(point.onHand ?? point.quantityAvailable ?? point.quantity ?? 0),
        reserved: Number(point.reserved ?? point.reservedQuantity ?? 0),
        available: Number(point.available ?? point.availableQuantity ?? point.onHand ?? 0),
        recordedAt: point.recordedAt || point.createdAt,
      }))
      .slice(-12);
  }

  const stock = getStock(product);
  return [{ onHand: stock, reserved: Number(product?.reservedQuantity || 0), available: stock }];
};
const getImage = (product) => {
  const image = product?.images?.[0];
  return typeof image === 'string' ? image : image?.url || '';
};
const isActiveProduct = (product) => {
  if (typeof product?.isActive === 'boolean') return product.isActive;
  if (typeof product?.active === 'boolean') return product.active;
  if (typeof product?.status === 'string') return product.status.toLowerCase() === 'active';
  return true;
};
const categoryLabel = (product) => formatProductCategory(product?.category);

const InventoryQuantityGraph = ({ product, compact = false }) => {
  const points = getInventoryGraph(product);
  const maxValue = Math.max(...points.map((point) => point.onHand), 1);

  return (
    <div className={compact ? '' : 'rounded-md border border-gray-100 bg-gray-50 p-3'}>
      {!compact && (
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Inventory graph</p>
          <p className="text-xs font-medium text-[#111827]">{getStock(product)} {product?.unit || 'units'}</p>
        </div>
      )}
      <div className={`flex ${compact ? 'h-10' : 'h-20'} items-end gap-1`}>
        {points.map((point, index) => {
          const height = Math.max(compact ? 6 : 8, (point.onHand / maxValue) * 100);
          return (
            <div key={`${point.recordedAt || 'point'}-${index}`} className="flex min-w-0 flex-1 flex-col items-center justify-end">
              <div
                title={`${point.onHand} on hand, ${point.available} available, ${point.reserved} reserved`}
                className="w-full rounded-t bg-[#F97316]"
                style={{ height: `${height}%` }}
              />
            </div>
          );
        })}
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

const SellerProducts = () => {
  const { hasFeature, user } = useAuth();
  const [products, setProducts] = useState([]);
  const [planUsage, setPlanUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  const fetchProducts = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const response = await productService.getMyProducts({ page: 1, limit: 100 });
      setProducts(Array.isArray(response?.data) ? response.data : []);
      setPlanUsage(response?.planUsage || null);
    } catch (error) {
      console.error('Error fetching seller products:', error);
      toast.error('Failed to load products');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const { lastUpdated, isRefreshing } = useRealtimeRefresh(
    () => fetchProducts({ silent: true }),
    { enabled: true, intervalMs: 12000 }
  );

  const canManageInventory = hasFeature(SUBSCRIPTION_FEATURES.INVENTORY_LEDGER);
  const hasBusinessName = Boolean(String(user?.businessName || '').trim());

  const handleDeleteProduct = async (productId) => {
    if (!window.confirm('Delete this product?')) return;
    try {
      await productService.delete(productId);
      toast.success('Product deleted');
      fetchProducts();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete product');
    }
  };

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return products.filter((product) => {
      const stock = getStock(product);
      const active = isActiveProduct(product);
      const matchesSearch =
        String(product?.name || '').toLowerCase().includes(query) ||
        String(categoryLabel(product)).toLowerCase().includes(query) ||
        String(getSku(product)).toLowerCase().includes(query);
      const matchesFilter =
        filter === 'all' ||
        (filter === 'active' && active) ||
        (filter === 'inactive' && !active) ||
        (filter === 'low-stock' && stock > 0 && stock <= getEffectiveLowStockThreshold(product)) ||
        (filter === 'out-of-stock' && stock <= 0);
      return matchesSearch && matchesFilter;
    });
  }, [filter, products, search]);

  const groupedProducts = useMemo(() => {
    return filteredProducts.reduce((groups, product) => {
      const label = categoryLabel(product);
      if (!groups[label]) groups[label] = [];
      groups[label].push(product);
      return groups;
    }, {});
  }, [filteredProducts]);

  const totalStock = products.reduce((sum, product) => sum + getStock(product), 0);
  const activeCount = products.filter(isActiveProduct).length;
  const lowStockItems = products.filter((product) => {
    const stock = getStock(product);
    return stock > 0 && stock <= getEffectiveLowStockThreshold(product);
  });
  const outOfStockItems = products.filter((product) => getStock(product) <= 0);
  const inventoryValue = products.reduce((sum, product) => sum + (Number(product?.price || 0) * getStock(product)), 0);
  const inventoryHealth = products.length ? Math.round(((products.length - outOfStockItems.length) / products.length) * 100) : 0;
  const categoryCounts = Object.entries(
    products.reduce((acc, product) => {
      const label = categoryLabel(product);
      acc[label] = (acc[label] || 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]);
  const productSlotsPct = planUsage?.productLimit
    ? Math.min(100, Math.round((Number(planUsage.visibleProducts || 0) / Number(planUsage.productLimit || 1)) * 100))
    : 0;

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-[#F97316]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F8FA] px-4 py-6 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#F97316]">Seller catalog</p>
          <h1 className="mt-1 text-2xl font-bold text-[#111827]">My Products</h1>
          <p className="mt-1 text-sm text-gray-500">Manage your listings, stock health, pricing, and category coverage.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex h-10 items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 text-xs font-medium text-green-700">
            <span className={`h-2 w-2 rounded-full bg-green-500 ${isRefreshing ? 'animate-pulse' : ''}`} />
            Live - {formatRealtimeStamp(lastUpdated)}
          </div>
          {canManageInventory ? (
            <Link to="/seller/add-product" className="inline-flex h-10 items-center gap-2 rounded-md bg-[#F97316] px-4 text-sm font-medium text-white hover:bg-[#EA580C]">
              <FaPlus />
              Add Product
            </Link>
          ) : (
            <Link
              to="/seller/subscription-plans"
              title={FEATURE_TOOLTIPS[SUBSCRIPTION_FEATURES.INVENTORY_LEDGER] || 'Upgrade subscription to unlock inventory tools'}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-gray-200 px-4 text-sm font-medium text-gray-700 hover:bg-gray-300"
            >
              Upgrade
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon={FaBox} label="Total Products" value={products.length} detail={`${activeCount} active`} color="#F97316" points={products.map((product) => getStock(product)).slice(0, 12)} />
        <KpiCard icon={FaWarehouse} label="Units In Stock" value={totalStock} detail={`${lowStockItems.length} low stock`} color="#3B82F6" points={products.map((product) => getStock(product)).slice(0, 12)} />
        <KpiCard icon={FaChartLine} label="Inventory Value" value={formatCurrency(inventoryValue)} detail="listed stock value" color="#16A34A" points={products.map((product) => Number(product?.price || 0)).slice(0, 12)} />
        <KpiCard icon={FaFilter} label="Categories" value={categoryCounts.length} detail={`${outOfStockItems.length} out of stock`} color="#8B5CF6" points={categoryCounts.map(([, count]) => count)} />
      </div>

      <div className="mt-4">
        <BulkProductCsvJournal
          title="Seller Journal"
          description="Upload a CSV list to add up to 50 products with pricing, stock, MOQ, RFQ, warehouse, and hub details."
          storageKey={`marketpulse_seller_product_csv_journal_${user?._id || user?.id || 'default'}`}
          createProduct={(formData) => productService.create(formData)}
          disabled={!canManageInventory || !hasBusinessName}
          disabledMessage={
            !canManageInventory
              ? 'Upgrade your subscription to use bulk inventory tools.'
              : !hasBusinessName
                ? 'Add your business name in your seller profile before creating products.'
                : ''
          }
          onComplete={() => fetchProducts({ silent: true })}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Panel title="Catalog Controls" className="xl:col-span-8">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-64 flex-1">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search product or category..."
                className="h-11 w-full rounded-md border border-gray-200 bg-white pl-10 pr-4 text-sm outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20"
              />
            </div>
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              className="h-11 rounded-md border border-gray-200 bg-white px-3 text-sm outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20"
            >
              <option value="all">All products</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="low-stock">Low stock</option>
              <option value="out-of-stock">Out of stock</option>
            </select>
          </div>
        </Panel>

        <Panel title="Inventory Health" className="xl:col-span-4">
          <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
            <DonutGauge value={inventoryHealth} label={`${products.length - outOfStockItems.length} stocked SKUs`} color="#16A34A" />
            <div className="space-y-4">
              <ProgressRow label="Active listings" value={activeCount} max={Math.max(products.length, 1)} color="#16A34A" detail={`${activeCount}`} />
              <ProgressRow label="Low stock" value={lowStockItems.length} max={Math.max(products.length, 1)} color="#F59E0B" detail={`${lowStockItems.length}`} />
              <ProgressRow label="Out of stock" value={outOfStockItems.length} max={Math.max(products.length, 1)} color="#DC2626" detail={`${outOfStockItems.length}`} />
              {planUsage && <ProgressRow label="Product slots" value={productSlotsPct} max={100} color="#F97316" detail={`${planUsage.visibleProducts}/${planUsage.productLimit}`} />}
            </div>
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Panel title="Category Coverage" className="xl:col-span-4">
          <div className="space-y-4">
            {categoryCounts.slice(0, 8).map(([category, count]) => (
              <ProgressRow key={category} label={category} value={count} max={Math.max(products.length, 1)} color="#3B82F6" detail={`${count}`} />
            ))}
            {!categoryCounts.length && <p className="text-sm text-gray-500">No products have been added yet.</p>}
          </div>
        </Panel>

        <Panel title="Stock Alerts" className="xl:col-span-8">
          <div className="grid gap-3 md:grid-cols-2">
            {[...outOfStockItems, ...lowStockItems].slice(0, 6).map((product) => {
              const stock = getStock(product);
              const threshold = getEffectiveLowStockThreshold(product);
              const critical = threshold > 0 && stock <= Math.max(1, Math.ceil(threshold / 2));
              return (
                <div key={getProductId(product)} className="rounded-md border border-amber-100 bg-amber-50 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#111827]">{product.name}</p>
                      <p className="mt-1 text-xs text-amber-700">Stock {stock} in {categoryLabel(product)}. Alert threshold {threshold}.</p>
                    </div>
                    <StatusPill tone={stock <= 0 || critical ? 'red' : 'amber'}>{stock <= 0 ? 'out' : critical ? 'critical' : 'low'}</StatusPill>
                  </div>
                </div>
              );
            })}
            {!outOfStockItems.length && !lowStockItems.length && <p className="text-sm text-gray-500">No active stock alerts.</p>}
          </div>
        </Panel>
      </div>

      <div className="mt-4 space-y-5">
        {Object.entries(groupedProducts).map(([category, categoryProducts]) => (
          <section key={category}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[#111827]">{category}</h2>
                <p className="text-sm text-gray-500">{categoryProducts.length} product{categoryProducts.length === 1 ? '' : 's'}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              {categoryProducts.map((product) => {
                const id = getProductId(product);
                const stock = getStock(product);
                const active = isActiveProduct(product);
                const image = getImage(product);
                const tiers = getTierPricing(product);
                const moq = product.minimumOrderQuantity ?? product.wholesale?.minimumOrderQuantity ?? 1;
                const rfqEnabled = product.rfqEnabled ?? product.wholesale?.rfqEnabled ?? true;
                return (
                  <article key={id || product.name} className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
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
                              <StatusPill tone={active ? 'green' : 'gray'}>{active ? 'active' : 'inactive'}</StatusPill>
                            </div>
                            <p className="mt-1 text-sm font-bold text-[#F97316]">{formatCurrency(product.price || 0)}</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <Link to={`/seller/edit-product/${id}`} className="grid h-8 w-8 place-items-center rounded-md border border-gray-200 text-[#F97316] hover:bg-[#FFF7ED]" title="Edit product">
                              <FaEdit size={12} />
                            </Link>
                            <button
                              type="button"
                              onClick={() => handleDeleteProduct(id)}
                              className="grid h-8 w-8 place-items-center rounded-md border border-red-100 text-red-600 hover:bg-red-50"
                              title="Delete product"
                            >
                              <FaTrash size={12} />
                            </button>
                          </div>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                          <div className="min-w-0 rounded-md bg-gray-50 px-2 py-1.5 sm:col-span-2">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">SKU</p>
                            <p className="truncate font-mono font-semibold text-[#111827]" title={getSku(product)}>{getSku(product)}</p>
                          </div>
                          <div className="rounded-md bg-gray-50 px-2 py-1.5">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Stock</p>
                            <p className="font-bold text-[#111827]">{stock}</p>
                          </div>
                          <div className="rounded-md bg-gray-50 px-2 py-1.5">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Reserved</p>
                            <p className="font-bold text-[#111827]">{Number(product.reservedQuantity || 0)}</p>
                          </div>
                          <div className="rounded-md bg-gray-50 px-2 py-1.5">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">MOQ</p>
                            <p className="font-bold text-[#111827]">{moq}</p>
                          </div>
                          <div className="rounded-md bg-gray-50 px-2 py-1.5">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">RFQ</p>
                            <p className="font-bold text-[#111827]">{rfqEnabled ? 'Open' : 'Closed'}</p>
                          </div>
                          <div className="min-w-0 rounded-md bg-gray-50 px-2 py-1.5 sm:col-span-2">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Warehouse</p>
                            <p className="truncate font-bold text-[#111827]" title={getWarehouseStatus(product)}>{getWarehouseStatus(product)}</p>
                          </div>
                        </div>

                        <div className="mt-3 grid grid-cols-[1fr_auto] items-end gap-3">
                          <InventoryQuantityGraph product={product} compact />
                          <div className="text-right text-[11px] text-gray-500">
                            <p>{Number(product.rating || 0).toFixed(1)} rating</p>
                            {tiers.length > 0 && <p>{tiers.length} tier{tiers.length === 1 ? '' : 's'}</p>}
                          </div>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
        {!filteredProducts.length && (
          <div className="rounded-md border border-dashed border-gray-300 bg-white p-10 text-center">
            <FaBox className="mx-auto mb-3 text-4xl text-gray-300" />
            <h2 className="text-lg font-semibold text-[#111827]">No products found</h2>
            <p className="mt-1 text-sm text-gray-500">Adjust your search or filter to view more catalog items.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SellerProducts;
