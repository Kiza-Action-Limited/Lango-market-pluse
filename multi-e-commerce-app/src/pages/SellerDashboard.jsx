// src/pages/SellerDashboard.jsx
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FaPlus, FaEdit, FaTrash, FaBox, FaDollarSign, FaShoppingCart, FaLock, FaUnlockAlt, FaClipboardList, FaWarehouse, FaPercent, FaStar, FaUsers, FaFileExport, FaEye, FaTruck, FaQrcode, FaShippingFast, FaMapMarkerAlt, FaFileInvoiceDollar, FaCreditCard, FaDownload, FaComments, FaCheckCircle } from 'react-icons/fa';
import { formatCurrency } from '../utils/formatters';
import { FEATURE_TOOLTIPS, SUBSCRIPTION_FEATURES } from '../config/subscriptionPlans';
import { productService } from '../services/productService';
import { orderService } from '../services/orderService';
import { logisticsService } from '../services/logisticsService';
import { rfqService } from '../services/rfqService';
import { CustomerReviewsPanel, DonutGauge, KpiCard, Panel, ProgressRow, SalesByLocationPanel, StatusPill } from '../components/dashboard/DashboardWidgets';
import NotificationPreferencesCard from '../components/NotificationPreferencesCard';
import SellerWalletConsole from '../components/SellerWalletConsole';
import LiveLogisticsMapPanel from '../components/logistics/LiveLogisticsMapPanel';
import SharedGroupTripPanel from '../components/logistics/SharedGroupTripPanel';
import { formatRealtimeStamp, useRealtimeRefresh } from '../hooks/useRealtimeRefresh';
import { buildReviewSummary, buildSalesByLocation, isPaidOrder } from '../utils/dashboardMetrics';
import { clearPendingSubscriptionPayment, listPendingSubscriptionPayments } from '../utils/subscriptionPaymentRecovery';
import { formatProductCategory, getEffectiveLowStockThreshold } from '../utils/inventorySensitivity';

const getOrderId = (order) => order?.id || order?._id;
const getLogisticsId = (logistics) => logistics?.id || logistics?._id;
const getLogisticsOrderId = (logistics) => logistics?.order?._id || logistics?.order || logistics?.orderId;
const hasGpsPoint = (point) => (
  Number.isFinite(Number(point?.lat ?? point?.gpsLat)) &&
  Number.isFinite(Number(point?.lng ?? point?.gpsLng))
);
const escapeReportText = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');
const logisticsActiveStatuses = new Set(['pending', 'driver_assigned', 'en_route_to_pickup', 'picked_up', 'in_transit', 'out_for_delivery']);
const orderDispatchReadyStatuses = new Set(['payment_escrowed', 'processing', 'dispatched', 'funds_held', 'in_transit']);
const orderClosedStatuses = new Set(['delivered', 'completed', 'cancelled', 'released', 'refunded']);

