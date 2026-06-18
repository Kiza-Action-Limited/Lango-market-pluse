import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { FaBalanceScale, FaChartPie, FaFileAlt, FaMoneyBillWave, FaRedo } from 'react-icons/fa';
import api from '../config/axios';
import { formatCurrency, formatDate } from '../utils/formatters';
import { paymentService } from '../services/paymentService';

const Card = ({ title, value, hint, icon: Icon }) => (
  <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-sm text-gray-500">{title}</p>
        <p className="mt-2 text-3xl font-bold text-[#111827]">{value}</p>
        {hint ? <p className="mt-1 text-xs text-gray-500">{hint}</p> : null}
      </div>
      <div className="rounded-xl bg-[#FFF7ED] p-3 text-[#F97316]">
        <Icon />
      </div>
    </div>
  </div>
);

const humanize = (value) => {
  if (!value) return 'Not available';
  return String(value)
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const readFirst = (source, keys, fallback = null) => {
  if (!source || typeof source !== 'object') return fallback;
  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null && source[key] !== '') return source[key];
  }
  return fallback;
};

const getStatusTone = (value) => {
  const normalized = String(value || '').toLowerCase();
  if (['success', 'completed', 'paid', 'processed', '0'].some((part) => normalized.includes(part))) {
    return 'bg-[#16A34A]/10 text-[#15803D] border-[#16A34A]/20';
  }
  if (['pending', 'processing', 'queued', 'stk'].some((part) => normalized.includes(part))) {
    return 'bg-[#F97316]/10 text-[#C2410C] border-[#F97316]/20';
  }
  if (['fail', 'cancel', 'error', 'timeout'].some((part) => normalized.includes(part))) {
    return 'bg-red-50 text-red-700 border-red-200';
  }
  return 'bg-gray-100 text-gray-700 border-gray-200';
};

