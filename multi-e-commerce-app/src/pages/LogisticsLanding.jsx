import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FaArrowRight,
  FaBars,
  FaCheckCircle,
  FaClipboardCheck,
  FaHeadset,
  FaLock,
  FaMapMarkedAlt,
  FaQrcode,
  FaRoute,
  FaShieldAlt,
  FaTimes,
  FaTools,
  FaTruck,
  FaWallet,
} from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import heroImage from '../assets/images/240_F_1774361843_6YgNSKGVwKOPZSrhZ4P326nfhq8atTuG.jpg';
import operationsImage from '../assets/images/240_F_1204665252_ZX7G4szbgbzeLf9M2OSYKu32GfBT6qWC.jpg';

const landingNavLinks = [
  { label: 'Operations', href: '#operations' },
  { label: 'Proof Tools', href: '#proof' },
  { label: 'Apply', href: '#apply' },
];

const capabilityBlocks = [
  {
    icon: FaMapMarkedAlt,
    label: 'Live Delivery Visibility',
    text: 'Share route status, driver movement, pickup progress, and delivery updates with the buyer and seller.',
  },
  {
    icon: FaQrcode,
    label: 'QR Handoff Proof',
    text: 'Confirm pickup and delivery with scan-based records that support cleaner dispute resolution.',
  },
  {
    icon: FaWallet,
    label: 'Escrow-Linked Payouts',
    text: 'Delivery earnings stay connected to order completion, proof of delivery, and wallet settlement flows.',
  },
];

const operatingCards = [
  {
    icon: FaTruck,
    title: 'Assignment Dashboard',
    text: 'Manage delivery requests, trip progress, pickup points, customer details, and status updates from one workspace.',
  },
  {
    icon: FaRoute,
    title: 'Route Intelligence',
    text: 'Use hub information, nearby-driver workflows, delivery stats, and shared trip tools to organize movement.',
  },
  {
    icon: FaShieldAlt,
    title: 'Trust And Compliance',
    text: 'Verification, QR scans, delivery history, and admin review tools help make provider activity accountable.',
  },
  {
    icon: FaHeadset,
    title: 'Support Ready',
    text: 'Keep support, application status, order references, and provider information available when help is needed.',
  },
];

const proofRows = [
  { label: 'Pickup confirmation', value: 'QR scan and timestamp' },
  { label: 'Delivery confirmation', value: 'Receiver QR proof' },
  { label: 'Tracking status', value: 'Seller and buyer visibility' },
  { label: 'Settlement path', value: 'Escrow release to wallet' },
];

const applicationSteps = [
  'Create a logistics provider account.',
  'Complete your logistics application and business profile.',
  'Wait for admin verification before receiving full provider access.',
  'Accept delivery work, update trips, scan QR proof, and track payouts.',
];

