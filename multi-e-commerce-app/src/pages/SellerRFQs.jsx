import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { FaCheck, FaClock, FaFileInvoiceDollar, FaReply, FaTimes } from 'react-icons/fa';
import { rfqService } from '../services/rfqService';
import { formatCurrency } from '../utils/formatters';

const statusTone = (status) => {
  if (status === 'quoted' || status === 'accepted') return 'bg-green-100 text-green-800';
  if (status === 'declined' || status === 'cancelled' || status === 'expired') return 'bg-red-100 text-red-800';
  return 'bg-amber-100 text-amber-800';
};

const statusFilters = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'quoted', label: 'Quoted' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'declined', label: 'Declined' },
];

const SellerRFQs = () => {
  const [rfqs, setRfqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('all');
  const [quoteDrafts, setQuoteDrafts] = useState({});
  const [savingId, setSavingId] = useState('');

  const loadRfqs = async () => {
    setLoading(true);
    try {
      const response = await rfqService.getMy({ mode: 'seller', status, limit: 100 });
      const rows = response?.data || [];
      setRfqs(rows);
      setQuoteDrafts((prev) => {
        const next = { ...prev };
        rows.forEach((rfq) => {
          const id = rfq._id || rfq.id;
          if (!next[id]) {
            next[id] = {
              unitPrice: rfq.quote?.unitPrice || '',
              availableQuantity: rfq.quote?.availableQuantity || rfq.quantity || '',
              validUntil: rfq.quote?.validUntil ? String(rfq.quote.validUntil).slice(0, 10) : '',
              deliveryWindowDays: rfq.quote?.deliveryWindowDays || '',
              sellerMessage: '',
            };
          }
        });
        return next;
      });
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to load RFQs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRfqs();
  }, [status]);

  const summary = useMemo(() => {
    const open = rfqs.filter((rfq) => rfq.status === 'open').length;
    const quoted = rfqs.filter((rfq) => rfq.status === 'quoted').length;
    const accepted = rfqs.filter((rfq) => rfq.status === 'accepted').length;
    const declined = rfqs.filter((rfq) => rfq.status === 'declined').length;
    return { open, quoted, accepted, declined, total: rfqs.length };
  }, [rfqs]);

  const syncUpdatedRfq = (updated) => {
    const updatedId = updated?._id || updated?.id;
    setRfqs((prev) => {
      if (status !== 'all' && updated?.status !== status) {
        return prev.filter((item) => (item._id || item.id) !== updatedId);
      }
      return prev.map((item) => ((item._id || item.id) === updatedId ? updated : item));
    });
  };

  const updateDraft = (rfqId, key, value) => {
    setQuoteDrafts((prev) => ({
      ...prev,
      [rfqId]: {
        ...(prev[rfqId] || {}),
        [key]: value,
      },
    }));
  };

  const submitQuote = async (rfq) => {
    const rfqId = rfq._id || rfq.id;
    const draft = quoteDrafts[rfqId] || {};
    if (!draft.unitPrice) {
      toast.error('Enter a quote unit price');
      return;
    }

    setSavingId(rfqId);
    try {
      const updated = await rfqService.respond(rfqId, draft);
      syncUpdatedRfq(updated);
      setQuoteDrafts((prev) => ({
        ...prev,
        [rfqId]: {
          ...(prev[rfqId] || {}),
          sellerMessage: '',
        },
      }));
      toast.success('Quote sent to buyer');
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to send quote');
    } finally {
      setSavingId('');
    }
  };

  const declineRfq = async (rfq) => {
    const rfqId = rfq._id || rfq.id;
    setSavingId(rfqId);
    try {
      const updated = await rfqService.updateStatus(rfqId, { status: 'declined', message: 'Seller declined this RFQ.' });
      syncUpdatedRfq(updated);
      toast.success('RFQ declined');
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to decline RFQ');
    } finally {
      setSavingId('');
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F8FA] px-4 py-6 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#F97316]">B2B wholesaling</p>
          <h1 className="mt-1 text-2xl font-bold text-[#111827]">RFQ Inbox</h1>
          <p className="mt-1 text-sm text-gray-500">Review bulk buyer requests and send negotiated quotes.</p>
        </div>
        <div className="flex overflow-hidden rounded-md border border-gray-200 bg-white">
          {statusFilters.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setStatus(item.value)}
              className={`h-10 px-3 text-xs font-medium ${status === item.value ? 'bg-[#111827] text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-5">
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase text-gray-500">Showing</p>
          <p className="mt-2 text-2xl font-bold text-[#111827]">{summary.total}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase text-gray-500">Open</p>
          <p className="mt-2 text-2xl font-bold text-amber-700">{summary.open}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase text-gray-500">Quoted</p>
          <p className="mt-2 text-2xl font-bold text-green-700">{summary.quoted}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase text-gray-500">Accepted</p>
          <p className="mt-2 text-2xl font-bold text-blue-700">{summary.accepted}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium uppercase text-gray-500">Declined</p>
          <p className="mt-2 text-2xl font-bold text-red-700">{summary.declined}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-40 rounded-lg border border-gray-100 bg-white skeleton-shimmer" />
          ))
        ) : rfqs.length ? (
          rfqs.map((rfq) => {
            const rfqId = rfq._id || rfq.id;
            const draft = quoteDrafts[rfqId] || {};
            const requestedTotal = Number(rfq.targetPrice || 0) * Number(rfq.quantity || 0);
            const quoteTotal = Number(draft.unitPrice || 0) * Number(rfq.quantity || 0);
            const canSellerAct = ['open', 'quoted'].includes(rfq.status);
            const savedSellerMessage = rfq.quote?.sellerMessage;
            return (
              <section key={rfqId} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <FaFileInvoiceDollar className="text-[#F97316]" />
                      <h2 className="text-lg font-semibold text-[#111827]">{rfq.rfqNumber || `RFQ ${String(rfqId).slice(-8)}`}</h2>
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusTone(rfq.status)}`}>{rfq.status}</span>
                    </div>
                    <p className="mt-1 text-sm text-gray-600">{rfq.product?.name || 'Product'} - {rfq.quantity} {rfq.unit}</p>
                    <p className="mt-1 text-xs text-gray-500">
                      Buyer: {rfq.buyer?.businessName || rfq.buyer?.fullName || rfq.buyer?.name || 'Buyer'} | Delivery: {rfq.deliveryLocation || 'Not specified'}
                    </p>
                  </div>
                  <div className="text-sm text-gray-500">
                    <FaClock className="mr-1 inline text-gray-400" />
                    {rfq.createdAt ? new Date(rfq.createdAt).toLocaleDateString() : '-'}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
                  <div className="rounded-md bg-gray-50 p-3">
                    <p className="text-xs text-gray-500">Target Unit Price</p>
                    <p className="mt-1 font-semibold text-[#111827]">{rfq.targetPrice ? formatCurrency(rfq.targetPrice) : 'Open'}</p>
                  </div>
                  <div className="rounded-md bg-gray-50 p-3">
                    <p className="text-xs text-gray-500">Target Total</p>
                    <p className="mt-1 font-semibold text-[#111827]">{requestedTotal ? formatCurrency(requestedTotal) : 'Open'}</p>
                  </div>
                  <div className="rounded-md bg-gray-50 p-3">
                    <p className="text-xs text-gray-500">Needed By</p>
                    <p className="mt-1 font-semibold text-[#111827]">{rfq.neededBy ? new Date(rfq.neededBy).toLocaleDateString() : 'Flexible'}</p>
                  </div>
                  <div className="rounded-md bg-gray-50 p-3">
                    <p className="text-xs text-gray-500">Your Quote Total</p>
                    <p className="mt-1 font-semibold text-[#111827]">{quoteTotal ? formatCurrency(quoteTotal) : 'Not quoted'}</p>
                  </div>
                </div>

                {rfq.message && (
                  <p className="mt-4 rounded-md border border-gray-100 bg-gray-50 p-3 text-sm text-gray-600">{rfq.message}</p>
                )}

                {savedSellerMessage && (
                  <div className="mt-4 rounded-md border border-green-100 bg-green-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-green-700">Last sent seller message</p>
                    <p className="mt-1 text-sm text-green-900">{savedSellerMessage}</p>
                  </div>
                )}

                <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-5">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={draft.unitPrice || ''}
                    onChange={(event) => updateDraft(rfqId, 'unitPrice', event.target.value)}
                    placeholder="Quote unit price"
                    className="h-10 rounded-md border border-gray-300 px-3 text-sm outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20"
                  />
                  <input
                    type="number"
                    min="0"
                    value={draft.availableQuantity || ''}
                    onChange={(event) => updateDraft(rfqId, 'availableQuantity', event.target.value)}
                    placeholder="Available quantity"
                    className="h-10 rounded-md border border-gray-300 px-3 text-sm outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20"
                  />
                  <input
                    type="date"
                    value={draft.validUntil || ''}
                    onChange={(event) => updateDraft(rfqId, 'validUntil', event.target.value)}
                    className="h-10 rounded-md border border-gray-300 px-3 text-sm outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20"
                  />
                  <input
                    type="number"
                    min="0"
                    value={draft.deliveryWindowDays || ''}
                    onChange={(event) => updateDraft(rfqId, 'deliveryWindowDays', event.target.value)}
                    placeholder="Delivery days"
                    className="h-10 rounded-md border border-gray-300 px-3 text-sm outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => submitQuote(rfq)}
                      disabled={!canSellerAct || savingId === rfqId}
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-[#F97316] px-3 py-2 text-sm font-semibold text-white hover:bg-[#EA580C] disabled:opacity-60"
                    >
                      <FaReply />
                      Quote
                    </button>
                    <button
                      type="button"
                      onClick={() => declineRfq(rfq)}
                      disabled={!canSellerAct || savingId === rfqId}
                      className="inline-flex items-center justify-center rounded-md border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                      title="Decline RFQ"
                    >
                      <FaTimes />
                    </button>
                  </div>
                </div>
                <textarea
                  value={draft.sellerMessage || ''}
                  onChange={(event) => updateDraft(rfqId, 'sellerMessage', event.target.value)}
                  placeholder={savedSellerMessage ? 'Add a new seller message...' : 'Seller message, pickup terms, packaging, or payment notes...'}
                  rows="2"
                  className="mt-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20"
                />
              </section>
            );
          })
        ) : (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center">
            <FaCheck className="mx-auto mb-3 text-3xl text-green-500" />
            <p className="font-semibold text-[#111827]">No RFQs found</p>
            <p className="mt-1 text-sm text-gray-500">New bulk buyer requests will appear here.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SellerRFQs;
