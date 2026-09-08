import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  ClipboardList,
  CreditCard,
  FileText,
  Headphones,
  LockKeyhole,
  MapPin,
  PackageCheck,
  QrCode,
  ShieldCheck,
  ShoppingCart,
  Star,
  Store,
  Truck,
  Users,
  WalletCards,
} from 'lucide-react';

const featureBadges = [
  { label: 'Secure Escrow', icon: ShieldCheck, color: 'text-[#F2871A]' },
  { label: 'Delivery Tracking', icon: Truck, color: 'text-[#16A34A]' },
  { label: 'QR Verification', icon: QrCode, color: 'text-[#0B2D55]' },
  { label: 'M-Pesa Payments', icon: CreditCard, color: 'text-[#0EA85B]' },
  { label: 'Wallet Payouts', icon: WalletCards, color: 'text-[#F2871A]' },
  { label: 'Support & Disputes', icon: Headphones, color: 'text-[#2F4258]' },
];

const desktopCards = [
  {
    number: '01',
    title: 'Buyer',
    subtitle: 'Find & order products',
    text: 'Browse verified products, compare prices, choose quantity and delivery hub.',
    icon: ShoppingCart,
    accent: '#0B2D55',
    className: 'left-[15.5%] top-[90px]',
  },
  {
    number: '02',
    title: 'Seller',
    subtitle: 'Accept & prepare order',
    text: 'Receive the order, confirm stock, prepare the goods for pickup.',
    icon: Store,
    accent: '#F2871A',
    className: 'right-[15.5%] top-[90px]',
  },
  {
    number: '03',
    title: 'Secure Escrow',
    subtitle: 'Payment protected',
    text: 'Buyer pays through M-Pesa. Funds are held securely until delivery is verified.',
    icon: LockKeyhole,
    accent: '#16A34A',
    className: 'right-[15.5%] top-[238px]',
  },
  {
    number: '04',
    title: 'Logistics',
    subtitle: 'Transport arranged',
    text: 'A verified driver is assigned to pick up and deliver the goods safely.',
    icon: Truck,
    accent: '#F2871A',
    className: 'right-[15.5%] bottom-[132px]',
  },
  {
    number: '05',
    title: 'Live Tracking',
    subtitle: 'Follow your shipment',
    text: 'Track your order in real time from pickup to delivery with live updates.',
    icon: MapPin,
    accent: '#F9B233',
    className: 'left-[18%] bottom-[132px]',
  },
  {
    number: '06',
    title: 'QR Verification',
    subtitle: 'Confirm handover',
    text: 'Buyer scans the delivery QR to confirm goods and trigger escrow release.',
    icon: QrCode,
    accent: '#0B2D55',
    className: 'left-[15.5%] top-[268px]',
  },
  {
    number: '07',
    title: 'Release Payment',
    subtitle: 'Seller gets paid',
    text: 'After successful delivery verification, funds are released to the seller and logistics wallets.',
    icon: WalletCards,
    accent: '#16A34A',
    showWalletRelease: true,
    className: 'left-1/2 top-[465px] -translate-x-1/2',
  },
];

const journeySteps = [
  { number: '01', title: 'Browse', text: 'Find products', icon: ShoppingCart, color: '#0B2D55' },
  { number: '02', title: 'Order', text: 'Checkout', icon: FileText, color: '#F2871A' },
  { number: '03', title: 'Payment', text: 'Held in escrow', icon: LockKeyhole, color: '#16A34A' },
  { number: '04', title: 'Seller prepares', text: 'Goods ready', icon: PackageCheck, color: '#F9B233' },
  { number: '05', title: 'Pickup QR', text: 'Driver collects', icon: Truck, color: '#F2871A' },
  { number: '06', title: 'In transit', text: 'Live tracking', icon: MapPin, color: '#0B2D55' },
  { number: '07', title: 'Release payment', text: 'Seller and logistics get paid', icon: WalletCards, color: '#16A34A' },
  { number: '08', title: 'Delivery QR', text: 'Buyer confirms receipt', icon: QrCode, color: '#2F4258' },
  { number: '09', title: 'Wallets paid', text: 'Product money + delivery fee', icon: CreditCard, color: '#F2871A' },
  { number: '10', title: 'Review', text: 'Rate seller', icon: Star, color: '#F9B233' },
  { number: '11', title: 'Support', text: 'Resolve issues', icon: Headphones, color: '#2F4258' },
];

