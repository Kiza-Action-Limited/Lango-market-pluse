import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Bell,
  CheckCircle2,
  CreditCard,
  Heart,
  Home,
  KeyRound,
  LayoutDashboard,
  MapPin,
  Package,
  Save,
  Settings,
  ShieldCheck,
  Star,
  Store,
  User,
  WalletCards,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import NotificationPreferencesCard from '../components/NotificationPreferencesCard';
import { authService } from '../services/authService';
import { orderService } from '../services/orderService';
import { normalizeOrder } from '../utils/orderAdapter';
import { formatCurrency } from '../utils/formatters';

const PROFILE_SECTIONS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'orders', label: 'My Orders', icon: Package },
  { id: 'wishlist', label: 'Wishlist', icon: Heart },
  { id: 'addresses', label: 'Addresses', icon: MapPin },
  { id: 'payment', label: 'Payment Methods', icon: CreditCard },
  { id: 'reviews', label: 'Reviews', icon: Star },
  { id: 'security', label: 'Security', icon: KeyRound },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const TOP_TABS = [
  { id: 'orders', label: 'Orders' },
  { id: 'wishlist', label: 'Wishlist' },
  { id: 'reviews', label: 'Reviews' },
  { id: 'addresses', label: 'Addresses' },
];

const PENDING_STATUSES = ['pending', 'pending_payment', 'AWAITING_PAYMENT'];
const DELIVERY_STATUSES = ['processing', 'payment_escrowed', 'FUNDS_HELD', 'dispatched', 'IN_TRANSIT'];
const ESCROW_STATUSES = ['payment_escrowed', 'FUNDS_HELD', 'IN_TRANSIT', 'DELIVERED'];

const prettify = (value, fallback = 'Not set') => {
  if (!value) return fallback;
  return String(value)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const getUserName = (user) => user?.fullName || user?.name || user?.businessName || 'Your Profile';

const getInitials = (name) => {
  const parts = String(name || 'User').trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase()).join('') || 'U';
};

const formatDate = (date) => {
  if (!date) return 'Not available';
  return new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric' }).format(new Date(date));
};

