import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { FaCheckCircle, FaTimesCircle, FaTruck, FaUserCheck } from 'react-icons/fa';
import { logisticsService } from '../services/logisticsService';

const AdminLogistics = () => {
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [applications, setApplications] = useState([]);
  const [trips, setTrips] = useState([]);
  const [reviewNotes, setReviewNotes] = useState({});

  const fetchData = async () => {
    setLoading(true);
    try {
      const [appsRes, tripsRes] = await Promise.all([
        logisticsService.getAdminApplications({ status: statusFilter, page: 1, limit: 50 }),
        logisticsService.getAdminLogisticsTrips({ page: 1, limit: 30 }),
      ]);
      setApplications(appsRes?.data || []);
      setTrips(tripsRes?.logistics || []);
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to load logistics admin data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [statusFilter]);

  const reviewApplication = async (userId, action) => {
    try {
      await logisticsService.reviewApplication(userId, {
        action,
        notes: reviewNotes[userId] || '',
      });
      toast.success(`Application ${action}d successfully`);
      fetchData();
    } catch (error) {
      toast.error(error?.response?.data?.message || `Failed to ${action} application`);
    }
  };

  return (
    <div className="bg-[#F9FAFB] min-h-screen py-8">
      <div className="container mx-auto px-4 space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-[#111827]">Logistics Admin Review</h1>
          <p className="text-[#6B7280] mt-1">Verify logistics applications and monitor active delivery records.</p>
          <Link
            to="/admin/logistics-tools"
            className="mt-3 inline-flex items-center rounded-lg bg-[#111827] px-4 py-2 text-sm font-medium text-white hover:bg-black"
          >
            Open Logistics Tools
          </Link>
        </div>

        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
            <h2 className="text-xl font-semibold text-[#111827] inline-flex items-center gap-2">
              <FaUserCheck className="text-[#F97316]" /> Logistics Applications
            </h2>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="pending">Pending</option>
              <option value="verified">Verified</option>
              <option value="rejected">Rejected</option>
              <option value="all">All</option>
            </select>
          </div>

          {loading ? (
            <p className="text-[#6B7280]">Loading applications...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Applicant</th>
                    <th className="text-left py-2">Phone</th>
                    <th className="text-left py-2">Mode</th>
                    <th className="text-left py-2">Vehicle</th>
                    <th className="text-left py-2">Capacity</th>
                    <th className="text-left py-2">Status</th>
                    <th className="text-left py-2">Documents</th>
                    <th className="text-left py-2">Review</th>
                  </tr>
                </thead>
                <tbody>
                  {applications.map((app) => {
                    const profile = app.logisticsProfile || {};
                    const status = profile.verificationStatus || 'unverified';
                    const docs = Array.isArray(profile.documents) ? profile.documents : [];
                    return (
                      <tr key={app._id} className="border-b last:border-b-0">
                        <td className="py-2">
                          <div className="font-medium text-[#111827]">{app.fullName || 'N/A'}</div>
                          <div className="text-xs text-[#6B7280]">{app.email || 'No email'}</div>
                        </td>
                        <td className="py-2">{app.phone || 'N/A'}</td>
                        <td className="py-2 capitalize">{profile.driverMode || '-'}</td>
                        <td className="py-2">{profile.vehiclePlate || '-'}</td>
                        <td className="py-2">{profile.cargoCapacityKg || '-'}</td>
                        <td className="py-2 capitalize">{status}</td>
                        <td className="py-2">
                          {docs.length > 0 ? (
                            <div className="flex flex-col gap-1">
                              {docs.map((doc, index) => (
                                <a
                                  key={`${app._id}-${index}`}
                                  href={doc.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[#2563EB] hover:underline"
                                >
                                  {doc.documentType || 'document'} #{index + 1}
                                </a>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[#6B7280]">No docs</span>
                          )}
                        </td>
                        <td className="py-2">
                          <input
                            placeholder="Notes"
                            value={reviewNotes[app._id] || ''}
                            onChange={(e) => setReviewNotes((prev) => ({ ...prev, [app._id]: e.target.value }))}
                            className="border border-gray-300 rounded px-2 py-1 mr-2"
                          />
                          {status === 'pending' && (
                            <>
                              <button
                                onClick={() => reviewApplication(app._id, 'approve')}
                                className="mr-2 inline-flex items-center gap-1 px-2 py-1 rounded bg-[#16A34A] text-white"
                              >
                                <FaCheckCircle /> Approve
                              </button>
                              <button
                                onClick={() => reviewApplication(app._id, 'reject')}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[#DC2626] text-white"
                              >
                                <FaTimesCircle /> Reject
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {applications.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-4 text-[#6B7280]">No applications found for this filter.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-[#111827] inline-flex items-center gap-2 mb-4">
            <FaTruck className="text-[#3B82F6]" /> Recent Logistics Records
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Order</th>
                  <th className="text-left py-2">Status</th>
                  <th className="text-left py-2">Driver Type</th>
                  <th className="text-left py-2">Driver</th>
                </tr>
              </thead>
              <tbody>
                {trips.map((trip) => (
                  <tr key={trip._id} className="border-b last:border-b-0">
                    <td className="py-2">{trip.orderNumber || trip._id}</td>
                    <td className="py-2 capitalize">{trip.status}</td>
                    <td className="py-2 capitalize">{trip.driverType || '-'}</td>
                    <td className="py-2">{trip.driverName || trip.driver?.fullName || '-'}</td>
                  </tr>
                ))}
                {trips.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-4 text-[#6B7280]">No logistics records yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
};

export default AdminLogistics;
