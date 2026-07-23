import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  FaArrowDown,
  FaArrowUp,
  FaBox,
  FaChartLine,
  FaClipboardCheck,
  FaFileExport,
  FaMoneyBillWave,
  FaShieldAlt,
  FaShoppingCart,
  FaSpinner,
  FaStore,
  FaTruck,
  FaUsers,
} from 'react-icons/fa';
import api from '../config/axios';
import { formatCurrency } from '../utils/formatters';

const number = (value) => Number(value || 0);

const formatNumber = (value) => number(value).toLocaleString('en-KE');

const trendMeta = (series = []) => {
  if (series.length < 2) return { changePct: 0, direction: 'flat' };
  const first = number(series[0]);
  const last = number(series[series.length - 1]);
  const changePct = first ? ((last - first) / Math.abs(first)) * 100 : 0;
  return {
    changePct: Number(changePct.toFixed(1)),
    direction: changePct > 0 ? 'up' : changePct < 0 ? 'down' : 'flat',
  };
};

const Sparkline = ({ series = [], color = '#F97316' }) => {
  const values = series.map(number);
  if (!values.length) return <div className="h-14 rounded-md bg-gray-50" />;
  const max = Math.max(...values, 1);
  const min = Math.min(...values);
  const range = max - min || 1;
  const points = values.map((value, index) => {
    const x = (index / Math.max(values.length - 1, 1)) * 240;
    const y = 56 - ((value - min) / range) * 52;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg viewBox="0 0 240 60" className="h-14 w-full">
      <polyline fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" points={points} />
    </svg>
  );
};

const KpiCard = ({ icon: Icon, label, value, detail, series, color = '#F97316' }) => {
  const trend = trendMeta(series || []);
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 bg-gray-50" style={{ color }}>
          <Icon />
        </span>
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${
          trend.direction === 'up' ? 'bg-green-50 text-green-700' : trend.direction === 'down' ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-600'
        }`}>
          {trend.direction === 'up' ? <FaArrowUp /> : trend.direction === 'down' ? <FaArrowDown /> : null}
          {trend.changePct}%
        </span>
      </div>
      <p className="mt-4 text-xs font-semibold uppercase text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-950">{value}</p>
      <p className="mt-1 text-sm text-gray-600">{detail}</p>
      <div className="mt-3">
        <Sparkline series={series} color={color} />
      </div>
    </div>
  );
};

const ProgressRow = ({ label, value, total, color = '#F97316', detail }) => {
  const pct = total ? Math.min(100, Math.round((number(value) / number(total)) * 100)) : number(value);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-gray-700">{label}</span>
        <span className="text-gray-500">{detail || `${pct}%`}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-gray-100">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
};

const Panel = ({ title, subtitle, children, action }) => (
  <section className="rounded-lg border border-gray-200 bg-white shadow-sm">
    <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-4">
      <div>
        <h3 className="font-semibold text-gray-950">{title}</h3>
        {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
      </div>
      {action}
    </div>
    <div className="p-5">{children}</div>
  </section>
);

const AdminAnalytics = () => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('month');
  const fetchedOnceRef = useRef(false);

  const fetchAnalytics = async (nextPeriod = period) => {
    setLoading(true);
    try {
      const res = await api.get('/v1/admin/analytics', { params: { period: nextPeriod } });
      setAnalytics(res.data?.data || null);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (fetchedOnceRef.current) return;
    fetchedOnceRef.current = true;
    fetchAnalytics('month');
  }, []);

  const trends = analytics?.trends || [];
  const revenueSeries = trends.map((item) => number(item.totalRevenue));
  const orderSeries = trends.map((item) => number(item.orderCount));
  const fulfillmentSeries = trends.map((item) => number(item.deliveredCount));
  const maxRevenue = Math.max(...revenueSeries, 1);

  const summary = analytics?.summary || {};
  const financials = analytics?.financials || {};
  const users = analytics?.users || {};
  const operations = analytics?.operations || {};
  const productHealth = operations.products || {};
  const logistics = operations.logistics || {};

  const paymentRows = useMemo(() => analytics?.paymentStats || [], [analytics]);
  const escrowRows = useMemo(() => analytics?.escrowStats || [], [analytics]);

  const exportCsvReport = () => {
    const escapeCsv = (value = '') => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const rows = [
      ['Section', 'Metric', 'Value'],
      ['Report', 'Generated', new Date().toLocaleString()],
      ['Report', 'Period', period],
      ['Executive Summary', 'Revenue', formatCurrency(summary.totalRevenue || 0)],
      ['Executive Summary', 'Orders', formatNumber(summary.totalOrders || 0)],
      ['Executive Summary', 'Users', formatNumber(summary.totalUsers || 0)],
      ['Executive Summary', 'Products', formatNumber(summary.totalProducts || 0)],
      ['Executive Summary', 'Active Logistics', formatNumber(summary.activeLogistics || 0)],
      ['Financials', 'Marketplace', formatCurrency(financials.marketplaceRevenue || 0)],
      ['Financials', 'Subscriptions', formatCurrency(financials.subscriptionRevenue || 0)],
      ['Financials', 'Platform Fees', formatCurrency(financials.platformFeeRevenue || 0)],
      ['Financials', 'Escrow Held', formatCurrency(financials.escrowHeld || 0)],
      ...(analytics?.topProducts || []).slice(0, 8).map((item) => [
        'Top Products',
        item.product?.name || 'Unnamed',
        `${formatCurrency(item.revenue || 0)} | ${formatNumber(item.totalSold || 0)} sold`,
      ]),
    ];
    const csv = rows.map((row) => row.map(escapeCsv).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `admin_platform_analytics_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex h-80 items-center justify-center">
        <div className="text-center">
          <FaSpinner className="mx-auto mb-3 animate-spin text-4xl text-[#F97316]" />
          <p className="text-gray-600">Loading platform analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="mx-auto max-w-screen-2xl space-y-6">
        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-[#F97316]">Admin analytics</p>
              <h1 className="mt-2 text-2xl font-bold text-gray-950">Lango Market platform performance</h1>
              <p className="mt-1 text-sm text-gray-600">Revenue, users, sellers, products, payments, logistics, escrow, and support activity in one professional view.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                ['week', '7 days'],
                ['month', '30 days'],
                ['year', '12 months'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setPeriod(value);
                    fetchAnalytics(value);
                  }}
                  className={`h-10 rounded-md px-3 text-sm font-semibold ${period === value ? 'bg-[#111827] text-white' : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}`}
                >
                  {label}
                </button>
              ))}
              <button
                type="button"
                onClick={exportCsvReport}
                className="inline-flex h-10 items-center gap-2 rounded-md bg-[#F97316] px-4 text-sm font-semibold text-white hover:bg-[#EA580C]"
              >
                <FaFileExport />
                Export CSV
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard icon={FaMoneyBillWave} label="Marketplace revenue" value={formatCurrency(summary.totalRevenue || 0)} detail={`${formatCurrency(summary.averageOrderValue || 0)} average order`} series={revenueSeries} color="#16A34A" />
          <KpiCard icon={FaShoppingCart} label="Orders" value={formatNumber(summary.totalOrders || 0)} detail={`${formatNumber(summary.deliveredOrders || 0)} delivered`} series={orderSeries} color="#3B82F6" />
          <KpiCard icon={FaUsers} label="Users" value={formatNumber(summary.totalUsers || 0)} detail={`${formatNumber(summary.activeUsers || 0)} active accounts`} series={analytics?.platformUsageTrend || []} color="#F97316" />
          <KpiCard icon={FaTruck} label="Logistics" value={formatNumber(summary.totalLogistics || 0)} detail={`${formatNumber(summary.activeLogistics || 0)} active shipments`} series={fulfillmentSeries} color="#06B6D4" />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
          <Panel title="Revenue Overview" subtitle="Marketplace revenue by day for the selected period">
            <div className="flex h-72 items-end gap-2 border-b border-l border-gray-100 px-2 pb-2">
              {revenueSeries.length ? revenueSeries.map((value, index) => (
                <div key={`${trends[index]?.date || index}`} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                  <div
                    className="w-full rounded-t-md bg-[#16A34A]"
                    style={{ height: `${Math.max(6, (value / maxRevenue) * 230)}px` }}
                    title={`${trends[index]?.date}: ${formatCurrency(value)}`}
                  />
                </div>
              )) : (
                <div className="flex h-full w-full items-center justify-center text-sm text-gray-500">No revenue trend yet.</div>
              )}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-md bg-green-50 p-3">
                <p className="text-xs font-semibold uppercase text-green-700">Marketplace</p>
                <p className="mt-1 text-lg font-bold text-gray-950">{formatCurrency(financials.marketplaceRevenue || 0)}</p>
              </div>
              <div className="rounded-md bg-orange-50 p-3">
                <p className="text-xs font-semibold uppercase text-orange-700">Platform fees</p>
                <p className="mt-1 text-lg font-bold text-gray-950">{formatCurrency(financials.platformFeeRevenue || 0)}</p>
              </div>
              <div className="rounded-md bg-blue-50 p-3">
                <p className="text-xs font-semibold uppercase text-blue-700">Escrow held</p>
                <p className="mt-1 text-lg font-bold text-gray-950">{formatCurrency(financials.escrowHeld || 0)}</p>
              </div>
            </div>
          </Panel>

          <Panel title="Platform Health" subtitle="Verification, fulfillment, product, and GPS readiness">
            <div className="space-y-5">
              <ProgressRow label="Fulfillment" value={operations.fulfillmentRate || 0} color="#16A34A" />
              <ProgressRow label="KYC verified" value={users.kycVerificationRate || 0} color="#3B82F6" />
              <ProgressRow label="Phone verified" value={users.phoneVerificationRate || 0} color="#F97316" />
              <ProgressRow label="GPS coverage" value={operations.gpsCoverageRate || 0} color="#06B6D4" />
              <ProgressRow label="Active products" value={productHealth.active || 0} total={productHealth.total || 0} color="#8B5CF6" detail={`${formatNumber(productHealth.active || 0)} of ${formatNumber(productHealth.total || 0)}`} />
            </div>
          </Panel>
        </section>

        <section className="grid gap-6 xl:grid-cols-3">
          <Panel title="All Users" subtitle="Role distribution and account verification">
            <div className="space-y-4">
              {(analytics?.roleBreakdown || []).map((role) => (
                <ProgressRow key={role.role} label={role.role} value={role.count} total={summary.totalUsers || 0} detail={`${formatNumber(role.count)} users`} color="#F97316" />
              ))}
              <div className="grid grid-cols-2 gap-3 pt-2 text-sm">
                <div className="rounded-md bg-gray-50 p-3">
                  <p className="text-gray-500">Documents</p>
                  <p className="font-bold text-gray-950">{formatNumber(users.documents || 0)}</p>
                </div>
                <div className="rounded-md bg-gray-50 p-3">
                  <p className="text-gray-500">KYC pending</p>
                  <p className="font-bold text-gray-950">{formatNumber(users.kycPending || 0)}</p>
                </div>
              </div>
            </div>
          </Panel>

          <Panel title="Product Health" subtitle="Catalog status across sellers">
            <div className="grid grid-cols-2 gap-3">
              {[
                ['Total', productHealth.total, FaBox, '#111827'],
                ['Active', productHealth.active, FaClipboardCheck, '#16A34A'],
                ['Inactive', productHealth.inactive, FaShieldAlt, '#F59E0B'],
                ['Low stock', productHealth.lowStock, FaStore, '#DC2626'],
              ].map(([label, value, Icon, color]) => (
                <div key={label} className="rounded-md border border-gray-100 bg-gray-50 p-3">
                  <Icon style={{ color }} />
                  <p className="mt-3 text-xs font-semibold uppercase text-gray-500">{label}</p>
                  <p className="text-xl font-bold text-gray-950">{formatNumber(value || 0)}</p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Payments & Escrow" subtitle="Money movement by type and escrow status">
            <div className="space-y-4">
              {paymentRows.slice(0, 5).map((row) => (
                <div key={row._id || 'payment'} className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold capitalize text-gray-800">{String(row._id || 'payment').replace(/_/g, ' ')}</p>
                    <p className="text-xs text-gray-500">{formatNumber(row.count)} transactions</p>
                  </div>
                  <p className="font-semibold text-gray-950">{formatCurrency(row.amount || 0)}</p>
                </div>
              ))}
              {escrowRows.slice(0, 4).map((row) => (
                <div key={`escrow-${row._id || 'status'}`} className="flex items-center justify-between gap-3 rounded-md bg-blue-50 p-3">
                  <p className="text-sm font-semibold capitalize text-blue-900">{String(row._id || 'escrow').replace(/_/g, ' ')}</p>
                  <p className="font-semibold text-blue-900">{formatCurrency(row.amount || 0)}</p>
                </div>
              ))}
            </div>
          </Panel>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <Panel title="Top Products" subtitle="Best sellers by revenue">
            <div className="space-y-3">
              {(analytics?.topProducts || []).slice(0, 8).map((item, index) => (
                <div key={item._id || index} className="flex items-center justify-between gap-4 rounded-md bg-gray-50 p-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-gray-950">{item.product?.name || 'Unnamed product'}</p>
                    <p className="text-sm text-gray-500">{formatNumber(item.totalSold || 0)} sold | {formatNumber(item.orderCount || 0)} orders</p>
                  </div>
                  <p className="font-semibold text-green-700">{formatCurrency(item.revenue || 0)}</p>
                </div>
              ))}
              {!analytics?.topProducts?.length && <p className="text-sm text-gray-500">No product sales yet.</p>}
            </div>
          </Panel>

          <Panel title="Seller Performance" subtitle="Top sellers by completed revenue">
            <div className="space-y-3">
              {(analytics?.sellerPerformance || analytics?.farmerPerformance || []).slice(0, 8).map((seller, index) => (
                <div key={seller.sellerId || seller.farmerId || index} className="flex items-center justify-between gap-4 rounded-md bg-gray-50 p-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-gray-950">{seller.farmer?.businessName || seller.farmer?.fullName || seller.farmer?.name || 'Unknown seller'}</p>
                    <p className="text-sm text-gray-500">{formatNumber(seller.orderCount || 0)} orders | {formatNumber(seller.totalSold || 0)} units</p>
                  </div>
                  <p className="font-semibold text-green-700">{formatCurrency(seller.revenue || 0)}</p>
                </div>
              ))}
              {!analytics?.sellerPerformance?.length && !analytics?.farmerPerformance?.length && <p className="text-sm text-gray-500">No seller performance yet.</p>}
            </div>
          </Panel>
        </section>

        <Panel title="Recent Platform Activity" subtitle="Latest orders, users, logistics updates, and payments">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Activity</th>
                  <th className="px-4 py-3">Detail</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(analytics?.recentActivity || []).map((item, index) => (
                  <tr key={`${item.type}-${index}`} className="bg-white">
                    <td className="px-4 py-3 font-semibold capitalize text-gray-800">{item.type}</td>
                    <td className="px-4 py-3 text-gray-950">{item.title}</td>
                    <td className="px-4 py-3 text-gray-600">{item.detail}</td>
                    <td className="px-4 py-3 font-semibold text-green-700">{item.amount ? formatCurrency(item.amount) : '-'}</td>
                    <td className="px-4 py-3 text-gray-500">{item.createdAt ? new Date(item.createdAt).toLocaleString() : '-'}</td>
                  </tr>
                ))}
                {!analytics?.recentActivity?.length && (
                  <tr>
                    <td className="px-4 py-6 text-center text-gray-500" colSpan={5}>No recent activity available.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  );
};

export default AdminAnalytics;
