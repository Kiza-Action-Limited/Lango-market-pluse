import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Link, Navigate } from 'react-router-dom';
import { FaBell, FaCheckCircle, FaEnvelope, FaExclamationTriangle, FaMobileAlt, FaSave, FaShoppingCart } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { notificationService } from '../services/notificationService';

const defaultPrefs = {
  smsEnabled: true,
  emailEnabled: true,
  pushEnabled: true,
  orderUpdates: true,
  scarcityAlerts: true,
};

const Toggle = ({ label, checked, onChange, description, icon: Icon, tone = '#F97316' }) => (
  <label className="group flex cursor-pointer items-start justify-between gap-4 px-1 py-4 sm:px-2">
    <div className="flex min-w-0 gap-3">
      <span
        className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-md"
        style={{ backgroundColor: `${tone}18`, color: tone }}
      >
        {Icon ? <Icon /> : <FaBell />}
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-[#111827]">{label}</p>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            checked ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
          }`}>
            {checked ? 'Active' : 'Off'}
          </span>
        </div>
        {description ? <p className="mt-1 text-sm leading-5 text-gray-500">{description}</p> : null}
      </div>
    </div>
    <span className="relative mt-1 inline-flex h-6 w-11 shrink-0 items-center">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="peer sr-only"
      />
      <span className="absolute inset-0 rounded-full bg-gray-200 transition peer-checked:bg-[#F97316] peer-focus:ring-2 peer-focus:ring-[#F97316]/25" />
      <span className="absolute left-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
    </span>
  </label>
);

const NotificationPreferencesCard = ({
  className = '',
  variant = 'card',
  showBackLink = false,
  backLink = '/',
  backLinkLabel = 'Back home',
  title = 'Notification Preferences',
  eyebrow = 'Notification control',
  description = 'Choose how the platform reaches you for order updates, inventory alerts, and account activity.',
  badgeLabel = 'Account alerts',
  pushDescription = 'Show dashboard and browser alerts for urgent account activity.',
  smsDescription = 'Send text alerts for time-sensitive payments, dispatch, and stock events.',
  emailDescription = 'Receive a clear email trail for account, payment, and support updates.',
  orderDescription = 'Notify me about payment, packing, shipping, delivery, QR handoff, and escrow changes.',
  scarcityDescription = 'Notify me when inventory is low, out of stock, or under regional scarcity pressure.',
  criticalAlertsLabel = 'Orders and stock',
}) => {
  const { isAuthenticated, loading } = useAuth();
  const [prefs, setPrefs] = useState(defaultPrefs);
  const [saving, setSaving] = useState(false);
  const [loadingPrefs, setLoadingPrefs] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await notificationService.getNotificationPreferences();
        const data = response?.data || response || {};
        setPrefs({ ...defaultPrefs, ...(data?.data || data) });
      } catch (error) {
        toast.error(error?.response?.data?.message || 'Failed to load notification preferences');
      } finally {
        setLoadingPrefs(false);
      }
    };

    if (isAuthenticated) {
      load();
    } else {
      setLoadingPrefs(false);
    }
  }, [isAuthenticated]);

  const handleSave = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await notificationService.updateNotificationPreferences(prefs);
      const result = response?.data || response || {};
      setPrefs({ ...defaultPrefs, ...(result?.data || result) });
      toast.success('Notification preferences saved');
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to save notification preferences');
    } finally {
      setSaving(false);
    }
  };

  if (!loading && !isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (loadingPrefs) {
    return (
      <div className="rounded-md border border-gray-200 bg-white p-5 text-sm text-gray-500 shadow-sm">
        Loading notification preferences...
      </div>
    );
  }

  const enabledCount = [
    prefs.pushEnabled,
    prefs.smsEnabled,
    prefs.emailEnabled,
    prefs.orderUpdates,
    prefs.scarcityAlerts,
  ].filter(Boolean).length;

  const card = (
    <form onSubmit={handleSave} className="space-y-4">
      <div className="grid grid-cols-1 gap-3 border-y border-gray-100 py-4 sm:grid-cols-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Enabled channels</p>
          <p className="mt-1 text-2xl font-bold text-[#111827]">{enabledCount}/5</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Critical alerts</p>
          <p className="mt-1 text-sm font-semibold text-[#111827]">
            {prefs.orderUpdates && prefs.scarcityAlerts ? criticalAlertsLabel : prefs.orderUpdates ? 'Orders only' : prefs.scarcityAlerts ? 'Stock only' : 'Paused'}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Delivery methods</p>
          <p className="mt-1 text-sm font-semibold text-[#111827]">
            {[prefs.pushEnabled && 'Push', prefs.smsEnabled && 'SMS', prefs.emailEnabled && 'Email'].filter(Boolean).join(', ') || 'None'}
          </p>
        </div>
      </div>

      <div className="divide-y divide-gray-100">
        <Toggle
          label="Push alerts"
          description={pushDescription}
          icon={FaBell}
          tone="#F97316"
          checked={!!prefs.pushEnabled}
          onChange={(value) => setPrefs((prev) => ({ ...prev, pushEnabled: value }))}
        />
        <Toggle
          label="SMS alerts"
          description={smsDescription}
          icon={FaMobileAlt}
          tone="#0EA5E9"
          checked={!!prefs.smsEnabled}
          onChange={(value) => setPrefs((prev) => ({ ...prev, smsEnabled: value }))}
        />
        <Toggle
          label="Email alerts"
          description={emailDescription}
          icon={FaEnvelope}
          tone="#16A34A"
          checked={!!prefs.emailEnabled}
          onChange={(value) => setPrefs((prev) => ({ ...prev, emailEnabled: value }))}
        />
        <Toggle
          label="Order lifecycle"
          description={orderDescription}
          icon={FaShoppingCart}
          tone="#8B5CF6"
          checked={!!prefs.orderUpdates}
          onChange={(value) => setPrefs((prev) => ({ ...prev, orderUpdates: value }))}
        />
        <Toggle
          label="Stock and scarcity"
          description={scarcityDescription}
          icon={FaExclamationTriangle}
          tone="#F59E0B"
          checked={!!prefs.scarcityAlerts}
          onChange={(value) => setPrefs((prev) => ({ ...prev, scarcityAlerts: value }))}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
        <div className="inline-flex items-center gap-2 text-xs font-medium text-green-700">
          <FaCheckCircle />
          Preferences sync with your account
        </div>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex h-10 items-center gap-2 rounded-md bg-[#F97316] px-4 text-sm font-semibold text-white hover:bg-[#EA580C] disabled:opacity-60"
        >
          <FaSave />
          {saving ? 'Saving...' : 'Save Preferences'}
        </button>
        {showBackLink ? (
          <Link to={backLink} className="text-sm font-medium text-gray-600 hover:text-[#111827]">
            {backLinkLabel}
          </Link>
        ) : null}
      </div>
    </form>
  );

  if (variant === 'page') {
    return (
      <div className="min-h-screen bg-[#F9FAFB] px-4 py-8">
        <div className="mx-auto max-w-3xl space-y-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#F97316]">{eyebrow}</p>
            <h1 className="mt-2 text-3xl font-bold text-[#111827]">{title}</h1>
            <p className="mt-2 text-sm text-gray-600">{description}</p>
          </div>

          <div className="rounded-md border border-gray-200 bg-white p-5 shadow-sm">{card}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-md border border-gray-200 bg-white p-5 shadow-sm ${className}`}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#F97316]">{eyebrow}</p>
          <h2 className="mt-2 text-xl font-bold text-[#111827]">{title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">{description}</p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full bg-[#FFF7ED] px-3 py-1 text-xs font-semibold text-[#C2410C]">
          <FaBell /> {badgeLabel}
        </span>
      </div>
      {card}
    </div>
  );
};

export default NotificationPreferencesCard;
