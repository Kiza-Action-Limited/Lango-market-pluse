import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Link, Navigate } from 'react-router-dom';
import { FaBell, FaCheckCircle, FaClipboardCheck, FaClock, FaExclamationTriangle, FaExternalLinkAlt, FaLocationArrow, FaMapMarkedAlt, FaMoneyBillWave, FaQrcode, FaReceipt, FaRoute, FaShieldAlt, FaStopCircle, FaTruck, FaUnlockAlt, FaWallet } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { logisticsService } from '../services/logisticsService';
import { paymentService } from '../services/paymentService';
import { KpiCard, Panel, ProgressRow, StatusPill } from '../components/dashboard/DashboardWidgets';
import { formatRealtimeStamp, useRealtimeRefresh } from '../hooks/useRealtimeRefresh';
import { formatCurrency, formatDateTime } from '../utils/formatters';
import LogisticsEscrowFlow from '../components/logistics/LogisticsEscrowFlow';
import QrHandshakePanel from '../components/logistics/QrHandshakePanel';

const LogisticsStatus = ({ section = 'dashboard' }) => {
  const { user, isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(true);
  const [application, setApplication] = useState(null);
  const [trips, setTrips] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [dashboardRange, setDashboardRange] = useState('30d');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [withdrawForm, setWithdrawForm] = useState({ amount: '', phoneNumber: user?.phone || '' });
  const [withdrawing, setWithdrawing] = useState(false);
  const [gpsSharing, setGpsSharing] = useState(false);
  const [gpsStatus, setGpsStatus] = useState(null);
  const [watchId, setWatchId] = useState(null);
  const [qrScanner, setQrScanner] = useState(null);
  const [qrScanning, setQrScanning] = useState(false);

  const role = String(user?.role || '').toLowerCase();
  const profileStatus = application?.logisticsProfile?.verificationStatus || 'unverified';
  const currentUserId = String(user?._id || user?.id || '');
  const getTripDriverId = (trip) => {
    const driver = trip?.driver;
    if (!driver) return '';
    if (typeof driver === 'object') return String(driver._id || driver.id || '');
    return String(driver);
  };

  const fetchAll = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const [appData, dashboardData] = await Promise.all([
        logisticsService.getMyApplication(),
        logisticsService.getDashboard({ limit: 100 }),
      ]);
      setApplication(dashboardData?.application || appData);
      setDashboard(dashboardData);
      setTrips(dashboardData?.trips || []);
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

  useEffect(() => () => {
    if (watchId !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchId);
    }
  }, [watchId]);

  const handleAccept = async (tripId) => {
    try {
      await logisticsService.acceptTrip(tripId);
      toast.success('Trip accepted. Proceed to pickup scan.');
      fetchAll();
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to accept trip');
    }
  };

  const openQrScanner = (tripId, step) => {
    const trip = trips.find((item) => item._id === tripId || item.id === tripId);
    setQrScanner({ tripId, step, trip });
  };

  const handlePickupScan = (tripId) => openQrScanner(tripId, 'pickup');

  const handleWithdraw = async (event) => {
    event.preventDefault();
    const amount = Number(withdrawForm.amount);
    if (!Number.isFinite(amount) || amount < 50) {
      toast.error('Minimum wallet withdrawal is KES 50.');
      return;
    }
    if (!withdrawForm.phoneNumber) {
      toast.error('Enter the M-Pesa phone number for payout.');
      return;
    }

    setWithdrawing(true);
    try {
      const result = await paymentService.withdrawWalletFunds({
        amount,
        phoneNumber: withdrawForm.phoneNumber,
      });
      toast.success(result?.message || 'Withdrawal queued for M-Pesa payout.');
      setWithdrawForm((prev) => ({ ...prev, amount: '' }));
      fetchAll({ silent: true });
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || 'Withdrawal failed');
    } finally {
      setWithdrawing(false);
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

  const pushDriverGps = async (coords) => {
    const payload = {
      lat: coords.lat,
      lng: coords.lng,
      accuracy: coords.accuracy,
      speed: coords.speed,
      heading: coords.heading,
    };
    await logisticsService.updateDriverLocation(payload);
    setGpsStatus({
      ...payload,
      updatedAt: new Date().toISOString(),
    });
  };

  const shareCurrentGpsOnce = async () => {
    try {
      const gpsCoords = await getCurrentGps();
      await pushDriverGps(gpsCoords);
      toast.success('Live GPS location saved');
      fetchAll({ silent: true });
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || 'Unable to update GPS location');
    }
  };

  const startLiveGps = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by this browser');
      return;
    }

    if (watchId !== null) navigator.geolocation.clearWatch(watchId);

    const nextWatchId = navigator.geolocation.watchPosition(
      async (position) => {
        try {
          await pushDriverGps({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            speed: position.coords.speed,
            heading: position.coords.heading,
          });
        } catch (error) {
          console.error('Live GPS update failed:', error);
        }
      },
      (error) => {
        toast.error(error.message || 'Live GPS tracking stopped');
        setGpsSharing(false);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );

    setWatchId(nextWatchId);
    setGpsSharing(true);
    toast.success('Live GPS tracking started');
  };

  const stopLiveGps = () => {
    if (watchId !== null && navigator.geolocation) navigator.geolocation.clearWatch(watchId);
    setWatchId(null);
    setGpsSharing(false);
    toast.success('Live GPS tracking stopped');
  };

  const handleDeliveryScan = (tripId) => openQrScanner(tripId, 'delivery');

  const submitQrScanner = async ({ step, token, gpsCoords }) => {
    if (!qrScanner?.tripId) throw new Error('Select a trip before scanning.');
    setQrScanning(true);
    try {
      const result = step === 'pickup'
        ? await logisticsService.scanPickup(qrScanner.tripId, { token, gpsCoords })
        : await logisticsService.scanDelivery(qrScanner.tripId, { token, gpsCoords });
      toast.success(`${step === 'pickup' ? 'Pickup' : 'Delivery'} QR verified`);
      setQrScanner(null);
      await fetchAll({ silent: true });
      return result;
    } finally {
      setQrScanning(false);
    }
  };

  const renderQrScannerModal = () => qrScanner ? (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 px-4 py-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-3 flex justify-end">
          <button
            type="button"
            onClick={() => setQrScanner(null)}
            className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-[#111827] shadow-sm hover:bg-gray-100"
          >
            Close scanner
          </button>
        </div>
        <QrHandshakePanel
          title={qrScanner.step === 'pickup' ? 'Driver pickup QR scanner' : 'Final delivery QR scanner'}
          subtitle={qrScanner.step === 'pickup'
            ? 'Scan the seller handoff QR at pickup. This moves escrow to in transit.'
            : 'Scan the receiver delivery QR with GPS at the drop-off location.'}
          defaultStep={qrScanner.step}
          allowedSteps={[qrScanner.step]}
          logistics={qrScanner.trip}
          scanning={qrScanning}
          onScan={submitQrScanner}
        />
      </div>
    </div>
  ) : null;

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
  const statusTone = (status) => {
    if (status === 'delivered') return 'green';
    if (['in_transit', 'picked_up', 'out_for_delivery'].includes(status)) return 'blue';
    if (status === 'pending') return 'amber';
    if (['failed', 'disputed', 'rejected'].includes(status)) return 'red';
    return 'gray';
  };
  const isAssignmentsSection = section === 'assignments';
  const isStatusSection = section === 'status';
  const assignedSeries = assignedTrips.length ? assignedTrips.map((_, index) => index + 1) : [trips.length];
  const activeRouteSeries = filteredTrips.map((trip) => (['in_transit', 'picked_up', 'out_for_delivery'].includes(trip.status) ? 1 : 0));
  const deliveredSeries = filteredTrips.map((trip) => (trip.status === 'delivered' ? 1 : 0));
  const escrowSeries = filteredTrips.map((trip) => (trip?.escrow?.status === 'released' ? 1 : 0));
  const summary = dashboard?.summary || {};
  const walletBalance = dashboard?.wallet?.balance || {};
  const walletTransactions = dashboard?.wallet?.transactions || [];
  const availableWalletBalance = Number(walletBalance.availableBalance || 0);
  const totalWalletBalance = Number(walletBalance.totalBalance || walletBalance.balance || 0);
  const lockedWalletBalance = Number(walletBalance.lockedBalance || 0);
  const pendingWithdrawals = walletTransactions.filter((transaction) => (
    transaction.type === 'withdrawal' && transaction.status === 'pending'
  ));
  const pendingWithdrawalAmount = pendingWithdrawals.reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
  const sinkingFund = dashboard?.wallet?.sinkingFund || {};
  const qrQueue = dashboard?.qrQueue || [];
  const releaseQueue = dashboard?.releaseQueue || [];
  const payoutRows = dashboard?.payoutRows || [];
  const assignmentAlerts = dashboard?.assignmentAlerts || [];
  const routeZones = dashboard?.routeZones || [];
  const proofQueue = dashboard?.proofQueue || [];
  const operationalTimeline = dashboard?.operationalTimeline || [];
  const nextActions = dashboard?.nextActions || [];
  const totalDriverEarnings = Number(summary.pendingPayout || 0) + Number(summary.releasedPayout || 0);
  const firstOperationalTrip = assignedTrips[0] || filteredTrips[0];
  const liveMapTrip = assignedTrips.find((trip) => ['driver_assigned', 'en_route_to_pickup', 'picked_up', 'in_transit', 'out_for_delivery'].includes(trip.status)) || firstOperationalTrip;
  const displayedPickupHours = summary.avgPickupHours ?? avgPickupHours;
  const displayedDeliveryHours = summary.avgDeliveryHours ?? avgDeliveryHours;
  const mapCoords = liveMapTrip?.route?.driverCoords || liveMapTrip?.route?.pickupCoords || liveMapTrip?.route?.deliveryCoords;
  const mapEmbedUrl = mapCoords
    ? `https://maps.google.com/maps?q=${mapCoords.lat},${mapCoords.lng}&z=13&output=embed`
    : null;
  const renderSellerAssignmentRequests = (limit = assignmentAlerts.length) => (
    <div className="space-y-3">
      {assignmentAlerts.length ? assignmentAlerts.slice(0, limit).map((alert, index) => (
        <div key={alert.logisticsId || alert._id || index} className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[#111827]">{alert.seller?.businessName || alert.seller?.name || 'Seller request'}</p>
              <p className="mt-1 text-xs text-gray-500">{alert.cargoType || 'Shipment'} {alert.weight ? `- ${alert.weight}${alert.weightUnit || 'kg'}` : ''}</p>
            </div>
            <StatusPill tone="amber">new assignment</StatusPill>
          </div>
          <div className="mt-3 grid gap-3 text-xs text-gray-500 sm:grid-cols-2">
            <span><strong className="text-[#111827]">Pickup:</strong> {alert.route?.pickup || alert.pickupAddress?.town || 'Pickup pending'}</span>
            <span><strong className="text-[#111827]">Delivery:</strong> {alert.route?.delivery || alert.shippingAddress?.town || 'Delivery pending'}</span>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm font-semibold text-[#111827]">{formatCurrency(alert.shippingCost || alert.deliveryFee || 0)}</span>
            <button
              type="button"
              onClick={() => handleAccept(alert.logisticsId || alert._id)}
              disabled={profileStatus !== 'verified' || !(alert.logisticsId || alert._id)}
              className="inline-flex h-9 items-center rounded-md bg-[#F97316] px-4 text-xs font-medium text-white hover:bg-[#EA580C] disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              Accept Assignment
            </button>
          </div>
        </div>
      )) : (
        <p className="rounded-md border border-gray-200 bg-white p-5 text-sm text-gray-500 shadow-sm">No seller assignment requests waiting right now.</p>
      )}
    </div>
  );

  if (isStatusSection) {
    return (
      <div className="min-h-screen bg-[#F7F8FA] px-4 py-6 sm:px-6">
        {renderQrScannerModal()}
        <div className="mx-auto max-w-[1400px]">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#F97316]">Logistics workspace</p>
              <h1 className="mt-1 text-2xl font-bold text-[#111827]">Status Center</h1>
              <p className="mt-1 text-sm text-gray-500">Monitor account readiness, live trip states, QR handoffs, and delivery proof.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex h-10 items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 text-xs font-medium text-green-700">
                <span className={`h-2 w-2 rounded-full bg-green-500 ${isRealtimeRefreshing ? 'animate-pulse' : ''}`} />
                Live - {formatRealtimeStamp(lastUpdated)}
              </div>
              <StatusPill tone={profileStatus === 'verified' ? 'green' : profileStatus === 'pending' ? 'amber' : 'gray'}>
                {profileStatus}
              </StatusPill>
              {profileStatus !== 'verified' && (
                <Link to="/logistics/apply" className="inline-flex h-10 items-center rounded-md bg-[#F97316] px-4 text-sm font-medium text-white hover:bg-[#EA580C]">
                  Complete Verification
                </Link>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard icon={FaShieldAlt} label="Account Status" value={profileStatus} detail={application?.logisticsProfile?.driverMode || 'owner operator'} color={profileStatus === 'verified' ? '#16A34A' : '#F97316'} points={[profileStatus === 'verified' ? 100 : 40]} />
            <KpiCard icon={FaTruck} label="Active Trips" value={summary.activeTrips || inTransitTrips} detail={`${pendingTrips} pending`} color="#3B82F6" points={activeRouteSeries} />
            <KpiCard icon={FaQrcode} label="QR Queue" value={qrQueue.length} detail="handoffs waiting" color="#F59E0B" points={qrQueue.map((_, index) => index + 1)} />
            <KpiCard icon={FaCheckCircle} label="Proof Verified" value={`${summary.proofOfDeliveryRate || 0}%`} detail={`${summary.gpsVerificationRate || 0}% GPS`} color="#16A34A" points={[summary.proofOfDeliveryCount || 0, deliveredTrips]} />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
            <Panel title="Readiness Status" className="xl:col-span-4">
              <div className="space-y-4">
                <ProgressRow label="Verification" value={profileStatus === 'verified' ? 100 : profileStatus === 'pending' ? 60 : 20} max={100} color="#F97316" detail={profileStatus} />
                <ProgressRow label="Proof coverage" value={summary.proofOfDeliveryRate || 0} max={100} color="#16A34A" detail={`${summary.proofOfDeliveryRate || 0}%`} />
                <ProgressRow label="GPS validation" value={summary.gpsVerificationRate || 0} max={100} color="#3B82F6" detail={`${summary.gpsVerificationRate || 0}%`} />
                <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-gray-500">Driver mode</span>
                    <span className="font-semibold capitalize text-[#111827]">{application?.logisticsProfile?.driverMode || 'owner operator'}</span>
                  </div>
                </div>
              </div>
            </Panel>

            <Panel title="Dispatch State" className="xl:col-span-4">
              <div className="space-y-4">
                <ProgressRow label="Available jobs" value={summary.availableTrips || pendingTrips} max={Math.max(filteredTrips.length, 1)} color="#F59E0B" detail={`${summary.availableTrips || pendingTrips}`} />
                <ProgressRow label="Pickup pending" value={summary.pickupPending || 0} max={Math.max(filteredTrips.length, 1)} color="#F97316" detail={`${summary.pickupPending || 0}`} />
                <ProgressRow label="Delivery pending" value={summary.deliveryPending || inTransitTrips} max={Math.max(filteredTrips.length, 1)} color="#3B82F6" detail={`${summary.deliveryPending || inTransitTrips}`} />
                <ProgressRow label="Release queue" value={releaseQueue.length || summary.releasePending || 0} max={Math.max(filteredTrips.length, 1)} color="#8B5CF6" detail={`${releaseQueue.length || summary.releasePending || 0}`} />
              </div>
            </Panel>

            <Panel title="Next Status Actions" className="xl:col-span-4">
              <div className="space-y-3">
                {nextActions.length ? nextActions.slice(0, 4).map((action) => (
                  <div key={`${action.type}-${action.label}`} className="rounded-md border border-gray-200 bg-gray-50 p-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-[#111827]">
                      <FaExclamationTriangle className="text-[#F97316]" />
                      {action.label}
                    </div>
                    <p className="mt-1 text-xs text-gray-500">{action.detail}</p>
                  </div>
                )) : (
                  <div className="rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-800">
                    All status checks are clear. New pickup, delivery, and proof actions will appear here.
                  </div>
                )}
              </div>
            </Panel>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
            <Panel title="QR Handoff Status" className="xl:col-span-6">
              <div className="space-y-3">
                {qrQueue.length ? qrQueue.slice(0, 5).map((trip) => (
                  <div key={trip._id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-gray-200 p-3">
                    <div className="min-w-0">
                      <p className="font-mono text-sm font-semibold text-[#111827]">{trip.orderNumber || String(trip._id).slice(-8)}</p>
                      <p className="mt-1 truncate text-xs text-gray-500">{trip.route?.pickup || 'Pickup'} to {trip.route?.delivery || 'Delivery'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusPill tone={trip.qr?.nextStep === 'pickup' ? 'amber' : 'blue'}>{trip.qr?.nextStep || 'qr'} scan</StatusPill>
                      {trip.qr?.nextStep === 'pickup' ? (
                        <button onClick={() => handlePickupScan(trip._id)} className="inline-flex h-8 items-center gap-1 rounded-md bg-[#16A34A] px-3 text-xs font-medium text-white"><FaQrcode /> Pickup</button>
                      ) : (
                        <button onClick={() => handleDeliveryScan(trip._id)} className="inline-flex h-8 items-center gap-1 rounded-md bg-[#2563EB] px-3 text-xs font-medium text-white"><FaQrcode /> Delivery</button>
                      )}
                    </div>
                  </div>
                )) : <p className="py-8 text-center text-sm text-gray-500">No QR handoffs waiting right now.</p>}
              </div>
            </Panel>

            <Panel title="Recent Movement" className="xl:col-span-6">
              <div className="space-y-3">
                {operationalTimeline.length ? operationalTimeline.slice(0, 5).map((event, index) => (
                  <div key={`${event.logisticsId}-${event.timestamp}-${index}`} className="rounded-md border border-gray-200 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-mono text-xs font-semibold text-[#111827]">{event.orderNumber || String(event.logisticsId).slice(-8)}</p>
                      <StatusPill tone={statusTone(event.status)}>{String(event.status || 'updated').replace(/_/g, ' ')}</StatusPill>
                    </div>
                    <p className="mt-2 text-xs text-gray-500">{event.location || event.notes || event.cargoType || 'Trip updated'}</p>
                    <p className="mt-1 text-xs text-gray-400">{formatDateTime(event.timestamp)}</p>
                  </div>
                )) : <p className="py-8 text-center text-sm text-gray-500">Trip movement updates will appear after dispatch starts.</p>}
              </div>
            </Panel>
          </div>

          <LogisticsEscrowFlow trip={firstOperationalTrip} className="mt-4" />

          <Panel title="Trip Status Board" className="mt-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="pb-3">Order</th>
                    <th className="pb-3">Current status</th>
                    <th className="pb-3">Route</th>
                    <th className="pb-3">Proof</th>
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
                        <td className="max-w-72 py-3 text-xs text-gray-600">
                          <span className="block truncate">{trip.route?.pickup || trip.pickupAddress?.town || 'Pickup'}</span>
                          <span className="block truncate text-gray-400">{trip.route?.delivery || trip.shippingAddress?.town || 'Delivery'}</span>
                        </td>
                        <td className="py-3 text-xs text-gray-600">
                          {trip.proofOfDelivery?.gpsVerified ? 'GPS verified' : trip.proofOfDelivery ? 'Proof received' : 'Awaiting proof'}
                        </td>
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
                          {trip.route?.liveGoogleMapsUrl && (
                            <a
                              href={trip.route.liveGoogleMapsUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="ml-2 inline-flex h-8 items-center gap-1 rounded-md border border-gray-300 bg-white px-3 text-xs font-medium text-[#111827]"
                            >
                              <FaMapMarkedAlt /> Map
                            </a>
                          )}
                          {!canAccept && !canPickupScan && !canDeliveryScan && !trip.route?.liveGoogleMapsUrl && <span className="text-xs text-[#6B7280]">No action</span>}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredTrips.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-[#6B7280]">No logistics trips found yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      </div>
    );
  }

  if (isAssignmentsSection) {
    return (
      <div className="min-h-screen bg-[#F7F8FA] px-4 py-6 sm:px-6">
        {renderQrScannerModal()}
        <div className="mx-auto max-w-[1300px]">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#F97316]">Logistics workspace</p>
              <h1 className="mt-1 text-2xl font-bold text-[#111827]">Seller Assignments</h1>
              <p className="mt-1 text-sm text-gray-500">Review seller delivery requests, accept verified jobs, and move assignments into dispatch.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex h-10 items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 text-xs font-medium text-green-700">
                <span className={`h-2 w-2 rounded-full bg-green-500 ${isRealtimeRefreshing ? 'animate-pulse' : ''}`} />
                Live - {formatRealtimeStamp(lastUpdated)}
              </div>
              <StatusPill tone={profileStatus === 'verified' ? 'green' : profileStatus === 'pending' ? 'amber' : 'gray'}>
                {profileStatus}
              </StatusPill>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard icon={FaBell} label="Open Requests" value={assignmentAlerts.length} detail="seller assignments" color="#F97316" points={assignmentAlerts.map((_, index) => index + 1)} />
            <KpiCard icon={FaClipboardCheck} label="Available Jobs" value={summary.availableTrips || pendingTrips} detail="ready for dispatch" color="#F59E0B" points={filteredTrips.map((trip) => (trip.status === 'pending' ? 1 : 0))} />
            <KpiCard icon={FaRoute} label="Active Routes" value={inTransitTrips} detail="in transit or pickup" color="#3B82F6" points={activeRouteSeries} />
            <KpiCard icon={FaMoneyBillWave} label="Pending Payout" value={formatCurrency(summary.pendingPayout || 0)} detail="awaiting release" color="#16A34A" points={filteredTrips.map((trip) => Number(trip?.payout?.expectedAmount || trip?.escrow?.driverPayout || 0))} />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
            <Panel title="Seller Assignment Board" className="xl:col-span-8">
              {renderSellerAssignmentRequests()}
            </Panel>
            <Panel title="Assignment Readiness" className="xl:col-span-4">
              <div className="space-y-4">
                <ProgressRow label="Verification" value={profileStatus === 'verified' ? 100 : profileStatus === 'pending' ? 50 : 10} max={100} color="#F97316" detail={profileStatus} />
                <ProgressRow label="Pickup pending" value={summary.pickupPending || 0} max={Math.max(filteredTrips.length, 1)} color="#F59E0B" detail={`${summary.pickupPending || 0}`} />
                <ProgressRow label="Delivery pending" value={summary.deliveryPending || inTransitTrips} max={Math.max(filteredTrips.length, 1)} color="#3B82F6" detail={`${summary.deliveryPending || inTransitTrips}`} />
                <div className="rounded-md border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
                  Verified logistics accounts can accept new seller assignments directly from this board.
                </div>
              </div>
            </Panel>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F8FA] px-4 py-6 sm:px-6">
      {renderQrScannerModal()}
      <div className="mx-auto max-w-[1500px]">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#F97316]">Logistics workspace</p>
            <h1 className="mt-1 text-2xl font-bold text-[#111827]">Delivery Operations Dashboard</h1>
            <p className="mt-1 text-sm text-gray-500">Track verification, assigned trips, pickup scans, route status, and escrow release.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
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
                Complete Verification
              </Link>
            )}
          </div>
        </div>

        <main className="min-w-0">

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard icon={FaClipboardCheck} label="Assigned Trips" value={assignedTrips.length || filteredTrips.length} detail={`${pendingTrips} pending`} color="#F97316" points={assignedSeries} />
          <KpiCard icon={FaRoute} label="Active Routes" value={inTransitTrips} detail="in transit or pickup" color="#3B82F6" points={activeRouteSeries} />
          <KpiCard icon={FaCheckCircle} label="Delivered" value={deliveredTrips} detail={`${completionRate}% completion`} color="#16A34A" points={deliveredSeries} />
          <KpiCard icon={FaMoneyBillWave} label="Escrow Released" value={escrowReleased} detail="completed payouts" color="#8B5CF6" points={escrowSeries} />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard icon={FaClock} label="Avg Pickup Time" value={displayedPickupHours === null ? '-' : `${Number(displayedPickupHours).toFixed(1)}h`} detail="created to pickup scan" color="#F59E0B" points={filteredTrips.map((trip) => (trip.qr?.pickupAt || trip.pickedUpAt || trip.pickupScannedAt ? 1 : 0))} />
          <KpiCard icon={FaRoute} label="Avg Delivery Time" value={displayedDeliveryHours === null ? '-' : `${Number(displayedDeliveryHours).toFixed(1)}h`} detail={`${Number(summary.totalDistanceKm || 0).toLocaleString()} km tracked`} color="#3B82F6" points={filteredTrips.map((trip) => Number(trip?.route?.distanceKm || 0))} />
          <KpiCard icon={FaShieldAlt} label="Proof Verified" value={`${summary.proofOfDeliveryRate || 0}%`} detail={`${summary.gpsVerificationRate || 0}% GPS verified`} color="#DC2626" points={[summary.proofOfDeliveryCount || 0, deliveredTrips]} />
          <KpiCard icon={FaMoneyBillWave} label="Driver Earnings" value={formatCurrency(totalDriverEarnings || escrowAmount)} detail={`${formatCurrency(summary.pendingPayout || 0)} pending`} color="#16A34A" points={filteredTrips.map((trip) => Number(trip?.payout?.expectedAmount || trip?.escrow?.driverPayout || trip.deliveryFee || trip.fee || 0))} />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <Panel title="Live GPS Google Map">
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
              {mapEmbedUrl ? (
                <iframe
                  title="Live logistics GPS map"
                  src={mapEmbedUrl}
                  className="h-72 w-full border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              ) : (
                <div className="flex h-72 items-center justify-center text-sm text-gray-500">
                  No GPS coordinate yet. Share current location to start live tracking.
                </div>
              )}
            </div>
          </Panel>

          <Panel title="Real-Time Tracking Controls">
            <div className="space-y-4">
              <div className="rounded-md border border-gray-200 bg-gray-50 p-4">
                <p className="text-xs font-semibold uppercase text-gray-500">Selected trip</p>
                <p className="mt-1 font-mono text-sm font-semibold text-[#111827]">
                  {liveMapTrip?.orderNumber || (liveMapTrip?._id ? String(liveMapTrip._id).slice(-8).toUpperCase() : 'No active trip')}
                </p>
                <p className="mt-1 text-sm text-gray-600">
                  {liveMapTrip?.route?.pickup || 'Pickup'} to {liveMapTrip?.route?.delivery || 'Delivery'}
                </p>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={shareCurrentGpsOnce}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#F97316] px-4 text-sm font-semibold text-white hover:bg-[#EA580C]"
                >
                  <FaLocationArrow /> Share GPS Now
                </button>
                <button
                  type="button"
                  onClick={gpsSharing ? stopLiveGps : startLiveGps}
                  className={`inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold text-white ${
                    gpsSharing ? 'bg-[#DC2626] hover:bg-[#B91C1C]' : 'bg-[#111827] hover:bg-[#374151]'
                  }`}
                >
                  {gpsSharing ? <FaStopCircle /> : <FaLocationArrow />}
                  {gpsSharing ? 'Stop Live GPS' : 'Start Live GPS'}
                </button>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                {liveMapTrip?.route?.liveGoogleMapsUrl && (
                  <a
                    href={liveMapTrip.route.liveGoogleMapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-4 text-sm font-semibold text-[#111827] hover:bg-gray-50"
                  >
                    <FaExternalLinkAlt /> Open Google Maps
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => fetchAll({ silent: true })}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-4 text-sm font-semibold text-[#111827] hover:bg-gray-50"
                >
                  Refresh Trips
                </button>
              </div>

              <div className="rounded-md border border-gray-200 bg-white p-4 text-sm text-gray-600">
                <p className="font-semibold text-[#111827]">Last GPS update</p>
                <p className="mt-1">
                  {gpsStatus?.updatedAt
                    ? `${Number(gpsStatus.lat).toFixed(5)}, ${Number(gpsStatus.lng).toFixed(5)} at ${formatDateTime(gpsStatus.updatedAt)}`
                    : liveMapTrip?.route?.driverCoords
                      ? `${Number(liveMapTrip.route.driverCoords.lat).toFixed(5)}, ${Number(liveMapTrip.route.driverCoords.lng).toFixed(5)}`
                      : 'No driver GPS shared yet.'}
                </p>
              </div>
            </div>
          </Panel>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
          <Panel title="M-Pesa Wallet Withdrawal" className="xl:col-span-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-md border border-green-200 bg-green-50 p-3">
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-green-700"><FaWallet /> Available</div>
                <p className="text-xl font-bold text-green-950">{formatCurrency(availableWalletBalance)}</p>
              </div>
              <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-gray-500"><FaUnlockAlt /> Locked</div>
                <p className="text-xl font-bold text-[#111827]">{formatCurrency(lockedWalletBalance)}</p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-md border border-gray-200 bg-white p-3">
                <p className="font-semibold uppercase text-gray-500">Total wallet</p>
                <p className="mt-1 text-sm font-bold text-[#111827]">{formatCurrency(totalWalletBalance)}</p>
              </div>
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
                <p className="font-semibold uppercase text-amber-700">Pending M-Pesa</p>
                <p className="mt-1 text-sm font-bold text-amber-950">{formatCurrency(pendingWithdrawalAmount)}</p>
              </div>
            </div>
            <form onSubmit={handleWithdraw} className="mt-4 space-y-3">
              <input
                type="number"
                min="50"
                max={availableWalletBalance || undefined}
                value={withdrawForm.amount}
                onChange={(event) => setWithdrawForm((prev) => ({ ...prev, amount: event.target.value }))}
                placeholder="Amount in KES"
                className="h-10 w-full rounded-md border border-gray-200 px-3 text-sm focus:border-[#F97316] focus:outline-none"
              />
              <input
                type="tel"
                value={withdrawForm.phoneNumber}
                onChange={(event) => setWithdrawForm((prev) => ({ ...prev, phoneNumber: event.target.value }))}
                placeholder="M-Pesa phone number"
                className="h-10 w-full rounded-md border border-gray-200 px-3 text-sm focus:border-[#F97316] focus:outline-none"
              />
              <button
                type="submit"
                disabled={withdrawing || availableWalletBalance < 50 || profileStatus !== 'verified'}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[#111827] px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                <FaMoneyBillWave /> {withdrawing ? 'Queuing payout...' : 'Withdraw to M-Pesa'}
              </button>
              <p className="text-xs text-gray-500">
                Minimum KES 50. M-Pesa B2C sends automatically when configured; otherwise the request stays queued for operations.
              </p>
            </form>
          </Panel>

          <Panel title="Logistics Payout Control" className="xl:col-span-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-md border border-green-200 bg-green-50 p-3">
                <p className="text-xs font-semibold uppercase text-green-700">Released</p>
                <p className="mt-1 text-xl font-bold text-green-900">{formatCurrency(summary.releasedPayout || 0)}</p>
              </div>
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs font-semibold uppercase text-amber-700">Pending</p>
                <p className="mt-1 text-xl font-bold text-amber-900">{formatCurrency(summary.pendingPayout || 0)}</p>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              <ProgressRow label="Escrow value" value={summary.totalEscrow || 0} max={Math.max(summary.totalEscrow || 0, 1)} color="#3B82F6" detail={formatCurrency(summary.totalEscrow || 0)} />
              <ProgressRow label="Sinking fund" value={sinkingFund.balance || summary.sinkingFundAccrued || 0} max={Math.max(summary.totalEscrow || 1, 1)} color="#16A34A" detail={formatCurrency(sinkingFund.balance || summary.sinkingFundAccrued || 0)} />
            </div>
          </Panel>

          <Panel title="Next Actions" className="xl:col-span-4">
            <div className="space-y-3">
              {nextActions.length ? nextActions.slice(0, 4).map((action) => (
                <div key={`${action.type}-${action.label}`} className="rounded-md border border-gray-200 bg-gray-50 p-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-[#111827]">
                    <FaExclamationTriangle className="text-[#F97316]" />
                    {action.label}
                  </div>
                  <p className="mt-1 text-xs text-gray-500">{action.detail}</p>
                </div>
              )) : (
                <div className="rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-800">
                  Operations are clear. New trips and payout actions will appear here.
                </div>
              )}
            </div>
          </Panel>
        </div>

        <LogisticsEscrowFlow trip={firstOperationalTrip} className="mt-4" />

        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
          <Panel title="QR Handoff Queue" className="xl:col-span-6">
            <div className="space-y-3">
              {qrQueue.length ? qrQueue.slice(0, 5).map((trip) => (
                <div key={trip._id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-gray-200 p-3">
                  <div>
                    <p className="font-mono text-sm font-semibold text-[#111827]">{trip.orderNumber || String(trip._id).slice(-8)}</p>
                    <p className="mt-1 text-xs text-gray-500">{trip.route?.pickup || 'Pickup'} to {trip.route?.delivery || 'Delivery'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusPill tone={trip.qr?.nextStep === 'pickup' ? 'amber' : 'blue'}>{trip.qr?.nextStep} scan</StatusPill>
                    {trip.qr?.nextStep === 'pickup' ? (
                      <button onClick={() => handlePickupScan(trip._id)} className="inline-flex h-8 items-center gap-1 rounded-md bg-[#16A34A] px-3 text-xs font-medium text-white"><FaQrcode /> Pickup</button>
                    ) : (
                      <button onClick={() => handleDeliveryScan(trip._id)} className="inline-flex h-8 items-center gap-1 rounded-md bg-[#2563EB] px-3 text-xs font-medium text-white"><FaQrcode /> Delivery</button>
                    )}
                  </div>
                </div>
              )) : <p className="py-8 text-center text-sm text-gray-500">No QR scans waiting right now.</p>}
            </div>
          </Panel>

          <Panel title="Escrow Release Queue" className="xl:col-span-6">
            <div className="space-y-3">
              {releaseQueue.length ? releaseQueue.slice(0, 5).map((trip) => (
                <div key={trip._id} className="rounded-md border border-gray-200 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-mono text-sm font-semibold text-[#111827]">{trip.orderNumber || String(trip._id).slice(-8)}</p>
                      <p className="mt-1 text-xs text-gray-500">{trip.cargoType || 'Cargo'} delivered. Payout waits for release window.</p>
                    </div>
                    <StatusPill tone={trip.escrow?.status === 'DISPUTED' ? 'red' : 'purple'}>{trip.escrow?.status || 'escrow'}</StatusPill>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                    <span className="text-gray-500">Driver payout: <strong className="text-[#111827]">{formatCurrency(trip.escrow?.driverPayout || trip.payout?.expectedAmount || 0)}</strong></span>
                    <span className="text-gray-500">Release: <strong className="text-[#111827]">{formatDateTime(trip.escrowReleaseDue || trip.escrow?.autoReleaseAt)}</strong></span>
                  </div>
                </div>
              )) : <p className="py-8 text-center text-sm text-gray-500">No delivered trips waiting for escrow release.</p>}
            </div>
          </Panel>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
          <Panel title="Dispatch Control" className="xl:col-span-4">
            <div className="space-y-4">
              <ProgressRow label="Available jobs" value={summary.availableTrips || pendingTrips} max={Math.max(filteredTrips.length, 1)} color="#F59E0B" detail={`${summary.availableTrips || pendingTrips}`} />
              <ProgressRow label="Pickup pending" value={summary.pickupPending || 0} max={Math.max(filteredTrips.length, 1)} color="#F97316" detail={`${summary.pickupPending || 0}`} />
              <ProgressRow label="Delivery pending" value={summary.deliveryPending || inTransitTrips} max={Math.max(filteredTrips.length, 1)} color="#3B82F6" detail={`${summary.deliveryPending || inTransitTrips}`} />
              <ProgressRow label="Escrow release pending" value={summary.releasePending || 0} max={Math.max(filteredTrips.length, 1)} color="#8B5CF6" detail={`${summary.releasePending || 0}`} />
            </div>
          </Panel>

          <Panel title="Compliance & Proof" className="xl:col-span-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
                <p className="text-xs font-semibold uppercase text-gray-500">Proof rate</p>
                <p className="mt-1 text-2xl font-bold text-[#111827]">{summary.proofOfDeliveryRate || 0}%</p>
              </div>
              <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
                <p className="text-xs font-semibold uppercase text-gray-500">GPS verified</p>
                <p className="mt-1 text-2xl font-bold text-[#111827]">{summary.gpsVerificationRate || 0}%</p>
              </div>
            </div>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between"><span className="text-gray-500">Operator status</span><StatusPill tone={profileStatus === 'verified' ? 'green' : profileStatus === 'pending' ? 'amber' : 'gray'}>{profileStatus}</StatusPill></div>
              <div className="flex items-center justify-between"><span className="text-gray-500">Driver mode</span><span className="font-medium capitalize text-[#111827]">{application?.logisticsProfile?.driverMode || 'owner operator'}</span></div>
              <div className="flex items-center justify-between"><span className="text-gray-500">Disputes</span><span className="font-medium text-[#111827]">{summary.disputedTrips || 0}</span></div>
            </div>
          </Panel>

          <Panel title="Recent Movement Timeline" className="xl:col-span-4">
            <div className="space-y-3">
              {operationalTimeline.length ? operationalTimeline.slice(0, 5).map((event, index) => (
                <div key={`${event.logisticsId}-${event.timestamp}-${index}`} className="rounded-md border border-gray-200 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-mono text-xs font-semibold text-[#111827]">{event.orderNumber || String(event.logisticsId).slice(-8)}</p>
                    <StatusPill tone={statusTone(event.status)}>{String(event.status || '').replace(/_/g, ' ')}</StatusPill>
                  </div>
                  <p className="mt-2 text-xs text-gray-500">{event.location || event.notes || event.cargoType || 'Trip updated'}</p>
                  <p className="mt-1 text-xs text-gray-400">{formatDateTime(event.timestamp)}</p>
                </div>
              )) : <p className="py-8 text-center text-sm text-gray-500">Trip movement updates will appear after dispatch starts.</p>}
            </div>
          </Panel>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-12">
          <Panel title="Proof of Delivery" className="xl:col-span-4">
            <div className="space-y-3">
              {proofQueue.length ? proofQueue.slice(0, 5).map((item) => (
                <div key={item.logisticsId} className="rounded-md border border-gray-200 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-mono text-sm font-semibold text-[#111827]">{item.orderNumber || String(item.logisticsId).slice(-8)}</p>
                    <StatusPill tone={item.proofOfDelivery?.gpsVerified ? 'green' : 'amber'}>
                      {item.proofOfDelivery?.gpsVerified ? 'GPS proof' : 'QR proof'}
                    </StatusPill>
                  </div>
                  <p className="mt-2 text-xs text-gray-500">{item.cargoType || 'Shipment'} delivered {formatDateTime(item.deliveredAt)}</p>
                  <p className="mt-1 text-xs text-gray-400">Escrow: {String(item.escrowStatus || 'awaiting').replace(/_/g, ' ')}</p>
                </div>
              )) : <p className="py-8 text-center text-sm text-gray-500">Completed delivery proof will appear here.</p>}
            </div>
          </Panel>

          <Panel title="Trip Board" className="xl:col-span-8">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="pb-3">Order</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3">Route</th>
                    <th className="pb-3">Payout</th>
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
                        <td className="max-w-56 py-3 text-xs text-gray-600">
                          <span className="block truncate">{trip.route?.pickup || trip.pickupAddress?.town || 'Pickup'}</span>
                          <span className="block truncate text-gray-400">{trip.route?.delivery || trip.shippingAddress?.town || 'Delivery'}</span>
                        </td>
                        <td className="py-3 text-xs font-semibold text-[#111827]">{formatCurrency(trip.payout?.expectedAmount || trip.escrow?.driverPayout || trip.shippingCost || 0)}</td>
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
                          {trip.route?.liveGoogleMapsUrl && (
                            <a
                              href={trip.route.liveGoogleMapsUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="ml-2 inline-flex h-8 items-center gap-1 rounded-md border border-gray-300 bg-white px-3 text-xs font-medium text-[#111827]"
                            >
                              <FaMapMarkedAlt /> Map
                            </a>
                          )}
                          {!canAccept && !canPickupScan && !canDeliveryScan && !trip.route?.liveGoogleMapsUrl && <span className="text-xs text-[#6B7280]">No action</span>}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredTrips.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-[#6B7280]">No logistics trips found yet.</td>
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
              {routeZones.length ? routeZones.map((zone) => (
                <ProgressRow key={zone.label} label={zone.label} value={zone.count} max={Math.max(...routeZones.map((item) => item.count), 1)} color="#3B82F6" detail={`${zone.active} active / ${zone.delivered} delivered`} />
              )) : topRoutes.length ? topRoutes.map(([route, count]) => (
                <ProgressRow key={route} label={route} value={count} max={Math.max(...topRoutes.map((item) => item[1]), 1)} color="#3B82F6" detail={`${count}`} />
              )) : <p className="text-sm text-gray-500">No route zone data yet.</p>}
            </div>
          </Panel>
          <Panel title="Payout Ledger">
            <div className="space-y-3">
              {payoutRows.length ? payoutRows.slice(0, 5).map((row) => (
                <div key={row.logisticsId} className="rounded-md border border-gray-200 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-mono text-sm font-semibold text-[#111827]">{row.orderNumber || String(row.logisticsId).slice(-8)}</p>
                    <StatusPill tone={row.status === 'completed' ? 'green' : row.status === 'frozen' ? 'red' : 'amber'}>{row.status}</StatusPill>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3 text-xs text-gray-500">
                    <span>{row.cargoType || 'Shipment'}</span>
                    <span className="font-semibold text-[#111827]">{formatCurrency(row.expectedAmount || 0)}</span>
                  </div>
                </div>
              )) : <p className="py-6 text-center text-sm text-gray-500">No logistics payout rows yet.</p>}
            </div>
          </Panel>
          <Panel title="Wallet Activity">
            <div className="space-y-3">
              {walletTransactions.length ? walletTransactions.slice(0, 5).map((transaction) => (
                <div key={transaction._id} className="flex items-center justify-between gap-3 rounded-md border border-gray-200 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold capitalize text-[#111827]">{String(transaction.type || 'transaction').replace(/_/g, ' ')}</p>
                    <p className="mt-1 text-xs text-gray-500">{formatDateTime(transaction.createdAt)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-[#111827]">{formatCurrency(transaction.amount || 0)}</p>
                    <StatusPill tone={transaction.status === 'completed' ? 'green' : transaction.status === 'failed' ? 'red' : 'amber'}>{transaction.status || 'pending'}</StatusPill>
                  </div>
                </div>
              )) : <p className="py-6 text-center text-sm text-gray-500">Wallet payouts and withdrawals will appear here.</p>}
            </div>
          </Panel>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Panel title="Driver Settlement">
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between"><span className="text-gray-500">Pending payout</span><span className="font-semibold text-[#111827]">{formatCurrency(summary.pendingPayout || 0)}</span></div>
              <div className="flex items-center justify-between"><span className="text-gray-500">Released payout</span><span className="font-semibold text-[#111827]">{formatCurrency(summary.releasedPayout || 0)}</span></div>
              <div className="flex items-center justify-between"><span className="text-gray-500">Sinking fund</span><span className="font-semibold text-[#111827]">{formatCurrency(sinkingFund.balance || summary.sinkingFundAccrued || 0)}</span></div>
            </div>
          </Panel>
          <Panel title="Route Coverage">
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3"><FaMapMarkedAlt className="text-[#3B82F6]" /><span className="text-gray-600">{routeZones.length || topRoutes.length || 0} active route zones</span></div>
              <div className="flex items-center gap-3"><FaTruck className="text-[#F97316]" /><span className="text-gray-600">{Number(summary.totalDistanceKm || 0).toLocaleString()} km planned or tracked</span></div>
              <div className="flex items-center gap-3"><FaReceipt className="text-[#16A34A]" /><span className="text-gray-600">{summary.proofOfDeliveryCount || 0} delivery proofs recorded</span></div>
            </div>
          </Panel>
          <Panel title="Operational Status">
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between"><span className="text-gray-500">Account</span><StatusPill tone={profileStatus === 'verified' ? 'green' : profileStatus === 'pending' ? 'amber' : 'gray'}>{profileStatus}</StatusPill></div>
              <div className="flex items-center justify-between"><span className="text-gray-500">Active routes</span><span className="font-semibold text-[#111827]">{summary.activeTrips || inTransitTrips}</span></div>
              <div className="flex items-center justify-between"><span className="text-gray-500">Release queue</span><span className="font-semibold text-[#111827]">{releaseQueue.length}</span></div>
            </div>
          </Panel>
        </div>
        </main>
      </div>
    </div>
  );
};

export default LogisticsStatus;
