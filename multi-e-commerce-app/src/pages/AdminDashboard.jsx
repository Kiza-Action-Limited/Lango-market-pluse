import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../config/axios';
import {
  FaUsers, FaBox, FaShoppingCart, FaDollarSign, FaBan, 
  FaCheckCircle, FaBrain, FaChartLine, FaBell, FaTag, 
  FaStore, FaTruck, FaEye, FaEdit, FaTrash, FaPlus,
  FaSearch, FaFilter, FaDownload, FaPrint, FaChartBar,
  FaUserTie, FaSeedling, FaWarehouse, FaUserFriends,
  FaCreditCard, FaMapMarker, FaClock, FaPercent,
  FaShieldAlt, FaEnvelope, FaPhone, FaGlobe,
  FaStar, FaStarHalfAlt, FaRegStar, FaShippingFast,
  FaBoxOpen, FaUndo, FaCheckDouble, FaTimesCircle,
  FaSpinner, FaSync, FaUserCheck, FaUserTimes,
  FaClipboardList, FaMoneyBillWave, FaTruckMoving,
  FaChartPie, FaCalendarAlt, FaFileExport, FaBellSlash
} from 'react-icons/fa';
import { formatCurrency, formatDate, formatDateTime } from '../utils/formatters';
import { CustomerReviewsPanel, DonutGauge, KpiCard, Panel, ProgressRow, SalesByLocationPanel, StatusPill, StoreVisitsBySourcePanel } from '../components/dashboard/DashboardWidgets';
import { formatRealtimeStamp, useRealtimeRefresh } from '../hooks/useRealtimeRefresh';
import { buildReviewSummary, buildSalesByLocation, buildStoreVisitSources, isPaidOrder } from '../utils/dashboardMetrics';
import UserDetailsModal from '../components/admin/UserDetailsModal';

