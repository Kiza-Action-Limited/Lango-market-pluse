import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  FaBox,
  FaCheckCircle,
  FaClock,
  FaDownload,
  FaEye,
  FaFilter,
  FaMapMarkerAlt,
  FaMoneyBillWave,
  FaSearch,
  FaShieldAlt,
  FaSyncAlt,
  FaTruck,
  FaUser,
} from 'react-icons/fa';
import api from '../config/axios';
import { formatCurrency } from '../utils/formatters';

const statusOptions = [
  ['all', 'All statuses'],
  ['AWAITING_PAYMENT', 'Awaiting payment'],
  ['FUNDS_HELD', 'Funds held'],
  ['processing', 'Processing'],
  ['IN_TRANSIT', 'In transit'],
  ['DELIVERED', 'Delivered'],
  ['RELEASED', 'Released'],
  ['DISPUTED', 'Disputed'],
  ['REFUNDED', 'Refunded'],
  ['cancelled', 'Cancelled'],
];

const updateStatusOptions = statusOptions.filter(([value]) => value !== 'all');

const paymentStatusOptions = [
  ['all', 'All payments'],
  ['pending', 'Pending'],
  ['paid', 'Paid'],
  ['completed', 'Completed'],
  ['failed', 'Failed'],
  ['refunded', 'Refunded'],
];

const normalizeStatus = (status) => String(status || 'pending')
  .replace(/_/g, ' ')
  .toLowerCase()
  .replace(/\b\w/g, (letter) => letter.toUpperCase());

const getUserName = (user) => (
  user?.businessName ||
  user?.fullName ||
  user?.name ||
  user?.email ||
  'Unknown'
);

const getOrderId = (order) => order?._id || order?.id;

