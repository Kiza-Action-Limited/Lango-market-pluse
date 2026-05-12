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
  
  // Selected items
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
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

  const fetchData = async () => {
    setLoading(true);
    try {
      switch (section) {
        case 'dashboard':
          const [statsRes, analyticsRes] = await Promise.all([
            api.get('/v1/admin/stats'),
            api.get('/v1/admin/analytics', { params: { period: 'month' } })
          ]);
          setStats(statsRes.data.data);
          setAnalytics(analyticsRes.data.data);
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
          setUsers(usersRes.data.users);
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
      setLoading(false);
      setRefreshing(false);
    }
  };

  const refreshData = () => {
    setRefreshing(true);
    fetchData();
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

  if (loading && !refreshing) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="text-center">
          <FaSpinner className="animate-spin text-5xl text-[#F97316] mx-auto mb-4" />
          <p className="text-gray-600">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  // ==================== DASHBOARD SECTION ====================
  if (section === 'dashboard') {
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
            {dashboardStats.map((stat, index) => (
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
          {analytics && (
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
                  {users.map((user, index) => (
                    <tr key={user._id} className={`border-t border-gray-100 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-[#111827]">{user.name}</p>
                          <p className="text-xs text-gray-500">ID: {user._id.slice(-8)}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm">{user.email}</p>
                          <p className="text-xs text-gray-500">{user.phone}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <select
                          value={user.role}
                          onChange={(e) => handleChangeUserRole(user._id, e.target.value)}
                          className={`px-2 py-1 rounded-full text-xs font-medium border ${roleColors[user.role]}`}
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
                            onClick={() => handleVerifyUser(user._id, !user.isVerified)}
                            className="p-1 text-blue-600 hover:text-blue-800"
                            title={user.isVerified ? 'Unverify' : 'Verify'}
                          >
                            <FaUserCheck />
                          </button>
                          <button
                            onClick={() => handleBlockUser(user._id, !user.isBlocked)}
                            className={`p-1 ${user.isBlocked ? 'text-green-600' : 'text-red-600'} hover:opacity-80`}
                            title={user.isBlocked ? 'Unblock' : 'Block'}
                          >
                            {user.isBlocked ? <FaUserCheck /> : <FaUserTimes />}
                          </button>
                          <button
                            onClick={() => {
                              setSelectedUser(user);
                              setShowUserModal(true);
                            }}
                            className="p-1 text-[#F97316] hover:text-[#FB923C]"
                            title="View Details"
                          >
                            <FaEye />
                          </button>
                        </div>
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
