import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FaArrowLeft, FaClipboardList, FaQrcode, FaSyncAlt, FaTruck } from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { logisticsService } from '../services/logisticsService';
import QrHandshakePanel, { QrAuditTrail } from '../components/logistics/QrHandshakePanel';

const statusTone = (value) => {
  const status = String(value || '').toLowerCase();
  if (status.includes('delivered')) return 'bg-green-100 text-green-800';
  if (status.includes('transit') || status.includes('delivery')) return 'bg-blue-100 text-blue-800';
  return 'bg-orange-100 text-orange-800';
};

const routeText = (trip) => {
  const pickup = trip?.route?.pickup || trip?.pickupAddress?.town || trip?.pickupAddress?.label || 'Pickup';
  const delivery = trip?.route?.delivery || trip?.shippingAddress?.town || trip?.shippingAddress?.label || 'Delivery';
  return `${pickup} to ${delivery}`;
};

const LogisticsQrScanner = ({ mode = 'driver' }) => {
  const { isAuthenticated, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [trips, setTrips] = useState([]);
  const [selectedTripId, setSelectedTripId] = useState('');
  const [step, setStep] = useState(mode === 'hub' ? 'pickup' : 'delivery');
  const [scanning, setScanning] = useState(false);

  const role = String(user?.role || '').toLowerCase();
  const isHub = mode === 'hub';

  const loadTrips = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const dashboard = await logisticsService.getDashboard({ limit: 100 });
      const nextTrips = dashboard?.trips || [];
      setTrips(nextTrips);
      setSelectedTripId((current) => current || nextTrips[0]?._id || nextTrips[0]?.id || '');
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Unable to load scanner trips');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && role === 'logistics') loadTrips();
    else setLoading(false);
  }, [isAuthenticated, role]);

  const queue = useMemo(() => {
    if (isHub) {
      return trips.filter((trip) => !trip.qr?.pickupConfirmed && !trip.pickupQrConfirmed);
    }
    return trips.filter((trip) => {
      const pickupDone = trip.qr?.pickupConfirmed || trip.pickupQrConfirmed || trip.qrScans?.some((scan) => scan.step === 'pickup');
      const deliveryDone = trip.qr?.deliveryConfirmed || trip.deliveryQrConfirmed || trip.qrScans?.some((scan) => scan.step === 'delivery');
      return !deliveryDone || !pickupDone;
    });
  }, [isHub, trips]);

  const selectedTrip = queue.find((trip) => (trip._id || trip.id) === selectedTripId) || queue[0] || null;
  const allowedSteps = isHub ? ['pickup'] : ['pickup', 'delivery'];

  useEffect(() => {
    if (selectedTrip && !selectedTripId) setSelectedTripId(selectedTrip._id || selectedTrip.id);
  }, [selectedTrip, selectedTripId]);

  const submitScan = async ({ token, gpsCoords, step: scanStep }) => {
    if (!selectedTrip) throw new Error('Select a shipment before scanning.');
    const logisticsId = selectedTrip._id || selectedTrip.id;
    setScanning(true);
    try {
      const result = scanStep === 'pickup'
        ? await logisticsService.scanPickup(logisticsId, { token, gpsCoords })
        : await logisticsService.scanDelivery(logisticsId, { token, gpsCoords });
      toast.success(`${scanStep === 'pickup' ? 'Pickup' : 'Delivery'} QR recorded`);
      await loadTrips({ silent: true });
      return result;
    } finally {
      setScanning(false);
    }
  };

  if (!isAuthenticated) return <Navigate to="/logistics/login" replace />;
  if (role !== 'logistics') return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-[#F7F8FA] px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-[1400px]">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link to="/logistics/dashboard" className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-[#F97316]">
              <FaArrowLeft /> Back to dashboard
            </Link>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#F97316]">{isHub ? 'Hub QR scanner' : 'Driver QR scanner'}</p>
            <h1 className="mt-1 text-2xl font-bold text-[#111827]">{isHub ? 'Hub Pickup Intake' : 'Live Handoff Scanner'}</h1>
            <p className="mt-1 text-sm text-gray-500">
              {isHub
                ? 'Confirm cargo entering the hub with seller pickup QR proof.'
                : 'Scan seller pickup and buyer delivery QR codes with GPS telemetry.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => loadTrips()}
            disabled={loading}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 text-sm font-semibold text-[#374151] hover:bg-gray-50 disabled:opacity-60"
          >
            <FaSyncAlt className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.85fr_1.35fr]">
          <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <FaClipboardList className="text-[#F97316]" />
              <h2 className="font-semibold text-[#111827]">Scan Queue</h2>
            </div>
            <div className="space-y-3">
              {queue.length ? queue.map((trip) => {
                const id = trip._id || trip.id;
                const isSelected = id === (selectedTrip?._id || selectedTrip?.id);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setSelectedTripId(id);
                      setStep(isHub ? 'pickup' : (trip.qr?.nextStep || 'delivery'));
                    }}
                    className={`w-full rounded-lg border p-3 text-left transition ${isSelected ? 'border-[#F97316] bg-[#FFF7ED]' : 'border-gray-200 bg-gray-50 hover:border-orange-200'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-mono text-sm font-semibold text-[#111827]">{trip.orderNumber || String(id).slice(-8)}</p>
                        <p className="mt-1 truncate text-xs text-gray-500">{routeText(trip)}</p>
                      </div>
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusTone(trip.status)}`}>
                        {String(trip.status || 'pending').replace(/_/g, ' ')}
                      </span>
                    </div>
                  </button>
                );
              }) : (
                <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
                  <FaTruck className="mx-auto text-3xl text-gray-400" />
                  <p className="mt-3 text-sm font-semibold text-[#111827]">No QR handoffs waiting</p>
                  <p className="mt-1 text-xs text-gray-500">New pickup and delivery scans will appear after trips are assigned.</p>
                </div>
              )}
            </div>
          </section>

          <div className="space-y-4">
            <QrHandshakePanel
              title={isHub ? 'Hub pickup QR scanner' : 'Driver shipment QR scanner'}
              subtitle={selectedTrip ? routeText(selectedTrip) : 'Select a shipment from the queue before scanning.'}
              defaultStep={step}
              allowedSteps={allowedSteps}
              logistics={selectedTrip}
              scanning={scanning}
              onScan={submitScan}
            />
            <QrAuditTrail scans={selectedTrip?.qrScans || selectedTrip?.qr?.scanAudit || []} title="Selected shipment audit trail" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default LogisticsQrScanner;
