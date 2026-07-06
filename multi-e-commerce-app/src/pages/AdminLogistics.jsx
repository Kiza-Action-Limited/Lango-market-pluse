import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import {
  FaCamera,
  FaCheckCircle,
  FaExternalLinkAlt,
  FaLocationArrow,
  FaLockOpen,
  FaMapMarkerAlt,
  FaQrcode,
  FaRedo,
  FaRoute,
  FaSatelliteDish,
  FaShieldAlt,
  FaStop,
  FaTimesCircle,
  FaTruck,
  FaUserCheck,
} from 'react-icons/fa';
import { logisticsService } from '../services/logisticsService';
import { QrAuditTrail } from '../components/logistics/QrHandshakePanel';

const money = (value) => new Intl.NumberFormat('en-KE', {
  style: 'currency',
  currency: 'KES',
  maximumFractionDigits: 0,
}).format(Number(value || 0));

const humanize = (value) => String(value || 'not available')
  .replace(/_/g, ' ')
  .replace(/\b\w/g, (letter) => letter.toUpperCase());

const shortDate = (value) => (value ? new Date(value).toLocaleString() : 'Not available');

const getName = (user) => user?.fullName || user?.businessName || user?.name || 'Not assigned';

const hasCoords = (point) => Number.isFinite(Number(point?.lat)) && Number.isFinite(Number(point?.lng));

const coordText = (point) => (hasCoords(point) ? `${Number(point.lat).toFixed(5)}, ${Number(point.lng).toFixed(5)}` : 'No GPS');

const statusTone = (value) => {
  const text = String(value || '').toLowerCase();
  if (['released', 'delivered', 'verified', 'completed', 'in_transit'].some((item) => text.includes(item))) {
    return 'border-green-200 bg-green-50 text-green-700';
  }
  if (['pending', 'awaiting', 'held', 'driver_assigned', 'out_for_delivery'].some((item) => text.includes(item))) {
    return 'border-orange-200 bg-orange-50 text-orange-700';
  }
  if (['failed', 'rejected', 'disputed', 'refunded'].some((item) => text.includes(item))) {
    return 'border-red-200 bg-red-50 text-red-700';
  }
  return 'border-gray-200 bg-gray-50 text-gray-700';
};

