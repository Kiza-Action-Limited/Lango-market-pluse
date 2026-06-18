import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { FaBan, FaCrown, FaEdit, FaMoneyBillWave, FaSearch, FaSyncAlt } from 'react-icons/fa';
import { adminSubscriptionService } from '../services/adminSubscriptionService';

const formatMoney = (value) => {
  const amount = Number(value || 0);
  return `KES ${amount.toLocaleString()}`;
};

const getSellerId = (row) => row?.seller?._id || row?.seller?.id || row?.seller?.userId;

const getSellerName = (seller = {}) =>
  seller.businessName || seller.fullName || seller.name || seller.email || seller.phone || 'Seller';

const getStatusClass = (status) => {
  if (status === 'active') return 'bg-green-100 text-green-800 border-green-200';
  if (status === 'cancelled' || status === 'expired') return 'bg-red-100 text-red-800 border-red-200';
  if (status === 'suspended') return 'bg-yellow-100 text-yellow-800 border-yellow-200';
  return 'bg-gray-100 text-gray-700 border-gray-200';
};

const emptyForm = {
  planId: 'solo',
  amount: '',
  status: 'active',
  endDate: '',
  autoRenew: false,
  note: '',
};

const AdminSubscriptions = () => {
  const [rows, setRows] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [editingRow, setEditingRow] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const fetchSubscriptions = async () => {
    setLoading(true);
    try {
      const response = await adminSubscriptionService.list({ search, status });
      setRows(Array.isArray(response.rows) ? response.rows : []);
      setPlans(Array.isArray(response.plans) ? response.plans : []);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load subscriptions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  const planPriceById = useMemo(
    () => Object.fromEntries(plans.map((plan) => [plan.id, plan.price])),
    [plans]
  );

  const stats = useMemo(() => {
    const active = rows.filter((row) => row.subscription?.status === 'active').length;
    const inactive = rows.length - active;
    const monthly = rows.reduce((sum, row) => sum + Number(row.subscription?.price || 0), 0);
    return { active, inactive, monthly };
  }, [rows]);

  const openEditor = (row) => {
    const subscription = row.subscription || {};
    const planId = subscription.plan || row.seller?.subscriptionTier || 'solo';
    const defaultAmount = subscription.price ?? planPriceById[planId] ?? '';
    setEditingRow(row);
    setForm({
      planId,
      amount: defaultAmount,
      status: subscription.status || 'active',
      endDate: subscription.endDate ? new Date(subscription.endDate).toISOString().slice(0, 10) : '',
      autoRenew: Boolean(subscription.autoRenew),
      note: '',
    });
  };

  const closeEditor = () => {
    setEditingRow(null);
    setForm(emptyForm);
  };

  const handlePlanChange = (planId) => {
    setForm((prev) => ({
      ...prev,
      planId,
      amount: prev.amount === '' ? (planPriceById[planId] ?? '') : prev.amount,
    }));
  };

  const saveSubscription = async (event) => {
    event.preventDefault();
    const sellerId = getSellerId(editingRow);
    if (!sellerId) return;

    setSaving(true);
    try {
      await adminSubscriptionService.save(sellerId, {
        ...form,
        amount: form.amount === '' ? undefined : Number(form.amount),
        endDate: form.endDate || undefined,
      });
      toast.success('Subscription saved');
      closeEditor();
      fetchSubscriptions();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save subscription');
    } finally {
      setSaving(false);
    }
  };

  const cancelSubscription = async (row) => {
    const sellerId = getSellerId(row);
    if (!sellerId) return;
    const confirmed = window.confirm(`Cancel subscription for ${getSellerName(row.seller)}?`);
    if (!confirmed) return;

    try {
      await adminSubscriptionService.cancel(sellerId, 'Cancelled from admin subscription manager');
      toast.success('Subscription cancelled');
      fetchSubscriptions();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to cancel subscription');
    }
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] py-8">
      <div className="container mx-auto px-4">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <FaCrown className="text-3xl text-[#F97316]" />
              <h1 className="text-3xl font-bold text-[#111827]">Seller Subscriptions</h1>
            </div>
          </div>
          <button
            type="button"
            onClick={fetchSubscriptions}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-[#111827] hover:bg-gray-50"
          >
            <FaSyncAlt />
            Refresh
          </button>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-[#6B7280]">Active</p>
            <p className="mt-1 text-2xl font-bold text-green-700">{stats.active}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-[#6B7280]">Inactive</p>
            <p className="mt-1 text-2xl font-bold text-[#111827]">{stats.inactive}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-[#6B7280]">Assigned Amount</p>
            <p className="mt-1 text-2xl font-bold text-[#F97316]">{formatMoney(stats.monthly)}</p>
          </div>
        </div>

        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-64 flex-1">
              <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') fetchSubscriptions();
                }}
                placeholder="Search sellers..."
                className="h-11 w-full rounded-lg border border-gray-300 pl-10 pr-3 text-sm outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20"
              />
            </div>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="h-11 rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
              <option value="cancelled">Cancelled</option>
              <option value="expired">Expired</option>
              <option value="trial">Trial</option>
            </select>
            <button
              type="button"
              onClick={fetchSubscriptions}
              className="h-11 rounded-lg bg-[#F97316] px-4 text-sm font-semibold text-white hover:bg-[#EA580C]"
            >
              Apply
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-250">
              <thead className="bg-[#111827] text-left text-sm text-white">
                <tr>
                  <th className="px-5 py-3">Seller</th>
                  <th className="px-5 py-3">Business Type</th>
                  <th className="px-5 py-3">Plan</th>
                  <th className="px-5 py-3">Amount</th>
                  <th className="px-5 py-3">Expires</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td className="px-5 py-10 text-center text-[#6B7280]" colSpan={7}>Loading subscriptions...</td>
                  </tr>
                ) : rows.length ? (
                  rows.map((row) => {
                    const sellerId = getSellerId(row);
                    const subscription = row.subscription;
                    const statusLabel = subscription?.status || 'inactive';
                    return (
                      <tr key={sellerId} className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="px-5 py-4">
                          <p className="font-semibold text-[#111827]">{getSellerName(row.seller)}</p>
                          <p className="text-xs text-[#6B7280]">{row.seller?.email || row.seller?.phone || '-'}</p>
                        </td>
                        <td className="px-5 py-4 text-sm capitalize text-[#374151]">
                          {String(row.seller?.businessType || row.seller?.role || '-').replace(/_/g, ' ')}
                        </td>
                        <td className="px-5 py-4 text-sm font-medium capitalize text-[#111827]">
                          {subscription?.plan || 'No plan'}
                        </td>
                        <td className="px-5 py-4 text-sm text-[#374151]">
                          {subscription ? formatMoney(subscription.price) : '-'}
                        </td>
                        <td className="px-5 py-4 text-sm text-[#374151]">
                          {subscription?.endDate ? new Date(subscription.endDate).toLocaleDateString() : '-'}
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${getStatusClass(statusLabel)}`}>
                            {statusLabel}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => openEditor(row)}
                              className="inline-flex items-center gap-1 rounded-lg border border-[#F97316] px-3 py-1.5 text-sm font-semibold text-[#F97316] hover:bg-[#FFF7ED]"
                            >
                              <FaEdit size={12} />
                              Manage
                            </button>
                            {subscription?.status === 'active' && (
                              <button
                                type="button"
                                onClick={() => cancelSubscription(row)}
                                className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-50"
                              >
                                <FaBan size={12} />
                                Cancel
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td className="px-5 py-10 text-center text-[#6B7280]" colSpan={7}>No sellers found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {editingRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form onSubmit={saveSubscription} className="w-full max-w-xl rounded-xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-[#111827]">{getSellerName(editingRow.seller)}</h2>
                <p className="text-sm text-[#6B7280]">{editingRow.seller?.email || editingRow.seller?.phone}</p>
              </div>
              <FaMoneyBillWave className="text-2xl text-[#F97316]" />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-[#111827]">
                Plan
                <select
                  value={form.planId}
                  onChange={(event) => handlePlanChange(event.target.value)}
                  className="mt-1 h-11 w-full rounded-lg border border-gray-300 px-3 outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20"
                >
                  {plans.map((plan) => (
                    <option key={plan.id} value={plan.id}>{plan.name}</option>
                  ))}
                </select>
              </label>

              <label className="block text-sm font-medium text-[#111827]">
                Amount
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.amount}
                  onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))}
                  className="mt-1 h-11 w-full rounded-lg border border-gray-300 px-3 outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20"
                />
              </label>

              <label className="block text-sm font-medium text-[#111827]">
                Status
                <select
                  value={form.status}
                  onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}
                  className="mt-1 h-11 w-full rounded-lg border border-gray-300 px-3 outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="suspended">Suspended</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="expired">Expired</option>
                  <option value="trial">Trial</option>
                </select>
              </label>

              <label className="block text-sm font-medium text-[#111827]">
                End Date
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(event) => setForm((prev) => ({ ...prev, endDate: event.target.value }))}
                  className="mt-1 h-11 w-full rounded-lg border border-gray-300 px-3 outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20"
                />
              </label>
            </div>

            <label className="mt-4 flex items-center gap-2 text-sm text-[#374151]">
              <input
                type="checkbox"
                checked={form.autoRenew}
                onChange={(event) => setForm((prev) => ({ ...prev, autoRenew: event.target.checked }))}
                className="h-4 w-4 rounded border-gray-300 text-[#F97316] focus:ring-[#F97316]"
              />
              Auto renew
            </label>

            <label className="mt-4 block text-sm font-medium text-[#111827]">
              Admin Note
              <textarea
                value={form.note}
                onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))}
                rows={3}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20"
              />
            </label>

            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={closeEditor}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-[#111827] hover:bg-gray-50"
              >
                Close
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-[#F97316] px-4 py-2 text-sm font-semibold text-white hover:bg-[#EA580C] disabled:opacity-60"
              >
                {saving ? 'Saving...' : 'Save Subscription'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default AdminSubscriptions;
