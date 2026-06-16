// src/pages/Orders.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FaEye, FaTruck, FaBox, FaClock, FaCheckCircle, FaBan, FaBrain } from 'react-icons/fa';
import { formatCurrency } from '../utils/formatters';
import { orderService } from '../services/orderService';
import { normalizeOrder } from '../utils/orderAdapter';

const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState('all');

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const response = await orderService.getAll({ role: 'buyer', page: 1, limit: 50 });
      setOrders((response.data || response.orders || []).map(normalizeOrder));
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
      case 'pending_payment':
      case 'AWAITING_PAYMENT':
        return 'bg-[#F97316]/10 text-[#F97316] border border-[#F97316]/20';
      case 'processing':
      case 'payment_escrowed':
      case 'FUNDS_HELD':
        return 'bg-[#FB923C]/10 text-[#FB923C] border border-[#FB923C]/20';
      case 'shipped':
      case 'dispatched':
      case 'IN_TRANSIT':
        return 'bg-[#F97316]/10 text-[#F97316] border border-[#F97316]/20';
      case 'delivered':
      case 'DELIVERED':
      case 'completed':
      case 'RELEASED':
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
      case 'pending_payment':
      case 'AWAITING_PAYMENT':
        return <FaClock className="mr-1" size={12} />;
      case 'processing':
      case 'payment_escrowed':
      case 'FUNDS_HELD':
        return <FaBox className="mr-1" size={12} />;
      case 'shipped':
      case 'dispatched':
      case 'IN_TRANSIT':
        return <FaTruck className="mr-1" size={12} />;
      case 'delivered':
      case 'DELIVERED':
      case 'completed':
      case 'RELEASED':
        return <FaCheckCircle className="mr-1" size={12} />;
      case 'cancelled':
        return <FaBan className="mr-1" size={12} />;
      default:
        return null;
    }
  };

  const handleCancelOrder = async (orderId) => {
    if (window.confirm('Are you sure you want to cancel this order?')) {
      try {
        await orderService.cancel(orderId);
        fetchOrders();
      } catch (error) {
        console.error('Error cancelling order:', error);
      }
    }
  };

  const filteredOrders = orders.filter(order => {
    if (selectedFilter === 'all') return true;
    return order.status === selectedFilter;
  });

  // Order statistics
  const orderStats = {
    total: orders.length,
    pending: orders.filter(o => ['pending', 'pending_payment', 'AWAITING_PAYMENT'].includes(o.status)).length,
    processing: orders.filter(o => ['processing', 'payment_escrowed', 'FUNDS_HELD'].includes(o.status)).length,
    shipped: orders.filter(o => ['shipped', 'dispatched', 'IN_TRANSIT'].includes(o.status)).length,
    delivered: orders.filter(o => ['delivered', 'DELIVERED', 'completed', 'RELEASED'].includes(o.status)).length,
    totalSpent: orders.reduce((sum, o) => sum + o.total, 0),
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#F97316]"></div>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="bg-[#F9FAFB] min-h-screen py-16">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-md mx-auto bg-white rounded-xl shadow-md p-8">
            <div className="text-6xl mb-4">📦</div>
            <h2 className="text-2xl font-bold text-[#F97316] mb-4">No Orders Yet</h2>
            <p className="text-[#6B7280] mb-8">
              You haven't placed any orders yet. Start exploring products from our trusted sellers.
            </p>
            <Link to="/products" className="inline-block px-6 py-3 bg-[#F97316] text-white rounded-lg font-semibold hover:bg-[#F97316]/90 transition-colors">
              Start Shopping
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#F9FAFB] min-h-screen py-8">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <FaBox className="text-[#F97316] text-3xl" />
            <h1 className="text-3xl font-bold text-[#F97316]">My Orders</h1>
          </div>
          <p className="text-[#6B7280]">Lango Lako la Biashara Smart — Track and manage your orders</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-[#F97316]">
            <p className="text-[#6B7280] text-xs uppercase tracking-wide">Total Orders</p>
            <p className="text-2xl font-bold text-[#111827]">{orderStats.total}</p>
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
            <p className="text-[#6B7280] text-xs uppercase tracking-wide">Total Spent</p>
            <p className="text-xl font-bold text-[#16A34A]">{formatCurrency(orderStats.totalSpent)}</p>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="bg-white rounded-xl shadow-sm p-3 mb-6">
          <div className="flex flex-wrap gap-2">
            {['all', 'pending_payment', 'processing', 'dispatched', 'delivered', 'cancelled'].map((filter) => (
              <button
                key={filter}
                onClick={() => setSelectedFilter(filter)}
                className={`px-4 py-2 rounded-lg font-medium capitalize transition-all ${
                  selectedFilter === filter
                    ? filter === 'cancelled'
                      ? 'bg-red-500 text-white shadow-md'
                      : filter === 'pending'
                      ? 'bg-[#F97316] text-white shadow-md'
                      : filter === 'processing'
                      ? 'bg-[#FB923C] text-white shadow-md'
                      : filter === 'shipped'
                      ? 'bg-[#F97316] text-white shadow-md'
                      : filter === 'delivered'
                      ? 'bg-[#16A34A] text-white shadow-md'
                      : 'bg-[#F97316] text-white shadow-md'
                    : 'bg-gray-100 text-[#6B7280] hover:bg-gray-200'
                }`}
              >
                {filter === 'all' ? 'All Orders' : filter.replace(/_/g, ' ')}
                {filter !== 'all' && (
                  <span className="ml-1 text-xs opacity-75">
                    ({orders.filter(o => o.status === filter).length})
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* AI Intelligence Tip */}
        {orderStats.pending > 0 && (
        <div className="mb-6 bg-linear-to-r from-[#F97316]/10 to-[#FB923C]/10 rounded-xl p-4 border border-[#F97316]/20">
            <div className="flex items-start gap-3">
              <FaBrain className="text-[#F97316] text-xl mt-0.5" />
              <div>
                <h4 className="font-semibold text-[#111827] mb-1">AI Intelligence Insight</h4>
                <p className="text-sm text-[#6B7280]">
                  You have {orderStats.pending} pending {orderStats.pending === 1 ? 'order' : 'orders'}. 
                  We'll notify you once they're processed. Estimated processing time: 1-2 business days.
                </p>
              </div>
            </div>
        </div>
        )}
      
        {/* Orders List */}
        <div className="space-y-4">
          {filteredOrders.map((order) => (
            <div key={order.id} className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow">
              <div className="bg-linear-to-r from-gray-50 to-white px-6 py-4 border-b flex flex-wrap justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <FaBox className="text-[#FB923C]" />
                    <span className="text-sm font-mono text-[#FB923C]">#{order.id.slice(-8)}</span>
                  </div>
                  <div className="w-px h-4 bg-gray-300" />
                  <div className="flex items-center gap-2 text-sm text-[#6B7280]">
                    <FaClock size={12} />
                    <span>{new Date(order.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1 ${getStatusColor(order.status)}`}>
                    {getStatusIcon(order.status)}
                    {order.status.replace(/_/g, ' ').toUpperCase()}
                  </span>
                  <span className="font-bold text-[#16A34A]">{formatCurrency(order.total)}</span>
                </div>
              </div>
              
              <div className="p-6">
                <div className="space-y-3">
                  {order.items.slice(0, 3).map((item) => (
                    <div key={item.id} className="flex justify-between items-center">
                      <div className="flex items-center space-x-3">
                        <img
                          src={item.image || 'https://via.placeholder.com/50'}
                          alt={item.name}
                          className="w-12 h-12 object-cover rounded-lg"
                        />
                        <div>
                          <Link to={`/products/${item.productId}`} className="font-semibold text-[#111827] hover:text-[#F97316] transition-colors">
                            {item.name}
                          </Link>
                          <p className="text-sm text-[#6B7280]">Qty: {item.quantity}</p>
                        </div>
                      </div>
                      <span className="font-medium text-[#F97316]">{formatCurrency(item.price * item.quantity)}</span>
                    </div>
                  ))}
                  {order.items.length > 3 && (
                    <p className="text-sm text-[#6B7280]">+ {order.items.length - 3} more items</p>
                  )}
                </div>
                
                <div className="mt-4 pt-4 border-t flex flex-wrap justify-between items-center gap-3">
                  <Link
                    to={`/orders/${order.id}/track`}
                    className="flex items-center gap-1 text-[#F97316] hover:text-[#FB923C] transition-colors font-medium"
                  >
                    <FaTruck size={14} />
                    Track Order
                  </Link>
                  
                  <div className="flex gap-3">
                    {['pending', 'pending_payment', 'AWAITING_PAYMENT'].includes(order.status) && (
                      <button
                        onClick={() => handleCancelOrder(order.id)}
                        className="text-red-600 hover:text-red-700 text-sm font-medium transition-colors"
                      >
                        Cancel Order
                      </button>
                    )}
                    <Link
                      to={`/orders/${order.id}`}
                      className="flex items-center gap-1 text-[#6B7280] hover:text-[#F97316] transition-colors font-medium"
                    >
                      <FaEye size={14} />
                      View Details
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Results Summary */}
        {filteredOrders.length > 0 && filteredOrders.length !== orders.length && (
          <div className="mt-6 text-center text-sm text-[#6B7280]">
            Showing {filteredOrders.length} of {orders.length} orders
          </div>
        )}
      </div>
    </div>
  );
};

export default Orders;
