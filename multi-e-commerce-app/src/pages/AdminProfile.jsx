import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  FaBalanceScale,
  FaCamera,
  FaChartLine,
  FaEnvelope,
  FaEye,
  FaEyeSlash,
  FaIdBadge,
  FaLock,
  FaShieldAlt,
  FaTachometerAlt,
  FaUser,
  FaUserCircle,
  FaUsers,
} from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/authService';

const adminSections = [
  { id: 'overview', label: 'Overview', icon: FaTachometerAlt },
  { id: 'identity', label: 'Identity', icon: FaIdBadge },
  { id: 'permissions', label: 'Permissions', icon: FaShieldAlt },
  { id: 'security', label: 'Security', icon: FaLock },
];

const adminLinks = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: FaTachometerAlt },
  { to: '/admin/users', label: 'Users', icon: FaUsers },
  { to: '/admin/analytics', label: 'Analytics', icon: FaChartLine },
  { to: '/admin/finance-audit', label: 'Finance & Audit', icon: FaBalanceScale },
];

const displayValue = (value, fallback = 'N/A') => value || fallback;

const formatDate = (date) => {
  if (!date) return 'Not available';
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date));
};

const DetailTile = ({ icon: Icon, label, value, mono = false }) => (
  <div className="rounded-lg border border-gray-200 bg-[#F9FAFB] p-4">
    <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
      <Icon className="text-[#F97316]" />
      {label}
    </p>
    <p className={`break-words text-sm font-semibold text-[#111827] ${mono ? 'font-mono' : ''}`}>
      {displayValue(value)}
    </p>
  </div>
);

const StatusBadge = ({ children }) => (
  <span className="inline-flex items-center rounded-full border border-[#16A34A]/20 bg-[#16A34A]/10 px-3 py-1 text-xs font-semibold text-[#15803D]">
    {children}
  </span>
);

