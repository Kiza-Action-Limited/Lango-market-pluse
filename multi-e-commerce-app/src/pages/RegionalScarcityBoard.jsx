import React, { useEffect, useMemo, useState } from 'react';
import { FaBroadcastTower, FaExclamationTriangle, FaMapMarkerAlt, FaShieldAlt, FaSyncAlt, FaWarehouse } from 'react-icons/fa';
import { productService } from '../services/productService';
import { formatProductCategory, PRODUCT_CATEGORY_OPTIONS } from '../utils/inventorySensitivity';
import { formatRealtimeStamp } from '../hooks/useRealtimeRefresh';

const statusStyles = {
  'scarcity-risk': 'bg-red-100 text-red-700 border-red-200',
  watch: 'bg-amber-100 text-amber-800 border-amber-200',
  stable: 'bg-green-100 text-green-700 border-green-200',
};

const statusLabels = {
  'scarcity-risk': 'Scarcity Risk',
  watch: 'Watch',
  stable: 'Stable',
};

const MetricCard = ({ icon: Icon, label, value, detail, tone = 'orange' }) => {
  const tones = {
    orange: 'bg-orange-50 text-[#F97316]',
    red: 'bg-red-50 text-red-600',
    amber: 'bg-amber-50 text-amber-700',
    green: 'bg-green-50 text-green-700',
    blue: 'bg-blue-50 text-blue-700',
  };

  return (
    <div className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
      <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-md ${tones[tone] || tones.orange}`}>
        <Icon />
      </div>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-[#111827]">{value}</p>
      {detail && <p className="mt-1 text-xs text-gray-500">{detail}</p>}
    </div>
  );
};

const RegionalScarcityBoard = () => {
  const [board, setBoard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [category, setCategory] = useState('all');
  const [hub, setHub] = useState('all');
  const [sensitivity, setSensitivity] = useState('sensitive');
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchBoard = async ({ silent = false } = {}) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      const response = await productService.getScarcityBoard({
        category: category === 'all' ? undefined : category,
        hub: hub === 'all' ? undefined : hub,
        sensitivity,
        limit: 1000,
      });
      setBoard(response?.data || null);
      setLastUpdated(new Date());
    } catch (fetchError) {
      console.error('Failed to load scarcity board data:', fetchError);
      setError(fetchError.response?.data?.message || 'Unable to load live scarcity data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchBoard();
  }, [category, hub, sensitivity]);

  useEffect(() => {
    const interval = setInterval(() => fetchBoard({ silent: true }), 30000);
    return () => clearInterval(interval);
  }, [category, hub, sensitivity]);

  const hubs = board?.hubs || [];
  const summary = board?.summary || {};
  const categoryRows = board?.categories || [];
  const hubOptions = useMemo(() => ['all', ...hubs.map((row) => row.hub)], [hubs]);
  const topPressureCategories = categoryRows.slice(0, 6);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-[#F97316]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F8FA] px-4 py-6 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#F97316]">Regional Guardian</p>
          <h1 className="mt-1 text-2xl font-bold text-[#111827]">Regional Scarcity Board</h1>
          <p className="mt-1 text-sm text-gray-500">
            Live stock pressure from published marketplace inventory by hub, seller, and staple category.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex h-10 items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 text-xs font-medium text-green-700">
            <span className={`h-2 w-2 rounded-full bg-green-500 ${refreshing ? 'animate-pulse' : ''}`} />
            Live - {formatRealtimeStamp(lastUpdated)}
          </div>
          <button
            type="button"
            onClick={() => fetchBoard({ silent: true })}
            disabled={refreshing}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-gray-200 bg-white px-3 text-sm font-medium text-[#111827] hover:bg-gray-50 disabled:opacity-60"
          >
            <FaSyncAlt className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={FaMapMarkerAlt} label="Hubs" value={summary.hubs || 0} detail="regions with published stock" tone="blue" />
        <MetricCard icon={FaWarehouse} label="Total Stock" value={summary.totalStock || 0} detail={`${summary.products || 0} active SKUs`} tone="green" />
        <MetricCard icon={FaExclamationTriangle} label="Alerts" value={summary.alertCount || 0} detail={`${summary.criticalCount || 0} critical`} tone={summary.criticalCount ? 'red' : 'amber'} />
        <MetricCard icon={FaShieldAlt} label="Staples At Risk" value={summary.essentialAtRiskCount || 0} detail={`${summary.sensitivity || sensitivity} mode`} tone={summary.essentialAtRiskCount ? 'red' : 'green'} />
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="rounded-md border border-gray-200 bg-white p-4 shadow-sm xl:col-span-8">
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="h-10 rounded-md border border-gray-200 bg-white px-3 text-sm outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20"
            >
              <option value="all">All categories</option>
              {PRODUCT_CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <select
              value={hub}
              onChange={(event) => setHub(event.target.value)}
              className="h-10 rounded-md border border-gray-200 bg-white px-3 text-sm outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20"
            >
              {hubOptions.map((option) => (
                <option key={option} value={option}>{option === 'all' ? 'All hubs' : option}</option>
              ))}
            </select>
            <select
              value={sensitivity}
              onChange={(event) => setSensitivity(event.target.value)}
              className="h-10 rounded-md border border-gray-200 bg-white px-3 text-sm outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20"
            >
              <option value="normal">Normal sensitivity</option>
              <option value="sensitive">Sensitive early warning</option>
              <option value="high">High-alert sensitivity</option>
            </select>
          </div>
          <p className="mt-3 text-xs text-gray-500">
            Sensitive modes raise auto thresholds and flag staples before they fully hit low stock.
          </p>
          {error && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        </div>

        <div className="rounded-md border border-gray-200 bg-white p-4 shadow-sm xl:col-span-4">
          <p className="text-sm font-semibold text-[#111827]">Category Pressure</p>
          <div className="mt-3 space-y-2">
            {topPressureCategories.map((row) => (
              <div key={row.category} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate text-gray-600">{formatProductCategory(row.category)}</span>
                <span className="shrink-0 font-semibold text-[#111827]">{row.alerts} alerts</span>
              </div>
            ))}
            {!topPressureCategories.length && <p className="text-sm text-gray-500">No category pressure yet.</p>}
          </div>
        </div>
      </div>

      {hubs.length === 0 ? (
        <div className="rounded-md border border-dashed border-gray-300 bg-white p-8 text-center">
          <FaBroadcastTower className="mx-auto mb-3 text-4xl text-gray-300" />
          <p className="text-sm text-gray-500">No live published inventory is available for this board yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {hubs.map((hubRow) => (
            <section key={hubRow.hub} className="rounded-md border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <FaMapMarkerAlt className="shrink-0 text-[#F97316]" />
                    <h2 className="truncate text-lg font-semibold text-[#111827]">{hubRow.hub}</h2>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">{hubRow.sellerCount} sellers, {hubRow.totalSkus} SKUs</p>
                </div>
                <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${statusStyles[hubRow.guardianState] || statusStyles.stable}`}>
                  {statusLabels[hubRow.guardianState] || 'Stable'}
                </span>
              </div>

              <div className="mb-4 grid grid-cols-3 gap-2">
                <div className="rounded-md bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">Stock</p>
                  <p className="mt-1 text-xl font-bold text-[#111827]">{hubRow.totalStock}</p>
                </div>
                <div className="rounded-md bg-amber-50 p-3">
                  <p className="text-xs text-amber-700">Alerts</p>
                  <p className="mt-1 text-xl font-bold text-[#111827]">{hubRow.alertCount}</p>
                </div>
                <div className="rounded-md bg-red-50 p-3">
                  <p className="text-xs text-red-700">Critical</p>
                  <p className="mt-1 text-xl font-bold text-[#111827]">{hubRow.criticalCount}</p>
                </div>
              </div>

              <div className="mb-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#111827]">
                  <FaShieldAlt className="text-[#16A34A]" />
                  Essential Commodity Watch
                </div>
                <div className="space-y-2">
                  {hubRow.essentialsAtRisk?.slice(0, 5).map((item) => (
                    <div
                      key={item.id}
                      className={`rounded-md border p-3 ${item.severity === 'critical' ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[#111827]">{item.name}</p>
                          <p className="mt-1 text-xs text-gray-600">
                            {item.seller} - {formatProductCategory(item.category)}
                          </p>
                        </div>
                        <FaExclamationTriangle className={item.severity === 'critical' ? 'text-red-600' : 'text-amber-600'} />
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
                        <span>Stock {item.stock} {item.unit || ''}</span>
                        <span>Available {item.available}</span>
                        <span>Threshold {item.threshold}</span>
                      </div>
                    </div>
                  ))}
                  {!hubRow.essentialsAtRisk?.length && (
                    <p className="rounded-md bg-gray-50 px-3 py-4 text-center text-sm text-gray-500">No essential staples are at risk in this hub.</p>
                  )}
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold text-[#111827]">Category Stock</p>
                <div className="space-y-2">
                  {hubRow.categories?.slice(0, 5).map((row) => {
                    const maxStock = Math.max(...hubRow.categories.map((item) => item.stock), 1);
                    const width = Math.max(6, (row.stock / maxStock) * 100);
                    return (
                      <div key={row.category}>
                        <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                          <span className="truncate text-gray-600">{formatProductCategory(row.category)}</span>
                          <span className="font-semibold text-[#111827]">{row.stock} stock, {row.alerts} alerts</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                          <div className="h-full rounded-full bg-[#F97316]" style={{ width: `${width}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};

export default RegionalScarcityBoard;