const proofItems = [
  { label: 'Trusted Marketplace', icon: ShieldCheck },
  { label: 'Verified Businesses', icon: Users },
  { label: 'Reliable Logistics', icon: Truck },
  { label: 'Seller & Logistics Wallets', icon: WalletCards },
  { label: 'Stronger Communities', icon: ClipboardList },
  { label: 'Dispute Support', icon: Headphones },
];

const pointerLines = [
  { id: 'buyer', color: '#0B2D55', marker: 'arrow-navy', d: 'M215 88 C280 92 274 148 326 154', start: [215, 88], end: [326, 154], duration: 3.8, delay: 0 },
  { id: 'seller', color: '#F2871A', marker: 'arrow-orange', d: 'M545 88 C480 92 486 148 434 154', start: [545, 88], end: [434, 154], duration: 4.1, delay: 0.25 },
  { id: 'escrow', color: '#16A34A', marker: 'arrow-green', d: 'M620 214 C542 214 505 214 460 214', start: [620, 214], end: [460, 214], duration: 3.6, delay: 0.5 },
  { id: 'logistics', color: '#F2871A', marker: 'arrow-orange', d: 'M548 323 C498 286 485 274 435 263', start: [548, 323], end: [435, 263], duration: 4, delay: 0.75 },
  { id: 'tracking', color: '#F9B233', marker: 'arrow-gold', d: 'M210 323 C262 286 278 274 326 263', start: [210, 323], end: [326, 263], duration: 4.2, delay: 1 },
  { id: 'qr', color: '#0B2D55', marker: 'arrow-navy', d: 'M136 244 C218 244 255 244 300 244', start: [136, 244], end: [300, 244], duration: 3.7, delay: 1.25 },
  { id: 'wallet', color: '#16A34A', marker: 'arrow-green', d: 'M380 322 C342 364 278 392 210 392', start: [380, 322], end: [210, 392], duration: 2.9, delay: 1.5, width: 2.8, dashArray: '3 8' },
];

const FlowPointers = () => (
  <svg className="absolute left-1/2 top-[76px] h-[430px] w-[820px] -translate-x-1/2" viewBox="0 0 760 390" aria-hidden="true">
    <defs>
      <marker id="arrow-navy" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="8" markerHeight="8" orient="auto">
        <path d="M2 2 10 6 2 10Z" fill="#0B2D55" />
      </marker>
      <marker id="arrow-orange" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="8" markerHeight="8" orient="auto">
        <path d="M2 2 10 6 2 10Z" fill="#F2871A" />
      </marker>
      <marker id="arrow-green" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="8" markerHeight="8" orient="auto">
        <path d="M2 2 10 6 2 10Z" fill="#16A34A" />
      </marker>
      <marker id="arrow-gold" viewBox="0 0 12 12" refX="10" refY="6" markerWidth="8" markerHeight="8" orient="auto">
        <path d="M2 2 10 6 2 10Z" fill="#F9B233" />
      </marker>
    </defs>

    {pointerLines.map((line) => (
      <g key={line.id}>
        <path
          id={`market-path-${line.id}`}
          className="market-flow-pointer"
          d={line.d}
          fill="none"
          markerEnd={`url(#${line.marker})`}
          stroke={line.color}
          strokeDasharray={line.dashArray || '6 8'}
          strokeWidth={line.width || 2.5}
        />
        <circle cx={line.start[0]} cy={line.start[1]} r="8" fill="#FFFFFF" stroke={line.color} strokeWidth="3" />
        <circle cx={line.start[0]} cy={line.start[1]} r="3" fill={line.color} />
        <circle className="market-flow-node" cx={line.end[0]} cy={line.end[1]} r="10" fill="#FFFFFF" stroke="#EAF1F9" strokeWidth="2" />
        <circle className="market-flow-node-core" cx={line.end[0]} cy={line.end[1]} r="6" fill={line.color} />
        <circle r="5" fill={line.color}>
          <animateMotion dur={`${line.duration}s`} begin={`${line.delay}s`} repeatCount="indefinite">
            <mpath href={`#market-path-${line.id}`} />
          </animateMotion>
        </circle>
      </g>
    ))}
  </svg>
);