const SellerDashboard = () => {
  const navigate = useNavigate();
  const { user, activePlan, hasFeature } = useAuth();
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalOrders: 0,
    totalRevenue: 0,
    pendingOrders: 0
  });
  const [products, setProducts] = useState([]);
  const [planUsage, setPlanUsage] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [logisticsByOrder, setLogisticsByOrder] = useState({});
  const [dashboardMapTracking, setDashboardMapTracking] = useState(null);
  const [dashboardMapLoading, setDashboardMapLoading] = useState(false);
  const [sellerRfqs, setSellerRfqs] = useState([]);
  const [pendingSubscriptionPayments, setPendingSubscriptionPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dashboardRange, setDashboardRange] = useState('30d');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  useEffect(() => {
    fetchSellerData();
  }, []);

  useEffect(() => {
    setPendingSubscriptionPayments(listPendingSubscriptionPayments(user));
  }, [user]);

  const fetchSellerData = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const productsRes = await productService.getMyProducts({ page: 1, limit: 20 });
      const myProducts = productsRes?.data || [];
      const usage = productsRes?.planUsage || null;
      const ordersRes = await orderService.getAll({ role: 'seller', page: 1, limit: 50 });
      const sellerOrders = ordersRes?.data || [];
      let rfqRows = [];
      try {
        const rfqRes = await rfqService.getMy({ mode: 'seller', limit: 20 });
        rfqRows = rfqRes?.data || [];
      } catch (error) {
        if (error.response?.status !== 404) {
          console.error('Error fetching seller RFQs:', error);
        }
      }
      const logisticsEntries = await Promise.allSettled(
        sellerOrders
          .map((order) => getOrderId(order))
          .filter(Boolean)
          .map(async (orderId) => {
            try {
              return [orderId, await logisticsService.getByOrder(orderId)];
            } catch (error) {
              if (error.response?.status === 404) return [orderId, null];
              throw error;
            }
          })
      );
      const nextLogisticsByOrder = {};
      logisticsEntries.forEach((entry) => {
        if (entry.status === 'fulfilled' && Array.isArray(entry.value)) {
          const [orderId, logistics] = entry.value;
          nextLogisticsByOrder[orderId] = logistics;
        }
      });
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
      setLogisticsByOrder(nextLogisticsByOrder);
      setSellerRfqs(rfqRows);
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
    const threshold = getEffectiveLowStockThreshold(p);
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
  const logisticsRecords = Object.values(logisticsByOrder).filter(Boolean);
  const dispatchReadyOrders = recentOrders.filter((order) => {
    const orderId = getOrderId(order);
    const status = String(order.status || '').toLowerCase();
    return orderId
      && orderDispatchReadyStatuses.has(status)
      && !orderClosedStatuses.has(status)
      && !logisticsByOrder[orderId];
  });
  const activeDeliveries = logisticsRecords.filter((record) => logisticsActiveStatuses.has(String(record.status || 'pending').toLowerCase()));
  const qrHandoffPending = activeDeliveries.filter((record) => {
    const scans = Array.isArray(record.qrScans) ? record.qrScans : [];
    const pickupDone = Boolean(record.pickupQrConfirmed || scans.some((scan) => scan.step === 'pickup' && scan.verified !== false));
    const deliveryDone = Boolean(record.deliveryQrConfirmed || scans.some((scan) => scan.step === 'delivery' && scan.verified !== false));
    return !pickupDone || !deliveryDone;
  });
  const escrowWindows = logisticsRecords.filter((record) => record.escrowReleaseDue);
  const logisticsCostTotal = logisticsRecords.reduce((sum, record) => sum + Number(record.shippingCost || 0), 0);
  const escrowSplitRows = logisticsRecords
    .filter((record) => record.escrowReleaseDue || record.settlement || Number(record.shippingCost || 0) > 0)
    .slice(0, 5)
    .map((record) => {
      const order = recentOrders.find((item) => String(getOrderId(item)) === String(record.order?._id || record.order));
      const totalEscrowed = Number(record.settlement?.totalEscrowed || order?.totalAmount || 0);
      const driverPayout = Number(record.settlement?.driverPayout || record.shippingCost || 0);
      const sinkingFund = Number(record.settlement?.sinkingFund || (driverPayout > 0 ? driverPayout * 0.1 : 0));
      const platformFee = Number(record.settlement?.platformFee || 0);
      const sellerPayout = Number(record.settlement?.sellerPayout || Math.max(0, totalEscrowed - driverPayout - platformFee));
      return { record, totalEscrowed, sellerPayout, driverPayout, sinkingFund, platformFee };
    });
  const inventoryBySkuRows = [...products]
    .map((product) => {
      const stock = Number(product.quantityAvailable ?? product.stock ?? 0);
      const reserved = Number(product.reservedQuantity || 0);
      const threshold = getEffectiveLowStockThreshold(product);
      const max = Math.max(stock, threshold, reserved, 1);
      const riskScore = threshold > 0 ? stock / threshold : stock > 0 ? 10 : 0;
      return { product, stock, reserved, threshold, max, riskScore };
    })
    .sort((a, b) => a.riskScore - b.riskScore)
    .slice(0, 7);
  const verifiedTrips = logisticsRecords.filter((record) => {
    const status = String(record.status || '').toLowerCase();
    const scans = Array.isArray(record.qrScans) ? record.qrScans : [];
    const pickupDone = Boolean(record.pickupQrConfirmed || scans.some((scan) => scan.step === 'pickup' && scan.verified !== false));
    const deliveryDone = Boolean(record.deliveryQrConfirmed || scans.some((scan) => scan.step === 'delivery' && scan.verified !== false));
    return ['delivered', 'auto_released'].includes(status) && pickupDone && deliveryDone;
  });
  const feedbackQueue = filteredOrders
    .filter((order) => ['delivered', 'completed'].includes(String(order.status || '').toLowerCase()))
    .map((order) => {
      const orderId = getOrderId(order);
      const logistics = logisticsByOrder[orderId] || null;
      const sellerDone = Boolean(order.sellerRating || order.sellerFeedback || order.feedback?.seller);
      const buyerDone = Boolean(order.buyerRating || order.buyerFeedback || order.feedback?.buyer);
      const driverDone = Boolean(logistics?.driverRating || logistics?.driverFeedback || logistics?.feedback?.driver);
      return { order, logistics, sellerDone, buyerDone, driverDone };
    })
    .filter((entry) => !entry.sellerDone || !entry.buyerDone || (entry.logistics && !entry.driverDone))
    .slice(0, 5);
  const topActiveDeliveries = activeDeliveries.slice(0, 4);
  const dashboardLiveDelivery = activeDeliveries.find((record) => (
    hasGpsPoint(record.liveTracking?.driver) ||
    hasGpsPoint(record.gpsTracking?.current) ||
    hasGpsPoint(record.driver?.logisticsProfile?.currentLocation)
  )) || topActiveDeliveries[0] || logisticsRecords.find((record) => (
    hasGpsPoint(record.shippingAddress) ||
    hasGpsPoint(record.pickupAddress)
  )) || null;
  const dashboardLiveDeliveryId = getLogisticsId(dashboardLiveDelivery);
  const dashboardLiveOrderId = getLogisticsOrderId(dashboardLiveDelivery);
  const dashboardLiveOrder = recentOrders.find((order) => String(getOrderId(order)) === String(dashboardLiveOrderId)) || null;
  const dashboardDeliveryReached = Boolean(
    dashboardLiveDelivery?.deliveryQrConfirmed ||
    dashboardLiveDelivery?.qrScans?.some((scan) => scan.step === 'delivery' && scan.verified !== false) ||
    dashboardLiveDelivery?.actualDelivery ||
    dashboardLiveOrder?.deliveredAt
  );
  const openRfqs = sellerRfqs.filter((rfq) => rfq.status === 'open');
  const quotedRfqs = sellerRfqs.filter((rfq) => rfq.status === 'quoted');
  const latestRfqs = sellerRfqs.slice(0, 4);
  const averageRating = products.length
    ? products.reduce((sum, product) => sum + Number(product.rating || 0), 0) / products.length
    : 0;
  const ratedProducts = products.filter((product) => Number(product.rating || 0) > 0).length;
  const productCategoryCounts = products.reduce((acc, product) => {
    const category = formatProductCategory(product.category || 'Uncategorized');
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
  const logisticsStatusLabel = (status) => String(status || 'pending').replace(/_/g, ' ');
  const statusTone = (status) => {
    const normalized = String(status || '').toLowerCase();
    if (['delivered', 'completed', 'paid'].includes(normalized)) return 'green';
    if (['processing', 'payment_escrowed', 'shipped', 'driver_assigned', 'en_route_to_pickup', 'picked_up', 'in_transit', 'out_for_delivery'].includes(normalized)) return 'blue';
    if (['dispatched', 'pending_payment', 'pending'].includes(normalized)) return 'amber';
    if (['cancelled', 'refunded', 'failed'].includes(normalized)) return 'red';
    return 'gray';
  };
  const productImage = (product) => {
    const image = product.images?.[0];
    return typeof image === 'string' ? image : image?.url;
  };
  const handleResumeSubscriptionPayment = (payment) => {
    if (!payment?.planId) return;
    navigate(`/seller/premium-payment?plan=${encodeURIComponent(payment.planId)}`);
  };
  const handleDismissSubscriptionPayment = (payment) => {
    if (!payment?.planId) return;
    clearPendingSubscriptionPayment(user, payment.planId);
    setPendingSubscriptionPayments(listPendingSubscriptionPayments(user));
  };
  const fetchDashboardLiveMap = async ({ silent = false } = {}) => {
    if (!dashboardLiveDeliveryId) {
      setDashboardMapTracking(null);
      return;
    }

    if (!silent) setDashboardMapLoading(true);
    try {
      const mapData = await logisticsService.getMapData(dashboardLiveDeliveryId);
      setDashboardMapTracking(mapData);
    } catch (error) {
      if (error.response?.status !== 404) {
        console.error('Error loading seller dashboard GPS map:', error);
      }
      setDashboardMapTracking(null);
    } finally {
      if (!silent) setDashboardMapLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardLiveMap({ silent: true });
  }, [dashboardLiveDeliveryId]);

  const refreshDashboardGps = async () => {
    await Promise.all([
      fetchSellerData({ silent: true }),
      fetchDashboardLiveMap(),
    ]);
  };

  const handlePrintVerifiedTripReport = (record) => {
    const order = recentOrders.find((item) => String(getOrderId(item)) === String(record.order?._id || record.order));
    const driverName = record.driver?.fullName || record.driver?.name || record.driverName || 'Driver';
    const pickupTown = record.pickupAddress?.town || record.pickupAddress?.city || record.pickupAddress?.address || 'Origin';
    const destinationTown = record.shippingAddress?.town || record.shippingAddress?.city || record.shippingAddress?.address || 'Destination';
    const reportWindow = window.open('', '_blank');
    if (!reportWindow) return;
    const orderLabel = order?.orderNumber || record.orderNumber || String(record.order || '').slice(-8);
    const tripLabel = record.tripId || record.bookingReference || '-';
    const deliveredLabel = record.actualDelivery || order?.deliveredAt ? new Date(record.actualDelivery || order?.deliveredAt).toLocaleString() : '-';
    reportWindow.document.write(`
      <html>
        <head>
          <title>Verified trip ${escapeReportText(tripLabel)}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 32px; color: #111827; }
            h1 { font-size: 22px; margin-bottom: 4px; }
            .muted { color: #6B7280; font-size: 12px; }
            table { border-collapse: collapse; width: 100%; margin-top: 24px; }
            td { border: 1px solid #E5E7EB; padding: 10px; font-size: 13px; }
            td:first-child { font-weight: 700; width: 34%; background: #F9FAFB; }
          </style>
        </head>
        <body>
          <h1>Verified Trip Report</h1>
          <p class="muted">Generated ${new Date().toLocaleString()}</p>
          <table>
            <tr><td>Order</td><td>${escapeReportText(orderLabel)}</td></tr>
            <tr><td>Trip</td><td>${escapeReportText(tripLabel)}</td></tr>
            <tr><td>Route</td><td>${escapeReportText(pickupTown)} to ${escapeReportText(destinationTown)}</td></tr>
            <tr><td>Driver</td><td>${escapeReportText(driverName)}</td></tr>
            <tr><td>Status</td><td>${escapeReportText(logisticsStatusLabel(record.status))}</td></tr>
            <tr><td>Pickup QR</td><td>${record.pickupQrConfirmed ? 'Confirmed' : 'Confirmed by scan log'}</td></tr>
            <tr><td>Delivery QR</td><td>${record.deliveryQrConfirmed ? 'Confirmed' : 'Confirmed by scan log'}</td></tr>
            <tr><td>Shipping Cost</td><td>${escapeReportText(formatCurrency(record.shippingCost || 0))}</td></tr>
            <tr><td>Delivered</td><td>${escapeReportText(deliveredLabel)}</td></tr>
          </table>
        </body>
      </html>
    `);
    reportWindow.document.close();
    reportWindow.focus();
    reportWindow.print();
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

      {pendingSubscriptionPayments.length > 0 && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-md bg-amber-100 text-amber-700">
                <FaCreditCard />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#111827]">Subscription payment needs attention</p>
                <p className="mt-1 text-xs text-amber-800">
                  {pendingSubscriptionPayments[0].message || 'M-Pesa confirmation is still pending.'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleResumeSubscriptionPayment(pendingSubscriptionPayments[0])}
                className="inline-flex h-9 items-center gap-2 rounded-md bg-[#F97316] px-3 text-xs font-medium text-white hover:bg-[#EA580C]"
              >
                <FaCreditCard />
                Recover Payment
              </button>
              <button
                type="button"
                onClick={() => handleDismissSubscriptionPayment(pendingSubscriptionPayments[0])}
                className="h-9 rounded-md border border-amber-200 px-3 text-xs font-medium text-amber-800 hover:bg-amber-100"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

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
        <Panel
          title="SKU Inventory Health"
          action={<Link to="/seller/products" className="text-xs font-medium text-[#F97316]">Edit thresholds</Link>}
          className="xl:col-span-12"
        >
          <div className="grid gap-3 lg:grid-cols-2">
            {inventoryBySkuRows.map(({ product, stock, reserved, threshold, max }) => {
              const sku = product.sku || product.trackingSku || 'SKU pending';
              const availablePct = Math.max(4, (stock / max) * 100);
              const reservedPct = Math.max(0, (reserved / max) * 100);
              return (
                <div key={product.id || product._id || sku} className="rounded-md border border-gray-100 bg-gray-50 p-3">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#111827]">{product.name}</p>
                      <p className="truncate text-xs text-gray-500">{sku}</p>
                    </div>
                    <StatusPill tone={threshold > 0 && stock <= threshold ? 'amber' : stock <= 0 ? 'red' : 'green'}>
                      {stock <= 0 ? 'out' : threshold > 0 && stock <= threshold ? 'low' : 'healthy'}
                    </StatusPill>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-white">
                    <div className="h-full rounded-full bg-[#16A34A]" style={{ width: `${Math.min(100, availablePct)}%` }} />
                  </div>
                  {reserved > 0 && (
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-white">
                      <div className="h-full rounded-full bg-[#F59E0B]" style={{ width: `${Math.min(100, reservedPct)}%` }} />
                    </div>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                    <span>{stock} on hand</span>
                    <span>{reserved} reserved</span>
                    <span>threshold {threshold}</span>
                  </div>
                </div>
              );
            })}
            {!inventoryBySkuRows.length && (
              <p className="rounded-md bg-gray-50 px-3 py-4 text-center text-sm text-gray-500 lg:col-span-2">No SKU inventory to graph yet.</p>
            )}
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <NotificationPreferencesCard
          className="xl:col-span-12"
          title="Notification Preferences"
          description="Keep seller alerts inside the dashboard so you can receive order, stock, and account notifications without leaving your workspace."
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <SellerWalletConsole className="xl:col-span-12" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        {dashboardLiveDelivery ? (
          <LiveLogisticsMapPanel
            trip={dashboardLiveDelivery}
            tracking={dashboardMapTracking}
            order={dashboardLiveOrder}
            title="Seller GPS Delivery Map"
            subtitle={dashboardDeliveryReached
              ? 'Delivery proof is recorded. Review the final driver GPS and buyer destination.'
              : 'Track the logistics driver live from pickup until the shipment reaches the buyer.'}
            eyebrow={dashboardDeliveryReached ? 'Reached buyer' : 'Seller live Google GPS'}
            onRefresh={refreshDashboardGps}
            refreshing={dashboardMapLoading || isRealtimeRefreshing}
            trackingHref={dashboardLiveOrder ? `/orders/${getOrderId(dashboardLiveOrder)}/track` : '/seller/orders'}
            emptyText="Live GPS appears here after the logistics driver starts sharing location."
            className="xl:col-span-12"
          />
        ) : (
          <section className="rounded-lg border border-dashed border-gray-300 bg-white p-5 text-center shadow-sm xl:col-span-12">
            <FaMapMarkerAlt className="mx-auto text-3xl text-[#F97316]" />
            <h3 className="mt-3 text-lg font-bold text-gray-950">Seller GPS Delivery Map</h3>
            <p className="mt-1 text-sm text-gray-600">
              Live Google GPS will show here once a paid order has a logistics shipment and the driver starts sharing location.
            </p>
            <Link
              to="/seller/orders"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#F97316] px-4 py-2 text-sm font-semibold text-white hover:bg-[#EA580C]"
            >
              <FaTruck />
              Open seller orders
            </Link>
          </section>
        )}

        <SharedGroupTripPanel
          title="Kenya Shared Logistics"
          description="Start or join shared routes across Kenya so buyers and sellers going the same direction can split one logistics vehicle by cargo weight."
          canCreate
          className="xl:col-span-12"
        />

        <Panel
          title="Logistics Command Center"
          action={<Link to="/seller/orders" className="text-xs font-medium text-[#F97316]">Manage dispatch</Link>}
          className="xl:col-span-12"
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="rounded-md border border-amber-100 bg-amber-50 p-4">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-amber-100 text-amber-700">
                <FaShippingFast />
              </div>
              <p className="text-xs font-medium uppercase tracking-wide text-amber-700">Pending dispatch</p>
              <p className="mt-1 text-2xl font-bold text-[#111827]">{dispatchReadyOrders.length}</p>
              <p className="mt-1 text-xs text-amber-700">Paid orders without shipment records</p>
            </div>
            <div className="rounded-md border border-blue-100 bg-blue-50 p-4">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-blue-100 text-blue-700">
                <FaTruck />
              </div>
              <p className="text-xs font-medium uppercase tracking-wide text-blue-700">Active deliveries</p>
              <p className="mt-1 text-2xl font-bold text-[#111827]">{activeDeliveries.length}</p>
              <p className="mt-1 text-xs text-blue-700">Live logistics records in motion</p>
            </div>
            <div className="rounded-md border border-purple-100 bg-purple-50 p-4">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-purple-100 text-purple-700">
                <FaQrcode />
              </div>
              <p className="text-xs font-medium uppercase tracking-wide text-purple-700">QR handoff</p>
              <p className="mt-1 text-2xl font-bold text-[#111827]">{qrHandoffPending.length}</p>
              <p className="mt-1 text-xs text-purple-700">Pickup or delivery scans pending</p>
            </div>
            <div className="rounded-md border border-green-100 bg-green-50 p-4">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-green-100 text-green-700">
                <FaLock />
              </div>
              <p className="text-xs font-medium uppercase tracking-wide text-green-700">Escrow windows</p>
              <p className="mt-1 text-2xl font-bold text-[#111827]">{escrowWindows.length}</p>
              <p className="mt-1 text-xs text-green-700">{formatCurrency(logisticsCostTotal)} logistics cost tracked</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-md border border-gray-100 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-[#111827]">Dispatch Queue</p>
                <span className="text-xs text-gray-500">{dispatchReadyOrders.length} ready</span>
              </div>
              <div className="space-y-3">
                {dispatchReadyOrders.slice(0, 4).map((order) => (
                  <div key={`dispatch-${getOrderId(order)}`} className="flex items-center justify-between gap-3 rounded-md bg-gray-50 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[#111827]">Order #{String(getOrderId(order)).slice(-8)}</p>
                      <p className="text-xs text-gray-500">{order.buyer?.fullName || order.customer?.fullName || 'Customer'} - {formatCurrency(order.totalAmount || 0)}</p>
                    </div>
                    <Link to="/seller/orders" className="shrink-0 rounded-md border border-gray-200 px-3 py-2 text-xs font-medium text-[#F97316] hover:bg-white">
                      Open
                    </Link>
                  </div>
                ))}
                {!dispatchReadyOrders.length && (
                  <p className="rounded-md bg-gray-50 px-3 py-4 text-center text-sm text-gray-500">No paid orders waiting for shipment.</p>
                )}
              </div>
            </div>

            <div className="rounded-md border border-gray-100 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-[#111827]">Active Route Tracking</p>
                <span className="text-xs text-gray-500">{topActiveDeliveries.length} shown</span>
              </div>
              <div className="space-y-3">
                {topActiveDeliveries.map((record) => {
                  const pickupTown = record.pickupAddress?.town || record.pickupAddress?.city || record.pickupAddress?.address || 'Origin';
                  const destinationTown = record.shippingAddress?.town || record.shippingAddress?.city || record.shippingAddress?.address || 'Destination';
                  const driverName = record.driver?.fullName || record.driver?.name || 'Driver pending';
                  return (
                    <div key={`route-${record._id || record.id || record.order}`} className="rounded-md bg-gray-50 px-3 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-[#111827]">#{String(record.orderNumber || record.order || record._id || '').slice(-8)}</p>
                          <p className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                            <FaMapMarkerAlt className="shrink-0 text-[#F97316]" />
                            <span className="truncate">{pickupTown} to {destinationTown}</span>
                          </p>
                        </div>
                        <StatusPill tone={statusTone(record.status)}>{logisticsStatusLabel(record.status)}</StatusPill>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                        <span>{driverName}</span>
                        {record.routeInfo?.distanceKm ? <span>{Number(record.routeInfo.distanceKm).toFixed(1)} km</span> : null}
                        {record.escrowReleaseDue ? <span>72h freeze active</span> : null}
                      </div>
                    </div>
                  );
                })}
                {!topActiveDeliveries.length && (
                  <p className="rounded-md bg-gray-50 px-3 py-4 text-center text-sm text-gray-500">No active delivery routes yet.</p>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-md border border-gray-100 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#111827]">Escrow Payout Split</p>
                <p className="mt-1 text-xs text-gray-500">Seller net, logistics cost, sinking fund, and platform fee per tracked shipment.</p>
              </div>
              <span className="text-xs text-gray-500">{escrowSplitRows.length} rows</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="pb-2">Shipment</th>
                    <th className="pb-2">Escrowed</th>
                    <th className="pb-2">Seller</th>
                    <th className="pb-2">Driver</th>
                    <th className="pb-2">Sinking fund</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {escrowSplitRows.map(({ record, totalEscrowed, sellerPayout, driverPayout, sinkingFund }) => (
                    <tr key={`escrow-${record._id || record.id || record.order}`} className="border-b last:border-0">
                      <td className="py-3 font-mono">#{String(record.orderNumber || record.order || record._id || '').slice(-8)}</td>
                      <td className="py-3 font-semibold">{formatCurrency(totalEscrowed)}</td>
                      <td className="py-3">{formatCurrency(sellerPayout)}</td>
                      <td className="py-3">{formatCurrency(driverPayout)}</td>
                      <td className="py-3">{formatCurrency(sinkingFund)}</td>
                      <td className="py-3"><StatusPill tone={record.settlement?.releasedAt ? 'green' : record.escrowReleaseDue ? 'amber' : 'gray'}>{record.settlement?.releasedAt ? 'released' : record.escrowReleaseDue ? 'freeze window' : 'pending'}</StatusPill></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!escrowSplitRows.length && (
              <p className="rounded-md bg-gray-50 px-3 py-4 text-center text-sm text-gray-500">No escrow payout splits available yet.</p>
            )}
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Panel
          title="RFQ Inbox"
          action={<Link to="/seller/rfqs" className="text-xs font-medium text-[#F97316]">Open RFQs</Link>}
          className="xl:col-span-12"
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-md border border-blue-100 bg-blue-50 p-4">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-blue-100 text-blue-700">
                <FaFileInvoiceDollar />
              </div>
              <p className="text-xs font-medium uppercase tracking-wide text-blue-700">Open RFQs</p>
              <p className="mt-1 text-2xl font-bold text-[#111827]">{openRfqs.length}</p>
              <p className="mt-1 text-xs text-blue-700">Buyer requests waiting for seller quote</p>
            </div>
            <div className="rounded-md border border-green-100 bg-green-50 p-4">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-green-100 text-green-700">
                <FaDollarSign />
              </div>
              <p className="text-xs font-medium uppercase tracking-wide text-green-700">Quoted</p>
              <p className="mt-1 text-2xl font-bold text-[#111827]">{quotedRfqs.length}</p>
              <p className="mt-1 text-xs text-green-700">Negotiated offers sent to buyers</p>
            </div>
            <div className="rounded-md border border-amber-100 bg-amber-50 p-4">
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-amber-100 text-amber-700">
                <FaShoppingCart />
              </div>
              <p className="text-xs font-medium uppercase tracking-wide text-amber-700">RFQ Pipeline</p>
              <p className="mt-1 text-2xl font-bold text-[#111827]">{sellerRfqs.length}</p>
              <p className="mt-1 text-xs text-amber-700">Total recent wholesale requests</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {latestRfqs.map((rfq) => (
              <Link
                key={rfq._id || rfq.id}
                to="/seller/rfqs"
                className="rounded-md border border-gray-100 bg-gray-50 p-3 hover:border-[#F97316]/40 hover:bg-white"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#111827]">{rfq.product?.name || 'Product RFQ'}</p>
                    <p className="mt-1 text-xs text-gray-500">{rfq.quantity} {rfq.unit} requested</p>
                  </div>
                  <StatusPill tone={rfq.status === 'quoted' ? 'green' : rfq.status === 'open' ? 'amber' : 'gray'}>{rfq.status}</StatusPill>
                </div>
                <p className="mt-2 text-xs text-gray-500">{rfq.buyer?.businessName || rfq.buyer?.fullName || 'Buyer'}</p>
              </Link>
            ))}
            {!latestRfqs.length && (
              <p className="rounded-md bg-gray-50 px-3 py-4 text-center text-sm text-gray-500 md:col-span-2 xl:col-span-4">No RFQ requests yet.</p>
            )}
          </div>
        </Panel>
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
                <p className="text-xs text-red-600">
                  Stock {Number(item.quantityAvailable ?? item.stock ?? 0)} is at or below threshold {getEffectiveLowStockThreshold(item)}.
                </p>
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
        <Panel title="Verified Trip Reports" className="xl:col-span-6">
          <div className="space-y-3">
            {verifiedTrips.slice(0, 5).map((record) => {
              const pickupTown = record.pickupAddress?.town || record.pickupAddress?.city || record.pickupAddress?.address || 'Origin';
              const destinationTown = record.shippingAddress?.town || record.shippingAddress?.city || record.shippingAddress?.address || 'Destination';
              return (
                <div key={`verified-${record._id || record.id || record.order}`} className="flex items-center justify-between gap-3 rounded-md border border-gray-100 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[#111827]">#{String(record.orderNumber || record.order || record._id || '').slice(-8)}</p>
                    <p className="mt-1 truncate text-xs text-gray-500">{pickupTown} to {destinationTown}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handlePrintVerifiedTripReport(record)}
                    className="inline-flex h-9 shrink-0 items-center gap-2 rounded-md border border-gray-200 px-3 text-xs font-medium text-[#F97316] hover:bg-gray-50"
                  >
                    <FaDownload />
                    Print PDF
                  </button>
                </div>
              );
            })}
            {!verifiedTrips.length && (
              <p className="rounded-md bg-gray-50 px-3 py-4 text-center text-sm text-gray-500">Verified pickup and delivery trips will appear after both QR handoffs are confirmed.</p>
            )}
          </div>
        </Panel>

        <Panel title="3-Way Feedback Queue" className="xl:col-span-6">
          <div className="space-y-3">
            {feedbackQueue.map(({ order, logistics, sellerDone, buyerDone, driverDone }) => (
              <div key={`feedback-${getOrderId(order)}`} className="rounded-md border border-gray-100 p-3">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[#111827]">Order #{String(getOrderId(order)).slice(-8)}</p>
                    <p className="text-xs text-gray-500">{order.buyer?.fullName || order.customer?.fullName || 'Customer'} - {formatCurrency(order.totalAmount || 0)}</p>
                  </div>
                  <Link to="/seller/orders" className="text-xs font-medium text-[#F97316]">Open</Link>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <span className={`inline-flex items-center justify-center gap-1 rounded-md px-2 py-2 ${sellerDone ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                    {sellerDone ? <FaCheckCircle /> : <FaComments />}
                    Seller
                  </span>
                  <span className={`inline-flex items-center justify-center gap-1 rounded-md px-2 py-2 ${buyerDone ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                    {buyerDone ? <FaCheckCircle /> : <FaComments />}
                    Buyer
                  </span>
                  <span className={`inline-flex items-center justify-center gap-1 rounded-md px-2 py-2 ${!logistics || driverDone ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                    {!logistics || driverDone ? <FaCheckCircle /> : <FaComments />}
                    Driver
                  </span>
                </div>
              </div>
            ))}
            {!feedbackQueue.length && (
              <p className="rounded-md bg-gray-50 px-3 py-4 text-center text-sm text-gray-500">No delivered orders are waiting for seller, buyer, or driver feedback.</p>
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
