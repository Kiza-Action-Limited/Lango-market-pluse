// src/pages/SellerOrders.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FaBoxOpen,
  FaCheckCircle,
  FaClipboardCheck,
  FaClock,
  FaExclamationTriangle,
  FaMapMarkerAlt,
  FaMoneyBillWave,
  FaQrcode,
  FaRoute,
  FaShippingFast,
  FaShieldAlt,
  FaSpinner,
  FaTruck,
  FaUserCheck,
  FaUserTie,
} from 'react-icons/fa';
import toast from 'react-hot-toast';
import { formatCurrency } from '../utils/formatters';
import { orderService } from '../services/orderService';
import { logisticsService } from '../services/logisticsService';
import LiveLogisticsMapPanel from '../components/logistics/LiveLogisticsMapPanel';
import { QrAuditTrail, QrTokenStatus } from '../components/logistics/QrHandshakePanel';

const getOrderId = (order) => order.id || order._id;
const getLogisticsId = (logistics) => logistics?.id || logistics?._id;
const paidStatuses = new Set(['payment_escrowed', 'processing', 'dispatched', 'FUNDS_HELD', 'IN_TRANSIT', 'DELIVERED']);
const closedStatuses = new Set(['delivered', 'completed', 'cancelled', 'DELIVERED', 'RELEASED', 'REFUNDED']);

const ORDER_STATUS_META = {
  pending_payment: { canonical: 'AWAITING_PAYMENT', label: 'Awaiting payment' },
  AWAITING_PAYMENT: { canonical: 'AWAITING_PAYMENT', label: 'Awaiting payment' },
  payment_escrowed: { canonical: 'HELD', label: 'Funds held' },
  FUNDS_HELD: { canonical: 'HELD', label: 'Funds held' },
  processing: { canonical: 'PROCESSING', label: 'Processing' },
  dispatched: { canonical: 'IN_TRANSIT', label: 'In transit' },
  IN_TRANSIT: { canonical: 'IN_TRANSIT', label: 'In transit' },
  delivered: { canonical: 'DELIVERED', label: 'Delivered' },
  DELIVERED: { canonical: 'DELIVERED', label: 'Delivered' },
  completed: { canonical: 'RELEASED', label: 'Completed' },
  RELEASED: { canonical: 'RELEASED', label: 'Released' },
  cancelled: { canonical: 'CANCELLED', label: 'Cancelled' },
  disputed: { canonical: 'DISPUTED', label: 'Disputed' },
  DISPUTED: { canonical: 'DISPUTED', label: 'Disputed' },
  REFUNDED: { canonical: 'REFUNDED', label: 'Refunded' },
  PARTIAL_REFUND: { canonical: 'PARTIAL_REFUND', label: 'Partial refund' },
  EXPIRED: { canonical: 'EXPIRED', label: 'Expired' },
};

const ORDER_TRANSITIONS = {
  pending_payment: [{ value: 'cancelled', label: 'Cancel' }],
  AWAITING_PAYMENT: [{ value: 'cancelled', label: 'Cancel' }],
  payment_escrowed: [
    { value: 'processing', label: 'Processing' },
    { value: 'cancelled', label: 'Cancel' },
  ],
  FUNDS_HELD: [
    { value: 'IN_TRANSIT', label: 'Mark in transit' },
    { value: 'dispute', label: 'Open dispute/freeze' },
    { value: 'cancelled', label: 'Cancel' },
  ],
  processing: [
    { value: 'dispatched', label: 'Dispatch' },
    { value: 'cancelled', label: 'Cancel' },
  ],
  dispatched: [{ value: 'delivered', label: 'Delivered' }],
  IN_TRANSIT: [
    { value: 'DELIVERED', label: 'Delivered' },
    { value: 'dispute', label: 'Open dispute/freeze' },
  ],
  DELIVERED: [{ value: 'dispute', label: 'Open dispute/freeze' }],
};

const statusMeta = (status) => ORDER_STATUS_META[status] || {
  canonical: String(status || 'unknown').toUpperCase(),
  label: String(status || 'Unknown').replaceAll('_', ' '),
};

const formatStatus = (status) => statusMeta(status).label;

const readMetadata = (source, key) => {
  const metadata = source?.metadata;
  if (!metadata) return undefined;
  if (typeof metadata.get === 'function') return metadata.get(key);
  return metadata[key];
};

const formatDateTime = (value) => {
  if (!value) return 'Pending';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Pending' : date.toLocaleString();
};

const hoursUntil = (value) => {
  if (!value) return null;
  const ms = new Date(value).getTime() - Date.now();
  if (!Number.isFinite(ms)) return null;
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60)));
};

const readAddress = (value, fallback = {}) => {
  if (value && typeof value === 'object') {
    return {
      label: value.label || value.street || value.address || fallback.label,
      county: value.county || fallback.county || 'Unknown',
      town: value.town || value.city || value.campus || fallback.town || 'Unknown',
      street: value.street || fallback.street,
      gpsLat: value.gpsLat || value.lat || fallback.gpsLat,
      gpsLng: value.gpsLng || value.lng || fallback.gpsLng,
    };
  }

  const label = String(value || fallback.label || '').trim();
  return {
    label: label || 'Delivery address pending',
    county: fallback.county || 'Unknown',
    town: fallback.town || label || 'Unknown',
    street: fallback.street,
    gpsLat: fallback.gpsLat,
    gpsLng: fallback.gpsLng,
  };
};

