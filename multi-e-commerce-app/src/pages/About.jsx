// src/pages/About.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import {
  FaArrowRight,
  FaBolt,
  FaBrain,
  FaChartLine,
  FaCheckCircle,
  FaCrown,
  FaHandshake,
  FaHeadset,
  FaMoneyBillWave,
  FaShieldAlt,
  FaStore,
  FaTruck,
  FaUsers,
} from 'react-icons/fa';
import { TRADER_PLANS } from '../config/subscriptionPlans';
import aboutHeroImage from '../assets/images/1000_F_1388403127_VLbGx3CB7xsMA56fZaMgN2TdpDTVY556.webp';
import businessImage from '../assets/images/240_F_736429436_NpVWpeNSbzAx35soBFulMc5N4MUO30NV.jpg';
import customerImage from '../assets/images/240_F_725819555_bH4Tv8G1KWOdwC60nwFHDZtGAmTHa2V8.jpg';

const marketplaceStats = [
  { value: '6+', label: 'Seller types supported' },
  { value: '24/7', label: 'Order visibility' },
  { value: '3', label: 'Seller growth tiers' },
  { value: 'KES', label: 'Local-first commerce' },
];

const audienceBlocks = [
  {
    title: 'For customers',
    image: customerImage,
    icon: FaUsers,
    accent: '#16A34A',
    text: 'Discover products from farmers, retailers, wholesalers, manufacturers, brands, and small businesses in one trusted marketplace.',
    points: ['Transparent listings', 'Real-time order tracking', 'Ratings, reviews, and wishlists'],
    cta: 'Start Shopping',
    to: '/products',
  },
  {
    title: 'For businesses',
    image: businessImage,
    icon: FaStore,
    accent: '#F97316',
    text: 'Publish products, manage orders, monitor inventory, and grow with practical tools built for everyday trade operations.',
    points: ['Storefront and catalog tools', 'Inventory and order dashboards', 'Seller wallet and subscription path'],
    cta: 'Explore Seller Plans',
    to: '/seller-plans',
  },
];

const trustPillars = [
  { icon: FaShieldAlt, title: 'Protected commerce', text: 'Checkout, escrow-ready flows, and clear order records help reduce confusion between buyers and sellers.' },
  { icon: FaTruck, title: 'Trackable logistics', text: 'Delivery updates and logistics visibility keep both parties aligned after the order is placed.' },
  { icon: FaMoneyBillWave, title: 'Transparent value', text: 'Local pricing, seller details, minimum order rules, and product context make decisions easier.' },
  { icon: FaHeadset, title: 'Platform support', text: 'Support workflows give customers, sellers, and administrators a shared path for resolving issues.' },
];

const intelligenceFeatures = [
  { icon: FaBrain, title: 'Market intelligence', text: 'Signals, alerts, and marketplace data help sellers understand demand and respond faster.' },
  { icon: FaChartLine, title: 'Growth visibility', text: 'Dashboards turn products, orders, stock movement, and revenue activity into readable decisions.' },
  { icon: FaBolt, title: 'Operational speed', text: 'QR-linked stock movement, notifications, and seller tools reduce repetitive manual work.' },
  { icon: FaHandshake, title: 'Trusted relationships', text: 'Profiles, reviews, order history, and clear roles help build stronger marketplace confidence.' },
];

