import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FaArrowRight,
  FaBars,
  FaBoxOpen,
  FaChartLine,
  FaCheckCircle,
  FaClipboardList,
  FaCrown,
  FaLock,
  FaShieldAlt,
  FaSms,
  FaStore,
  FaTimes,
  FaTruck,
  FaWallet,
} from 'react-icons/fa';
import { FEATURE_LABELS, PLAN_IDS, TRADER_PLANS } from '../config/subscriptionPlans';
import { useAuth } from '../context/AuthContext';
import heroImage from '../assets/images/360_F_273670292_Gcald9BW9G1oHm8fqEcIPfrghFbfXm9d.webp';
import operationsImage from '../assets/images/240_F_736429436_NpVWpeNSbzAx35soBFulMc5N4MUO30NV.jpg';

const planAccent = {
  [PLAN_IDS.SOLO]: {
    badge: 'For lean catalog control',
    color: '#0B2D55',
    surface: 'bg-blue-50',
    border: 'border-blue-200',
  },
  [PLAN_IDS.SMART]: {
    badge: 'Most balanced',
    color: '#F97316',
    surface: 'bg-orange-50',
    border: 'border-orange-200',
  },
  [PLAN_IDS.GROWTH]: {
    badge: 'For larger teams',
    color: '#16A34A',
    surface: 'bg-green-50',
    border: 'border-green-200',
  },
};

const planHighlights = {
  [PLAN_IDS.SOLO]: ['Digital catalog discipline', 'QR-linked stock movement', 'Seller wallet readiness'],
  [PLAN_IDS.SMART]: ['RFQ and related products', 'Inventory alerts', '500 SMS credits'],
  [PLAN_IDS.GROWTH]: ['Staff controls', 'Bill and burn tracking', 'Audit-ready reporting'],
};

const comparisonRows = [
  { label: 'Catalog allowance', values: { solo: '200 products', smart: '5,000 products', growth: '10,000 products' } },
  { label: 'Stock movement ledger', values: { solo: 'Included', smart: 'Included', growth: 'Included' } },
  { label: 'Customer and order tools', values: { solo: 'Core', smart: 'Advanced', growth: 'Advanced' } },
  { label: 'SMS credits per cycle', values: { solo: '20', smart: '500', growth: '2,000' } },
  { label: 'Operational intelligence', values: { solo: 'Ledger view', smart: 'Profit and alerts', growth: 'Full control suite' } },
];

const operatingBlocks = [
  { icon: FaClipboardList, label: 'Stock Discipline', text: 'Track product movement, catalog limits, and inventory history from one seller workspace.' },
  { icon: FaWallet, label: 'Escrow Confidence', text: 'Orders, wallets, withdrawals, and payouts stay tied to clear seller operations.' },
  { icon: FaTruck, label: 'Logistics Ready', text: 'Higher tiers connect sellers to logistics command tools and delivery visibility.' },
];

const landingNavLinks = [
  { label: 'Plans', href: '#plans' },
  { label: 'Capabilities', href: '#capabilities' },
  { label: 'Comparison', href: '#comparison' },
];

const getPlanUrl = (planId, isSeller) => {
  const encodedPlan = encodeURIComponent(planId);
  return isSeller
    ? `/seller/subscription-plans?plan=${encodedPlan}`
    : `/register?role=seller&plan=${encodedPlan}`;
};

