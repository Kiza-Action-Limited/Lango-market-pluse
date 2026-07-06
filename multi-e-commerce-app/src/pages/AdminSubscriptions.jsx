import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  FaBan,
  FaCheckCircle,
  FaCrown,
  FaEdit,
  FaLayerGroup,
  FaListUl,
  FaMoneyBillWave,
  FaPlus,
  FaSearch,
  FaSyncAlt,
  FaTrash,
} from 'react-icons/fa';
import { adminSubscriptionService } from '../services/adminSubscriptionService';

const planOrder = ['solo', 'smart', 'growth', 'mizigo'];

const emptySubscriptionForm = {
  planId: 'solo',
  amount: '',
  status: 'active',
  endDate: '',
  autoRenew: false,
  note: '',
};

const emptyFeatureForm = {
  key: '',
  label: '',
  description: '',
  category: 'seller_tools',
  planIds: ['solo'],
  isActive: true,
  sortOrder: 0,
};

const formatMoney = (value) => {
  const amount = Number(value || 0);
  return `KES ${amount.toLocaleString()}`;
};

const humanize = (value) => String(value || '')
  .replace(/_/g, ' ')
  .replace(/\b\w/g, (letter) => letter.toUpperCase());

const getSellerId = (row) => row?.seller?._id || row?.seller?.id || row?.seller?.userId;

const getSellerName = (seller = {}) =>
  seller.businessName || seller.fullName || seller.name || seller.email || seller.phone || 'Seller';

const getStatusClass = (status) => {
  if (status === 'active') return 'bg-green-100 text-green-800 border-green-200';
  if (status === 'cancelled' || status === 'expired') return 'bg-red-100 text-red-800 border-red-200';
  if (status === 'suspended') return 'bg-yellow-100 text-yellow-800 border-yellow-200';
  return 'bg-gray-100 text-gray-700 border-gray-200';
};

const StatCard = ({ label, value, icon: Icon, tone = 'orange' }) => {
  const tones = {
    orange: 'bg-[#FFF7ED] text-[#F97316]',
    green: 'bg-green-50 text-green-700',
    blue: 'bg-blue-50 text-blue-700',
    slate: 'bg-slate-100 text-slate-700',
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
          <p className="mt-1 text-2xl font-bold text-[#111827]">{value}</p>
        </div>
        <div className={`rounded-lg p-3 ${tones[tone] || tones.orange}`}>
          <Icon />
        </div>
      </div>
    </div>
  );
};

