// src/pages/SellerDashboard.jsx
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FaPlus, FaEdit, FaTrash, FaBox, FaDollarSign, FaShoppingCart, FaLock, FaUnlockAlt, FaClipboardList, FaWarehouse, FaPercent, FaStar, FaUsers, FaFileExport, FaEye, FaFileInvoiceDollar, FaCreditCard, FaDownload, FaComments, FaCheckCircle, FaBook, FaReceipt, FaSave, FaUndo, FaWallet, FaShieldAlt, FaTruck } from 'react-icons/fa';
import { formatCurrency } from '../utils/formatters';
import { FEATURE_TOOLTIPS, SUBSCRIPTION_FEATURES } from '../config/subscriptionPlans';
import { productService } from '../services/productService';
import { orderService } from '../services/orderService';
import { logisticsService } from '../services/logisticsService';
import { rfqService } from '../services/rfqService';
import { sellerJournalService } from '../services/sellerJournalService';
import api from '../config/axios';
import { CustomerReviewsPanel, DonutGauge, KpiCard, Panel, ProgressRow, SalesByLocationPanel, StatusPill } from '../components/dashboard/DashboardWidgets';
import NotificationPreferencesCard from '../components/NotificationPreferencesCard';
import SellerWalletConsole from '../components/SellerWalletConsole';
import { formatRealtimeStamp, useRealtimeRefresh } from '../hooks/useRealtimeRefresh';
import { buildReviewSummary, buildSalesByLocation, isPaidOrder } from '../utils/dashboardMetrics';
import { clearPendingSubscriptionPayment, listPendingSubscriptionPayments } from '../utils/subscriptionPaymentRecovery';
import { formatProductCategory, getEffectiveLowStockThreshold } from '../utils/inventorySensitivity';

const getOrderId = (order) => order?.id || order?._id;
const readMetadata = (source, key) => {
  const metadata = source?.metadata;
  if (!metadata) return undefined;
  if (typeof metadata.get === 'function') return metadata.get(key);
  return metadata[key];
};
const getLogisticsPreference = (order = {}) => {
  const preference = order.logisticsPreference || {};
  const provider = preference.requestedProvider;
  const providerObject = provider && typeof provider === 'object' ? provider : null;
  const logistics = order.logistics || {};
  const profile = providerObject?.logisticsProfile || {};

  return {
    id: providerObject?._id || providerObject?.id || provider || readMetadata(logistics, 'selectedProviderId') || '',
    name:
      preference.providerName ||
      providerObject?.businessName ||
      providerObject?.fullName ||
      providerObject?.name ||
      readMetadata(logistics, 'selectedProviderName') ||
      logistics.driverName ||
      '',
    phone: preference.providerPhone || providerObject?.phone || readMetadata(logistics, 'selectedProviderPhone') || logistics.driverPhone || '',
    hub: preference.providerHub || profile.baseHub || profile.locationHub || '',
    source: preference.selectionSource || readMetadata(logistics, 'selectedBy') || 'default',
  };
};
const sellerCsvExportTypes = [
  'products',
  'orders',
  'rfqs',
  'reviews',
  'transactions',
  'payments',
  'subscriptions',
  'documents',
];
const formatSellerExportLabel = (value) => String(value || '')
  .replace(/_/g, ' ')
  .replace(/\b\w/g, (letter) => letter.toUpperCase());
