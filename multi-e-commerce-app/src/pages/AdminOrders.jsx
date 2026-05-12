// src/pages/AdminOrders.jsx
import React, { useState, useEffect } from 'react';
import api from '../config/axios';
import { useAuth } from '../context/AuthContext';
import { FaEye, FaTruck, FaCheckCircle, FaBox, FaUser, FaMapMarkerAlt, FaClock, FaBrain, FaBell } from 'react-icons/fa';
import toast from 'react-hot-toast';
import { formatCurrency } from '../utils/formatters';

const AdminOrders = () => {
  const { token } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const response = await api.get('/v1/admin/orders');
      setOrders(response.data.orders);
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId, status) => {
    try {
      await api.put(`/v1/admin/orders/${orderId}/status`, { status });
      toast.success('Order status updated successfully');
      fetchOrders();
    } catch (error) {
      toast.error('Failed to update order status');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return 'bg-[#F97316]/10 text-[#F97316] border border-[#F97316]/20';
      case 'processing':
        return 'bg-[#FB923C]/10 text-[#FB923C] border border-[#FB923C]/20';
      case 'shipped':
        return 'bg-[#F97316]/10 text-[#F97316] border border-[#F97316]/20';
      case 'delivered':
        return 'bg-[#16A34A]/10 text-[#16A34A] border border-[#16A34A]/20';
      case 'cancelled':
        return 'bg-red-100 text-red-800 border border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border border-gray-200';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return <FaClock className="mr-1" size={12} />;
      case 'processing':
        return <FaBox className="mr-1" size={12} />;
      case 'shipped':
        return <FaTruck className="mr-1" size={12} />;
      case 'delivered':
        return <FaCheckCircle className="mr-1" size={12} />;
      default:
        return null;
    }
  };

  const filteredOrders = orders.filter(order => {
    if (filter === 'all') return true;
    return order.status === filter;
  });

  // Order statistics
  const orderStats = {
    pending: orders.filter(o => o.status === 'pending').length,
    processing: orders.filter(o => o.status === 'processing').length,
    shipped: orders.filter(o => o.status === 'shipped').length,
    delivered: orders.filter(o => o.status === 'delivered').length,
    cancelled: orders.filter(o => o.status === 'cancelled').length,
    totalRevenue: orders.reduce((sum, o) => sum + o.total, 0),
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#F97316]"></div>
      </div>
    );
  }

  return (
    <div className="bg-[#F9FAFB] min-h-screen py-8">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <FaTruck className="text-[#16A34A] text-3xl" />
            <h1 className="text-3xl font-bold text-[#F97316]">Manage Orders</h1>
          </div>
          <p className="text-[#6B7280]">Lango Lako la Biashara Smart — Track and manage all platform orders</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-[#F97316]">
            <p className="text-[#6B7280] text-xs uppercase tracking-wide">Total Orders</p>
            <p className="text-2xl font-bold text-[#111827]">{orders.length}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-[#16A34A]">
            <p className="text-[#6B7280] text-xs uppercase tracking-wide">Total Revenue</p>
            <p className="text-2xl font-bold text-[#16A34A]">{formatCurrency(orderStats.totalRevenue)}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-[#F97316]">
            <p className="text-[#6B7280] text-xs uppercase tracking-wide">Pending</p>
            <p className="text-2xl font-bold text-[#F97316]">{orderStats.pending}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-[#FB923C]">
            <p className="text-[#6B7280] text-xs uppercase tracking-wide">Processing</p>
            <p className="text-2xl font-bold text-[#FB923C]">{orderStats.processing}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-[#F97316]">
            <p className="text-[#6B7280] text-xs uppercase tracking-wide">Shipped</p>
            <p className="text-2xl font-bold text-[#F97316]">{orderStats.shipped}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-[#16A34A]">
            <p className="text-[#6B7280] text-xs uppercase tracking-wide">Delivered</p>
            <p className="text-2xl font-bold text-[#16A34A]">{orderStats.delivered}</p>
          </div>
        </div>
        
        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                filter === 'all' 
                  ? 'bg-[#F97316] text-white shadow-md' 
                  : 'bg-gray-100 text-[#6B7280] hover:bg-gray-200'
              }`}
            >
              All Orders ({orders.length})
            </button>
            <button
              onClick={() => setFilter('pending')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                filter === 'pending' 
                  ? 'bg-[#F97316] text-white shadow-md' 
                  : 'bg-gray-100 text-[#6B7280] hover:bg-gray-200'
              }`}
            >
              Pending ({orderStats.pending})
            </button>
            <button
              onClick={() => setFilter('processing')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                filter === 'processing' 
                  ? 'bg-[#FB923C] text-white shadow-md' 
                  : 'bg-gray-100 text-[#6B7280] hover:bg-gray-200'
              }`}
            >
              Processing ({orderStats.processing})
            </button>
            <button
              onClick={() => setFilter('shipped')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                filter === 'shipped' 
                  ? 'bg-[#F97316] text-white shadow-md' 
                  : 'bg-gray-100 text-[#6B7280] hover:bg-gray-200'
              }`}
            >
              Shipped ({orderStats.shipped})
            </button>
            <button
              onClick={() => setFilter('delivered')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                filter === 'delivered' 
                  ? 'bg-[#16A34A] text-white shadow-md' 
                  : 'bg-gray-100 text-[#6B7280] hover:bg-gray-200'
              }`}
            >
              Delivered ({orderStats.delivered})
            </button>
            <button
              onClick={() => setFilter('cancelled')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                filter === 'cancelled' 
                  ? 'bg-red-500 text-white shadow-md' 
                  : 'bg-gray-100 text-[#6B7280] hover:bg-gray-200'
              }`}
            >
              Cancelled ({orderStats.cancelled})
            </button>
          </div>
        </div>
        
        {/* AI Intelligence Tip */}
        {filter === 'pending' && orderStats.pending > 5 && (
          <div className="mb-6 bg-linear-to-r from-[#F97316]/10 to-[#FB923C]/10 rounded-xl p-4 border border-[#F97316]/20">
            <div className="flex items-start gap-3">
              <FaBrain className="text-[#F97316] text-xl mt-0.5" />
              <div>
                <h4 className="font-semibold text-[#111827] mb-1">AI Intelligence Alert</h4>
                <p className="text-sm text-[#6B7280]">
                  {orderStats.pending} pending orders require attention. Processing them faster can improve customer satisfaction by <span className="text-[#16A34A] font-medium">32%</span>.
                </p>
              </div>
            </div>
          </div>
        )}
        
        {/* Orders List */}
        <div className="space-y-4">
          {filteredOrders.map((order) => (
            <div key={order._id} className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow">
              <div className="bg-linear-to-r from-gray-50 to-white px-4 sm:px-6 py-4 border-b flex flex-wrap gap-3 justify-between items-center">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="flex items-center gap-2">
                    <FaBox className="text-[#FB923C]" />
                    <span className="text-sm font-mono text-[#FB923C]">#{String(order._id).slice(-8)}</span>
                  </div>
                  <div className="w-px h-4 bg-gray-300" />
                  <div className="flex items-center gap-2 text-sm text-[#6B7280]">
                    <FaClock size={12} />
                    <span>{new Date(order.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="w-full sm:w-auto flex flex-wrap sm:flex-nowrap items-center gap-3 sm:gap-4 sm:justify-end">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1 ${getStatusColor(order.status)}`}>
                    {getStatusIcon(order.status)}
                    {order.status.toUpperCase()}
                  </span>
                  <span className="font-bold text-[#16A34A]">{formatCurrency(order.total)}</span>
                  <button
                    onClick={() => setSelectedOrder(selectedOrder?._id === order._id ? null : order)}
                    className="text-[#F97316] hover:text-[#FB923C] font-medium flex items-center gap-1 transition-colors"
                  >
                    <FaEye size={14} />
                    {selectedOrder?._id === order._id ? 'Hide Details' : 'View Details'}
                  </button>
                </div>
              </div>
              
              {selectedOrder?._id === order._id && (
                <div className="p-6 border-t bg-[#F9FAFB]">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white rounded-lg p-4 shadow-sm">
                      <div className="flex items-center gap-2 mb-3">
                        <FaUser className="text-[#F97316]" />
                        <h3 className="font-semibold text-[#111827]">Customer Information</h3>
                      </div>
                      <p className="text-[#111827] font-medium">{order.customer?.name || 'Guest Customer'}</p>
                      <p className="text-[#6B7280] text-sm">{order.customer?.email}</p>
                      <p className="text-[#6B7280] text-sm mt-1">{order.shippingAddress?.phone}</p>
                    </div>
                    
                    <div className="bg-white rounded-lg p-4 shadow-sm">
                      <div className="flex items-center gap-2 mb-3">
                        <FaMapMarkerAlt className="text-[#F97316]" />
                        <h3 className="font-semibold text-[#111827]">Shipping Address</h3>
                      </div>
                      <p className="text-[#111827]">{order.shippingAddress?.addressLine1}</p>
                      {order.shippingAddress?.addressLine2 && (
                        <p className="text-[#6B7280] text-sm">{order.shippingAddress.addressLine2}</p>
                      )}
                      <p className="text-[#6B7280] text-sm">
                        {order.shippingAddress?.city}, {order.shippingAddress?.state} {order.shippingAddress?.zipCode}
                      </p>
                      <p className="text-[#6B7280] text-sm">{order.shippingAddress?.country}</p>
                    </div>
                  </div>
                  
                  <div className="mt-6 bg-white rounded-lg p-4 shadow-sm">
                    <h3 className="font-semibold mb-3 text-[#111827]">Order Items</h3>
                    <div className="space-y-2">
                      {order.items.map((item) => (
                        <div key={item.id} className="flex flex-wrap justify-between items-center gap-2 py-2 border-b last:border-0">
                          <div className="flex items-center gap-3 min-w-0">
                            <img
                              src={item.image || 'https://via.placeholder.com/50'}
                              alt={item.name}
                              className="w-12 h-12 object-cover rounded-lg"
                            />
                            <div>
                              <p className="font-medium text-[#111827]">{item.name}</p>
                              <p className="text-sm text-[#6B7280]">Qty: {item.quantity}</p>
                            </div>
                          </div>
                          <span className="font-semibold text-[#16A34A]">{formatCurrency(item.price * item.quantity)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 pt-3 border-t flex justify-between items-center">
                      <span className="font-semibold text-[#111827]">Total</span>
                      <span className="text-xl font-bold text-[#16A34A]">{formatCurrency(order.total)}</span>
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-4 border-t">
                    <label className="block text-sm font-medium mb-2 text-[#111827]">Update Order Status</label>
                    <select
                      value={order.status}
                      onChange={(e) => updateOrderStatus(order._id, e.target.value)}
                      className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F97316] focus:border-transparent"
                    >
                      <option value="pending">Pending</option>
                      <option value="processing">Processing</option>
                      <option value="shipped">Shipped</option>
                      <option value="delivered">Delivered</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          ))}
          
          {filteredOrders.length === 0 && (
            <div className="bg-white rounded-xl shadow-md p-12 text-center">
              <div className="text-5xl mb-4">📦</div>
              <p className="text-[#6B7280] text-lg">No orders found</p>
              <p className="text-[#6B7280] text-sm mt-1">Try changing your filter to see more orders</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminOrders;
