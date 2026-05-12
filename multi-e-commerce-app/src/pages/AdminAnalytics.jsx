import React, { useEffect, useRef, useState } from 'react';
import { FaChartLine, FaBox, FaSeedling, FaShoppingCart, FaSpinner, FaArrowUp, FaArrowDown, FaSignal, FaFileExport } from 'react-icons/fa';
import api from '../config/axios';
import { formatCurrency } from '../utils/formatters';

const AdminAnalytics = () => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const fetchedOnceRef = useRef(false);

  useEffect(() => {
    if (fetchedOnceRef.current) return;
    fetchedOnceRef.current = true;

    const fetchAnalytics = async () => {
      try {
        const res = await api.get('/v1/admin/analytics', { params: { period: 'month' } });
        setAnalytics(res.data?.data || null);
      } catch (error) {
        console.error('Error fetching analytics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  const pickSeries = (source) => {
    if (!source) return [];
    if (Array.isArray(source)) return source.map((v) => Number(v) || 0);
    if (typeof source === 'object') {
      const values = Object.values(source).map((v) => Number(v) || 0);
      return values;
    }
    return [];
  };

  const firstNonEmptySeries = (...sources) => {
    for (const source of sources) {
      const series = pickSeries(source);
      if (series.length) return series;
    }
    return [];
  };

  const usageSeries = firstNonEmptySeries(
    analytics?.platformUsageTrend,
    analytics?.usageTrend,
    analytics?.trafficTrend,
    analytics?.visitsTrend
  );

  const visitsSeries = firstNonEmptySeries(
    analytics?.platformVisitsTrend,
    analytics?.dailyVisits,
    analytics?.visitTrend
  );

  const buildChartPoints = (series, width = 280, height = 84) => {
    if (!series.length) return '';
    const max = Math.max(...series);
    const min = Math.min(...series);
    const range = max - min || 1;
    return series
      .map((value, index) => {
        const x = (index / Math.max(series.length - 1, 1)) * width;
        const y = height - ((value - min) / range) * height;
        return `${x},${y}`;
      })
      .join(' ');
  };

  const trendMeta = (series) => {
    if (!series || series.length < 2) {
      return { changePct: 0, direction: 'flat' };
    }
    const first = Number(series[0]) || 0;
    const last = Number(series[series.length - 1]) || 0;
    const raw = first === 0 ? 0 : ((last - first) / Math.abs(first)) * 100;
    return {
      changePct: Number(raw.toFixed(1)),
      direction: raw > 0 ? 'up' : raw < 0 ? 'down' : 'flat',
    };
  };

  const usageTrend = trendMeta(usageSeries);
  const visitsTrend = trendMeta(visitsSeries);
  const usagePoints = buildChartPoints(usageSeries);
  const visitsPoints = buildChartPoints(visitsSeries);

  const exportPdfReport = () => {
    const pdfEscape = (text = '') => String(text).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
    const lines = [];
    let y = 800;
    const left = 48;

    const text = (size, value, x = left) => {
      lines.push(`BT /F1 ${size} Tf ${x} ${y} Td (${pdfEscape(value)}) Tj ET`);
      y -= size + 6;
    };

    const sectionTitle = (value) => {
      y -= 6;
      text(13, value);
      y -= 2;
    };

    const drawBarChart = (series, x, chartY, width, height, rgb = '0.95 0.45 0.09') => {
      if (!series.length) return;
      const max = Math.max(...series) || 1;
      const barWidth = Math.max(4, width / Math.max(1, series.length * 1.8));
      series.forEach((v, i) => {
        const h = (Math.max(0, Number(v) || 0) / max) * height;
        const bx = x + i * (barWidth + 3);
        lines.push(`${rgb} rg`);
        lines.push(`${bx.toFixed(2)} ${chartY.toFixed(2)} ${barWidth.toFixed(2)} ${h.toFixed(2)} re f`);
      });
      lines.push(`0.75 0.75 0.75 RG`);
      lines.push(`${x} ${chartY} ${width} 0 re S`);
    };

    text(18, 'Lango MarketPulse - Admin Analytics Report');
    text(10, `Generated: ${new Date().toLocaleString()}`);
    y -= 6;

    sectionTitle('Platform Trend Overview');
    text(10, `Usage Trend: ${usageTrend.changePct}% ${usageTrend.direction}`);
    text(10, `Visits Trend: ${visitsTrend.changePct}% ${visitsTrend.direction}`);
    const trendChartY = y - 110;
    drawBarChart(usageSeries.slice(0, 18), left, trendChartY, 230, 90, '0.97 0.45 0.09');
    drawBarChart(visitsSeries.slice(0, 18), left + 260, trendChartY, 230, 90, '0.09 0.64 0.27');
    y = trendChartY - 28;

    sectionTitle('Sales by User Type');
    (analytics?.salesByUserType || []).slice(0, 8).forEach((item) => {
      text(10, `${item._id || 'Individual'}: ${item.orderCount || 0} orders | ${formatCurrency(item.totalSales || 0)}`);
    });

    y -= 6;
    sectionTitle('Top Products');
    (analytics?.topProducts || []).slice(0, 8).forEach((item) => {
      text(10, `${item.product?.name || 'Unnamed'}: ${item.totalSold || 0} sold | ${formatCurrency(item.revenue || 0)}`);
    });

    y -= 6;
    sectionTitle('Top Performing Farmers');
    (analytics?.farmerPerformance || []).slice(0, 10).forEach((farmer) => {
      text(
        10,
        `${farmer.farmer?.businessName || farmer.farmer?.name || 'Unknown'} | Orders: ${farmer.orderCount || 0} | Revenue: ${formatCurrency(farmer.revenue || 0)}`
      );
    });

    const content = lines.join('\n');
    const encoder = new TextEncoder();
    const objects = [];
    const pushObj = (str) => objects.push(str);

    pushObj('1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj');
    pushObj('2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj');
    pushObj('3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj');
    pushObj('4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj');
    pushObj(`5 0 obj << /Length ${encoder.encode(content).length} >> stream\n${content}\nendstream endobj`);

    let pdf = '%PDF-1.4\n';
    const offsets = [0];
    objects.forEach((obj) => {
      offsets.push(encoder.encode(pdf).length);
      pdf += `${obj}\n`;
    });
    const xrefStart = encoder.encode(pdf).length;
    pdf += `xref\n0 ${objects.length + 1}\n`;
    pdf += '0000000000 65535 f \n';
    for (let i = 1; i <= objects.length; i += 1) {
      pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
    }
    pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

    const blob = new Blob([pdf], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `admin_analytics_${new Date().toISOString().slice(0, 10)}.pdf`;
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
          <p className="text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#F9FAFB] min-h-screen py-8">
      <div className="container mx-auto px-4">
        <div className="mb-8">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <FaChartLine className="text-3xl text-[#F97316]" />
              <h1 className="text-3xl font-bold text-[#F97316]">Admin Analytics</h1>
            </div>
            <button
              type="button"
              onClick={exportPdfReport}
              className="inline-flex items-center gap-2 rounded-lg bg-[#111827] px-4 py-2 text-sm font-semibold text-white hover:opacity-95"
            >
              <FaFileExport />
              Export PDF
            </button>
          </div>
          <p className="text-[#6B7280]">Performance insights for sales, products, and seller output.</p>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl bg-white p-6 shadow-md">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-lg font-semibold text-[#111827]">
                <FaSignal className="text-[#F97316]" />
                Platform Usage Trend
              </h3>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
                  usageTrend.direction === 'up'
                    ? 'bg-green-100 text-green-700'
                    : usageTrend.direction === 'down'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-gray-100 text-gray-700'
                }`}
              >
                {usageTrend.direction === 'up' ? <FaArrowUp /> : usageTrend.direction === 'down' ? <FaArrowDown /> : null}
                {usageTrend.changePct}% {usageTrend.direction === 'up' ? 'increase' : usageTrend.direction === 'down' ? 'decrease' : 'steady'}
              </span>
            </div>
            {usageSeries.length ? (
              <svg viewBox="0 0 280 84" className="h-24 w-full">
                <polyline fill="none" stroke="#F97316" strokeWidth="3" points={usagePoints} />
              </svg>
            ) : (
              <p className="text-sm text-gray-500">No usage trend data available.</p>
            )}
          </div>

          <div className="rounded-xl bg-white p-6 shadow-md">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-lg font-semibold text-[#111827]">
                <FaChartLine className="text-[#16A34A]" />
                Platform Visits Trend
              </h3>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
                  visitsTrend.direction === 'up'
                    ? 'bg-green-100 text-green-700'
                    : visitsTrend.direction === 'down'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-gray-100 text-gray-700'
                }`}
              >
                {visitsTrend.direction === 'up' ? <FaArrowUp /> : visitsTrend.direction === 'down' ? <FaArrowDown /> : null}
                {visitsTrend.changePct}% {visitsTrend.direction === 'up' ? 'increase' : visitsTrend.direction === 'down' ? 'decrease' : 'steady'}
              </span>
            </div>
            {visitsSeries.length ? (
              <svg viewBox="0 0 280 84" className="h-24 w-full">
                <polyline fill="none" stroke="#16A34A" strokeWidth="3" points={visitsPoints} />
              </svg>
            ) : (
              <p className="text-sm text-gray-500">No visit trend data available.</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl bg-white p-6 shadow-md">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-[#111827]">
              <FaShoppingCart className="text-[#16A34A]" />
              Sales by User Type
            </h3>
            <div className="space-y-3">
              {analytics?.salesByUserType?.length ? (
                analytics.salesByUserType.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
                    <div>
                      <p className="font-medium capitalize">{item._id || 'Individual'}</p>
                      <p className="text-sm text-gray-600">{item.orderCount} orders</p>
                    </div>
                    <p className="font-bold text-[#16A34A]">{formatCurrency(item.totalSales)}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500">No sales analytics available.</p>
              )}
            </div>
          </div>

          <div className="rounded-xl bg-white p-6 shadow-md">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-[#111827]">
              <FaBox className="text-[#F97316]" />
              Top Products
            </h3>
            <div className="space-y-3">
              {analytics?.topProducts?.length ? (
                analytics.topProducts.slice(0, 8).map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
                    <div>
                      <p className="font-medium">{item.product?.name || 'Unnamed Product'}</p>
                      <p className="text-sm text-gray-600">{item.totalSold} sold</p>
                    </div>
                    <p className="font-semibold text-[#16A34A]">{formatCurrency(item.revenue)}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500">No product analytics available.</p>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-xl bg-white p-6 shadow-md">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-[#111827]">
            <FaSeedling className="text-[#16A34A]" />
            Top Performing Farmers
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 text-left">
                <tr>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Orders</th>
                  <th className="px-4 py-2">Total Sold</th>
                  <th className="px-4 py-2">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {analytics?.farmerPerformance?.length ? (
                  analytics.farmerPerformance.slice(0, 10).map((farmer, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="px-4 py-3">{farmer.farmer?.businessName || farmer.farmer?.name || 'Unknown'}</td>
                      <td className="px-4 py-3">{farmer.orderCount}</td>
                      <td className="px-4 py-3">{farmer.totalSold}</td>
                      <td className="px-4 py-3 font-semibold text-[#16A34A]">{formatCurrency(farmer.revenue)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-4 py-3 text-sm text-gray-500" colSpan={4}>
                      No farmer analytics available.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminAnalytics;