const LogisticsLandingNavbar = ({ isLogisticsProvider }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const primaryUrl = isLogisticsProvider ? '/logistics/dashboard' : '/register?role=logistics';
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
            <span className="mt-1 block text-xs font-semibold text-[#FDBA74]">Logistics Providers</span>
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
          {!isLogisticsProvider && (
            <Link to="/login?role=logistics" className="inline-flex min-h-10 items-center justify-center rounded-md border border-white/15 px-4 text-sm font-semibold text-white transition hover:bg-white/10">
              Provider Sign In
            </Link>
          )}
          <Link to={primaryUrl} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-[#F97316] px-4 text-sm font-semibold text-white transition hover:bg-[#EA580C]">
            {isLogisticsProvider ? 'Open Dashboard' : 'Create Provider Account'} <FaArrowRight size={12} />
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setIsMenuOpen((current) => !current)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-white/15 text-white md:hidden"
          aria-label="Toggle logistics landing menu"
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
            {!isLogisticsProvider && (
              <Link to="/login?role=logistics" onClick={closeMenu} className="rounded-md border border-white/15 px-3 py-2 text-center text-sm font-semibold text-white">
                Provider Sign In
              </Link>
            )}
            <Link to={primaryUrl} onClick={closeMenu} className="rounded-md bg-[#F97316] px-3 py-2 text-center text-sm font-semibold text-white">
              {isLogisticsProvider ? 'Open Dashboard' : 'Create Provider Account'}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
};

const LogisticsLanding = () => {
  const { user } = useAuth();
  const isLogisticsProvider = String(user?.role || '').toLowerCase() === 'logistics';

  const headlineStats = useMemo(() => ([
    { label: 'Provider workflow', value: 'Verified', icon: FaClipboardCheck },
    { label: 'Pickup and delivery', value: 'QR proof', icon: FaQrcode },
    { label: 'Route tools', value: 'Live', icon: FaRoute },
    { label: 'Payout path', value: 'Wallet', icon: FaWallet },
  ]), []);

  return (
    <div className="bg-[#F7F8FA] text-[#111827]">
      <LogisticsLandingNavbar isLogisticsProvider={isLogisticsProvider} />

      <section className="relative min-h-screen overflow-hidden">
        <img src={heroImage} alt="Lango MarketPulse logistics provider route" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-[#0B1220]/80" />
        <div className="relative mx-auto flex min-h-screen max-w-screen-2xl items-center px-4 pb-14 pt-24 md:px-6">
          <div className="grid w-full gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div className="max-w-3xl text-white">
              <p className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#FDBA74]">
                Logistics Provider Network
              </p>
              <h1 className="mt-5 text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">
                Deliver orders with proof, visibility, and trusted payouts.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-gray-200 sm:text-lg">
                Join the Lango MarketPulse logistics workflow for seller assignments, live delivery updates, QR handoffs, route tools, and escrow-linked settlement.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a href="#apply" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-[#F97316] px-5 text-sm font-semibold text-white transition hover:bg-[#EA580C]">
                  Start Provider Application <FaArrowRight size={13} />
                </a>
                <Link to="/login?role=logistics" className="inline-flex min-h-12 items-center justify-center rounded-md border border-white/30 bg-white/10 px-5 text-sm font-semibold text-white transition hover:bg-white/20">
                  Logistics Sign In
                </Link>
              </div>
            </div>

            <div className="rounded-lg border border-white/15 bg-white/95 p-5 shadow-2xl">
              <div className="flex items-center justify-between gap-4 border-b border-gray-100 pb-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#F97316]">Provider control panel</p>
                  <h2 className="mt-1 text-xl font-bold text-[#111827]">Delivery readiness snapshot</h2>
                </div>
                <FaTruck className="text-2xl text-[#16A34A]" />
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
                <img src={operationsImage} alt="Logistics operations workspace" className="h-48 w-full object-cover" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="operations" className="scroll-mt-20 border-b border-gray-200 bg-white">
        <div className="mx-auto grid max-w-screen-2xl gap-4 px-4 py-6 md:grid-cols-3 md:px-6">
          {capabilityBlocks.map(({ icon: Icon, label, text }) => (
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

      <section className="mx-auto max-w-screen-2xl px-4 py-12 md:px-6">
        <div className="mb-7 max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-[#F97316]">Built for delivery operators</p>
          <h2 className="mt-2 text-3xl font-bold text-[#111827]">Everything a verified provider needs to manage marketplace trips.</h2>
        </div>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {operatingCards.map(({ icon: Icon, title, text }) => (
            <article key={title} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
              <span className="flex h-11 w-11 items-center justify-center rounded-md bg-[#111827] text-white">
                <Icon />
              </span>
              <h3 className="mt-4 text-lg font-bold text-[#111827]">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-[#6B7280]">{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="proof" className="scroll-mt-20 bg-white">
        <div className="mx-auto grid max-w-screen-2xl gap-8 px-4 py-12 md:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-[#F97316]">Proof and payout flow</p>
            <h2 className="mt-2 text-3xl font-bold text-[#111827]">Keep buyers, sellers, and providers aligned on every delivery.</h2>
            <p className="mt-4 text-sm leading-7 text-[#6B7280]">
              The logistics workspace connects assignment updates, QR handoffs, delivery proof, and wallet payout records so delivery work is easier to trust.
            </p>
          </div>
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <tbody className="divide-y divide-gray-100">
                {proofRows.map((row) => (
                  <tr key={row.label} className="hover:bg-gray-50">
                    <td className="px-4 py-4 font-semibold text-[#111827]">{row.label}</td>
                    <td className="px-4 py-4 text-[#374151]">{row.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section id="apply" className="scroll-mt-20 bg-[#111827] px-4 py-12 text-white md:px-6">
        <div className="mx-auto grid max-w-screen-2xl gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-wide text-[#FDBA74]">Become a verified logistics provider</p>
            <h2 className="mt-2 text-3xl font-bold">Create your provider account and complete verification.</h2>
            <p className="mt-3 text-sm leading-6 text-gray-300">
              Once approved, you can manage assignments, GPS tracking, QR handoffs, wallet payouts, and delivery proof from the logistics dashboard.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/register?role=logistics" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-[#F97316] px-5 text-sm font-semibold text-white hover:bg-[#EA580C]">
                Register As Logistics <FaArrowRight size={13} />
              </Link>
              <Link to="/login?role=logistics" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-white/20 bg-white/10 px-5 text-sm font-semibold text-white hover:bg-white/20">
                <FaLock size={13} /> Provider Sign In
              </Link>
            </div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-5">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-[#F97316] text-white">
                <FaTools />
              </span>
              <h3 className="text-xl font-bold">Application path</h3>
            </div>
            <ul className="grid gap-3">
              {applicationSteps.map((step) => (
                <li key={step} className="flex items-start gap-3 rounded-md bg-white/5 p-3 text-sm text-gray-200">
                  <FaCheckCircle className="mt-0.5 shrink-0 text-[#FDBA74]" />
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
};

export default LogisticsLanding;
