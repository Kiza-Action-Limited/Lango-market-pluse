import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FaBoxOpen,
  FaCheckCircle,
  FaClock,
  FaHeart,
  FaBell,
  FaSearch,
  FaShieldAlt,
  FaShoppingCart,
  FaStar,
  FaStore,
  FaTruck,
} from 'react-icons/fa';
import { orderService } from '../services/orderService';
import { normalizeOrder } from '../utils/orderAdapter';
import { formatCurrency } from '../utils/formatters';
import LiveLogisticsMapPanel from '../components/logistics/LiveLogisticsMapPanel';
import SharedGroupTripPanel from '../components/logistics/SharedGroupTripPanel';

const statusGroups = {
  awaiting: ['pending', 'pending_payment', 'AWAITING_PAYMENT'],
  active: ['processing', 'payment_escrowed', 'FUNDS_HELD', 'dispatched', 'IN_TRANSIT'],
  delivered: ['delivered', 'DELIVERED', 'completed', 'RELEASED'],
};

const StatTile = ({ icon: Icon, label, value, detail, tone = 'orange' }) => {
  const tones = {
    orange: 'border-[#F97316]/20 bg-[#FFF7ED] text-[#F97316]',
    green: 'border-green-200 bg-green-50 text-green-700',
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
    slate: 'border-gray-200 bg-white text-gray-700',
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <span className={`inline-flex h-10 w-10 items-center justify-center rounded-lg border ${tones[tone]}`}>
          <Icon />
        </span>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </div>
      <p className="mt-3 text-xs font-semibold uppercase text-gray-500">{label}</p>
      {detail && <p className="mt-1 text-sm text-gray-600">{detail}</p>}
    </div>
  );
};