const StatusBadge = ({ value }) => (
  <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${getStatusClass(value)}`}>
    {value || 'inactive'}
  </span>
);

const PlanBadge = ({ value }) => (
  <span className="rounded-full bg-[#FFF7ED] px-2.5 py-1 text-xs font-semibold text-[#C2410C]">
    {humanize(value)}
  </span>
);

const AdminSubscriptions = () => {
  const [rows, setRows] = useState([]);
  const [plans, setPlans] = useState([]);
  const [features, setFeatures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [activeView, setActiveView] = useState('subscriptions');
  const [editingRow, setEditingRow] = useState(null);
  const [editingFeature, setEditingFeature] = useState(null);
  const [showFeatureModal, setShowFeatureModal] = useState(false);
  const [subscriptionForm, setSubscriptionForm] = useState(emptySubscriptionForm);
  const [featureForm, setFeatureForm] = useState(emptyFeatureForm);
  const [featureSearch, setFeatureSearch] = useState('');

  const fetchSubscriptions = async () => {
    setLoading(true);
    try {
      const response = await adminSubscriptionService.list({ search, status });
      setRows(Array.isArray(response.rows) ? response.rows : []);
      setPlans(Array.isArray(response.plans) ? response.plans : []);
      setFeatures(Array.isArray(response.features) ? response.features : []);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load subscriptions');
    } finally {
      setLoading(false);
    }
  };

  const fetchFeatures = async () => {
    try {
      const response = await adminSubscriptionService.listFeatures();
      setFeatures(Array.isArray(response.features) ? response.features : []);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load subscription features');
    }
  };

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  const planPriceById = useMemo(
    () => Object.fromEntries(plans.map((plan) => [plan.id, plan.price])),
    [plans]
  );

  const planNameById = useMemo(
    () => Object.fromEntries(plans.map((plan) => [plan.id, plan.name])),
    [plans]
  );

  const stats = useMemo(() => {
    const active = rows.filter((row) => row.subscription?.status === 'active').length;
    const inactive = rows.length - active;
    const monthly = rows.reduce((sum, row) => sum + Number(row.subscription?.price || 0), 0);
    const activeFeatures = features.filter((feature) => feature.isActive !== false).length;
    return { active, inactive, monthly, activeFeatures };
  }, [rows, features]);

  const filteredFeatures = useMemo(() => {
    const query = featureSearch.trim().toLowerCase();
    if (!query) return features;
    return features.filter((feature) => (
      feature.label?.toLowerCase().includes(query) ||
      feature.key?.toLowerCase().includes(query) ||
      feature.description?.toLowerCase().includes(query) ||
      feature.category?.toLowerCase().includes(query)
    ));
  }, [features, featureSearch]);

  const openSubscriptionEditor = (row) => {
    const subscription = row.subscription || {};
    const planId = subscription.plan || row.seller?.subscriptionTier || 'solo';
    const defaultAmount = subscription.price ?? planPriceById[planId] ?? '';
    setEditingRow(row);
    setSubscriptionForm({
      planId,
      amount: defaultAmount,
      status: subscription.status || 'active',
      endDate: subscription.endDate ? new Date(subscription.endDate).toISOString().slice(0, 10) : '',
      autoRenew: Boolean(subscription.autoRenew),
      note: '',
    });
  };

  const closeSubscriptionEditor = () => {
    setEditingRow(null);
    setSubscriptionForm(emptySubscriptionForm);
  };

  const openFeatureEditor = (feature = null) => {
    setEditingFeature(feature);
    setFeatureForm(feature ? {
      key: feature.key || '',
      label: feature.label || '',
      description: feature.description || '',
      category: feature.category || 'seller_tools',
      planIds: Array.isArray(feature.planIds) ? feature.planIds : [],
      isActive: feature.isActive !== false,
      sortOrder: Number(feature.sortOrder || 0),
    } : emptyFeatureForm);
    setShowFeatureModal(true);
  };

  const closeFeatureEditor = () => {
    setEditingFeature(null);
    setFeatureForm(emptyFeatureForm);
    setShowFeatureModal(false);
  };

  const handlePlanChange = (planId) => {
    setSubscriptionForm((prev) => ({
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
        ...subscriptionForm,
        amount: subscriptionForm.amount === '' ? undefined : Number(subscriptionForm.amount),
        endDate: subscriptionForm.endDate || undefined,
      });
      toast.success('Subscription saved');
      closeSubscriptionEditor();
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

  const toggleFeaturePlan = (planId) => {
    setFeatureForm((prev) => {
      const current = new Set(prev.planIds || []);
      if (current.has(planId)) current.delete(planId);
      else current.add(planId);
      return { ...prev, planIds: Array.from(current) };
    });
  };

  const saveFeature = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...featureForm,
        label: featureForm.label.trim(),
        key: featureForm.key.trim(),
        description: featureForm.description.trim(),
        category: featureForm.category.trim() || 'seller_tools',
        sortOrder: Number(featureForm.sortOrder || 0),
      };
      if (editingFeature) {
        await adminSubscriptionService.updateFeature(editingFeature._id || editingFeature.id, payload);
        toast.success('Feature updated');
      } else {
        await adminSubscriptionService.createFeature(payload);
        toast.success('Feature created');
      }
      closeFeatureEditor();
      fetchFeatures();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save feature');
    } finally {
      setSaving(false);
    }
  };

  const deleteFeature = async (feature) => {
    const confirmed = window.confirm(`Delete feature "${feature.label}"?`);
    if (!confirmed) return;
    try {
      await adminSubscriptionService.deleteFeature(feature._id || feature.id);
      toast.success('Feature deleted');
      fetchFeatures();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete feature');
    }
  };

  const toggleFeatureActive = async (feature) => {
    try {
      await adminSubscriptionService.updateFeature(feature._id || feature.id, { isActive: feature.isActive === false });
      toast.success(feature.isActive === false ? 'Feature activated' : 'Feature deactivated');
      fetchFeatures();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update feature');
    }
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] py-8">
      <div className="container mx-auto space-y-6 px-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#F97316]">Subscription administration</p>
            <h1 className="mt-2 text-3xl font-bold text-[#111827]">Seller Subscriptions</h1>
            <p className="mt-1 max-w-3xl text-sm text-gray-600">
              Manage seller plans, billing status, and plan features from one professional admin workspace.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => openFeatureEditor()}
              className="inline-flex items-center gap-2 rounded-lg bg-[#F97316] px-4 py-2 text-sm font-semibold text-white hover:bg-[#EA580C]"
            >
              <FaPlus /> Add Feature
            </button>
            <button
              type="button"
              onClick={fetchSubscriptions}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-[#111827] hover:bg-gray-50"
            >
              <FaSyncAlt /> Refresh
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <StatCard label="Active Subscriptions" value={stats.active} icon={FaCheckCircle} tone="green" />
          <StatCard label="Inactive" value={stats.inactive} icon={FaBan} tone="slate" />
          <StatCard label="Assigned Amount" value={formatMoney(stats.monthly)} icon={FaMoneyBillWave} />
          <StatCard label="Active Features" value={stats.activeFeatures} icon={FaLayerGroup} tone="blue" />
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveView('subscriptions')}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold ${
              activeView === 'subscriptions' ? 'bg-[#111827] text-white' : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <FaCrown /> Subscriptions
          </button>
          <button
            type="button"
            onClick={() => setActiveView('features')}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold ${
              activeView === 'features' ? 'bg-[#111827] text-white' : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <FaListUl /> Features
          </button>
        </div>

        {activeView === 'subscriptions' && (
          <>
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
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

            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1000px]">
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
                            <td className="px-5 py-4"><StatusBadge value={statusLabel} /></td>
                            <td className="px-5 py-4">
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => openSubscriptionEditor(row)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-[#F97316] px-3 py-1.5 text-sm font-semibold text-[#F97316] hover:bg-[#FFF7ED]"
                                >
                                  <FaEdit size={12} /> Manage
                                </button>
                                {subscription?.status === 'active' && (
                                  <button
                                    type="button"
                                    onClick={() => cancelSubscription(row)}
                                    className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-50"
                                  >
                                    <FaBan size={12} /> Cancel
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
          </>
        )}

        {activeView === 'features' && (
          <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-[#111827]">Subscription Features</h2>
                <p className="text-sm text-gray-500">Add, update, assign, deactivate, or delete features shown for seller plans.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <div className="relative">
                  <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    value={featureSearch}
                    onChange={(event) => setFeatureSearch(event.target.value)}
                    placeholder="Search features"
                    className="h-10 rounded-lg border border-gray-300 pl-10 pr-3 text-sm outline-none focus:border-[#F97316]"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => openFeatureEditor()}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#F97316] px-4 py-2 text-sm font-semibold text-white hover:bg-[#EA580C]"
                >
                  <FaPlus /> Add Feature
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="bg-[#F9FAFB] text-left text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-5 py-3">Feature</th>
                    <th className="px-5 py-3">Category</th>
                    <th className="px-5 py-3">Plans</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Sort</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFeatures.map((feature) => (
                    <tr key={feature._id || feature.id} className="border-t border-gray-200">
                      <td className="px-5 py-4">
                        <p className="font-semibold text-[#111827]">{feature.label}</p>
                        <p className="font-mono text-xs text-gray-500">{feature.key}</p>
                        <p className="mt-1 max-w-xl text-xs text-gray-500">{feature.description || 'No description provided'}</p>
                      </td>
                      <td className="px-5 py-4">
                        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
                          {humanize(feature.category)}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-1">
                          {(feature.planIds || []).map((planId) => (
                            <PlanBadge key={planId} value={planNameById[planId] || planId} />
                          ))}
                          {(!feature.planIds || feature.planIds.length === 0) && <span className="text-xs text-gray-500">No plans</span>}
                        </div>
                      </td>
                      <td className="px-5 py-4"><StatusBadge value={feature.isActive === false ? 'inactive' : 'active'} /></td>
                      <td className="px-5 py-4 text-gray-700">{feature.sortOrder || 0}</td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openFeatureEditor(feature)}
                            className="inline-flex items-center gap-1 rounded-lg border border-[#F97316] px-3 py-1.5 text-xs font-semibold text-[#F97316] hover:bg-[#FFF7ED]"
                          >
                            <FaEdit /> Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleFeatureActive(feature)}
                            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                          >
                            {feature.isActive === false ? 'Activate' : 'Deactivate'}
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteFeature(feature)}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                          >
                            <FaTrash /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredFeatures.length === 0 && (
                    <tr>
                      <td className="px-5 py-10 text-center text-gray-500" colSpan={6}>No features found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>

      {editingRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form onSubmit={saveSubscription} className="w-full max-w-xl rounded-lg bg-white p-5 shadow-xl">
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
                  value={subscriptionForm.planId}
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
                  value={subscriptionForm.amount}
                  onChange={(event) => setSubscriptionForm((prev) => ({ ...prev, amount: event.target.value }))}
                  className="mt-1 h-11 w-full rounded-lg border border-gray-300 px-3 outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20"
                />
              </label>

              <label className="block text-sm font-medium text-[#111827]">
                Status
                <select
                  value={subscriptionForm.status}
                  onChange={(event) => setSubscriptionForm((prev) => ({ ...prev, status: event.target.value }))}
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
                  value={subscriptionForm.endDate}
                  onChange={(event) => setSubscriptionForm((prev) => ({ ...prev, endDate: event.target.value }))}
                  className="mt-1 h-11 w-full rounded-lg border border-gray-300 px-3 outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20"
                />
              </label>
            </div>

            <label className="mt-4 flex items-center gap-2 text-sm text-[#374151]">
              <input
                type="checkbox"
                checked={subscriptionForm.autoRenew}
                onChange={(event) => setSubscriptionForm((prev) => ({ ...prev, autoRenew: event.target.checked }))}
                className="h-4 w-4 rounded border-gray-300 text-[#F97316] focus:ring-[#F97316]"
              />
              Auto renew
            </label>

            <label className="mt-4 block text-sm font-medium text-[#111827]">
              Admin Note
              <textarea
                value={subscriptionForm.note}
                onChange={(event) => setSubscriptionForm((prev) => ({ ...prev, note: event.target.value }))}
                rows={3}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20"
              />
            </label>

            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button type="button" onClick={closeSubscriptionEditor} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-[#111827] hover:bg-gray-50">
                Close
              </button>
              <button type="submit" disabled={saving} className="rounded-lg bg-[#F97316] px-4 py-2 text-sm font-semibold text-white hover:bg-[#EA580C] disabled:opacity-60">
                {saving ? 'Saving...' : 'Save Subscription'}
              </button>
            </div>
          </form>
        </div>
      )}

      {showFeatureModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form onSubmit={saveFeature} className="w-full max-w-2xl rounded-lg bg-white p-5 shadow-xl">
            <div className="mb-4">
              <h2 className="text-xl font-bold text-[#111827]">{editingFeature ? 'Edit Feature' : 'Add Feature'}</h2>
              <p className="text-sm text-gray-500">Assign this feature to one or more seller plans.</p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-[#111827]">
                Feature Label
                <input
                  value={featureForm.label}
                  onChange={(event) => setFeatureForm((prev) => ({ ...prev, label: event.target.value }))}
                  required
                  className="mt-1 h-11 w-full rounded-lg border border-gray-300 px-3 outline-none focus:border-[#F97316]"
                  placeholder="Inventory alerts"
                />
              </label>
              <label className="block text-sm font-medium text-[#111827]">
                Feature Key
                <input
                  value={featureForm.key}
                  onChange={(event) => setFeatureForm((prev) => ({ ...prev, key: event.target.value }))}
                  className="mt-1 h-11 w-full rounded-lg border border-gray-300 px-3 font-mono text-sm outline-none focus:border-[#F97316]"
                  placeholder="inventory_alerts"
                />
              </label>
              <label className="block text-sm font-medium text-[#111827]">
                Category
                <input
                  value={featureForm.category}
                  onChange={(event) => setFeatureForm((prev) => ({ ...prev, category: event.target.value }))}
                  className="mt-1 h-11 w-full rounded-lg border border-gray-300 px-3 outline-none focus:border-[#F97316]"
                />
              </label>
              <label className="block text-sm font-medium text-[#111827]">
                Sort Order
                <input
                  type="number"
                  min="0"
                  value={featureForm.sortOrder}
                  onChange={(event) => setFeatureForm((prev) => ({ ...prev, sortOrder: event.target.value }))}
                  className="mt-1 h-11 w-full rounded-lg border border-gray-300 px-3 outline-none focus:border-[#F97316]"
                />
              </label>
            </div>

            <label className="mt-4 block text-sm font-medium text-[#111827]">
              Description
              <textarea
                value={featureForm.description}
                onChange={(event) => setFeatureForm((prev) => ({ ...prev, description: event.target.value }))}
                rows={3}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-[#F97316]"
              />
            </label>

            <div className="mt-4">
              <p className="text-sm font-medium text-[#111827]">Included Plans</p>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {planOrder.map((planId) => (
                  <label key={planId} className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-[#374151]">
                    <input
                      type="checkbox"
                      checked={featureForm.planIds.includes(planId)}
                      onChange={() => toggleFeaturePlan(planId)}
                      className="h-4 w-4 rounded border-gray-300 text-[#F97316] focus:ring-[#F97316]"
                    />
                    {humanize(planNameById[planId] || planId)}
                  </label>
                ))}
              </div>
            </div>

            <label className="mt-4 flex items-center gap-2 text-sm text-[#374151]">
              <input
                type="checkbox"
                checked={featureForm.isActive}
                onChange={(event) => setFeatureForm((prev) => ({ ...prev, isActive: event.target.checked }))}
                className="h-4 w-4 rounded border-gray-300 text-[#F97316] focus:ring-[#F97316]"
              />
              Active feature
            </label>

            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button type="button" onClick={closeFeatureEditor} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-[#111827] hover:bg-gray-50">
                Close
              </button>
              <button type="submit" disabled={saving} className="rounded-lg bg-[#F97316] px-4 py-2 text-sm font-semibold text-white hover:bg-[#EA580C] disabled:opacity-60">
                {saving ? 'Saving...' : editingFeature ? 'Save Feature' : 'Create Feature'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default AdminSubscriptions;
