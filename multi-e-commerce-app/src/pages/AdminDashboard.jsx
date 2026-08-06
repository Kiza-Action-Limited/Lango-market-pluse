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
  FaCreditCard, FaMapMarker, FaClock, FaPercent, FaCrown,
  FaShieldAlt, FaEnvelope, FaPhone, FaGlobe,
  FaStar, FaStarHalfAlt, FaRegStar, FaShippingFast,
  FaBoxOpen, FaUndo, FaCheckDouble, FaTimesCircle,
  FaSpinner, FaSync, FaUserCheck, FaUserTimes,
  FaClipboardList, FaMoneyBillWave, FaTruckMoving,
  FaChartPie, FaCalendarAlt, FaFileExport, FaBellSlash,
  FaFileAlt, FaExternalLinkAlt, FaIdBadge
} from 'react-icons/fa';
import { formatCurrency, formatDate, formatDateTime } from '../utils/formatters';
import { CustomerReviewsPanel, DonutGauge, KpiCard, Panel, ProgressRow, SalesByLocationPanel, StatusPill, StoreVisitsBySourcePanel } from '../components/dashboard/DashboardWidgets';
import NotificationPreferencesCard from '../components/NotificationPreferencesCard';
import { formatRealtimeStamp, useRealtimeRefresh } from '../hooks/useRealtimeRefresh';
import { DASHBOARD_RANGE_OPTIONS, buildDashboardDateRange, buildReviewSummary, buildSalesByLocation, buildStoreVisitSources, isPaidOrder } from '../utils/dashboardMetrics';
import UserDetailsModal from '../components/admin/UserDetailsModal';
import LiveLogisticsMapPanel from '../components/logistics/LiveLogisticsMapPanel';
import SharedGroupTripPanel from '../components/logistics/SharedGroupTripPanel';

const getAdminProductStock = (product) => Number(product?.stock ?? product?.quantityAvailable ?? product?.quantity ?? product?.inventory ?? 0);
const getAdminProductSku = (product) => product?.sku || product?.trackingSku || product?.SKU || product?.stockKeepingUnit || 'SKU pending';
const getAdminProductImage = (product) => product?.images?.[0]?.url || product?.images?.[0] || '';
const getAdminProductThreshold = (product) => Number(product?.minThreshold ?? product?.lowStockThreshold ?? 10);
const getAdminDocumentUrl = (document = {}) => (
  document.url ||
  document.fileUrl ||
  document.secureUrl ||
  document.documentUrl ||
  document.path ||
  ''
);
const getAdminDocumentTitle = (document = {}, fallback = 'User document') => (
  document.title ||
  document.originalName ||
  document.fileName ||
  document.name ||
  fallback
);
const isAdminImageDocument = (document = {}) => {
  const mimeType = String(document.mimeType || document.contentType || '').toLowerCase();
  const url = String(getAdminDocumentUrl(document)).toLowerCase();
  return mimeType.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp|avif)(\?|#|$)/i.test(url);
};
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
    name:
      preference.providerName ||
      providerObject?.businessName ||
      providerObject?.fullName ||
      providerObject?.name ||
      readMetadata(logistics, 'selectedProviderName') ||
      logistics.driverName ||
      '',
    source: preference.selectionSource || readMetadata(logistics, 'selectedBy') || 'default',
    hub: preference.providerHub || profile.baseHub || profile.locationHub || '',
  };
};
const formatAdminLabel = (value) => String(value || 'record')
  .replace(/_/g, ' ')
  .replace(/\b\w/g, (letter) => letter.toUpperCase());