const About = () => {
  return (
    <div className="bg-[#F5F7FA] text-[#111827]">
      <section className="relative min-h-[72vh] overflow-hidden">
        <img
          src={aboutHeroImage}
          alt="Lango MarketPulse marketplace operations"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-[#0B1220]/78" />
        <div className="relative mx-auto flex min-h-[72vh] max-w-screen-2xl items-center px-4 py-16 md:px-6">
          <div className="max-w-4xl text-white">
            <p className="inline-flex rounded-md border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#FDBA74]">
              Trade and Intelligence OS
            </p>
            <h1 className="mt-5 text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">
              Lango MarketPulse
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-7 text-gray-100 sm:text-lg">
              A professional marketplace built to connect customers, sellers, farmers, retailers,
              wholesalers, manufacturers, and logistics partners through trusted commerce and practical business intelligence.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/products" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-[#F97316] px-5 text-sm font-semibold text-white transition hover:bg-[#EA580C]">
                Explore Marketplace <FaArrowRight size={13} />
              </Link>
              <Link to="/seller-plans" className="inline-flex min-h-12 items-center justify-center rounded-md border border-white/30 bg-white/10 px-5 text-sm font-semibold text-white transition hover:bg-white/20">
                View Seller Plans
              </Link>
            </div>
          </div>
        </div>
        <div className="relative mx-auto -mt-24 max-w-screen-2xl px-4 pb-8 md:px-6">
          <div className="grid overflow-hidden rounded-lg border border-white/15 bg-white shadow-xl md:grid-cols-4">
            {marketplaceStats.map((stat) => (
              <div key={stat.label} className="border-b border-gray-100 p-5 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0">
                <p className="text-3xl font-bold text-[#F97316]">{stat.value}</p>
                <p className="mt-1 text-sm font-medium text-[#6B7280]">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto grid max-w-screen-2xl gap-8 px-4 py-14 md:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-[#F97316]">Who we are</p>
            <h2 className="mt-3 text-3xl font-bold leading-tight text-[#111827] md:text-4xl">
              A marketplace for commerce that needs clarity, speed, and trust.
            </h2>
          </div>
          <div className="grid gap-4 text-sm leading-7 text-[#374151] md:grid-cols-2">
            <p>
              Lango MarketPulse brings product discovery, seller operations, buyer workflows, logistics visibility,
              and platform support into one practical commerce ecosystem.
            </p>
            <p>
              The platform is designed for local trade realities: direct selling, transparent product information,
              live order tracking, business growth tools, and admin controls that help protect every party.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-screen-2xl px-4 py-14 md:px-6">
        <div className="mb-7 max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-[#F97316]">Built for both sides</p>
          <h2 className="mt-2 text-3xl font-bold text-[#111827]">Buy with confidence. Sell with control.</h2>
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          {audienceBlocks.map(({ title, image, icon: Icon, accent, text, points, cta, to }) => (
            <article key={title} className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
              <img src={image} alt={title} className="h-64 w-full object-cover" />
              <div className="p-6">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-md bg-gray-50" style={{ color: accent }}>
                    <Icon />
                  </span>
                  <h3 className="text-xl font-bold text-[#111827]">{title}</h3>
                </div>
                <p className="mt-4 text-sm leading-7 text-[#6B7280]">{text}</p>
                <ul className="mt-5 grid gap-2">
                  {points.map((point) => (
                    <li key={point} className="flex items-center gap-2 text-sm font-medium text-[#374151]">
                      <FaCheckCircle className="shrink-0 text-[#16A34A]" />
                      {point}
                    </li>
                  ))}
                </ul>
                <Link to={to} className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[#111827] px-4 text-sm font-semibold text-white transition hover:bg-black">
                  {cta} <FaArrowRight size={12} />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-[#0B1220] text-white">
        <div className="mx-auto max-w-screen-2xl px-4 py-14 md:px-6">
          <div className="mb-8 max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-wide text-[#FDBA74]">Trust infrastructure</p>
            <h2 className="mt-2 text-3xl font-bold">The platform is built around safer, clearer transactions.</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {trustPillars.map(({ icon: Icon, title, text }) => (
              <article key={title} className="rounded-lg border border-white/10 bg-white/5 p-5 transition hover:bg-white/10">
                <Icon className="text-2xl text-[#FDBA74]" />
                <h3 className="mt-4 text-lg font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-gray-300">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto max-w-screen-2xl px-4 py-14 md:px-6">
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-[#F97316]">Intelligence layer</p>
              <h2 className="mt-2 text-3xl font-bold text-[#111827]">More than a marketplace.</h2>
              <p className="mt-4 text-sm leading-7 text-[#6B7280]">
                Lango MarketPulse helps businesses understand activity, react to demand, and operate with better records.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {intelligenceFeatures.map(({ icon: Icon, title, text }) => (
                <article key={title} className="rounded-lg border border-gray-200 bg-[#F9FAFB] p-5">
                  <Icon className="text-2xl text-[#F97316]" />
                  <h3 className="mt-4 font-bold text-[#111827]">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#6B7280]">{text}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-screen-2xl px-4 py-14 md:px-6">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <div className="flex items-center gap-3">
              <FaCrown className="text-2xl text-[#F97316]" />
              <p className="text-sm font-semibold uppercase tracking-wide text-[#F97316]">Seller growth path</p>
            </div>
            <h2 className="mt-2 text-3xl font-bold text-[#111827]">Plans for small shops, serious operators, and growing teams.</h2>
          </div>
          <Link to="/seller-plans" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[#F97316] px-4 text-sm font-semibold text-white transition hover:bg-[#EA580C]">
            Open Full Plans Page <FaArrowRight size={12} />
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {TRADER_PLANS.map((plan) => (
            <article key={plan.id} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="text-xl font-bold text-[#111827]">{plan.name}</h3>
              <p className="mt-1 text-sm font-semibold text-[#6B7280]">{plan.differentiator}</p>
              <p className="mt-4 text-2xl font-bold text-[#F97316]">{plan.priceLabel}</p>
              <p className="mt-2 text-sm leading-6 text-[#6B7280]">{plan.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-[#111827] px-4 py-14 text-white md:px-6">
        <div className="mx-auto flex max-w-screen-2xl flex-wrap items-center justify-between gap-6">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-wide text-[#FDBA74]">Lango Lako la Biashara Smart</p>
            <h2 className="mt-2 text-3xl font-bold">Ready to move through the marketplace with more confidence?</h2>
            <p className="mt-3 text-sm leading-6 text-gray-300">
              Start as a buyer, register as a seller, or explore the business directory to see how Lango MarketPulse connects trade.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to="/products" className="inline-flex min-h-12 items-center justify-center rounded-md bg-[#F97316] px-5 text-sm font-semibold text-white transition hover:bg-[#EA580C]">
              Start Shopping
            </Link>
            <Link to="/seller-plans" className="inline-flex min-h-12 items-center justify-center rounded-md border border-white/20 bg-white/10 px-5 text-sm font-semibold text-white transition hover:bg-white/20">
              Start Selling
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default About;