const AdminProfile = () => {
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState('overview');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [visiblePasswords, setVisiblePasswords] = useState({
    current: false,
    next: false,
    confirm: false,
  });
  const profileKey = useMemo(
    () => `marketpulse_admin_profile_image_${user?._id || user?.id || 'default'}`,
    [user?._id, user?.id]
  );
  const [profileImage, setProfileImage] = useState(localStorage.getItem(profileKey) || '');

  const adminName = user?.name || user?.fullName || 'Admin User';
  const adminEmail = user?.email || 'admin@langomarket.com';
  const adminRole = user?.role || 'admin';

  const handleImageUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      setProfileImage(result);
      localStorage.setItem(profileKey, result);
      window.dispatchEvent(new Event('storage'));
    };
    reader.readAsDataURL(file);
  };

  const handlePasswordInputChange = (event) => {
    const { name, value } = event.target;
    setPasswordData((current) => ({ ...current, [name]: value }));
  };

  const togglePasswordVisibility = (key) => {
    setVisiblePasswords((current) => ({ ...current, [key]: !current[key] }));
  };

  const handleChangePassword = async (event) => {
    event.preventDefault();

    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      toast.error('Fill in all password fields');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      toast.error('New password must be at least 6 characters');
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    setSavingPassword(true);
    try {
      await authService.changePassword(passwordData.currentPassword, passwordData.newPassword);
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      toast.success('Admin password changed successfully');
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to change admin password');
    } finally {
      setSavingPassword(false);
    }
  };

  const PasswordInput = ({ id, name, label, visibleKey, value, placeholder }) => (
    <div>
      <label className="block text-sm font-semibold text-[#111827]" htmlFor={id}>
        {label}
      </label>
      <div className="relative mt-2">
        <input
          id={id}
          name={name}
          type={visiblePasswords[visibleKey] ? 'text' : 'password'}
          value={value}
          onChange={handlePasswordInputChange}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-[#111827] outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20"
          placeholder={placeholder}
          autoComplete={name === 'currentPassword' ? 'current-password' : 'new-password'}
        />
        <button
          type="button"
          onClick={() => togglePasswordVisibility(visibleKey)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] transition hover:text-[#F97316]"
          aria-label={visiblePasswords[visibleKey] ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
        >
          {visiblePasswords[visibleKey] ? <FaEyeSlash /> : <FaEye />}
        </button>
      </div>
    </div>
  );

  const renderOverview = () => (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-[#111827]">Admin Overview</h2>
          <p className="mt-1 text-sm text-gray-500">Administrator account details inside the dashboard.</p>
        </div>
        <StatusBadge>Administrator</StatusBadge>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <DetailTile icon={FaUser} label="Full Name" value={user?.name || user?.fullName} />
        <DetailTile icon={FaEnvelope} label="Email" value={adminEmail} />
        <DetailTile icon={FaShieldAlt} label="Role" value={adminRole} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {adminLinks.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition hover:border-[#F97316]/40 hover:shadow-md"
          >
            <div className="mb-3 inline-flex rounded-lg bg-[#FFF7ED] p-3 text-[#F97316]">
              <Icon />
            </div>
            <p className="font-semibold text-[#111827]">{label}</p>
            <p className="mt-1 text-sm text-gray-500">Open admin {label.toLowerCase()} tools.</p>
          </Link>
        ))}
      </div>
    </div>
  );

  const renderIdentity = () => (
    <div>
      <h2 className="text-xl font-bold text-[#111827]">Identity</h2>
      <p className="mt-1 text-sm text-gray-500">Core account identity fields for this administrator.</p>
      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
        <DetailTile icon={FaUser} label="Full Name" value={user?.name || user?.fullName} />
        <DetailTile icon={FaEnvelope} label="Email" value={adminEmail} />
        <DetailTile icon={FaUserCircle} label="Account Created" value={formatDate(user?.createdAt)} />
      </div>
    </div>
  );

  const renderPermissions = () => (
    <div>
      <h2 className="text-xl font-bold text-[#111827]">Permissions</h2>
      <p className="mt-1 text-sm text-gray-500">Admin capability summary for platform operations.</p>
      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
        <DetailTile icon={FaUsers} label="User Management" value="Enabled" />
        <DetailTile icon={FaBalanceScale} label="Finance Audit" value="Enabled" />
        <DetailTile icon={FaChartLine} label="Analytics" value="Enabled" />
      </div>
    </div>
  );

  const renderSecurity = () => (
    <div>
      <h2 className="text-xl font-bold text-[#111827]">Security</h2>
      <p className="mt-1 text-sm text-gray-500">Manage admin dashboard access and account protection.</p>

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
        <DetailTile icon={FaShieldAlt} label="Account Role" value="Administrator" />
        <DetailTile icon={FaUserCircle} label="Last Login" value={formatDate(user?.lastLogin)} />
      </div>

      <form onSubmit={handleChangePassword} className="mt-6 rounded-xl border border-gray-200 bg-[#F9FAFB] p-5">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-bold text-[#111827]">
              <FaLock className="text-[#F97316]" />
              Change Admin Password
            </h3>
            <p className="mt-1 text-sm text-gray-500">Update the password used for this protected admin account.</p>
          </div>
          <StatusBadge>Protected</StatusBadge>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <PasswordInput
            id="admin-current-password"
            name="currentPassword"
            label="Current Password"
            visibleKey="current"
            value={passwordData.currentPassword}
            placeholder="Current password"
          />
          <PasswordInput
            id="admin-new-password"
            name="newPassword"
            label="New Password"
            visibleKey="next"
            value={passwordData.newPassword}
            placeholder="New password"
          />
          <PasswordInput
            id="admin-confirm-password"
            name="confirmPassword"
            label="Confirm Password"
            visibleKey="confirm"
            value={passwordData.confirmPassword}
            placeholder="Confirm new password"
          />
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-gray-500">Use at least 6 characters. You will keep this session after the password updates.</p>
          <button
            type="submit"
            disabled={savingPassword}
            className="inline-flex items-center gap-2 rounded-lg bg-[#111827] px-4 py-2 font-semibold text-white transition hover:bg-[#374151] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FaLock />
            {savingPassword ? 'Changing...' : 'Change Password'}
          </button>
        </div>
      </form>

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
        <DetailTile icon={FaLock} label="Session Scope" value="Protected admin dashboard" />
      </div>
    </div>
  );

  const renderMainContent = () => {
    if (activeSection === 'identity') return renderIdentity();
    if (activeSection === 'permissions') return renderPermissions();
    if (activeSection === 'security') return renderSecurity();
    return renderOverview();
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] px-4 py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="grid gap-5 border-b border-gray-200 p-6 lg:grid-cols-[auto_1fr_auto] lg:items-center">
            <div className="relative h-24 w-24">
              {profileImage ? (
                <img
                  src={profileImage}
                  alt="Admin profile"
                  className="h-24 w-24 rounded-full border-2 border-[#F97316]/30 object-cover"
                />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[#FFF7ED] text-[#F97316]">
                  <FaUserCircle className="text-6xl" />
                </div>
              )}
              <label className="absolute bottom-0 right-0 inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-[#F97316] text-white shadow-md transition hover:bg-[#EA580C]" title="Upload profile image">
                <FaCamera size={13} />
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              </label>
            </div>

            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#F97316]">Admin Profile</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <h1 className="truncate text-3xl font-bold text-[#111827]">{adminName}</h1>
                <StatusBadge>Administrator</StatusBadge>
              </div>
              <p className="mt-2 text-sm text-gray-500">{adminEmail}</p>
              <p className="mt-1 text-xs text-gray-500">Click the camera icon to upload profile image.</p>
            </div>

            <div className="rounded-xl border border-gray-200 bg-[#F9FAFB] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Role</p>
              <p className="mt-1 text-lg font-bold capitalize text-[#111827]">{adminRole}</p>
            </div>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          <aside className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
            <nav className="space-y-1">
              {adminSections.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveSection(id)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold transition ${
                    activeSection === id
                      ? 'bg-[#F97316]/10 text-[#F97316]'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-[#111827]'
                  }`}
                >
                  <Icon />
                  <span>{label}</span>
                </button>
              ))}
            </nav>
          </aside>

          <main className="min-w-0 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            {renderMainContent()}
          </main>
        </div>
      </div>
    </div>
  );
};

export default AdminProfile;
