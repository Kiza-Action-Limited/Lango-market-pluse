import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { notificationService } from '../services/notificationService';

const defaultPrefs = {
  smsEnabled: true,
  emailEnabled: true,
  pushEnabled: true,
  orderUpdates: true,
  scarcityAlerts: true,
};

const Toggle = ({ label, checked, onChange, description }) => (
  <label className="flex items-start justify-between gap-4 rounded-xl border border-gray-200 bg-white p-4">
    <div>
      <p className="font-medium text-[#111827]">{label}</p>
      {description ? <p className="mt-1 text-sm text-gray-500">{description}</p> : null}
    </div>
    <input
      type="checkbox"
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      className="mt-1 h-5 w-5 rounded border-gray-300 text-[#F97316] focus:ring-[#F97316]"
    />
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
  description = 'Choose how the platform reaches you for order updates, scarcity alerts, and account activity.',
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
    return <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-500 shadow-sm">Loading notification preferences...</div>;
  }

  const card = (
    <form onSubmit={handleSave} className="space-y-4">
      <Toggle
        label="Push notifications"
        description="Receive in-app and browser push alerts."
        checked={!!prefs.pushEnabled}
        onChange={(value) => setPrefs((prev) => ({ ...prev, pushEnabled: value }))}
      />
      <Toggle
        label="SMS notifications"
        description="Get text alerts for time-sensitive updates."
        checked={!!prefs.smsEnabled}
        onChange={(value) => setPrefs((prev) => ({ ...prev, smsEnabled: value }))}
      />
      <Toggle
        label="Email notifications"
        description="Receive updates by email."
        checked={!!prefs.emailEnabled}
        onChange={(value) => setPrefs((prev) => ({ ...prev, emailEnabled: value }))}
      />
      <Toggle
        label="Order updates"
        description="Shipping, payment, and delivery lifecycle notifications."
        checked={!!prefs.orderUpdates}
        onChange={(value) => setPrefs((prev) => ({ ...prev, orderUpdates: value }))}
      />
      <Toggle
        label="Scarcity alerts"
        description="Low-stock and demand alerts."
        checked={!!prefs.scarcityAlerts}
        onChange={(value) => setPrefs((prev) => ({ ...prev, scarcityAlerts: value }))}
      />

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center rounded-xl bg-[#F97316] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#EA580C] disabled:opacity-60"
        >
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

          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">{card}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border border-gray-200 bg-white p-5 shadow-sm ${className}`}>
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#F97316]">{eyebrow}</p>
        <h2 className="mt-2 text-xl font-bold text-[#111827]">{title}</h2>
        <p className="mt-2 text-sm text-gray-600">{description}</p>
      </div>
      {card}
    </div>
  );
};

export default NotificationPreferencesCard;
