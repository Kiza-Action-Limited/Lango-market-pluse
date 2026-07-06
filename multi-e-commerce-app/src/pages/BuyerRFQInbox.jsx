import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  FaCheck,
  FaClock,
  FaCommentDots,
  FaFileInvoiceDollar,
  FaStore,
  FaTimes,
} from 'react-icons/fa';
import { rfqService } from '../services/rfqService';
import { formatCurrency } from '../utils/formatters';

const filters = ['all', 'open', 'quoted', 'accepted', 'declined', 'cancelled'];

const statusTone = (status) => {
  if (status === 'quoted') return 'bg-blue-100 text-blue-800';
  if (status === 'accepted') return 'bg-green-100 text-green-800';
  if (status === 'declined' || status === 'cancelled' || status === 'expired') return 'bg-red-100 text-red-800';
  return 'bg-amber-100 text-amber-800';
};

const getDisplayName = (user, fallback) => (
  user?.businessName || user?.fullName || user?.name || fallback
);

const BuyerRFQInbox = () => {
  const [rfqs, setRfqs] = useState([]);
  const [status, setStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState('');

  const loadRfqs = async () => {
    setLoading(true);
    try {
      const response = await rfqService.getMy({ mode: 'buyer', status, limit: 100 });
      setRfqs(response?.data || []);
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to load RFQ inbox');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRfqs();
  }, [status]);

  const summary = useMemo(() => {
    const quoted = rfqs.filter((rfq) => rfq.status === 'quoted').length;
    const accepted = rfqs.filter((rfq) => rfq.status === 'accepted').length;
    const open = rfqs.filter((rfq) => rfq.status === 'open').length;
    return { quoted, accepted, open, total: rfqs.length };
  }, [rfqs]);

  const updateStatus = async (rfq, nextStatus) => {
    const rfqId = rfq._id || rfq.id;
    setSavingId(rfqId);
    try {
      await rfqService.updateStatus(rfqId, {
        status: nextStatus,
        message: nextStatus === 'accepted' ? 'Buyer accepted the seller quote.' : 'Buyer declined the seller quote.',
      });
      setRfqs((prev) => prev.filter((item) => (item._id || item.id) !== rfqId));
      toast.success(nextStatus === 'accepted' ? 'Seller quote accepted' : 'RFQ declined');
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to update RFQ');
    } finally {
      setSavingId('');
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F8FA] px-4 py-6 sm:px-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#F97316]">Seller quote messages</p>
          <h1 className="mt-1 text-2xl font-bold text-[#111827]">RFQ Inbox</h1>
          <p className="mt-1 text-sm text-gray-500">Receive seller quotes, review messages, and confirm bulk purchase requests.</p>
        </div>
        <div className="flex overflow-hidden rounded-md border border-gray-200 bg-white">
          {filters.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setStatus(item)}
              className={`h-10 px-3 text-xs font-medium capitalize ${status === item ? 'bg-[#111827] text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase text-gray-500">Total RFQs</p>
          <p className="mt-2 text-2xl font-bold text-[#111827]">{summary.total}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase text-gray-500">Seller Replies</p>
          <p className="mt-2 text-2xl font-bold text-blue-700">{summary.quoted}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase text-gray-500">Open Requests</p>
          <p className="mt-2 text-2xl font-bold text-amber-700">{summary.open}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase text-gray-500">Accepted</p>
          <p className="mt-2 text-2xl font-bold text-green-700">{summary.accepted}</p>
        </div>
      </div>

      <div className="space-y-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-48 rounded-lg border border-gray-100 bg-white skeleton-shimmer" />
          ))
        ) : rfqs.length ? (
          rfqs.map((rfq) => {
            const rfqId = rfq._id || rfq.id;
            const quote = rfq.quote || {};
            const canAccept = rfq.status === 'quoted' && quote.unitPrice != null;
            const sellerMessage = quote.sellerMessage || 'The seller has not added a message yet.';

            return (
              <section key={rfqId} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <FaFileInvoiceDollar className="text-[#F97316]" />
                      <h2 className="text-lg font-semibold text-[#111827]">{rfq.rfqNumber || `RFQ ${String(rfqId).slice(-8)}`}</h2>
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold capitalize ${statusTone(rfq.status)}`}>
                        {rfq.status}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-600">{rfq.product?.name || 'Product'} - {rfq.quantity} {rfq.unit}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                      <FaStore className="text-gray-400" />
                      Seller: {getDisplayName(rfq.seller, 'Seller')}
                      <span className="text-gray-300">|</span>
                      Delivery: {rfq.deliveryLocation || 'Not specified'}
                    </p>
                  </div>
                  <div className="text-sm text-gray-500">
                    <FaClock className="mr-1 inline text-gray-400" />
                    {rfq.createdAt ? new Date(rfq.createdAt).toLocaleDateString() : '-'}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
                  <div className="rounded-md bg-gray-50 p-3">
                    <p className="text-xs text-gray-500">Your Target</p>
                    <p className="mt-1 font-semibold text-[#111827]">{rfq.targetPrice ? formatCurrency(rfq.targetPrice) : 'Open'}</p>
                  </div>
                  <div className="rounded-md bg-gray-50 p-3">
                    <p className="text-xs text-gray-500">Seller Unit Price</p>
                    <p className="mt-1 font-semibold text-[#111827]">{quote.unitPrice != null ? formatCurrency(quote.unitPrice) : 'Waiting'}</p>
                  </div>
                  <div className="rounded-md bg-gray-50 p-3">
                    <p className="text-xs text-gray-500">Quote Total</p>
                    <p className="mt-1 font-semibold text-[#111827]">{quote.totalPrice != null ? formatCurrency(quote.totalPrice) : 'Not quoted'}</p>
                  </div>
                  <div className="rounded-md bg-gray-50 p-3">
                    <p className="text-xs text-gray-500">Delivery Window</p>
                    <p className="mt-1 font-semibold text-[#111827]">{quote.deliveryWindowDays != null ? `${quote.deliveryWindowDays} days` : 'Not set'}</p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_auto]">
                  <div className="rounded-md border border-blue-100 bg-blue-50 p-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-blue-900">
                      <FaCommentDots />
                      Seller Message
                    </div>
                    <p className="mt-2 text-sm text-blue-900/80">{sellerMessage}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                    <button
                      type="button"
                      onClick={() => updateStatus(rfq, 'accepted')}
                      disabled={!canAccept || savingId === rfqId}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#F97316] px-4 text-sm font-semibold text-white hover:bg-[#EA580C] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <FaCheck />
                      Accept Quote
                    </button>
                    <button
                      type="button"
                      onClick={() => updateStatus(rfq, 'cancelled')}
                      disabled={!['open', 'quoted'].includes(rfq.status) || savingId === rfqId}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-red-200 px-4 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <FaTimes />
                      Decline
                    </button>
                  </div>
                </div>
              </section>
            );
          })
        ) : (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center">
            <FaCommentDots className="mx-auto mb-3 text-3xl text-[#F97316]" />
            <p className="font-semibold text-[#111827]">No RFQ messages yet</p>
            <p className="mt-1 text-sm text-gray-500">Seller replies to your quote requests will appear here.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default BuyerRFQInbox;