const AdminDashboard = ({ section = 'dashboard' }) => {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  
  // State Management
  const [stats, setStats] = useState({
    users: { total: 0, farmers: 0, wholesalers: 0, retailers: 0, consumers: 0, logistics: 0 },
    products: { total: 0, active: 0, outOfStock: 0 },
    orders: { total: 0, pending: 0, processing: 0, shipped: 0, delivered: 0, cancelled: 0 },
    revenue: { total: 0, averageOrderValue: 0 },
    payments: [],
    logistics: { activeDeliveries: 0, completedDeliveries: 0 },
    recentActivity: []
  });
  
  const [users, setUsers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [logistics, setLogistics] = useState([]);
  const [payments, setPayments] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboardRange, setDashboardRange] = useState('30d');
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedRole, setSelectedRole] = useState('all');
  const [selectedUserType, setSelectedUserType] = useState('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [itemsPerPage] = useState(20);
  
  // Modal states
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showLogisticsModal, setShowLogisticsModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [userDetailsLoading, setUserDetailsLoading] = useState(false);
  
  // Selected items
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedUserDetails, setSelectedUserDetails] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedLogistics, setSelectedLogistics] = useState(null);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [itemToDelete, setItemToDelete] = useState(null);
  
  // Form states
  const [newCategory, setNewCategory] = useState({ name: '', description: '' });
  const [broadcastData, setBroadcastData] = useState({
    type: 'email',
    title: '',
    message: '',
    targetRole: 'all',
    targetUserType: 'all'
  });
  const [logisticsUpdate, setLogisticsUpdate] = useState({
    status: '',
    location: '',
    notes: '',
    estimatedDelivery: ''
  });
  const lastFetchRef = useRef({ key: '', at: 0 });

  useEffect(() => {
    const key = JSON.stringify({
      section,
      selectedRole,
      selectedUserType,
      dateRange,
      currentPage,
    });
    const now = Date.now();
    if (lastFetchRef.current.key === key && now - lastFetchRef.current.at < 1200) {
      return;
    }
    lastFetchRef.current = { key, at: now };
    fetchData();
  }, [section, selectedRole, selectedUserType, dateRange, currentPage]);

  const fetchData = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      switch (section) {
        case 'dashboard':
          const analyticsParams = { period: 'month' };
          if (dateRange.start && dateRange.end) {
            analyticsParams.startDate = dateRange.start;
            analyticsParams.endDate = dateRange.end;
          }
          const [statsRes, analyticsRes, dashboardOrdersRes, dashboardProductsRes, dashboardLogisticsRes] = await Promise.all([
            api.get('/v1/admin/stats'),
            api.get('/v1/admin/analytics', { params: analyticsParams }),
            api.get('/v1/admin/orders', {
              params: {
                status: 'all',
                startDate: dateRange.start,
                endDate: dateRange.end,
                page: 1,
                limit: 50,
              },
            }),
            api.get('/v1/admin/products', { params: { page: 1, limit: 50 } }),
            api.get('/v1/admin/logistics', { params: { page: 1, limit: 50 } }),
          ]);
          setStats(statsRes.data.data);
          setAnalytics(analyticsRes.data.data);
          setOrders(dashboardOrdersRes.data.orders || []);
          setProducts(dashboardProductsRes.data.products || []);
          setLogistics(dashboardLogisticsRes.data.logistics || []);
          break;
          
        case 'users':
          const usersRes = await api.get('/v1/admin/users', {
            params: { 
              role: selectedRole, 
              search: searchTerm,
              page: currentPage,
              limit: itemsPerPage
            }
          });
          setUsers(Array.isArray(usersRes.data.users) ? usersRes.data.users.filter(Boolean) : []);
          setTotalPages(usersRes.data.pagination?.pages || 1);
          break;
          
        case 'categories':
          const categoriesRes = await api.get('/v1/categories');
          setCategories(categoriesRes.data.categories);
          break;
          
        case 'orders':
          const ordersRes = await api.get('/v1/admin/orders', {
            params: { 
              status: selectedStatus,
              startDate: dateRange.start,
              endDate: dateRange.end,
              page: currentPage,
              limit: itemsPerPage
            }
          });
          setOrders(ordersRes.data.orders);
          setTotalPages(ordersRes.data.pagination?.pages || 1);
          break;
          
        case 'products':
          const productsRes = await api.get('/v1/admin/products', {
            params: {
              category: selectedCategory,
              page: currentPage,
              limit: itemsPerPage
            }
          });
          setProducts(productsRes.data.products);
          setTotalPages(productsRes.data.pagination?.pages || 1);
          break;
          
        case 'logistics':
          const logisticsRes = await api.get('/v1/admin/logistics', {
            params: { page: currentPage, limit: itemsPerPage }
          });
          setLogistics(logisticsRes.data.logistics);
          setTotalPages(logisticsRes.data.pagination?.pages || 1);
          break;
          
        case 'payments':
          const paymentsRes = await api.get('/v1/admin/payments', {
            params: { 
              method: selectedPaymentMethod,
              page: currentPage,
              limit: itemsPerPage
            }
          });
          setPayments(paymentsRes.data.payments);
          setTotalPages(paymentsRes.data.pagination?.pages || 1);
          break;
      }
    } catch (error) {
      console.error('Error fetching admin data:', error);
      if (error.response?.status === 401) {
        // Handle unauthorized
      }
    } finally {
      if (!silent) setLoading(false);
      if (!silent) setRefreshing(false);
    }
  };

  const refreshData = () => {
    setRefreshing(true);
    fetchData();
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

  // User Management Functions
  const handleBlockUser = async (userId, block) => {
    try {
      await api.put(`/v1/admin/users/${userId}`, { isBlocked: block });
      refreshData();
    } catch (error) {
      console.error('Error updating user status:', error);
      alert('Failed to update user status');
    }
  };

  const handleVerifyUser = async (userId, verify) => {
    try {
      await api.put(`/v1/admin/users/${userId}`, { isVerified: verify });
      refreshData();
    } catch (error) {
      console.error('Error verifying user:', error);
      alert('Failed to verify user');
    }
  };

  const handleChangeUserRole = async (userId, role) => {
    try {
      await api.put(`/v1/admin/users/${userId}`, { role });
      refreshData();
    } catch (error) {
      console.error('Error changing user role:', error);
      alert('Failed to change user role');
    }
  };

  const handleViewUserDetails = async (userRow) => {
    const userId = userRow?._id || userRow?.id || userRow?.userId;
    if (!userId) return;

    setSelectedUser(userRow);
    setSelectedUserDetails(null);
    setShowUserModal(true);
    setUserDetailsLoading(true);

    try {
      const response = await api.get(`/v1/admin/users/${userId}`);
      setSelectedUserDetails(response.data);
    } catch (error) {
      console.error('Error loading user details:', error);
      alert(error.response?.data?.message || 'Failed to load user details');
    } finally {
      setUserDetailsLoading(false);
    }
  };

  // Category Management Functions
  const handleAddCategory = async (e) => {
    e.preventDefault();
    try {
      await api.post('/v1/categories', newCategory);
      setNewCategory({ name: '', description: '' });
      setShowCategoryModal(false);
      refreshData();
    } catch (error) {
      console.error('Error adding category:', error);
      alert(error.response?.data?.message || 'Error adding category');
    }
  };

  const handleDeleteCategory = async (categoryId) => {
    try {
      await api.delete(`/v1/categories/${categoryId}`);
      setShowDeleteConfirm(false);
      refreshData();
    } catch (error) {
      console.error('Error deleting category:', error);
      alert(error.response?.data?.message || 'Error deleting category');
    }
  };

  // Product Management Functions
  const handleToggleProductStatus = async (productId) => {
    try {
      const candidates = [
        () => api.put(`/v1/admin/products/${productId}/toggle`, {}),
        () => api.put(`/admin/products/${productId}/toggle`, {}),
        () => api.put(`/v1/admin/products/${productId}`, {}),
        () => api.put(`/admin/products/${productId}`, {}),
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
      refreshData();
    } catch (error) {
      console.error('Error toggling product:', error);
      alert('Failed to update product status');
    }
  };

  // Order Management Functions
  const handleUpdateOrderStatus = async (orderId, status) => {
    try {
      await api.put(`/v1/admin/orders/${orderId}/status`, { status });
      refreshData();
    } catch (error) {
      console.error('Error updating order status:', error);
      alert('Failed to update order status');
    }
  };

  // Logistics Management Functions
  const handleUpdateLogistics = async (logisticsId) => {
    try {
      await api.put(`/v1/admin/logistics/${logisticsId}/tracking`, logisticsUpdate);
      setShowLogisticsModal(false);
      refreshData();
    } catch (error) {
      console.error('Error updating logistics:', error);
      alert('Failed to update logistics tracking');
    }
  };

  // Broadcast Functions
  const handleBroadcast = async () => {
    try {
      await api.post('/v1/admin/broadcast', broadcastData, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      alert('Broadcast sent successfully!');
      setShowBroadcastModal(false);
      setBroadcastData({ type: 'email', title: '', message: '', targetRole: 'all', targetUserType: 'all' });
    } catch (error) {
      console.error('Error sending broadcast:', error);
      alert('Failed to send broadcast');
    }
  };

  // Export Functions
  const handleExportData = async (type) => {
    try {
      const response = await api.get(`/v1/admin/export/${type}`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${type}_export_${formatDate(new Date())}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Error exporting data:', error);
      alert('Failed to export data');
    }
  };

  const isSectionLoading = loading && !refreshing;
  const { lastUpdated, isRefreshing: isRealtimeRefreshing } = useRealtimeRefresh(
    () => fetchData({ silent: true }),
    {
      enabled: section === 'dashboard',
      intervalMs: 10000,
      deps: [section, selectedRole, selectedUserType, dateRange.start, dateRange.end, currentPage],
    }
  );

  if (section === 'dashboard') {
    const totalUsers = Number(stats.users.total || 0);
    const totalProducts = Number(stats.products.total || 0);
    const activeProducts = Number(stats.products.active || 0);
    const totalOrders = Number(stats.orders.total || 0);
    const deliveredOrders = Number(stats.orders.delivered || 0);
    const inventoryHealth = totalProducts ? Math.round((activeProducts / totalProducts) * 100) : 0;
    const fulfillmentRate = totalOrders ? Math.round((deliveredOrders / totalOrders) * 100) : 0;
    const buyerIds = orders.map((order) => order.customer?._id || order.customer || order.buyer?._id || order.buyer).filter(Boolean).map(String);
    const uniqueBuyerCount = new Set(buyerIds).size;
    const returningCustomerCount = buyerIds.length - uniqueBuyerCount;
    const conversionRate = totalUsers ? Math.round((uniqueBuyerCount / totalUsers) * 1000) / 10 : 0;
    const newCustomerCount = Math.max(0, uniqueBuyerCount - returningCustomerCount);
    const locationCounts = orders.reduce((acc, order) => {
      const location =
        order.deliveryAddress?.city ||
        order.shippingAddress?.city ||
        order.customer?.campus ||
        order.buyer?.campus ||
        order.customer?.location ||
        'Unknown';
      acc[location] = (acc[location] || 0) + 1;
      return acc;
    }, {});
    const topLocations = Object.entries(locationCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    const paidOrders = orders.filter(isPaidOrder);
    const salesByLocationRows = buildSalesByLocation(orders);
    const reviewSummary = buildReviewSummary(products, paidOrders.length);
    const storeVisitSources = buildStoreVisitSources({
      orders,
      usersTotal: totalUsers,
      productsTotal: totalProducts,
    });
    const lowStockCount = products.filter((product) => Number(product.stock ?? product.quantityAvailable ?? 0) > 0 && Number(product.stock ?? product.quantityAvailable ?? 0) <= 10).length;
    const outOfStockProducts = products.filter((product) => Number(product.stock ?? product.quantityAvailable ?? 0) <= 0).length;
    const topStockProducts = [...products]
      .sort((a, b) => Number(b.stock ?? b.quantityAvailable ?? 0) - Number(a.stock ?? a.quantityAvailable ?? 0))
      .slice(0, 5);
    const activeLogistics = logistics.filter((item) => ['in_transit', 'picked_up', 'out_for_delivery'].includes(item.status)).length;
    const completedLogistics = logistics.filter((item) => item.status === 'delivered').length;
    const userMix = [
      { label: 'Farmers', value: stats.users.farmers, color: '#16A34A', route: 'farmer' },
      { label: 'Wholesalers', value: stats.users.wholesalers, color: '#F97316', route: 'wholesaler' },
      { label: 'Retailers', value: stats.users.retailers, color: '#3B82F6', route: 'retailer' },
      { label: 'Consumers', value: stats.users.consumers, color: '#8B5CF6', route: 'consumer' },
      { label: 'Logistics', value: stats.users.logistics, color: '#06B6D4', route: 'logistics' },
    ];
    const trendRows = Array.isArray(analytics?.trends) ? analytics.trends : [];
    const revenueSeries = trendRows.map((item) => Number(item.totalRevenue || 0));
    const orderSeries = trendRows.map((item) => Number(item.orderCount || 0));
    const userSeries = userMix.map((item) => Number(item.value || 0));
    const productSeries = [stats.products.outOfStock || 0, stats.products.active || 0, stats.products.total || 0];
    const deliverySeries = [stats.logistics.activeDeliveries || 0, stats.logistics.completedDeliveries || 0];
    const trendPct = (series) => {
      if (!series.length || Number(series[0]) === 0) return null;
      const first = Number(series[0]) || 0;
      const last = Number(series[series.length - 1]) || 0;
      return ((last - first) / Math.abs(first)) * 100;
    };
    const revenueTrendPct = trendPct(revenueSeries);
    const revenueTrendLabel = typeof revenueTrendPct === 'number' ? `${revenueTrendPct >= 0 ? '+' : ''}${revenueTrendPct.toFixed(1)}%` : undefined;
    const maxRevenue = Math.max(...revenueSeries, 0);
    const revenueBars = revenueSeries.length
      ? revenueSeries.map((value) => (maxRevenue > 0 ? Math.max(6, (value / maxRevenue) * 100) : 6))
      : [0];
    const dashboardStats = [
      { icon: FaDollarSign, label: 'Revenue', value: formatCurrency(stats.revenue.total || 0), color: '#16A34A', trend: revenueTrendLabel, detail: `${formatCurrency(stats.revenue.averageOrderValue || 0)} AOV`, points: revenueSeries },
      { icon: FaShoppingCart, label: 'Orders', value: stats.orders.total, color: '#3B82F6', detail: `${stats.orders.pending} pending`, points: orderSeries },
      { icon: FaUsers, label: 'Users', value: stats.users.total, color: '#F97316', detail: `${stats.users.consumers} consumers`, points: userSeries },
      { icon: FaBox, label: 'Products', value: stats.products.total, color: '#8B5CF6', detail: `${stats.products.outOfStock} out of stock`, points: productSeries },
      { icon: FaTruck, label: 'Deliveries', value: stats.logistics.activeDeliveries, color: '#06B6D4', detail: `${stats.logistics.completedDeliveries} completed`, points: deliverySeries },
    ];
    const orderRows = [
      { label: 'Pending', value: stats.orders.pending, color: '#F59E0B' },
      { label: 'Processing', value: stats.orders.processing, color: '#3B82F6' },
      { label: 'Shipped', value: stats.orders.shipped, color: '#8B5CF6' },
      { label: 'Delivered', value: stats.orders.delivered, color: '#16A34A' },
      { label: 'Cancelled', value: stats.orders.cancelled, color: '#DC2626' },
    ];

    return (
      <div className="min-h-screen bg-[#F7F8FA] px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-[1600px]">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#F97316]">Admin command center</p>
              <h1 className="mt-1 text-2xl font-bold text-[#111827]">Platform Performance</h1>
              <p className="mt-1 text-sm text-gray-500">Overview of marketplace revenue, operations, users, products, and logistics.</p>
            </div>
            <div className="flex flex-wrap gap-3">
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
              <button onClick={refreshData} disabled={refreshing} className="inline-flex h-10 items-center gap-2 rounded-md border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50">
                <FaSync className={refreshing ? 'animate-spin' : ''} /> Refresh
              </button>
              <button onClick={() => handleExportData('orders')} className="inline-flex h-10 items-center gap-2 rounded-md border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50">
                <FaFileExport /> Export
              </button>
              <button onClick={() => setShowBroadcastModal(true)} className="inline-flex h-10 items-center gap-2 rounded-md bg-[#F97316] px-4 text-sm font-medium text-white hover:bg-[#EA580C]">
                <FaEnvelope /> Broadcast
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
            {isSectionLoading
              ? Array.from({ length: 5 }).map((_, idx) => (
                  <div key={`admin-kpi-skeleton-${idx}`} className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="mb-3 h-4 w-24 rounded bg-gray-200 skeleton-shimmer" />
                    <div className="mb-3 h-8 w-20 rounded bg-gray-200 skeleton-shimmer" />
                    <div className="h-12 rounded bg-gray-100 skeleton-shimmer" />
                  </div>
                ))
              : dashboardStats.map((stat) => <KpiCard key={stat.label} {...stat} />)}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard icon={FaPercent} label="Conversion Rate" value={`${conversionRate}%`} detail={`${uniqueBuyerCount} buying customers`} color="#0EA5E9" points={[uniqueBuyerCount, totalOrders]} />
            <KpiCard icon={FaUserCheck} label="New Customers" value={newCustomerCount} detail={`${returningCustomerCount} returning`} color="#16A34A" points={[newCustomerCount, returningCustomerCount]} />
            <KpiCard icon={FaUndo} label="Returning Customers" value={returningCustomerCount} detail={`${uniqueBuyerCount} unique buyers`} color="#8B5CF6" points={[returningCustomerCount, uniqueBuyerCount]} />
            <KpiCard icon={FaBell} label="Urgent Alerts" value={lowStockCount + outOfStockProducts} detail={`${outOfStockProducts} out of stock`} color="#DC2626" points={[lowStockCount, outOfStockProducts]} />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
            <Panel title="Revenue Overview" className="xl:col-span-6">
              <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-3xl font-bold text-[#111827]">{formatCurrency(stats.revenue.total || 0)}</p>
                  <p className="mt-1 text-sm text-gray-500">{totalOrders} total orders across the platform</p>
                </div>
                <StatusPill tone="green">{fulfillmentRate}% fulfillment</StatusPill>
              </div>
              <div className="grid h-64 items-end gap-2 border-b border-l border-gray-100 px-2 pb-2" style={{ gridTemplateColumns: `repeat(${Math.max(revenueBars.length, 1)}, minmax(0, 1fr))` }}>
                {revenueBars.map((height, index) => (
                  <div key={index} className="rounded-t-md bg-[#F97316]/20" style={{ height: `${height}%` }}>
                    <div className="h-full rounded-t-md bg-[#F97316]" style={{ opacity: Math.min(0.9, 0.3 + index * 0.055) }} />
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="Orders Status" className="xl:col-span-3">
              <div className="space-y-4">
                {orderRows.map((row) => (
                  <ProgressRow key={row.label} label={row.label} value={row.value || 0} max={Math.max(totalOrders, 1)} color={row.color} detail={`${row.value || 0}`} />
                ))}
              </div>
            </Panel>

            <Panel title="Inventory Health" className="xl:col-span-3">
              <DonutGauge value={inventoryHealth} label={`${activeProducts} active products`} color="#16A34A" />
              <div className="mt-5 space-y-3">
                <ProgressRow label="Active products" value={activeProducts} max={Math.max(totalProducts, 1)} color="#16A34A" detail={`${activeProducts}`} />
                <ProgressRow label="Out of stock" value={stats.products.outOfStock || 0} max={Math.max(totalProducts, 1)} color="#DC2626" detail={`${stats.products.outOfStock || 0}`} />
              </div>
            </Panel>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
            <SalesByLocationPanel
              className="xl:col-span-4"
              locations={salesByLocationRows}
              action={<button onClick={() => handleExportData('orders')} className="text-xs font-medium text-[#F97316]">Export</button>}
            />
            <StoreVisitsBySourcePanel
              className="xl:col-span-4"
              sources={storeVisitSources.sources}
              totalLabel={storeVisitSources.totalLabel}
            />
            <CustomerReviewsPanel
              className="xl:col-span-4"
              summary={reviewSummary}
              action={<button onClick={() => navigate('/admin/products')} className="text-xs font-medium text-[#F97316]">View all</button>}
            />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
            <Panel title="Customer Insights" className="xl:col-span-4">
              <div className="space-y-4">
                <ProgressRow label="New customers" value={newCustomerCount} max={Math.max(uniqueBuyerCount, 1)} color="#16A34A" detail={`${newCustomerCount}`} />
                <ProgressRow label="Returning customers" value={returningCustomerCount} max={Math.max(uniqueBuyerCount, 1)} color="#8B5CF6" detail={`${returningCustomerCount}`} />
                <div className="pt-2">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Top locations</p>
                  {topLocations.length ? topLocations.map(([location, count]) => (
                    <ProgressRow key={location} label={location} value={count} max={Math.max(...topLocations.map((item) => item[1]), 1)} color="#F97316" detail={`${count}`} />
                  )) : <p className="text-sm text-gray-500">No customer location data yet.</p>}
                </div>
              </div>
            </Panel>

            <Panel title="Inventory Health Detail" className="xl:col-span-4">
              <div className="space-y-4">
                <ProgressRow label="Active products" value={activeProducts} max={Math.max(totalProducts, 1)} color="#16A34A" detail={`${activeProducts}`} />
                <ProgressRow label="Low stock" value={lowStockCount} max={Math.max(products.length, 1)} color="#F59E0B" detail={`${lowStockCount}`} />
                <ProgressRow label="Out of stock" value={outOfStockProducts} max={Math.max(products.length, 1)} color="#DC2626" detail={`${outOfStockProducts}`} />
                <div className="space-y-2 pt-2">
                  {topStockProducts.map((product) => (
                    <div key={product._id || product.id} className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2 text-sm">
                      <span className="truncate text-[#111827]">{product.name}</span>
                      <span className="font-semibold text-gray-700">{product.stock ?? product.quantityAvailable ?? 0}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Panel>

            <Panel title="Marketing Performance" className="xl:col-span-4" action={<button onClick={() => handleExportData('orders')} className="text-xs font-medium text-[#F97316]">Export</button>}>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-md bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Campaign revenue</p>
                  <p className="mt-1 text-xl font-bold text-[#111827]">{formatCurrency(0)}</p>
                </div>
                <div className="rounded-md bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Tracked campaigns</p>
                  <p className="mt-1 text-xl font-bold text-[#111827]">0</p>
                </div>
              </div>
              <p className="mt-4 text-sm text-gray-500">Campaign tracking is ready, but no campaign source data is returned by the backend yet.</p>
            </Panel>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
            <Panel title="Customer And Role Mix" className="xl:col-span-4">
              <div className="space-y-4">
                {userMix.map((role) => (
                  <button key={role.label} type="button" onClick={() => navigate(`/admin/users?role=${encodeURIComponent(role.route)}`)} className="block w-full text-left">
                    <ProgressRow label={role.label} value={role.value || 0} max={Math.max(totalUsers, 1)} color={role.color} detail={`${role.value || 0}`} />
                  </button>
                ))}
              </div>
            </Panel>

            <Panel title="Top Selling Products" className="xl:col-span-4" action={<button onClick={() => navigate('/admin/products')} className="text-xs font-medium text-[#F97316]">View all</button>}>
              <div className="space-y-3">
                {(analytics?.topProducts || []).slice(0, 5).map((product, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[#111827]">{product.product?.name || 'Product'}</p>
                      <p className="text-xs text-gray-500">{product.totalSold || 0} units sold</p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold text-[#16A34A]">{formatCurrency(product.revenue || 0)}</p>
                  </div>
                ))}
                {(!analytics?.topProducts || analytics.topProducts.length === 0) && <p className="text-sm text-gray-500">No product analytics yet.</p>}
              </div>
            </Panel>

            <Panel title="Logistics Performance" className="xl:col-span-4" action={<button onClick={() => navigate('/admin/logistics')} className="text-xs font-medium text-[#F97316]">Review</button>}>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-md bg-blue-50 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-blue-700">Active</p>
                  <p className="mt-2 text-2xl font-bold text-[#111827]">{activeLogistics || stats.logistics.activeDeliveries || 0}</p>
                </div>
                <div className="rounded-md bg-green-50 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-green-700">Completed</p>
                  <p className="mt-2 text-2xl font-bold text-[#111827]">{completedLogistics || stats.logistics.completedDeliveries || 0}</p>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                <ProgressRow label="Delivery completion" value={completedLogistics || stats.logistics.completedDeliveries || 0} max={Math.max(logistics.length || (stats.logistics.activeDeliveries || 0) + (stats.logistics.completedDeliveries || 0), 1)} color="#16A34A" />
                <ProgressRow label="Active delivery load" value={activeLogistics || stats.logistics.activeDeliveries || 0} max={Math.max(totalOrders, 1)} color="#3B82F6" />
              </div>
            </Panel>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
            <Panel title="Sales By User Type" className="xl:col-span-5">
              <div className="space-y-3">
                {(analytics?.salesByUserType || []).slice(0, 5).map((type, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-3 rounded-md bg-gray-50 p-3">
                    <div>
                      <p className="text-sm font-medium capitalize text-[#111827]">{type._id || 'Individual'}</p>
                      <p className="text-xs text-gray-500">{type.orderCount || 0} orders</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-[#16A34A]">{formatCurrency(type.totalSales || 0)}</p>
                      <p className="text-xs text-gray-500">Avg {formatCurrency(type.averageOrderValue || 0)}</p>
                    </div>
                  </div>
                ))}
                {(!analytics?.salesByUserType || analytics.salesByUserType.length === 0) && <p className="text-sm text-gray-500">No sales mix data yet.</p>}
              </div>
            </Panel>

            <Panel title="Recent Activity" className="xl:col-span-7">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-wide text-gray-500">
                      <th className="pb-3">Order</th>
                      <th className="pb-3">Customer</th>
                      <th className="pb-3">Total</th>
                      <th className="pb-3">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(stats.recentActivity || []).slice(0, 6).map((activity, idx) => (
                      <tr key={idx} className="border-b last:border-0">
                        <td className="py-3 font-mono">#{activity.orderNumber}</td>
                        <td className="py-3">{activity.customer?.name || 'Customer'}</td>
                        <td className="py-3 font-semibold">{formatCurrency(activity.total || 0)}</td>
                        <td className="py-3 text-gray-500">{activity.createdAt ? formatDate(activity.createdAt) : '-'}</td>
                      </tr>
                    ))}
                    {(!stats.recentActivity || stats.recentActivity.length === 0) && (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-gray-500">No recent activity yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
            <Panel title="Reports Center" className="xl:col-span-4">
              <div className="grid grid-cols-2 gap-3">
                {['orders', 'products', 'users', 'payments'].map((type) => (
                  <button key={type} type="button" onClick={() => handleExportData(type)} className="rounded-md border border-gray-200 bg-white px-3 py-3 text-left text-sm font-medium capitalize text-[#111827] hover:bg-gray-50">
                    <FaFileExport className="mb-2 text-[#F97316]" />
                    {type}
                  </button>
                ))}
              </div>
            </Panel>
            <Panel title="Live Activity Feed" className="xl:col-span-8">
              <div className="space-y-3">
                {(stats.recentActivity || []).slice(0, 5).map((activity, idx) => (
                  <div key={idx} className="flex items-center justify-between rounded-md border border-gray-100 px-3 py-2 text-sm">
                    <div>
                      <p className="font-medium text-[#111827]">Order #{activity.orderNumber}</p>
                      <p className="text-xs text-gray-500">{activity.customer?.name || 'Customer'} placed an order</p>
                    </div>
                    <span className="text-xs text-gray-500">{activity.createdAt ? formatDate(activity.createdAt) : '-'}</span>
                  </div>
                ))}
                {(!stats.recentActivity || stats.recentActivity.length === 0) && <p className="text-sm text-gray-500">No live activity yet.</p>}
              </div>
            </Panel>
          </div>
        </div>
      </div>
    );
  }

  // ==================== DASHBOARD SECTION ====================
  if (section === 'legacy-dashboard') {
    const dashboardStats = [
      { icon: FaUsers, label: 'Total Users', value: stats.users.total, color: '#F97316', bgColor: 'bg-[#F97316]/10', detail: `${stats.users.farmers} Farmers, ${stats.users.wholesalers} Wholesalers`, roleFilter: 'all' },
      { icon: FaSeedling, label: 'Farmers', value: stats.users.farmers, color: '#16A34A', bgColor: 'bg-[#16A34A]/10', roleFilter: 'farmer' },
      { icon: FaWarehouse, label: 'Wholesalers', value: stats.users.wholesalers, color: '#FB923C', bgColor: 'bg-[#FB923C]/10', roleFilter: 'wholesaler' },
      { icon: FaStore, label: 'Retailers', value: stats.users.retailers, color: '#F97316', bgColor: 'bg-[#F97316]/10', roleFilter: 'retailer' },
      { icon: FaUserFriends, label: 'Consumers', value: stats.users.consumers, color: '#8B5CF6', bgColor: 'bg-[#8B5CF6]/10', roleFilter: 'consumer' },
      { icon: FaBox, label: 'Products', value: stats.products.total, color: '#FB923C', bgColor: 'bg-[#FB923C]/10', detail: `${stats.products.active} Active` },
      { icon: FaShoppingCart, label: 'Orders', value: stats.orders.total, color: '#16A34A', bgColor: 'bg-[#16A34A]/10', detail: `${stats.orders.pending} Pending` },
      { icon: FaDollarSign, label: 'Revenue', value: formatCurrency(stats.revenue.total), color: '#F97316', bgColor: 'bg-[#F97316]/10' },
      { icon: FaTruck, label: 'Active Deliveries', value: stats.logistics.activeDeliveries, color: '#3B82F6', bgColor: 'bg-[#3B82F6]/10' },
      { icon: FaShippingFast, label: 'Completed', value: stats.logistics.completedDeliveries, color: '#10B981', bgColor: 'bg-[#10B981]/10' },
    ];

    return (
      <div className="bg-[#F9FAFB] min-h-screen py-8">
        <div className="container mx-auto px-4">
          {/* Header */}
          <div className="sticky top-16 z-20 mb-8 flex justify-between items-center flex-wrap gap-4 bg-[#F9FAFB]/95 backdrop-blur supports-[backdrop-filter]:bg-[#F9FAFB]/85 py-4 border-b border-gray-200">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <FaBrain className="text-[#FB923C] text-3xl" />
                <h1 className="text-3xl font-bold text-[#F97316]">Admin Dashboard</h1>
              </div>
              <p className="text-[#6B7280]">Lango MarketPulse Trade & Intelligence OS — Complete Platform Overview</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={refreshData}
                disabled={refreshing}
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <FaSync className={refreshing ? 'animate-spin' : ''} /> Refresh
              </button>
              <button
                onClick={() => handleExportData('orders')}
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <FaFileExport /> Export
              </button>
              <button
                onClick={() => setShowBroadcastModal(true)}
                className="px-4 py-2 bg-[#F97316] text-white rounded-lg hover:bg-[#F97316]/90 flex items-center gap-2"
              >
                <FaEnvelope /> Broadcast
              </button>
            </div>
          </div>
          
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
            {isSectionLoading
              ? Array.from({ length: 10 }).map((_, idx) => (
                  <div key={`dash-skeleton-${idx}`} className="bg-white rounded-xl shadow-md p-6">
                    <div className="h-4 w-24 rounded bg-gray-200 skeleton-shimmer mb-3" />
                    <div className="h-8 w-20 rounded bg-gray-200 skeleton-shimmer mb-2" />
                    <div className="h-3 w-28 rounded bg-gray-200 skeleton-shimmer" />
                  </div>
                ))
              : dashboardStats.map((stat, index) => (
              <button
                key={index}
                type="button"
                onClick={() => stat.roleFilter && navigate(`/admin/users?role=${encodeURIComponent(stat.roleFilter)}`)}
                className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow text-left"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[#6B7280] text-sm font-medium">{stat.label}</p>
                    <p className="text-2xl font-bold text-[#111827] mt-1">{stat.value}</p>
                    {stat.detail && (
                      <p className="text-xs text-[#6B7280] mt-1">{stat.detail}</p>
                    )}
                  </div>
                  <div className={`w-12 h-12 ${stat.bgColor} rounded-full flex items-center justify-center`}>
                    <stat.icon className="text-2xl" style={{ color: stat.color }} />
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Analytics Section */}
          {isSectionLoading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <div className="bg-white rounded-xl shadow-md p-6">
                <div className="h-6 w-48 rounded bg-gray-200 skeleton-shimmer mb-4" />
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, idx) => (
                    <div key={`analytics-left-${idx}`} className="h-16 rounded bg-gray-100 skeleton-shimmer" />
                  ))}
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-md p-6">
                <div className="h-6 w-48 rounded bg-gray-200 skeleton-shimmer mb-4" />
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, idx) => (
                    <div key={`analytics-right-${idx}`} className="h-16 rounded bg-gray-100 skeleton-shimmer" />
                  ))}
                </div>
              </div>
            </div>
          ) : analytics && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* Sales by User Type */}
                <div className="bg-white rounded-xl shadow-md p-6">
                  <h3 className="text-lg font-semibold text-[#111827] mb-4 flex items-center gap-2">
                    <FaChartBar className="text-[#F97316]" />
                    Sales by User Type
                  </h3>
                  <div className="space-y-4">
                    {analytics.salesByUserType?.map((type, idx) => (
                      <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium capitalize">{type._id || 'Individual'}</p>
                          <p className="text-sm text-gray-600">{type.orderCount} orders</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-[#16A34A]">{formatCurrency(type.totalSales)}</p>
                          <p className="text-sm text-gray-500">Avg: {formatCurrency(type.averageOrderValue)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Top Products */}
                <div className="bg-white rounded-xl shadow-md p-6">
                  <h3 className="text-lg font-semibold text-[#111827] mb-4 flex items-center gap-2">
                    <FaBox className="text-[#F97316]" />
                    Top Selling Products
                  </h3>
                  <div className="space-y-4">
                    {analytics.topProducts?.slice(0, 5).map((product, idx) => (
                      <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium">{product.product?.name}</p>
                          <p className="text-sm text-gray-600">{product.totalSold} units sold</p>
                        </div>
                        <p className="font-bold text-[#16A34A]">{formatCurrency(product.revenue)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Farmer Performance */}
              <div className="bg-white rounded-xl shadow-md p-6 mb-8">
                <h3 className="text-lg font-semibold text-[#111827] mb-4 flex items-center gap-2">
                  <FaSeedling className="text-[#16A34A]" />
                  Top Performing Farmers
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr className="text-left">
                        <th className="px-4 py-2">Farmer Name</th>
                        <th className="px-4 py-2">Total Sold</th>
                        <th className="px-4 py-2">Revenue</th>
                        <th className="px-4 py-2">Orders</th>
                        <th className="px-4 py-2">Rating</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.farmerPerformance?.slice(0, 5).map((farmer, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="px-4 py-3 font-medium">{farmer.farmer?.businessName || farmer.farmer?.name}</td>
                          <td className="px-4 py-3">{farmer.totalSold} units</td>
                          <td className="px-4 py-3 text-[#16A34A] font-semibold">{formatCurrency(farmer.revenue)}</td>
                          <td className="px-4 py-3">{farmer.orderCount}</td>
                          <td className="px-4 py-3 flex items-center gap-1">
                            <FaStar className="text-yellow-400" />
                            <span>{farmer.farmer?.rating || 4.5}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* Recent Activity */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h3 className="text-lg font-semibold text-[#111827] mb-4 flex items-center gap-2">
              <FaClock className="text-[#F97316]" />
              Recent Activity
            </h3>
            <div className="space-y-3">
              {stats.recentActivity?.map((activity, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 border-b">
                  <div>
                    <p className="font-medium">Order #{activity.orderNumber}</p>
                    <p className="text-sm text-gray-600">Customer: {activity.customer?.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatCurrency(activity.total)}</p>
                    <p className="text-xs text-gray-500">{formatDate(activity.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==================== USERS SECTION ====================
  if (section === 'users') {
    const roleColors = {
      admin: 'bg-purple-100 text-purple-800',
      farmer: 'bg-green-100 text-green-800',
      wholesaler: 'bg-orange-100 text-orange-800',
      retailer: 'bg-blue-100 text-blue-800',
      consumer: 'bg-indigo-100 text-indigo-800',
      logistics: 'bg-cyan-100 text-cyan-800'
    };
    const visibleUsers = users.filter(Boolean);

    return (
      <div className="bg-[#F9FAFB] min-h-screen py-8">
        <div className="container mx-auto px-4">
          {/* Header */}
          <div className="mb-8 flex justify-between items-center flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <FaUsers className="text-[#F97316] text-3xl" />
                <h1 className="text-3xl font-bold text-[#F97316]">User Management</h1>
              </div>
              <p className="text-[#6B7280]">Manage platform users, roles, and permissions</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={refreshData}
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <FaSync /> Refresh
              </button>
              <button
                onClick={() => handleExportData('users')}
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <FaFileExport /> Export
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-xl shadow-md p-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#F97316]"
                />
              </div>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="px-3 py-2 border rounded-lg"
              >
                <option value="all">All Roles</option>
                <option value="farmer">Farmers</option>
                <option value="wholesaler">Wholesalers</option>
                <option value="retailer">Retailers</option>
                <option value="consumer">Consumers</option>
                <option value="logistics">Logistics</option>
                <option value="admin">Admins</option>
              </select>
              <button
                onClick={fetchData}
                className="bg-[#F97316] text-white px-4 py-2 rounded-lg hover:bg-[#F97316]/90"
              >
                Apply Filters
              </button>
            </div>
          </div>
          
          {/* Users Table */}
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#F97316] text-white">
                  <tr className="text-left">
                    <th className="px-6 py-3">User</th>
                    <th className="px-6 py-3">Contact</th>
                    <th className="px-6 py-3">Role</th>
                    <th className="px-6 py-3">Business</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Verification</th>
                    <th className="px-6 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleUsers.map((user, index) => {
                    const userId = user._id || user.id || user.userId || `user-${index}`;
                    const userRole = user?.role || 'consumer';

                    return (
                    <tr key={userId} className={`border-t border-gray-100 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-[#111827]">{user.name || user.fullName || 'Unknown User'}</p>
                          <p className="text-xs text-gray-500">ID: {String(userId).slice(-8)}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm">{user.email || '-'}</p>
                          <p className="text-xs text-gray-500">{user.phone || '-'}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <select
                          value={userRole}
                          onChange={(e) => handleChangeUserRole(userId, e.target.value)}
                          className={`px-2 py-1 rounded-full text-xs font-medium border ${roleColors[userRole] || 'bg-gray-100 text-gray-800'}`}
                        >
                          <option value="farmer">Farmer</option>
                          <option value="wholesaler">Wholesaler</option>
                          <option value="retailer">Retailer</option>
                          <option value="consumer">Consumer</option>
                          <option value="logistics">Logistics</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {user.businessName || user.businessType || '-'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          user.isBlocked ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                        }`}>
                          {user.isBlocked ? 'Blocked' : 'Active'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          user.isVerified ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {user.isVerified ? 'Verified' : 'Pending'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleVerifyUser(userId, !user.isVerified)}
                            className="p-1 text-blue-600 hover:text-blue-800"
                            title={user.isVerified ? 'Unverify' : 'Verify'}
                          >
                            <FaUserCheck />
                          </button>
                          <button
                            onClick={() => handleBlockUser(userId, !user.isBlocked)}
                            className={`p-1 ${user.isBlocked ? 'text-green-600' : 'text-red-600'} hover:opacity-80`}
                            title={user.isBlocked ? 'Unblock' : 'Block'}
                          >
                            {user.isBlocked ? <FaUserCheck /> : <FaUserTimes />}
                          </button>
                          <button
                            onClick={() => {
                              handleViewUserDetails(user);
                            }}
                            className="p-1 text-[#F97316] hover:text-[#FB923C]"
                            title="View Details"
                          >
                            <FaEye />
                          </button>
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center gap-2 p-4 border-t">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border rounded disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="px-3 py-1">Page {currentPage} of {totalPages}</span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 border rounded disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ==================== CATEGORIES SECTION ====================
  if (section === 'categories') {
    return (
      <div className="bg-[#F9FAFB] min-h-screen py-8">
        <div className="container mx-auto px-4">
          <div className="mb-8 flex justify-between items-center">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <FaTag className="text-[#FB923C] text-3xl" />
                <h1 className="text-3xl font-bold text-[#F97316]">Category Management</h1>
              </div>
              <p className="text-[#6B7280]">Organize your marketplace with structured categories</p>
            </div>
            <button
              onClick={() => setShowCategoryModal(true)}
              className="px-4 py-2 bg-[#F97316] text-white rounded-lg hover:bg-[#F97316]/90 flex items-center gap-2"
            >
              <FaPlus /> Add Category
            </button>
          </div>
          
          {/* Categories Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {categories.map((category) => (
              <div key={category.id} className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-xl font-semibold text-[#111827] capitalize">{category.name}</h3>
                    <button
                      onClick={() => {
                        setItemToDelete(category);
                        setShowDeleteConfirm(true);
                      }}
                      className="text-red-500 hover:text-red-700"
                    >
                      <FaTrash />
                    </button>
                  </div>
                  <p className="text-gray-600 mb-4">{category.description || 'No description'}</p>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">
                      <FaBox className="inline mr-1" /> {category.productCount || 0} Products
                    </span>
                    <span className="text-gray-500">
                      Created: {formatDate(category.createdAt)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ==================== ORDERS SECTION ====================
  if (section === 'orders') {
    const statusColors = {
      pending: 'border-yellow-500 text-yellow-600 bg-yellow-50',
      confirmed: 'border-blue-500 text-blue-600 bg-blue-50',
      processing: 'border-purple-500 text-purple-600 bg-purple-50',
      shipped: 'border-indigo-500 text-indigo-600 bg-indigo-50',
      in_transit: 'border-cyan-500 text-cyan-600 bg-cyan-50',
      out_for_delivery: 'border-orange-500 text-orange-600 bg-orange-50',
      delivered: 'border-green-500 text-green-600 bg-green-50',
      cancelled: 'border-red-500 text-red-600 bg-red-50'
    };

    return (
      <div className="bg-[#F9FAFB] min-h-screen py-8">
        <div className="container mx-auto px-4">
          <div className="mb-8 flex justify-between items-center flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <FaShoppingCart className="text-[#16A34A] text-3xl" />
                <h1 className="text-3xl font-bold text-[#F97316]">Order Management</h1>
              </div>
              <p className="text-[#6B7280]">Track and manage all platform orders</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={refreshData}
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <FaSync /> Refresh
              </button>
              <button
                onClick={() => handleExportData('orders')}
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <FaFileExport /> Export
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-xl shadow-md p-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-3 py-2 border rounded-lg"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="processing">Processing</option>
                <option value="shipped">Shipped</option>
                <option value="in_transit">In Transit</option>
                <option value="out_for_delivery">Out for Delivery</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
              </select>
              
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
                className="px-3 py-2 border rounded-lg"
                placeholder="Start Date"
              />
              
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
                className="px-3 py-2 border rounded-lg"
                placeholder="End Date"
              />
              
              <button
                onClick={fetchData}
                className="bg-[#F97316] text-white px-4 py-2 rounded-lg hover:bg-[#F97316]/90"
              >
                Apply Filters
              </button>
            </div>
          </div>
          
          {/* Orders Table */}
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#F97316] text-white">
                  <tr className="text-left">
                    <th className="px-6 py-3">Order ID</th>
                    <th className="px-6 py-3">Customer</th>
                    <th className="px-6 py-3">Type</th>
                    <th className="px-6 py-3">Total</th>
                    <th className="px-6 py-3">Payment</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Date</th>
                    <th className="px-6 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order, index) => (
                    <tr key={order._id} className={`border-t border-gray-100 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                      <td className="px-6 py-4 font-mono text-sm text-[#FB923C]">
                        #{String(order.orderNumber || order._id).slice(-8)}
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-[#111827]">{order.customer?.name || 'Guest'}</p>
                          <p className="text-xs text-gray-500">{order.customer?.email}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          order.customer?.userType === 'farmer' ? 'bg-green-100 text-green-800' :
                          order.customer?.userType === 'wholesaler' ? 'bg-orange-100 text-orange-800' :
                          order.customer?.userType === 'retailer' ? 'bg-blue-100 text-blue-800' :
                          'bg-purple-100 text-purple-800'
                        }`}>
                          {order.customer?.userType || 'consumer'}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-semibold text-[#16A34A]">{formatCurrency(order.total)}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          order.paymentStatus === 'completed' ? 'bg-green-100 text-green-800' :
                          order.paymentStatus === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {order.paymentStatus}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <select
                          value={order.status}
                          onChange={(e) => handleUpdateOrderStatus(order._id, e.target.value)}
                          className={`px-2 py-1 rounded-lg text-sm font-medium border ${statusColors[order.status] || statusColors.pending}`}
                        >
                          <option value="pending">Pending</option>
                          <option value="confirmed">Confirmed</option>
                          <option value="processing">Processing</option>
                          <option value="shipped">Shipped</option>
                          <option value="in_transit">In Transit</option>
                          <option value="out_for_delivery">Out for Delivery</option>
                          <option value="delivered">Delivered</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {formatDate(order.createdAt)}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => {
                            setSelectedOrder(order);
                            setShowOrderModal(true);
                          }}
                          className="text-[#F97316] hover:text-[#FB923C] font-medium flex items-center gap-1"
                        >
                          <FaEye /> Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center gap-2 p-4 border-t">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border rounded disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="px-3 py-1">Page {currentPage} of {totalPages}</span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 border rounded disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ==================== PRODUCTS SECTION ====================
  if (section === 'products') {
    return (
      <div className="bg-[#F9FAFB] min-h-screen py-8">
        <div className="container mx-auto px-4">
          <div className="mb-8 flex justify-between items-center">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <FaBox className="text-[#F97316] text-3xl" />
                <h1 className="text-3xl font-bold text-[#F97316]">Product Management</h1>
              </div>
              <p className="text-[#6B7280]">Oversee all products listed on the platform</p>
            </div>
            <button
              onClick={() => handleExportData('products')}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 flex items-center gap-2"
            >
              <FaFileExport /> Export
            </button>
          </div>
          
          {/* Products Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products.map((product) => (
              <div key={product._id} className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow">
                <img
                  src={product.images?.[0] || 'https://via.placeholder.com/300x200'}
                  alt={product.name}
                  className="w-full h-48 object-cover"
                  onError={(e) => e.target.src = 'https://via.placeholder.com/300x200'}
                />
                <div className="p-4">
                  <h3 className="font-semibold text-lg text-[#111827] mb-2">{product.name}</h3>
                  <p className="text-gray-600 text-sm mb-2 line-clamp-2">{product.description}</p>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-2xl font-bold text-[#16A34A]">{formatCurrency(product.price)}</span>
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      product.stock > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      Stock: {product.stock}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Seller: {product.seller?.businessName || product.seller?.name}</span>
                    <button
                      onClick={() => handleToggleProductStatus(product._id)}
                      className={`px-3 py-1 rounded-lg text-sm font-medium ${
                        product.isActive 
                          ? 'bg-red-500 text-white hover:bg-red-600' 
                          : 'bg-green-500 text-white hover:bg-green-600'
                      }`}
                    >
                      {product.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-8">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 border rounded disabled:opacity-50"
              >
                Previous
              </button>
              <span className="px-3 py-1">Page {currentPage} of {totalPages}</span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 border rounded disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ==================== LOGISTICS SECTION ====================
  if (section === 'logistics') {
    const logisticsStatusColors = {
      pending: 'bg-yellow-100 text-yellow-800',
      picked_up: 'bg-blue-100 text-blue-800',
      in_transit: 'bg-purple-100 text-purple-800',
      out_for_delivery: 'bg-orange-100 text-orange-800',
      delivered: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800'
    };

    return (
      <div className="bg-[#F9FAFB] min-h-screen py-8">
        <div className="container mx-auto px-4">
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <FaTruck className="text-[#3B82F6] text-3xl" />
              <h1 className="text-3xl font-bold text-[#F97316]">Logistics & Delivery Tracking</h1>
            </div>
            <p className="text-[#6B7280]">Track and manage all deliveries in real-time</p>
          </div>
          
          {/* Logistics Table */}
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#F97316] text-white">
                  <tr className="text-left">
                    <th className="px-6 py-3">Tracking #</th>
                    <th className="px-6 py-3">Order ID</th>
                    <th className="px-6 py-3">Carrier</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Current Location</th>
                    <th className="px-6 py-3">Est. Delivery</th>
                    <th className="px-6 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {logistics.map((item, index) => (
                    <tr key={item._id} className={`border-t border-gray-100 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                      <td className="px-6 py-4 font-mono text-sm">{item.trackingNumber}</td>
                      <td className="px-6 py-4 font-mono text-sm text-[#FB923C]">
                        #{String(item.order?.orderNumber || item.order?._id).slice(-8)}
                      </td>
                      <td className="px-6 py-4 capitalize">{item.carrier}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs ${logisticsStatusColors[item.status]}`}>
                          {item.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">{item.currentLocation || 'N/A'}</td>
                      <td className="px-6 py-4 text-sm">{item.estimatedDelivery ? formatDate(item.estimatedDelivery) : 'N/A'}</td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => {
                            setSelectedLogistics(item);
                            setLogisticsUpdate({
                              status: item.status,
                              location: item.currentLocation || '',
                              notes: '',
                              estimatedDelivery: item.estimatedDelivery?.split('T')[0] || ''
                            });
                            setShowLogisticsModal(true);
                          }}
                          className="text-[#F97316] hover:text-[#FB923C] font-medium flex items-center gap-1"
                        >
                          <FaEdit /> Update
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==================== PAYMENTS SECTION ====================
  if (section === 'payments') {
    return (
      <div className="bg-[#F9FAFB] min-h-screen py-8">
        <div className="container mx-auto px-4">
          <div className="mb-8 flex justify-between items-center">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <FaCreditCard className="text-[#16A34A] text-3xl" />
                <h1 className="text-3xl font-bold text-[#F97316]">Payment Transactions</h1>
              </div>
              <p className="text-[#6B7280]">Monitor and track all financial transactions</p>
            </div>
            <button
              onClick={() => handleExportData('payments')}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 flex items-center gap-2"
            >
              <FaFileExport /> Export
            </button>
          </div>

          {/* Payment Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-xl shadow-md p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Total Transactions</p>
                  <p className="text-2xl font-bold text-[#111827]">{payments.length}</p>
                </div>
                <FaMoneyBillWave className="text-3xl text-green-500" />
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-md p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm">Total Volume</p>
                  <p className="text-2xl font-bold text-[#16A34A]">
                    {formatCurrency(payments.reduce((sum, p) => sum + (p.amount || 0), 0))}
                  </p>
                </div>
                <FaDollarSign className="text-3xl text-[#F97316]" />
              </div>
            </div>
          </div>
          
          {/* Payments Table */}
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#F97316] text-white">
                  <tr className="text-left">
                    <th className="px-6 py-3">Transaction ID</th>
                    <th className="px-6 py-3">User</th>
                    <th className="px-6 py-3">Amount</th>
                    <th className="px-6 py-3">Method</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Date</th>
                    <th className="px-6 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment, index) => (
                    <tr key={payment._id} className={`border-t border-gray-100 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                      <td className="px-6 py-4 font-mono text-sm">{payment.transactionId}</td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium">{payment.user?.name}</p>
                          <p className="text-xs text-gray-500">{payment.user?.email}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-semibold text-[#16A34A]">{formatCurrency(payment.amount)}</td>
                      <td className="px-6 py-4 capitalize">{payment.paymentMethod}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          payment.status === 'completed' ? 'bg-green-100 text-green-800' :
                          payment.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {payment.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">{formatDate(payment.createdAt)}</td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => {
                            setSelectedPayment(payment);
                            setShowPaymentModal(true);
                          }}
                          className="text-[#F97316] hover:text-[#FB923C]"
                        >
                          <FaEye />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==================== MODALS ====================

  if (showUserModal && selectedUser) {
    return (
      <UserDetailsModal
        open={showUserModal}
        loading={userDetailsLoading}
        details={selectedUserDetails}
        fallbackUser={selectedUser}
        onClose={() => {
          setShowUserModal(false);
          setSelectedUser(null);
          setSelectedUserDetails(null);
        }}
      />
    );
  }
  
  // Broadcast Modal
  if (showBroadcastModal) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
          <h2 className="text-2xl font-bold mb-4">Broadcast Notification</h2>
          <div className="space-y-4">
            <select
              value={broadcastData.type}
              onChange={(e) => setBroadcastData({...broadcastData, type: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="email">Email</option>
              <option value="sms">SMS</option>
              <option value="push">Push Notification</option>
            </select>
            
            <input
              type="text"
              placeholder="Title"
              value={broadcastData.title}
              onChange={(e) => setBroadcastData({...broadcastData, title: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg"
            />
            
            <textarea
              placeholder="Message"
              rows="4"
              value={broadcastData.message}
              onChange={(e) => setBroadcastData({...broadcastData, message: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg"
            />
            
            <select
              value={broadcastData.targetRole}
              onChange={(e) => setBroadcastData({...broadcastData, targetRole: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="all">All Roles</option>
              <option value="farmer">Farmers Only</option>
              <option value="wholesaler">Wholesalers Only</option>
              <option value="retailer">Retailers Only</option>
              <option value="consumer">Consumers Only</option>
              <option value="logistics">Logistics Only</option>
            </select>
          </div>
          
          <div className="flex gap-3 mt-6">
            <button
              onClick={handleBroadcast}
              className="flex-1 bg-[#F97316] text-white py-2 rounded-lg hover:bg-[#F97316]/90"
            >
              Send Broadcast
            </button>
            <button
              onClick={() => setShowBroadcastModal(false)}
              className="flex-1 border border-gray-300 py-2 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Category Modal
  if (showCategoryModal) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
          <h2 className="text-2xl font-bold mb-4">Add New Category</h2>
          <form onSubmit={handleAddCategory} className="space-y-4">
            <input
              type="text"
              placeholder="Category Name"
              value={newCategory.name}
              onChange={(e) => setNewCategory({...newCategory, name: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg"
              required
            />
            <textarea
              placeholder="Description"
              rows="3"
              value={newCategory.description}
              onChange={(e) => setNewCategory({...newCategory, description: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg"
            />
            <div className="flex gap-3">
              <button type="submit" className="flex-1 bg-[#F97316] text-white py-2 rounded-lg">
                Add Category
              </button>
              <button
                type="button"
                onClick={() => setShowCategoryModal(false)}
                className="flex-1 border border-gray-300 py-2 rounded-lg"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Logistics Modal
  if (showLogisticsModal && selectedLogistics) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
          <h2 className="text-2xl font-bold mb-4">Update Delivery Tracking</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <select
                value={logisticsUpdate.status}
                onChange={(e) => setLogisticsUpdate({...logisticsUpdate, status: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="pending">Pending</option>
                <option value="picked_up">Picked Up</option>
                <option value="in_transit">In Transit</option>
                <option value="out_for_delivery">Out for Delivery</option>
                <option value="delivered">Delivered</option>
                <option value="failed">Failed</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Current Location</label>
              <input
                type="text"
                value={logisticsUpdate.location}
                onChange={(e) => setLogisticsUpdate({...logisticsUpdate, location: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="Enter current location"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Estimated Delivery Date</label>
              <input
                type="date"
                value={logisticsUpdate.estimatedDelivery}
                onChange={(e) => setLogisticsUpdate({...logisticsUpdate, estimatedDelivery: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Notes</label>
              <textarea
                value={logisticsUpdate.notes}
                onChange={(e) => setLogisticsUpdate({...logisticsUpdate, notes: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg"
                rows="2"
                placeholder="Add delivery notes..."
              />
            </div>
            
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => handleUpdateLogistics(selectedLogistics._id)}
                className="flex-1 bg-[#F97316] text-white py-2 rounded-lg"
              >
                Update Tracking
              </button>
              <button
                onClick={() => setShowLogisticsModal(false)}
                className="flex-1 border border-gray-300 py-2 rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Delete Confirmation Modal
  if (showDeleteConfirm && itemToDelete) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
          <h2 className="text-2xl font-bold mb-4">Confirm Delete</h2>
          <p className="text-gray-600 mb-6">
            Are you sure you want to delete "{itemToDelete.name || itemToDelete.category?.name}"? This action cannot be undone.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => handleDeleteCategory(itemToDelete.id)}
              className="flex-1 bg-red-500 text-white py-2 rounded-lg hover:bg-red-600"
            >
              Delete
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="flex-1 border border-gray-300 py-2 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Order Details Modal
  if (showOrderModal && selectedOrder) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
        <div className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-2xl font-bold">Order Details</h2>
            <button onClick={() => setShowOrderModal(false)} className="text-gray-500 hover:text-gray-700">
              <FaTimesCircle />
            </button>
          </div>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Order Number</p>
                <p className="font-mono font-semibold">#{selectedOrder.orderNumber}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Order Date</p>
                <p>{formatDateTime(selectedOrder.createdAt)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Customer</p>
                <p className="font-medium">{selectedOrder.customer?.name}</p>
                <p className="text-sm">{selectedOrder.customer?.email}</p>
                <p className="text-sm">{selectedOrder.customer?.phone}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Payment Method</p>
                <p className="capitalize">{selectedOrder.paymentMethod}</p>
                <p className="text-sm text-gray-600">Status: {selectedOrder.paymentStatus}</p>
              </div>
            </div>
            
            <div>
              <h3 className="font-semibold mb-2">Order Items</h3>
              <div className="space-y-2">
                {selectedOrder.items?.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-gray-600">Quantity: {item.quantity} × {formatCurrency(item.price)}</p>
                    </div>
                    <p className="font-semibold">{formatCurrency(item.price * item.quantity)}</p>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="border-t pt-4">
              <div className="flex justify-between py-1">
                <span>Subtotal:</span>
                <span>{formatCurrency(selectedOrder.subtotal)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span>Tax:</span>
                <span>{formatCurrency(selectedOrder.tax || 0)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span>Shipping:</span>
                <span>{formatCurrency(selectedOrder.shipping)}</span>
              </div>
              <div className="flex justify-between font-bold text-lg mt-2 pt-2 border-t">
                <span>Total:</span>
                <span className="text-[#16A34A]">{formatCurrency(selectedOrder.total)}</span>
              </div>
            </div>
            
            {selectedOrder.trackingNumber && (
              <div className="border-t pt-4">
                <h3 className="font-semibold mb-2">Tracking Information</h3>
                <p className="text-sm">Tracking Number: <span className="font-mono">{selectedOrder.trackingNumber}</span></p>
                <p className="text-sm">Carrier: {selectedOrder.carrier}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default AdminDashboard;
