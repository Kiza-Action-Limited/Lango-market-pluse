// src/pages/About.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import {
  FaArrowRight,
  FaBell,
  FaChartLine,
  FaCheckCircle,
  FaClipboardCheck,
  FaExclamationTriangle,
  FaHeadset,
  FaLanguage,
  FaLeaf,
  FaMoneyBillWave,
  FaRoute,
  FaShieldAlt,
  FaShoppingBasket,
  FaStore,
  FaTruck,
  FaUsers,
  FaWarehouse,
} from 'react-icons/fa';
import aboutHeroImage from '../assets/images/1000_F_1388403127_VLbGx3CB7xsMA56fZaMgN2TdpDTVY556.webp';
import businessImage from '../assets/images/240_F_736429436_NpVWpeNSbzAx35soBFulMc5N4MUO30NV.jpg';
import customerImage from '../assets/images/240_F_725819555_bH4Tv8G1KWOdwC60nwFHDZtGAmTHa2V8.jpg';

const marketplaceStats = [
  { value: 'Kakuma-Kitale', label: 'Starting corridor' },
  { value: '5', label: 'Trader problems we are fixing' },
  { value: '24/7', label: 'Support for every stakeholder' },
  { value: 'KES', label: 'Local-first commerce' },
];

const problemFixes = [
  {
    icon: FaWarehouse,
    problem: 'Information silos',
    fix: 'One shared view of stock and pricing across the whole corridor.',
  },
  {
    icon: FaTruck,
    problem: 'High logistics costs',
    fix: 'Group-buy and shared transport that cut delivery costs for everyone.',
  },
  {
    icon: FaBell,
    problem: 'Capital waste',
    fix: 'Early alerts before stock expires or goes dead.',
  },
  {
    icon: FaChartLine,
    problem: 'Financial blindness',
    fix: 'A built-in profit and cash-flow picture for every business, updated in real time.',
  },
  {
    icon: FaRoute,
    problem: 'Disconnected supply',
    fix: 'Region-wide scarcity alerts that connect shortages to nearby supply, fast.',
  },
];

const communityGroups = [
  { icon: FaLeaf, title: 'Farmers and manufacturers', text: 'The people who grow and make the goods.' },
  { icon: FaWarehouse, title: 'Wholesalers and distributors', text: 'The businesses moving volume across the corridor.' },
  { icon: FaStore, title: 'Retailers and dukas', text: 'The shops serving everyday last-mile demand.' },
  { icon: FaTruck, title: 'Logistics operators', text: 'The teams keeping trade moving from pickup to delivery.' },
  { icon: FaUsers, title: 'Customers', text: 'The people depending on reliable, fairly priced trade.' },
];

const trustPillars = [
  {
    icon: FaShieldAlt,
    title: 'Verified Businesses',
    text: 'Sellers are identity- and business-verified before they can list.',
  },
  {
    icon: FaShoppingBasket,
    title: 'Transparent Listings & Live Order Tracking',
    text: 'Clear product details, honest pricing, and real-time order status from purchase to delivery.',
  },
  {
    icon: FaMoneyBillWave,
    title: 'Secure Checkout',
    text: 'Every transaction runs through secure, monitored payment processing built to protect both sides.',
  },
  {
    icon: FaCheckCircle,
    title: '30-Day Money-Back Guarantee',
    text: "If something is not right, you are covered.",
  },
  {
    icon: FaUsers,
    title: 'Ratings & Reviews',
    text: 'Real feedback from real buyers and sellers, visible before you commit.',
  },
  {
    icon: FaClipboardCheck,
    title: 'Built-In Accountability',
    text: 'Every order, price change, and delivery is logged so disputes get resolved with evidence.',
  },
  {
    icon: FaHeadset,
    title: '24/7 Support',
    text: 'A dedicated team for customers, sellers, and logistics partners.',
  },
];

