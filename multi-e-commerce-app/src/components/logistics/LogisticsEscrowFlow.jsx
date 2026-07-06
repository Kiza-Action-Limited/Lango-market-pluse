import React from 'react';
import {
  FaCheckCircle,
  FaLock,
  FaMobileAlt,
  FaMoneyBillWave,
  FaQrcode,
  FaTruck,
} from 'react-icons/fa';

const normalize = (value) => String(value || '').toLowerCase();

const hasTrackingStatus = (tracking, needles) => {
  const updates = Array.isArray(tracking?.updates) ? tracking.updates : [];
  return updates.some((update) => {
    const status = normalize(update?.status);
    const description = normalize(update?.description);
    return needles.some((needle) => status.includes(needle) || description.includes(needle));
  });
};

const inferFlowState = ({ order, tracking, trip }) => {
  const orderStatus = normalize(order?.status);
  const tripStatus = normalize(trip?.status);
  const escrowStatus = normalize(order?.escrow?.status || trip?.escrow?.status);

  const paid = Boolean(order?.paidAt || order?.paymentStatus === 'completed') ||
    ['paid', 'payment_escrowed', 'funds_held', 'processing', 'shipped', 'dispatched', 'delivered', 'completed', 'released'].some((status) => orderStatus.includes(status));

  const escrowHeld = paid ||
    ['held', 'funds_held', 'payment_escrowed', 'released'].some((status) => escrowStatus.includes(status));

  const hubScanned = Boolean(trip?.pickedUpAt || trip?.pickupScannedAt) ||
    ['picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'completed'].some((status) => tripStatus.includes(status) || orderStatus.includes(status)) ||
    hasTrackingStatus(tracking, ['pickup', 'hub', 'qr scan']);

  const finalScanned = Boolean(trip?.finalScannedAt || trip?.deliveryScannedAt) ||
    ['out_for_delivery', 'delivered', 'completed'].some((status) => tripStatus.includes(status) || orderStatus.includes(status)) ||
    hasTrackingStatus(tracking, ['final qr', 'delivery scan']);

  const delivered = Boolean(order?.deliveredAt || trip?.deliveredAt || trip?.completedAt) ||
    ['delivered', 'completed', 'released'].some((status) => tripStatus.includes(status) || orderStatus.includes(status));

  const payoutReleased = escrowStatus.includes('released') ||
    ['released', 'completed'].some((status) => orderStatus.includes(status));

  return {
    payment: paid,
    escrow: escrowHeld,
    hub: hubScanned,
    final: finalScanned,
    delivery: delivered,
    payout: payoutReleased,
  };
};

const stepClass = (done, active) => {
  if (done) return 'border-[#16A34A] bg-[#F0FDF4] text-[#14532D]';
  if (active) return 'border-[#F97316] bg-[#FFF7ED] text-[#9A3412]';
  return 'border-gray-200 bg-white text-gray-500';
};

const StepNode = ({ icon: Icon, title, actor, done, active }) => (
  <div className={`min-h-28 rounded-lg border p-4 transition ${stepClass(done, active)}`}>
    <div className="flex items-center gap-3">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${done ? 'bg-[#16A34A] text-white' : active ? 'bg-[#F97316] text-white' : 'bg-gray-100 text-gray-400'}`}>
        {done ? <FaCheckCircle /> : <Icon />}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[#111827]">{title}</p>
        <p className="mt-1 text-xs">{actor}</p>
      </div>
    </div>
  </div>
);

const Connector = ({ active = false }) => (
  <div className="hidden h-px self-center md:block" aria-hidden="true">
    <div className={`h-px w-full ${active ? 'bg-[#16A34A]' : 'bg-gray-200'}`} />
  </div>
);

const LogisticsEscrowFlow = ({ order, tracking, trip, className = '' }) => {
  const state = inferFlowState({ order, tracking, trip });
  const activeKey = !state.payment
    ? 'payment'
    : !state.escrow
      ? 'escrow'
      : !state.hub
        ? 'hub'
        : !state.final
          ? 'final'
          : !state.delivery
            ? 'delivery'
            : !state.payout
              ? 'payout'
              : null;

  return (
    <section className={`rounded-xl border border-gray-200 bg-white p-5 shadow-sm ${className}`}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#111827]">Buyer Order Escrow Flow</h2>
          <p className="mt-1 text-sm text-gray-500">Buyer M-Pesa payment, escrow hold, QR delivery chain, delivery confirmation, and seller payout.</p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${state.payout ? 'border-[#16A34A]/30 bg-[#F0FDF4] text-[#15803D]' : 'border-[#F97316]/30 bg-[#FFF7ED] text-[#9A3412]'}`}>
          {state.payout ? 'PAYOUT READY' : 'IN PROGRESS'}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_48px_minmax(0,1fr)] md:items-stretch">
        <StepNode
          icon={FaMobileAlt}
          title="Buyer Pays M-Pesa"
          actor="Buyer ordering from seller"
          done={state.payment}
          active={activeKey === 'payment'}
        />
        <Connector active={state.payment} />
        <StepNode
          icon={FaLock}
          title="Held in Secure Escrow"
          actor="Platform escrow"
          done={state.escrow}
          active={activeKey === 'escrow'}
        />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
        <StepNode
          icon={FaQrcode}
          title="QR Scan at Hub"
          actor="1st-Mile Driver"
          done={state.hub}
          active={activeKey === 'hub'}
        />
        <StepNode
          icon={FaQrcode}
          title="Final QR Scan"
          actor="Long-Haul Driver"
          done={state.final}
          active={activeKey === 'final'}
        />
        <StepNode
          icon={FaTruck}
          title="Delivery Confirmed"
          actor="Buyer confirms delivery"
          done={state.delivery || state.payout}
          active={activeKey === 'delivery' || activeKey === 'payout'}
        />
      </div>

      <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
        <div className="flex flex-wrap items-center gap-2 text-sm text-[#111827]">
          <FaMoneyBillWave className={state.payout ? 'text-[#16A34A]' : 'text-gray-400'} />
          <span className="font-medium">{state.payout ? 'Seller payout released' : 'Seller payout waits for buyer delivery confirmation'}</span>
        </div>
      </div>
    </section>
  );
};

export default LogisticsEscrowFlow;