const formatCompactDateTime = (date) => {
  if (!date) return '-';
  return new Date(date).toLocaleString('en-KE', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getInitials = (name = '') => {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return parts.slice(0, 2).map((part) => part[0]).join('').toUpperCase();
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

const getStatusTone = (status) => {
  const value = String(status || '').toLowerCase();
  if (['released', 'completed', 'delivered'].includes(value)) return 'border-green-200 bg-green-50 text-green-700';
  if (['funds_held', 'payment_escrowed', 'processing'].includes(value)) return 'border-blue-200 bg-blue-50 text-blue-700';
  if (['in_transit', 'dispatched'].includes(value)) return 'border-cyan-200 bg-cyan-50 text-cyan-700';
  if (['awaiting_payment', 'pending_payment'].includes(value)) return 'border-amber-200 bg-amber-50 text-amber-700';
  if (['disputed', 'refunded', 'cancelled', 'expired'].includes(value)) return 'border-red-200 bg-red-50 text-red-700';
  return 'border-gray-200 bg-gray-100 text-gray-700';
};

const StatCard = ({ icon: Icon, label, value, detail, color = '#F97316' }) => (
  <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
    <div className="flex items-center justify-between gap-3">
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-gray-50" style={{ color }}>
        <Icon />
      </span>
      <p className="text-2xl font-bold text-gray-950">{value}</p>
    </div>
    <p className="mt-3 text-xs font-semibold uppercase text-gray-500">{label}</p>
    {detail && <p className="mt-1 text-sm text-gray-600">{detail}</p>}
  </div>
);

const AdminOrders = () => {
  const [orders, setOrders] = useState([]);
  const [summary, setSummary] = useState({});
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [updatingOrderId, setUpdatingOrderId] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    paymentStatus: 'all',
    startDate: '',
    endDate: '',
  });

  const fetchOrders = async ({ page = 1, silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const response = await api.get('/v1/admin/orders', {
        params: {
          page,
          limit: pagination.limit || 25,
          status: filters.status,
          paymentStatus: filters.paymentStatus,
          startDate: filters.startDate || undefined,
          endDate: filters.endDate || undefined,
          search: filters.search.trim() || undefined,
        },
      });
      setOrders(Array.isArray(response.data.orders) ? response.data.orders : []);
      setSummary(response.data.summary || {});
      setPagination(response.data.pagination || { page, limit: pagination.limit || 25, total: 0, pages: 1 });
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast.error(error.response?.data?.message || 'Failed to load orders');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => fetchOrders({ page: 1 }), 250);
    return () => window.clearTimeout(timer);
  }, [filters.search, filters.status, filters.paymentStatus, filters.startDate, filters.endDate]);

  const updateOrderStatus = async (orderId, status) => {
    setUpdatingOrderId(orderId);
    try {
      const response = await api.put(`/v1/admin/orders/${orderId}/status`, { status });
      toast.success(response.data?.message || 'Order status updated');
      await fetchOrders({ page: pagination.page || 1, silent: true });
      setSelectedOrder((current) => (
        String(getOrderId(current)) === String(orderId)
          ? { ...current, status }
          : current
      ));
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update order status');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const orderStats = useMemo(() => ({
    totalOrders: summary.totalOrders || pagination.total || 0,
    totalRevenue: summary.totalRevenue || 0,
    totalOrderValue: summary.totalOrderValue || 0,
    averageOrderValue: summary.averageOrderValue || 0,
    awaitingPayment: summary.awaitingPayment || 0,
    processing: summary.processing || 0,
    inTransit: summary.inTransit || 0,
    delivered: summary.delivered || 0,
    disputed: summary.disputed || 0,
    cancelled: summary.cancelled || 0,
  }), [summary, pagination.total]);

  const exportOrders = () => {
    const headers = ['Order', 'Buyer', 'Seller', 'Product', 'Logistics', 'Status', 'Payment', 'Total', 'Date'];
    const rows = orders.map((order) => {
      const provider = getLogisticsPreference(order);
      return [
        order.orderNumber || getOrderId(order),
        order.buyerName || getUserName(order.buyer),
        order.sellerName || getUserName(order.seller),
        order.productName,
        provider.name || 'Seller preferred',
        order.status,
        order.paymentStatus,
        order.total || order.totalAmount || 0,
        order.createdAt ? new Date(order.createdAt).toISOString() : '',
      ];
    });
    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `admin_orders_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };
  const selectedOrderProvider = getLogisticsPreference(selectedOrder || {});

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="mx-auto max-w-screen-2xl space-y-6">
        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-[#F97316]">Admin orders</p>
              <h1 className="mt-2 text-2xl font-bold text-gray-950">Professional order operations</h1>
              <p className="mt-1 text-sm text-gray-600">
                Manage buyer orders, escrow status, seller fulfillment, logistics movement, and delivery outcomes.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => fetchOrders({ page: pagination.page || 1 })}
                disabled={loading}
                className="inline-flex h-10 items-center gap-2 rounded-md border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                <FaSyncAlt className={loading ? 'animate-spin' : ''} />
                Refresh
              </button>
              <button
                type="button"
                onClick={exportOrders}
                className="inline-flex h-10 items-center gap-2 rounded-md bg-[#111827] px-4 text-sm font-semibold text-white hover:bg-[#374151]"
              >
                <FaDownload />
                Export CSV
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <StatCard icon={FaBox} label="Orders" value={Number(orderStats.totalOrders).toLocaleString('en-KE')} detail={`${pagination.total || 0} filtered`} />
          <StatCard icon={FaMoneyBillWave} label="Revenue" value={formatCurrency(orderStats.totalRevenue)} detail={`${formatCurrency(orderStats.averageOrderValue)} AOV`} color="#16A34A" />
          <StatCard icon={FaClock} label="Awaiting payment" value={orderStats.awaitingPayment} detail="Buyer action needed" color="#F59E0B" />
          <StatCard icon={FaShieldAlt} label="Escrow processing" value={orderStats.processing} detail="Funds held or preparing" color="#3B82F6" />
          <StatCard icon={FaTruck} label="In transit" value={orderStats.inTransit} detail="Moving with logistics" color="#06B6D4" />
          <StatCard icon={FaCheckCircle} label="Delivered" value={orderStats.delivered} detail={`${orderStats.disputed} disputed`} color="#16A34A" />
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <form
            className="grid gap-3 lg:grid-cols-[1fr_190px_190px_160px_160px_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              fetchOrders({ page: 1 });
            }}
          >
            <div className="relative">
              <FaSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={filters.search}
                onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                placeholder="Search order number or order ID..."
                className="h-10 w-full rounded-md border border-gray-200 bg-white pl-10 pr-3 text-sm outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20"
              />
            </div>
            <select
              value={filters.status}
              onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
              className="h-10 rounded-md border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 outline-none focus:border-[#F97316]"
            >
              {statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <select
              value={filters.paymentStatus}
              onChange={(event) => setFilters((current) => ({ ...current, paymentStatus: event.target.value }))}
              className="h-10 rounded-md border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 outline-none focus:border-[#F97316]"
            >
              {paymentStatusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <input
              type="date"
              value={filters.startDate}
              onChange={(event) => setFilters((current) => ({ ...current, startDate: event.target.value }))}
              className="h-10 rounded-md border border-gray-200 bg-white px-3 text-sm outline-none focus:border-[#F97316]"
            />
            <input
              type="date"
              value={filters.endDate}
              onChange={(event) => setFilters((current) => ({ ...current, endDate: event.target.value }))}
              className="h-10 rounded-md border border-gray-200 bg-white px-3 text-sm outline-none focus:border-[#F97316]"
            />
            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#F97316] px-4 text-sm font-semibold text-white hover:bg-[#EA580C] disabled:opacity-60"
            >
              <FaFilter />
              Apply
            </button>
          </form>
        </section>

        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-col gap-1 border-b border-gray-100 bg-linear-to-r from-white to-orange-50/70 px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-950">Order Queue</h2>
              <p className="mt-1 text-sm text-gray-500">Review participants, payment, escrow, logistics, and fulfillment state.</p>
            </div>
            <span className="inline-flex w-fit rounded-full border border-orange-100 bg-white px-3 py-1 text-xs font-semibold uppercase text-[#C2410C]">
              {pagination.total || 0} orders
            </span>
          </div>

          {loading ? (
            <div className="space-y-3 p-5">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-20 rounded-lg bg-gray-100 skeleton-shimmer" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto bg-gray-50/80 p-3">
              <div className="min-w-[1120px] space-y-2">
                <div className="grid grid-cols-[150px_190px_200px_180px_120px_155px_190px_120px_84px] gap-3 px-3 text-xs font-bold uppercase text-gray-500">
                  <span>Order</span>
                  <span>Buyer</span>
                  <span>Seller</span>
                  <span>Product</span>
                  <span>Payment</span>
                  <span>Status</span>
                  <span>Logistics</span>
                  <span>Total</span>
                  <span className="text-right">Actions</span>
                </div>

                {orders.map((order) => {
                  const orderId = getOrderId(order);
                  const logistics = order.logistics || {};
                  const provider = getLogisticsPreference(order);
                  const buyerName = order.buyerName || getUserName(order.buyer);
                  const sellerName = order.sellerName || getUserName(order.seller);

                  return (
                    <article
                      key={orderId}
                      className="grid grid-cols-[150px_190px_200px_180px_120px_155px_190px_120px_84px] items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-3 shadow-sm transition hover:border-orange-200 hover:bg-orange-50/40 hover:shadow-md"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-mono text-sm font-bold text-gray-950">{order.orderNumber || `#${String(orderId).slice(-8)}`}</p>
                        <p className="mt-0.5 text-xs text-gray-500">{formatCompactDateTime(order.createdAt)}</p>
                      </div>

                      <div className="flex min-w-0 items-center gap-2">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-xs font-bold text-gray-600">
                          {getInitials(buyerName)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-semibold leading-5 text-gray-900">{buyerName}</p>
                          <p className="truncate text-xs text-gray-500">{order.buyer?.phone || order.buyer?.email || '-'}</p>
                        </div>
                      </div>

                      <div className="flex min-w-0 items-center gap-2">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#FFF7ED] text-xs font-bold text-[#C2410C]">
                          {getInitials(sellerName)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-semibold leading-5 text-gray-900">{sellerName}</p>
                          <p className="truncate text-xs text-gray-500">{order.seller?.phone || order.seller?.email || '-'}</p>
                        </div>
                      </div>

                      <div className="min-w-0">
                        <p className="truncate font-semibold text-gray-900">{order.productName}</p>
                        <p className="mt-0.5 truncate text-xs text-gray-500">
                          Qty {order.quantity || order.items?.[0]?.quantity || 0} | {normalizeStatus(order.productCategory)}
                        </p>
                      </div>

                      <span className={`inline-flex w-fit rounded-full border px-2.5 py-1 text-xs font-semibold ${getStatusTone(order.paymentStatus)}`}>
                        {normalizeStatus(order.paymentStatus)}
                      </span>

                      <select
                        value={order.status}
                        onChange={(event) => updateOrderStatus(orderId, event.target.value)}
                        disabled={updatingOrderId === orderId}
                        className={`h-8 max-w-[150px] rounded-md border px-2 text-xs font-semibold outline-none disabled:opacity-60 ${getStatusTone(order.status)}`}
                      >
                        {updateStatusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>

                      <div className="min-w-0">
                        {logistics?._id ? (
                          <>
                            <span className={`inline-flex w-fit rounded-full border px-2.5 py-1 text-xs font-semibold ${getStatusTone(logistics.status)}`}>
                              {normalizeStatus(logistics.status)}
                            </span>
                            <p className="mt-1 truncate font-mono text-xs text-gray-500">{logistics.trackingNumber || logistics.tripId || 'Tracking pending'}</p>
                            <p className="mt-0.5 truncate text-xs font-semibold text-sky-700">{provider.name || 'Seller preferred'}</p>
                          </>
                        ) : (
                          <>
                            <span className="inline-flex w-fit rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-semibold text-gray-600">No logistics</span>
                            <p className="mt-1 truncate text-xs font-semibold text-sky-700">{provider.name || 'Seller preferred'}</p>
                          </>
                        )}
                      </div>

                      <div className="min-w-0">
                        <p className="truncate font-bold text-green-700">{formatCurrency(order.total || order.totalAmount || 0)}</p>
                        <p className="mt-0.5 truncate text-xs text-gray-500">Unit {formatCurrency(order.unitPrice || order.items?.[0]?.price || 0)}</p>
                      </div>

                      <div className="text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedOrder(order)}
                          className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-[#F97316]/30 bg-white px-3 text-xs font-semibold text-[#F97316] hover:bg-[#FFF7ED]"
                        >
                          <FaEye />
                          Details
                        </button>
                      </div>
                    </article>
                  );
                })}

              {!orders.length && (
                <div className="p-10 text-center">
                  <FaBox className="mx-auto text-4xl text-[#F97316]" />
                  <h3 className="mt-3 font-semibold text-gray-950">No orders found</h3>
                  <p className="mt-1 text-sm text-gray-500">Try another status, payment filter, date range, or search.</p>
                </div>
              )}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3 border-t border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-500">
              Page <span className="font-semibold text-gray-950">{pagination.page || 1}</span> of <span className="font-semibold text-gray-950">{pagination.pages || 1}</span>
              {' '}({pagination.total || 0} orders)
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={loading || (pagination.page || 1) <= 1}
                onClick={() => fetchOrders({ page: (pagination.page || 1) - 1 })}
                className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={loading || (pagination.page || 1) >= (pagination.pages || 1)}
                onClick={() => fetchOrders({ page: (pagination.page || 1) + 1 })}
                className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </section>
      </div>

      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-lg bg-white shadow-xl">
            <div className="sticky top-0 z-10 flex items-start justify-between border-b border-gray-200 bg-white p-5">
              <div>
                <p className="text-xs font-semibold uppercase text-[#F97316]">Order details</p>
                <h2 className="mt-1 text-xl font-bold text-gray-950">{selectedOrder.orderNumber || `#${String(getOrderId(selectedOrder)).slice(-8)}`}</h2>
                <p className="mt-1 text-sm text-gray-500">{selectedOrder.createdAt ? new Date(selectedOrder.createdAt).toLocaleString() : '-'}</p>
              </div>
              <button type="button" onClick={() => setSelectedOrder(null)} className="rounded-md border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                Close
              </button>
            </div>

            <div className="space-y-5 p-5">
              <div className="grid gap-4 md:grid-cols-4">
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <p className="text-xs font-semibold uppercase text-gray-500">Status</p>
                  <span className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getStatusTone(selectedOrder.status)}`}>
                    {normalizeStatus(selectedOrder.status)}
                  </span>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <p className="text-xs font-semibold uppercase text-gray-500">Payment</p>
                  <p className="mt-2 font-semibold text-gray-950">{normalizeStatus(selectedOrder.paymentStatus)}</p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <p className="text-xs font-semibold uppercase text-gray-500">Order value</p>
                  <p className="mt-2 font-semibold text-green-700">{formatCurrency(selectedOrder.total || selectedOrder.totalAmount || 0)}</p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <p className="text-xs font-semibold uppercase text-gray-500">Estimated delivery</p>
                  <p className="mt-2 font-semibold text-gray-950">{selectedOrder.estimatedDelivery ? new Date(selectedOrder.estimatedDelivery).toLocaleDateString() : 'Pending'}</p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-gray-200 p-4">
                  <h3 className="flex items-center gap-2 font-semibold text-gray-950"><FaUser className="text-[#F97316]" /> Buyer</h3>
                  <p className="mt-3 font-semibold text-gray-900">{selectedOrder.buyerName || getUserName(selectedOrder.buyer)}</p>
                  <p className="text-sm text-gray-500">{selectedOrder.buyer?.phone || '-'}</p>
                  <p className="text-sm text-gray-500">{selectedOrder.buyer?.email || '-'}</p>
                </div>
                <div className="rounded-lg border border-gray-200 p-4">
                  <h3 className="flex items-center gap-2 font-semibold text-gray-950"><FaUser className="text-[#F97316]" /> Seller</h3>
                  <p className="mt-3 font-semibold text-gray-900">{selectedOrder.sellerName || getUserName(selectedOrder.seller)}</p>
                  <p className="text-sm text-gray-500">{selectedOrder.seller?.phone || '-'}</p>
                  <p className="text-sm text-gray-500">{selectedOrder.seller?.email || '-'}</p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-gray-200 p-4">
                  <h3 className="flex items-center gap-2 font-semibold text-gray-950"><FaBox className="text-[#F97316]" /> Product</h3>
                  {(selectedOrder.items || []).map((item) => (
                    <div key={item.id || item.name} className="mt-3 flex items-center justify-between gap-3 rounded-md bg-gray-50 p-3">
                      <div>
                        <p className="font-semibold text-gray-950">{item.name || selectedOrder.productName}</p>
                        <p className="text-sm text-gray-500">Qty {item.quantity} x {formatCurrency(item.price || 0)}</p>
                      </div>
                      <p className="font-semibold text-green-700">{formatCurrency((item.quantity || 0) * (item.price || 0))}</p>
                    </div>
                  ))}
                </div>
                <div className="rounded-lg border border-gray-200 p-4">
                  <h3 className="flex items-center gap-2 font-semibold text-gray-950"><FaTruck className="text-[#F97316]" /> Logistics</h3>
                  <div className="mt-3 rounded-md border border-sky-100 bg-sky-50 p-3 text-sm text-sky-900">
                    <p className="font-semibold">
                      {selectedOrderProvider.source === 'buyer' ? 'Buyer selected' : 'Preferred transport'}: {selectedOrderProvider.name || 'Seller preferred provider'}
                    </p>
                    <p className="mt-1 text-xs text-sky-700">
                      {[selectedOrderProvider.phone, selectedOrderProvider.hub].filter(Boolean).join(' - ') || 'Provider details will appear when assigned.'}
                    </p>
                  </div>
                  {selectedOrder.logistics?._id ? (
                    <div className="mt-3 space-y-2 text-sm text-gray-600">
                      <p><span className="font-semibold text-gray-950">Trip:</span> {selectedOrder.logistics.tripId || selectedOrder.logistics.bookingReference || '-'}</p>
                      <p><span className="font-semibold text-gray-950">Status:</span> {normalizeStatus(selectedOrder.logistics.status)}</p>
                      <p><span className="font-semibold text-gray-950">Tracking:</span> {selectedOrder.logistics.trackingNumber || '-'}</p>
                      <p><span className="font-semibold text-gray-950">Driver:</span> {selectedOrder.logistics.driverName || '-'} {selectedOrder.logistics.driverPhone ? `(${selectedOrder.logistics.driverPhone})` : ''}</p>
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-gray-500">No logistics record has been created for this order yet.</p>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 p-4">
                <h3 className="flex items-center gap-2 font-semibold text-gray-950"><FaMapMarkerAlt className="text-[#F97316]" /> Delivery address</h3>
                <p className="mt-3 text-sm text-gray-600">
                  {selectedOrder.deliveryAddressText ||
                    [selectedOrder.deliveryAddress?.label, selectedOrder.deliveryAddress?.town, selectedOrder.deliveryAddress?.county, selectedOrder.deliveryAddress?.country]
                      .filter(Boolean)
                      .join(', ') ||
                    'No delivery address saved'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminOrders;
