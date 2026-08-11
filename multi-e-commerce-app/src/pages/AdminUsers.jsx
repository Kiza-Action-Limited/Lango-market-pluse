import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  FaBan,
  FaCheckCircle,
  FaClipboardList,
  FaEnvelope,
  FaEye,
  FaFileCsv,
  FaFilter,
  FaIdCard,
  FaPhoneAlt,
  FaSearch,
  FaShieldAlt,
  FaSortAmountDown,
  FaStore,
  FaSyncAlt,
  FaTrash,
  FaTruck,
  FaUser,
  FaUserCheck,
  FaUsers,
} from 'react-icons/fa';
import api from '../config/axios';
import UserDetailsModal from '../components/admin/UserDetailsModal';
import { getEffectiveUserCategory, isBuyerUser, isSellerUser } from '../utils/userCategory';

const verificationStatuses = ['unverified', 'pending', 'verified', 'gold', 'rejected', 'restricted'];
const roleFilters = [
  ['all', 'All users'],
  ['buyer', 'Buyers'],
  ['seller', 'Sellers'],
  ['farmer', 'Farmers'],
  ['wholesaler', 'Wholesalers'],
  ['retailer', 'Retailers'],
  ['manufacturer', 'Manufacturers'],
  ['logistics', 'Logistics'],
];
const statusFilters = [
  ['all', 'All status'],
  ['active', 'Active'],
  ['blocked', 'Blocked'],
  ['phone_verified', 'Phone verified'],
  ['phone_unverified', 'Phone unverified'],
  ['email_verified', 'Email verified'],
  ['email_unverified', 'Email unverified'],
  ['kyc_verified', 'KYC verified'],
  ['pending', 'KYC pending'],
  ['unverified', 'KYC unverified'],
  ['rejected', 'KYC rejected'],
  ['restricted', 'Restricted'],
];
const sortOptions = [
  ['role_asc', 'Role A-Z'],
  ['role_desc', 'Role Z-A'],
  ['joined_desc', 'Newest joined'],
  ['joined_asc', 'Oldest joined'],
  ['activity_desc', 'Recent activity'],
  ['name_asc', 'Name A-Z'],
];
const exportModes = [
  ['directory', 'User directory CSV'],
  ['activity', 'Platform activity CSV'],
];

const formatLabel = (value) => String(value || '')
  .replace(/_/g, ' ')
  .replace(/\b\w/g, (letter) => letter.toUpperCase());

const getDisplayName = (user = {}) => (
  isBuyerUser(user)
    ? user.fullName || user.name || user.email || user.phone || 'Unknown user'
    : user.businessName || user.fullName || user.name || user.email || user.phone || 'Unknown user'
);

const getUserId = (user = {}) => user._id || user.id || user.userId;

const getKycStatus = (user = {}) => user.verificationStatus || (user.kycVerified ? 'verified' : 'unverified');

const isAdminAccount = (user = {}) => getEffectiveUserCategory(user) === 'admin';

const getVisibleUserRows = (rows = []) => rows.filter((user) => user && !isAdminAccount(user));

const getUserRoleLabel = (user = {}) => {
  const category = getEffectiveUserCategory(user);
  if (category === 'admin') return 'admin';
  return isSellerUser(user) ? 'seller' : user.role || category;
};

const getBusinessTypeLabel = (user = {}) => (isBuyerUser(user) ? '' : user.businessType || getEffectiveUserCategory(user));

const getUserActivityDate = (user = {}) => user.lastLogin || user.lastActiveAt || user.lastActivityAt || user.updatedAt || user.createdAt;

const getUserActivityCount = (user = {}) => Number(
  user.activityCount ??
    user.totalActivity ??
    user.orderCount ??
    user.totalOrders ??
    user.productCount ??
    user.totalProducts ??
    user.documentCount ??
    0
);

const parseDateValue = (value) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.getTime() : 0;
};

