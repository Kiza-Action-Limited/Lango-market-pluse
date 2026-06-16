import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Link, Navigate } from 'react-router-dom';
import { FaCheckCircle, FaClipboardCheck, FaClock, FaLayerGroup, FaMoneyBillWave, FaQrcode, FaRoute } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { logisticsService } from '../services/logisticsService';
import { DonutGauge, KpiCard, Panel, ProgressRow, StatusPill } from '../components/dashboard/DashboardWidgets';
import NotificationPreferencesCard from '../components/NotificationPreferencesCard';
import { formatRealtimeStamp, useRealtimeRefresh } from '../hooks/useRealtimeRefresh';
import { formatCurrency } from '../utils/formatters';

const LogisticsStatus = () => {
  const { user, isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(true);
  const [application, setApplication] = useState(null);
  const [trips, setTrips] = useState([]);
  const [dashboardRange, setDashboardRange] = useState('30d');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  const role = String(user?.role || '').toLowerCase();
  const profileStatus = application?.logisticsProfile?.verificationStatus || 'unverified';
  const currentUserId = String(user?._id || user?.id || '');
  const getTripDriverId = (trip) => {
    const driver = trip?.driver;
    if (!driver) return '';
    if (typeof driver === 'object') return String(driver._id || driver.id || '');
    return String(driver);
  };

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

  const hasAcceptedTrip = trips.some((trip) => getTripDriverId(trip) === currentUserId);
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

  const fetchAll = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const [appData, tripsData] = await Promise.all([
        logisticsService.getMyApplication(),
        logisticsService.getDriverTrips({ page: 1, limit: 30 }),
      ]);
      setApplication(appData);
      setTrips(tripsData?.data || []);
    } catch (error) {
      const message = error?.response?.data?.message || 'Unable to load logistics status';
      if (silent) console.error(message);
      else toast.error(message);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const { lastUpdated, isRefreshing: isRealtimeRefreshing } = useRealtimeRefresh(
    () => fetchAll({ silent: true }),
    { enabled: isAuthenticated && role === 'logistics', intervalMs: 10000, deps: [isAuthenticated, role] }
  );

  useEffect(() => {
    if (isAuthenticated && role === 'logistics') fetchAll();
    else setLoading(false);
  }, [isAuthenticated, role]);

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
    const qrPayload = window.prompt('Enter the seller PICKUP QR payload to confirm pickup');
    if (!qrPayload) return;

    try {
      await logisticsService.scanPickup(tripId, { qrPayload });
      toast.success('Pickup scan verified. Trip is now in transit.');
      fetchAll();
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || 'Pickup scan failed');
    }
  };

  const getCurrentGps = () => new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => reject(error),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  });

  const handleDeliveryScan = async (tripId) => {
    const qrPayload = window.prompt('Enter the buyer DELIVERY QR payload to confirm delivery');
    if (!qrPayload) return;

    try {
      const gpsCoords = await getCurrentGps().catch(() => {
        const manualLat = window.prompt('Enter delivery latitude');
        const manualLng = window.prompt('Enter delivery longitude');
        if (!manualLat || !manualLng) return null;
        return { lat: Number(manualLat), lng: Number(manualLng) };
      });

      if (!gpsCoords?.lat || !gpsCoords?.lng) {
        toast.error('GPS coordinates are required for delivery confirmation');
        return;
      }

      await logisticsService.scanDelivery(tripId, { qrPayload, gpsCoords });
      toast.success('Delivery scan verified. Trip is now completed.');
      fetchAll();
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || 'Delivery scan failed');
    }
  };

  const applyDashboardRange = (range) => {
    setDashboardRange(range);
    const end = new Date();
    const start = new Date();

    if (range === 'today') {
      start.setHours(0, 0, 0, 0);
    } else if (range === '7d') {
      start.setDate(end.getDate() - 7);
    } else if (range === '30d') {
      start.setDate(end.getDate() - 30);
    } else if (range === '90d') {
      start.setDate(end.getDate() - 90);
    } else if (range === 'year') {
      start.setFullYear(end.getFullYear() - 1);
    }

    setDateRange({
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
    });
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

  if (role !== 'logistics') {
    return <Navigate to={role === 'seller' ? '/seller' : '/'} replace />;
  }

  if (loading) {
    return <div className="min-h-screen bg-[#F9FAFB] p-8">Loading logistics status...</div>;
  }

  const filteredTrips = trips.filter((trip) => {
    if (!dateRange.start || !dateRange.end || !trip.createdAt) return true;
    const created = new Date(trip.createdAt);
    return created >= new Date(dateRange.start) && created <= new Date(`${dateRange.end}T23:59:59`);
  });
  const assignedTrips = filteredTrips.filter((trip) => getTripDriverId(trip) === currentUserId);
  const pendingTrips = filteredTrips.filter((trip) => trip.status === 'pending').length;
  const inTransitTrips = filteredTrips.filter((trip) => ['in_transit', 'picked_up', 'out_for_delivery'].includes(trip.status)).length;
  const deliveredTrips = filteredTrips.filter((trip) => trip.status === 'delivered').length;
  const failedTrips = filteredTrips.filter((trip) => ['failed', 'disputed'].includes(trip.status)).length;
  const escrowReleased = filteredTrips.filter((trip) => trip?.escrow?.status === 'released').length;
  const completionRate = filteredTrips.length ? Math.round((deliveredTrips / filteredTrips.length) * 100) : 0;
  const failedRate = filteredTrips.length ? Math.round((failedTrips / filteredTrips.length) * 100) : 0;
  const avgHoursBetween = (startKeys, endKeys) => {
    const durations = filteredTrips
      .map((trip) => {
        const startValue = startKeys.map((key) => trip[key]).find(Boolean);
        const endValue = endKeys.map((key) => trip[key]).find(Boolean);
        if (!startValue || !endValue) return null;
        return (new Date(endValue).getTime() - new Date(startValue).getTime()) / (1000 * 60 * 60);
      })
      .filter((value) => Number.isFinite(value) && value >= 0);
    if (!durations.length) return null;
    return durations.reduce((sum, value) => sum + value, 0) / durations.length;
  };
  const avgPickupHours = avgHoursBetween(['createdAt'], ['pickedUpAt', 'pickupScannedAt', 'updatedAt']);
  const avgDeliveryHours = avgHoursBetween(['pickedUpAt', 'pickupScannedAt', 'createdAt'], ['deliveredAt', 'completedAt', 'updatedAt']);
  const routeCounts = filteredTrips.reduce((acc, trip) => {
    const route = trip.currentLocation || trip.pickupAddress?.city || trip.shippingAddress?.city || trip.destination || 'Unknown route';
    acc[route] = (acc[route] || 0) + 1;
    return acc;
  }, {});
  const topRoutes = Object.entries(routeCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const escrowAmount = filteredTrips.reduce((sum, trip) => sum + Number(trip?.escrow?.amount || trip.deliveryFee || trip.fee || 0), 0);
  const verificationScore = profileStatus === 'verified' ? 100 : profileStatus === 'pending' ? 62 : profileStatus === 'rejected' ? 25 : 35;
  const statusTone = (status) => {
    if (status === 'delivered') return 'green';
    if (['in_transit', 'picked_up', 'out_for_delivery'].includes(status)) return 'blue';
    if (status === 'pending') return 'amber';
    if (['failed', 'disputed', 'rejected'].includes(status)) return 'red';
    return 'gray';
  };
  const assignedSeries = assignedTrips.length ? assignedTrips.map((_, index) => index + 1) : [trips.length];
  const activeRouteSeries = filteredTrips.map((trip) => (['in_transit', 'picked_up', 'out_for_delivery'].includes(trip.status) ? 1 : 0));
  const deliveredSeries = filteredTrips.map((trip) => (trip.status === 'delivered' ? 1 : 0));
  const escrowSeries = filteredTrips.map((trip) => (trip?.escrow?.status === 'released' ? 1 : 0));
  const routeSeries = [pendingTrips, assignedTrips.length, inTransitTrips, deliveredTrips, escrowReleased];
  const maxRouteValue = Math.max(...routeSeries, 0);
  const routeBars = routeSeries.map((value) => (maxRouteValue > 0 ? Math.max(6, (value / maxRouteValue) * 100) : 0));

  return (
    <div className="min-h-screen bg-[#F7F8FA] px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-[1500px]">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#F97316]">Logistics workspace</p>
            <h1 className="mt-1 text-2xl font-bold text-[#111827]">Delivery Operations Dashboard</h1>
            <p className="mt-1 text-sm text-gray-500">Track verification, assigned trips, pickup scans, route status, and escrow release.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/logistics/tools"
              className="inline-flex h-10 items-center gap-2 rounded-md border border-gray-200 bg-white px-4 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              <FaLayerGroup />
              Operations Hub
            </Link>
            <div className="inline-flex h-10 items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 text-xs font-medium text-green-700">
              <span className={`h-2 w-2 rounded-full bg-green-500 ${isRealtimeRefreshing ? 'animate-pulse' : ''}`} />
              Live - {formatRealtimeStamp(lastUpdated)}
            </div>
            <div className="flex overflow-hidden rounded-md border border-gray-200 bg-white">
              {[
                ['today', 'Today'],
                ['7d', '7D'],
                ['30d', '30D'],
                ['90d', '90D'],
                ['year', 'Year'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => applyDashboardRange(value)}
                  className={`h-10 px-3 text-xs font-medium ${dashboardRange === value ? 'bg-[#111827] text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <StatusPill tone={profileStatus === 'verified' ? 'green' : profileStatus === 'pending' ? 'amber' : 'gray'}>
              {profileStatus}
            </StatusPill>
            {profileStatus === 'unverified' && (
              <Link to="/logistics/apply" className="inline-flex h-10 items-center rounded-md bg-[#F97316] px-4 text-sm font-medium text-white hover:bg-[#EA580C]">
                Apply as Logistics
              </Link>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard icon={FaClipboardCheck} label="Assigned Trips" value={assignedTrips.length || filteredTrips.length} detail={`${pendingTrips} pending`} color="#F97316" points={assignedSeries} />
          <KpiCard icon={FaRoute} label="Active Routes" value={inTransitTrips} detail="in transit or pickup" color="#3B82F6" points={activeRouteSeries} />
          <KpiCard icon={FaCheckCircle} label="Delivered" value={deliveredTrips} detail={`${completionRate}% completion`} color="#16A34A" points={deliveredSeries} />
          <KpiCard icon={FaMoneyBillWave} label="Escrow Released" value={escrowReleased} detail="completed payouts" color="#8B5CF6" points={escrowSeries} />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard icon={FaClock} label="Avg Pickup Time" value={avgPickupHours === null ? '-' : `${avgPickupHours.toFixed(1)}h`} detail="created to pickup" color="#F59E0B" points={filteredTrips.map((trip) => (trip.pickedUpAt || trip.pickupScannedAt ? 1 : 0))} />
          <KpiCard icon={FaRoute} label="Avg Delivery Time" value={avgDeliveryHours === null ? '-' : `${avgDeliveryHours.toFixed(1)}h`} detail="pickup to delivery" color="#3B82F6" points={filteredTrips.map((trip) => (trip.deliveredAt || trip.completedAt ? 1 : 0))} />
          <KpiCard icon={FaClipboardCheck} label="Failed Delivery Rate" value={`${failedRate}%`} detail={`${failedTrips} failed/disputed`} color="#DC2626" points={[failedTrips, filteredTrips.length]} />
          <KpiCard icon={FaMoneyBillWave} label="Driver Earnings" value={formatCurrency(escrowAmount)} detail="escrow/fee tracked" color="#16A34A" points={filteredTrips.map((trip) => Number(trip?.escrow?.amount || trip.deliveryFee || trip.fee || 0))} />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
          <NotificationPreferencesCard
            className="xl:col-span-12"
            title="Notification Preferences"
            description="Stay on top of dispatch, pickup, delivery, and account updates without leaving the logistics dashboard."
          />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
          <Panel title="Route Overview" className="xl:col-span-6">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-3xl font-bold text-[#111827]">{filteredTrips.length}</p>
                <p className="mt-1 text-sm text-gray-500">Total trips visible in your logistics queue</p>
              </div>
              <StatusPill tone={profileStatus === 'verified' ? 'green' : 'amber'}>
                {profileStatus === 'verified' ? 'Can accept orders' : 'Awaiting approval'}
              </StatusPill>
            </div>
            <div className="grid h-56 items-end gap-2 border-b border-l border-gray-100 px-2 pb-2" style={{ gridTemplateColumns: `repeat(${Math.max(routeBars.length, 1)}, minmax(0, 1fr))` }}>
              {routeBars.map((height, index) => (
                <div key={index} className="rounded-t-md bg-[#3B82F6]/20" style={{ height: `${height}%` }}>
                  <div className="h-full rounded-t-md bg-[#3B82F6]" style={{ opacity: Math.min(0.9, 0.3 + index * 0.07) }} />
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Trip Status" className="xl:col-span-3">
            <div className="space-y-4">
              <ProgressRow label="Pending" value={pendingTrips} max={Math.max(filteredTrips.length, 1)} color="#F59E0B" detail={`${pendingTrips}`} />
              <ProgressRow label="In transit" value={inTransitTrips} max={Math.max(filteredTrips.length, 1)} color="#3B82F6" detail={`${inTransitTrips}`} />
              <ProgressRow label="Delivered" value={deliveredTrips} max={Math.max(filteredTrips.length, 1)} color="#16A34A" detail={`${deliveredTrips}`} />
              <ProgressRow label="Escrow released" value={escrowReleased} max={Math.max(filteredTrips.length, 1)} color="#8B5CF6" detail={`${escrowReleased}`} />
            </div>
          </Panel>

          <Panel title="Verification Health" className="xl:col-span-3">
            <DonutGauge value={verificationScore} label={profileStatus === 'verified' ? 'Approved operator' : 'Application progress'} color={profileStatus === 'verified' ? '#16A34A' : '#F97316'} />
          </Panel>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
          <Panel title="Approval Flow" className="xl:col-span-4">
            <div className="space-y-2">
              {flowSteps.map((step, idx) => {
                const done = idx < completedStepIndex;
                const active = idx === completedStepIndex;
                return (
                  <div key={step} className={`rounded-md border px-3 py-2 text-sm ${done ? 'border-green-200 bg-green-50 text-green-800' : active ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-gray-200 bg-gray-50 text-gray-500'}`}>
                    <span className="font-semibold">{idx + 1}.</span> {step}
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel title="Assigned Trips" className="xl:col-span-8">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="pb-3">Order</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3">Driver Type</th>
                    <th className="pb-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTrips.map((trip) => {
                    const tripDriverId = getTripDriverId(trip);
                    const isMyTrip = tripDriverId === currentUserId;
                    const canAccept = profileStatus === 'verified' && role === 'logistics' && trip.status === 'pending' && (!tripDriverId || isMyTrip);
                    const canPickupScan = profileStatus === 'verified' && role === 'logistics' && ['pending', 'driver_assigned', 'en_route_to_pickup'].includes(trip.status) && isMyTrip;
                    const canDeliveryScan = profileStatus === 'verified' && role === 'logistics' && ['in_transit', 'out_for_delivery', 'delivered'].includes(trip.status) && isMyTrip;

                    return (
                      <tr key={trip._id} className="border-b last:border-b-0">
                        <td className="py-3 font-mono">{trip.orderNumber || String(trip._id).slice(-8)}</td>
                        <td className="py-3"><StatusPill tone={statusTone(trip.status)}>{String(trip.status || 'pending').replace(/_/g, ' ')}</StatusPill></td>
                        <td className="py-3 capitalize text-gray-600">{trip.driverType || 'owner_operator'}</td>
                        <td className="py-3">
                          {canAccept && (
                            <button onClick={() => handleAccept(trip._id)} className="mr-2 inline-flex h-8 items-center rounded-md bg-[#F97316] px-3 text-xs font-medium text-white">Accept</button>
                          )}
                          {canPickupScan && (
                            <button onClick={() => handlePickupScan(trip._id)} className="inline-flex h-8 items-center gap-1 rounded-md bg-[#16A34A] px-3 text-xs font-medium text-white">
                              <FaQrcode /> Pickup QR
                            </button>
                          )}
                          {canDeliveryScan && (
                            <button onClick={() => handleDeliveryScan(trip._id)} className="ml-2 inline-flex h-8 items-center gap-1 rounded-md bg-[#2563EB] px-3 text-xs font-medium text-white">
                              <FaQrcode /> Delivery QR
                            </button>
                          )}
                          {!canAccept && !canPickupScan && !canDeliveryScan && <span className="text-xs text-[#6B7280]">No action</span>}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredTrips.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-[#6B7280]">No logistics trips found yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Panel title="Route Zones">
            <div className="space-y-4">
              {topRoutes.length ? topRoutes.map(([route, count]) => (
                <ProgressRow key={route} label={route} value={count} max={Math.max(...topRoutes.map((item) => item[1]), 1)} color="#3B82F6" detail={`${count}`} />
              )) : <p className="text-sm text-gray-500">No route zone data yet.</p>}
            </div>
          </Panel>
          <Panel title="Route Map Readiness">
            <div className="rounded-md border border-dashed border-gray-300 p-4 text-sm text-gray-500">
              Map coordinates are not stored on logistics trips yet. This panel is ready for live map rendering once pickup and destination coordinates are added.
            </div>
          </Panel>
          <Panel title="Delivery Ratings">
            <div className="rounded-md border border-dashed border-gray-300 p-4 text-sm text-gray-500">
              Delivery ratings are not returned by the backend yet. Add driver rating fields to show customer and seller delivery feedback here.
            </div>
          </Panel>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Panel title="Operator Profile">
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between"><span className="text-gray-500">Role</span><span className="font-medium capitalize text-[#111827]">{role || 'buyer'}</span></div>
              <div className="flex items-center justify-between"><span className="text-gray-500">Status</span><span className="font-medium capitalize text-[#111827]">{profileStatus}</span></div>
              <div className="flex items-center justify-between"><span className="text-gray-500">Driver mode</span><span className="font-medium capitalize text-[#111827]">{application?.logisticsProfile?.driverMode || '-'}</span></div>
            </div>
          </Panel>
          <Panel title="Pickup Readiness">
            <div className="flex items-start gap-3 text-sm text-gray-600">
              <FaQrcode className="mt-1 text-[#16A34A]" />
              <p>{profileStatus === 'verified' ? 'QR pickup confirmation is available on trips you have accepted.' : 'Approval is required before QR pickup confirmation is enabled.'}</p>
            </div>
          </Panel>
          <Panel title="Next Best Action">
            <div className="flex items-start gap-3 text-sm text-gray-600">
              <FaClock className="mt-1 text-[#F97316]" />
              <p>{profileStatus === 'verified' ? 'Accept available pending trips, then confirm pickup with the seller QR.' : 'Complete verification so dispatch actions become available.'}</p>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
};

export default LogisticsStatus;