const buildShipmentPayload = (order) => {
  const product = order.product || {};
  const deliveryAddress = readAddress(order.deliveryAddress || order.shippingAddress, {
    town: order.buyer?.campus || order.customer?.campus || order.buyer?.city || 'Unknown',
  });
  const pickupAddress = readAddress(order.pickupAddress || product.pickupAddress, {
    label: product.locationHub || product.seller?.businessName || 'Seller pickup hub',
    town: product.locationHub || product.seller?.city || 'Seller hub',
    county: product.seller?.county || 'Unknown',
  });

  return {
    orderId: getOrderId(order),
    carrier: 'solo_owner_operator',
    cargoType: product.name || order.productName || 'Order cargo',
    weight: Number(order.weightKg || product.weightKg || order.quantity || 1),
    weightUnit: product.unit === 'g' ? 'g' : 'kg',
    pickupAddress,
    shippingAddress: deliveryAddress,
    isExpress: false,
    notes: `Created from seller order ${String(getOrderId(order)).slice(-8)}`,
  };
};

const statusTone = (status) => {
  switch (statusMeta(status).canonical) {
    case 'AWAITING_PAYMENT':
      return 'bg-yellow-100 text-yellow-800';
    case 'HELD':
    case 'PROCESSING':
      return 'bg-blue-100 text-blue-800';
    case 'IN_TRANSIT':
      return 'bg-purple-100 text-purple-800';
    case 'DELIVERED':
    case 'RELEASED':
      return 'bg-green-100 text-green-800';
    case 'CANCELLED':
    case 'DISPUTED':
    case 'REFUNDED':
    case 'PARTIAL_REFUND':
    case 'EXPIRED':
      return 'bg-red-100 text-red-800';
    default:
      break;
  }

  switch (status) {
    case 'pending':
    case 'pending_payment':
    case 'AWAITING_PAYMENT':
      return 'bg-yellow-100 text-yellow-800';
    case 'processing':
    case 'payment_escrowed':
    case 'FUNDS_HELD':
    case 'driver_assigned':
    case 'en_route_to_pickup':
      return 'bg-blue-100 text-blue-800';
    case 'shipped':
    case 'dispatched':
    case 'IN_TRANSIT':
    case 'picked_up':
    case 'in_transit':
    case 'out_for_delivery':
      return 'bg-purple-100 text-purple-800';
    case 'delivered':
    case 'completed':
    case 'DELIVERED':
    case 'auto_released':
      return 'bg-green-100 text-green-800';
    case 'cancelled':
    case 'failed':
    case 'disputed':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const buildTimeline = (order, logistics, escrow) => {
  const entries = [
    { label: 'Order created', status: 'created', time: order.createdAt, detail: 'Buyer placed the order' },
    { label: 'Payment held', status: escrow?.escrowStatus || order.status, time: order.paidAt || escrow?.paidAt, detail: 'M-Pesa payment secured in escrow' },
  ];

  (order.timeline || []).forEach((item) => {
    entries.push({
      label: formatStatus(item.status),
      status: item.status,
      time: item.timestamp,
      detail: item.note || 'Order status changed',
    });
  });

  (logistics?.trackingHistory || []).forEach((item) => {
    entries.push({
      label: formatStatus(item.status),
      status: item.status,
      time: item.timestamp,
      detail: item.notes || item.location || 'Shipment update',
    });
  });

  (logistics?.qrScans || []).forEach((scan) => {
    entries.push({
      label: `${scan.step === 'pickup' ? 'Pickup' : 'Delivery'} QR scanned`,
      status: scan.step,
      time: scan.scannedAt,
      detail: scan.verified ? 'GPS/QR handoff verified' : 'QR scan recorded',
    });
  });

  if (logistics?.actualDelivery || order.deliveredAt) {
    entries.push({
      label: 'Proof of delivery',
      status: 'delivered',
      time: logistics?.actualDelivery || order.deliveredAt,
      detail: 'Delivery confirmation recorded',
    });
  }

  return entries
    .filter((entry) => entry.time)
    .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
};

const OrderTimelinePanel = ({ order, logistics, escrow }) => {
  const timeline = buildTimeline(order, logistics, escrow);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-2 font-semibold text-[#111827]">
        <FaRoute className="text-[#F97316]" />
        Seller order timeline
      </div>
      {timeline.length ? (
        <div className="space-y-3">
          {timeline.map((entry, index) => (
            <div key={`${entry.label}-${entry.time}-${index}`} className="flex gap-3">
              <div className="mt-1 flex flex-col items-center">
                <span className={`h-3 w-3 rounded-full ${index === timeline.length - 1 ? 'bg-[#F97316]' : 'bg-[#16A34A]'}`} />
                {index < timeline.length - 1 && <span className="h-full min-h-8 w-px bg-gray-200" />}
              </div>
              <div className="min-w-0 pb-2">
                <p className="text-sm font-semibold text-[#111827]">{entry.label}</p>
                <p className="text-xs text-gray-500">{formatDateTime(entry.time)}</p>
                <p className="mt-1 text-xs text-gray-600">{entry.detail}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-500">Timeline starts once payment or logistics activity is recorded.</p>
      )}
    </div>
  );
};

const EscrowPanel = ({ order, escrow, logistics }) => {
  const releaseDate = escrow?.expectedReleaseDate || logistics?.escrowReleaseDue || order.escrowReleaseDate;
  const freezeHours = hoursUntil(releaseDate);
  const escrowStatus = escrow?.escrowStatus || statusMeta(order.status).canonical;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-2 font-semibold text-[#111827]">
        <FaShieldAlt className="text-[#16A34A]" />
        Escrow & dispute window
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-md bg-gray-50 p-3">
          <p className="text-xs font-semibold uppercase text-gray-500">Escrow status</p>
          <p className="mt-1 text-sm font-semibold text-[#111827]">{formatStatus(escrowStatus)}</p>
        </div>
        <div className="rounded-md bg-gray-50 p-3">
          <p className="text-xs font-semibold uppercase text-gray-500">Held amount</p>
          <p className="mt-1 text-sm font-semibold text-[#111827]">{formatCurrency(escrow?.escrowAmount || order.totalAmount)}</p>
        </div>
        <div className="rounded-md bg-gray-50 p-3">
          <p className="text-xs font-semibold uppercase text-gray-500">Dispute freeze</p>
          <p className="mt-1 text-sm font-semibold text-[#111827]">
            {freezeHours === null ? 'Starts after delivery' : freezeHours > 0 ? `${freezeHours}h remaining` : 'Window elapsed'}
          </p>
        </div>
      </div>
      {['DISPUTED', 'disputed'].includes(order.status) && (
        <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <FaExclamationTriangle className="mr-2 inline" />
          Escrow is frozen while the dispute is under review.
        </div>
      )}
    </div>
  );
};

const PayoutPanel = ({ order, escrow, logistics }) => {
  const settlement = logistics?.settlement || {};
  const payouts = escrow?.payouts || [];
  const sellerPayout = settlement.sellerPayout || escrow?.sellerPayout || 0;
  const driverPayout = settlement.driverPayout || settlement.fleetOwnerPayout || escrow?.driverPayout || 0;
  const platformFee = settlement.platformFee || escrow?.platformFee || 0;
  const sinkingFund = settlement.sinkingFund || escrow?.sinkingFundAmount || 0;
  const payoutStatus = settlement.releasedAt || escrow?.escrowStatus === 'RELEASED' ? 'Released' : statusMeta(order.status).canonical === 'DELIVERED' ? 'Pending release' : 'Waiting for delivery';

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-2 font-semibold text-[#111827]">
        <FaMoneyBillWave className="text-[#16A34A]" />
        Payout status
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-md bg-gray-50 p-3">
          <p className="text-xs text-gray-500">Seller payout</p>
          <p className="font-semibold text-[#111827]">{sellerPayout ? formatCurrency(sellerPayout) : 'Pending'}</p>
        </div>
        <div className="rounded-md bg-gray-50 p-3">
          <p className="text-xs text-gray-500">Driver/fleet</p>
          <p className="font-semibold text-[#111827]">{driverPayout ? formatCurrency(driverPayout) : 'Pending'}</p>
        </div>
        <div className="rounded-md bg-gray-50 p-3">
          <p className="text-xs text-gray-500">Platform fee</p>
          <p className="font-semibold text-[#111827]">{platformFee ? formatCurrency(platformFee) : 'Pending'}</p>
        </div>
        <div className="rounded-md bg-gray-50 p-3">
          <p className="text-xs text-gray-500">Sinking fund</p>
          <p className="font-semibold text-[#111827]">{sinkingFund ? formatCurrency(sinkingFund) : 'Pending'}</p>
        </div>
      </div>
      <p className="mt-3 text-sm text-gray-600">Current payout state: <span className="font-semibold text-[#111827]">{payoutStatus}</span></p>
      {payouts.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {payouts.map((payout) => (
            <span key={payout._id || `${payout.role}-${payout.amount}`} className="rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-800">
              {payout.role}: {formatCurrency(payout.amount)} ({payout.status})
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

const ProofOfDeliveryPanel = ({ order, logistics }) => {
  const deliveryScan = logistics?.qrScans?.find((scan) => scan.step === 'delivery');
  const gps = deliveryScan?.gpsCoords || logistics?.gpsTracking?.current;
  const deliveredAt = logistics?.actualDelivery || order.deliveredAt;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-2 font-semibold text-[#111827]">
        <FaClipboardCheck className="text-[#16A34A]" />
        Proof of delivery
      </div>
      {deliveredAt || deliveryScan ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-md bg-green-50 p-3">
            <p className="text-xs font-semibold uppercase text-green-700">Delivered at</p>
            <p className="mt-1 text-sm font-semibold text-green-950">{formatDateTime(deliveredAt || deliveryScan?.scannedAt)}</p>
          </div>
          <div className="rounded-md bg-gray-50 p-3">
            <p className="text-xs font-semibold uppercase text-gray-500">Delivery QR</p>
            <p className="mt-1 text-sm font-semibold text-[#111827]">{deliveryScan?.verified ? 'Verified' : deliveryScan ? 'Scanned' : 'Pending'}</p>
          </div>
          <div className="rounded-md bg-gray-50 p-3">
            <p className="text-xs font-semibold uppercase text-gray-500">GPS proof</p>
            <p className="mt-1 text-sm font-semibold text-[#111827]">
              {gps?.lat && gps?.lng ? `${Number(gps.lat).toFixed(4)}, ${Number(gps.lng).toFixed(4)}` : 'Not captured'}
            </p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-500">Proof appears after final delivery QR scan or buyer delivery confirmation.</p>
      )}
    </div>
  );
};

const DriverAssignmentPanel = ({ logistics, providers, assigning, onAssignDriver }) => {
  const [driverId, setDriverId] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const nearestDrivers = Array.isArray(readMetadata(logistics, 'nearestDrivers'))
    ? readMetadata(logistics, 'nearestDrivers')
    : [];
  const providerOptions = [
    ...nearestDrivers.map((driver) => ({
      id: driver.driverId || driver.id,
      name: driver.name || 'Nearby driver',
      phone: driver.phone || '',
      detail: driver.distanceKm || driver.distance ? `${Number(driver.distanceKm || driver.distance).toFixed(1)}km away` : 'Nearby match',
    })),
    ...providers.map((provider) => ({
      id: provider.id || provider._id,
      name: provider.name || provider.fullName || provider.businessName || 'Verified provider',
      phone: provider.phone || '',
      detail: provider.hub || provider.vehiclePlate || 'Verified logistics provider',
    })),
  ].filter((driver, index, all) => driver.id && all.findIndex((item) => item.id === driver.id) === index);

  const submit = () => {
    if (driverId) {
      onAssignDriver({ driverId });
      return;
    }
    if (!driverName.trim() || !driverPhone.trim()) {
      toast.error('Choose a verified driver or enter driver name and phone');
      return;
    }
    onAssignDriver({ driverName: driverName.trim(), driverPhone: driverPhone.trim() });
  };

  return (
    <div className="mt-4 rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-2 font-semibold text-[#111827]">
        <FaUserCheck className="text-[#3B82F6]" />
        Driver assignment
      </div>

      {logistics.driverName || logistics.driver?.name ? (
        <div className="mb-3 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-950">
          Assigned to <span className="font-semibold">{logistics.driverName || logistics.driver?.name}</span>
          {(logistics.driverPhone || logistics.driver?.phone) ? ` (${logistics.driverPhone || logistics.driver?.phone})` : ''}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_1fr_auto]">
        <select
          value={driverId}
          onChange={(event) => setDriverId(event.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">Choose verified/nearby driver</option>
          {providerOptions.map((driver) => (
            <option key={driver.id} value={driver.id}>
              {driver.name} - {driver.detail}
            </option>
          ))}
        </select>
        <div className="grid grid-cols-2 gap-2">
          <input
            value={driverName}
            onChange={(event) => setDriverName(event.target.value)}
            placeholder="Manual driver name"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            value={driverPhone}
            onChange={(event) => setDriverPhone(event.target.value)}
            placeholder="Driver phone"
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={submit}
          disabled={assigning}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#111827] px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-60"
        >
          {assigning ? <FaSpinner className="animate-spin" /> : <FaUserCheck />}
          Assign
        </button>
      </div>
    </div>
  );
};

const QrHandoffPanel = ({ logistics, qrState, loading, onGenerate }) => {
  const activeTokens = qrState?.activeTokens || qrState?.availableTokens || [];
  const audit = qrState?.scanAudit || logistics?.qrScans || [];
  return (
    <div className="mt-4 rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-semibold text-[#111827]">
          <FaQrcode className="text-[#F97316]" />
          QR handoff control
        </div>
        <button
          type="button"
          onClick={onGenerate}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-[#F97316] px-3 py-2 text-xs font-semibold text-[#F97316] hover:bg-[#FFF7ED] disabled:opacity-60"
        >
          {loading ? <FaSpinner className="animate-spin" /> : <FaQrcode />}
          Generate tokens
        </button>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        Present the pickup QR to the assigned driver only. The delivery QR is confirmed by the buyer or driver at drop-off with GPS.
      </div>

      <div className="mt-3">
        <QrTokenStatus qrState={qrState} logistics={logistics} showImages />
      </div>

      {!activeTokens.length && !loading && (
        <p className="mt-3 rounded-md bg-gray-50 px-3 py-4 text-center text-sm text-gray-500">
          No active QR tokens. Generate fresh handoff tokens before pickup.
        </p>
      )}

      <div className="mt-3">
        <QrAuditTrail scans={audit} />
      </div>
    </div>
  );
};

const LogisticsPanel = ({
  order,
  logistics,
  escrow,
  qrState,
  providers,
  loading,
  creating,
  assigning,
  qrLoading,
  scanning,
  mapTracking,
  mapLoading,
  onCreate,
  onAssignDriver,
  onGenerateQr,
  onScanQr,
  onRefreshMap,
}) => {
  const status = String(order.status || '');
  const orderId = getOrderId(order);
  const canCreate = paidStatuses.has(status) && !closedStatuses.has(status);
  const nearestDrivers = Array.isArray(readMetadata(logistics, 'nearestDrivers'))
    ? readMetadata(logistics, 'nearestDrivers')
    : [];
  const pickupDone = Boolean(logistics?.pickupQrConfirmed || logistics?.qrScans?.some((scan) => scan.step === 'pickup'));
  const deliveryDone = Boolean(logistics?.deliveryQrConfirmed || logistics?.qrScans?.some((scan) => scan.step === 'delivery'));

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
        <FaSpinner className="mr-2 inline animate-spin text-[#F97316]" />
        Loading shipment status...
      </div>
    );
  }

  if (!logistics) {
    return (
      <div className="rounded-lg border border-dashed border-orange-200 bg-orange-50 p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 font-semibold text-[#111827]">
              <FaTruck className="text-[#F97316]" />
              Logistics not created
            </div>
            <p className="mt-1 text-sm text-gray-600">
              Create a shipment once payment is escrowed so drivers, QR handoff, tracking, and delivery status can attach to this order.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onCreate(order)}
            disabled={!canCreate || creating}
            title={!canCreate ? 'Create logistics after payment is escrowed.' : ''}
            className="inline-flex items-center gap-2 rounded-md bg-[#F97316] px-4 py-2 text-sm font-semibold text-white hover:bg-[#EA580C] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {creating ? <FaSpinner className="animate-spin" /> : <FaShippingFast />}
            {creating ? 'Creating...' : 'Create Shipment'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 font-semibold text-[#111827]">
            <FaTruck className="text-[#F97316]" />
            Shipment {logistics.trackingNumber || logistics.bookingReference || String(logistics._id).slice(-8)}
          </div>
          <p className="mt-1 text-sm text-gray-500">
            {logistics.pickupAddress?.town || 'Pickup'} to {logistics.shippingAddress?.town || 'Delivery'}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone(logistics.status)}`}>
          {formatStatus(logistics.status).toUpperCase()}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className="rounded-md bg-gray-50 p-3">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase text-gray-500"><FaUserTie /> Driver</p>
          <p className="mt-1 text-sm font-medium text-[#111827]">{logistics.driverName || logistics.driver?.name || 'Not assigned'}</p>
          <p className="text-xs text-gray-500">{logistics.driverPhone || logistics.driver?.phone || 'Waiting for assignment'}</p>
        </div>
        <div className="rounded-md bg-gray-50 p-3">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase text-gray-500"><FaMapMarkerAlt /> Route</p>
          <p className="mt-1 text-sm font-medium text-[#111827]">{readMetadata(logistics, 'distanceKm') ? `${Number(readMetadata(logistics, 'distanceKm')).toFixed(1)} km` : 'Distance pending'}</p>
          <p className="text-xs text-gray-500">{logistics.estimatedDelivery ? new Date(logistics.estimatedDelivery).toLocaleString() : 'ETA pending'}</p>
        </div>
        <div className="rounded-md bg-gray-50 p-3">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase text-gray-500"><FaQrcode /> QR Handoff</p>
          <p className="mt-1 text-sm font-medium text-[#111827]">{pickupDone ? 'Pickup scanned' : 'Pickup pending'}</p>
          <p className="text-xs text-gray-500">{deliveryDone ? 'Delivery scanned' : 'Delivery pending'}</p>
        </div>
        <div className="rounded-md bg-gray-50 p-3">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase text-gray-500"><FaClock /> Escrow</p>
          <p className="mt-1 text-sm font-medium text-[#111827]">{logistics.escrowReleaseDue ? 'Freeze window active' : 'Awaiting delivery'}</p>
          <p className="text-xs text-gray-500">{logistics.shippingCost ? `${formatCurrency(logistics.shippingCost)} logistics cost` : 'Cost pending'}</p>
        </div>
      </div>

      <div className={`mt-4 rounded-lg border p-4 ${deliveryDone ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className={`flex items-center gap-2 text-sm font-semibold ${deliveryDone ? 'text-green-800' : 'text-amber-800'}`}>
              <FaMapMarkerAlt />
              {deliveryDone ? 'Reached buyer' : 'Delivery not confirmed yet'}
            </p>
            <p className="mt-1 text-sm text-gray-600">
              {deliveryDone
                ? 'The buyer delivery QR/proof has been recorded for this shipment.'
                : 'Use live GPS below to watch the driver movement until the delivery QR is confirmed.'}
            </p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${deliveryDone ? 'bg-white text-green-700' : 'bg-white text-amber-700'}`}>
            {deliveryDone ? 'DELIVERED' : 'TRACKING'}
          </span>
        </div>
      </div>

      <LiveLogisticsMapPanel
        trip={logistics}
        tracking={mapTracking}
        order={order}
        title="Seller GPS Delivery Map"
        subtitle="Track the logistics driver from pickup until the shipment reaches the buyer."
        eyebrow="Seller live GPS"
        onRefresh={onRefreshMap}
        refreshing={mapLoading}
        trackingHref={orderId ? `/orders/${orderId}/track` : undefined}
        emptyText="Live GPS appears here after the logistics driver starts sharing location."
        className="mt-4"
      />

      {nearestDrivers.length > 0 && (
        <div className="mt-4 rounded-md border border-blue-100 bg-blue-50 p-3">
          <p className="text-sm font-semibold text-blue-900">Nearest available drivers</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {nearestDrivers.slice(0, 4).map((driver) => (
              <span key={driver.driverId || driver.name} className="rounded-full bg-white px-3 py-1 text-xs font-medium text-blue-900">
                {driver.name || 'Driver'} {driver.distance ? `- ${Number(driver.distance).toFixed(1)}km` : ''}
              </span>
            ))}
          </div>
        </div>
      )}

      <DriverAssignmentPanel
        logistics={logistics}
        providers={providers}
        assigning={assigning}
        onAssignDriver={onAssignDriver}
      />

      <QrHandoffPanel
        logistics={logistics}
        qrState={qrState}
        loading={qrLoading}
        scanning={scanning}
        onGenerate={onGenerateQr}
        onScan={onScanQr}
      />

      <div className="mt-4 grid grid-cols-1 gap-4 2xl:grid-cols-2">
        <OrderTimelinePanel order={order} logistics={logistics} escrow={escrow} />
        <EscrowPanel order={order} escrow={escrow} logistics={logistics} />
        <PayoutPanel order={order} escrow={escrow} logistics={logistics} />
        <ProofOfDeliveryPanel order={order} logistics={logistics} />
      </div>
    </div>
  );
};

const SellerOrders = () => {
  const [orders, setOrders] = useState([]);
  const [logisticsByOrder, setLogisticsByOrder] = useState({});
  const [escrowByOrder, setEscrowByOrder] = useState({});
  const [qrByLogistics, setQrByLogistics] = useState({});
  const [mapTrackingByLogistics, setMapTrackingByLogistics] = useState({});
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [logisticsLoading, setLogisticsLoading] = useState({});
  const [mapLoadingByLogistics, setMapLoadingByLogistics] = useState({});
  const [creatingShipmentId, setCreatingShipmentId] = useState(null);
  const [assigningLogisticsId, setAssigningLogisticsId] = useState(null);
  const [qrLoadingId, setQrLoadingId] = useState(null);
  const [scanningLogisticsId, setScanningLogisticsId] = useState(null);

  const orderIds = useMemo(() => orders.map(getOrderId).filter(Boolean), [orders]);
  const logisticsIds = useMemo(
    () => Object.values(logisticsByOrder).filter(Boolean).map(getLogisticsId).filter(Boolean),
    [logisticsByOrder]
  );

  useEffect(() => {
    fetchOrders();
    fetchProviders();
  }, []);

  useEffect(() => {
    if (orderIds.length) {
      fetchLogisticsForOrders(orderIds);
      fetchEscrowForOrders(orderIds);
    }
  }, [orderIds.join('|')]);

  useEffect(() => {
    if (logisticsIds.length) {
      fetchQrForLogistics(logisticsIds);
      fetchMapsForLogistics(logisticsIds);
    }
  }, [logisticsIds.join('|')]);

  const fetchOrders = async () => {
    setLoading(true);
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

  const fetchLogisticsForOrders = async (ids) => {
    setLogisticsLoading((prev) => ({
      ...prev,
      ...Object.fromEntries(ids.map((id) => [id, true])),
    }));

    const results = await Promise.allSettled(ids.map(async (orderId) => [orderId, await logisticsService.getByOrder(orderId)]));
    const next = {};
    results.forEach((result, index) => {
      const orderId = ids[index];
      if (result.status === 'fulfilled') {
        next[orderId] = result.value[1];
      } else if (result.reason?.response?.status === 404) {
        next[orderId] = null;
      }
    });

    setLogisticsByOrder((prev) => ({ ...prev, ...next }));
    setLogisticsLoading((prev) => ({
      ...prev,
      ...Object.fromEntries(ids.map((id) => [id, false])),
    }));
  };

  const fetchEscrowForOrders = async (ids) => {
    const results = await Promise.allSettled(ids.map(async (orderId) => [orderId, await logisticsService.getEscrowStatus(orderId)]));
    const next = {};
    results.forEach((result, index) => {
      const orderId = ids[index];
      if (result.status === 'fulfilled') {
        next[orderId] = result.value[1];
      } else if (result.reason?.response?.status === 404) {
        next[orderId] = null;
      }
    });
    setEscrowByOrder((prev) => ({ ...prev, ...next }));
  };

  const fetchProviders = async () => {
    try {
      const response = await logisticsService.getVerifiedProviders({ limit: 100 });
      setProviders(Array.isArray(response) ? response : []);
    } catch (error) {
      setProviders([]);
    }
  };

  const fetchQrForLogistics = async (ids) => {
    const results = await Promise.allSettled(ids.map(async (logisticsId) => [logisticsId, await logisticsService.listTripQrTokens(logisticsId)]));
    const next = {};
    results.forEach((result, index) => {
      const logisticsId = ids[index];
      if (result.status === 'fulfilled') {
        next[logisticsId] = result.value[1];
      } else if (result.reason?.response?.status === 404) {
        next[logisticsId] = null;
      }
    });
    setQrByLogistics((prev) => ({ ...prev, ...next }));
  };

  const fetchMapsForLogistics = async (ids) => {
    setMapLoadingByLogistics((prev) => ({
      ...prev,
      ...Object.fromEntries(ids.map((id) => [id, true])),
    }));

    const results = await Promise.allSettled(ids.map(async (logisticsId) => [logisticsId, await logisticsService.getMapData(logisticsId)]));
    const next = {};
    results.forEach((result, index) => {
      const logisticsId = ids[index];
      if (result.status === 'fulfilled') {
        next[logisticsId] = result.value[1];
      } else if (result.reason?.response?.status === 404) {
        next[logisticsId] = null;
      }
    });

    setMapTrackingByLogistics((prev) => ({ ...prev, ...next }));
    setMapLoadingByLogistics((prev) => ({
      ...prev,
      ...Object.fromEntries(ids.map((id) => [id, false])),
    }));
  };

  const refreshLogisticsMap = async (orderId, logisticsId) => {
    if (!orderId || !logisticsId) return;
    setMapLoadingByLogistics((prev) => ({ ...prev, [logisticsId]: true }));

    try {
      const [logistics, mapData] = await Promise.all([
        logisticsService.getByOrder(orderId),
        logisticsService.getMapData(logisticsId),
      ]);
      setLogisticsByOrder((prev) => ({ ...prev, [orderId]: logistics }));
      setMapTrackingByLogistics((prev) => ({ ...prev, [logisticsId]: mapData }));
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || 'Failed to refresh GPS map');
    } finally {
      setMapLoadingByLogistics((prev) => ({ ...prev, [logisticsId]: false }));
    }
  };

  const refreshOrderWorkflows = async (ids = orderIds) => {
    await fetchOrders();
    if (ids.length) {
      await Promise.all([
        fetchLogisticsForOrders(ids),
        fetchEscrowForOrders(ids),
      ]);
    }
  };

  const handleOrderAction = async (orderId, action) => {
    if (!action) return;

    try {
      if (action === 'cancelled') {
        const reason = window.prompt('Reason for cancelling this order:', 'Seller cancelled before fulfillment');
        if (reason === null) return;
        await orderService.cancel(orderId, reason.trim() || 'Seller cancelled before fulfillment');
        toast.success('Order cancelled and stock/payment records updated');
      } else if (action === 'dispute') {
        const reason = window.prompt('Reason for opening a dispute/freeze:', 'Seller requested escrow review');
        if (reason === null) return;
        await orderService.raiseDispute(orderId, {
          reason: reason.trim() || 'Seller requested escrow review',
          description: 'Opened from seller order operations.',
        });
        toast.success('Dispute opened and escrow freeze requested');
      } else {
        await orderService.updateStatus(orderId, action);
        toast.success('Order status updated');
      }

      await refreshOrderWorkflows([orderId]);
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || 'Failed to update order');
    }
  };

  const createShipment = async (order) => {
    const orderId = getOrderId(order);
    setCreatingShipmentId(orderId);
    try {
      const logistics = await logisticsService.createShipment(buildShipmentPayload(order));
      const nextLogistics = logistics?.logistics || logistics;
      setLogisticsByOrder((prev) => ({ ...prev, [orderId]: nextLogistics }));
      const logisticsId = getLogisticsId(nextLogistics);
      if (logisticsId) {
        fetchMapsForLogistics([logisticsId]);
      }
      if (logisticsId && logistics?.qrTokens) {
        setQrByLogistics((prev) => ({
          ...prev,
          [logisticsId]: {
            logisticsId,
            availableTokens: [
              logistics.qrTokens.pickup,
              logistics.qrTokens.delivery,
            ].filter(Boolean).map((token) => ({
              type: token.type,
              token: token.token,
              expiresAt: token.expiresAt,
            })),
          },
        }));
      }
      toast.success('Shipment created and QR handoff started');
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || 'Failed to create shipment');
    } finally {
      setCreatingShipmentId(null);
    }
  };

  const assignDriver = async (orderId, logisticsId, payload) => {
    setAssigningLogisticsId(logisticsId);
    try {
      const result = await logisticsService.assignDriver(logisticsId, payload);
      const nextLogistics = result?.logistics || result;
      setLogisticsByOrder((prev) => ({ ...prev, [orderId]: nextLogistics }));
      await fetchMapsForLogistics([logisticsId]);
      toast.success('Driver assigned to shipment');
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || 'Failed to assign driver');
    } finally {
      setAssigningLogisticsId(null);
    }
  };

  const generateQrTokens = async (logisticsId) => {
    setQrLoadingId(logisticsId);
    try {
      await logisticsService.generateTripQrTokens(logisticsId);
      const qrState = await logisticsService.listTripQrTokens(logisticsId);
      setQrByLogistics((prev) => ({ ...prev, [logisticsId]: qrState }));
      toast.success('QR handoff tokens generated');
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || 'Failed to generate QR tokens');
    } finally {
      setQrLoadingId(null);
    }
  };

  const scanQrToken = async (orderId, logisticsId, step, token) => {
    setScanningLogisticsId(logisticsId);
    try {
      if (step === 'pickup') {
        await logisticsService.scanPickup(logisticsId, { token });
      } else {
        await logisticsService.scanDelivery(logisticsId, { token });
      }
      const [logistics, qrState] = await Promise.all([
        logisticsService.getByOrder(orderId),
        logisticsService.listTripQrTokens(logisticsId),
      ]);
      setLogisticsByOrder((prev) => ({ ...prev, [orderId]: logistics }));
      setQrByLogistics((prev) => ({ ...prev, [logisticsId]: qrState }));
      fetchMapsForLogistics([logisticsId]);
      fetchEscrowForOrders([orderId]);
      toast.success(`${step === 'pickup' ? 'Pickup' : 'Delivery'} QR scan recorded`);
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || 'Failed to record QR scan');
    } finally {
      setScanningLogisticsId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-[#111827]">Orders to Fulfill</h1>
          <p className="mt-1 text-sm text-gray-500">Manage order status, logistics creation, QR handoff, and delivery visibility from one place.</p>
        </div>
        <button
          type="button"
          onClick={fetchOrders}
          className="rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
        >
          Refresh
        </button>
      </div>

      {orders.length === 0 ? (
        <div className="rounded-lg bg-white p-8 text-center shadow-md">
          <FaBoxOpen className="mx-auto mb-3 text-4xl text-gray-300" />
          <p className="text-gray-500">No orders yet</p>
        </div>
      ) : (
        <div className="space-y-5">
          {orders.map((order) => {
            const orderId = getOrderId(order);
            const image = order.product?.images?.[0]?.url || order.product?.images?.[0] || 'https://via.placeholder.com/50';
            const isClosed = closedStatuses.has(order.status);
            const logistics = logisticsByOrder[orderId];
            const logisticsId = getLogisticsId(logistics);
            const transitionOptions = ORDER_TRANSITIONS[order.status] || [];

            return (
              <div key={orderId} className="overflow-hidden rounded-lg bg-white shadow-md">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-gray-50 px-6 py-4">
                  <div>
                    <span className="text-sm text-gray-500">Order #{String(orderId).slice(-8)}</span>
                    <span className="mx-2">|</span>
                    <span className="text-sm">{new Date(order.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center space-x-4">
                    <span className={`rounded-full px-3 py-1 text-sm font-medium ${statusTone(order.status)}`}>
                      {formatStatus(order.status)}
                    </span>
                    <span className="font-semibold">{formatCurrency(order.totalAmount)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6 p-6 xl:grid-cols-3">
                  <div className="space-y-4 xl:col-span-1">
                    <div>
                      <h3 className="mb-2 font-semibold">Customer Information</h3>
                      <p className="text-gray-600">{order.buyer?.fullName || order.buyer?.name || 'N/A'}</p>
                      <p className="text-gray-600">{order.buyer?.phone || 'N/A'}</p>
                    </div>

                    <div>
                      <h3 className="mb-2 font-semibold">Items</h3>
                      <div className="flex items-center justify-between gap-3 rounded-md border border-gray-100 p-3">
                        <div className="flex items-center space-x-3">
                          <img
                            src={image}
                            alt={order.product?.name || 'Product'}
                            className="h-12 w-12 rounded object-cover"
                          />
                          <div>
                            <Link to={`/products/${order.product?._id}`} className="font-semibold hover:text-primary">
                              {order.product?.name || 'Product'}
                            </Link>
                            <p className="text-sm text-gray-500">Qty: {order.quantity}</p>
                          </div>
                        </div>
                        <span>{formatCurrency(order.totalAmount)}</span>
                      </div>
                    </div>

                    {!isClosed && transitionOptions.length > 0 && (
                      <div className="border-t pt-4">
                        <label className="mb-2 block text-sm font-medium">Next order action</label>
                        <select
                          value=""
                          onChange={(e) => handleOrderAction(orderId, e.target.value)}
                          className="rounded-lg border px-4 py-2"
                        >
                          <option value="" disabled>Choose next action</option>
                          {transitionOptions.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  <div className="xl:col-span-2">
                    <div className="mb-3 flex items-center gap-2 font-semibold text-[#111827]">
                      <FaCheckCircle className="text-[#16A34A]" />
                      Fulfillment & Logistics
                    </div>
                    <LogisticsPanel
                      order={order}
                      logistics={logistics}
                      escrow={escrowByOrder[orderId]}
                      qrState={logisticsId ? qrByLogistics[logisticsId] : null}
                      providers={providers}
                      loading={Boolean(logisticsLoading[orderId])}
                      creating={creatingShipmentId === orderId}
                      assigning={assigningLogisticsId === logisticsId}
                      qrLoading={qrLoadingId === logisticsId}
                      scanning={scanningLogisticsId === logisticsId}
                      mapTracking={logisticsId ? mapTrackingByLogistics[logisticsId] : null}
                      mapLoading={Boolean(logisticsId && mapLoadingByLogistics[logisticsId])}
                      onCreate={createShipment}
                      onAssignDriver={(payload) => assignDriver(orderId, logisticsId, payload)}
                      onGenerateQr={() => generateQrTokens(logisticsId)}
                      onScanQr={(step, token) => scanQrToken(orderId, logisticsId, step, token)}
                      onRefreshMap={() => refreshLogisticsMap(orderId, logisticsId)}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SellerOrders;
