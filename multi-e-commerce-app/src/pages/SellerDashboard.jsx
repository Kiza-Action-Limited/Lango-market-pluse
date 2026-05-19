// src/pages/SellerDashboard.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FaPlus, FaEdit, FaTrash, FaChartLine, FaBox, FaDollarSign, FaShoppingCart, FaLock, FaUnlockAlt, FaBrain } from 'react-icons/fa';
import { formatCurrency } from '../utils/formatters';
import { SUBSCRIPTION_FEATURES } from '../config/subscriptionPlans';
import { productService } from '../services/productService';
import { orderService } from '../services/orderService';

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

  useEffect(() => {
    fetchSellerData();
  }, []);

  const fetchSellerData = async () => {
    try {
      const productsRes = await productService.getMyProducts({ page: 1, limit: 20 });
      const myProducts = productsRes?.data || [];
      const usage = productsRes?.planUsage || null;
      const ordersRes = await orderService.getAll({ role: 'seller', page: 1, limit: 10 });
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
      setRecentOrders(sellerOrders.slice(0, 5));
    } catch (error) {
      console.error('Error fetching seller data:', error);
    } finally {
      setLoading(false);
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

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Seller Dashboard</h1>
          {activePlan && (
            <p className="text-sm text-gray-600 mt-1">
              Active tier: <span className="font-semibold">{activePlan.name}</span> ({activePlan.priceLabel})
            </p>
          )}
          {planUsage && (
            <p className="text-sm text-gray-600 mt-1">
              Product slots: <span className="font-semibold">{planUsage.visibleProducts}</span> / {planUsage.productLimit}
            </p>
          )}
        </div>
        {canManageInventory ? (
          <Link to="/seller/add-product" className="btn-primary flex items-center space-x-2">
            <FaPlus />
            <span>Add Product</span>
          </Link>
        ) : (
          <Link
            to="/seller/subscription-plans"
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition flex items-center space-x-2"
          >
            <FaLock />
            <span>Upgrade To Add Product</span>
          </Link>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
          <div className="flex items-center gap-2">
            <FaBrain className="text-[#F97316]" />
            <h2 className="text-xl font-semibold">Operational Intelligence</h2>
          </div>
          <Link to="/seller/subscription-plans" className="text-sm text-primary hover:underline">
            View All Plans
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {isSectionLoading
            ? Array.from({ length: 4 }).map((_, idx) => (
                <div key={`intel-skeleton-${idx}`} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <div className="h-5 w-40 rounded bg-gray-200 skeleton-shimmer mb-3" />
                  <div className="h-4 w-full rounded bg-gray-200 skeleton-shimmer mb-2" />
                  <div className="h-4 w-4/5 rounded bg-gray-200 skeleton-shimmer" />
                </div>
              ))
            : intelligenceCards.map((card) => {
            const enabled = hasFeature(card.key);
            return (
              <div
                key={card.key}
                className={`rounded-lg border p-4 ${
                  enabled ? 'border-green-200 bg-green-50/60' : 'border-gray-200 bg-gray-50'
                }`}
              >
                <div className="flex justify-between items-start gap-3 mb-2">
                  <h3 className="font-semibold text-gray-900">{card.title}</h3>
                  {enabled ? (
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-green-100 text-green-700">
                      <FaUnlockAlt size={12} /> Enabled
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-gray-200 text-gray-600">
                      <FaLock size={11} /> Locked
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600">{card.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Digital CFO Health Meter</h2>
          <div className="mb-3 text-sm text-gray-600">Frontend estimate using current seller revenue</div>
          <div className="text-3xl font-bold mb-2">
            {isSectionLoading ? <span className="inline-block h-9 w-44 rounded bg-gray-200 skeleton-shimmer" /> : formatCurrency(cfoNetProfit)}
          </div>
          <div className="w-full h-3 rounded-full bg-gray-200 overflow-hidden mb-2">
            <div
              className={`h-full ${healthState === 'Green' ? 'bg-green-500' : healthState === 'Yellow' ? 'bg-yellow-500' : 'bg-red-500'}`}
              style={{ width: `${Math.min(100, Math.max(5, Math.abs(cfoMargin)))}%` }}
            />
          </div>
          <p className="text-sm text-gray-700">
            Status: <span className="font-semibold">{healthState}</span> ({cfoMargin.toFixed(1)}% margin)
          </p>
          <p className="text-xs text-gray-500 mt-2">
            Formula preview: Revenue - estimated OPEX/CAPEX/Comms
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Alerts (Scarcity + Expiry)</h2>
          {isSectionLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, idx) => (
                <div key={`alert-skeleton-${idx}`} className="h-16 rounded bg-gray-100 skeleton-shimmer" />
              ))}
            </div>
          ) : lowStockItems.length === 0 && expiringSoonItems.length === 0 ? (
            <p className="text-gray-500">No active alerts right now.</p>
          ) : (
            <div className="space-y-3">
              {lowStockItems.slice(0, 4).map((item) => (
                <div key={`low-${item.id || item._id}`} className="rounded border border-red-200 bg-red-50 p-3">
                  <p className="font-semibold text-red-700">{item.name}</p>
                  <p className="text-sm text-red-600">
                    Stock {Number(item.quantityAvailable ?? item.stock ?? 0)} is at/below threshold {Number(item.minThreshold)}
                  </p>
                </div>
              ))}
              {expiringSoonItems.slice(0, 4).map((item) => (
                <div key={`exp-${item.id || item._id}`} className="rounded border border-yellow-200 bg-yellow-50 p-3">
                  <p className="font-semibold text-yellow-700">{item.name}</p>
                  <p className="text-sm text-yellow-700">
                    Expires in {daysToExpiry(item?.attributes?.expiry)} day(s)
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Total Products</p>
              <p className="text-3xl font-bold text-primary">{isSectionLoading ? '-' : stats.totalProducts}</p>
            </div>
            <FaBox className="text-4xl text-gray-300" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Total Orders</p>
              <p className="text-3xl font-bold text-primary">{isSectionLoading ? '-' : stats.totalOrders}</p>
            </div>
            <FaShoppingCart className="text-4xl text-gray-300" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Total Revenue</p>
              <p className="text-3xl font-bold text-primary">{isSectionLoading ? '-' : formatCurrency(stats.totalRevenue)}</p>
            </div>
            <FaDollarSign className="text-4xl text-gray-300" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Pending Orders</p>
              <p className="text-3xl font-bold text-primary">{isSectionLoading ? '-' : stats.pendingOrders}</p>
            </div>
            <FaChartLine className="text-4xl text-gray-300" />
          </div>
        </div>
      </div>
      
      {/* Recent Orders */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Recent Orders</h2>
        {isSectionLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, idx) => (
              <div key={`orders-skeleton-${idx}`} className="h-12 rounded bg-gray-100 skeleton-shimmer" />
            ))}
          </div>
        ) : recentOrders.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No orders yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b">
                <tr className="text-left">
                  <th className="pb-2">Order ID</th>
                  <th className="pb-2">Customer</th>
                  <th className="pb-2">Total</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Date</th>
                  <th className="pb-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order.id || order._id} className="border-b">
                    <td className="py-3">#{String(order.id || order._id).slice(-8)}</td>
                    <td>{order.buyer?.fullName || 'N/A'}</td>
                    <td>{formatCurrency(order.totalAmount)}</td>
                    <td>
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        order.status === 'pending_payment' ? 'bg-yellow-100 text-yellow-800' :
                        order.status === 'payment_escrowed' ? 'bg-blue-100 text-blue-800' :
                        order.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                        order.status === 'dispatched' ? 'bg-purple-100 text-purple-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {order.status}
                      </span>
                    </td>
                    <td>{new Date(order.createdAt).toLocaleDateString()}</td>
                    <td>
                      <Link to={`/seller/orders`} className="text-primary hover:underline">
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      
      {/* Products List */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">My Products</h2>
        {isSectionLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={`products-skeleton-${idx}`} className="border rounded-lg overflow-hidden">
                <div className="w-full h-48 bg-gray-200 skeleton-shimmer" />
                <div className="p-4">
                  <div className="h-5 w-3/4 rounded bg-gray-200 skeleton-shimmer mb-2" />
                  <div className="h-4 w-1/2 rounded bg-gray-200 skeleton-shimmer mb-2" />
                  <div className="h-4 w-1/3 rounded bg-gray-200 skeleton-shimmer mb-3" />
                  <div className="h-8 w-full rounded bg-gray-200 skeleton-shimmer" />
                </div>
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 mb-4">You haven't added any products yet</p>
            <Link to="/seller/add-product" className="btn-primary">
              Add Your First Product
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product) => (
              <div key={product.id} className="border rounded-lg overflow-hidden">
                <img
                  src={product.images?.[0] || 'https://via.placeholder.com/300'}
                  alt={product.name}
                  className="w-full h-48 object-cover"
                />
                <div className="p-4">
                  <h3 className="font-semibold mb-2">{product.name}</h3>
                  <p className="text-primary font-bold mb-2">{formatCurrency(product.price)}</p>
                  <p className="text-sm text-gray-500 mb-3">Stock: {product.quantityAvailable ?? product.stock ?? 0}</p>
                  <div className="flex space-x-2">
                    <Link
                      to={`/seller/edit-product/${product.id || product._id}`}
                      className="flex-1 btn-secondary text-center text-sm py-1 flex items-center justify-center space-x-1"
                    >
                      <FaEdit />
                      <span>Edit</span>
                    </Link>
                    <button
                      onClick={() => handleDeleteProduct(product.id || product._id)}
                      className="flex-1 bg-red-500 text-white py-1 rounded-lg hover:bg-red-600 transition flex items-center justify-center space-x-1"
                    >
                      <FaTrash />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SellerDashboard;