const ReleaseWalletGraphic = () => (
  <div className="absolute right-3 top-1/2 hidden h-[66px] w-[78px] -translate-y-1/2 sm:block" aria-hidden="true">
    <div className="absolute left-4 top-0 h-8 w-12 rotate-[-7deg] rounded-md bg-[#A7F3D0] shadow-md">
      <div className="absolute left-1.5 top-1.5 h-3 w-6 rounded-sm bg-[#22C55E]" />
      <div className="absolute right-1.5 top-1.5 h-4 w-4 rounded-full bg-[#16A34A]" />
    </div>
    <div className="absolute bottom-1 right-0 h-11 w-16 rounded-lg bg-[#9A5A25] shadow-lg">
      <div className="absolute inset-x-0 top-0 h-3 rounded-t-lg bg-[#B87433]" />
      <div className="absolute right-1.5 top-4 h-4 w-5 rounded bg-[#6F3A16]" />
      <div className="absolute right-3 top-[21px] h-1.5 w-1.5 rounded-full bg-[#F9B233]" />
    </div>
    <div className="absolute left-0 top-7 flex h-8 w-8 items-center justify-center rounded-full bg-[#16A34A] text-white shadow-lg ring-4 ring-white">
      <Check size={17} strokeWidth={4} />
    </div>
  </div>
);

const StepCard = ({ step, mobile = false, index = 0 }) => {
  const Icon = step.icon;

  return (
    <article
      className={`market-flow-card bg-white/95 shadow-xl shadow-slate-900/10 backdrop-blur ${
        mobile ? 'relative w-full' : `absolute z-20 ${step.showWalletRelease ? 'w-[330px]' : 'w-[255px]'} ${step.className}`
      }`}
      style={{
        '--step-color': step.accent,
        '--flow-delay': `${index * 0.12}s`,
        ...(mobile ? { paddingLeft: '5rem' } : {}),
        ...(step.showWalletRelease ? { minHeight: '108px', paddingRight: '6rem' } : {}),
      }}
    >
      <div
        className={`absolute top-4 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-extrabold text-white shadow-lg ring-4 ring-white ${
          mobile ? 'left-4' : '-left-5'
        }`}
        style={{ background: step.accent }}
      >
        {step.number}
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Icon size={16} className="shrink-0" style={{ color: step.accent }} aria-hidden="true" />
          <h3 className="text-[17px] font-extrabold leading-6 text-[#07265A]">{step.title}</h3>
        </div>
        <p className="mt-1 text-sm font-bold leading-5" style={{ color: step.accent }}>
          {step.subtitle}
        </p>
        <p className="mt-1 text-sm leading-5 text-[#52627D]">{step.text}</p>
      </div>
      {step.showWalletRelease && <ReleaseWalletGraphic />}
    </article>
  );
};

const ProductLaptop = () => (
  <div className="market-flow-float absolute left-[4.5%] top-[112px] hidden h-[100px] w-[155px] lg:block">
    <div className="rounded-lg border-[5px] border-[#0F172A] bg-white p-1.5 shadow-xl shadow-slate-900/10">
      <div className="mb-2 flex items-center gap-1">
        <span className="h-2 w-2 rounded-full bg-red-400" />
        <span className="h-2 w-2 rounded-full bg-yellow-400" />
        <span className="h-2 w-2 rounded-full bg-green-400" />
        <span className="ml-auto h-3 w-10 rounded bg-[#F2871A]" />
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {['#F2871A', '#F9B233', '#0B2D55', '#16A34A', '#2F4258', '#F2871A'].map((color, index) => (
          <div key={index} className="rounded-md border border-gray-100 bg-[#F8FAFC] p-1">
            <div className="h-6 rounded" style={{ background: color }} />
            <div className="mt-1 h-1.5 rounded bg-gray-200" />
            <div className="mt-1 h-1.5 w-2/3 rounded bg-[#16A34A]" />
          </div>
        ))}
      </div>
    </div>
    <div className="mx-auto h-2.5 w-[176px] rounded-b-[18px] bg-[#CBD5E1]" />
    <div className="absolute -right-3 -top-4 flex h-11 w-11 items-center justify-center rounded-full bg-[#F2871A] text-white shadow-lg">
      <ShoppingCart size={22} aria-hidden="true" />
    </div>
  </div>
);