const SellerPlansNavbar = ({ isSeller }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const primaryUrl = isSeller ? '/seller/subscription-plans' : '/register?role=seller';

  const closeMenu = () => setIsMenuOpen(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#0B1220]/95 text-white shadow-xl backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-screen-2xl items-center justify-between gap-4 px-4 md:px-6">
        <Link to="/" className="flex min-w-0 items-center gap-2 hover:opacity-90" onClick={closeMenu}>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white">
            <img src="/marketpulse-logo.png" alt="MarketPulse Logo" className="h-6 w-6" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-extrabold leading-none tracking-wide">LANGO MARKET PULSE</span>
            <span className="mt-1 block text-xs font-semibold text-[#FDBA74]">Seller Plans</span>
          </span>
        </Link>

        <div className="hidden items-center gap-6 md:flex">
          {landingNavLinks.map((item) => (
            <a key={item.href} href={item.href} className="text-sm font-semibold text-gray-200 transition hover:text-[#FDBA74]">
              {item.label}
            </a>
          ))}
          <Link to="/products" className="text-sm font-semibold text-gray-200 transition hover:text-[#FDBA74]">
            Marketplace
          </Link>
        </div>

        <div className="hidden items-center gap-2 md:flex">
          {!isSeller && (
            <Link to="/login" className="inline-flex min-h-10 items-center justify-center rounded-md border border-white/15 px-4 text-sm font-semibold text-white transition hover:bg-white/10">
              Seller Sign In
            </Link>
          )}
          <Link to={primaryUrl} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-[#F97316] px-4 text-sm font-semibold text-white transition hover:bg-[#EA580C]">
            {isSeller ? 'Manage Plan' : 'Create Seller Account'} <FaArrowRight size={12} />
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setIsMenuOpen((current) => !current)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-white/15 text-white md:hidden"
          aria-label="Toggle seller plans menu"
        >
          {isMenuOpen ? <FaTimes /> : <FaBars />}
        </button>
      </nav>

      {isMenuOpen && (
        <div className="border-t border-white/10 bg-[#0B1220] px-4 py-4 md:hidden">
          <div className="grid gap-3">
            {landingNavLinks.map((item) => (
              <a key={item.href} href={item.href} onClick={closeMenu} className="rounded-md px-3 py-2 text-sm font-semibold text-gray-100 hover:bg-white/10">
                {item.label}
              </a>
            ))}
            <Link to="/products" onClick={closeMenu} className="rounded-md px-3 py-2 text-sm font-semibold text-gray-100 hover:bg-white/10">
              Marketplace
            </Link>
            {!isSeller && (
              <Link to="/login" onClick={closeMenu} className="rounded-md border border-white/15 px-3 py-2 text-center text-sm font-semibold text-white">
                Seller Sign In
              </Link>
            )}
            <Link to={primaryUrl} onClick={closeMenu} className="rounded-md bg-[#F97316] px-3 py-2 text-center text-sm font-semibold text-white">
              {isSeller ? 'Manage Plan' : 'Create Seller Account'}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
};

const PlanLandingCard = ({ plan, isSeller }) => {
  const accent = planAccent[plan.id] || planAccent[PLAN_IDS.SOLO];
  const features = plan.featureKeys;

  return (
    <article id={`seller-plan-${plan.id}`} className={`flex h-full flex-col rounded-lg border ${accent.border} bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`inline-flex rounded-full ${accent.surface} px-2.5 py-1 text-xs font-semibold`} style={{ color: accent.color }}>
            {accent.badge}
          </p>
          <h3 className="mt-3 text-2xl font-bold text-[#111827]">{plan.name}</h3>
          <p className="mt-1 text-sm font-semibold text-[#6B7280]">{plan.differentiator}</p>
        </div>
        <FaCrown className="shrink-0 text-xl" style={{ color: accent.color }} />
      </div>

      <div className="mt-5">
        <p className="text-3xl font-bold text-[#111827]">{plan.priceLabel.replace(' / ', ' / ')}</p>
        <p className="mt-2 text-sm text-[#6B7280]">{plan.description}</p>
      </div>

      <div className="mt-5 grid gap-2">
        {(planHighlights[plan.id] || []).map((item) => (
          <div key={item} className="flex items-center gap-2 rounded-md bg-gray-50 px-3 py-2 text-sm font-medium text-[#374151]">
            <FaCheckCircle className="shrink-0 text-[#16A34A]" />
            <span>{item}</span>
          </div>
        ))}
      </div>

      <ul className="mt-5 flex-1 space-y-2">
        {features.map((featureKey) => (
          <li key={featureKey} className="flex items-start gap-2 text-sm text-[#374151]">
            <FaCheckCircle className="mt-0.5 shrink-0 text-[#16A34A]" />
            <span>{FEATURE_LABELS[featureKey] || featureKey}</span>
          </li>
        ))}
      </ul>

      <div className="mt-5 grid gap-2">
        <Link
          to={getPlanUrl(plan.id, isSeller)}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[#111827] px-4 text-sm font-semibold text-white transition hover:bg-black"
        >
          {isSeller ? 'Manage Plan' : 'Choose Plan'} <FaArrowRight size={12} />
        </Link>
        {!isSeller && (
          <Link
            to={`/login?next=${encodeURIComponent(`/seller/subscription-plans?plan=${plan.id}`)}`}
            className="inline-flex min-h-11 items-center justify-center rounded-md border border-gray-200 bg-white px-4 text-sm font-semibold text-[#111827] transition hover:bg-gray-50"
          >
            Sign In As Seller
          </Link>
        )}
      </div>
    </article>
  );
};

const SellerPlansLanding = () => {
  const { isSeller } = useAuth();

  const headlineStats = useMemo(() => ([
    { label: 'Catalog capacity', value: '200-10,000', icon: FaBoxOpen },
    { label: 'Monthly seller tiers', value: '3', icon: FaStore },
    { label: 'SMS credits', value: '20-2,000', icon: FaSms },
    { label: 'Escrow-ready tools', value: 'Included', icon: FaShieldAlt },
  ]), []);

  return (
    <div className="bg-[#F7F8FA] text-[#111827]">
      <SellerPlansNavbar isSeller={isSeller} />

      <section className="relative min-h-screen overflow-hidden">
        <img src={heroImage} alt="Lango MarketPulse seller operations" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-[#111827]/78" />
        <div className="relative mx-auto flex min-h-screen max-w-screen-2xl items-center px-4 pb-14 pt-24 md:px-6">
          <div className="grid w-full gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div className="max-w-3xl text-white">
              <p className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#FDBA74]">
                Seller Subscription Plans
              </p>
              <h1 className="mt-5 text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">
                A professional operating system for serious sellers.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-gray-200 sm:text-lg">
                Compare Solo, Smart, and Growth tiers built for catalog control, inventory discipline, escrow-backed selling, customer reach, and operational intelligence.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a href="#plans" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-[#F97316] px-5 text-sm font-semibold text-white transition hover:bg-[#EA580C]">
                  Compare Plans <FaArrowRight size={13} />
                </a>
                <Link to="/register?role=seller" className="inline-flex min-h-12 items-center justify-center rounded-md border border-white/30 bg-white/10 px-5 text-sm font-semibold text-white transition hover:bg-white/20">
                  Create Seller Account
                </Link>
              </div>
            </div>

            <div className="rounded-lg border border-white/15 bg-white/95 p-5 shadow-2xl">
              <div className="flex items-center justify-between gap-4 border-b border-gray-100 pb-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#F97316]">Business control panel</p>
                  <h2 className="mt-1 text-xl font-bold text-[#111827]">Seller growth snapshot</h2>
                </div>
                <FaChartLine className="text-2xl text-[#16A34A]" />
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {headlineStats.map(({ label, value, icon: Icon }) => (
                  <div key={label} className="rounded-md border border-gray-100 bg-gray-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold uppercase text-gray-500">{label}</p>
                      <Icon className="text-[#F97316]" />
                    </div>
                    <p className="mt-2 text-2xl font-bold text-[#111827]">{value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-5 overflow-hidden rounded-md border border-gray-100">
                <img src={operationsImage} alt="Seller product operations" className="h-48 w-full object-cover" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="capabilities" className="scroll-mt-20 border-b border-gray-200 bg-white">
        <div className="mx-auto grid max-w-screen-2xl gap-4 px-4 py-6 md:grid-cols-3 md:px-6">
          {operatingBlocks.map(({ icon: Icon, label, text }) => (
            <div key={label} className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#FFF7ED] text-[#F97316]">
                <Icon />
              </span>
              <div>
                <h2 className="text-sm font-bold text-[#111827]">{label}</h2>
                <p className="mt-1 text-sm leading-6 text-[#6B7280]">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="plans" className="mx-auto max-w-screen-2xl scroll-mt-20 px-4 py-12 md:px-6">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-wide text-[#F97316]">Pricing built for operators</p>
            <h2 className="mt-2 text-3xl font-bold text-[#111827]">Choose the tier that matches your selling rhythm.</h2>
            <p className="mt-3 text-sm leading-6 text-[#6B7280]">
              Start with a clean ledger, move into customer intelligence, then scale into full control for bigger teams and higher-volume sellers.
            </p>
          </div>
          <Link to="/login" className="inline-flex min-h-10 items-center gap-2 rounded-md border border-gray-200 bg-white px-4 text-sm font-semibold text-[#111827] hover:bg-gray-50">
            Existing seller sign in
          </Link>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          {TRADER_PLANS.map((plan) => (
            <PlanLandingCard
              key={plan.id}
              plan={plan}
              isSeller={isSeller}
            />
          ))}
        </div>
      </section>

      <section id="comparison" className="scroll-mt-20 bg-white">
        <div className="mx-auto max-w-screen-2xl px-4 py-12 md:px-6">
          <div className="mb-6 max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-wide text-[#F97316]">Plan comparison</p>
            <h2 className="mt-2 text-3xl font-bold text-[#111827]">Clear limits, clear growth path.</h2>
          </div>
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
            <table className="min-w-[760px] w-full text-left text-sm">
              <thead className="bg-[#111827] text-white">
                <tr>
                  <th className="px-4 py-4 font-semibold">Capability</th>
                  {TRADER_PLANS.map((plan) => (
                    <th key={plan.id} className="px-4 py-4 font-semibold">{plan.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {comparisonRows.map((row) => (
                  <tr key={row.label} className="hover:bg-gray-50">
                    <td className="px-4 py-4 font-semibold text-[#111827]">{row.label}</td>
                    {TRADER_PLANS.map((plan) => (
                      <td key={plan.id} className="px-4 py-4 text-[#374151]">{row.values[plan.id]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="bg-[#111827] px-4 py-12 text-white md:px-6">
        <div className="mx-auto flex max-w-screen-2xl flex-wrap items-center justify-between gap-6">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-wide text-[#FDBA74]">Ready to sell professionally?</p>
            <h2 className="mt-2 text-3xl font-bold">Open a seller account and choose your plan.</h2>
            <p className="mt-3 text-sm leading-6 text-gray-300">
              Your storefront, catalog, inventory tools, customer capture, and seller wallet all start from the same subscription path.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to="/register?role=seller" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-[#F97316] px-5 text-sm font-semibold text-white hover:bg-[#EA580C]">
              Register As Seller <FaArrowRight size={13} />
            </Link>
            <Link to="/login" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-white/20 bg-white/10 px-5 text-sm font-semibold text-white hover:bg-white/20">
              <FaLock size={13} /> Seller Sign In
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default SellerPlansLanding;
