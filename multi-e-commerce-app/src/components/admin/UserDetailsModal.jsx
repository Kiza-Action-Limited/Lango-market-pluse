import React from 'react';
import { FaTimesCircle, FaUser, FaBox, FaShoppingCart, FaMoneyBillWave, FaStar } from 'react-icons/fa';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import { getUserCategoryLabel } from '../../utils/userCategory';

const valueOrDash = (value) => {
  if (value === null || value === undefined || value === '') return '-';
  return String(value);
};

const DetailItem = ({ label, value }) => (
  <div>
    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
    <p className="mt-1 break-words text-sm font-medium text-[#111827]">{valueOrDash(value)}</p>
  </div>
);

const MetricCard = ({ icon: Icon, label, value, tone = 'text-[#F97316]' }) => (
  <div className="rounded-lg border border-gray-200 bg-white p-4">
    <div className="flex items-center gap-3">
      <Icon className={`text-xl ${tone}`} />
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-lg font-bold text-[#111827]">{value}</p>
      </div>
    </div>
  </div>
);

const getDisplayName = (user = {}) =>
  user.fullName || user.name || user.businessName || user.email || 'Unknown User';

const getOrderTotal = (order = {}) => order.totalAmount ?? order.total ?? 0;

const UserDetailsModal = ({ open, loading = false, details, fallbackUser, onClose }) => {
  if (!open) return null;

  const user = details?.user || fallbackUser || {};
  const analytics = details?.analytics || {};
  const productStats = details?.productStats || {};
  const recentOrders = Array.isArray(details?.recentOrders) ? details.recentOrders : [];
  const products = Array.isArray(details?.products) ? details.products : [];
  const initials = getDisplayName(user).slice(0, 2).toUpperCase();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-xl bg-white shadow-xl">
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-gray-200 bg-white p-5">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#F97316] text-lg font-bold text-white">
              {initials}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-[#111827]">{getDisplayName(user)}</h2>
              <p className="text-sm text-gray-500">
                {getUserCategoryLabel(user)} - {user.isActive === false ? 'Inactive' : 'Active'}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-gray-500 hover:text-gray-700" aria-label="Close user details">
            <FaTimesCircle className="text-xl" />
          </button>
        </div>

        {loading ? (
          <div className="p-8">
            <div className="mb-4 h-8 w-64 rounded bg-gray-200 skeleton-shimmer" />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-24 rounded-lg bg-gray-100 skeleton-shimmer" />
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-6 p-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <MetricCard icon={FaShoppingCart} label="Total Orders" value={analytics.totalOrders || 0} />
              <MetricCard icon={FaMoneyBillWave} label="Total Spent" value={formatCurrency(analytics.totalSpent || 0)} tone="text-[#16A34A]" />
              <MetricCard icon={FaBox} label="Products Listed" value={productStats.totalProducts || 0} tone="text-[#3B82F6]" />
              <MetricCard icon={FaStar} label="Avg Rating" value={Number(productStats.avgRating || 0).toFixed(1)} tone="text-[#F59E0B]" />
            </div>

            <section className="rounded-xl border border-gray-200 p-4">
              <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-[#111827]">
                <FaUser className="text-[#F97316]" /> Profile Details
              </h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <DetailItem label="User ID" value={user._id || user.id || user.userId} />
                <DetailItem label="Full Name" value={user.fullName || user.name} />
                <DetailItem label="Email" value={user.email} />
                <DetailItem label="Phone" value={user.phone} />
                <DetailItem label="Role" value={user.role} />
                <DetailItem label="Business Type" value={user.businessType} />
                <DetailItem label="Business Name" value={user.businessName} />
                <DetailItem label="Account Role" value={user.accountRole} />
                <DetailItem label="Subscription" value={user.subscriptionTier} />
                <DetailItem label="KYC Verified" value={user.kycVerified ? 'Yes' : 'No'} />
                <DetailItem label="Wallet Balance" value={formatCurrency(user.walletBalance || 0)} />
                <DetailItem label="Escrow Balance" value={formatCurrency(user.escrowBalance || 0)} />
                <DetailItem label="SMS Credits" value={user.smsCredits ?? 0} />
                <DetailItem label="Joined" value={formatDateTime(user.createdAt)} />
                <DetailItem label="Last Updated" value={formatDateTime(user.updatedAt)} />
                <DetailItem label="Last Login" value={formatDateTime(user.lastLogin)} />
              </div>
            </section>

            {user.logisticsProfile && (
              <section className="rounded-xl border border-gray-200 p-4">
                <h3 className="mb-4 text-lg font-semibold text-[#111827]">Logistics Details</h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <DetailItem label="Verification" value={user.logisticsProfile.verificationStatus} />
                  <DetailItem label="Document Type" value={user.logisticsProfile.documentType} />
                  <DetailItem label="Document Number" value={user.logisticsProfile.documentNumber} />
                  <DetailItem label="Vehicle Plate" value={user.logisticsProfile.vehiclePlate} />
                  <DetailItem label="Capacity KG" value={user.logisticsProfile.cargoCapacityKg} />
                  <DetailItem label="Driver Mode" value={user.logisticsProfile.driverMode} />
                  <DetailItem label="Submitted" value={formatDateTime(user.logisticsProfile.applicationSubmittedAt)} />
                  <DetailItem label="Reviewed" value={formatDateTime(user.logisticsProfile.reviewedAt)} />
                  <DetailItem label="Review Notes" value={user.logisticsProfile.reviewNotes} />
                </div>
              </section>
            )}

            <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-gray-200 p-4">
                <h3 className="mb-4 text-lg font-semibold text-[#111827]">Recent Orders</h3>
                {recentOrders.length === 0 ? (
                  <p className="text-sm text-gray-500">No recent orders found.</p>
                ) : (
                  <div className="space-y-3">
                    {recentOrders.map((order) => (
                      <div key={order._id || order.id} className="rounded-lg bg-gray-50 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-mono text-sm text-[#F97316]">#{String(order.orderNumber || order._id || '').slice(-8)}</p>
                          <span className="rounded-full bg-white px-2 py-1 text-xs capitalize text-gray-600">{order.status || 'pending'}</span>
                        </div>
                        <p className="mt-1 text-sm text-gray-700">{order.product?.name || order.items?.[0]?.name || 'Order item'}</p>
                        <p className="mt-1 text-sm font-semibold text-[#16A34A]">{formatCurrency(getOrderTotal(order))}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-gray-200 p-4">
                <h3 className="mb-4 text-lg font-semibold text-[#111827]">Seller Products</h3>
                {products.length === 0 ? (
                  <p className="text-sm text-gray-500">No listed products found for this user.</p>
                ) : (
                  <div className="space-y-3">
                    {products.map((product) => (
                      <div key={product._id || product.id} className="rounded-lg bg-gray-50 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-medium text-[#111827]">{product.name}</p>
                          <span className={`rounded-full px-2 py-1 text-xs ${product.isPublished ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                            {product.isPublished ? 'Published' : 'Draft'}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-gray-600">{product.category} - Stock {product.quantityAvailable ?? 0}</p>
                        <p className="mt-1 text-sm font-semibold text-[#16A34A]">{formatCurrency(product.price || 0)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserDetailsModal;