const escapeCsvCell = (value = '') => {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const downloadCsv = (filename, headers, rows) => {
  const csv = [headers, ...rows]
    .map((row) => row.map(escapeCsvCell).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

const getVerificationTone = (status) => {
  if (status === 'verified' || status === 'gold') return 'border-green-200 bg-green-50 text-green-700';
  if (status === 'pending') return 'border-amber-200 bg-amber-50 text-amber-700';
  if (status === 'rejected' || status === 'restricted') return 'border-red-200 bg-red-50 text-red-700';
  return 'border-gray-200 bg-gray-100 text-gray-700';
};

const StatCard = ({ icon: Icon, label, value, detail, color = '#F97316' }) => (
  <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
    <div className="flex items-center justify-between gap-3">
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-gray-50" style={{ color }}>
        <Icon />
      </span>
      <p className="text-2xl font-bold text-gray-950">{Number(value || 0).toLocaleString('en-KE')}</p>
    </div>
    <p className="mt-3 text-xs font-semibold uppercase text-gray-500">{label}</p>
    {detail && <p className="mt-1 text-sm text-gray-600">{detail}</p>}
  </div>
);

const StatusBadge = ({ children, tone = 'gray' }) => {
  const tones = {
    green: 'border-green-200 bg-green-50 text-green-700',
    red: 'border-red-200 bg-red-50 text-red-700',
    orange: 'border-orange-200 bg-orange-50 text-orange-700',
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
    gray: 'border-gray-200 bg-gray-100 text-gray-700',
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${tones[tone] || tones.gray}`}>
      {children}
    </span>
  );
};

const AdminUsers = () => {
  const [searchParams] = useSearchParams();
  const initialRoleFilter = searchParams.get('role') === 'admin' ? 'all' : searchParams.get('role') || 'all';
  const [users, setUsers] = useState([]);
  const [summary, setSummary] = useState({});
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedUserDetails, setSelectedUserDetails] = useState(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState(initialRoleFilter);
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all');
  const [sortBy, setSortBy] = useState('role_asc');
  const [exportRole, setExportRole] = useState(initialRoleFilter);
  const [exportMode, setExportMode] = useState('directory');
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const roleFromUrl = searchParams.get('role');
    const statusFromUrl = searchParams.get('status');
    if (roleFromUrl) {
      const safeRole = roleFromUrl === 'admin' ? 'all' : roleFromUrl;
      setRoleFilter(safeRole);
      setExportRole(safeRole);
    }
    if (statusFromUrl) setStatusFilter(statusFromUrl);
  }, [searchParams]);

  const fetchUsers = async ({ nextPage = page } = {}) => {
    setLoading(true);
    try {
      const response = await api.get('/v1/admin/users', {
        params: {
          page: nextPage,
          limit: pagination.limit,
          role: roleFilter === 'admin' ? 'all' : roleFilter,
          status: statusFilter,
          search: search.trim() || undefined,
          sortBy,
        },
      });
      setUsers(Array.isArray(response.data.users) ? getVisibleUserRows(response.data.users) : []);
      setSummary(response.data.summary || {});
      setPagination(response.data.pagination || { page: nextPage, limit: pagination.limit, total: 0, pages: 1 });
      setPage(response.data.pagination?.page || nextPage);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error(error.response?.data?.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetchUsers({ nextPage: 1 });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [roleFilter, statusFilter, search, sortBy]);

  const applyUpdatedUser = (updatedUser) => {
    if (!updatedUser) return;
    const updatedUserId = String(getUserId(updatedUser) || '');
    setUsers((currentUsers) => currentUsers.map((user) => {
      const userId = String(getUserId(user) || '');
      return userId === updatedUserId ? { ...user, ...updatedUser } : user;
    }));
    setSelectedUser((currentUser) => {
      const currentUserId = String(getUserId(currentUser) || '');
      return currentUserId === updatedUserId ? { ...currentUser, ...updatedUser } : currentUser;
    });
    setSelectedUserDetails((currentDetails) => {
      const currentUserId = String(getUserId(currentDetails?.user) || '');
      return currentUserId === updatedUserId ? { ...currentDetails, user: { ...currentDetails.user, ...updatedUser } } : currentDetails;
    });
  };

  const updateUser = async (userId, payload, successMessage = 'User updated') => {
    try {
      const response = await api.put(`/v1/admin/users/${userId}`, payload);
      applyUpdatedUser(response.data?.user);
      toast.success(successMessage);
      fetchUsers({ nextPage: page });
      return response.data?.user;
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update user');
      throw error;
    }
  };

  const deleteUser = async (user) => {
    const userId = getUserId(user);
    if (!userId) return;

    if (isAdminAccount(user)) {
      toast.error('Admin account details are only managed from Admin Profile');
      return;
    }

    const displayName = getDisplayName(user);
    const confirmed = window.confirm(`Delete ${displayName}? This removes the account from the platform.`);
    if (!confirmed) return;

    setDeletingUserId(userId);
    try {
      await api.delete(`/v1/admin/users/${userId}`);
      setUsers((currentUsers) => currentUsers.filter((currentUser) => String(getUserId(currentUser)) !== String(userId)));
      setPagination((currentPagination) => ({
        ...currentPagination,
        total: Math.max(0, Number(currentPagination.total || 0) - 1),
      }));
      toast.success('User deleted');
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error(error.response?.data?.message || 'Failed to delete user');
    } finally {
      setDeletingUserId(null);
    }
  };

  const uploadUserDocument = async (userId, formData) => {
    try {
      const response = await api.post(`/v1/admin/users/${userId}/documents`, formData);
      applyUpdatedUser(response.data?.user);
      setSelectedUserDetails((currentDetails) => (
        currentDetails
          ? {
              ...currentDetails,
              user: response.data?.user || currentDetails.user,
              documents: response.data?.documents || currentDetails.documents || [],
            }
          : currentDetails
      ));
      toast.success(response.data?.message || 'Document saved');
      fetchUsers({ nextPage: page });
      return response.data;
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save document');
      throw error;
    }
  };

  const handleViewUserDetails = async (userRow) => {
    const userId = getUserId(userRow);
    if (!userId) return;

    setSelectedUser(userRow);
    setSelectedUserDetails(null);
    setDetailsLoading(true);
    try {
      const [detailsResponse, documentsResponse] = await Promise.all([
        api.get(`/v1/admin/users/${userId}`),
        api.get(`/v1/admin/users/${userId}/documents`),
      ]);
      setSelectedUserDetails({
        ...detailsResponse.data,
        documents: Array.isArray(documentsResponse.data?.data)
          ? documentsResponse.data.data
          : detailsResponse.data?.documents || [],
      });
    } catch (error) {
      console.error('Error fetching user details:', error);
      toast.error(error.response?.data?.message || 'Failed to load user details');
    } finally {
      setDetailsLoading(false);
    }
  };

  const stats = useMemo(() => ({
    total: Math.max(0, Number(summary.total ?? pagination.total ?? 0) - Number(summary.admins ?? 0)),
    active: summary.active ?? 0,
    blocked: summary.blocked ?? 0,
    sellers: summary.sellers ?? 0,
    buyers: summary.buyers ?? 0,
    logistics: summary.logistics ?? 0,
    admins: summary.admins ?? 0,
    phoneVerified: summary.phoneVerified ?? 0,
    emailVerified: summary.emailVerified ?? 0,
    kycVerified: summary.kycVerified ?? 0,
    kycPending: summary.kycPending ?? 0,
    documents: summary.documents ?? 0,
  }), [summary, pagination.total]);

  const sortedUsers = useMemo(() => {
    const sorted = [...users];
    sorted.sort((a, b) => {
      if (sortBy === 'role_desc') {
        return getUserRoleLabel(b).localeCompare(getUserRoleLabel(a)) || getDisplayName(a).localeCompare(getDisplayName(b));
      }
      if (sortBy === 'joined_desc') {
        return parseDateValue(b.createdAt) - parseDateValue(a.createdAt);
      }
      if (sortBy === 'joined_asc') {
        return parseDateValue(a.createdAt) - parseDateValue(b.createdAt);
      }
      if (sortBy === 'activity_desc') {
        return parseDateValue(getUserActivityDate(b)) - parseDateValue(getUserActivityDate(a)) || getUserActivityCount(b) - getUserActivityCount(a);
      }
      if (sortBy === 'name_asc') {
        return getDisplayName(a).localeCompare(getDisplayName(b));
      }
      return getUserRoleLabel(a).localeCompare(getUserRoleLabel(b)) || getDisplayName(a).localeCompare(getDisplayName(b));
    });
    return sorted;
  }, [sortBy, users]);

  const buildDirectoryRows = (rows) => ({
    headers: [
      'User ID',
      'Name',
      'Business Name',
      'Role',
      'Business Type',
      'Email',
      'Phone',
      'Location',
      'KYC Status',
      'Phone Verified',
      'Email Verified',
      'Documents',
      'Access',
      'Joined',
      'Updated',
      'Last Login',
    ],
    rows: rows.map((user) => [
      getUserId(user),
      getDisplayName(user),
      isBuyerUser(user) ? '' : user.businessName || '',
      getUserRoleLabel(user),
      getBusinessTypeLabel(user),
      user.email || '',
      user.phone || '',
      user.locationHub || user.city || '',
      getKycStatus(user),
      user.isPhoneVerified ? 'yes' : 'no',
      user.isEmailVerified ? 'yes' : 'no',
      Number(user.documentCount || 0),
      user.isBlocked ? 'blocked' : 'active',
      user.createdAt || '',
      user.updatedAt || '',
      user.lastLogin || '',
    ]),
  });

  const buildActivityRows = (rows) => ({
    headers: [
      'User ID',
      'Name',
      'Role',
      'Business Type',
      'Access',
      'Activity Count',
      'Orders',
      'Products',
      'Documents',
      'Total Spent',
      'Wallet Balance',
      'Escrow Balance',
      'SMS Credits',
      'Last Activity',
      'Last Login',
      'Joined',
      'KYC Status',
    ],
    rows: rows.map((user) => [
      getUserId(user),
      getDisplayName(user),
      getUserRoleLabel(user),
      getBusinessTypeLabel(user),
      user.isBlocked ? 'blocked' : 'active',
      getUserActivityCount(user),
      user.orderCount ?? user.totalOrders ?? '',
      user.productCount ?? user.totalProducts ?? '',
      Number(user.documentCount || 0),
      user.totalSpent ?? user.totalSales ?? '',
      user.walletBalance ?? '',
      user.escrowBalance ?? '',
      user.smsCredits ?? '',
      getUserActivityDate(user) || '',
      user.lastLogin || '',
      user.createdAt || '',
      getKycStatus(user),
    ]),
  });

  const fetchUsersForExport = async () => {
    const response = await api.get('/v1/admin/users', {
      params: {
        page: 1,
        limit: 1000,
        role: exportRole,
        status: statusFilter,
        search: search.trim() || undefined,
        sortBy,
        includeActivity: exportMode === 'activity',
      },
    });
    const rows = response.data?.users || response.data?.data || [];
    return Array.isArray(rows) ? getVisibleUserRows(rows) : [];
  };

  const handleExportUsersCsv = async () => {
    setExporting(true);
    try {
      const rows = await fetchUsersForExport();
      const sortedRows = [...rows].sort((a, b) => (
        sortBy === 'role_desc'
          ? getUserRoleLabel(b).localeCompare(getUserRoleLabel(a))
          : sortBy === 'activity_desc'
            ? parseDateValue(getUserActivityDate(b)) - parseDateValue(getUserActivityDate(a))
            : sortBy === 'joined_desc'
              ? parseDateValue(b.createdAt) - parseDateValue(a.createdAt)
              : sortBy === 'joined_asc'
                ? parseDateValue(a.createdAt) - parseDateValue(b.createdAt)
                : sortBy === 'name_asc'
                  ? getDisplayName(a).localeCompare(getDisplayName(b))
                  : getUserRoleLabel(a).localeCompare(getUserRoleLabel(b))
      ));
      const payload = exportMode === 'activity' ? buildActivityRows(sortedRows) : buildDirectoryRows(sortedRows);
      const roleLabel = exportRole === 'all' ? 'all_roles' : exportRole;
      downloadCsv(`admin_users_${exportMode}_${roleLabel}_${new Date().toISOString().slice(0, 10)}.csv`, payload.headers, payload.rows);
      toast.success(`Exported ${sortedRows.length} user${sortedRows.length === 1 ? '' : 's'}`);
    } catch (error) {
      console.error('Error exporting users:', error);
      toast.error(error.response?.data?.message || 'Failed to export users CSV');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="mx-auto max-w-screen-2xl space-y-6">
        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-[#F97316]">Admin users</p>
              <h1 className="mt-2 text-2xl font-bold text-gray-950">Professional user management</h1>
              <p className="mt-1 text-sm text-gray-600">Manage buyers, sellers, logistics providers, verification, documents, and account access.</p>
            </div>
            <button
              type="button"
              onClick={() => fetchUsers({ nextPage: page })}
              disabled={loading}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            >
              <FaSyncAlt className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <StatCard icon={FaUsers} label="All users" value={stats.total} detail={`${stats.active} active`} />
          <StatCard icon={FaStore} label="Sellers" value={stats.sellers} detail="Seller and farmer accounts" color="#16A34A" />
          <StatCard icon={FaUser} label="Buyers" value={stats.buyers} detail="Buyer accounts" color="#3B82F6" />
          <StatCard icon={FaTruck} label="Logistics" value={stats.logistics} detail="Provider accounts" color="#06B6D4" />
          <StatCard icon={FaIdCard} label="KYC verified" value={stats.kycVerified} detail={`${stats.kycPending} pending`} color="#8B5CF6" />
          <StatCard icon={FaClipboardList} label="Documents" value={stats.documents} detail="Saved user documents" color="#F59E0B" />
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-[1fr_190px_190px_190px_auto] lg:items-center">
            <div className="relative">
              <FaSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search name, business, email, phone, or location..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-11 w-full rounded-lg border border-gray-300 bg-white pl-10 pr-3 text-sm outline-none focus:border-[#F97316] focus:ring-2 focus:ring-[#F97316]/20"
              />
            </div>
            <label className="relative">
              <FaUsers className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <select
                value={roleFilter}
                onChange={(event) => {
                  setRoleFilter(event.target.value);
                  setExportRole(event.target.value);
                }}
                className="h-11 w-full rounded-lg border border-gray-300 bg-white pl-10 pr-3 text-sm font-semibold text-gray-800 outline-none focus:border-[#F97316]"
              >
                {roleFilters.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="relative">
              <FaFilter className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="h-11 w-full rounded-lg border border-gray-300 bg-white pl-10 pr-3 text-sm font-semibold text-gray-800 outline-none focus:border-[#F97316]"
              >
                {statusFilters.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="relative">
              <FaSortAmountDown className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value)}
                className="h-11 w-full rounded-lg border border-gray-300 bg-white pl-10 pr-3 text-sm font-semibold text-gray-800 outline-none focus:border-[#F97316]"
              >
                {sortOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <div className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600">
              Showing <span className="font-semibold text-gray-950">{users.length}</span> non-admin users
            </div>
          </div>

          <div className="mt-4 grid gap-3 border-t border-gray-100 pt-4 lg:grid-cols-[220px_220px_1fr_auto] lg:items-center">
            <label className="relative">
              <FaFileCsv className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <select
                value={exportMode}
                onChange={(event) => setExportMode(event.target.value)}
                className="h-11 w-full rounded-lg border border-gray-300 bg-white pl-10 pr-3 text-sm font-semibold text-gray-800 outline-none focus:border-[#F97316]"
              >
                {exportModes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="relative">
              <FaUsers className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <select
                value={exportRole}
                onChange={(event) => setExportRole(event.target.value)}
                className="h-11 w-full rounded-lg border border-gray-300 bg-white pl-10 pr-3 text-sm font-semibold text-gray-800 outline-none focus:border-[#F97316]"
              >
                {roleFilters.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <p className="text-sm text-gray-500">
              Export all matching users by role/status/search, or export platform activity columns for audits.
            </p>
            <button
              type="button"
              onClick={handleExportUsersCsv}
              disabled={exporting}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#111827] px-4 text-sm font-semibold text-white hover:bg-black disabled:opacity-60"
            >
              <FaFileCsv />
              {exporting ? 'Exporting...' : 'Export CSV'}
            </button>
          </div>
        </section>

        <section className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="font-semibold text-gray-950">User Directory</h2>
            <p className="mt-1 text-sm text-gray-500">Open details to review documents, orders, products, verification, and account history.</p>
          </div>

          {loading ? (
            <div className="space-y-3 p-5">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-20 rounded-lg bg-gray-100 skeleton-shimmer" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1120px] text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-5 py-3">User</th>
                    <th className="px-5 py-3">Role</th>
                    <th className="px-5 py-3">Contact</th>
                    <th className="px-5 py-3">Verification</th>
                    <th className="px-5 py-3">Documents</th>
                    <th className="px-5 py-3">Joined</th>
                    <th className="px-5 py-3">Access</th>
                    <th className="px-5 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sortedUsers.map((user) => {
                    const userId = getUserId(user);
                    const displayName = getDisplayName(user);
                    const category = getEffectiveUserCategory(user);
                    const kycStatus = getKycStatus(user);
                    const roleLabel = getUserRoleLabel(user);

                    return (
                      <tr key={userId} className="bg-white hover:bg-gray-50">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#F97316] text-sm font-bold text-white">
                              {displayName.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-gray-950">{displayName}</p>
                              <p className="truncate text-xs text-gray-500">{user.locationHub || user.city || (isBuyerUser(user) ? '' : user.businessName) || 'No location set'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex flex-col gap-1">
                            <StatusBadge tone={roleLabel === 'admin' ? 'orange' : isSellerUser(user) ? 'green' : roleLabel === 'logistics' ? 'blue' : 'gray'}>
                              {formatLabel(roleLabel)}
                            </StatusBadge>
                            {!isBuyerUser(user) && (
                              <span className="text-xs text-gray-500">{formatLabel(user.businessType || category)}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-xs text-gray-600">
                              <FaPhoneAlt className={user.isPhoneVerified ? 'text-green-600' : 'text-gray-400'} />
                              <span>{user.phone || '-'}</span>
                              {user.isPhoneVerified && <FaCheckCircle className="text-green-600" />}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-600">
                              <FaEnvelope className={user.isEmailVerified ? 'text-green-600' : 'text-gray-400'} />
                              <span className="max-w-[190px] truncate">{user.email || '-'}</span>
                              {user.isEmailVerified && <FaCheckCircle className="text-green-600" />}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex flex-col gap-2">
                            <select
                              value={kycStatus}
                              onChange={(event) => updateUser(userId, { verificationStatus: event.target.value }, 'KYC status updated')}
                              className={`max-w-[150px] rounded-lg border px-2 py-1 text-xs font-semibold capitalize outline-none ${getVerificationTone(kycStatus)}`}
                            >
                              {verificationStatuses.map((status) => <option key={status} value={status}>{formatLabel(status)}</option>)}
                            </select>
                            <div className="flex flex-wrap gap-1">
                              <button
                                type="button"
                                onClick={() => updateUser(userId, { isPhoneVerified: !user.isPhoneVerified }, 'Phone verification updated')}
                                className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                              >
                                <FaPhoneAlt />
                                Phone
                              </button>
                              <button
                                type="button"
                                onClick={() => updateUser(userId, { isEmailVerified: !user.isEmailVerified }, 'Email verification updated')}
                                className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                              >
                                <FaEnvelope />
                                Email
                              </button>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <StatusBadge tone={Number(user.documentCount || 0) > 0 ? 'blue' : 'gray'}>
                            {Number(user.documentCount || 0)} saved
                          </StatusBadge>
                        </td>
                        <td className="px-5 py-4 text-sm text-gray-600">
                          {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-'}
                          <p className="mt-1 text-xs text-gray-400">Updated {user.updatedAt ? new Date(user.updatedAt).toLocaleDateString() : '-'}</p>
                        </td>
                        <td className="px-5 py-4">
                          <StatusBadge tone={user.isBlocked ? 'red' : 'green'}>
                            {user.isBlocked ? 'Blocked' : 'Active'}
                          </StatusBadge>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => handleViewUserDetails(user)}
                              className="inline-flex items-center gap-2 rounded-lg border border-[#F97316]/30 bg-white px-3 py-2 text-xs font-semibold text-[#F97316] hover:bg-[#FFF7ED]"
                            >
                              <FaEye />
                              Details
                            </button>
                            <button
                              type="button"
                              onClick={() => updateUser(userId, { isBlocked: !user.isBlocked }, user.isBlocked ? 'User unblocked' : 'User blocked')}
                              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-white ${user.isBlocked ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
                            >
                              {user.isBlocked ? <FaUserCheck /> : <FaBan />}
                              {user.isBlocked ? 'Unblock' : 'Block'}
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteUser(user)}
                              disabled={String(deletingUserId) === String(userId)}
                              className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
                            >
                              <FaTrash />
                              {String(deletingUserId) === String(userId) ? 'Deleting...' : 'Delete'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {!users.length && (
                <div className="p-10 text-center">
                  <FaShieldAlt className="mx-auto text-4xl text-[#F97316]" />
                  <h3 className="mt-3 font-semibold text-gray-950">No users found</h3>
                  <p className="mt-1 text-sm text-gray-500">Try another search, role, or status filter.</p>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col gap-3 border-t border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-500">
              Page <span className="font-semibold text-gray-950">{pagination.page || page}</span> of <span className="font-semibold text-gray-950">{pagination.pages || 1}</span>
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => fetchUsers({ nextPage: page - 1 })}
                className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= (pagination.pages || 1) || loading}
                onClick={() => fetchUsers({ nextPage: page + 1 })}
                className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </section>
      </div>

      <UserDetailsModal
        open={Boolean(selectedUser)}
        loading={detailsLoading}
        details={selectedUserDetails}
        fallbackUser={selectedUser}
        onClose={() => {
          setSelectedUser(null);
          setSelectedUserDetails(null);
        }}
        onUpdateVerification={(userId, payload) => updateUser(userId, payload, 'Verification status updated')}
        onUploadDocument={uploadUserDocument}
      />
    </div>
  );
};

export default AdminUsers;
