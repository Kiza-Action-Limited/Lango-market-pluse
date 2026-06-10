// src/pages/AdminUsers.jsx
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../config/axios';
import { FaSearch, FaBan, FaCheckCircle, FaUsers, FaStore, FaUserTie, FaUser, FaBrain, FaFilter, FaEye } from 'react-icons/fa';
import toast from 'react-hot-toast';
import { getEffectiveUserCategory, isSellerUser } from '../utils/userCategory';
import UserDetailsModal from '../components/admin/UserDetailsModal';

const AdminUsers = () => {
  const [searchParams] = useSearchParams();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedUserDetails, setSelectedUserDetails] = useState(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState(searchParams.get('role') || 'all');
  const sellerTypeCategories = ['brand', 'wholesaler', 'farmer', 'retailer', 'manufacturer', 'small_business'];
  const formatCategoryLabel = (value) =>
    String(value || '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());

  const getUserCategory = (user) => getEffectiveUserCategory(user);

  const getDisplayCategory = (user) => {
    if (String(user?.role || '').toLowerCase() === 'admin') return 'admin';
    return getUserCategory(user);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    const roleFromUrl = searchParams.get('role');
    if (roleFromUrl) setFilter(roleFromUrl);
  }, [searchParams]);

  const fetchUsers = async () => {
    try {
      const response = await api.get('/v1/admin/users');
      const allUsers = Array.isArray(response.data.users) ? response.data.users.filter(Boolean) : [];
      const nonAdminUsers = allUsers.filter((u) => String(u?.role || '').toLowerCase() !== 'admin');
      setUsers(nonAdminUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleBlockUser = async (userId, block) => {
    try {
      await api.put(`/v1/admin/users/${userId}`, { isBlocked: block });
      toast.success(block ? 'User blocked' : 'User unblocked');
      fetchUsers();
    } catch (error) {
      toast.error('Failed to update user status');
    }
  };

  const handleViewUserDetails = async (userRow) => {
    const userId = userRow?._id || userRow?.id || userRow?.userId;
    if (!userId) return;

    setSelectedUser(userRow);
    setSelectedUserDetails(null);
    setDetailsLoading(true);

    try {
      const response = await api.get(`/v1/admin/users/${userId}`);
      setSelectedUserDetails(response.data);
    } catch (error) {
      console.error('Error fetching user details:', error);
      toast.error(error.response?.data?.message || 'Failed to load user details');
    } finally {
      setDetailsLoading(false);
    }
  };

  // Calculate statistics
  const stats = {
    total: users.length,
    active: users.filter(u => !u?.isBlocked).length,
    blocked: users.filter(u => u?.isBlocked).length,
    consumers: users.filter(u => getUserCategory(u) === 'consumer').length,
    sellers: users.filter(u => isSellerUser(u)).length,
    admins: users.filter(u => String(u?.role || '').toLowerCase() === 'admin').length,
  };

  const filteredUsers = users.filter(Boolean).filter(user => {
    const userRole = String(user?.role || '').toLowerCase();
    const matchesSearch = String(user?.name || user?.fullName || '').toLowerCase().includes(search.toLowerCase()) ||
                          String(user?.email || '').toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'all' || 
                         (filter === 'active' && !user?.isBlocked) ||
                         (filter === 'blocked' && user?.isBlocked) ||
                         (filter === userRole) ||
                         (filter === getDisplayCategory(user)) ||
                         (filter === getUserCategory(user));
    return matchesSearch && matchesFilter;
  });

  const getDisplayRole = (user) => {
    const category = getDisplayCategory(user);
    if (isSellerUser(user)) return 'seller';
    if (category === 'consumer') return 'consumer';
    return category;
  };

  const getRoleIcon = (displayRole) => {
    if (displayRole === 'seller') return <FaStore className="text-[#F97316]" />;
    if (displayRole === 'admin') return <FaUserTie className="text-[#FB923C]" />;
    return <FaUser className="text-[#16A34A]" />;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#F97316]"></div>
      </div>
    );
  }

  return (
    <div className="bg-[#F9FAFB] min-h-screen py-8">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <FaUsers className="text-[#F97316] text-3xl" />
            <h1 className="text-3xl font-bold text-[#F97316]">Manage Users</h1>
          </div>
          <p className="text-[#6B7280]">Lango Lako la Biashara Smart — Manage platform users and their access</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-[#F97316]">
            <p className="text-[#6B7280] text-xs uppercase tracking-wide">Total Users</p>
            <p className="text-2xl font-bold text-[#111827]">{stats.total}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-[#16A34A]">
            <p className="text-[#6B7280] text-xs uppercase tracking-wide">Active</p>
            <p className="text-2xl font-bold text-[#16A34A]">{stats.active}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-[#F97316]">
            <p className="text-[#6B7280] text-xs uppercase tracking-wide">Blocked</p>
            <p className="text-2xl font-bold text-[#F97316]">{stats.blocked}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-[#16A34A]">
            <p className="text-[#6B7280] text-xs uppercase tracking-wide">Consumers</p>
            <p className="text-2xl font-bold text-[#16A34A]">{stats.consumers}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 border-l-4 border-[#F97316]">
            <p className="text-[#6B7280] text-xs uppercase tracking-wide">Sellers</p>
            <p className="text-2xl font-bold text-[#F97316]">{stats.sellers}</p>
          </div>
        </div>
        
        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex-1 min-w-50">
              <div className="relative">
                <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#6B7280]" />
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F97316] focus:border-transparent"
                />
              </div>
            </div>
            
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <FaFilter className="text-[#6B7280]" />
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FB923C] focus:border-transparent"
              >
                <option value="all">All Users</option>
                <option value="active">Active</option>
                <option value="blocked">Blocked</option>
                <option value="consumer">Consumers</option>
                <option value="wholesaler">Wholesalers</option>
                <option value="farmer">Farmers</option>
                <option value="retailer">Retailers</option>
                <option value="manufacturer">Manufacturers</option>
                <option value="small_business">Small Business</option>
              </select>
            </div>
          </div>
        </div>
        
        {/* AI Intelligence Tip */}
        {stats.blocked > 0 && (
          <div className="mb-6 bg-linear-to-r from-[#FB923C]/10 to-[#F97316]/10 rounded-xl p-4 border border-[#FB923C]/20">
            <div className="flex items-start gap-3">
              <FaBrain className="text-[#FB923C] text-xl mt-0.5" />
              <div>
                <h4 className="font-semibold text-[#111827] mb-1">AI Intelligence Insight</h4>
                <p className="text-sm text-[#6B7280]">
                  {stats.blocked} users are currently blocked. Reviewing blocked accounts can help maintain platform trust and safety.
                </p>
              </div>
            </div>
          </div>
        )}
        
        {/* Users Table */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="overflow-x-auto overscroll-x-contain pb-1">
            <table className="w-full min-w-230">
              <thead className="bg-[#F97316] text-white">
                <tr className="text-left">
                  <th className="px-6 py-3">User</th>
                  <th className="px-6 py-3">Email</th>
                  <th className="px-6 py-3">Role</th>
                  <th className="px-6 py-3">Business Type</th>
                  <th className="px-6 py-3">Joined</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Actions</th>
                 </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user, index) => {
                  const userId = user?._id || user?.id || user?.userId || `user-${index}`;
                  const displayName = user?.name || user?.fullName || 'Unknown User';

                  return (
                  <tr key={userId} className={`border-t border-gray-100 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-gray-100 transition-colors`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-linear-to-br from-[#F97316] to-[#FB923C] rounded-full flex items-center justify-center text-white font-bold shadow-sm">
                          {displayName.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-[#111827]">{displayName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-[#6B7280]">{user?.email || '-'}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {getRoleIcon(getDisplayRole(user))}
                        <span className={`capitalize ${
                          getDisplayRole(user) === 'admin' ? 'text-[#FB923C] font-medium' :
                          getDisplayRole(user) === 'seller' ? 'text-[#F97316] font-medium' :
                          'text-[#16A34A]'
                        }`}>
                          {formatCategoryLabel(getDisplayRole(user))}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-[#6B7280] capitalize">
                      {formatCategoryLabel(getUserCategory(user))}
                    </td>
                    <td className="px-6 py-4 text-[#6B7280] text-sm">
                      {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        !user?.isBlocked 
                          ? 'bg-[#16A34A]/10 text-[#16A34A] border border-[#16A34A]/20' 
                          : 'bg-red-100 text-red-800 border border-red-200'
                      }`}>
                        {user?.isBlocked ? 'Blocked' : 'Active'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => handleViewUserDetails(user)}
                          className="px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1 border border-[#F97316] text-[#F97316] hover:bg-[#FFF7ED] transition-colors"
                        >
                          <FaEye size={12} />
                          <span>Details</span>
                        </button>
                        <button
                          onClick={() => handleBlockUser(userId, !user?.isBlocked)}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1 transition-colors ${
                            user?.isBlocked 
                              ? 'bg-[#16A34A] text-white hover:bg-[#16A34A]/90' 
                              : 'bg-[#F97316] text-white hover:bg-[#F97316]/90'
                          }`}
                        >
                          {user?.isBlocked ? <FaCheckCircle size={12} /> : <FaBan size={12} />}
                          <span>{user?.isBlocked ? 'Unblock' : 'Block'}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          {filteredUsers.length === 0 && (
            <div className="text-center py-12">
              <div className="text-5xl mb-4">👥</div>
              <p className="text-[#6B7280] text-lg">No users found</p>
              <p className="text-[#6B7280] text-sm mt-1">
                {search ? `No results for "${search}"` : 'Try changing your filter'}
              </p>
            </div>
          )}
        </div>
        
        {/* Results Summary */}
        {filteredUsers.length > 0 && (
          <div className="mt-4 text-center text-sm text-[#6B7280]">
            Showing {filteredUsers.length} of {users.length} users
          </div>
        )}
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
      />
    </div>
  );
};

export default AdminUsers;