const values = [
  { icon: FaChartLine, title: 'Clarity', text: 'Real data, not rumors.' },
  { icon: FaShieldAlt, title: 'Trust', text: 'Every party protected, every time.' },
  {
    icon: FaLanguage,
    title: 'Local-First',
    text: 'Built for trade in KES, in Kiswahili and English, and designed for low-connectivity areas.',
  },
  {
    icon: FaArrowRight,
    title: 'Growth',
    text: 'Tools that help every size of business earn more, not just sell more.',
  },
];

const About = () => (
  <div className="bg-[#F5F7FA] text-[#111827]">
    <section className="relative min-h-[72vh] overflow-hidden">
      <img
        src={aboutHeroImage}
        alt="Lango MarketPulse marketplace operations"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-[#0B1220]/78" />
      <div className="relative mx-auto flex min-h-[72vh] max-w-screen-2xl items-center px-4 pb-28 pt-16 md:px-6 md:pb-32">
        <div className="max-w-4xl text-white">
          <p className="inline-flex rounded-md border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#FDBA74]">
            Our Story
          </p>
          <h1 className="mt-5 text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">
            Built From The Market, For The Market
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-gray-100 sm:text-lg">
            Lango MarketPulse started with one question we could not ignore: why does the trader who grows, makes, or moves the goods almost never get to see, or shape, the market they depend on?
          </p>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-gray-300 sm:text-base">
            We built Lango Lako la Biashara Smart to change that, corridor by corridor, starting in Kakuma-Kitale.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/products" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-[#F97316] px-5 text-sm font-semibold text-white transition hover:bg-[#EA580C]">
              Explore Marketplace <FaArrowRight size={13} />
            </Link>
            <Link to="/business" className="inline-flex min-h-12 items-center justify-center rounded-md border border-white/30 bg-white/10 px-5 text-sm font-semibold text-white transition hover:bg-white/20">
              Meet Our Sellers
            </Link>
          </div>
        </div>
      </div>
      <div className="relative mx-auto -mt-10 max-w-screen-2xl px-4 pb-8 md:-mt-12 md:px-6">
        <div className="grid overflow-hidden rounded-lg border border-white/15 bg-white shadow-xl md:grid-cols-4">
          {marketplaceStats.map((stat) => (
            <div key={stat.label} className="border-b border-gray-100 p-5 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0">
              <p className="text-2xl font-bold text-[#F97316] md:text-3xl">{stat.value}</p>
              <p className="mt-1 text-sm font-medium text-[#6B7280]">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    <section className="bg-white">
      <div className="mx-auto grid max-w-screen-2xl gap-8 px-4 py-14 md:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[#F97316]">Why We Exist</p>
          <h2 className="mt-3 text-3xl font-bold leading-tight text-[#111827] md:text-4xl">
            Trade should not run on guesswork.
          </h2>
        </div>
        <div className="grid gap-4 text-sm leading-7 text-[#374151] md:grid-cols-2">
          <p>
            Across the Kakuma-Kitale corridor, farmers, manufacturers, wholesalers, retailers, and logistics operators have always traded with each other, just without the tools to see each other clearly.
          </p>
          <p>
            Lango MarketPulse closes that gap with one connected marketplace where every stakeholder can see real demand, real stock, and real prices, then act on them immediately.
          </p>
        </div>
      </div>
    </section>

    <section className="mx-auto max-w-screen-2xl px-4 py-14 md:px-6">
      <div className="mb-7 max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-[#F97316]">What We Are Fixing</p>
        <h2 className="mt-2 text-3xl font-bold text-[#111827]">Five problems every trader in the corridor knows.</h2>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {problemFixes.map(({ icon: Icon, problem, fix }) => (
          <article key={problem} className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
            <span className="flex h-11 w-11 items-center justify-center rounded-md bg-[#FFF7ED] text-[#F97316]">
              <Icon />
            </span>
            <h3 className="mt-4 text-lg font-bold text-[#111827]">{problem}</h3>
            <p className="mt-2 text-sm leading-6 text-[#6B7280]">{fix}</p>
          </article>
        ))}
      </div>
    </section>

    <section className="bg-white">
      <div className="mx-auto grid max-w-screen-2xl gap-8 px-4 py-14 md:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[#F97316]">Our Community</p>
          <h2 className="mt-3 text-3xl font-bold leading-tight text-[#111827] md:text-4xl">
            Every link in the chain, on one platform.
          </h2>
          <p className="mt-4 text-sm leading-7 text-[#6B7280]">
            Lango MarketPulse is built for the whole chain, including traders supplying both the Kakuma refugee camp and the surrounding host communities, where reliable, fairly priced trade matters most.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {communityGroups.map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-lg border border-gray-200 bg-[#F9FAFB] p-4">
                <div className="flex items-center gap-3">
                  <Icon className="text-[#F97316]" />
                  <h3 className="text-sm font-bold text-[#111827]">{title}</h3>
                </div>
                <p className="mt-2 text-xs leading-5 text-[#6B7280]">{text}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <img src={businessImage} alt="Lango businesses and suppliers" className="h-72 w-full rounded-lg object-cover shadow-lg" />
          <img src={customerImage} alt="Lango customers and retailers" className="h-72 w-full rounded-lg object-cover shadow-lg sm:mt-10" />
        </div>
      </div>
    </section>

    <section className="bg-[#0B1220] text-white">
      <div className="mx-auto max-w-screen-2xl px-4 py-14 md:px-6">
        <div className="mb-8 max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-[#FDBA74]">Why You Can Trust Lango</p>
          <h2 className="mt-2 text-3xl font-bold">Buy and sell with confidence, not crossed fingers.</h2>
          <p className="mt-3 text-sm leading-7 text-gray-300">
            Trust is earned transaction by transaction. Here is how Lango MarketPulse protects every side of the deal.
          </p>
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
        <div className="mx-auto mb-8 max-w-3xl text-center">
          <p className="inline-flex rounded-full bg-[#FFF7ED] px-4 py-1 text-sm font-semibold text-[#F97316]">What Drives Us</p>
          <h2 className="mt-3 text-3xl font-bold text-[#111827]">Built for clarity, trust, local trade, and growth.</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {values.map(({ icon: Icon, title, text }) => (
            <article key={title} className="rounded-lg border border-gray-200 bg-[#F9FAFB] p-5">
              <Icon className="text-2xl text-[#F97316]" />
              <h3 className="mt-4 font-bold text-[#111827]">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-[#6B7280]">{text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>

    <section className="bg-[#111827] px-4 py-14 text-white md:px-6">
      <div className="mx-auto flex max-w-screen-2xl flex-wrap items-center justify-between gap-6">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-[#FDBA74]">Lango Lako la Biashara Smart</p>
          <h2 className="mt-2 text-3xl font-bold">Ready to trade with more confidence?</h2>
          <p className="mt-3 text-sm leading-6 text-gray-300">
            Start shopping, register as a seller, or explore our verified business directory to see how Lango MarketPulse connects trade across the corridor.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link to="/products" className="inline-flex min-h-12 items-center justify-center rounded-md bg-[#F97316] px-5 text-sm font-semibold text-white transition hover:bg-[#EA580C]">
            Start Shopping
          </Link>
          <Link to="/seller-plans" className="inline-flex min-h-12 items-center justify-center rounded-md border border-white/20 bg-white/10 px-5 text-sm font-semibold text-white transition hover:bg-white/20">
            Start Selling
          </Link>
          <Link to="/business" className="inline-flex min-h-12 items-center justify-center rounded-md border border-white/20 bg-white/10 px-5 text-sm font-semibold text-white transition hover:bg-white/20">
            Business Directory
          </Link>
        </div>
      </div>
    </section>
  </div>
);

export default About;
