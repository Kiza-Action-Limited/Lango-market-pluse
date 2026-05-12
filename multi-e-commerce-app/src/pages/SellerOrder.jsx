// src/pages/SellerOrders.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FaEye, FaTruck } from 'react-icons/fa';
import toast from 'react-hot-toast';
import { formatCurrency } from '../utils/formatters';
import { orderService } from '../services/orderService';

const SellerOrders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const response = await orderService.getAll({ role: 'seller', page: 1, limit: 20 });
      setOrders(response?.data || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId, status) => {
    try {
      await orderService.updateStatus(orderId, status);
      toast.success('Order status updated');
      fetchOrders();
    } catch (error) {
      toast.error('Failed to update order status');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
      case 'pending_payment':
        return 'bg-yellow-100 text-yellow-800';
      case 'processing':
      case 'payment_escrowed':
        return 'bg-blue-100 text-blue-800';
      case 'shipped':
      case 'dispatched':
        return 'bg-purple-100 text-purple-800';
      case 'delivered':
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Orders to Fulfill</h1>
      
      {orders.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <p className="text-gray-500">No orders yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <div key={order.id || order._id} className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="bg-gray-50 px-6 py-4 border-b flex flex-wrap justify-between items-center">
                <div>
                  <span className="text-sm text-gray-500">Order #{String(order.id || order._id).slice(-8)}</span>
                  <span className="mx-2">|</span>
                  <span className="text-sm">{new Date(order.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center space-x-4">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(order.status)}`}>
                    {order.status.toUpperCase()}
                  </span>
                  <span className="font-semibold">{formatCurrency(order.totalAmount)}</span>
                </div>
              </div>
              
              <div className="p-6">
                <div className="mb-4">
                  <h3 className="font-semibold mb-2">Customer Information</h3>
                  <p className="text-gray-600">{order.buyer?.fullName || 'N/A'}</p>
                  <p className="text-gray-600">{order.buyer?.phone || 'N/A'}</p>
                </div>
                
                <div className="mb-4">
                  <h3 className="font-semibold mb-2">Delivery</h3>
                  <p className="text-gray-600">Order status: {order.status}</p>
                </div>
                
                <div className="mb-4">
                  <h3 className="font-semibold mb-2">Items</h3>
                  <div className="space-y-2">
                    {[order].map((item) => (
                      <div key={item._id} className="flex justify-between items-center">
                        <div className="flex items-center space-x-3">
                          <img
                            src={item.product?.images?.[0] || 'https://via.placeholder.com/50'}
                            alt={item.product?.name}
                            className="w-12 h-12 object-cover rounded"
                          />
                          <div>
                            <Link to={`/products/${item.product?._id}`} className="font-semibold hover:text-primary">
                              {item.product?.name || 'Product'}
                            </Link>
                            <p className="text-sm text-gray-500">Qty: {item.quantity}</p>
                          </div>
                        </div>
                        <span>{formatCurrency(item.totalAmount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                {order.status !== 'delivered' && order.status !== 'completed' && order.status !== 'cancelled' && (
                  <div className="mt-4 pt-4 border-t">
                    <label className="block text-sm font-medium mb-2">Update Status</label>
                    <select
                      value={order.status}
                      onChange={(e) => updateOrderStatus(order.id || order._id, e.target.value)}
                      className="px-4 py-2 border rounded-lg"
                    >
                      <option value="pending_payment">Pending payment</option>
                      <option value="payment_escrowed">Escrowed</option>
                      <option value="processing">Processing</option>
                      <option value="dispatched">Dispatched</option>
                      <option value="delivered">Delivered</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SellerOrders;