const QrPhone = () => (
  <div className="market-flow-float market-flow-float-delay absolute left-[5.5%] top-[276px] hidden h-[122px] w-[88px] rounded-[19px] border-[5px] border-[#0F172A] bg-white p-2.5 text-center shadow-xl shadow-slate-900/15 lg:block">
    <p className="text-[10px] font-extrabold leading-3 text-[#0B1220]">Scan QR Code</p>
    <div className="mx-auto mt-2.5 grid h-[50px] w-[50px] grid-cols-5 gap-1 bg-white">
      {Array.from({ length: 25 }).map((_, index) => (
        <span
          key={index}
          className={`h-full w-full ${[0, 1, 3, 4, 6, 8, 10, 12, 13, 16, 18, 20, 21, 23, 24].includes(index) ? 'bg-[#0B1220]' : 'bg-white'}`}
        />
      ))}
    </div>
    <p className="mt-2.5 inline-flex items-center gap-1 text-[10px] font-bold text-[#16A34A]">
      <Check size={12} aria-hidden="true" />
      Verified
    </p>
  </div>
);

const MapPreview = () => (
  <div className="market-flow-float market-flow-float-slow absolute bottom-[145px] left-[5.5%] hidden h-[88px] w-[138px] overflow-hidden rounded-xl border-4 border-white bg-[#FFF7ED] shadow-xl shadow-slate-900/10 lg:block">
    <svg viewBox="0 0 180 120" className="h-full w-full" aria-hidden="true">
      <path d="M8 28 C36 42 46 8 74 28 C102 48 117 38 170 22" fill="none" stroke="#CBD5E1" strokeWidth="7" />
      <path d="M18 88 C55 62 67 98 100 76 C126 58 140 70 166 48" fill="none" stroke="#CBD5E1" strokeWidth="7" />
      <path d="M28 84 C62 64 84 68 105 52 C128 36 142 42 160 32" fill="none" stroke="#F2871A" strokeDasharray="8 7" strokeWidth="4" />
      <circle cx="28" cy="84" r="10" fill="#0B2D55" />
      <circle cx="102" cy="54" r="10" fill="#F2871A" />
      <circle cx="158" cy="32" r="10" fill="#16A34A" />
    </svg>
    <div className="absolute bottom-1.5 left-[58px] rounded-lg bg-white px-2 py-1.5 text-[10px] shadow-lg">
      <p className="font-extrabold text-[#0B1220]">In Transit</p>
      <p className="text-[#64748B]">Kitale to Kakuma</p>
    </div>
  </div>
);

const SellerShop = () => (
  <div className="market-flow-float market-flow-float-delay absolute right-[5%] top-[92px] hidden h-[124px] w-[168px] lg:block">
    <div className="absolute right-5 top-0 h-20 w-28 rounded-t-md bg-[#E2E8F0] shadow-lg">
      <div className="h-7 rounded-t-md bg-[repeating-linear-gradient(90deg,#EF4444_0_16px,#fff_16px_32px)]" />
      <div className="grid grid-cols-2 gap-1.5 p-2.5">
        <div className="h-9 rounded bg-[#7C4A21]" />
        <div className="h-9 rounded bg-[#F9B233]" />
      </div>
    </div>
    <div className="absolute bottom-0 right-2 flex items-end gap-2">
      <div className="h-8 w-16 rounded bg-[#C8792E]" />
      <div className="h-11 w-20 rounded bg-[#F9B233]" />
    </div>
    <div className="absolute right-0 top-[54px] flex h-12 w-12 items-center justify-center rounded-full bg-[#22C55E] text-white shadow-xl ring-4 ring-white">
      <Check size={26} strokeWidth={4} aria-hidden="true" />
    </div>
    <div className="absolute bottom-0 right-7 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-[#0B2D55] shadow-lg">
      Verified Seller
    </div>
  </div>
);