const Profile = () => {
  const {
    user,
    activePlan,
    availablePlans,
    switchPlan,
    refreshUser,
    updateUser,
    isSeller,
  } = useAuth();
  const [activeSection, setActiveSection] = useState('dashboard');
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    address: '',
    businessName: '',
    businessType: '',
  });

  useEffect(() => {
    if (!user) return;
    setFormData({
      fullName: getUserName(user),
      phone: user.phone || '',
      address: user.address || user.location?.address || '',
      businessName: user.businessName || '',
      businessType: user.businessType || '',
    });
  }, [user]);

  useEffect(() => {
    let mounted = true;

    const fetchOrders = async () => {
      try {
        const response = await orderService.getAll({ page: 1, limit: 8 });
        const rows = (response.data || response.orders || []).map(normalizeOrder);
        if (mounted) setOrders(rows);
      } catch (error) {
        if (mounted) setOrders([]);
      } finally {
        if (mounted) setOrdersLoading(false);
      }
    };

    fetchOrders();
    return () => {
      mounted = false;
    };
  }, []);

  const displayName = getUserName(user);
  const memberSince = formatDate(user?.createdAt);
  const verificationLabel = user?.kycVerified || user?.verificationStatus === 'verified'
    ? 'Verified Customer'
    : prettify(user?.verificationStatus, 'Verification pending');
  const planLabel = isSeller ? (activePlan?.name || prettify(user?.subscriptionTier, 'No active plan')) : 'Buyer account';
  const planPrice = isSeller ? (activePlan?.priceLabel || user?.subscription?.status || 'Plan not active') : 'No seller subscription';

  const orderStats = useMemo(() => ({
    total: orders.length,
    pending: orders.filter((order) => PENDING_STATUSES.includes(order.status)).length,
    pendingDeliveries: orders.filter((order) => DELIVERY_STATUSES.includes(order.status)).length,
    escrow: orders.filter((order) => ESCROW_STATUSES.includes(order.status)).length,
    totalSpent: orders.reduce((sum, order) => sum + Number(order.total || 0), 0),
  }), [orders]);

  const wishlistCount = user?.wishlist?.length || 0;
  const addressLabel = formData.address || user?.address || user?.location?.address || 'No saved address';

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setFormData((previous) => ({ ...previous, [name]: value }));
  };

  const handleSaveProfile = async (event) => {
    event.preventDefault();
    setSaving(true);

    try {
      const updatedUser = await authService.updateCurrentUser(formData);
      if (updatedUser) updateUser(updatedUser);
      await refreshUser();
      toast.success('Profile updated successfully');
    } catch (error) {
      const message = error?.response?.data?.message || 'Failed to update profile';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handlePlanChange = async (event) => {
    const result = await switchPlan(event.target.value);
    if (!result?.success && result?.message) toast.error(result.message);
  };

  const Metric = ({ label, value, tone = 'orange' }) => {
    const toneClasses = {
      orange: 'border-[#F97316] text-[#F97316]',
      green: 'border-[#16A34A] text-[#16A34A]',
      blue: 'border-[#2563EB] text-[#2563EB]',
      slate: 'border-[#64748B] text-[#334155]',
    };

    return (
      <div className={`rounded-lg border-l-4 bg-white p-4 shadow-sm ${toneClasses[tone]}`}>
        <p className="text-xs font-semibold uppercase text-[#6B7280]">{label}</p>
        <p className="mt-1 text-2xl font-bold text-[#111827]">{value}</p>
      </div>
    );
  };

  const SectionTitle = ({ icon: Icon, title, action }) => (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Icon size={20} className="text-[#F97316]" />
        <h2 className="text-xl font-bold text-[#111827]">{title}</h2>
      </div>
      {action}
    </div>
  );

  const renderRecentOrders = () => (
    <div className="space-y-3">
      {ordersLoading ? (
        <div className="h-24 animate-pulse rounded-lg bg-gray-100" />
      ) : orders.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-5 text-sm text-[#6B7280]">
          No orders yet. <Link to="/products" className="font-semibold text-[#F97316]">Browse products</Link>
        </div>
      ) : (
        orders.slice(0, 4).map((order) => (
          <div key={order.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-4">
            <div>
              <p className="font-semibold text-[#111827]">Order #{String(order.id).slice(-8).toUpperCase()}</p>
              <p className="text-sm text-[#6B7280]">{prettify(order.status)} · {new Date(order.createdAt).toLocaleDateString()}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-bold text-[#16A34A]">{formatCurrency(order.total || 0)}</span>
              <Link to={`/orders/${order.id}/track`} className="rounded-lg border border-[#F97316] px-3 py-2 text-sm font-semibold text-[#F97316] hover:bg-[#F97316] hover:text-white">
                Track
              </Link>
            </div>
          </div>
        ))
      )}
    </div>
  );

  const renderDashboard = () => (
    <div>
      <SectionTitle icon={LayoutDashboard} title="Account Dashboard" />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Orders" value={orderStats.total} />
        <Metric label="Pending Deliveries" value={orderStats.pendingDeliveries} tone="blue" />
        <Metric label="Escrow Transactions" value={orderStats.escrow} tone="green" />
        <Metric label="Wishlist" value={wishlistCount} tone="slate" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <section>
          <SectionTitle
            icon={Package}
            title="Recent Orders"
            action={<Link to="/orders" className="text-sm font-semibold text-[#F97316]">View all</Link>}
          />
          {renderRecentOrders()}
        </section>

        <section className="space-y-4">
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <SectionTitle icon={WalletCards} title="Plan & Role" />
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-[#6B7280]">Role</dt>
                <dd className="font-semibold text-[#111827]">{prettify(user?.role)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[#6B7280]">Business Type</dt>
                <dd className="font-semibold text-[#111827]">{prettify(user?.businessType)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[#6B7280]">Plan</dt>
                <dd className="font-semibold text-[#111827]">{planLabel}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[#6B7280]">Plan Status</dt>
                <dd className="font-semibold text-[#16A34A]">
                  {isSeller ? prettify(user?.subscription?.status, activePlan ? 'Active' : 'Inactive') : 'Not eligible'}
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <SectionTitle icon={Bell} title="Notifications" />
            <p className="text-sm text-[#6B7280]">Order, escrow, and account notifications are managed from your preferences.</p>
            <button
              type="button"
              onClick={() => setActiveSection('settings')}
              className="mt-4 rounded-lg bg-[#111827] px-4 py-2 text-sm font-semibold text-white hover:bg-[#374151]"
            >
              Open preferences
            </button>
          </div>
        </section>
      </div>
    </div>
  );

  const renderOrders = () => (
    <div>
      <SectionTitle icon={Package} title="My Orders" action={<Link to="/orders" className="text-sm font-semibold text-[#F97316]">Open orders page</Link>} />
      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Total Orders" value={orderStats.total} />
        <Metric label="Pending" value={orderStats.pending} tone="blue" />
        <Metric label="Deliveries" value={orderStats.pendingDeliveries} tone="green" />
        <Metric label="Total Spent" value={formatCurrency(orderStats.totalSpent)} tone="slate" />
      </div>
      {renderRecentOrders()}
    </div>
  );

  const renderWishlist = () => (
    <div>
      <SectionTitle icon={Heart} title="Wishlist" action={<Link to="/wishlist" className="text-sm font-semibold text-[#F97316]">Open wishlist</Link>} />
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <p className="text-3xl font-bold text-[#111827]">{wishlistCount}</p>
        <p className="mt-1 text-sm text-[#6B7280]">Saved products in your wishlist.</p>
      </div>
    </div>
  );

  const renderAddresses = () => (
    <div>
      <SectionTitle icon={MapPin} title="Addresses" />
      <form onSubmit={handleSaveProfile} className="rounded-lg border border-gray-200 bg-white p-5">
        <label className="block text-sm font-semibold text-[#111827]" htmlFor="profile-address">Primary Address</label>
        <textarea
          id="profile-address"
          name="address"
          rows="4"
          value={formData.address}
          onChange={handleInputChange}
          className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-[#111827] outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20"
          placeholder="County, town, street, or delivery landmark"
        />
        <p className="mt-2 text-sm text-[#6B7280]">Current saved address: {addressLabel}</p>
        <button type="submit" disabled={saving} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#F97316] px-4 py-2 font-semibold text-white hover:bg-[#EA580C] disabled:opacity-60">
          <Save size={16} />
          {saving ? 'Saving...' : 'Save Address'}
        </button>
      </form>
    </div>
  );

  const renderPayment = () => (
    <div>
      <SectionTitle icon={CreditCard} title="Payment Methods" />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <p className="font-semibold text-[#111827]">Wallet Balance</p>
          <p className="mt-2 text-2xl font-bold text-[#16A34A]">{formatCurrency(user?.walletBalance || 0)}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <p className="font-semibold text-[#111827]">Escrow Balance</p>
          <p className="mt-2 text-2xl font-bold text-[#2563EB]">{formatCurrency(user?.escrowBalance || 0)}</p>
        </div>
      </div>
    </div>
  );

  const renderReviews = () => (
    <div>
      <SectionTitle icon={Star} title="Reviews" />
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <p className="font-semibold text-[#111827]">Trust Score</p>
        <p className="mt-2 text-2xl font-bold text-[#F97316]">{Number(user?.trustScore || 0).toFixed(1)} / 5</p>
        <p className="mt-2 text-sm text-[#6B7280]">Reviews and trust indicators help buyers and sellers transact with confidence.</p>
      </div>
    </div>
  );

  const renderSecurity = () => (
    <div>
      <SectionTitle icon={ShieldCheck} title="Security" />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <p className="font-semibold text-[#111827]">Phone Verification</p>
          <p className="mt-2 text-sm text-[#6B7280]">{user?.isPhoneVerified ? 'Verified' : 'Not verified'}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <p className="font-semibold text-[#111827]">KYC Status</p>
          <p className="mt-2 text-sm text-[#6B7280]">{verificationLabel}</p>
        </div>
      </div>
    </div>
  );

  const renderSettings = () => (
    <div>
      <SectionTitle icon={Settings} title="Settings" />
      <div className="space-y-5">
        <form onSubmit={handleSaveProfile} className="rounded-lg border border-gray-200 bg-white p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-semibold text-[#111827]" htmlFor="profile-name">Full Name</label>
              <input
                id="profile-name"
                name="fullName"
                value={formData.fullName}
                onChange={handleInputChange}
                className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-[#111827] outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-[#111827]" htmlFor="profile-phone">Phone</label>
              <input
                id="profile-phone"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-[#111827] outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-[#111827]" htmlFor="profile-business-name">Business Name</label>
              <input
                id="profile-business-name"
                name="businessName"
                value={formData.businessName}
                onChange={handleInputChange}
                className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-[#111827] outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-[#111827]" htmlFor="profile-business-type">Business Type</label>
              <select
                id="profile-business-type"
                name="businessType"
                value={formData.businessType}
                onChange={handleInputChange}
                className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-[#111827] outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20"
              >
                <option value="">Not set</option>
                {['brand', 'wholesaler', 'manufacturer', 'retailer', 'farmer', 'small_business', 'analytics', 'logistics'].map((type) => (
                  <option key={type} value={type}>{prettify(type)}</option>
                ))}
              </select>
            </div>
          </div>
          <button type="submit" disabled={saving} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#F97316] px-4 py-2 font-semibold text-white hover:bg-[#EA580C] disabled:opacity-60">
            <Save size={16} />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </form>

        <NotificationPreferencesCard
          title="Notification Preferences"
          description="Control how you receive order updates, scarcity alerts, and account activity."
        />
      </div>
    </div>
  );

  const renderMainContent = () => {
    switch (activeSection) {
      case 'orders':
        return renderOrders();
      case 'wishlist':
        return renderWishlist();
      case 'addresses':
        return renderAddresses();
      case 'payment':
        return renderPayment();
      case 'reviews':
        return renderReviews();
      case 'security':
        return renderSecurity();
      case 'settings':
        return renderSettings();
      default:
        return renderDashboard();
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] py-6">
      <div className="container mx-auto max-w-7xl px-4">
        <header className="mb-6 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="grid gap-5 border-b border-gray-200 p-5 lg:grid-cols-[auto_1fr_auto] lg:items-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#F97316] text-2xl font-bold text-white shadow-sm">
              {getInitials(displayName)}
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-2xl font-bold text-[#111827]">{displayName}</h1>
                <span className="inline-flex items-center gap-1 rounded-full bg-[#16A34A]/10 px-3 py-1 text-xs font-semibold text-[#15803D]">
                  <CheckCircle2 size={14} />
                  {verificationLabel}
                </span>
              </div>
              <p className="mt-1 text-sm text-[#6B7280]">{user?.email || 'No email saved'}</p>
              <p className="mt-1 text-sm text-[#6B7280]">Member Since: {memberSince}</p>
            </div>

            <div className="rounded-lg border border-gray-200 bg-[#F9FAFB] p-4 lg:min-w-72">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#111827]">
                {isSeller ? <Store size={16} className="text-[#F97316]" /> : <User size={16} className="text-[#F97316]" />}
                {prettify(user?.role)}
              </div>
              <p className="mt-2 text-sm text-[#6B7280]">{planLabel} · {planPrice}</p>
              {activePlan && availablePlans?.length > 0 && (
                <select
                  value={activePlan.id}
                  onChange={handlePlanChange}
                  className="mt-3 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-[#111827] outline-none focus:border-[#F97316]"
                >
                  {availablePlans.map((plan) => (
                    <option key={plan.id} value={plan.id}>{plan.name}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <nav className="flex gap-2 overflow-x-auto px-5 py-3">
            {TOP_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSection(tab.id)}
                className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition ${
                  activeSection === tab.id
                    ? 'bg-[#F97316] text-white'
                    : 'text-[#6B7280] hover:bg-gray-100 hover:text-[#111827]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </header>

        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          <aside className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
            <nav className="space-y-1">
              {PROFILE_SECTIONS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveSection(id)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-semibold transition ${
                    activeSection === id
                      ? 'bg-[#F97316]/10 text-[#F97316]'
                      : 'text-[#4B5563] hover:bg-gray-100 hover:text-[#111827]'
                  }`}
                >
                  <Icon size={18} />
                  <span className="min-w-0 truncate">{label}</span>
                </button>
              ))}
            </nav>
          </aside>

          <main className="min-w-0 rounded-lg border border-gray-200 bg-[#FFFFFF] p-5 shadow-sm">
            {renderMainContent()}
          </main>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-4 text-sm text-[#6B7280]">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-[#16A34A]" />
            <span>Your account details are protected and only visible to authorized users.</span>
          </div>
          {isSeller && (
            <Link to="/seller" className="inline-flex items-center gap-2 font-semibold text-[#F97316]">
              <Home size={16} />
              Seller dashboard
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;