const BuyerDashboard = () => {
  const [orders, setOrders] = useState([]);
  const [liveTracking, setLiveTracking] = useState(null);
  const [liveTrackingOrder, setLiveTrackingOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [liveLoading, setLiveLoading] = useState(false);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const response = await orderService.getAll({ role: 'buyer', page: 1, limit: 6 });
        setOrders((response.data || response.orders || []).map(normalizeOrder));
      } catch (error) {
        console.error('Error loading buyer dashboard orders:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, []);

  const stats = useMemo(() => {
    const awaiting = orders.filter((order) => statusGroups.awaiting.includes(order.status)).length;
    const active = orders.filter((order) => statusGroups.active.includes(order.status)).length;
    const delivered = orders.filter((order) => statusGroups.delivered.includes(order.status)).length;
    const totalSpent = orders.reduce((sum, order) => sum + Number(order.total || 0), 0);

    return { awaiting, active, delivered, totalSpent };
  }, [orders]);

  const latestOrder = orders[0];
  const activeTrackingOrder = useMemo(() => (
    orders.find((order) => statusGroups.active.includes(order.status)) || latestOrder || null
  ), [latestOrder, orders]);

  const loadLiveTracking = async ({ silent = false } = {}) => {
    if (!activeTrackingOrder?.id) return;
    if (!silent) setLiveLoading(true);

    try {
      const response = await orderService.getLiveTracking(activeTrackingOrder.id);
      const payload = response.data || response;
      setLiveTracking(payload);
      setLiveTrackingOrder(normalizeOrder({
        ...(payload.order || activeTrackingOrder),
        logistics: payload.logistics,
        escrow: payload.escrow,
      }));
    } catch (error) {
      console.error('Error loading buyer live logistics tracking:', error);
      if (!silent) {
        setLiveTracking(null);
        setLiveTrackingOrder(activeTrackingOrder);
      }
    } finally {
      if (!silent) setLiveLoading(false);
    }
  };

  useEffect(() => {
    loadLiveTracking();
  }, [activeTrackingOrder?.id]);

  useEffect(() => {
    if (!activeTrackingOrder?.id || !statusGroups.active.includes(activeTrackingOrder.status)) return undefined;

    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== 'hidden') {
        loadLiveTracking({ silent: true });
      }
    }, 15000);

    return () => window.clearInterval(intervalId);
  }, [activeTrackingOrder?.id, activeTrackingOrder?.status]);

  return (
    <div className="min-h-full bg-gray-50 p-4 sm:p-6">
      <div className="mx-auto max-w-screen-2xl space-y-6">
        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase text-[#F97316]">Buyer dashboard</p>
              <h2 className="mt-2 text-2xl font-bold text-gray-950">Track purchases from checkout to doorstep</h2>
              <p className="mt-2 text-sm text-gray-600">
                See seller preparation, logistics movement, escrow protection, and delivery confirmation in one workspace.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/products"
                className="inline-flex items-center gap-2 rounded-lg bg-[#F97316] px-4 py-2 text-sm font-semibold text-white hover:bg-[#EA580C]"
              >
                <FaSearch />
                Browse products
              </Link>
              <Link
                to="/buyer/orders"
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
              >
                <FaBoxOpen />
                View orders
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile icon={FaClock} label="Awaiting payment" value={stats.awaiting} detail="Needs buyer action" />
          <StatTile icon={FaTruck} label="Active shipments" value={stats.active} detail="Seller or logistics is moving" tone="blue" />
          <StatTile icon={FaCheckCircle} label="Delivered" value={stats.delivered} detail="Completed purchases" tone="green" />
          <StatTile icon={FaShieldAlt} label="Tracked spend" value={formatCurrency(stats.totalSpent)} detail="Recent buyer orders" tone="slate" />
        </section>

        <LiveLogisticsMapPanel
          trip={liveTracking?.logistics || liveTrackingOrder?.logistics}
          tracking={liveTracking}
          order={liveTrackingOrder || activeTrackingOrder}
          title="Live Product Movement"
          subtitle="Track the logistics driver moving your product from seller pickup to buyer delivery."
          onRefresh={() => loadLiveTracking()}
          refreshing={liveLoading}
          trackingHref={activeTrackingOrder?.id ? `/buyer/orders/${activeTrackingOrder.id}/track` : ''}
          emptyText="Live GPS appears here after logistics starts sharing location for your order."
        />

        <SharedGroupTripPanel
          title="Kenya Buyer Shared Logistics"
          description="Select an open group trip started by a seller, enter your cargo weight, and join the shared truck route."
          showWorkflowGuide={false}
          joinOnly
        />

        <section className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
          <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-5 py-4">
              <div>
                <h3 className="font-semibold text-gray-950">Recent orders</h3>
                <p className="text-sm text-gray-500">Latest buyer activity</p>
              </div>
              <Link to="/buyer/orders" className="text-sm font-semibold text-[#F97316]">Open all</Link>
            </div>

            {loading ? (
              <div className="space-y-3 p-5">
                {Array.from({ length: 3 }).map((_, idx) => (
                  <div key={idx} className="h-16 rounded-lg bg-gray-100 skeleton-shimmer" />
                ))}
              </div>
            ) : orders.length ? (
              <div className="divide-y divide-gray-100">
                {orders.slice(0, 5).map((order) => (
                  <div key={order.id} className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <p className="font-mono text-sm font-semibold text-gray-900">#{String(order.id).slice(-8)}</p>
                      <p className="mt-1 truncate text-sm text-gray-600">
                        {order.items?.[0]?.name || 'Order item'} {order.items?.length > 1 ? `+ ${order.items.length - 1} more` : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold capitalize text-gray-700">
                        {String(order.status).replace(/_/g, ' ')}
                      </span>
                      <span className="font-semibold text-green-700">{formatCurrency(order.total)}</span>
                      <Link
                        to={`/buyer/orders/${order.id}/track`}
                        className="inline-flex items-center gap-2 rounded-lg border border-[#F97316]/30 px-3 py-2 text-sm font-semibold text-[#F97316] hover:bg-[#FFF7ED]"
                      >
                        <FaTruck />
                        Track
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center">
                <FaShoppingCart className="mx-auto text-3xl text-[#F97316]" />
                <h3 className="mt-3 font-semibold text-gray-950">No orders yet</h3>
                <p className="mt-1 text-sm text-gray-500">Start with trusted sellers in the market.</p>
                <Link to="/products" className="mt-4 inline-flex rounded-lg bg-[#F97316] px-4 py-2 text-sm font-semibold text-white">
                  Browse products
                </Link>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="font-semibold text-gray-950">Next best action</h3>
              {latestOrder ? (
                <>
                  <p className="mt-2 text-sm text-gray-600">
                    Order #{String(latestOrder.id).slice(-8)} is currently {String(latestOrder.status).replace(/_/g, ' ')}.
                  </p>
                  <Link
                    to={`/buyer/orders/${latestOrder.id}/track`}
                    className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#0B2D55] px-4 py-2 text-sm font-semibold text-white hover:bg-[#123B6D]"
                  >
                    <FaTruck />
                    Open tracking
                  </Link>
                </>
              ) : (
                <p className="mt-2 text-sm text-gray-600">Your order timeline will appear here after checkout.</p>
              )}
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="font-semibold text-gray-950">Buyer shortcuts</h3>
              <div className="mt-4 grid gap-3">
                <Link to="/buyer/sellers" className="flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-3 text-sm font-semibold text-gray-800 hover:bg-gray-50">
                  <FaStore className="text-[#F97316]" />
                  My sellers
                </Link>
                <Link to="/buyer/reviews" className="flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-3 text-sm font-semibold text-gray-800 hover:bg-gray-50">
                  <FaStar className="text-[#F97316]" />
                  Reviews
                </Link>
                <Link to="/buyer/product-alerts" className="flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-3 text-sm font-semibold text-gray-800 hover:bg-gray-50">
                  <FaBell className="text-[#F97316]" />
                  Product alerts
                </Link>
                <Link to="/cart" className="flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-3 text-sm font-semibold text-gray-800 hover:bg-gray-50">
                  <FaShoppingCart className="text-[#F97316]" />
                  Review cart
                </Link>
                <Link to="/buyer/wishlist" className="flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-3 text-sm font-semibold text-gray-800 hover:bg-gray-50">
                  <FaHeart className="text-[#F97316]" />
                  Saved products
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default BuyerDashboard;