const StatusBadge = ({ value }) => (
  <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${getStatusTone(value)}`}>
    {humanize(value || 'Not available')}
  </span>
);

const DetailItem = ({ label, value, mono = false }) => (
  <div className="rounded-xl border border-gray-200 bg-[#F9FAFB] p-3">
    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
    <p className={`mt-1 break-words text-sm font-semibold text-[#111827] ${mono ? 'font-mono' : ''}`}>
      {value || 'Not available'}
    </p>
  </div>
);

const PaymentResultPanel = ({ title, description, result, emptyText }) => {
  const status = readFirst(result, ['status', 'paymentStatus', 'ResultDesc', 'resultDesc', 'ResponseDescription', 'responseDescription', 'message']);
  const checkoutId = readFirst(result, ['checkoutRequestId', 'CheckoutRequestID', 'checkoutRequestID']);
  const merchantId = readFirst(result, ['merchantRequestId', 'MerchantRequestID', 'merchantRequestID']);
  const code = readFirst(result, ['responseCode', 'ResponseCode', 'resultCode', 'ResultCode']);
  const amount = readFirst(result, ['amount', 'Amount', 'totalAmount']);
  const receipt = readFirst(result, ['mpesaReceiptNumber', 'MpesaReceiptNumber', 'receipt', 'reference', 'transactionId']);
  const phone = readFirst(result, ['phoneNumber', 'phone', 'PhoneNumber']);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#111827]">{title}</p>
          <p className="mt-1 text-xs text-gray-500">{description}</p>
        </div>
        {result ? <StatusBadge value={status || code} /> : null}
      </div>

      {!result ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-[#F9FAFB] p-5 text-center text-sm text-gray-500">
          {emptyText}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <DetailItem label="Checkout Request" value={checkoutId} mono />
          <DetailItem label="Merchant Request" value={merchantId} mono />
          <DetailItem label="Result Code" value={code} />
          <DetailItem label="Amount" value={amount !== null ? formatCurrency(amount) : null} />
          <DetailItem label="Receipt" value={receipt} mono />
          <DetailItem label="Phone" value={phone} mono />
          {status ? (
            <div className="rounded-xl border border-gray-200 bg-[#F9FAFB] p-3 md:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Message</p>
              <p className="mt-1 text-sm font-semibold text-[#111827]">{status}</p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

const TransactionStatsPanel = ({ summary }) => {
  const byType = summary?.byType || {};
  const rows = Object.entries(byType);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#111827]">Transaction Stats</p>
          <p className="mt-1 text-xs text-gray-500">Grouped totals from /v1/transactions/summary.</p>
        </div>
        <StatusBadge value={summary ? 'Loaded' : 'No data'} />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <DetailItem label="Total Credit" value={formatCurrency(summary?.totalCredit || 0)} />
        <DetailItem label="Total Debit" value={formatCurrency(summary?.totalDebit || 0)} />
        <DetailItem label="Net Change" value={formatCurrency(summary?.netChange || 0)} />
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-[#F9FAFB]">
            <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Count</th>
              <th className="px-4 py-3">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([type, data]) => (
              <tr key={type} className="border-t border-gray-200">
                <td className="px-4 py-3 font-semibold text-[#111827]">{humanize(type)}</td>
                <td className="px-4 py-3 text-gray-600">{data?.count || 0}</td>
                <td className="px-4 py-3 font-semibold text-[#16A34A]">{formatCurrency(data?.total || 0)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-sm text-gray-500">No transaction breakdown returned.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const AdminFinanceAudit = () => {
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [auditStats, setAuditStats] = useState(null);
  const [recentAudit, setRecentAudit] = useState([]);
  const [transactionSummary, setTransactionSummary] = useState(null);
  const [escrowSummary, setEscrowSummary] = useState(null);
  const [escrowTransactions, setEscrowTransactions] = useState([]);
  const [stkForm, setStkForm] = useState({ orderId: '', phoneNumber: '' });
  const [stkStatusForm, setStkStatusForm] = useState({ checkoutRequestId: '' });
  const [stkResult, setStkResult] = useState(null);
  const [stkStatusResult, setStkStatusResult] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const safe = (promise) => promise.catch((error) => ({ __error: error }));
      const [paymentsRes, auditStatsRes, recentRes, transactionHistoryRes, transactionSummaryRes, escrowSummaryRes, escrowTransactionsRes] = await Promise.all([
        safe(api.get('/v1/admin/payments', { params: { page: 1, limit: 25 } })),
        safe(api.get('/v1/audit/stats')),
        safe(api.get('/v1/audit/recent')),
        safe(paymentService.getTransactionHistory({ page: 1, limit: 25 })),
        safe(paymentService.getTransactionSummary(30)),
        safe(paymentService.getEscrowSummary()),
        safe(paymentService.getEscrowTransactions()),
      ]);

      setPayments(paymentsRes?.data?.payments || []);
      setTransactions(transactionHistoryRes?.transactions || transactionHistoryRes?.data?.transactions || []);
      setAuditStats(auditStatsRes?.data?.data || auditStatsRes?.data || null);
      setRecentAudit(recentRes?.data?.data || recentRes?.data?.activities || recentRes?.data || []);
      setTransactionSummary(transactionSummaryRes?.__error ? null : (transactionSummaryRes?.data || transactionSummaryRes || null));
      setEscrowSummary(escrowSummaryRes?.__error ? null : (escrowSummaryRes?.data || escrowSummaryRes || null));
      setEscrowTransactions(escrowTransactionsRes?.transactions || escrowTransactionsRes?.data?.transactions || []);

      if (transactionHistoryRes?.__error || transactionSummaryRes?.__error || escrowSummaryRes?.__error || escrowTransactionsRes?.__error) {
        const message =
          transactionHistoryRes?.__error?.response?.data?.message ||
          transactionSummaryRes?.__error?.response?.data?.message ||
          escrowSummaryRes?.__error?.response?.data?.message ||
          escrowTransactionsRes?.__error?.response?.data?.message;
        if (message) toast(message, { icon: '⚠️' });
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to load finance/audit data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSearch = async (event) => {
    event.preventDefault();
    try {
      const response = await api.post('/v1/audit/search', { query: searchQuery });
      setSearchResult(response.data?.data || response.data || null);
      toast.success('Audit search completed');
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Audit search failed');
    }
  };

  const handleSendStkPush = async (event) => {
    event.preventDefault();
    if (!stkForm.orderId.trim()) {
      toast.error('Order ID is required');
      return;
    }
    try {
      const result = await paymentService.initiateMpesaPayment({
        orderId: stkForm.orderId.trim(),
        phoneNumber: stkForm.phoneNumber.trim() || undefined,
      });
      setStkResult(result);
      toast.success('M-Pesa prompt sent');
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to send M-Pesa prompt');
    }
  };

  const handleCheckStkStatus = async (event) => {
    event.preventDefault();
    if (!stkStatusForm.checkoutRequestId.trim()) {
      toast.error('Checkout request ID is required');
      return;
    }
    try {
      const result = await paymentService.checkMpesaStatus(stkStatusForm.checkoutRequestId.trim());
      setStkStatusResult(result);
      toast.success('Payment status loaded');
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to load payment status');
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-[#F9FAFB] p-8">Loading finance and audit data...</div>;
  }

  const totalPayments = transactions.length || payments.length;
  const totalAmount = (transactions.length ? transactions : payments).reduce((sum, payment) => sum + Number(payment.amount || payment.totalAmount || 0), 0);
  const recentCount = Array.isArray(recentAudit) ? recentAudit.length : 0;

  return (
    <div className="min-h-screen bg-[#F9FAFB] px-4 py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-3xl border border-orange-100 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#F97316]">Finance and audit</p>
              <h1 className="mt-2 text-3xl font-bold text-[#111827]">Admin Finance & Audit</h1>
              <p className="mt-2 max-w-3xl text-sm text-gray-600">
                Review payments, inspect recent audit activity, and search platform events from the backend records that already exist.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={loadData}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <FaRedo /> Refresh
              </button>
              <Link
                to="/admin/dashboard"
                className="inline-flex items-center gap-2 rounded-xl bg-[#111827] px-4 py-2 text-sm font-medium text-white hover:bg-black"
              >
                Back to Admin
              </Link>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card title="Payments" value={totalPayments} hint="Recent payment rows from /v1/admin/payments" icon={FaMoneyBillWave} />
          <Card title="Total Amount" value={formatCurrency(totalAmount)} hint="Summed from the current payment page" icon={FaBalanceScale} />
          <Card title="Recent Audits" value={recentCount} hint="Recent records from /v1/audit/recent" icon={FaChartPie} />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[#111827]">M-Pesa Payment Console</h2>
                <p className="text-sm text-gray-500">Call the backend STK push and status endpoints from the frontend.</p>
              </div>
            </div>
            <form onSubmit={handleSendStkPush} className="space-y-3">
              <input
                value={stkForm.orderId}
                onChange={(e) => setStkForm((prev) => ({ ...prev, orderId: e.target.value }))}
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#F97316]"
                placeholder="Order ID or order number"
              />
              <input
                value={stkForm.phoneNumber}
                onChange={(e) => setStkForm((prev) => ({ ...prev, phoneNumber: e.target.value }))}
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#F97316]"
                placeholder="Phone number e.g. +2547..."
              />
              <button type="submit" className="inline-flex items-center rounded-xl bg-[#F97316] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#EA580C]">
                Send STK Push
              </button>
            </form>

            <form onSubmit={handleCheckStkStatus} className="mt-5 space-y-3">
              <input
                value={stkStatusForm.checkoutRequestId}
                onChange={(e) => setStkStatusForm((prev) => ({ ...prev, checkoutRequestId: e.target.value }))}
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#F97316]"
                placeholder="Checkout Request ID"
              />
              <button type="submit" className="inline-flex items-center rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                Check Payment Status
              </button>
            </form>

            <div className="mt-5 grid grid-cols-1 gap-3">
              <PaymentResultPanel
                title="STK Push Result"
                description="Prompt response returned after sending the customer payment request."
                result={stkResult}
                emptyText="Send an STK push to see checkout request details here."
              />
              <PaymentResultPanel
                title="Payment Status Result"
                description="Status response for the checkout request ID."
                result={stkStatusResult}
                emptyText="Enter a checkout request ID to check the live payment status."
              />
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-[#111827]">Transactions and Escrow</h2>
              <p className="text-sm text-gray-500">Live backend payment endpoints already exposed by the API.</p>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <Card title="Transactions" value={transactions.length} hint="From /v1/transactions" icon={FaFileAlt} />
              <Card title="Escrow Records" value={escrowTransactions.length} hint="From /v1/escrow/transactions" icon={FaBalanceScale} />
              <Card title="Escrow Summary" value={escrowSummary?.total || escrowSummary?.count || 0} hint="From /v1/escrow/summary" icon={FaMoneyBillWave} />
            </div>
            <div className="mt-4">
              <TransactionStatsPanel summary={transactionSummary} />
            </div>
          </section>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[#111827]">Payments</h2>
                <p className="text-sm text-gray-500">Current payment records returned by the backend.</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="pb-3">Reference</th>
                    <th className="pb-3">Amount</th>
                    <th className="pb-3">Method</th>
                    <th className="pb-3">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {(transactions.length ? transactions : payments).map((payment, index) => (
                    <tr key={payment._id || `${payment.reference || 'pay'}-${index}`} className="border-b last:border-b-0">
                      <td className="py-3 font-mono text-xs">{payment.reference || payment.transactionId || payment._id || '-'}</td>
                      <td className="py-3">{formatCurrency(payment.amount || payment.totalAmount || 0)}</td>
                      <td className="py-3 capitalize">{payment.method || payment.paymentMethod || payment.channel || payment.type || '-'}</td>
                      <td className="py-3">{formatDate(payment.createdAt || payment.date || new Date())}</td>
                    </tr>
                  ))}
                  {(transactions.length ? transactions : payments).length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-sm text-gray-500">No payment records returned.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-[#111827]">Audit Search</h2>
              <p className="text-sm text-gray-500">Query audit logs using the backend search endpoint.</p>
            </div>
            <form onSubmit={handleSearch} className="space-y-3">
              <textarea
                rows="4"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#F97316]"
                placeholder="Search terms, entity, user, action..."
              />
              <button
                type="submit"
                className="inline-flex items-center rounded-xl bg-[#F97316] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#EA580C]"
              >
                Search Audit Logs
              </button>
            </form>

            <div className="mt-4">
              <p className="mb-2 text-sm font-semibold text-[#111827]">Search Result</p>
              <pre className="max-h-80 overflow-auto rounded-xl bg-[#111827] p-4 text-xs leading-5 text-green-100">
                {JSON.stringify(searchResult, null, 2)}
              </pre>
            </div>
          </section>
        </div>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-[#111827]">Recent Audit Activity</h2>
            <p className="text-sm text-gray-500">Fetched from /v1/audit/recent.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="pb-3">Action</th>
                  <th className="pb-3">Entity</th>
                  <th className="pb-3">User</th>
                  <th className="pb-3">Time</th>
                </tr>
              </thead>
              <tbody>
                {Array.isArray(recentAudit) && recentAudit.map((item, index) => (
                  <tr key={item._id || index} className="border-b last:border-b-0">
                    <td className="py-3">{item.action || item.event || '-'}</td>
                    <td className="py-3">{item.entityType || item.entity || '-'}</td>
                    <td className="py-3">{item.user?.name || item.user?.email || item.userId || '-'}</td>
                    <td className="py-3">{formatDate(item.createdAt || item.timestamp || new Date())}</td>
                  </tr>
                ))}
                {(!Array.isArray(recentAudit) || recentAudit.length === 0) && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-sm text-gray-500">No recent audit activity returned.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-[#111827]">Audit Stats</h2>
            <p className="text-sm text-gray-500">Fetched from /v1/audit/stats.</p>
          </div>
          <pre className="max-h-80 overflow-auto rounded-xl bg-[#111827] p-4 text-xs leading-5 text-green-100">
            {JSON.stringify(auditStats, null, 2)}
          </pre>
        </section>
      </div>
    </div>
  );
};

export default AdminFinanceAudit;