const sellerCsvExportMeta = {
  products: { label: 'Products CSV', detail: 'Catalog, stock and pricing records' },
  orders: { label: 'All Orders CSV', detail: 'Buyer, payment, escrow and delivery records' },
  rfqs: { label: 'RFQs CSV', detail: 'Quote requests and offer activity' },
  reviews: { label: 'Reviews CSV', detail: 'Ratings and verified buyer feedback' },
  transactions: { label: 'Transactions CSV', detail: 'Wallet movement and balances' },
  payments: { label: 'Payments CSV', detail: 'Payment references and settlement status' },
  subscriptions: { label: 'Subscriptions CSV', detail: 'Plan billing and renewal history' },
  documents: { label: 'Documents CSV', detail: 'Verification and seller document records' },
};
const getSellerExportMeta = (type) => sellerCsvExportMeta[type] || {
  label: formatSellerExportLabel(type),
  detail: 'Download seller report',
};
const buildDashboardDateRange = (range) => {
  const end = new Date();
  const start = new Date(end);

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

  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
};
const initialSellerJournalForm = {
  entryType: 'offline_sale',
  productId: '',
  adjustmentMode: 'subtract',
  inventoryAction: 'increase',
  quantity: '',
  unitCost: '',
  unitPrice: '',
  amount: '',
  affectsMainAccount: true,
  returnSettlement: 'customer_refund',
  supplierName: '',
  partyName: '',
  partyPhone: '',
  partyType: '',
  paymentMethod: 'cash',
  category: '',
  reference: '',
  notes: '',
};
const sellerJournalTabs = [
  { key: 'offline_sale', label: 'Sales', icon: FaShoppingCart },
  { key: 'offline_purchase', label: 'Purchases', icon: FaReceipt },
  { key: 'expense', label: 'Expenses', icon: FaFileInvoiceDollar },
  { key: 'return', label: 'Returns', icon: FaUndo },
  { key: 'stock_adjustment', label: 'Adjustments', icon: FaWarehouse },
  { key: 'reports', label: 'Reports', icon: FaFileExport },
];

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
  const [sellerLogisticsRequests, setSellerLogisticsRequests] = useState([]);
  const [sellerRfqs, setSellerRfqs] = useState([]);
  const [journalEntries, setJournalEntries] = useState([]);
  const [journalSummary, setJournalSummary] = useState(null);
  const [journalForm, setJournalForm] = useState(initialSellerJournalForm);
  const [activeJournalTab, setActiveJournalTab] = useState('offline_sale');
  const [journalSaving, setJournalSaving] = useState(false);
  const [pendingSubscriptionPayments, setPendingSubscriptionPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dashboardRange, setDashboardRange] = useState('30d');
  const [dateRange, setDateRange] = useState(() => buildDashboardDateRange('30d'));

  useEffect(() => {
    fetchSellerData();
  }, [dashboardRange]);

  useEffect(() => {
    setPendingSubscriptionPayments(listPendingSubscriptionPayments(user));
  }, [user]);

  const fetchSellerData = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const productsRes = await productService.getMyProducts({ page: 1, limit: 100 });
      const myProducts = productsRes?.data || [];
      const usage = productsRes?.planUsage || null;
      const ordersRes = await orderService.getAll({ role: 'seller', page: 1, limit: 100, range: dashboardRange });
      const sellerOrders = ordersRes?.data || [];
      const orderSummary = ordersRes?.summary || {};
      let rfqRows = [];
      let logisticsRequestRows = [];
      let journalRows = [];
      let nextJournalSummary = null;
      try {
        logisticsRequestRows = await logisticsService.getSellerBuyerRequests({ limit: 8 });
      } catch (error) {
        if (error.response?.status !== 404 && error.response?.status !== 403) {
          console.error('Error fetching buyer logistics requests:', error);
        }
      }
      try {
        const rfqRes = await rfqService.getMy({ mode: 'seller', limit: 20 });
        rfqRows = rfqRes?.data || [];
      } catch (error) {
        if (error.response?.status !== 404) {
          console.error('Error fetching seller RFQs:', error);
        }
      }
      try {
        const journalRes = await sellerJournalService.list({ limit: 8 });
        journalRows = journalRes?.data || [];
        nextJournalSummary = journalRes?.summary || null;
      } catch (error) {
        if (error.response?.status !== 404) {
          console.error('Error fetching seller journal:', error);
        }
      }
      const visibleRevenue = sellerOrders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
      const visiblePendingOrders = sellerOrders.filter((o) =>
        ['pending_payment', 'payment_escrowed', 'processing', 'dispatched'].includes(o.status)
      ).length;

      setProducts(myProducts);
      setPlanUsage(usage);
      setStats({
        totalProducts: usage?.totalProducts ?? myProducts.length,
        totalOrders: Number(orderSummary.totalOrders ?? ordersRes?.pagination?.total ?? sellerOrders.length),
        totalRevenue: Number(orderSummary.totalRevenue ?? visibleRevenue),
        pendingOrders: Number(orderSummary.pendingOrders ?? visiblePendingOrders),
      });
      setRecentOrders(sellerOrders);
      setSellerLogisticsRequests(Array.isArray(logisticsRequestRows) ? logisticsRequestRows : []);
      setSellerRfqs(rfqRows);
      setJournalEntries(journalRows);
      setJournalSummary(nextJournalSummary);
    } catch (error) {
      console.error('Error fetching seller data:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const { lastUpdated, isRefreshing: isRealtimeRefreshing } = useRealtimeRefresh(
    () => fetchSellerData({ silent: true }),
    { enabled: true, intervalMs: 12000, immediate: true, deps: [dashboardRange] }
  );

  const handleSellerExport = async (type) => {
    try {
      const response = await api.get(`/v1/seller/export/${type}`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'text/csv' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `seller_${type}_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting seller data:', error);
      alert(error.response?.data?.message || 'Failed to export seller data');
    }
  };

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
    setDateRange(buildDashboardDateRange(range));
  };

  const selectedJournalProduct = products.find((product) => String(product.id || product._id) === String(journalForm.productId));
  const journalQuantity = Number(journalForm.quantity || 0);
  const journalUnitCost = Number(journalForm.unitCost || 0);
  const journalUnitPrice = Number(journalForm.unitPrice || 0);
  const journalAmount = Number(journalForm.amount || 0);
  const journalReturnUnitValue = journalUnitPrice || journalUnitCost;
  const journalTotalCost = activeJournalTab === 'expense'
    ? Math.max(0, journalAmount)
    : activeJournalTab === 'return'
      ? Math.max(0, journalAmount || (journalQuantity * journalReturnUnitValue))
    : activeJournalTab === 'offline_sale'
      ? Math.max(0, journalQuantity * journalUnitPrice)
      : Math.max(0, journalQuantity * journalUnitCost);
  const currentJournalStock = Number(selectedJournalProduct?.quantityAvailable ?? selectedJournalProduct?.stock ?? 0);
  const previewJournalStock = selectedJournalProduct
    ? activeJournalTab === 'offline_purchase'
      ? currentJournalStock + journalQuantity
      : activeJournalTab === 'offline_sale'
        ? Math.max(0, currentJournalStock - journalQuantity)
        : activeJournalTab === 'stock_adjustment'
          ? journalForm.adjustmentMode === 'set'
            ? journalQuantity
            : journalForm.adjustmentMode === 'add'
              ? currentJournalStock + journalQuantity
              : Math.max(0, currentJournalStock - journalQuantity)
          : activeJournalTab === 'return'
            ? journalForm.inventoryAction === 'none'
              ? currentJournalStock
              : journalForm.inventoryAction === 'decrease'
                ? Math.max(0, currentJournalStock - journalQuantity)
                : currentJournalStock + journalQuantity
            : currentJournalStock
    : 0;
  const journalAccountSummary = journalSummary?.account || {};
  const journalWithdrawableBalance = Number(journalAccountSummary.withdrawableBalance || 0);
  const journalAccountCredits = Number(journalAccountSummary.month?.credits ?? journalAccountSummary.credits ?? 0);
  const journalAccountDebits = Number(journalAccountSummary.month?.debits ?? journalAccountSummary.debits ?? 0);
  const journalAccountNet = Number(journalAccountSummary.month?.net ?? journalAccountSummary.net ?? 0);
  const journalPostsToAccount = Boolean(journalForm.affectsMainAccount) && activeJournalTab !== 'stock_adjustment' && journalForm.paymentMethod !== 'credit';
  const journalAccountImpact = !journalPostsToAccount
    ? 'none'
    : activeJournalTab === 'offline_sale'
      ? 'credit'
      : activeJournalTab === 'return'
        ? journalForm.returnSettlement === 'supplier_refund'
          ? 'credit'
          : journalForm.returnSettlement === 'customer_refund'
            ? 'debit'
            : 'none'
        : ['offline_purchase', 'expense'].includes(activeJournalTab)
          ? 'debit'
          : 'none';

  const handleJournalFormChange = (event) => {
    const { name, type, checked, value } = event.target;
    setJournalForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
      ...(name === 'returnSettlement' && value === 'customer_refund' ? { affectsMainAccount: true } : {}),
      ...(name === 'paymentMethod' && value === 'credit' && prev.returnSettlement === 'customer_refund' ? { returnSettlement: 'no_cash' } : {}),
    }));
  };

  const handleJournalTabChange = (tab) => {
    setActiveJournalTab(tab);
    setJournalForm((prev) => ({
      ...prev,
      entryType: tab === 'reports' ? prev.entryType : tab,
      adjustmentMode: tab === 'offline_sale' ? 'subtract' : tab === 'offline_purchase' ? 'add' : tab === 'stock_adjustment' ? 'set' : prev.adjustmentMode,
      inventoryAction: tab === 'return' ? 'increase' : prev.inventoryAction,
      affectsMainAccount: tab !== 'stock_adjustment',
      returnSettlement: tab === 'return' ? 'customer_refund' : prev.returnSettlement,
    }));
  };

  const handleJournalSubmit = async (event) => {
    event.preventDefault();
    if (activeJournalTab === 'reports') return;
    const needsProduct = activeJournalTab !== 'expense';
    if ((needsProduct && !journalForm.productId) || (needsProduct && journalQuantity <= 0)) {
      window.alert('Choose a product and enter a quantity greater than zero.');
      return;
    }
    if (activeJournalTab === 'expense' && journalAmount <= 0) {
      window.alert('Enter an expense amount greater than zero.');
      return;
    }
    if (activeJournalTab === 'return' && journalForm.returnSettlement !== 'no_cash' && journalTotalCost <= 0) {
      window.alert('Enter the customer refund or supplier refund amount.');
      return;
    }

    setJournalSaving(true);
    try {
      await sellerJournalService.create({
        entryType: activeJournalTab,
        productId: journalForm.productId,
        adjustmentMode: journalForm.adjustmentMode,
        inventoryAction: journalForm.inventoryAction,
        quantity: journalQuantity,
        unitCost: journalUnitCost,
        unitPrice: journalUnitPrice,
        amount: journalAmount,
        affectsMainAccount: journalPostsToAccount,
        returnSettlement: journalForm.returnSettlement,
        supplierName: journalForm.supplierName,
        partyName: journalForm.partyName,
        partyPhone: journalForm.partyPhone,
        partyType: journalForm.partyType,
        paymentMethod: journalForm.paymentMethod,
        category: journalForm.category,
        reference: journalForm.reference,
        notes: journalForm.notes,
      });
      setJournalForm((prev) => ({
        ...initialSellerJournalForm,
        entryType: activeJournalTab,
        productId: prev.productId,
        supplierName: prev.supplierName,
        partyName: prev.partyName,
        paymentMethod: prev.paymentMethod,
      }));
      await fetchSellerData({ silent: true });
    } catch (error) {
      console.error('Error saving seller journal:', error);
      window.alert(error.response?.data?.message || 'Failed to save seller journal entry');
    } finally {
      setJournalSaving(false);
    }
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
      description: 'Tracks fees, SMS cost, and payment impact against your profit flow.',
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
  const feedbackQueue = filteredOrders
    .filter((order) => ['delivered', 'completed'].includes(String(order.status || '').toLowerCase()))
    .map((order) => {
      const sellerDone = Boolean(order.sellerRating || order.sellerFeedback || order.feedback?.seller);
      const buyerDone = Boolean(order.buyerRating || order.buyerFeedback || order.feedback?.buyer);
      return { order, sellerDone, buyerDone };
    })
    .filter((entry) => !entry.sellerDone || !entry.buyerDone)
    .slice(0, 5);
  const buyerLogisticsRequests = filteredOrders
    .map((order) => ({ order, provider: getLogisticsPreference(order) }))
    .filter(({ provider }) => provider.source === 'buyer' && (provider.id || provider.name))
    .slice(0, 4);
  const visibleBuyerLogisticsRequests = sellerLogisticsRequests.length
    ? sellerLogisticsRequests.slice(0, 4).map((request) => ({
      request,
      order: {
        id: request.orderId,
        _id: request.orderId,
        orderNumber: request.orderNumber,
        deliveryAddress: request.destination,
        shippingAddress: request.destination,
      },
      provider: request.logisticsProvider || {},
    }))
    : buyerLogisticsRequests;
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
  const statusTone = (status) => {
    const normalized = String(status || '').toLowerCase();
    if (['delivered', 'completed', 'paid'].includes(normalized)) return 'green';
    if (['processing', 'payment_escrowed', 'shipped', 'in_transit'].includes(normalized)) return 'blue';
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
  return (
    <div className="dashboard-shell min-h-screen bg-[#F7F8FA] px-4 py-6 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#F97316]">Seller workspace</p>
          <h1 className="mt-1 truncate text-2xl font-bold text-[#111827]">Performance Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            {activePlan ? `${activePlan.name} plan, ${activePlan.priceLabel}` : 'Inventory, revenue, and order performance'}
          </p>
        </div>
        <div className="dashboard-actionbar">
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
            <Link to="/seller/add-product" className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#F97316] px-4 text-sm font-medium text-white hover:bg-[#EA580C]">
              <FaPlus />
              Add Product
            </Link>
          ) : (
            <Link
              to="/seller/subscription-plans"
              title={FEATURE_TOOLTIPS[SUBSCRIPTION_FEATURES.INVENTORY_LEDGER] || 'Upgrade subscription to unlock inventory tools'}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-gray-200 px-4 text-sm font-medium text-gray-700 hover:bg-gray-300"
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
        <Panel
          title="Seller Journal"
          action={<Link to="/seller/add-product" className="inline-flex items-center gap-1 text-xs font-medium text-[#F97316]"><FaPlus /> Create product</Link>}
          className="xl:col-span-12"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
              <div className="rounded-md border border-green-100 bg-green-50 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-green-700">Sales Today</p>
                <p className="mt-1 text-xl font-bold text-[#111827]">{formatCurrency(journalSummary?.today?.sales || 0)}</p>
                <p className="text-xs text-green-700">{journalSummary?.today?.salesCount || 0} transactions</p>
              </div>
              <div className="rounded-md border border-blue-100 bg-blue-50 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-blue-700">Purchases Today</p>
                <p className="mt-1 text-xl font-bold text-[#111827]">{formatCurrency(journalSummary?.today?.purchases || 0)}</p>
                <p className="text-xs text-blue-700">{journalSummary?.today?.purchaseCount || 0} purchases</p>
              </div>
              <div className="rounded-md border border-red-100 bg-red-50 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-red-700">Expenses Today</p>
                <p className="mt-1 text-xl font-bold text-[#111827]">{formatCurrency(journalSummary?.today?.expenses || 0)}</p>
                <p className="text-xs text-red-700">{journalSummary?.today?.expenseCount || 0} records</p>
              </div>
              <div className="rounded-md border border-orange-100 bg-orange-50 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-orange-700">Profit Today</p>
                <p className="mt-1 text-xl font-bold text-[#111827]">{formatCurrency(journalSummary?.today?.profit || 0)}</p>
                <p className="text-xs text-orange-700">Sales minus purchases and expenses</p>
              </div>
              <div className="rounded-md border border-gray-100 bg-gray-50 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Inventory Value</p>
                <p className="mt-1 text-xl font-bold text-[#111827]">{formatCurrency(products.reduce((sum, product) => sum + (Number(product.quantityAvailable ?? product.stock ?? 0) * Number(product.price || 0)), 0))}</p>
                <p className="text-xs text-gray-500">{totalStock} units on hand</p>
              </div>
              <div className="rounded-md border border-sky-100 bg-sky-50 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-sky-700">Main Account</p>
                <p className="mt-1 text-xl font-bold text-[#111827]">{formatCurrency(journalWithdrawableBalance)}</p>
                <p className="text-xs text-sky-700">Withdrawable balance</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 rounded-md border border-gray-100 bg-white p-3 lg:grid-cols-[1.2fr_0.8fr_auto]">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#111827] text-white">
                  <FaWallet />
                </span>
                <div>
                  <p className="text-sm font-semibold text-[#111827]">Journal posts to seller main account</p>
                  <p className="mt-1 text-xs leading-5 text-gray-500">Cash, M-Pesa, bank, card, and mixed journal payments update wallet balance so released money can be withdrawn from the payout center.</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-md bg-green-50 p-2">
                  <p className="text-green-700">Credits</p>
                  <p className="mt-1 font-semibold text-[#111827]">{formatCurrency(journalAccountCredits)}</p>
                </div>
                <div className="rounded-md bg-red-50 p-2">
                  <p className="text-red-700">Debits</p>
                  <p className="mt-1 font-semibold text-[#111827]">{formatCurrency(journalAccountDebits)}</p>
                </div>
                <div className="rounded-md bg-gray-50 p-2">
                  <p className="text-gray-500">Net</p>
                  <p className="mt-1 font-semibold text-[#111827]">{formatCurrency(journalAccountNet)}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => document.getElementById('seller-wallet')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-gray-200 px-4 text-sm font-semibold text-[#111827] hover:border-[#F97316] hover:text-[#F97316]"
              >
                <FaDollarSign /> Withdraw
              </button>
            </div>

            <div className="flex gap-2 overflow-x-auto rounded-md border border-gray-100 bg-gray-50 p-2">
              {sellerJournalTabs.map((tab) => {
                const TabIcon = tab.icon;
                const active = activeJournalTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => handleJournalTabChange(tab.key)}
                    className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-semibold ${
                      active ? 'bg-[#111827] text-white' : 'bg-white text-gray-600 hover:text-[#111827]'
                    }`}
                  >
                    <TabIcon /> {tab.label}
                  </button>
                );
              })}
            </div>

            {activeJournalTab === 'reports' ? (
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
                <div className="rounded-md border border-gray-100 bg-gray-50 p-4 xl:col-span-5">
                  <p className="text-sm font-semibold text-[#111827]">Monthly Summary</p>
                  <div className="mt-3 space-y-2 text-sm">
                    <div className="flex justify-between gap-3"><span className="text-gray-500">Sales</span><strong>{formatCurrency(journalSummary?.month?.sales || 0)}</strong></div>
                    <div className="flex justify-between gap-3"><span className="text-gray-500">Purchases</span><strong>{formatCurrency(journalSummary?.month?.purchases || 0)}</strong></div>
                    <div className="flex justify-between gap-3"><span className="text-gray-500">Expenses</span><strong>{formatCurrency(journalSummary?.month?.expenses || 0)}</strong></div>
                    <div className="flex justify-between gap-3 border-t border-gray-200 pt-2"><span className="text-gray-500">Profit</span><strong>{formatCurrency(journalSummary?.month?.profit || 0)}</strong></div>
                    <div className="flex justify-between gap-3"><span className="text-gray-500">Inventory movement</span><strong>{journalSummary?.month?.inventoryMovement || 0}</strong></div>
                  </div>
                </div>
                <div className="rounded-md border border-gray-100 bg-white p-4 xl:col-span-7">
                  <p className="text-sm font-semibold text-[#111827]">Available Exports</p>
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {['Sales Summary', 'Purchase Summary', 'Inventory Movement'].map((label) => (
                      <button key={label} type="button" onClick={() => handleSellerExport('products')} className="rounded-md border border-gray-200 px-3 py-3 text-left text-sm font-medium text-[#111827] hover:bg-gray-50">
                        <FaDownload className="mb-2 text-[#F97316]" />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
                <form onSubmit={handleJournalSubmit} className="space-y-3 rounded-md border border-gray-100 bg-gray-50 p-3 xl:col-span-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[#111827]">
                        {sellerJournalTabs.find((tab) => tab.key === activeJournalTab)?.label || 'Journal'} Entry
                      </p>
                      <p className="text-xs text-gray-500">{journalSummary?.entries || journalEntries.length || 0} total journal records</p>
                    </div>
                    <span className="flex h-9 w-9 items-center justify-center rounded-md bg-white text-[#F97316] shadow-sm">
                      <FaBook />
                    </span>
                  </div>

                  {activeJournalTab !== 'expense' && (
                    <label className="block text-xs font-medium text-gray-600">
                      Product
                      <select
                        name="productId"
                        value={journalForm.productId}
                        onChange={handleJournalFormChange}
                        className="mt-1 h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-[#F97316]"
                        required
                      >
                        <option value="">Select product</option>
                        {products.map((product) => (
                          <option key={product.id || product._id} value={product.id || product._id}>
                            {product.name} - stock {product.quantityAvailable ?? product.stock ?? 0} {product.unit || ''}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="block text-xs font-medium text-gray-600">
                      {activeJournalTab === 'offline_sale' ? 'Customer/Supplier' : activeJournalTab === 'expense' ? 'Vendor' : 'Supplier/Party'}
                      <input
                        name="partyName"
                        value={journalForm.partyName}
                        onChange={handleJournalFormChange}
                        className="mt-1 h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-[#F97316]"
                        placeholder="Name"
                      />
                    </label>
                    <label className="block text-xs font-medium text-gray-600">
                      Phone
                      <input
                        name="partyPhone"
                        value={journalForm.partyPhone}
                        onChange={handleJournalFormChange}
                        className="mt-1 h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-[#F97316]"
                        placeholder="Optional"
                      />
                    </label>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {activeJournalTab !== 'expense' && (
                      <label className="block text-xs font-medium text-gray-600">
                        Quantity
                        <input type="number" min="0.001" step="0.001" name="quantity" value={journalForm.quantity} onChange={handleJournalFormChange} className="mt-1 h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-[#F97316]" required />
                      </label>
                    )}
                    {activeJournalTab === 'offline_sale' && (
                      <label className="block text-xs font-medium text-gray-600">
                        Selling price
                        <input type="number" min="0" step="0.01" name="unitPrice" value={journalForm.unitPrice} onChange={handleJournalFormChange} className="mt-1 h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-[#F97316]" />
                      </label>
                    )}
                    {['offline_purchase', 'stock_adjustment'].includes(activeJournalTab) && (
                      <label className="block text-xs font-medium text-gray-600">
                        Buying cost
                        <input type="number" min="0" step="0.01" name="unitCost" value={journalForm.unitCost} onChange={handleJournalFormChange} className="mt-1 h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-[#F97316]" />
                      </label>
                    )}
                    {activeJournalTab === 'return' && (
                      <label className="block text-xs font-medium text-gray-600">
                        Refund amount
                        <input type="number" min="0" step="0.01" name="amount" value={journalForm.amount} onChange={handleJournalFormChange} className="mt-1 h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-[#F97316]" placeholder="Money returned" />
                      </label>
                    )}
                    {activeJournalTab === 'expense' && (
                      <label className="block text-xs font-medium text-gray-600">
                        Amount
                        <input type="number" min="0.01" step="0.01" name="amount" value={journalForm.amount} onChange={handleJournalFormChange} className="mt-1 h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-[#F97316]" required />
                      </label>
                    )}
                    {activeJournalTab === 'stock_adjustment' && (
                      <label className="block text-xs font-medium text-gray-600">
                        Mode
                        <select name="adjustmentMode" value={journalForm.adjustmentMode} onChange={handleJournalFormChange} className="mt-1 h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-[#F97316]">
                          <option value="set">Set stock</option>
                          <option value="add">Add stock</option>
                          <option value="subtract">Reduce stock</option>
                        </select>
                      </label>
                    )}
                    {activeJournalTab === 'return' && (
                      <label className="block text-xs font-medium text-gray-600">
                        Inventory action
                        <select name="inventoryAction" value={journalForm.inventoryAction} onChange={handleJournalFormChange} className="mt-1 h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-[#F97316]">
                          <option value="increase">Return to stock</option>
                          <option value="decrease">Supplier return</option>
                          <option value="none">Dispose / no stock change</option>
                        </select>
                      </label>
                    )}
                    {activeJournalTab === 'return' && (
                      <label className="block text-xs font-medium text-gray-600">
                        Settlement
                        <select name="returnSettlement" value={journalForm.returnSettlement} onChange={handleJournalFormChange} className="mt-1 h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-[#F97316]">
                          <option value="customer_refund">Refund customer</option>
                          <option value="supplier_refund">Supplier refunded seller</option>
                          <option value="no_cash">No cash movement</option>
                        </select>
                      </label>
                    )}
                    <label className="block text-xs font-medium text-gray-600">
                      Payment
                      <select name="paymentMethod" value={journalForm.paymentMethod} onChange={handleJournalFormChange} className="mt-1 h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-[#F97316]">
                        <option value="cash">Cash</option>
                        <option value="mpesa">M-Pesa</option>
                        <option value="bank">Bank</option>
                        <option value="credit">Credit</option>
                        <option value="mixed">Mixed</option>
                      </select>
                    </label>
                  </div>

                  {activeJournalTab !== 'stock_adjustment' && (
                    <label className="flex items-start gap-3 rounded-md border border-gray-200 bg-white p-3 text-sm">
                      <input
                        type="checkbox"
                        name="affectsMainAccount"
                        checked={Boolean(journalForm.affectsMainAccount)}
                        onChange={handleJournalFormChange}
                        disabled={activeJournalTab === 'return' && journalForm.returnSettlement === 'customer_refund'}
                        className="mt-1 h-4 w-4 rounded border-gray-300 text-[#F97316] focus:ring-[#F97316]"
                      />
                      <span>
                        <span className="block font-semibold text-[#111827]">Post this entry to seller main account</span>
                        <span className="mt-1 block text-xs leading-5 text-gray-500">Credit sales and supplier refunds, debit purchases, expenses, and customer refunds before withdrawal.</span>
                      </span>
                    </label>
                  )}

                  {activeJournalTab === 'return' && journalForm.returnSettlement === 'customer_refund' && (
                    <div className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
                      <FaShieldAlt className="mt-0.5 shrink-0" />
                      Customer refund entries debit the main account first. The backend blocks the entry if withdrawable balance cannot cover the refund.
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="block text-xs font-medium text-gray-600">
                      Category / Type
                      <input name="category" value={journalForm.category} onChange={handleJournalFormChange} className="mt-1 h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-[#F97316]" placeholder={activeJournalTab === 'expense' ? 'Transport, rent, fuel...' : 'Walk-in, wholesaler...'} />
                    </label>
                    <label className="block text-xs font-medium text-gray-600">
                      Reference
                      <input name="reference" value={journalForm.reference} onChange={handleJournalFormChange} className="mt-1 h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-[#F97316]" placeholder="Invoice, receipt or note" />
                    </label>
                  </div>

                  <label className="block text-xs font-medium text-gray-600">
                    Notes
                    <textarea name="notes" value={journalForm.notes} onChange={handleJournalFormChange} rows={3} className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#F97316]" placeholder="Customer, supplier, batch, location, reason, or payment notes" />
                  </label>

                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-white px-3 py-2 text-sm">
                    <div>
                      <p className="text-xs text-gray-500">{activeJournalTab === 'expense' ? 'Record amount' : 'New stock'}</p>
                      <p className="font-semibold text-[#111827]">
                        {activeJournalTab === 'expense'
                          ? formatCurrency(journalTotalCost)
                          : selectedJournalProduct ? `${previewJournalStock} ${selectedJournalProduct.unit || ''}` : '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Financial total</p>
                      <p className="font-semibold text-[#111827]">{formatCurrency(journalTotalCost)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Account impact</p>
                      <p className={`font-semibold ${journalAccountImpact === 'credit' ? 'text-green-700' : journalAccountImpact === 'debit' ? 'text-red-700' : 'text-gray-500'}`}>
                        {journalAccountImpact === 'none' ? 'No post' : `${journalAccountImpact === 'credit' ? '+' : '-'}${formatCurrency(journalTotalCost)}`}
                      </p>
                    </div>
                    <button type="submit" disabled={journalSaving} className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#F97316] px-4 text-sm font-semibold text-white hover:bg-[#EA580C] disabled:cursor-not-allowed disabled:opacity-60">
                      <FaSave /> {journalSaving ? 'Saving...' : 'Save Entry'}
                    </button>
                  </div>
                </form>

                <div className="xl:col-span-7">
                  <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="rounded-md border border-gray-100 bg-gray-50 p-3">
                      <p className="text-xs text-gray-500">Month profit</p>
                      <p className="mt-1 font-semibold text-[#111827]">{formatCurrency(journalSummary?.month?.profit || 0)}</p>
                    </div>
                    <div className="rounded-md border border-gray-100 bg-gray-50 p-3">
                      <p className="text-xs text-gray-500">Units moved</p>
                      <p className="mt-1 font-semibold text-[#111827]">{Number(journalSummary?.totalQuantity || 0).toLocaleString()}</p>
                    </div>
                    <div className="rounded-md border border-gray-100 bg-gray-50 p-3">
                      <p className="text-xs text-gray-500">Last record</p>
                      <p className="mt-1 font-semibold text-[#111827]">{journalEntries[0]?.purchasedAt ? new Date(journalEntries[0].purchasedAt).toLocaleDateString() : '-'}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {journalEntries.map((entry) => (
                      <div key={entry.id || entry._id} className="rounded-md border border-gray-100 px-3 py-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-[#111827]">{entry.reference || entry.typeLabel}</p>
                            <p className="text-xs text-gray-500">{entry.typeLabel} - {entry.product?.name || entry.partyName || entry.category || 'General'} {entry.partyName ? `- ${entry.partyName}` : ''}</p>
                          </div>
                          <StatusPill tone={entry.entryType === 'offline_sale' ? 'green' : entry.entryType === 'expense' ? 'red' : Number(entry.stockDelta || 0) >= 0 ? 'blue' : 'amber'}>
                            {entry.entryType === 'expense' ? formatCurrency(entry.totalAmount || 0) : `${Number(entry.stockDelta || 0) >= 0 ? '+' : ''}${entry.stockDelta || 0} ${entry.unit || entry.product?.unit || ''}`}
                          </StatusPill>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-gray-500 sm:grid-cols-5">
                          <span>Payment <strong className="text-[#111827]">{entry.paymentMethod || '-'}</strong></span>
                          <span>Amount <strong className="text-[#111827]">{formatCurrency(entry.totalAmount || entry.totalCost || 0)}</strong></span>
                          <span>Stock <strong className="text-[#111827]">{entry.stockBefore} to {entry.stockAfter}</strong></span>
                          <span>Account <strong className={entry.accountImpact === 'credit' ? 'text-green-700' : entry.accountImpact === 'debit' ? 'text-red-700' : 'text-[#111827]'}>
                            {entry.accountImpact === 'none' ? 'No post' : `${entry.accountImpact === 'credit' ? '+' : '-'}${formatCurrency(entry.accountAmount || 0)}`}
                          </strong></span>
                          <span>{entry.purchasedAt ? new Date(entry.purchasedAt).toLocaleDateString() : '-'}</span>
                        </div>
                        {entry.notes && <p className="mt-2 text-xs text-gray-500">{entry.notes}</p>}
                      </div>
                    ))}
                    {!journalEntries.length && (
                      <div className="rounded-md border border-dashed border-gray-200 bg-gray-50 px-3 py-8 text-center">
                        <FaReceipt className="mx-auto mb-2 text-[#F97316]" />
                        <p className="text-sm font-medium text-[#111827]">No journal records yet.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <NotificationPreferencesCard
          className="xl:col-span-12"
          title="Notification Preferences"
          badgeLabel="Seller alerts"
          pushDescription="Show dashboard and browser alerts for urgent seller activity."
          description="Control how seller alerts reach you for orders, payments, stock pressure, and account activity."
        />
      </div>

      <div id="seller-wallet" className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <SellerWalletConsole className="xl:col-span-12" />
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
          <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
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
            {visibleBuyerLogisticsRequests.map(({ request, order, provider }) => (
              <div key={`logistics-${getOrderId(order)}`} className="rounded-md border border-sky-100 bg-sky-50 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="flex items-center gap-2 text-sm font-semibold text-sky-800">
                      <FaTruck />
                      Buyer chose {provider.name || 'a logistics company'}
                    </p>
                    <p className="mt-1 text-xs text-sky-700">
                      {request?.message || `Order #${String(getOrderId(order)).slice(-8)} should start transport with this provider to ${order.deliveryAddress?.town || order.shippingAddress?.city || 'the buyer location'}.`}
                    </p>
                  </div>
                  <Link to="/seller/logistics-requests" className="shrink-0 text-xs font-semibold text-sky-700 hover:text-sky-900">
                    View
                  </Link>
                </div>
              </div>
            ))}
            {!lowStockItems.length && !expiringSoonItems.length && !visibleBuyerLogisticsRequests.length && <p className="text-sm text-gray-500">No active inventory or logistics alerts.</p>}
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
            <div className="overflow-x-auto rounded-md border border-gray-100">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="pb-3">Order</th>
                    <th className="pb-3">Customer</th>
                    <th className="pb-3">Logistics</th>
                    <th className="pb-3">Total</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.slice(0, 8).map((order) => {
                    const provider = getLogisticsPreference(order);
                    return (
                      <tr key={order.id || order._id} className="border-b last:border-0">
                        <td className="py-3 font-mono">#{String(order.id || order._id).slice(-8)}</td>
                        <td className="py-3">{order.buyer?.fullName || 'N/A'}</td>
                        <td className="py-3">
                          <p className="max-w-[160px] truncate text-xs font-semibold text-[#111827]">{provider.name || 'Seller preferred'}</p>
                          <p className="text-[11px] capitalize text-gray-500">{provider.source === 'buyer' ? 'Buyer selected' : 'Default option'}</p>
                        </td>
                        <td className="py-3 font-semibold">{formatCurrency(order.totalAmount)}</td>
                        <td className="py-3"><StatusPill tone={statusTone(order.status)}>{String(order.status || 'pending').replace(/_/g, ' ')}</StatusPill></td>
                        <td className="py-3 text-gray-500">{order.createdAt ? new Date(order.createdAt).toLocaleDateString() : '-'}</td>
                      </tr>
                    );
                  })}
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
        <Panel title="Feedback Queue" className="xl:col-span-12">
          <div className="space-y-3">
            {feedbackQueue.map(({ order, sellerDone, buyerDone }) => (
              <div key={`feedback-${getOrderId(order)}`} className="rounded-md border border-gray-100 p-3">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[#111827]">Order #{String(getOrderId(order)).slice(-8)}</p>
                    <p className="text-xs text-gray-500">{order.buyer?.fullName || order.customer?.fullName || 'Customer'} - {formatCurrency(order.totalAmount || 0)}</p>
                  </div>
                  <Link to="/seller/orders" className="text-xs font-medium text-[#F97316]">Open</Link>
                </div>
                <div className="grid grid-cols-1 gap-2 text-xs min-[420px]:grid-cols-2">
                  <span className={`inline-flex items-center justify-center gap-1 rounded-md px-2 py-2 ${sellerDone ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                    {sellerDone ? <FaCheckCircle /> : <FaComments />}
                    Seller
                  </span>
                  <span className={`inline-flex items-center justify-center gap-1 rounded-md px-2 py-2 ${buyerDone ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                    {buyerDone ? <FaCheckCircle /> : <FaComments />}
                    Buyer
                  </span>
                </div>
              </div>
            ))}
            {!feedbackQueue.length && (
              <p className="rounded-md bg-gray-50 px-3 py-4 text-center text-sm text-gray-500">No delivered orders are waiting for seller or buyer feedback.</p>
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
          <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:grid-cols-3">
            {sellerCsvExportTypes.map((type) => {
              const meta = getSellerExportMeta(type);
              const isPrimaryReport = type === 'orders';
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleSellerExport(type)}
                  className={`rounded-md border px-3 py-3 text-left text-sm transition hover:-translate-y-0.5 hover:shadow-sm ${
                    isPrimaryReport
                      ? 'border-orange-200 bg-orange-50 text-[#7C2D12]'
                      : 'border-gray-200 bg-white text-[#111827] hover:bg-gray-50'
                  }`}
                >
                  <span className="mb-2 flex h-9 w-9 items-center justify-center rounded-md bg-white text-[#F97316] shadow-sm">
                    {isPrimaryReport ? <FaDownload /> : <FaFileExport />}
                  </span>
                  <span className="block font-semibold">{meta.label}</span>
                  <span className="mt-1 block text-xs leading-4 text-gray-500">{meta.detail}</span>
                </button>
              );
            })}
          </div>
        </Panel>
      </div>
    </div>
  );
};

export default SellerDashboard;
