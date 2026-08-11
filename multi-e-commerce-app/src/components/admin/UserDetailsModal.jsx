import React, { useState } from 'react';
import { FaTimesCircle, FaUser, FaBox, FaShoppingCart, FaMoneyBillWave, FaStar, FaPhoneAlt, FaIdCard, FaCheckCircle, FaFileAlt, FaExternalLinkAlt, FaUpload } from 'react-icons/fa';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import { getUserCategoryLabel, isBuyerUser } from '../../utils/userCategory';

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
  isBuyerUser(user)
    ? user.fullName || user.name || user.email || 'Unknown User'
    : user.fullName || user.name || user.businessName || user.email || 'Unknown User';

const getOrderTotal = (order = {}) => order.totalAmount ?? order.total ?? 0;

const verificationStatuses = ['unverified', 'pending', 'verified', 'gold', 'rejected', 'restricted'];
const documentTypes = ['national_id', 'business_permit', 'tax_certificate', 'kyc', 'contract', 'receipt', 'other'];

const formatStatus = (value) => String(value || 'unverified')
  .replace(/_/g, ' ')
  .replace(/\b\w/g, (letter) => letter.toUpperCase());

const getVerificationTone = (status) => {
  if (status === 'verified' || status === 'gold') return 'border-[#16A34A]/20 bg-[#16A34A]/10 text-[#15803D]';
  if (status === 'pending') return 'border-[#F59E0B]/20 bg-[#F59E0B]/10 text-[#B45309]';
  if (status === 'rejected' || status === 'restricted') return 'border-red-200 bg-red-100 text-red-800';
  return 'border-gray-200 bg-gray-100 text-gray-700';
};

