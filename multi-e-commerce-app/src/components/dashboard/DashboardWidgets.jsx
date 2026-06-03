import React from 'react';

export const Sparkline = ({ points = [], color = '#F97316', fill = '#FFEDD5' }) => {
  const values = points.length ? points : [0, 0, 0, 0, 0, 0, 0, 0];
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(max - min, 1);
  const coordinates = values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * 100;
      const y = 34 - ((value - min) / range) * 26;
      return `${x},${y}`;
    })
    .join(' ');
  const area = `0,40 ${coordinates} 100,40`;

  return (
    <svg viewBox="0 0 100 40" className="h-12 w-full" preserveAspectRatio="none" aria-hidden="true">
      <polygon points={area} fill={fill} opacity="0.65" />
      <polyline points={coordinates} fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

export const KpiCard = ({ icon: Icon, label, value, detail, trend, color = '#F97316', points }) => (
  <div className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
        <p className="mt-2 truncate text-2xl font-bold text-[#111827]">{value}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
          {trend && <span className="font-semibold text-[#16A34A]">{trend}</span>}
          {detail && <span>{detail}</span>}
        </div>
      </div>
      {Icon && (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md" style={{ backgroundColor: `${color}18`, color }}>
          <Icon />
        </div>
      )}
    </div>
    <div className="mt-3">
      <Sparkline points={points} color={color} fill={`${color}18`} />
    </div>
  </div>
);

export const Panel = ({ title, action, children, className = '' }) => (
  <section className={`rounded-md border border-gray-200 bg-white p-5 shadow-sm ${className}`}>
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-sm font-semibold text-[#111827]">{title}</h2>
      {action}
    </div>
    {children}
  </section>
);

export const ProgressRow = ({ label, value = 0, max = 100, color = '#F97316', detail }) => {
  const pct = Math.max(0, Math.min(100, max ? (Number(value) / Number(max)) * 100 : Number(value)));

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3 text-xs">
        <span className="truncate text-gray-600">{label}</span>
        <span className="shrink-0 font-medium text-[#111827]">{detail || `${Math.round(pct)}%`}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-gray-100">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
};

export const DonutGauge = ({ value = 0, label, color = '#16A34A', track = '#E5E7EB' }) => {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));

  return (
    <div className="flex flex-col items-center justify-center">
      <div
        className="grid h-32 w-32 place-items-center rounded-full"
        style={{ background: `conic-gradient(${color} ${pct * 3.6}deg, ${track} 0deg)` }}
      >
        <div className="grid h-24 w-24 place-items-center rounded-full bg-white">
          <span className="text-2xl font-bold text-[#111827]">{Math.round(pct)}%</span>
        </div>
      </div>
      {label && <p className="mt-3 text-center text-sm font-medium text-gray-700">{label}</p>}
    </div>
  );
};

export const StatusPill = ({ children, tone = 'gray' }) => {
  const tones = {
    green: 'bg-green-100 text-green-800',
    amber: 'bg-amber-100 text-amber-800',
    blue: 'bg-blue-100 text-blue-800',
    red: 'bg-red-100 text-red-800',
    purple: 'bg-purple-100 text-purple-800',
    gray: 'bg-gray-100 text-gray-700',
  };

  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${tones[tone] || tones.gray}`}>{children}</span>;
};