const Badge = ({ value }) => (
  <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusTone(value)}`}>
    {humanize(value)}
  </span>
);

const StatCard = ({ label, value, icon: Icon }) => (
  <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
        <p className="mt-1 text-2xl font-bold text-[#111827]">{value}</p>
      </div>
      <div className="rounded-lg bg-[#FFF7ED] p-3 text-[#F97316]">
        <Icon />
      </div>
    </div>
  </div>
);

const AdminLogistics = () => {
  const [loading, setLoading] = useState(true);
  const [tripStatusFilter, setTripStatusFilter] = useState('all');
  const [applicationStatusFilter, setApplicationStatusFilter] = useState('pending');
  const [applications, setApplications] = useState([]);
  const [applicationSummary, setApplicationSummary] = useState({ total: 0, pending: 0, verified: 0, rejected: 0, unverified: 0 });
  const [trips, setTrips] = useState([]);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [reviewNotes, setReviewNotes] = useState({});
  const [reviewingUserId, setReviewingUserId] = useState(null);
  const [qrToken, setQrToken] = useState('');
  const [scanStep, setScanStep] = useState('delivery');
  const [scannerActive, setScannerActive] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const scanTimerRef = useRef(null);

  const loadLiveTrip = async (tripId) => {
    if (!tripId) return null;
    const liveTrip = await logisticsService.getAdminLogisticsLive(tripId);
    setSelectedTrip(liveTrip);
    setTrips((current) => current.map((trip) => (trip._id === liveTrip?._id ? liveTrip : trip)));
    return liveTrip;
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [appsRes, tripsRes] = await Promise.all([
        logisticsService.getAdminApplications({ status: applicationStatusFilter, page: 1, limit: 50 }),
        logisticsService.getAdminLogisticsTrips({ status: tripStatusFilter, page: 1, limit: 50 }),
      ]);
      const nextTrips = tripsRes?.logistics || [];
      setApplications(appsRes?.data || []);
      setApplicationSummary(appsRes?.summary || { total: 0, pending: 0, verified: 0, rejected: 0, unverified: 0 });
      setTrips(nextTrips);
      const current = selectedTrip?._id && nextTrips.find((trip) => trip._id === selectedTrip._id);
      setSelectedTrip(current || nextTrips[0] || null);
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Failed to load logistics admin data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [applicationStatusFilter, tripStatusFilter]);

  useEffect(() => {
    if (!selectedTrip?._id) return undefined;
    const timer = window.setInterval(() => {
      loadLiveTrip(selectedTrip._id).catch(() => null);
    }, 30000);
    return () => window.clearInterval(timer);
  }, [selectedTrip?._id]);

  useEffect(() => () => stopScanner(), []);

  const stopScanner = () => {
    if (scanTimerRef.current) window.clearInterval(scanTimerRef.current);
    scanTimerRef.current = null;
    streamRef.current?.getTracks?.().forEach((track) => track.stop());
    streamRef.current = null;
    setScannerActive(false);
  };

  const startScanner = async () => {
    if (!selectedTrip?._id) {
      toast.error('Select a logistics trip first');
      return;
    }
    if (!window.BarcodeDetector) {
      toast.error('Camera QR scanning is not supported in this browser. Paste the QR token instead.');
      return;
    }
    try {
      const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      setScannerActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      scanTimerRef.current = window.setInterval(async () => {
        if (!videoRef.current) return;
        const codes = await detector.detect(videoRef.current);
        if (codes?.[0]?.rawValue) {
          setQrToken(codes[0].rawValue);
          stopScanner();
          toast.success('QR token captured');
        }
      }, 700);
    } catch (error) {
      stopScanner();
      toast.error(error?.message || 'Unable to start camera scanner');
    }
  };

  const readCurrentGps = () => new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy,
      }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 10000 }
    );
  });

  const reviewApplication = async (userId, action) => {
    setReviewingUserId(userId);
    try {
      await logisticsService.reviewApplication(userId, {
        action,
        notes: reviewNotes[userId] || '',
      });
      toast.success(action === 'approve' ? 'Application approved' : 'Application rejected');
      fetchData();
    } catch (error) {
      toast.error(error?.response?.data?.message || `Failed to ${action} application`);
    } finally {
      setReviewingUserId(null);
    }
  };

  const scanQr = async () => {
    if (!selectedTrip?._id) {
      toast.error('Select a logistics trip first');
      return;
    }
    if (!qrToken.trim()) {
      toast.error('Enter or scan a QR token');
      return;
    }
    setActionLoading(true);
    try {
      const gpsCoords = await readCurrentGps();
      await logisticsService.adminScanTripQr(selectedTrip._id, {
        step: scanStep,
        token: qrToken.trim(),
        gpsCoords,
      });
      toast.success(`${humanize(scanStep)} QR confirmed`);
      setQrToken('');
      await loadLiveTrip(selectedTrip._id);
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || 'QR scan failed');
    } finally {
      setActionLoading(false);
    }
  };

  const releaseEscrow = async () => {
    if (!selectedTrip?._id) return;
    setActionLoading(true);
    try {
      const result = await logisticsService.adminReleaseLogisticsEscrow(selectedTrip._id, { forceRelease: true });
      const updatedTrip = result?.logistics || result?.data?.logistics;
      if (updatedTrip) setSelectedTrip(updatedTrip);
      toast.success(result?.message || 'Escrow released');
      await fetchData();
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Escrow release failed');
    } finally {
      setActionLoading(false);
    }
  };

  const refreshSelected = async () => {
    if (!selectedTrip?._id) return fetchData();
    try {
      await loadLiveTrip(selectedTrip._id);
      toast.success('Live tracking refreshed');
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Refresh failed');
    }
  };

  const activeTrips = trips.filter((trip) => !['delivered', 'auto_released', 'failed', 'returned'].includes(trip.status)).length;
  const deliveredProofs = trips.filter((trip) => trip.qr?.deliveryConfirmed).length;
  const escrowHeld = trips.reduce((total, trip) => {
    const escrow = trip.escrow;
    return ['HELD', 'IN_TRANSIT', 'DELIVERED', 'DISPUTED'].includes(escrow?.status)
      ? total + Number(escrow.amount || 0)
      : total;
  }, 0);

  const live = selectedTrip?.liveTracking || {};
  const escrow = selectedTrip?.escrow;

  return (
    <div className="min-h-screen bg-[#F9FAFB] py-8">
      <div className="container mx-auto space-y-8 px-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-[#111827]">Admin Logistics Control Center</h1>
            <p className="mt-1 text-[#6B7280]">Monitor live GPS routes, delivery QR proof, escrow payments, and logistics applications from one admin workspace.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={refreshSelected}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-[#111827] hover:bg-gray-50"
            >
              <FaRedo /> Refresh
            </button>
            <Link
              to="/admin/logistics-tools"
              className="inline-flex items-center gap-2 rounded-lg bg-[#111827] px-4 py-2 text-sm font-semibold text-white hover:bg-black"
            >
              <FaRoute /> Route Tools
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <StatCard label="Active Trips" value={activeTrips} icon={FaTruck} />
          <StatCard label="Escrow Held" value={money(escrowHeld)} icon={FaShieldAlt} />
          <StatCard label="Delivery QR Proofs" value={deliveredProofs} icon={FaQrcode} />
        </div>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.4fr_0.8fr]">
          <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="inline-flex items-center gap-2 text-xl font-semibold text-[#111827]">
                  <FaSatelliteDish className="text-[#2563EB]" /> Live GPS Tracking
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  {selectedTrip ? `${selectedTrip.orderNumber || selectedTrip.tripId || selectedTrip._id} - ${humanize(selectedTrip.status)}` : 'Select a trip to view live tracking.'}
                </p>
              </div>
              {selectedTrip ? <Badge value={selectedTrip.status} /> : null}
            </div>

            <div className="overflow-hidden rounded-lg border border-gray-200 bg-[#F3F4F6]">
              {live.embedUrl ? (
                <iframe
                  title="Admin logistics live Google map"
                  src={live.embedUrl}
                  className="h-[360px] w-full"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-[360px] items-center justify-center text-sm text-gray-500">
                  No GPS coordinates yet for this logistics record.
                </div>
              )}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-lg border border-gray-200 bg-[#F9FAFB] p-3">
                <p className="text-xs font-semibold uppercase text-gray-500">Driver Live GPS</p>
                <p className="mt-1 font-mono text-sm text-[#111827]">{coordText(live.driver)}</p>
                <p className="mt-1 text-xs text-gray-500">{shortDate(live.lastUpdate)}</p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-[#F9FAFB] p-3">
                <p className="text-xs font-semibold uppercase text-gray-500">Pickup</p>
                <p className="mt-1 font-mono text-sm text-[#111827]">{coordText(live.pickup)}</p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-[#F9FAFB] p-3">
                <p className="text-xs font-semibold uppercase text-gray-500">Delivery</p>
                <p className="mt-1 font-mono text-sm text-[#111827]">{coordText(live.delivery)}</p>
              </div>
            </div>

            {live.googleMapsUrl ? (
              <a
                href={live.googleMapsUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#2563EB] hover:underline"
              >
                <FaExternalLinkAlt /> Open route in Google Maps
              </a>
            ) : null}
          </div>

          <div className="space-y-6">
            <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-[#111827]">
                  <FaShieldAlt className="text-[#16A34A]" /> Escrow Payment
                </h2>
                <Badge value={escrow?.status || 'No escrow'} />
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg bg-[#F9FAFB] p-3">
                  <p className="text-xs uppercase text-gray-500">Amount</p>
                  <p className="font-bold text-[#111827]">{money(escrow?.amount)}</p>
                </div>
                <div className="rounded-lg bg-[#F9FAFB] p-3">
                  <p className="text-xs uppercase text-gray-500">Seller Payout</p>
                  <p className="font-bold text-[#111827]">{money(escrow?.sellerPayout)}</p>
                </div>
                <div className="rounded-lg bg-[#F9FAFB] p-3">
                  <p className="text-xs uppercase text-gray-500">Driver Payout</p>
                  <p className="font-bold text-[#111827]">{money(escrow?.driverPayout)}</p>
                </div>
                <div className="rounded-lg bg-[#F9FAFB] p-3">
                  <p className="text-xs uppercase text-gray-500">Release Due</p>
                  <p className="text-sm font-semibold text-[#111827]">{shortDate(escrow?.autoReleaseAt || selectedTrip?.escrowReleaseDue)}</p>
                </div>
              </div>
              <button
                onClick={releaseEscrow}
                disabled={!selectedTrip || actionLoading || escrow?.status === 'RELEASED'}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#16A34A] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#15803D] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FaLockOpen /> Release Escrow Payment
              </button>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-[#111827]">
                <FaQrcode className="text-[#F97316]" /> Delivery QR Scan
              </h2>
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <FaShieldAlt className="mr-2 inline" />
                Verify the selected shipment before scanning. Wrong, expired, reused, or screenshot QR codes are blocked and should be treated as suspicious.
              </div>
              <div className="mt-4 overflow-hidden rounded-lg border border-gray-200 bg-black">
                <video ref={videoRef} className={`h-44 w-full object-cover ${scannerActive ? 'block' : 'hidden'}`} muted playsInline />
                {!scannerActive ? (
                  <div className="flex h-44 items-center justify-center text-sm text-gray-300">
                    Camera scanner is idle.
                  </div>
                ) : null}
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[130px_1fr]">
                <select
                  value={scanStep}
                  onChange={(event) => setScanStep(event.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="delivery">Delivery</option>
                  <option value="pickup">Pickup</option>
                </select>
                <input
                  value={qrToken}
                  onChange={(event) => setQrToken(event.target.value)}
                  placeholder="Paste QR token"
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <button
                  onClick={startScanner}
                  disabled={scannerActive}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-[#111827] hover:bg-gray-50 disabled:opacity-50"
                >
                  <FaCamera /> Start
                </button>
                <button
                  onClick={stopScanner}
                  disabled={!scannerActive}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-[#111827] hover:bg-gray-50 disabled:opacity-50"
                >
                  <FaStop /> Stop
                </button>
                <button
                  onClick={scanQr}
                  disabled={actionLoading || !selectedTrip}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#F97316] px-3 py-2 text-sm font-semibold text-white hover:bg-[#EA580C] disabled:opacity-50"
                >
                  <FaLocationArrow /> Verify
                </button>
              </div>
              <div className="mt-4">
                <QrAuditTrail scans={selectedTrip?.qr?.scanAudit || selectedTrip?.qrScans || []} title="Admin QR audit trail" />
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="inline-flex items-center gap-2 text-xl font-semibold text-[#111827]">
              <FaTruck className="text-[#3B82F6]" /> Live Logistics Records
            </h2>
            <select
              value={tripStatusFilter}
              onChange={(event) => setTripStatusFilter(event.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="driver_assigned">Driver Assigned</option>
              <option value="in_transit">In Transit</option>
              <option value="out_for_delivery">Out For Delivery</option>
              <option value="delivered">Delivered</option>
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="py-3 pr-4">Order</th>
                  <th className="py-3 pr-4">Driver</th>
                  <th className="py-3 pr-4">Live GPS</th>
                  <th className="py-3 pr-4">QR Proof</th>
                  <th className="py-3 pr-4">Escrow</th>
                  <th className="py-3 pr-4">Action</th>
                </tr>
              </thead>
              <tbody>
                {trips.map((trip) => (
                  <tr key={trip._id} className={`border-b last:border-b-0 ${selectedTrip?._id === trip._id ? 'bg-orange-50/50' : ''}`}>
                    <td className="py-3 pr-4">
                      <div className="font-semibold text-[#111827]">{trip.orderNumber || trip.tripId || trip._id}</div>
                      <div className="text-xs text-gray-500">{humanize(trip.status)}</div>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="font-medium text-[#111827]">{trip.driverName || getName(trip.driver)}</div>
                      <div className="text-xs text-gray-500">{trip.driverPhone || trip.driver?.phone || '-'}</div>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="font-mono text-xs text-[#111827]">{coordText(trip.liveTracking?.driver)}</div>
                      <div className="text-xs text-gray-500">{shortDate(trip.liveTracking?.lastUpdate)}</div>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex flex-col gap-1">
                        <Badge value={trip.qr?.pickupConfirmed ? 'pickup confirmed' : 'pickup waiting'} />
                        <Badge value={trip.qr?.deliveryConfirmed ? 'delivery confirmed' : 'delivery waiting'} />
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <Badge value={trip.escrow?.status || 'No escrow'} />
                      <div className="mt-1 text-xs font-semibold text-[#111827]">{money(trip.escrow?.amount)}</div>
                    </td>
                    <td className="py-3 pr-4">
                      <button
                        onClick={() => loadLiveTrip(trip._id)}
                        className="rounded-lg bg-[#111827] px-3 py-2 text-xs font-semibold text-white hover:bg-black"
                      >
                        Track Live
                      </button>
                    </td>
                  </tr>
                ))}
                {!loading && trips.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-gray-500">No logistics records found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="inline-flex items-center gap-2 text-xl font-semibold text-[#111827]">
                <FaUserCheck className="text-[#F97316]" /> Logistics Applications
              </h2>
              <p className="mt-1 text-sm text-gray-500">Approve only providers with valid identity, vehicle, hub GPS, and compliance documents.</p>
            </div>
            <select
              value={applicationStatusFilter}
              onChange={(event) => setApplicationStatusFilter(event.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="pending">Pending</option>
              <option value="verified">Verified</option>
              <option value="rejected">Rejected</option>
              <option value="all">All</option>
            </select>
          </div>

          <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs font-semibold uppercase text-amber-700">Pending</p>
              <p className="mt-1 text-2xl font-bold text-amber-900">{applicationSummary.pending || 0}</p>
            </div>
            <div className="rounded-lg border border-green-200 bg-green-50 p-3">
              <p className="text-xs font-semibold uppercase text-green-700">Approved</p>
              <p className="mt-1 text-2xl font-bold text-green-900">{applicationSummary.verified || 0}</p>
            </div>
            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-xs font-semibold uppercase text-red-700">Rejected</p>
              <p className="mt-1 text-2xl font-bold text-red-900">{applicationSummary.rejected || 0}</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
              <p className="text-xs font-semibold uppercase text-gray-600">Total</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{applicationSummary.total || 0}</p>
            </div>
          </div>

          {loading ? (
            <p className="text-[#6B7280]">Loading applications...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="py-3 pr-4">Applicant</th>
                    <th className="py-3 pr-4">Phone</th>
                    <th className="py-3 pr-4">Vehicle</th>
                    <th className="py-3 pr-4">GPS Hub</th>
                    <th className="py-3 pr-4">Status</th>
                    <th className="py-3 pr-4">Documents</th>
                    <th className="py-3 pr-4">Review</th>
                  </tr>
                </thead>
                <tbody>
                  {applications.map((app) => {
                    const profile = app.logisticsProfile || {};
                    const status = profile.verificationStatus || 'unverified';
                    const docs = Array.isArray(profile.documents) ? profile.documents : [];
                    const gps = profile.currentLocation || {};
                    const serviceAreas = Array.isArray(profile.serviceAreas) ? profile.serviceAreas : [];
                    const isReviewing = reviewingUserId === app._id;
                    return (
                      <tr key={app._id} className="border-b last:border-b-0">
                        <td className="py-3 pr-4">
                          <div className="font-semibold text-[#111827]">{app.businessName || app.fullName || app.name || 'N/A'}</div>
                          <div className="text-xs text-gray-500">{app.email || 'No email'} | {profile.baseHub || app.locationHub || 'No hub'}</div>
                          {serviceAreas.length ? (
                            <div className="mt-1 text-xs text-gray-500">Areas: {serviceAreas.join(', ')}</div>
                          ) : null}
                        </td>
                        <td className="py-3 pr-4">{app.phone || 'N/A'}</td>
                        <td className="py-3 pr-4">
                          <div>{profile.vehiclePlate || '-'}</div>
                          <div className="text-xs text-gray-500">{profile.vehicleType || 'Vehicle'} | {profile.cargoCapacityKg || '-'} kg</div>
                        </td>
                        <td className="py-3 pr-4">
                          {hasCoords(gps) ? (
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${gps.lat},${gps.lng}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[#2563EB] hover:underline"
                            >
                              <FaMapMarkerAlt /> Map
                            </a>
                          ) : (
                            <span className="text-gray-500">No GPS</span>
                          )}
                        </td>
                        <td className="py-3 pr-4"><Badge value={status} /></td>
                        <td className="py-3 pr-4">
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
                                  <span className="inline-flex items-center gap-1">
                                    <FaExternalLinkAlt /> {humanize(doc.documentType || 'document')} #{index + 1}
                                  </span>
                                </a>
                              ))}
                            </div>
                          ) : (
                            <span className="text-gray-500">No docs</span>
                          )}
                        </td>
                        <td className="py-3 pr-4">
                          <div className="flex flex-wrap gap-2">
                            <input
                              placeholder="Notes"
                              value={reviewNotes[app._id] || ''}
                              onChange={(event) => setReviewNotes((prev) => ({ ...prev, [app._id]: event.target.value }))}
                              className="min-w-40 rounded-lg border border-gray-300 px-2 py-1"
                            />
                            {status === 'pending' && (
                              <>
                                <button
                                  onClick={() => reviewApplication(app._id, 'approve')}
                                  disabled={isReviewing}
                                  className="inline-flex items-center gap-1 rounded-lg bg-[#16A34A] px-2 py-1 text-white disabled:opacity-50"
                                >
                                  <FaCheckCircle /> Approve
                                </button>
                                <button
                                  onClick={() => reviewApplication(app._id, 'reject')}
                                  disabled={isReviewing}
                                  className="inline-flex items-center gap-1 rounded-lg bg-[#DC2626] px-2 py-1 text-white disabled:opacity-50"
                                >
                                  <FaTimesCircle /> Reject
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {applications.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-gray-500">No applications found for this filter.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default AdminLogistics;