const formatFileSize = (size) => {
  const bytes = Number(size || 0);
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const UserDetailsModal = ({ open, loading = false, details, fallbackUser, onClose, onUpdateVerification, onUploadDocument }) => {
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [documentFile, setDocumentFile] = useState(null);
  const [documentForm, setDocumentForm] = useState({
    documentType: 'kyc',
    title: '',
    documentNumber: '',
    notes: '',
  });

  if (!open) return null;

  const user = details?.user || fallbackUser || {};
  const buyerAccount = isBuyerUser(user);
  const analytics = details?.analytics || {};
  const productStats = details?.productStats || {};
  const recentOrders = Array.isArray(details?.recentOrders) ? details.recentOrders : [];
  const products = Array.isArray(details?.products) ? details.products : [];
  const initials = getDisplayName(user).slice(0, 2).toUpperCase();
  const userId = user._id || user.id || user.userId;
  const kycStatus = user.verificationStatus || (user.kycVerified ? 'verified' : 'unverified');
  const canUpdateVerification = Boolean(onUpdateVerification && userId);
  const canUploadDocument = Boolean(onUploadDocument && userId);
  const adminDocuments = Array.isArray(user.adminDocuments) ? user.adminDocuments : [];
  const allDocuments = Array.isArray(details?.documents) ? details.documents : adminDocuments;
  const canSaveDocumentRecord = Boolean(
    documentFile ||
    documentForm.title.trim() ||
    documentForm.documentNumber.trim() ||
    documentForm.notes.trim()
  );

  const updateVerification = (payload) => {
    if (!canUpdateVerification) return;
    onUpdateVerification(userId, payload);
  };

  const submitDocumentUpload = async (event) => {
    event.preventDefault();
    const hasDatabaseRecord = Boolean(
      documentForm.title.trim() ||
      documentForm.documentNumber.trim() ||
      documentForm.notes.trim()
    );
    if (!canUploadDocument || (!documentFile && !hasDatabaseRecord)) return;

    const formData = new FormData();
    if (documentFile) formData.append('document', documentFile);
    formData.append('documentType', documentForm.documentType);
    formData.append('title', documentForm.title.trim());
    formData.append('documentNumber', documentForm.documentNumber.trim());
    formData.append('notes', documentForm.notes.trim());

    setUploadingDocument(true);
    try {
      await onUploadDocument(userId, formData);
      setDocumentFile(null);
      setDocumentForm({ documentType: 'kyc', title: '', documentNumber: '', notes: '' });
      event.target.reset();
    } finally {
      setUploadingDocument(false);
    }
  };

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
                <DetailItem label="Full Name" value={user.fullName || user.name} />
                <DetailItem label="Email" value={user.email} />
                <DetailItem label="Phone" value={user.phone} />
                <DetailItem label="Role" value={user.role} />
                {!buyerAccount && <DetailItem label="Business Type" value={user.businessType} />}
                {!buyerAccount && <DetailItem label="Business Name" value={user.businessName} />}
                <DetailItem label="Account Role" value={user.accountRole} />
                <DetailItem label="Subscription" value={user.subscriptionTier} />
                <DetailItem label="KYC Verified" value={user.kycVerified ? 'Yes' : 'No'} />
                <DetailItem label="KYC Status" value={formatStatus(kycStatus)} />
                <DetailItem label="Phone Verified" value={user.isPhoneVerified ? 'Yes' : 'No'} />
                <DetailItem label="Email Verified" value={user.isEmailVerified ? 'Yes' : 'No'} />
                <DetailItem label="Wallet Balance" value={formatCurrency(user.walletBalance || 0)} />
                <DetailItem label="Escrow Balance" value={formatCurrency(user.escrowBalance || 0)} />
                <DetailItem label="SMS Credits" value={user.smsCredits ?? 0} />
                <DetailItem label="Joined" value={formatDateTime(user.createdAt)} />
                <DetailItem label="Last Updated" value={formatDateTime(user.updatedAt)} />
                <DetailItem label="Last Login" value={formatDateTime(user.lastLogin)} />
              </div>
            </section>

            {canUpdateVerification && (
              <section className="rounded-xl border border-gray-200 p-4">
                <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-[#111827]">
                  <FaCheckCircle className="text-[#16A34A]" /> Admin Verification Controls
                </h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <div className="mb-3 flex items-center gap-2 font-semibold text-[#111827]">
                      <FaPhoneAlt className="text-[#F97316]" />
                      Phone Verification
                    </div>
                    <button
                      type="button"
                      onClick={() => updateVerification({ isPhoneVerified: !user.isPhoneVerified })}
                      className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${
                        user.isPhoneVerified
                          ? 'border-red-200 bg-white text-red-700 hover:bg-red-50'
                          : 'border-[#16A34A]/30 bg-[#16A34A] text-white hover:bg-[#15803D]'
                      }`}
                    >
                      {user.isPhoneVerified ? 'Mark Phone Unverified' : 'Mark Phone Verified'}
                    </button>
                  </div>

                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <label className="mb-3 flex items-center gap-2 font-semibold text-[#111827]" htmlFor="admin-kyc-status">
                      <FaIdCard className="text-[#F97316]" />
                      KYC Status
                    </label>
                    <select
                      id="admin-kyc-status"
                      value={kycStatus}
                      onChange={(event) => updateVerification({ verificationStatus: event.target.value })}
                      className={`w-full rounded-lg border px-3 py-2 text-sm font-semibold outline-none ${getVerificationTone(kycStatus)}`}
                    >
                      {verificationStatuses.map((status) => (
                        <option key={status} value={status}>{formatStatus(status)}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </section>
            )}

            <section className="rounded-xl border border-gray-200 p-4">
              <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-[#111827]">
                <FaFileAlt className="text-[#F97316]" /> All User Documents
              </h3>

              {canUploadDocument && (
                <form onSubmit={submitDocumentUpload} className="mb-5 rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                    <label className="text-sm font-semibold text-[#111827]">
                      Document Type
                      <select
                        value={documentForm.documentType}
                        onChange={(event) => setDocumentForm((current) => ({ ...current, documentType: event.target.value }))}
                        className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#F97316]"
                      >
                        {documentTypes.map((type) => (
                          <option key={type} value={type}>{formatStatus(type)}</option>
                        ))}
                      </select>
                    </label>
                    <label className="text-sm font-semibold text-[#111827]">
                      Document Number
                      <input
                        type="text"
                        value={documentForm.documentNumber}
                        onChange={(event) => setDocumentForm((current) => ({ ...current, documentNumber: event.target.value }))}
                        className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#F97316]"
                        placeholder="ID, permit, tax PIN"
                      />
                    </label>
                    <label className="text-sm font-semibold text-[#111827]">
                      Title
                      <input
                        type="text"
                        value={documentForm.title}
                        onChange={(event) => setDocumentForm((current) => ({ ...current, title: event.target.value }))}
                        className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#F97316]"
                        placeholder="Document title"
                      />
                    </label>
                    <label className="text-sm font-semibold text-[#111827]">
                      File
                      <input
                        type="file"
                        accept=".jpg,.jpeg,.png,.webp,.pdf"
                        onChange={(event) => setDocumentFile(event.target.files?.[0] || null)}
                        className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="text-sm font-semibold text-[#111827] md:col-span-3">
                      Notes
                      <input
                        type="text"
                        value={documentForm.notes}
                        onChange={(event) => setDocumentForm((current) => ({ ...current, notes: event.target.value }))}
                        className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#F97316]"
                        placeholder="Internal admin note"
                      />
                    </label>
                    <div className="flex items-end">
                      <button
                        type="submit"
                        disabled={uploadingDocument || !canSaveDocumentRecord}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#111827] px-4 py-2 text-sm font-semibold text-white hover:bg-[#374151] disabled:opacity-60"
                      >
                        <FaUpload />
                        {uploadingDocument ? 'Saving...' : documentFile ? 'Save Document' : 'Save DB Record'}
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {allDocuments.length > 0 ? (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {allDocuments.map((doc, index) => {
                    const hasFileUrl = Boolean(doc.url);
                    const CardTag = hasFileUrl ? 'a' : 'div';
                    const cardProps = hasFileUrl
                      ? { href: doc.url, target: '_blank', rel: 'noreferrer' }
                      : {};

                    return (
                      <CardTag
                        key={doc._id || doc.publicId || `${doc.url || doc.documentNumber || doc.source}-${index}`}
                        {...cardProps}
                        className={`rounded-lg border border-gray-200 bg-white p-4 transition ${
                          hasFileUrl ? 'hover:border-[#F97316]/40 hover:bg-[#FFF7ED]' : 'border-dashed'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-[#111827]">{doc.title || doc.originalName || `Document ${index + 1}`}</p>
                            <p className="mt-1 text-xs font-semibold uppercase text-[#F97316]">{formatStatus(doc.documentType)}</p>
                          </div>
                          {hasFileUrl ? (
                            <FaExternalLinkAlt className="shrink-0 text-[#6B7280]" />
                          ) : (
                            <span className="shrink-0 rounded-full bg-gray-100 px-2 py-1 text-[11px] font-semibold text-gray-600">Record</span>
                          )}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className="inline-flex rounded-full border border-gray-200 bg-gray-50 px-2 py-1 text-xs font-semibold text-gray-600">
                            {formatStatus(doc.source || 'admin_saved')}
                          </span>
                          {doc.documentNumber && (
                            <span className="inline-flex rounded-full border border-blue-100 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">
                              #{doc.documentNumber}
                            </span>
                          )}
                        </div>
                        <p className="mt-2 truncate text-sm text-gray-500">
                          {hasFileUrl ? (doc.originalName || doc.mimeType || 'Saved file') : 'Database verification record'} {formatFileSize(doc.size)}
                        </p>
                        {doc.notes && <p className="mt-2 text-sm text-gray-600">{doc.notes}</p>}
                        <p className="mt-2 text-xs text-gray-400">{formatDateTime(doc.uploadedAt)}</p>
                      </CardTag>
                    );
                  })}
                </div>
              ) : (
                <p className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-500">
                  No user documents are saved for this account yet.
                </p>
              )}
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