const MpesaPhone = () => (
  <div className="market-flow-float absolute right-[5.5%] top-[248px] hidden h-[118px] w-[82px] rounded-[20px] border-[5px] border-[#0F172A] bg-white p-2.5 text-center shadow-xl shadow-slate-900/15 lg:block">
    <p className="mt-1.5 text-base font-extrabold text-[#16A34A]">M-PESA</p>
    <div className="mx-auto mt-3 flex h-9 w-9 items-center justify-center rounded-full bg-[#16A34A] text-white">
      <Check size={21} strokeWidth={4} aria-hidden="true" />
    </div>
    <p className="mt-2.5 text-[9px] font-extrabold leading-3 text-[#0B1220]">Payment Successful</p>
    <p className="mt-1 text-[8px] leading-3 text-[#64748B]">Secure in escrow</p>
  </div>
);

const TruckPreview = () => (
  <div className="market-flow-float market-flow-float-slow absolute bottom-[140px] right-[5%] hidden h-[96px] w-[180px] lg:block">
    <div className="absolute bottom-2 right-0 flex h-16 w-40 items-center justify-center rounded-xl bg-[#E5E7EB] shadow-xl">
      <Truck size={118} className="text-[#475569]" strokeWidth={1.25} aria-hidden="true" />
    </div>
    <div className="absolute right-0 top-0 flex h-12 w-12 items-center justify-center rounded-full bg-[#FED7AA] text-[#0B2D55] shadow-lg ring-4 ring-white">
      <MapPin size={25} fill="#0B2D55" aria-hidden="true" />
    </div>
  </div>
);

const CentralHub = ({ className = '' }) => (
  <div className={`absolute left-1/2 h-[245px] w-[245px] -translate-x-1/2 sm:h-[290px] sm:w-[290px] lg:h-[318px] lg:w-[318px] ${className}`}>
    <div className="market-flow-radar absolute inset-0 rounded-full bg-[#FFF7ED]" aria-hidden="true" />
    <div className="market-flow-segments absolute inset-[1%] rounded-full" aria-hidden="true" />
    <div className="market-flow-dash absolute inset-[8%] rounded-full border-2 border-dashed border-[#F2871A]/80" aria-hidden="true" />
    <div className="absolute inset-[17%] rounded-full bg-white shadow-2xl shadow-slate-900/10" />
    <div className="absolute inset-[27%] flex flex-col items-center justify-center rounded-full bg-white text-center">
      <img src="/marketpulse-logo.png" alt="Lango MarketPulse" className="market-flow-logo h-20 w-20 object-contain" />
      <p className="mt-2 text-xl font-extrabold leading-6 text-[#0B2D55]">Lango</p>
      <p className="text-lg font-extrabold leading-5 text-[#F2871A]">MarketPulse</p>
      <p className="mt-1 text-xs font-semibold leading-4 text-[#64748B]">Trade Today</p>
      <p className="text-xs font-semibold leading-4 text-[#64748B]">A Stronger Tomorrow</p>
    </div>
    {['top-[4%] left-1/2 -translate-x-1/2 bg-[#0B2D55]', 'top-[23%] right-[5%] bg-[#F2871A]', 'top-1/2 right-[-1%] -translate-y-1/2 bg-[#16A34A]', 'bottom-[18%] right-[13%] bg-[#F9B233]', 'bottom-[5%] left-1/2 -translate-x-1/2 bg-[#F2871A]', 'bottom-[18%] left-[13%] bg-[#2F4258]', 'top-1/2 left-[-1%] -translate-y-1/2 bg-[#0B2D55]', 'top-[23%] left-[5%] bg-[#F2871A]'].map((className, index) => (
      <span key={index} className={`absolute h-8 w-8 rounded-full border-4 border-white shadow-lg ${className}`} />
    ))}
  </div>
);