const hasAdminGps = (trip) => (
  Number.isFinite(Number(trip?.liveTracking?.driver?.lat ?? trip?.gpsTracking?.current?.lat)) &&
  Number.isFinite(Number(trip?.liveTracking?.driver?.lng ?? trip?.gpsTracking?.current?.lng))
);
const pickAdminLiveTrip = (items = []) => {
  const activeStatuses = ['driver_assigned', 'en_route_to_pickup', 'picked_up', 'in_transit', 'out_for_delivery'];
  const activeTrips = items.filter((item) => activeStatuses.includes(item?.status));
  return activeTrips.find(hasAdminGps) || activeTrips[0] || items.find(hasAdminGps) || items[0] || null;
};
const formatAdminFileSize = (size) => {
  const bytes = Number(size || 0);
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
const getAdminDocumentUserName = (document) => (
  document?.user?.businessName ||
  document?.user?.fullName ||
  document?.user?.name ||
  document?.user?.email ||
  'User record'
);
const adminCsvExportTypes = [
  'users',
  'products',
  'orders',
  'payments',
  'transactions',
  'logistics',
  'subscriptions',
  'documents',
  'categories',
  'support',
  'rfqs',
  'reviews',
  'agent-referrals',
];
const getAdminInventoryGraph = (product) => {
  const graph = Array.isArray(product?.inventoryGraph)
    ? product.inventoryGraph
    : Array.isArray(product?.inventoryHistory)
      ? product.inventoryHistory
      : [];

  if (graph.length > 0) {
    return graph.map((point) => ({
      onHand: Number(point.onHand ?? point.quantityAvailable ?? point.quantity ?? 0),
      available: Number(point.available ?? point.availableQuantity ?? point.onHand ?? 0),
      reserved: Number(point.reserved ?? point.reservedQuantity ?? 0),
      recordedAt: point.recordedAt || point.createdAt,
    })).slice(-12);
  }

  const stock = getAdminProductStock(product);
  return [{ onHand: stock, available: stock, reserved: Number(product?.reservedQuantity || 0) }];
};

const AdminInventoryQuantityGraph = ({ product, compact = false }) => {
  const points = getAdminInventoryGraph(product);
  const maxValue = Math.max(...points.map((point) => point.onHand), 1);

  return (
    <div className={compact ? '' : 'rounded-md border border-gray-100 bg-gray-50 p-3'}>
      {!compact && (
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Inventory graph</p>
          <p className="text-xs font-medium text-[#111827]">{getAdminProductStock(product)} {product?.unit || 'units'}</p>
        </div>
      )}
      <div className={`${compact ? 'h-10' : 'h-16'} flex items-end gap-1`}>
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

const AdminDashboard = ({ section = 'dashboard' }) => {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  
  // State Management
  const [stats, setStats] = useState({
    users: { total: 0, farmers: 0, wholesalers: 0, retailers: 0, consumers: 0, logistics: 0 },
    products: { total: 0, active: 0, inactive: 0, outOfStock: 0, lowStock: 0 },
    categories: { total: 0, active: 0, inactive: 0 },
    orders: { total: 0, pending: 0, processing: 0, shipped: 0, delivered: 0, cancelled: 0, disputed: 0 },
    revenue: { total: 0, averageOrderValue: 0 },
    payments: [],
    logistics: { total: 0, activeDeliveries: 0, completedDeliveries: 0, needsQr: 0, gpsTracked: 0 },
    finance: {},
    platform: {},
    subscriptions: {},
    support: {},
    documents: { documents: 0, usersWithDocuments: 0 },
    adminOverview: { workQueues: [], health: {}, modules: {} },
    recentActivity: []
  });
  
  const [users, setUsers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [logistics, setLogistics] = useState([]);
  const [payments, setPayments] = useState([]);
  const [userDocuments, setUserDocuments] = useState([]);
  const [documentSummary, setDocumentSummary] = useState({ totalDocuments: 0, usersWithDocuments: 0, fileBackedDocuments: 0, metadataRecords: 0 });
  const [documentFilters, setDocumentFilters] = useState({ search: '', source: 'all', documentType: 'all' });
  const [documentPagination, setDocumentPagination] = useState({ page: 1, limit: 8, total: 0, pages: 1 });
  const [documentLoading, setDocumentLoading] = useState(false);
  const [agentReferrals, setAgentReferrals] = useState([]);
  const [agentReferralSummary, setAgentReferralSummary] = useState({ totalReferrals: 0, uniqueAgents: 0, topAgents: [], byPlan: [] });
  const [agentReferralSearch, setAgentReferralSearch] = useState('');
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboardRange, setDashboardRange] = useState('1m');
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedRole, setSelectedRole] = useState('all');
  const [selectedUserType, setSelectedUserType] = useState('all');
  const [dateRange, setDateRange] = useState(() => buildDashboardDateRange('1m'));
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
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [itemToDelete, setItemToDelete] = useState(null);
  
  // Form states
  const [newCategory, setNewCategory] = useState({ name: '', description: '' });
  const [broadcastData, setBroadcastData] = useState({
    type: 'all',
    title: '',
    message: '',
    targetRole: 'all',
    targetUserType: 'all'
  });
  const [broadcastResult, setBroadcastResult] = useState(null);
  const [logisticsUpdate, setLogisticsUpdate] = useState({
    status: '',
    location: '',
    notes: '',
    estimatedDelivery: ''
  });
  const lastFetchRef = useRef({ key: '', at: 0 });

  const buildDocumentQueryParams = (page = documentPagination.page || 1, filters = documentFilters) => ({
    page,
    limit: documentPagination.limit || 8,
    search: filters.search?.trim() || undefined,
    source: filters.source || 'all',
    documentType: filters.documentType || 'all',
  });

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

  const loadDashboardDocuments = async ({ page = 1, filters = documentFilters, silent = false } = {}) => {
    if (!silent) setDocumentLoading(true);
    try {
      const documentsResponse = await api.get('/v1/admin/documents', {
        params: buildDocumentQueryParams(page, filters),
      });
      setUserDocuments(Array.isArray(documentsResponse.data?.data) ? documentsResponse.data.data : []);
      setDocumentSummary(documentsResponse.data?.summary || { totalDocuments: 0, usersWithDocuments: 0, fileBackedDocuments: 0, metadataRecords: 0 });
      setDocumentPagination(documentsResponse.data?.pagination || { page, limit: documentPagination.limit || 8, total: 0, pages: 1 });
      return documentsResponse;
    } finally {
      if (!silent) setDocumentLoading(false);
    }
  };

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
          const [statsRes, analyticsRes, dashboardOrdersRes, dashboardProductsRes, dashboardLogisticsRes, dashboardDocumentsRes] = await Promise.all([
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
            api.get('/v1/admin/documents', {
              params: buildDocumentQueryParams(),
            }),
          ]);
          setStats(statsRes.data.data);
          setAnalytics(analyticsRes.data.data);
          setOrders(dashboardOrdersRes.data.orders || []);
          setProducts(dashboardProductsRes.data.products || []);
          setLogistics(dashboardLogisticsRes.data.logistics || []);
          setUserDocuments(Array.isArray(dashboardDocumentsRes.data?.data) ? dashboardDocumentsRes.data.data : []);
          setDocumentSummary(dashboardDocumentsRes.data?.summary || { totalDocuments: 0, usersWithDocuments: 0, fileBackedDocuments: 0, metadataRecords: 0 });
          setDocumentPagination(dashboardDocumentsRes.data?.pagination || { page: 1, limit: 8, total: 0, pages: 1 });
          break;

        case 'documents':
          const [documentStatsRes, adminDocumentsRes] = await Promise.all([
            api.get('/v1/admin/stats'),
            api.get('/v1/admin/documents', { params: buildDocumentQueryParams() }),
          ]);
          setStats(documentStatsRes.data.data);
          setUserDocuments(Array.isArray(adminDocumentsRes.data?.data) ? adminDocumentsRes.data.data : []);
          setDocumentSummary(adminDocumentsRes.data?.summary || { totalDocuments: 0, usersWithDocuments: 0, fileBackedDocuments: 0, metadataRecords: 0 });
          setDocumentPagination(adminDocumentsRes.data?.pagination || { page: 1, limit: 8, total: 0, pages: 1 });
          break;

        case 'agent-referrals':
          const agentReferralsRes = await api.get('/v1/admin/agent-referrals', {
            params: {
              search: agentReferralSearch,
              page: currentPage,
              limit: itemsPerPage,
            },
          });
          setAgentReferrals(Array.isArray(agentReferralsRes.data?.data) ? agentReferralsRes.data.data : []);
          setAgentReferralSummary(agentReferralsRes.data?.summary || { totalReferrals: 0, uniqueAgents: 0, topAgents: [], byPlan: [] });
          setTotalPages(agentReferralsRes.data?.pagination?.pages || 1);
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
    setDateRange(buildDashboardDateRange(range));
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
      const [detailsResponse, documentsResponse] = await Promise.all([
        api.get(`/v1/admin/users/${userId}`),
        api.get(`/v1/admin/users/${userId}/documents`),
      ]);
      setSelectedUserDetails({
        ...detailsResponse.data,
        documents: Array.isArray(documentsResponse.data?.data)
          ? documentsResponse.data.data
          : detailsResponse.data?.documents || [],
      });
    } catch (error) {
      console.error('Error loading user details:', error);
      alert(error.response?.data?.message || 'Failed to load user details');
    } finally {
      setUserDetailsLoading(false);
    }
  };

  const uploadUserDocument = async (userId, formData) => {
    try {
      const response = await api.post(`/v1/admin/users/${userId}/documents`, formData);
      const updatedUser = response.data?.user;
      if (updatedUser) {
        setUsers((currentUsers) => currentUsers.map((item) => (
          String(item?._id || item?.id || item?.userId || '') === String(userId)
            ? { ...item, ...updatedUser }
            : item
        )));
        setSelectedUser((currentUser) => (
          String(currentUser?._id || currentUser?.id || currentUser?.userId || '') === String(userId)
            ? { ...currentUser, ...updatedUser }
            : currentUser
        ));
      }
      setSelectedUserDetails((currentDetails) => (
        currentDetails
          ? {
              ...currentDetails,
              user: updatedUser || currentDetails.user,
              documents: response.data?.documents || currentDetails.documents || [],
            }
          : currentDetails
      ));
      await loadDashboardDocuments({ page: 1, silent: true });
      return response.data;
    } catch (error) {
      console.error('Error saving user document:', error);
      alert(error.response?.data?.message || 'Failed to save document');
      throw error;
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
      const response = await api.post('/v1/admin/broadcast', broadcastData, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      setBroadcastResult(response.data?.results || response.data || null);
      alert(response.data?.message || 'Broadcast processed successfully!');
      setBroadcastData({ type: 'all', title: '', message: '', targetRole: 'all', targetUserType: 'all' });
    } catch (error) {
      console.error('Error sending broadcast:', error);
      alert(error.response?.data?.message || 'Failed to send broadcast');
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

  const savedDocuments = Number(documentSummary.totalDocuments || stats.documents?.documents || 0);
  const usersWithDocuments = Number(documentSummary.usersWithDocuments || stats.documents?.usersWithDocuments || 0);
  const fileBackedDocuments = Number(documentSummary.fileBackedDocuments || 0);
  const metadataRecords = Number(documentSummary.metadataRecords || 0);
  const filteredDocuments = Number(documentSummary.filteredDocuments ?? documentPagination.total ?? savedDocuments);
  const filteredUsersWithDocuments = Number(documentSummary.filteredUsersWithDocuments ?? usersWithDocuments);
  const sourceBreakdown = documentSummary.sourceBreakdown || {};
  const documentTypeBreakdown = documentSummary.documentTypeBreakdown || {};
  const recentUserDocuments = Array.isArray(userDocuments) ? userDocuments : [];

  const renderDocumentVaultPanel = () => (
    <Panel
      title="User Documents Vault"
      className="xl:col-span-12"
      action={
        <div className="flex items-center gap-3">
          <button onClick={() => loadDashboardDocuments({ page: documentPagination.page || 1 })} className="text-xs font-medium text-[#F97316]">
            Refresh vault
          </button>
          <button onClick={() => navigate('/admin/users')} className="text-xs font-medium text-[#F97316]">Open users</button>
        </div>
      }
    >
      <form
        className="mb-4 grid gap-3 lg:grid-cols-[1fr_190px_190px_auto]"
        onSubmit={(event) => {
          event.preventDefault();
          loadDashboardDocuments({ page: 1 });
        }}
      >
        <div className="relative">
          <FaSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={documentFilters.search}
            onChange={(event) => setDocumentFilters((current) => ({ ...current, search: event.target.value }))}
            placeholder="Search documents, user, phone, email, document number..."
            className="h-10 w-full rounded-md border border-gray-200 bg-white pl-10 pr-3 text-sm outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20"
          />
        </div>
        <select
          value={documentFilters.source}
          onChange={(event) => setDocumentFilters((current) => ({ ...current, source: event.target.value }))}
          className="h-10 rounded-md border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 outline-none focus:border-[#F97316]"
        >
          <option value="all">All sources</option>
          <option value="admin_saved">Admin saved</option>
          <option value="premium_seller_verification">Premium seller verification</option>
          <option value="kyc">KYC</option>
          <option value="logistics_application">Logistics application</option>
          <option value="logistics_profile">Logistics profile</option>
        </select>
        <select
          value={documentFilters.documentType}
          onChange={(event) => setDocumentFilters((current) => ({ ...current, documentType: event.target.value }))}
          className="h-10 rounded-md border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 outline-none focus:border-[#F97316]"
        >
          <option value="all">All document types</option>
          <option value="national_id">National ID</option>
          <option value="business_permit">Business permit</option>
          <option value="tax_certificate">Tax certificate</option>
          <option value="kyc">KYC</option>
          <option value="contract">Contract</option>
          <option value="receipt">Receipt</option>
          <option value="other">Other</option>
        </select>
        <button
          type="submit"
          disabled={documentLoading}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#111827] px-4 text-sm font-semibold text-white hover:bg-[#374151] disabled:opacity-60"
        >
          <FaFilter />
          {documentLoading ? 'Loading...' : 'Apply'}
        </button>
      </form>

      <div className="mb-4 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 md:grid-cols-4">
        <div className="rounded-md bg-gray-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Saved records</p>
          <p className="mt-1 text-2xl font-bold text-[#111827]">{savedDocuments}</p>
        </div>
        <div className="rounded-md bg-blue-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Users covered</p>
          <p className="mt-1 text-2xl font-bold text-[#111827]">{usersWithDocuments}</p>
        </div>
        <div className="rounded-md bg-green-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-green-700">Files saved</p>
          <p className="mt-1 text-2xl font-bold text-[#111827]">{fileBackedDocuments}</p>
        </div>
        <div className="rounded-md bg-amber-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">DB records</p>
          <p className="mt-1 text-2xl font-bold text-[#111827]">{metadataRecords}</p>
        </div>
      </div>

      <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
        <div className="rounded-md border border-gray-100 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Filtered results</p>
          <p className="mt-1 text-lg font-bold text-[#111827]">{filteredDocuments} documents across {filteredUsersWithDocuments} users</p>
        </div>
        <div className="rounded-md border border-gray-100 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Source breakdown</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {Object.entries(sourceBreakdown).length ? Object.entries(sourceBreakdown).map(([key, value]) => (
              <span key={key} className="rounded-full border border-gray-200 bg-gray-50 px-2 py-1 text-[11px] font-semibold text-gray-600">
                {formatAdminLabel(key)}: {value}
              </span>
            )) : <span className="text-xs text-gray-500">No sources yet</span>}
          </div>
        </div>
        <div className="rounded-md border border-gray-100 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Top type</p>
          <p className="mt-1 text-lg font-bold text-[#111827]">
            {Object.entries(documentTypeBreakdown).sort((a, b) => b[1] - a[1])[0]
              ? `${formatAdminLabel(Object.entries(documentTypeBreakdown).sort((a, b) => b[1] - a[1])[0][0])} (${Object.entries(documentTypeBreakdown).sort((a, b) => b[1] - a[1])[0][1]})`
              : 'No type'}
          </p>
        </div>
      </div>

      {documentLoading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-44 rounded-md bg-gray-100 skeleton-shimmer" />
          ))}
        </div>
      ) : recentUserDocuments.length ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
          {recentUserDocuments.map((document, index) => {
            const userLabel = getAdminDocumentUserName(document);
            const fileUrl = getAdminDocumentUrl(document);
            const hasFile = Boolean(fileUrl);
            const imageDocument = isAdminImageDocument(document);
            const title = getAdminDocumentTitle(document);
            return (
              <article key={document._id || document.publicId || `${document.source}-${document.documentNumber}-${index}`} className="overflow-hidden rounded-md border border-gray-200 bg-white shadow-sm">
                <button
                  type="button"
                  onClick={() => setSelectedDocument(document)}
                  className="block w-full text-left"
                >
                  <div className="relative aspect-[4/3] bg-gray-100">
                    {imageDocument && fileUrl ? (
                      <img
                        src={fileUrl}
                        alt={title}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center gap-2 bg-gray-50 text-gray-400">
                        <FaFileAlt className="text-4xl" />
                        <span className="rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-gray-600">
                          {hasFile ? 'File preview' : 'Record only'}
                        </span>
                      </div>
                    )}
                    <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-1 text-[11px] font-semibold text-white">
                      {formatAdminLabel(document.documentType)}
                    </span>
                    {!imageDocument && (
                      <span className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-1 text-[11px] font-semibold text-gray-700">
                        {document.mimeType ? formatAdminLabel(document.mimeType.split('/').pop()) : 'metadata'}
                      </span>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="truncate text-sm font-semibold text-[#111827]" title={title}>{title}</p>
                    <p className="mt-1 truncate text-xs text-gray-500" title={userLabel}>{userLabel}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-semibold text-gray-600">{formatAdminLabel(document.source)}</span>
                      {!hasFile && <span className="rounded-full border border-blue-100 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">DB record</span>}
                    </div>
                    <p className="mt-2 truncate text-xs text-gray-500">{document.originalName || document.mimeType || document.documentNumber || 'Verification record'} {formatAdminFileSize(document.size)}</p>
                    <p className="mt-1 text-xs text-gray-400">{formatDateTime(document.uploadedAt)}</p>
                  </div>
                </button>
                <div className="flex gap-2 border-t border-gray-100 p-3">
                  <button
                    type="button"
                    onClick={() => handleViewUserDetails(document.user)}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    <FaEye /> User
                  </button>
                  {hasFile && (
                    <a
                      href={fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-[#111827] px-3 py-2 text-xs font-semibold text-white hover:bg-[#374151]"
                    >
                      <FaExternalLinkAlt /> File
                    </a>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-5 text-sm text-gray-500">
          No saved user documents match this view. Open a user record to upload documents, or clear the vault filters.
        </div>
      )}

      <div className="mt-4 flex flex-col gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-gray-500">
          Page <span className="font-semibold text-[#111827]">{documentPagination.page || 1}</span> of <span className="font-semibold text-[#111827]">{documentPagination.pages || 1}</span>
          {' '}({documentPagination.total || 0} filtered)
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={documentLoading || (documentPagination.page || 1) <= 1}
            onClick={() => loadDashboardDocuments({ page: (documentPagination.page || 1) - 1 })}
            className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={documentLoading || (documentPagination.page || 1) >= (documentPagination.pages || 1)}
            onClick={() => loadDashboardDocuments({ page: (documentPagination.page || 1) + 1 })}
            className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </Panel>
  );

  const renderUserDetailsModal = () => (
    showUserModal && selectedUser ? (
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
        onUploadDocument={uploadUserDocument}
      />
    ) : null
  );

  const renderDocumentPreviewModal = () => {
    if (!selectedDocument) return null;

    const fileUrl = getAdminDocumentUrl(selectedDocument);
    const imageDocument = isAdminImageDocument(selectedDocument);
    const title = getAdminDocumentTitle(selectedDocument);
    const userLabel = getAdminDocumentUserName(selectedDocument);

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
        <div className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-xl bg-white shadow-xl">
          <div className="flex items-start justify-between gap-4 border-b border-gray-200 p-4">
            <div className="min-w-0">
              <h2 className="truncate text-xl font-bold text-[#111827]">{title}</h2>
              <p className="mt-1 text-sm text-gray-500">{userLabel} | {formatAdminLabel(selectedDocument.documentType)} | {formatAdminLabel(selectedDocument.source)}</p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedDocument(null)}
              className="rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              aria-label="Close document preview"
            >
              <FaTimesCircle className="text-xl" />
            </button>
          </div>

          <div className="max-h-[calc(92vh-152px)] overflow-auto bg-gray-100 p-4">
            {imageDocument && fileUrl ? (
              <img src={fileUrl} alt={title} className="mx-auto max-h-[72vh] max-w-full rounded-lg bg-white object-contain shadow-sm" />
            ) : (
              <div className="mx-auto flex min-h-96 max-w-2xl flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
                <FaFileAlt className="mb-3 text-5xl text-gray-300" />
                <h3 className="text-lg font-semibold text-[#111827]">No image preview available</h3>
                <p className="mt-2 text-sm text-gray-500">This document is saved as metadata or as a non-image file.</p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 p-4">
            <div className="text-xs text-gray-500">
              <span>{selectedDocument.originalName || selectedDocument.mimeType || 'Document record'}</span>
              <span className="ml-2">{formatAdminFileSize(selectedDocument.size)}</span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleViewUserDetails(selectedDocument.user)}
                className="inline-flex h-10 items-center gap-2 rounded-md border border-gray-200 px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                <FaEye />
                User
              </button>
              {fileUrl && (
                <a
                  href={fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-10 items-center gap-2 rounded-md bg-[#111827] px-4 text-sm font-semibold text-white hover:bg-[#374151]"
                >
                  <FaExternalLinkAlt />
                  Open file
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (section === 'dashboard') {
    const totalUsers = Number(stats.users.total || 0);
    const totalProducts = Number(stats.products.total || 0);
    const activeProducts = Number(stats.products.active || 0);
    const totalOrders = Number(stats.orders.total || 0);
    const deliveredOrders = Number(stats.orders.delivered || 0);
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
    const lowStockCount = products.filter((product) => {
      const threshold = getAdminProductThreshold(product);
      const stock = getAdminProductStock(product);
      return threshold > 0 && stock > 0 && stock <= threshold;
    }).length;
    const outOfStockProducts = products.filter((product) => getAdminProductStock(product) <= 0).length;
    const topStockProducts = [...products]
      .sort((a, b) => getAdminProductStock(b) - getAdminProductStock(a))
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
    const adminOverview = stats.adminOverview || {};
    const overviewHealth = adminOverview.health || {};
    const platformSummary = adminOverview.platformSummary || stats.platform || {};
    const platformUpdates = Array.isArray(adminOverview.platformUpdates) && adminOverview.platformUpdates.length
      ? adminOverview.platformUpdates
      : [
          {
            key: 'marketplace_revenue',
            label: 'Marketplace revenue',
            displayValue: formatCurrency(stats.revenue.total || 0),
            detail: `${totalOrders} orders on Lango Market`,
            tone: 'green',
          },
          {
            key: 'escrow_control',
            label: 'Escrow control',
            displayValue: formatCurrency(Number(stats.finance?.escrow?.totalAmount || 0)),
            detail: `${formatCurrency(Number(stats.finance?.heldEscrow?.amount || 0))} held in escrow`,
            tone: 'amber',
          },
        ];
    const supportOpen = Number(stats.support?.open || 0);
    const escrowReleaseCount = Number(stats.finance?.releaseEscrow?.count || 0);
    const escrowReleaseAmount = Number(stats.finance?.releaseEscrow?.amount || 0);
    const heldEscrowAmount = Number(stats.finance?.heldEscrow?.amount || 0);
    const marketplaceRevenue = Number(platformSummary.marketplaceRevenue ?? stats.revenue.total ?? 0);
    const totalPlatformRevenue = Number(platformSummary.totalPlatformRevenue ?? marketplaceRevenue);
    const subscriptionRevenue = Number(platformSummary.subscriptionRevenue ?? stats.subscriptions?.revenue ?? 0);
    const platformFeeRevenue = Number(platformSummary.platformFeeRevenue ?? stats.finance?.escrow?.platformFees ?? 0);
    const activeSubscriptions = Number(stats.subscriptions?.active || 0);
    const activeFeatures = Number(stats.subscriptions?.activeFeatures || 0);
    const commandQueues = Array.isArray(adminOverview.workQueues) && adminOverview.workQueues.length
      ? adminOverview.workQueues
      : [
          {
            key: 'verification',
            label: 'KYC and phone verification',
            value: Number(stats.users.kycPending || 0) + Number(stats.users.phoneUnverified || 0),
            detail: `${stats.users.kycPending || 0} KYC pending, ${stats.users.phoneUnverified || 0} phone unverified`,
            route: '/admin/users',
            tone: 'amber',
          },
          {
            key: 'support',
            label: 'Admin messages',
            value: supportOpen,
            detail: `${stats.support?.urgent || 0} high priority conversations`,
            route: '/admin/contact-queue',
            tone: 'blue',
          },
          {
            key: 'logistics',
            label: 'Logistics action',
            value: Number(stats.logistics.activeDeliveries || 0) + Number(stats.logistics.needsQr || 0),
            detail: `${stats.logistics.activeDeliveries || 0} active trips, ${stats.logistics.needsQr || 0} QR checks`,
            route: '/admin/logistics',
            tone: 'cyan',
          },
        ];
    const trustOverview = adminOverview.trust || {};
    const trustTotals = trustOverview.totals || {};
    const trustRisks = Array.isArray(trustOverview.risks) ? trustOverview.risks : [];
    const trustRules = Array.isArray(trustOverview.rules) ? trustOverview.rules : [];
    const toneStyles = {
      amber: 'border-amber-200 bg-amber-50 text-amber-800',
      blue: 'border-blue-200 bg-blue-50 text-blue-800',
      cyan: 'border-cyan-200 bg-cyan-50 text-cyan-800',
      green: 'border-green-200 bg-green-50 text-green-800',
      orange: 'border-orange-200 bg-orange-50 text-orange-800',
      red: 'border-red-200 bg-red-50 text-red-800',
    };
    const healthRows = [
      { label: 'Fulfillment', value: Number(overviewHealth.fulfillmentRate ?? fulfillmentRate), color: '#16A34A' },
      { label: 'Active products', value: Number(overviewHealth.activeProductRate ?? (totalProducts ? Math.round((activeProducts / totalProducts) * 100) : 0)), color: '#F97316' },
      { label: 'Verified KYC', value: Number(overviewHealth.kycVerificationRate ?? 0), color: '#3B82F6' },
      { label: 'GPS coverage', value: Number(overviewHealth.gpsCoverageRate ?? 0), color: '#06B6D4' },
    ];
    const moduleActions = [
      { label: 'Users', icon: FaUsers, value: stats.users.total || 0, detail: `${stats.users.kycPending || 0} KYC pending`, route: '/admin/users', color: '#3B82F6' },
      { label: 'Products', icon: FaBox, value: stats.products.total || 0, detail: `${stats.products.inactive || 0} inactive`, route: '/admin/products', color: '#F97316' },
      { label: 'Categories', icon: FaTag, value: stats.categories?.total || 0, detail: `${stats.categories?.inactive || 0} inactive`, route: '/admin/categories', color: '#8B5CF6' },
      { label: 'Subscriptions', icon: FaCreditCard, value: activeSubscriptions, detail: `${activeFeatures} features`, route: '/admin/subscriptions', color: '#16A34A' },
      { label: 'Logistics', icon: FaTruckMoving, value: stats.logistics.total || stats.logistics.activeDeliveries || 0, detail: `${stats.logistics.gpsTracked || 0} GPS tracked`, route: '/admin/logistics', color: '#06B6D4' },
      { label: 'Finance', icon: FaMoneyBillWave, value: formatCurrency(heldEscrowAmount), detail: `${escrowReleaseCount} releases`, route: '/admin/finance-audit', color: '#111827' },
      { label: 'Messages', icon: FaEnvelope, value: supportOpen, detail: `${stats.support?.urgent || 0} urgent`, route: '/admin/contact-queue', color: '#DC2626' },
      { label: 'Documents', icon: FaClipboardList, value: savedDocuments, detail: `${usersWithDocuments} users`, route: '/admin/documents', color: '#6366F1' },
    ];
    const platformUpdateStyles = {
      amber: 'border-amber-200 bg-amber-50 text-amber-800',
      blue: 'border-blue-200 bg-blue-50 text-blue-800',
      green: 'border-green-200 bg-green-50 text-green-800',
      orange: 'border-orange-200 bg-orange-50 text-orange-800',
      red: 'border-red-200 bg-red-50 text-red-800',
    };
    const adminLiveTrip = pickAdminLiveTrip(logistics);

    return (
      <div className="dashboard-shell min-h-screen bg-[#F7F8FA] px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-[1600px]">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#F97316]">Lango Market admin dashboard</p>
              <h1 className="mt-1 truncate text-2xl font-bold text-[#111827]">Lango Market Revenue Overview</h1>
              <p className="mt-1 text-sm text-gray-500">Platform update for revenue, escrow, users, products, logistics, and support operations.</p>
            </div>
            <div className="dashboard-actionbar">
              <div className="inline-flex h-10 items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 text-xs font-medium text-green-700">
                <span className={`h-2 w-2 rounded-full bg-green-500 ${isRealtimeRefreshing ? 'animate-pulse' : ''}`} />
                Live - {formatRealtimeStamp(lastUpdated)}
              </div>
              <label className="relative">
                <FaCalendarAlt className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <select
                  value={dashboardRange}
                  onChange={(event) => applyDashboardRange(event.target.value)}
                  className="h-10 rounded-md border border-gray-200 bg-white pl-9 pr-8 text-xs font-semibold text-gray-700 outline-none hover:bg-gray-50 focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20"
                >
                  {DASHBOARD_RANGE_OPTIONS.map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <button onClick={refreshData} disabled={refreshing} className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50">
                <FaSync className={refreshing ? 'animate-spin' : ''} /> Refresh
              </button>
              <button onClick={() => handleExportData('orders')} className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50">
                <FaFileExport /> Export
              </button>
              <button onClick={() => setShowBroadcastModal(true)} className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#F97316] px-4 text-sm font-medium text-white hover:bg-[#EA580C]">
                <FaEnvelope /> Broadcast
              </button>
            </div>
          </div>

          <div className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
            <section className="rounded-md border border-gray-200 bg-[#111827] p-5 text-white shadow-sm xl:col-span-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#FDBA74]">Platform revenue</p>
                  <h2 className="mt-2 text-3xl font-bold">{formatCurrency(totalPlatformRevenue)}</h2>
                  <p className="mt-2 text-sm text-gray-300">
                    {formatCurrency(marketplaceRevenue)} marketplace revenue with {formatCurrency(subscriptionRevenue)} subscriptions and {formatCurrency(platformFeeRevenue)} platform fees.
                  </p>
                </div>
                <StatusPill tone="green">Live platform update</StatusPill>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-3">
                <div className="rounded-md bg-white/10 p-3">
                  <p className="text-xs text-gray-300">Orders</p>
                  <p className="mt-1 text-xl font-bold">{platformSummary.totalOrders ?? totalOrders}</p>
                </div>
                <div className="rounded-md bg-white/10 p-3">
                  <p className="text-xs text-gray-300">Users</p>
                  <p className="mt-1 text-xl font-bold">{platformSummary.totalUsers ?? totalUsers}</p>
                </div>
                <div className="rounded-md bg-white/10 p-3">
                  <p className="text-xs text-gray-300">Products</p>
                  <p className="mt-1 text-xl font-bold">{platformSummary.totalProducts ?? totalProducts}</p>
                </div>
              </div>
            </section>

            <Panel
              title="Platform Update"
              className="xl:col-span-7"
              action={<button onClick={() => navigate('/admin/analytics')} className="text-xs font-medium text-[#F97316]">Open analytics</button>}
            >
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {platformUpdates.slice(0, 4).map((update) => (
                  <div key={update.key || update.label} className={`rounded-md border px-4 py-3 ${platformUpdateStyles[update.tone] || platformUpdateStyles.blue}`}>
                    <p className="text-xs font-semibold uppercase tracking-wide opacity-75">{update.label}</p>
                    <p className="mt-1 text-xl font-bold">{update.displayValue ?? update.value}</p>
                    <p className="mt-1 text-xs opacity-80">{update.detail}</p>
                  </div>
                ))}
              </div>
            </Panel>
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

          <LiveLogisticsMapPanel
            trip={adminLiveTrip}
            title="Live Logistics Movement"
            subtitle="Monitor the latest active delivery with Google GPS, driver position, pickup, and buyer destination."
            eyebrow="Admin Google GPS command"
            onRefresh={refreshData}
            refreshing={refreshing || isRealtimeRefreshing}
            trackingHref="/admin/logistics"
            emptyText="No active logistics GPS is available yet. It appears when a driver starts live sharing."
            className="mt-4"
          />

          <SharedGroupTripPanel
            title="Admin Shared Logistics Control"
            description="Create, monitor, and fill shared trips across Kenya so nearby buyers and sellers can consolidate cargo into one logistics route."
            canCreate
            canManageRoutes
            canManagePayments
            className="mt-4"
          />

          <Panel
            title="Trust And Proof Control"
            className="mt-4"
            action={<button onClick={() => navigate('/admin/logistics')} className="text-xs font-medium text-[#F97316]">Open logistics</button>}
          >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-md border border-red-100 bg-red-50 p-3">
                <p className="text-xs font-semibold uppercase text-red-700">Blocking payout release</p>
                <p className="mt-1 text-2xl font-bold text-[#111827]">{trustTotals.blocking || 0}</p>
              </div>
              <div className="rounded-md border border-amber-100 bg-amber-50 p-3">
                <p className="text-xs font-semibold uppercase text-amber-700">Proof risks</p>
                <p className="mt-1 text-2xl font-bold text-[#111827]">{trustTotals.total || 0}</p>
              </div>
              <div className="rounded-md border border-green-100 bg-green-50 p-3">
                <p className="text-xs font-semibold uppercase text-green-700">Trust rule</p>
                <p className="mt-1 text-sm font-semibold text-[#111827]">QR + GPS before release</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-3">
                {trustRisks.length === 0 ? (
                  <div className="rounded-md border border-green-100 bg-green-50 p-4 text-sm font-medium text-green-800">
                    No active trust risks. Current logistics proof is clean.
                  </div>
                ) : trustRisks.slice(0, 4).map((risk) => (
                  <button
                    key={risk.logisticsId || risk.orderId}
                    type="button"
                    onClick={() => navigate('/admin/logistics')}
                    className="w-full rounded-md border border-gray-200 bg-white p-4 text-left transition hover:border-[#F97316] hover:shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[#111827]">{risk.orderNumber || risk.logisticsId}</p>
                        <p className="mt-1 text-xs text-gray-500">{risk.seller} to {risk.buyer} - {formatAdminLabel(risk.status)}</p>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${risk.blockingRiskCount ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                        {risk.blockingRiskCount ? 'Blocking' : 'Review'}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(risk.failedChecks || []).slice(0, 3).map((check) => (
                        <span key={check.key} className={`rounded-full px-2 py-1 text-xs font-medium ${check.blocking ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
                          {check.label}
                        </span>
                      ))}
                    </div>
                    {risk.lastGpsUpdate && (
                      <p className="mt-3 text-xs text-gray-500">Last GPS: {formatDateTime(risk.lastGpsUpdate)}</p>
                    )}
                  </button>
                ))}
              </div>
              <div className="rounded-md border border-gray-100 bg-gray-50 p-4">
                <div className="flex items-center gap-2">
                  <FaShieldAlt className="text-[#16A34A]" />
                  <p className="text-sm font-semibold text-[#111827]">Admin safety rules</p>
                </div>
                <div className="mt-3 space-y-2">
                  {trustRules.slice(0, 5).map((rule) => (
                    <div key={rule} className="flex gap-2 text-sm text-gray-600">
                      <FaCheckCircle className="mt-0.5 shrink-0 text-[#16A34A]" />
                      <span>{rule}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Panel>

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
            <Panel
              title="Admin Work Queues"
              className="xl:col-span-5"
              action={<button onClick={() => navigate('/admin/contact-queue')} className="text-xs font-medium text-[#F97316]">Open inbox</button>}
            >
              <div className="space-y-3">
                {commandQueues.slice(0, 5).map((queue) => (
                  <button
                    key={queue.key || queue.label}
                    type="button"
                    onClick={() => queue.route && navigate(queue.route)}
                    className={`w-full rounded-md border px-4 py-3 text-left transition hover:shadow-sm ${toneStyles[queue.tone] || toneStyles.blue}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{queue.label}</p>
                        <p className="mt-1 truncate text-xs opacity-80">{queue.detail}</p>
                      </div>
                      <span className="shrink-0 text-2xl font-bold">{queue.value || 0}</span>
                    </div>
                  </button>
                ))}
              </div>
            </Panel>

            <Panel title="Platform Health" className="xl:col-span-3">
              <div className="space-y-4">
                {healthRows.map((row) => (
                  <ProgressRow
                    key={row.label}
                    label={row.label}
                    value={Math.max(0, Math.min(100, row.value || 0))}
                    max={100}
                    color={row.color}
                    detail={`${Math.max(0, Math.min(100, row.value || 0))}%`}
                  />
                ))}
                <div className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2 text-sm text-gray-600">
                  <span className="font-semibold text-[#111827]">{savedDocuments}</span> saved user documents across <span className="font-semibold text-[#111827]">{usersWithDocuments}</span> users.
                </div>
              </div>
            </Panel>

            <Panel
              title="Escrow And Finance"
              className="xl:col-span-4"
              action={<button onClick={() => navigate('/admin/finance-audit')} className="text-xs font-medium text-[#F97316]">Audit</button>}
            >
              <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
                <div className="rounded-md bg-green-50 p-3">
                  <p className="text-xs font-semibold uppercase text-green-700">Held escrow</p>
                  <p className="mt-1 text-xl font-bold text-[#111827]">{formatCurrency(heldEscrowAmount)}</p>
                </div>
                <div className="rounded-md bg-amber-50 p-3">
                  <p className="text-xs font-semibold uppercase text-amber-700">Release queue</p>
                  <p className="mt-1 text-xl font-bold text-[#111827]">{escrowReleaseCount}</p>
                </div>
              </div>
              <div className="mt-4 rounded-md border border-gray-100 bg-gray-50 px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-gray-600">Ready for escrow review</span>
                  <span className="text-sm font-semibold text-[#111827]">{formatCurrency(escrowReleaseAmount)}</span>
                </div>
              </div>
            </Panel>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 md:grid-cols-4 xl:grid-cols-8">
            {moduleActions.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => navigate(item.route)}
                  className="rounded-md border border-gray-200 bg-white p-3 text-left shadow-sm transition hover:border-[#F97316] hover:shadow-md"
                >
                  <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md" style={{ backgroundColor: `${item.color}1A`, color: item.color }}>
                    <Icon />
                  </div>
                  <p className="truncate text-xs font-semibold uppercase tracking-wide text-gray-500">{item.label}</p>
                  <p className="mt-1 truncate text-lg font-bold text-[#111827]">{item.value}</p>
                  <p className="mt-1 truncate text-xs text-gray-500">{item.detail}</p>
                </button>
              );
            })}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
            {renderDocumentVaultPanel()}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard icon={FaPercent} label="Conversion Rate" value={`${conversionRate}%`} detail={`${uniqueBuyerCount} buying customers`} color="#0EA5E9" points={[uniqueBuyerCount, totalOrders]} />
            <KpiCard icon={FaUserCheck} label="New Customers" value={newCustomerCount} detail={`${returningCustomerCount} returning`} color="#16A34A" points={[newCustomerCount, returningCustomerCount]} />
            <KpiCard icon={FaUndo} label="Returning Customers" value={returningCustomerCount} detail={`${uniqueBuyerCount} unique buyers`} color="#8B5CF6" points={[returningCustomerCount, uniqueBuyerCount]} />
            <KpiCard icon={FaBell} label="Urgent Alerts" value={lowStockCount + outOfStockProducts} detail={`${outOfStockProducts} out of stock`} color="#DC2626" points={[lowStockCount, outOfStockProducts]} />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
            <NotificationPreferencesCard
              className="xl:col-span-12"
              title="Notification Preferences"
              badgeLabel="Admin alerts"
              description="Keep notification controls in the admin dashboard so platform operators can receive order, account, payment, and support activity without leaving the workspace."
              pushDescription="Show in-app and browser alerts for urgent platform activity."
              smsDescription="Send text alerts for time-sensitive admin, payment, logistics, and support events."
              emailDescription="Receive email records for account, support, payment, and operational updates."
              orderDescription="Notify admins about shipping, payment, delivery, dispute, QR handoff, and escrow lifecycle changes."
              scarcityDescription="Notify admins when marketplace inventory is low, out of stock, or under regional scarcity pressure."
              criticalAlertsLabel="Orders and marketplace stock"
            />
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
              <div className="mb-4 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
                <div className="rounded-md bg-green-50 p-3">
                  <p className="text-xs font-semibold uppercase text-green-700">Active</p>
                  <p className="mt-1 text-2xl font-bold text-[#111827]">{activeProducts}</p>
                </div>
                <div className="rounded-md bg-red-50 p-3">
                  <p className="text-xs font-semibold uppercase text-red-700">Out</p>
                  <p className="mt-1 text-2xl font-bold text-[#111827]">{outOfStockProducts}</p>
                </div>
              </div>
              <div className="space-y-3">
                {topStockProducts.slice(0, 3).map((product) => (
                  <div key={product._id || product.id || getAdminProductSku(product)} className="rounded-md border border-gray-100 bg-gray-50 p-2">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <div className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded bg-white">
                          {getAdminProductImage(product) ? (
                            <img src={getAdminProductImage(product)} alt={product.name} className="h-full w-full object-cover" />
                          ) : (
                            <FaBox className="text-gray-400" size={13} />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-[#111827]" title={product.name}>{product.name}</p>
                          <p className="truncate font-mono text-[11px] text-[#F97316]" title={getAdminProductSku(product)}>{getAdminProductSku(product)}</p>
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-gray-700">{getAdminProductStock(product)}</span>
                    </div>
                    <AdminInventoryQuantityGraph product={product} compact />
                  </div>
                ))}
                {!topStockProducts.length && <p className="text-sm text-gray-500">No product inventory data yet.</p>}
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
                <div className="grid grid-cols-1 gap-2 pt-2 min-[420px]:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                  {topStockProducts.map((product) => (
                    <div key={product._id || product.id || getAdminProductSku(product)} className="rounded-md bg-gray-50 p-2 text-sm">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <div className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded bg-white">
                            {getAdminProductImage(product) ? (
                              <img src={getAdminProductImage(product)} alt={product.name} className="h-full w-full object-cover" />
                            ) : (
                              <FaBox className="text-gray-400" size={13} />
                            )}
                          </div>
                          <div className="min-w-0">
                            <span className="block truncate text-xs font-semibold text-[#111827]" title={product.name}>{product.name}</span>
                            <span className="block truncate font-mono text-[11px] text-[#F97316]" title={getAdminProductSku(product)}>{getAdminProductSku(product)}</span>
                          </div>
                        </div>
                        <span className="shrink-0 text-xs font-semibold text-gray-700">{getAdminProductStock(product)}</span>
                      </div>
                      <AdminInventoryQuantityGraph product={product} compact />
                    </div>
                  ))}
                </div>
              </div>
            </Panel>

            <Panel title="Marketing Performance" className="xl:col-span-4" action={<button onClick={() => handleExportData('orders')} className="text-xs font-medium text-[#F97316]">Export</button>}>
              <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
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
              <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                {(analytics?.topProducts || []).slice(0, 5).map((product, idx) => (
                  <div key={idx} className="flex min-w-0 items-center justify-between gap-2 rounded-md border border-gray-100 bg-gray-50 p-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-[#111827]" title={product.product?.name || 'Product'}>{product.product?.name || 'Product'}</p>
                      <p className="text-[11px] text-gray-500">{product.totalSold || 0} sold</p>
                    </div>
                    <p className="shrink-0 text-xs font-bold text-[#16A34A]">{formatCurrency(product.revenue || 0)}</p>
                  </div>
                ))}
                {(!analytics?.topProducts || analytics.topProducts.length === 0) && <p className="text-sm text-gray-500">No product analytics yet.</p>}
              </div>
            </Panel>

            <Panel title="Logistics Performance" className="xl:col-span-4" action={<button onClick={() => navigate('/admin/logistics')} className="text-xs font-medium text-[#F97316]">Review</button>}>
              <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
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
              <div className="overflow-x-auto rounded-md border border-gray-100">
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
              <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:grid-cols-3">
                {adminCsvExportTypes.map((type) => (
                  <button key={type} type="button" onClick={() => handleExportData(type)} className="rounded-md border border-gray-200 bg-white px-3 py-3 text-left text-sm font-medium capitalize text-[#111827] hover:bg-gray-50">
                    <FaFileExport className="mb-2 text-[#F97316]" />
                    {formatAdminLabel(type)}
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
        {renderUserDetailsModal()}
        {renderDocumentPreviewModal()}
      </div>
    );
  }

  // ==================== DOCUMENTS SECTION ====================
  if (section === 'documents') {
    return (
      <div className="dashboard-shell min-h-screen bg-[#F7F8FA] px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-[1600px]">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#F97316]">Admin document vault</p>
              <h1 className="mt-1 truncate text-2xl font-bold text-[#111827]">All User Documents</h1>
              <p className="mt-1 text-sm text-gray-500">Review every saved admin, verification, KYC, and logistics document across the marketplace.</p>
            </div>
            <button
              type="button"
              onClick={() => loadDashboardDocuments({ page: documentPagination.page || 1 })}
              disabled={documentLoading}
              className="inline-flex h-10 items-center gap-2 rounded-md border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            >
              <FaSync className={documentLoading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            {renderDocumentVaultPanel()}
          </div>
        </div>
        {renderUserDetailsModal()}
        {renderDocumentPreviewModal()}
      </div>
    );
  }

  // ==================== AGENT REFERRALS SECTION ====================
  if (section === 'agent-referrals') {
    return (
      <div className="dashboard-shell min-h-screen bg-[#F7F8FA] px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-[1600px]">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#F97316]">Admin agent tracking</p>
              <h1 className="mt-1 truncate text-2xl font-bold text-[#111827]">Agent Referrals</h1>
              <p className="mt-1 text-sm text-gray-500">Seller subscription referrals captured by agent National ID.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleExportData('agent-referrals')}
                className="inline-flex h-10 items-center gap-2 rounded-md border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                <FaDownload />
                Export CSV
              </button>
              <button
                type="button"
                onClick={refreshData}
                disabled={refreshing}
                className="inline-flex h-10 items-center gap-2 rounded-md border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                <FaSync className={refreshing ? 'animate-spin' : ''} />
                Refresh
              </button>
            </div>
          </div>

          <div className="mb-5 grid gap-4 md:grid-cols-3">
            <KpiCard icon={FaIdBadge} label="Tracked referrals" value={agentReferralSummary.totalReferrals || 0} detail="subscription activations" color="#F97316" />
            <KpiCard icon={FaUserTie} label="Unique agents" value={agentReferralSummary.uniqueAgents || 0} detail="by National ID" color="#2563EB" />
            <KpiCard
              icon={FaCrown}
              label="Top agent"
              value={agentReferralSummary.topAgents?.[0]?.agentNationalId || '-'}
              detail={`${agentReferralSummary.topAgents?.[0]?.referrals || 0} referrals`}
              color="#16A34A"
            />
          </div>

          <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={agentReferralSearch}
                  onChange={(event) => setAgentReferralSearch(event.target.value)}
                  placeholder="Search agent ID, seller, phone, email, or payment reference..."
                  className="h-11 w-full rounded-lg border border-gray-300 pl-10 pr-3 text-sm outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20"
                />
              </div>
              <button
                type="button"
                onClick={refreshData}
                className="h-11 rounded-lg bg-[#111827] px-4 text-sm font-semibold text-white hover:bg-black"
              >
                Search
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Agent National ID</th>
                    <th className="px-4 py-3">Seller</th>
                    <th className="px-4 py-3">Plan</th>
                    <th className="px-4 py-3">Source</th>
                    <th className="px-4 py-3">Payment Ref</th>
                    <th className="px-4 py-3">Referred</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {agentReferrals.map((referral) => {
                    const seller = referral.seller || referral.sellerSnapshot || {};
                    const sellerName = seller.businessName || seller.fullName || seller.name || referral.sellerSnapshot?.businessName || referral.sellerSnapshot?.name || 'Seller';
                    return (
                      <tr key={referral._id || referral.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-semibold text-[#111827]">{referral.agentNationalId}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-[#111827]">{sellerName}</p>
                          <p className="text-xs text-gray-500">{seller.email || referral.sellerSnapshot?.email || seller.phone || referral.sellerSnapshot?.phone || '-'}</p>
                        </td>
                        <td className="px-4 py-3 uppercase">{referral.planId}</td>
                        <td className="px-4 py-3">{formatAdminLabel(referral.source)}</td>
                        <td className="px-4 py-3">{referral.paymentReference || '-'}</td>
                        <td className="px-4 py-3">{formatDateTime(referral.referredAt || referral.createdAt)}</td>
                      </tr>
                    );
                  })}
                  {!agentReferrals.length && (
                    <tr>
                      <td colSpan="6" className="px-4 py-8 text-center text-gray-500">
                        No agent referral records found yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
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
      <div className="dashboard-shell min-h-screen bg-[#F9FAFB] py-8">
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
            <div className="dashboard-actionbar">
              <button
                onClick={refreshData}
                disabled={refreshing}
                className="flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50"
              >
                <FaSync className={refreshing ? 'animate-spin' : ''} /> Refresh
              </button>
              <button
                onClick={() => handleExportData('orders')}
                className="flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50"
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
                <div className="overflow-x-auto rounded-md border border-gray-100">
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
      <div className="dashboard-shell min-h-screen bg-[#F9FAFB] py-8">
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
            <div className="dashboard-actionbar">
              <button
                onClick={refreshData}
                className="flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50"
              >
                <FaSync /> Refresh
              </button>
              <button
                onClick={() => handleExportData('users')}
                className="flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50"
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
            <div className="overflow-x-auto rounded-md border border-gray-100">
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
      <div className="dashboard-shell min-h-screen bg-[#F9FAFB] py-8">
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
      <div className="dashboard-shell min-h-screen bg-[#F9FAFB] py-8">
        <div className="container mx-auto px-4">
          <div className="mb-8 flex justify-between items-center flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <FaShoppingCart className="text-[#16A34A] text-3xl" />
                <h1 className="text-3xl font-bold text-[#F97316]">Order Management</h1>
              </div>
              <p className="text-[#6B7280]">Track and manage all platform orders</p>
            </div>
            <div className="dashboard-actionbar">
              <button
                onClick={refreshData}
                className="flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50"
              >
                <FaSync /> Refresh
              </button>
              <button
                onClick={() => handleExportData('orders')}
                className="flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50"
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
            <div className="overflow-x-auto rounded-md border border-gray-100">
              <table className="w-full">
                <thead className="bg-[#F97316] text-white">
                  <tr className="text-left">
                    <th className="px-6 py-3">Order ID</th>
                    <th className="px-6 py-3">Customer</th>
                    <th className="px-6 py-3">Type</th>
                    <th className="px-6 py-3">Logistics</th>
                    <th className="px-6 py-3">Total</th>
                    <th className="px-6 py-3">Payment</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Date</th>
                    <th className="px-6 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order, index) => {
                    const provider = getLogisticsPreference(order);
                    return (
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
                        <td className="px-6 py-4">
                          <p className="max-w-[170px] truncate text-sm font-semibold text-[#111827]">{provider.name || 'Seller preferred'}</p>
                          <p className="text-xs text-sky-700">{provider.source === 'buyer' ? 'Buyer selected' : 'Default option'}</p>
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

  // ==================== PRODUCTS SECTION ====================
  if (section === 'products') {
    return (
      <div className="dashboard-shell min-h-screen bg-[#F9FAFB] py-8">
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
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {products.map((product) => {
              const stock = getAdminProductStock(product);
              const sku = getAdminProductSku(product);
              const image = getAdminProductImage(product);
              return (
              <div key={product._id || product.id || sku} className="rounded-md border border-gray-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md">
                <div className="flex items-start gap-3">
                  <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-md bg-gray-100">
                    {image ? (
                      <img src={image} alt={product.name} className="h-full w-full object-cover" />
                    ) : (
                      <FaBox className="text-gray-400" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold text-[#111827]" title={product.name}>{product.name}</h3>
                        <p className="truncate text-[11px] text-gray-500" title={product.description}>{product.description || 'No description'}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        stock > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {stock}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-[#16A34A]">{formatCurrency(product.price)}</span>
                      <span className="truncate font-mono text-[11px] text-[#F97316]" title={sku}>{sku}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-3">
                  <AdminInventoryQuantityGraph product={product} compact />
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-xs text-gray-500">Seller: {product.seller?.businessName || product.seller?.name || 'Unknown'}</span>
                  <button
                    onClick={() => handleToggleProductStatus(product._id)}
                    className={`shrink-0 rounded-md px-2 py-1 text-xs font-semibold ${
                      product.isActive
                        ? 'bg-red-500 text-white hover:bg-red-600'
                        : 'bg-green-500 text-white hover:bg-green-600'
                    }`}
                  >
                    {product.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </div>
            );
            })}
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
    const adminLiveTrip = pickAdminLiveTrip(logistics);

    return (
      <div className="dashboard-shell min-h-screen bg-[#F9FAFB] py-8">
        <div className="container mx-auto px-4">
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <FaTruck className="text-[#3B82F6] text-3xl" />
              <h1 className="text-3xl font-bold text-[#F97316]">Logistics & Delivery Tracking</h1>
            </div>
            <p className="text-[#6B7280]">Track and manage all deliveries in real-time</p>
          </div>

          <LiveLogisticsMapPanel
            trip={adminLiveTrip}
            title="Live Logistics Movement"
            subtitle="Track the selected active logistics trip with Google Maps, GPS history, and driver position."
            eyebrow="Admin Google GPS tracking"
            onRefresh={refreshData}
            refreshing={refreshing}
            emptyText="No live GPS is available yet. Ask logistics to start live GPS sharing."
            className="mb-6"
          />

          <SharedGroupTripPanel
            title="Shared Logistics Operations"
            description="Open Kenya group trips, review available capacity, and join or create consolidated routes for buyers and sellers."
            canCreate
            canManageRoutes
            canManagePayments
            className="mb-6"
          />
          
          {/* Logistics Table */}
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="overflow-x-auto rounded-md border border-gray-100">
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
                  {logistics.map((item, index) => {
                    const orderProvider = getLogisticsPreference(item.order || {});
                    const selectedProviderName = readMetadata(item, 'selectedProviderName') || orderProvider.name || item.driverName || 'Not assigned';
                    return (
                      <tr key={item._id} className={`border-t border-gray-100 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                        <td className="px-6 py-4 font-mono text-sm">{item.trackingNumber}</td>
                        <td className="px-6 py-4 font-mono text-sm text-[#FB923C]">
                          #{String(item.order?.orderNumber || item.order?._id).slice(-8)}
                        </td>
                        <td className="px-6 py-4">
                          <p className="capitalize">{item.carrier}</p>
                          <p className="mt-1 max-w-[170px] truncate text-xs font-semibold text-sky-700">{selectedProviderName}</p>
                        </td>
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
                    );
                  })}
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
      <div className="dashboard-shell min-h-screen bg-[#F9FAFB] py-8">
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
            <div className="overflow-x-auto rounded-md border border-gray-100">
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
        onUploadDocument={uploadUserDocument}
      />
    );
  }
  
  // Broadcast Modal
  if (showBroadcastModal) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4">
          <h2 className="text-2xl font-bold mb-1 text-[#111827]">Broadcast Notification</h2>
          <p className="mb-4 text-sm text-[#6B7280]">Send platform alerts to all users, sellers, logistics providers, or a specific role.</p>
          <div className="space-y-4">
            <select
              value={broadcastData.type}
              onChange={(e) => setBroadcastData({...broadcastData, type: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="all">All Channels</option>
              <option value="in_app">In-App Alert</option>
              <option value="email">Email</option>
              <option value="sms">SMS</option>
              <option value="push">Push/In-App Notification</option>
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
              <option value="seller">All Sellers</option>
              <option value="brand">Brands Only</option>
              <option value="farmer">Farmers Only</option>
              <option value="wholesaler">Wholesalers Only</option>
              <option value="manufacturer">Manufacturers Only</option>
              <option value="retailer">Retailers Only</option>
              <option value="consumer">Buyers Only</option>
              <option value="logistics">Logistics Only</option>
            </select>

            {broadcastResult && (
              <div className="rounded-lg border border-gray-200 bg-[#F9FAFB] p-4 text-sm">
                <p className="mb-2 font-semibold text-[#111827]">Last Broadcast Result</p>
                <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 md:grid-cols-4">
                  <div>
                    <p className="text-xs text-[#6B7280]">Recipients</p>
                    <p className="font-bold text-[#111827]">{broadcastResult.recipients ?? 0}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#6B7280]">In-App</p>
                    <p className="font-bold text-[#111827]">{broadcastResult.inApp?.success ?? 0}/{broadcastResult.inApp?.attempted ?? 0}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#6B7280]">Email</p>
                    <p className="font-bold text-[#111827]">{broadcastResult.email?.success ?? 0}/{broadcastResult.email?.attempted ?? 0}</p>
                  </div>
                  <div>
                    <p className="text-xs text-[#6B7280]">SMS</p>
                    <p className="font-bold text-[#111827]">{broadcastResult.sms?.success ?? 0}/{broadcastResult.sms?.attempted ?? 0}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={handleBroadcast}
              className="flex-1 bg-[#F97316] text-white py-2 rounded-lg hover:bg-[#F97316]/90"
            >
              Send Broadcast
            </button>
            <button
              onClick={() => {
                setShowBroadcastModal(false);
                setBroadcastResult(null);
              }}
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
            <div className="flex flex-col gap-3 sm:flex-row">
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
            
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
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
          <div className="flex flex-col gap-3 sm:flex-row">
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
    const selectedOrderProvider = getLogisticsPreference(selectedOrder);

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

            <div className="border-t pt-4">
              <h3 className="font-semibold mb-2">Buyer Logistics Choice</h3>
              <div className="rounded-lg border border-sky-100 bg-sky-50 p-3 text-sm text-sky-900">
                <p className="font-semibold">{selectedOrderProvider.name || 'Seller preferred provider'}</p>
                <p className="mt-1 text-xs text-sky-700">
                  {selectedOrderProvider.source === 'buyer'
                    ? 'Buyer selected this logistics company at checkout.'
                    : 'Seller or default logistics can be used for this order.'}
                </p>
                {selectedOrderProvider.hub && <p className="mt-1 text-xs text-sky-700">Hub: {selectedOrderProvider.hub}</p>}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default AdminDashboard;
