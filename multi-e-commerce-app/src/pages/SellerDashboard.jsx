// src/pages/SellerDashboard.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FaPlus, FaEdit, FaTrash, FaBox, FaDollarSign, FaShoppingCart, FaLock, FaUnlockAlt, FaClipboardList, FaWarehouse, FaPercent, FaStar, FaUsers, FaFileExport, FaEye } from 'react-icons/fa';
import { formatCurrency } from '../utils/formatters';
import { FEATURE_TOOLTIPS, SUBSCRIPTION_FEATURES } from '../config/subscriptionPlans';
import { productService } from '../services/productService';
import { orderService } from '../services/orderService';
import { CustomerReviewsPanel, DonutGauge, KpiCard, Panel, ProgressRow, SalesByLocationPanel, StatusPill } from '../components/dashboard/DashboardWidgets';
import { formatRealtimeStamp, useRealtimeRefresh } from '../hooks/useRealtimeRefresh';
import { buildReviewSummary, buildSalesByLocation, isPaidOrder } from '../utils/dashboardMetrics';

const SellerDashboard = () => {
  const { activePlan, hasFeature } = useAuth();
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalOrders: 0,
    totalRevenue: 0,
    pendingOrders: 0
  });
  const [products, setProducts] = useState([]);
  const [planUsage, setPlanUsage] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dashboardRange, setDashboardRange] = useState('30d');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  useEffect(() => {
    fetchSellerData();
  }, []);

  const fetchSellerData = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const productsRes = await productService.getMyProducts({ page: 1, limit: 20 });
      const myProducts = productsRes?.data || [];
      const usage = productsRes?.planUsage || null;
      const ordersRes = await orderService.getAll({ role: 'seller', page: 1, limit: 50 });
      const sellerOrders = ordersRes?.data || [];
      const totalRevenue = sellerOrders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
      const pendingOrders = sellerOrders.filter((o) =>
        ['pending_payment', 'payment_escrowed', 'processing', 'dispatched'].includes(o.status)
      ).length;

      setProducts(myProducts);
      setPlanUsage(usage);
      setStats({
        totalProducts: usage?.totalProducts ?? myProducts.length,
        totalOrders: Number(ordersRes?.pagination?.total || sellerOrders.length),
        totalRevenue,
        pendingOrders,
      });
      setRecentOrders(sellerOrders);
    } catch (error) {
      console.error('Error fetching seller data:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const { lastUpdated, isRefreshing: isRealtimeRefreshing } = useRealtimeRefresh(
    () => fetchSellerData({ silent: true }),
    { enabled: true, intervalMs: 12000 }
  );

  const handleDeleteProduct = async (productId) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      try {
        await productService.delete(productId);
        fetchSellerData();
      } catch (error) {
        console.error('Error deleting product:', error);
      }
    }
  };

  const applyDashboardRange = (range) => {
    setDashboardRange(range);
    const end = new Date();
    const start = new Date();

    if (range === 'today') {
      start.setHours(0, 0, 0, 0);
    } else if (range === '7d') {
      start.setDate(end.getDate() - 7);
    } else if (range === '30d') {
      start.setDate(end.getDate() - 30);
    } else if (range === '90d') {
      start.setDate(end.getDate() - 90);
    } else if (range === 'year') {
      start.setFullYear(end.getFullYear() - 1);
    }

    setDateRange({
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
    });
  };

  const isSectionLoading = loading;

  const intelligenceCards = [
    {
      key: SUBSCRIPTION_FEATURES.GUARDIAN_REGIONAL_ALARM,
      title: 'Guardian Regional Alarm',
      description: 'Monitors regional scarcity and notifies you before stockouts hit margins.',
    },
    {
      key: SUBSCRIPTION_FEATURES.CFO_LITE_HOOK,
      title: 'CFO Hook',
      description: 'Tracks logistics and SMS cost impact against your profit flow.',
    },
    {
      key: SUBSCRIPTION_FEATURES.CLEARANCE_AGENT,
      title: 'Clearance Agent',
      description: 'Flags slow movers and suggests targeted discounts to recover working capital.',
    },
    {
      key: SUBSCRIPTION_FEATURES.CASHFLOW_PREDICTION,
      title: 'Cash Flow Prediction',
      description: 'Warns if wallet balance may be insufficient for upcoming obligations.',
    },
  ];
  const canManageInventory = hasFeature(SUBSCRIPTION_FEATURES.INVENTORY_LEDGER);
  const lowStockItems = products.filter((p) => {
    const stock = Number(p.quantityAvailable ?? p.stock ?? 0);
    const threshold = Number(p.minThreshold ?? 0);
    return threshold > 0 && stock <= threshold;
  });
  const daysToExpiry = (dateValue) => {
    if (!dateValue) return null;
    const now = new Date();
    const end = new Date(dateValue);
    const diffMs = end.getTime() - now.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  };
  const expiringSoonItems = products.filter((p) => {
    const expiry = p?.attributes?.expiry;
    const days = daysToExpiry(expiry);
    return typeof days === 'number' && days >= 0 && days <= 14;
  });
  const cfoEstimatedExpenses = stats.totalRevenue * 0.28;
  const cfoNetProfit = stats.totalRevenue - cfoEstimatedExpenses;
  const cfoMargin = stats.totalRevenue > 0 ? (cfoNetProfit / stats.totalRevenue) * 100 : 0;
  const healthState = cfoMargin > 20 ? 'Green' : cfoMargin >= 0 ? 'Yellow' : 'Red';
  const filteredOrders = recentOrders.filter((order) => {
    if (!dateRange.start || !dateRange.end || !order.createdAt) return true;
    const created = new Date(order.createdAt);
    return created >= new Date(dateRange.start) && created <= new Date(`${dateRange.end}T23:59:59`);
  });
  const filteredRevenue = filteredOrders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
  const filteredAov = filteredOrders.length ? filteredRevenue / filteredOrders.length : 0;
  const customerIds = filteredOrders
    .map((order) => order.buyer?._id || order.buyer || order.customer?._id || order.customer)
    .filter(Boolean)
    .map(String);
  const uniqueCustomerCount = new Set(customerIds).size;
  const returningCustomerCount = customerIds.length - uniqueCustomerCount;
  const conversionRate = products.length ? Math.round((filteredOrders.length / products.length) * 1000) / 10 : 0;
  const customerLocationCounts = filteredOrders.reduce((acc, order) => {
    const location = order.buyer?.campus || order.customer?.campus || order.deliveryAddress?.city || order.shippingAddress?.city || 'Unknown';
    acc[location] = (acc[location] || 0) + 1;
    return acc;
  }, {});
  const topCustomerLocations = Object.entries(customerLocationCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const paidSellerOrders = recentOrders.filter(isPaidOrder);
  const salesByLocationRows = buildSalesByLocation(recentOrders);
  const reviewSummary = buildReviewSummary(products, paidSellerOrders.length);
  const averageRating = products.length
    ? products.reduce((sum, product) => sum + Number(product.rating || 0), 0) / products.length
    : 0;
  const ratedProducts = products.filter((product) => Number(product.rating || 0) > 0).length;
  const productCategoryCounts = products.reduce((acc, product) => {
    const category = product.category?.name || product.category || 'Uncategorized';
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {});
  const totalStock = products.reduce((sum, product) => sum + Number(product.quantityAvailable ?? product.stock ?? 0), 0);
  const inStockProducts = products.filter((product) => Number(product.quantityAvailable ?? product.stock ?? 0) > 0).length;
  const inventoryHealth = products.length ? Math.round((inStockProducts / products.length) * 100) : 0;
  const orderStatusCounts = recentOrders.reduce((acc, order) => {
    const status = order.status || 'pending';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});
  const topProducts = [...products]
    .sort((a, b) => Number(b.soldCount || b.sales || 0) - Number(a.soldCount || a.sales || 0))
    .slice(0, 5);
  const recentOrdersAsc = [...filteredOrders].sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
  const revenueSeries = recentOrdersAsc.map((order) => Number(order.totalAmount || 0));
  const orderSeries = recentOrdersAsc.map((_, index) => index + 1);
  const productSeries = products.map((product) => Number(product.quantityAvailable ?? product.stock ?? 0)).slice(0, 12);
  const inventorySeries = products.map((product) => (Number(product.quantityAvailable ?? product.stock ?? 0) > 0 ? 1 : 0)).slice(0, 12);
  const maxRevenue = Math.max(...revenueSeries, 0);
  const revenueBars = revenueSeries.length
    ? revenueSeries.map((value) => (maxRevenue > 0 ? Math.max(6, (value / maxRevenue) * 100) : 6))
    : [0];
  const trendPct = (series) => {
    if (!series.length || Number(series[0]) === 0) return null;
    const first = Number(series[0]) || 0;
    const last = Number(series[series.length - 1]) || 0;
    return ((last - first) / Math.abs(first)) * 100;
  };
  const revenueTrendPct = trendPct(revenueSeries);
  const orderTrendPct = trendPct(orderSeries);
  const revenueTrendLabel = typeof revenueTrendPct === 'number' ? `${revenueTrendPct >= 0 ? '+' : ''}${revenueTrendPct.toFixed(1)}%` : undefined;
  const orderTrendLabel = typeof orderTrendPct === 'number' ? `${orderTrendPct >= 0 ? '+' : ''}${orderTrendPct.toFixed(1)}%` : undefined;
  const productSlotPct = planUsage?.productLimit
    ? Math.min(100, Math.round((Number(planUsage.visibleProducts || 0) / Number(planUsage.productLimit || 1)) * 100))
    : 0;
  const statusTone = (status) => {
    if (['delivered', 'completed', 'paid'].includes(status)) return 'green';
    if (['processing', 'payment_escrowed', 'shipped'].includes(status)) return 'blue';
    if (['dispatched', 'pending_payment', 'pending'].includes(status)) return 'amber';
    if (['cancelled', 'refunded', 'failed'].includes(status)) return 'red';
    return 'gray';
  };
  const productImage = (product) => {
    const image = product.images?.[0];
    return typeof image === 'string' ? image : image?.url;
  };

  return (
    <div className="min-h-screen bg-[#F7F8FA] px-4 py-6 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#F97316]">Seller workspace</p>
          <h1 className="mt-1 text-2xl font-bold text-[#111827]">Performance Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            {activePlan ? `${activePlan.name} plan, ${activePlan.priceLabel}` : 'Inventory, revenue, and order performance'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex h-10 items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 text-xs font-medium text-green-700">
            <span className={`h-2 w-2 rounded-full bg-green-500 ${isRealtimeRefreshing ? 'animate-pulse' : ''}`} />
            Live - {formatRealtimeStamp(lastUpdated)}
          </div>
          <div className="flex overflow-hidden rounded-md border border-gray-200 bg-white">
            {[
              ['today', 'Today'],
              ['7d', '7D'],
              ['30d', '30D'],
              ['90d', '90D'],
              ['year', 'Year'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => applyDashboardRange(value)}
                className={`h-10 px-3 text-xs font-medium ${dashboardRange === value ? 'bg-[#111827] text-white' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                {label}
              </button>
            ))}
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
              <FaLock />
              Upgrade
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon={FaDollarSign} label="Total Revenue" value={isSectionLoading ? '-' : formatCurrency(stats.totalRevenue)} trend={revenueTrendLabel} detail="seller earnings" color="#16A34A" points={revenueSeries} />
        <KpiCard icon={FaShoppingCart} label="Orders" value={isSectionLoading ? '-' : stats.totalOrders} trend={orderTrendLabel} detail={`${stats.pendingOrders} pending`} color="#3B82F6" points={orderSeries} />
        <KpiCard icon={FaBox} label="Products" value={isSectionLoading ? '-' : stats.totalProducts} detail={`${totalStock} units in stock`} color="#F97316" points={productSeries} />
        <KpiCard icon={FaWarehouse} label="Inventory Health" value={isSectionLoading ? '-' : `${inventoryHealth}%`} detail={`${lowStockItems.length} low stock alerts`} color="#8B5CF6" points={inventorySeries} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon={FaPercent} label="Seller Conversion" value={`${conversionRate}%`} detail="orders per listed product" color="#0EA5E9" points={[filteredOrders.length, products.length]} />
        <KpiCard icon={FaDollarSign} label="Average Order Value" value={formatCurrency(filteredAov)} detail={`${filteredOrders.length} filtered orders`} color="#16A34A" points={revenueSeries} />
        <KpiCard icon={FaUsers} label="Customers" value={uniqueCustomerCount} detail={`${returningCustomerCount} returning`} color="#F97316" points={[uniqueCustomerCount, returningCustomerCount]} />
        <KpiCard icon={FaStar} label="Review Score" value={averageRating.toFixed(1)} detail={`${ratedProducts} rated products`} color="#F59E0B" points={products.map((product) => Number(product.rating || 0)).slice(0, 12)} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Panel title="Revenue Overview" className="xl:col-span-7">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-3xl font-bold text-[#111827]">{isSectionLoading ? '-' : formatCurrency(cfoNetProfit)}</p>
              <p className="mt-1 text-sm text-gray-500">Estimated net after operating costs</p>
            </div>
            <StatusPill tone={healthState === 'Green' ? 'green' : healthState === 'Yellow' ? 'amber' : 'red'}>{healthState} margin</StatusPill>
          </div>
          <div className="grid h-56 items-end gap-2 border-b border-l border-gray-100 px-2 pb-2" style={{ gridTemplateColumns: `repeat(${Math.max(revenueBars.length, 1)}, minmax(0, 1fr))` }}>
            {revenueBars.map((height, index) => (
              <div key={index} className="rounded-t-md bg-[#F97316]/20" style={{ height: `${height}%` }}>
                <div className="h-full rounded-t-md bg-[#F97316]" style={{ opacity: Math.min(0.9, 0.35 + index * 0.06) }} />
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Order Status" className="xl:col-span-3">
          <div className="space-y-4">
            {['pending_payment', 'processing', 'dispatched', 'delivered'].map((status, index) => (
              <ProgressRow
                key={status}
                label={status.replace(/_/g, ' ')}
                value={orderStatusCounts[status] || 0}
                max={Math.max(recentOrders.length, 1)}
                detail={`${orderStatusCounts[status] || 0}`}
                color={['#F59E0B', '#3B82F6', '#8B5CF6', '#16A34A'][index]}
              />
            ))}
          </div>
        </Panel>

        <Panel title="Inventory Health" className="xl:col-span-2">
          <DonutGauge value={inventoryHealth} label={`${inStockProducts} active SKUs`} color="#16A34A" />
        </Panel>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Panel title="Product Views And Clicks" className="xl:col-span-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-md bg-gray-50 p-3">
              <p className="text-xs text-gray-500">Product views</p>
              <p className="mt-1 text-xl font-bold text-[#111827]">0</p>
            </div>
            <div className="rounded-md bg-gray-50 p-3">
              <p className="text-xs text-gray-500">Click-through</p>
              <p className="mt-1 text-xl font-bold text-[#111827]">0%</p>
            </div>
          </div>
          <p className="mt-4 text-sm text-gray-500">Product impression and click events are not tracked by the backend yet.</p>
        </Panel>

        <Panel title="Customer Insights" className="xl:col-span-4">
          <div className="space-y-4">
            <ProgressRow label="New customers" value={Math.max(0, uniqueCustomerCount - returningCustomerCount)} max={Math.max(uniqueCustomerCount, 1)} color="#16A34A" detail={`${Math.max(0, uniqueCustomerCount - returningCustomerCount)}`} />
            <ProgressRow label="Returning customers" value={returningCustomerCount} max={Math.max(uniqueCustomerCount, 1)} color="#8B5CF6" detail={`${returningCustomerCount}`} />
            {topCustomerLocations.length ? topCustomerLocations.map(([location, count]) => (
              <ProgressRow key={location} label={location} value={count} max={Math.max(...topCustomerLocations.map((item) => item[1]), 1)} color="#F97316" detail={`${count}`} />
            )) : <p className="text-sm text-gray-500">No customer location data yet.</p>}
          </div>
        </Panel>

        <Panel title="Category And Variant Performance" className="xl:col-span-4">
          <div className="space-y-4">
            {Object.entries(productCategoryCounts).slice(0, 5).map(([category, count]) => (
              <ProgressRow key={category} label={category} value={count} max={Math.max(products.length, 1)} color="#3B82F6" detail={`${count}`} />
            ))}
            <p className="text-sm text-gray-500">Size/color variant sales will appear after product variants are stored on orders.</p>
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <SalesByLocationPanel
          className="xl:col-span-5"
          locations={salesByLocationRows}
          action={<Link to="/seller/orders" className="text-xs font-medium text-[#F97316]">View orders</Link>}
        />
        <CustomerReviewsPanel
          className="xl:col-span-7"
          summary={reviewSummary}
          action={<Link to="/seller/products" className="text-xs font-medium text-[#F97316]">View all</Link>}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Panel title="Operational Intelligence" className="xl:col-span-4">
          <div className="space-y-3">
            {intelligenceCards.map((card) => {
              const enabled = hasFeature(card.key);
              return (
                <div key={card.key} className="rounded-md border border-gray-200 bg-gray-50 p-3">
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-[#111827]">{card.title}</p>
                    <span className={`inline-flex items-center gap-1 text-xs ${enabled ? 'text-green-700' : 'text-gray-500'}`}>
                      {enabled ? <FaUnlockAlt size={12} /> : <FaLock size={11} />}
                      {enabled ? 'Enabled' : 'Locked'}
                    </span>
                  </div>
                  <p className="text-xs leading-5 text-gray-500">{card.description}</p>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel title="Top Selling Products" action={<Link to="/seller/products" className="text-xs font-medium text-[#F97316]">View all</Link>} className="xl:col-span-4">
          <div className="space-y-3">
            {(topProducts.length ? topProducts : products.slice(0, 5)).map((product) => (
              <div key={product.id || product._id} className="flex items-center gap-3">
                <div className="h-10 w-10 overflow-hidden rounded-md bg-gray-100">
                  {productImage(product) ? <img src={productImage(product)} alt={product.name} className="h-full w-full object-cover" /> : <FaBox className="m-3 text-gray-400" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[#111827]">{product.name}</p>
                  <p className="text-xs text-gray-500">Stock {product.quantityAvailable ?? product.stock ?? 0}</p>
                </div>
                <p className="text-sm font-semibold text-[#111827]">{formatCurrency(product.price)}</p>
              </div>
            ))}
            {!products.length && <p className="text-sm text-gray-500">No products yet.</p>}
          </div>
        </Panel>

        <Panel title="Alerts" className="xl:col-span-4">
          <div className="space-y-3">
            {lowStockItems.slice(0, 3).map((item) => (
              <div key={`low-${item.id || item._id}`} className="rounded-md border border-red-100 bg-red-50 p-3">
                <p className="text-sm font-semibold text-red-700">{item.name}</p>
                <p className="text-xs text-red-600">Stock {Number(item.quantityAvailable ?? item.stock ?? 0)} is at threshold.</p>
              </div>
            ))}
            {expiringSoonItems.slice(0, 3).map((item) => (
              <div key={`exp-${item.id || item._id}`} className="rounded-md border border-amber-100 bg-amber-50 p-3">
                <p className="text-sm font-semibold text-amber-800">{item.name}</p>
                <p className="text-xs text-amber-700">Expires in {daysToExpiry(item?.attributes?.expiry)} day(s).</p>
              </div>
            ))}
            {!lowStockItems.length && !expiringSoonItems.length && <p className="text-sm text-gray-500">No active inventory alerts.</p>}
            {planUsage && <ProgressRow label="Product slots" value={productSlotPct} max={100} detail={`${planUsage.visibleProducts}/${planUsage.productLimit}`} color="#F97316" />}
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Panel title="Recent Orders" action={<Link to="/seller/orders" className="text-xs font-medium text-[#F97316]">View orders</Link>} className="xl:col-span-7">
          {isSectionLoading ? (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, idx) => <div key={idx} className="h-12 rounded bg-gray-100 skeleton-shimmer" />)}</div>
          ) : filteredOrders.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">No orders yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="pb-3">Order</th>
                    <th className="pb-3">Customer</th>
                    <th className="pb-3">Total</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.slice(0, 8).map((order) => (
                    <tr key={order.id || order._id} className="border-b last:border-0">
                      <td className="py-3 font-mono">#{String(order.id || order._id).slice(-8)}</td>
                      <td className="py-3">{order.buyer?.fullName || 'N/A'}</td>
                      <td className="py-3 font-semibold">{formatCurrency(order.totalAmount)}</td>
                      <td className="py-3"><StatusPill tone={statusTone(order.status)}>{String(order.status || 'pending').replace(/_/g, ' ')}</StatusPill></td>
                      <td className="py-3 text-gray-500">{order.createdAt ? new Date(order.createdAt).toLocaleDateString() : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel title="Product Actions" className="xl:col-span-5">
          <div className="space-y-3">
            {products.slice(0, 5).map((product) => (
              <div key={product.id || product._id} className="flex items-center justify-between gap-3 rounded-md border border-gray-100 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[#111827]">{product.name}</p>
                  <p className="text-xs text-gray-500">{formatCurrency(product.price)} - Stock {product.quantityAvailable ?? product.stock ?? 0}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Link to={`/seller/edit-product/${product.id || product._id}`} className="rounded-md border border-gray-200 p-2 text-gray-600 hover:text-[#F97316]" title="Edit product">
                    <FaEdit />
                  </Link>
                  <button onClick={() => handleDeleteProduct(product.id || product._id)} className="rounded-md border border-red-100 p-2 text-red-600 hover:bg-red-50" title="Delete product">
                    <FaTrash />
                  </button>
                </div>
              </div>
            ))}
            {!products.length && (
              <div className="rounded-md border border-dashed border-gray-300 p-6 text-center">
                <FaClipboardList className="mx-auto mb-2 text-2xl text-gray-400" />
                <p className="text-sm text-gray-500">Add your first product to start tracking performance.</p>
              </div>
            )}
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Panel title="Latest Reviews" className="xl:col-span-4">
          <div className="space-y-3">
            {products.filter((product) => Number(product.rating || 0) > 0).slice(0, 5).map((product) => (
              <div key={product.id || product._id} className="rounded-md border border-gray-100 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-medium text-[#111827]">{product.name}</p>
                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-[#F59E0B]"><FaStar /> {Number(product.rating || 0).toFixed(1)}</span>
                </div>
              </div>
            ))}
            {ratedProducts === 0 && <p className="text-sm text-gray-500">No product reviews yet.</p>}
          </div>
        </Panel>
        <Panel title="Live Activity Feed" className="xl:col-span-4">
          <div className="space-y-3">
            {filteredOrders.slice(0, 5).map((order) => (
              <div key={`activity-${order.id || order._id}`} className="rounded-md border border-gray-100 px-3 py-2 text-sm">
                <p className="font-medium text-[#111827]">Order #{String(order.id || order._id).slice(-8)}</p>
                <p className="text-xs text-gray-500">{order.buyer?.fullName || 'Customer'} - {formatCurrency(order.totalAmount || 0)}</p>
              </div>
            ))}
            {!filteredOrders.length && <p className="text-sm text-gray-500">No live order activity yet.</p>}
          </div>
        </Panel>
        <Panel title="Reports Center" className="xl:col-span-4">
          <div className="grid grid-cols-2 gap-3">
            <Link to="/seller/orders" className="rounded-md border border-gray-200 px-3 py-3 text-sm font-medium text-[#111827] hover:bg-gray-50"><FaFileExport className="mb-2 text-[#F97316]" />Orders</Link>
            <Link to="/seller/products" className="rounded-md border border-gray-200 px-3 py-3 text-sm font-medium text-[#111827] hover:bg-gray-50"><FaFileExport className="mb-2 text-[#F97316]" />Products</Link>
            <Link to="/seller/scarcity-board" className="rounded-md border border-gray-200 px-3 py-3 text-sm font-medium text-[#111827] hover:bg-gray-50"><FaEye className="mb-2 text-[#F97316]" />Scarcity</Link>
            <Link to="/seller/subscription-plans" className="rounded-md border border-gray-200 px-3 py-3 text-sm font-medium text-[#111827] hover:bg-gray-50"><FaWarehouse className="mb-2 text-[#F97316]" />Plan</Link>
          </div>
        </Panel>
      </div>
    </div>
  );
};

export default SellerDashboard;