const JourneyStrip = () => (
  <div className="relative mx-auto mt-8 max-w-[1366px] px-4 pb-6">
    <div className="rounded-lg border border-[#DDE7F5] bg-white/95 p-5 shadow-xl shadow-slate-900/5 backdrop-blur">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-2xl font-extrabold leading-7 text-[#0B2D55]">The Complete Journey</h3>
          <p className="text-sm text-[#64748B]">From order to successful delivery</p>
        </div>
        <Link to="/products" className="inline-flex items-center gap-2 text-sm font-extrabold text-[#F2871A]">
          Trade with Confidence
          <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </div>

      <div className="overflow-x-auto pb-1">
        <div
          className="grid items-start gap-2"
          style={{
            gridTemplateColumns: `repeat(${journeySteps.length * 2 - 1}, minmax(0, 1fr))`,
            minWidth: `${journeySteps.length * 112}px`,
          }}
        >
          {journeySteps.map((step, index) => {
            const Icon = step.icon;
            return (
              <React.Fragment key={step.number}>
                <div className="flex flex-col items-center text-center">
                  <span
                    className="flex h-14 w-14 items-center justify-center rounded-full border"
                    style={{ color: step.color, backgroundColor: `${step.color}14`, borderColor: `${step.color}24` }}
                  >
                    <Icon size={23} aria-hidden="true" />
                  </span>
                  <span className="mt-2 text-xs font-extrabold" style={{ color: step.color }}>{step.number}</span>
                  <p className="mt-1 text-sm font-extrabold leading-4 text-[#0B2D55]">{step.title}</p>
                  <p className="text-xs leading-4 text-[#64748B]">{step.text}</p>
                </div>
                {index < journeySteps.length - 1 && (
                  <div className="mt-5 flex justify-center text-[#64748B]">
                    <ArrowRight size={21} aria-hidden="true" />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  </div>
);

const MarketplaceTrustFlow = () => (
  <section className="relative overflow-hidden bg-[#F8FBFF]">
    <div className="market-flow-grid absolute inset-0" aria-hidden="true" />
    <div className="relative mx-auto max-w-[1536px] px-4 pt-10 sm:pt-12 lg:px-6">
      <div className="mx-auto max-w-4xl text-center">
        <h1 className="text-4xl font-extrabold leading-tight text-[#0B2D55] sm:text-5xl lg:text-6xl">
          How Lango MarketPulse Works
        </h1>
        <p className="mx-auto mt-3 max-w-3xl text-base leading-7 text-[#52627D] sm:text-lg">
          From finding products to secure payment and verified delivery, Lango MarketPulse connects buyers, sellers and logistics providers in one trusted marketplace.
        </p>
      </div>

      <div className="mt-5 flex flex-wrap justify-center gap-3">
        {featureBadges.map(({ label, icon: Icon, color }) => (
          <span key={label} className="inline-flex min-h-11 items-center gap-3 rounded-full border border-[#DDE7F5] bg-white px-5 py-2 text-sm font-extrabold text-[#0B2D55] shadow-md shadow-slate-900/5">
            <Icon size={22} className={color} aria-hidden="true" />
            {label}
          </span>
        ))}
      </div>

      <div className="relative mt-2 hidden min-h-[650px] lg:block">
        <FlowPointers />

        <ProductLaptop />
        <QrPhone />
        <MapPreview />
        <SellerShop />
        <MpesaPhone />
        <TruckPreview />
        <CentralHub className="top-[292px] -translate-y-1/2" />

        {desktopCards.map((step, index) => (
          <StepCard key={step.number} step={step} index={index} />
        ))}
      </div>

      <div className="mt-8 grid gap-4 lg:hidden">
        <div className="relative mx-auto h-[320px] w-full max-w-[360px]">
          <CentralHub className="top-1/2 -translate-y-1/2" />
        </div>
        {desktopCards.map((step, index) => (
          <StepCard key={step.number} step={step} mobile index={index} />
        ))}
      </div>
    </div>

    <JourneyStrip />

    <div className="relative border-t border-[#DDE7F5] bg-white/70">
      <div className="mx-auto flex max-w-[1366px] flex-col gap-4 px-4 py-5 text-sm text-[#52627D] md:flex-row md:items-center md:justify-between">
        <div className="grid grid-cols-2 gap-4 sm:flex sm:flex-wrap sm:items-center sm:gap-7">
          {proofItems.map(({ label, icon: Icon }) => (
            <span key={label} className="inline-flex items-center gap-2 font-semibold">
              <Icon size={21} className="text-[#F2871A]" aria-hidden="true" />
              {label}
            </span>
          ))}
        </div>
        <p className="font-semibold text-[#0B2D55]">Lango MarketPulse <span className="px-3 text-[#94A3B8]">|</span> Trade Today. A Stronger Tomorrow.</p>
      </div>
    </div>
  </section>
);

export default MarketplaceTrustFlow;
