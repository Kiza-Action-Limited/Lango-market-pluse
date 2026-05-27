import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { FaCheckCircle, FaQrcode, FaTruckLoading } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { logisticsService } from '../services/logisticsService';

const LogisticsStatus = () => {
  const { user, isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(true);
  const [application, setApplication] = useState(null);
  const [trips, setTrips] = useState([]);

  const role = String(user?.role || '').toLowerCase();
  const profileStatus = application?.logisticsProfile?.verificationStatus || 'unverified';

  const flowSteps = [
    'Register',
    'Apply as Logistics',
    'Upload Documents',
    'Admin Verification',
    'Approval',
    'Can Accept Orders',
    'QR Pickup + Delivery',
    'Escrow Release',
  ];

  const hasAcceptedTrip = trips.some((trip) => !!trip.driver && String(trip.driver) === String(user?._id || user?.id));
  const hasQrFlowTrip = trips.some((trip) => ['in_transit', 'delivered', 'disputed'].includes(trip.status));
  const hasEscrowReleasedTrip = trips.some((trip) => trip?.escrow?.status === 'released');

  const completedStepIndex = (() => {
    if (!isAuthenticated) return 0;
    if (role !== 'logistics') return 1;
    if (profileStatus === 'unverified') return 2;
    if (profileStatus === 'pending') return 4;
    if (profileStatus === 'rejected') return 3;
    if (profileStatus === 'verified' && hasEscrowReleasedTrip) return 8;
    if (profileStatus === 'verified' && hasQrFlowTrip) return 7;
    if (profileStatus === 'verified' && hasAcceptedTrip) return 6;
    if (profileStatus === 'verified') return 5;
    return 1;
  })();

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [appData, tripsData] = await Promise.all([
        logisticsService.getMyApplication(),
        logisticsService.getDriverTrips({ page: 1, limit: 30 }),
      ]);
      setApplication(appData);
      setTrips(tripsData?.data || []);
    } catch (error) {
      const message = error?.response?.data?.message || 'Unable to load logistics status';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) fetchAll();
    else setLoading(false);
  }, [isAuthenticated]);

  const handleAccept = async (tripId) => {
    try {
      await logisticsService.acceptTrip(tripId);
      toast.success('Trip accepted. Proceed to pickup scan.');
      fetchAll();
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to accept trip');
    }
  };

  const handlePickupScan = async (tripId) => {
    const qrPayload = window.prompt('Enter Seller QR payload to confirm pickup');
    if (!qrPayload) return;

    try {
      await logisticsService.scanPickup(tripId, { qrPayload });
      toast.success('Pickup scan verified. Trip is now in transit.');
      fetchAll();
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Pickup scan failed');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] p-8">
        <div className="max-w-2xl mx-auto bg-white rounded-xl border border-gray-200 p-6">
          <p className="text-[#111827]">Please sign in to view logistics status.</p>
          <Link to="/login" className="inline-block mt-3 px-4 py-2 bg-[#F97316] text-white rounded-lg">Sign In</Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="min-h-screen bg-[#F9FAFB] p-8">Loading logistics status...</div>;
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB] py-8 px-4">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h1 className="text-2xl font-bold text-[#111827]">Logistics Status</h1>
          <p className="text-sm text-[#6B7280] mt-1">Track application approval and manage assigned trips.</p>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2">
            {flowSteps.map((step, idx) => {
              const done = idx < completedStepIndex;
              const active = idx === completedStepIndex;
              return (
                <div
                  key={step}
                  className={`rounded-lg border px-3 py-2 text-sm ${
                    done
                      ? 'bg-green-50 border-green-200 text-green-800'
                      : active
                        ? 'bg-amber-50 border-amber-200 text-amber-900'
                        : 'bg-gray-50 border-gray-200 text-gray-500'
                  }`}
                >
                  {idx + 1}. {step}
                </div>
              );
            })}
          </div>

          <div className="mt-4 p-4 rounded-lg bg-[#F9FAFB] border border-gray-200">
            <p className="text-sm text-[#6B7280]">Role</p>
            <p className="font-semibold text-[#111827]">{role || 'buyer'}</p>
            <p className="text-sm text-[#6B7280] mt-2">Verification Status</p>
            <p className="font-semibold text-[#111827] capitalize">{profileStatus}</p>
            {profileStatus !== 'verified' && (
              <p className="text-sm text-[#6B7280] mt-2">
                You must be approved before accepting orders or performing pickup scans.
              </p>
            )}
            {profileStatus === 'verified' && (
              <p className="text-sm text-green-700 mt-2 inline-flex items-center gap-2">
                <FaCheckCircle /> Approved for logistics operations.
              </p>
            )}
          </div>

          {(role !== 'logistics' || profileStatus === 'unverified') && (
            <Link to="/logistics/apply" className="inline-block mt-4 text-[#F97316] font-medium hover:text-[#EA580C]">
              Apply as Logistics
            </Link>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-[#111827] inline-flex items-center gap-2"><FaTruckLoading /> Assigned Trips</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Order</th>
                  <th className="text-left py-2">Status</th>
                  <th className="text-left py-2">Driver Type</th>
                  <th className="text-left py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {trips.map((trip) => {
                  const canAccept = profileStatus === 'verified' && role === 'logistics' && trip.status === 'pending' && (!trip.driver || String(trip.driver) === String(user?._id || user?.id));
                  const canPickupScan = profileStatus === 'verified' && role === 'logistics' && trip.status === 'pending' && trip.driver && String(trip.driver) === String(user?._id || user?.id);

                  return (
                    <tr key={trip._id} className="border-b last:border-b-0">
                      <td className="py-2">{trip.orderNumber || trip._id}</td>
                      <td className="py-2 capitalize">{trip.status}</td>
                      <td className="py-2 capitalize">{trip.driverType || 'owner_operator'}</td>
                      <td className="py-2">
                        {canAccept && (
                          <button onClick={() => handleAccept(trip._id)} className="mr-2 px-3 py-1 rounded bg-[#F97316] text-white">Accept</button>
                        )}
                        {canPickupScan && (
                          <button onClick={() => handlePickupScan(trip._id)} className="inline-flex items-center gap-1 px-3 py-1 rounded bg-[#16A34A] text-white">
                            <FaQrcode /> Pickup QR Scan
                          </button>
                        )}
                        {!canAccept && !canPickupScan && <span className="text-[#6B7280]">No action</span>}
                      </td>
                    </tr>
                  );
                })}
                {trips.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-4 text-[#6B7280]">No logistics trips found yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LogisticsStatus;
