import React, { useMemo, useState } from 'react';
import { Navigate, useLocation, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  FaArrowRight,
  FaChartLine,
  FaCoins,
  FaFileInvoiceDollar,
  FaLayerGroup,
  FaLock,
  FaMapMarkedAlt,
  FaQrcode,
  FaShippingFast,
  FaTruck,
  FaUndo,
} from 'react-icons/fa';
import { useAuth } from '../context/AuthContext';
import { logisticsService } from '../services/logisticsService';

const initialTripForm = {
  originLat: '',
  originLng: '',
  destinationLat: '',
  destinationLng: '',
  maxCapacityKg: 3000,
  deadlineHours: 4,
  cargoType: 'Mixed cargo',
  notes: '',
};

const initialJoinForm = {
  groupTripId: '',
  weightKg: 25,
};

const initialBulkForm = {
  logisticsIds: '',
  status: 'in_transit',
  notes: '',
};

const initialQrForm = {
  orderId: '',
  logisticsId: '',
  type: 'PICKUP',
  tokenId: '',
};

const initialEscrowForm = {
  orderId: '',
  amount: '',
  reason: '',
};

const initialSinkingForm = {
  driverId: '',
  amount: '',
  mileageKm: '',
  reason: '',
};

const initialRouteForm = {
  address: '',
  autocompleteInput: '',
  nearbyLat: '',
  nearbyLng: '',
  maxDistanceKm: 10,
  weightKg: 50,
  statsStartDate: '',
  statsEndDate: '',
};

const parseIds = (value) =>
  String(value || '')
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);

const formatJson = (value) => {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const Section = ({ title, description, icon: Icon, children, action }) => (
  <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-[#FFF7ED] p-3 text-[#F97316]">
          <Icon />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-[#111827]">{title}</h2>
          <p className="text-sm text-gray-500">{description}</p>
        </div>
      </div>
      {action}
    </div>
    {children}
  </section>
);

const Field = ({ label, children, hint }) => (
  <label className="block text-sm font-medium text-[#111827]">
    <span>{label}</span>
    <div className="mt-1">{children}</div>
    {hint ? <p className="mt-1 text-xs text-gray-500">{hint}</p> : null}
  </label>
);

const Input = (props) => (
  <input
    {...props}
    className={`w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-[#F97316] ${props.className || ''}`}
  />
);

const Textarea = (props) => (
  <textarea
    {...props}
    className={`w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-[#F97316] ${props.className || ''}`}
  />
);

const Select = (props) => (
  <select
    {...props}
    className={`w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-[#F97316] ${props.className || ''}`}
  />
);

const ResultBox = ({ value }) => (
  <pre className="max-h-72 overflow-auto rounded-xl bg-[#111827] p-4 text-xs leading-5 text-green-100">
    {formatJson(value)}
  </pre>
);

const LogisticsOperations = () => {
  const { user, isAuthenticated, loading } = useAuth();
  const location = useLocation();
  const role = String(user?.role || '').toLowerCase();
  const isAdmin = role === 'admin';
  const isLogistics = role === 'logistics';
  const isAllowed = isAdmin || isLogistics;

  const [activeTab, setActiveTab] = useState('trips');
  const [loadingState, setLoadingState] = useState({});
  const [tripForm, setTripForm] = useState(initialTripForm);
  const [joinForm, setJoinForm] = useState(initialJoinForm);
  const [bulkForm, setBulkForm] = useState(initialBulkForm);
  const [qrForm, setQrForm] = useState(initialQrForm);
  const [escrowForm, setEscrowForm] = useState(initialEscrowForm);
  const [sinkingForm, setSinkingForm] = useState(initialSinkingForm);
  const [routeForm, setRouteForm] = useState(initialRouteForm);

  const [tripResult, setTripResult] = useState(null);
  const [joinResult, setJoinResult] = useState(null);
  const [bulkResult, setBulkResult] = useState(null);
  const [qrResult, setQrResult] = useState(null);
  const [qrListResult, setQrListResult] = useState(null);
  const [qrStatsResult, setQrStatsResult] = useState(null);
  const [escrowResult, setEscrowResult] = useState(null);
  const [sinkingResult, setSinkingResult] = useState(null);
  const [myFundResult, setMyFundResult] = useState(null);
  const [routeResult, setRouteResult] = useState({
    geocode: null,
    autocomplete: null,
    nearbyDrivers: null,
    deliveryStats: null,
  });

  const tabs = useMemo(() => {
    const base = [
      { key: 'trips', label: 'Group Trips', icon: FaLayerGroup },
      { key: 'routes', label: 'Route Tools', icon: FaMapMarkedAlt },
      { key: 'qr', label: 'QR Tokens', icon: FaQrcode },
    ];

    base.push({ key: 'escrow', label: 'Escrow', icon: FaLock });
    base.push({ key: 'sinking', label: 'Sinking Fund', icon: FaCoins });

    if (isAdmin) {
      base.push({ key: 'bulk', label: 'Bulk Status', icon: FaFileInvoiceDollar });
    }

    return base;
  }, [isAdmin]);

  const setLoadingFor = (key, value) => {
    setLoadingState((prev) => ({ ...prev, [key]: value }));
  };

  const handleCreateTrip = async (event) => {
    event.preventDefault();
    setLoadingFor('createTrip', true);
    try {
      const payload = {
        ...tripForm,
        originLat: Number(tripForm.originLat),
        originLng: Number(tripForm.originLng),
        destinationLat: Number(tripForm.destinationLat),
        destinationLng: Number(tripForm.destinationLng),
        maxCapacityKg: Number(tripForm.maxCapacityKg),
        deadlineHours: Number(tripForm.deadlineHours),
      };
      const result = await logisticsService.createGroupTrip(payload);
      setTripResult(result);
      toast.success('Group trip created.');
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || 'Failed to create group trip');
    } finally {
      setLoadingFor('createTrip', false);
    }
  };

  const handleJoinTrip = async (event) => {
    event.preventDefault();
    setLoadingFor('joinTrip', true);
    try {
      const payload = {
        groupTripId: joinForm.groupTripId.trim(),
        weightKg: Number(joinForm.weightKg),
      };
      const result = await logisticsService.joinGroupTrip(payload);
      setJoinResult(result);
      toast.success('Joined group trip.');
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || 'Failed to join group trip');
    } finally {
      setLoadingFor('joinTrip', false);
    }
  };

  const handleBulkUpdate = async (event) => {
    event.preventDefault();
    setLoadingFor('bulkUpdate', true);
    try {
      const payload = {
        logisticsIds: parseIds(bulkForm.logisticsIds),
        status: bulkForm.status,
        notes: bulkForm.notes,
      };
      const result = await logisticsService.bulkUpdateStatus(payload);
      setBulkResult(result);
      toast.success('Bulk logistics update sent.');
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || 'Failed to update logistics');
    } finally {
      setLoadingFor('bulkUpdate', false);
    }
  };

  const handleGenerateQr = async (event) => {
    event.preventDefault();
    setLoadingFor('generateQr', true);
    try {
      const payload = {
        orderId: qrForm.orderId.trim(),
        logisticsId: qrForm.logisticsId.trim(),
        type: qrForm.type,
      };
      const result = await logisticsService.generateQrToken(payload);
      setQrResult(result);
      toast.success('QR token generated.');
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || 'Failed to generate QR token');
    } finally {
      setLoadingFor('generateQr', false);
    }
  };

  const handleListQrTokens = async (event) => {
    event.preventDefault();
    setLoadingFor('listQr', true);
    try {
      const result = await logisticsService.listQrTokensForOrder(qrForm.orderId.trim(), { page: 1, limit: 20 });
      setQrListResult(result);
      toast.success('QR tokens loaded.');
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || 'Failed to load QR tokens');
    } finally {
      setLoadingFor('listQr', false);
    }
  };

  const handleResendQr = async (event) => {
    event.preventDefault();
    setLoadingFor('resendQr', true);
    try {
      const result = await logisticsService.resendQrToken(qrForm.tokenId.trim());
      setQrResult(result);
      toast.success('QR token resent.');
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || 'Failed to resend QR token');
    } finally {
      setLoadingFor('resendQr', false);
    }
  };

  const handleLoadQrStats = async () => {
    setLoadingFor('qrStats', true);
    try {
      const result = await logisticsService.getQrTokenStats();
      setQrStatsResult(result);
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || 'Failed to load QR token stats');
    } finally {
      setLoadingFor('qrStats', false);
    }
  };

  const handleEscrowLookup = async (event) => {
    event.preventDefault();
    setLoadingFor('escrowLookup', true);
    try {
      const result = await logisticsService.getEscrowStatus(escrowForm.orderId.trim());
      setEscrowResult(result);
      toast.success('Escrow status loaded.');
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || 'Failed to load escrow status');
    } finally {
      setLoadingFor('escrowLookup', false);
    }
  };

  const handleEscrowAction = async (action) => {
    setLoadingFor(action, true);
    try {
      const orderId = escrowForm.orderId.trim();
      const amount = escrowForm.amount ? Number(escrowForm.amount) : undefined;
      const reason = escrowForm.reason.trim();

      let result;
      if (action === 'release') {
        result = await logisticsService.releaseEscrow(orderId, {});
      } else if (action === 'hold') {
        result = await logisticsService.holdEscrow(orderId, { reason: reason || 'Manual hold from frontend' });
      } else if (action === 'partial') {
        result = await logisticsService.partialReleaseEscrow(orderId, { amount, reason: reason || 'Partial release from frontend' });
      } else if (action === 'cancel') {
        result = await logisticsService.cancelEscrow(orderId, { reason: reason || 'Cancelled from frontend' });
      }

      setEscrowResult(result);
      toast.success('Escrow action completed.');
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || 'Escrow action failed');
    } finally {
      setLoadingFor(action, false);
    }
  };

  const handleLoadMyFund = async () => {
    setLoadingFor('myFund', true);
    try {
      const result = await logisticsService.getMySinkingFund();
      setMyFundResult(result);
      setSinkingResult(result);
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || 'Failed to load sinking fund');
    } finally {
      setLoadingFor('myFund', false);
    }
  };

  const handleLoadDriverFund = async () => {
    setLoadingFor('driverFund', true);
    try {
      const result = await logisticsService.getSinkingFund(sinkingForm.driverId.trim());
      setSinkingResult(result);
      toast.success('Sinking fund loaded.');
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || 'Failed to load sinking fund');
    } finally {
      setLoadingFor('driverFund', false);
    }
  };

  const handleLoadContributions = async () => {
    setLoadingFor('contributions', true);
    try {
      const result = await logisticsService.getSinkingFundContributions(sinkingForm.driverId.trim(), { page: 1, limit: 20 });
      setSinkingResult(result);
      toast.success('Contribution history loaded.');
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || 'Failed to load contributions');
    } finally {
      setLoadingFor('contributions', false);
    }
  };

  const handleLoadAllFunds = async () => {
    setLoadingFor('allFunds', true);
    try {
      const result = await logisticsService.getAllSinkingFunds({ page: 1, limit: 20 });
      setSinkingResult(result);
      toast.success('All funds loaded.');
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || 'Failed to load funds');
    } finally {
      setLoadingFor('allFunds', false);
    }
  };

  const handleLoadAlerts = async () => {
    setLoadingFor('alerts', true);
    try {
      const result = await logisticsService.getSinkingFundServiceAlerts();
      setSinkingResult(result);
      toast.success('Service alerts loaded.');
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || 'Failed to load alerts');
    } finally {
      setLoadingFor('alerts', false);
    }
  };

  const handleLoadAnalytics = async () => {
    setLoadingFor('analytics', true);
    try {
      const result = await logisticsService.getSinkingFundAnalytics();
      setSinkingResult(result);
      toast.success('Analytics loaded.');
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || 'Failed to load analytics');
    } finally {
      setLoadingFor('analytics', false);
    }
  };

  const handleGeocodeAddress = async () => {
    setLoadingFor('geocode', true);
    try {
      const result = await logisticsService.geocodeAddress(routeForm.address.trim());
      setRouteResult((prev) => ({ ...prev, geocode: result }));
      toast.success('Address geocoded.');
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || 'Geocoding failed');
    } finally {
      setLoadingFor('geocode', false);
    }
  };

  const handleAutocomplete = async () => {
    setLoadingFor('autocomplete', true);
    try {
      const result = await logisticsService.placeAutocomplete(routeForm.autocompleteInput.trim());
      setRouteResult((prev) => ({ ...prev, autocomplete: result }));
      toast.success('Autocomplete loaded.');
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || 'Autocomplete failed');
    } finally {
      setLoadingFor('autocomplete', false);
    }
  };

  const handleNearbyDrivers = async () => {
    setLoadingFor('nearbyDrivers', true);
    try {
      const result = await logisticsService.getNearbyDrivers({
        lat: Number(routeForm.nearbyLat),
        lng: Number(routeForm.nearbyLng),
        maxDistance: Number(routeForm.maxDistanceKm),
        weight: Number(routeForm.weightKg),
      });
      setRouteResult((prev) => ({ ...prev, nearbyDrivers: result }));
      toast.success('Nearby drivers loaded.');
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || 'Failed to load nearby drivers');
    } finally {
      setLoadingFor('nearbyDrivers', false);
    }
  };

  const handleDeliveryStats = async () => {
    setLoadingFor('deliveryStats', true);
    try {
      const result = await logisticsService.getDeliveryStats({
        startDate: routeForm.statsStartDate || undefined,
        endDate: routeForm.statsEndDate || undefined,
      });
      setRouteResult((prev) => ({ ...prev, deliveryStats: result }));
      toast.success('Delivery stats loaded.');
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || 'Failed to load delivery stats');
    } finally {
      setLoadingFor('deliveryStats', false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-[#F9FAFB] p-8">Loading workspace...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!isAllowed) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#F8FAFC_0%,#FFF7ED_100%)] px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-3xl border border-orange-100 bg-white/90 p-6 shadow-sm backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#F97316]">Backend surfaces now exposed</p>
              <h1 className="mt-2 text-3xl font-bold text-[#111827]">Logistics Operations Hub</h1>
              <p className="mt-2 max-w-3xl text-sm text-gray-600">
                Create and join group trips, manage QR tokens, review escrow, run bulk status updates, and inspect sinking-fund data from one place.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                to={isAdmin ? '/admin/logistics' : '/logistics/status'}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Back to dashboard
              </Link>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
                  active ? 'bg-[#111827] text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                <Icon />
                {tab.label}
              </button>
            );
          })}
        </div>

        {activeTab === 'trips' && (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <Section
              title="Create Group Trip"
              description="Create a shared logistics trip record with the exact backend schema."
              icon={FaLayerGroup}
            >
              <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={handleCreateTrip}>
                <Field label="Origin Lat">
                  <Input value={tripForm.originLat} onChange={(e) => setTripForm((prev) => ({ ...prev, originLat: e.target.value }))} required />
                </Field>
                <Field label="Origin Lng">
                  <Input value={tripForm.originLng} onChange={(e) => setTripForm((prev) => ({ ...prev, originLng: e.target.value }))} required />
                </Field>
                <Field label="Destination Lat">
                  <Input value={tripForm.destinationLat} onChange={(e) => setTripForm((prev) => ({ ...prev, destinationLat: e.target.value }))} required />
                </Field>
                <Field label="Destination Lng">
                  <Input value={tripForm.destinationLng} onChange={(e) => setTripForm((prev) => ({ ...prev, destinationLng: e.target.value }))} required />
                </Field>
                <Field label="Max Capacity Kg">
                  <Input type="number" min="1" value={tripForm.maxCapacityKg} onChange={(e) => setTripForm((prev) => ({ ...prev, maxCapacityKg: e.target.value }))} />
                </Field>
                <Field label="Deadline Hours">
                  <Input type="number" min="1" max="24" value={tripForm.deadlineHours} onChange={(e) => setTripForm((prev) => ({ ...prev, deadlineHours: e.target.value }))} />
                </Field>
                <Field label="Cargo Type">
                  <Input value={tripForm.cargoType} onChange={(e) => setTripForm((prev) => ({ ...prev, cargoType: e.target.value }))} />
                </Field>
                <Field label="Notes">
                  <Input value={tripForm.notes} onChange={(e) => setTripForm((prev) => ({ ...prev, notes: e.target.value }))} />
                </Field>
                <div className="md:col-span-2">
                  <button
                    type="submit"
                    disabled={loadingState.createTrip}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#F97316] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#EA580C] disabled:opacity-60"
                  >
                    {loadingState.createTrip ? 'Creating...' : 'Create Trip'}
                    <FaArrowRight />
                  </button>
                </div>
              </form>
              <div className="mt-5">
                <ResultBox value={tripResult} />
              </div>
            </Section>

            <Section
              title="Join Group Trip"
              description="Join an existing shared trip by trip code."
              icon={FaTruck}
            >
              <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={handleJoinTrip}>
                <Field label="Group Trip ID">
                  <Input value={joinForm.groupTripId} onChange={(e) => setJoinForm((prev) => ({ ...prev, groupTripId: e.target.value }))} required />
                </Field>
                <Field label="Weight Kg">
                  <Input type="number" min="1" value={joinForm.weightKg} onChange={(e) => setJoinForm((prev) => ({ ...prev, weightKg: e.target.value }))} required />
                </Field>
                <div className="md:col-span-2">
                  <button
                    type="submit"
                    disabled={loadingState.joinTrip}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#111827] px-4 py-2.5 text-sm font-semibold text-white hover:bg-black disabled:opacity-60"
                  >
                    {loadingState.joinTrip ? 'Joining...' : 'Join Trip'}
                  </button>
                </div>
              </form>
              <div className="mt-5">
                <ResultBox value={joinResult} />
              </div>
            </Section>
          </div>
        )}

        {activeTab === 'routes' && (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <Section
              title="Route Tools"
              description="Geocode addresses, run autocomplete, fetch nearby drivers, and inspect delivery stats."
              icon={FaMapMarkedAlt}
            >
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="Address to geocode">
                  <Textarea rows="3" value={routeForm.address} onChange={(e) => setRouteForm((prev) => ({ ...prev, address: e.target.value }))} />
                </Field>
                <Field label="Autocomplete input">
                  <Input value={routeForm.autocompleteInput} onChange={(e) => setRouteForm((prev) => ({ ...prev, autocompleteInput: e.target.value }))} />
                </Field>
                <Field label="Nearby latitude">
                  <Input value={routeForm.nearbyLat} onChange={(e) => setRouteForm((prev) => ({ ...prev, nearbyLat: e.target.value }))} />
                </Field>
                <Field label="Nearby longitude">
                  <Input value={routeForm.nearbyLng} onChange={(e) => setRouteForm((prev) => ({ ...prev, nearbyLng: e.target.value }))} />
                </Field>
                <Field label="Max distance km">
                  <Input type="number" min="1" value={routeForm.maxDistanceKm} onChange={(e) => setRouteForm((prev) => ({ ...prev, maxDistanceKm: e.target.value }))} />
                </Field>
                <Field label="Weight kg">
                  <Input type="number" min="0" value={routeForm.weightKg} onChange={(e) => setRouteForm((prev) => ({ ...prev, weightKg: e.target.value }))} />
                </Field>
                <Field label="Stats start date">
                  <Input type="date" value={routeForm.statsStartDate} onChange={(e) => setRouteForm((prev) => ({ ...prev, statsStartDate: e.target.value }))} />
                </Field>
                <Field label="Stats end date">
                  <Input type="date" value={routeForm.statsEndDate} onChange={(e) => setRouteForm((prev) => ({ ...prev, statsEndDate: e.target.value }))} />
                </Field>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <button type="button" onClick={handleGeocodeAddress} disabled={loadingState.geocode} className="rounded-xl bg-[#F97316] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#EA580C] disabled:opacity-60">
                  {loadingState.geocode ? 'Geocoding...' : 'Geocode Address'}
                </button>
                <button type="button" onClick={handleAutocomplete} disabled={loadingState.autocomplete} className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60">
                  {loadingState.autocomplete ? 'Loading...' : 'Run Autocomplete'}
                </button>
                <button type="button" onClick={handleNearbyDrivers} disabled={loadingState.nearbyDrivers} className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60">
                  {loadingState.nearbyDrivers ? 'Loading...' : 'Nearby Drivers'}
                </button>
                <button type="button" onClick={handleDeliveryStats} disabled={loadingState.deliveryStats} className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60">
                  {loadingState.deliveryStats ? 'Loading...' : 'Delivery Stats'}
                </button>
              </div>
            </Section>

            <div className="space-y-6">
              <Section title="Geocode Result" description="Backend geocoding response." icon={FaMapMarkedAlt}>
                <ResultBox value={routeResult.geocode} />
              </Section>
              <Section title="Autocomplete Result" description="Place predictions from the backend." icon={FaMapMarkedAlt}>
                <ResultBox value={routeResult.autocomplete} />
              </Section>
            </div>

            <Section title="Nearby Drivers" description="Drivers close to the selected point." icon={FaTruck}>
              <ResultBox value={routeResult.nearbyDrivers} />
            </Section>
            <Section title="Delivery Stats" description="Delivery analytics for the selected date range." icon={FaChartLine}>
              <ResultBox value={routeResult.deliveryStats} />
            </Section>
          </div>
        )}

        {activeTab === 'qr' && (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <Section
              title="Generate QR Token"
              description="Create pickup or delivery QR tokens directly from the backend."
              icon={FaQrcode}
            >
              <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={handleGenerateQr}>
                <Field label="Order ID">
                  <Input value={qrForm.orderId} onChange={(e) => setQrForm((prev) => ({ ...prev, orderId: e.target.value }))} required />
                </Field>
                <Field label="Logistics ID">
                  <Input value={qrForm.logisticsId} onChange={(e) => setQrForm((prev) => ({ ...prev, logisticsId: e.target.value }))} required />
                </Field>
                <Field label="Token Type">
                  <Select value={qrForm.type} onChange={(e) => setQrForm((prev) => ({ ...prev, type: e.target.value }))}>
                    <option value="PICKUP">PICKUP</option>
                    <option value="DELIVERY">DELIVERY</option>
                  </Select>
                </Field>
                <Field label="Token ID to Resend" hint="Optional, if you need to resend an existing token.">
                  <Input value={qrForm.tokenId} onChange={(e) => setQrForm((prev) => ({ ...prev, tokenId: e.target.value }))} />
                </Field>
                <div className="md:col-span-2 flex flex-wrap gap-3">
                  <button
                    type="submit"
                    disabled={loadingState.generateQr}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#F97316] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#EA580C] disabled:opacity-60"
                  >
                    {loadingState.generateQr ? 'Generating...' : 'Generate Token'}
                  </button>
                  <button
                    type="button"
                    onClick={handleListQrTokens}
                    disabled={loadingState.listQr}
                    className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                  >
                    {loadingState.listQr ? 'Loading...' : 'List Order Tokens'}
                  </button>
                  <button
                    type="button"
                    onClick={handleResendQr}
                    disabled={loadingState.resendQr}
                    className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                  >
                    {loadingState.resendQr ? 'Resending...' : 'Resend Token'}
                  </button>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={handleLoadQrStats}
                      disabled={loadingState.qrStats}
                      className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                    >
                      {loadingState.qrStats ? 'Loading...' : 'Load Stats'}
                    </button>
                  )}
                </div>
              </form>
              <div className="mt-5">
                <ResultBox value={qrResult} />
              </div>
            </Section>

            <Section
              title="QR Data"
              description="Inspect the latest token list or admin statistics."
              icon={FaChartLine}
            >
              <div className="space-y-4">
                <div>
                  <p className="mb-2 text-sm font-semibold text-[#111827]">Order Token List</p>
                  <ResultBox value={qrListResult} />
                </div>
                {isAdmin && (
                  <div>
                    <p className="mb-2 text-sm font-semibold text-[#111827]">Admin Token Stats</p>
                    <ResultBox value={qrStatsResult} />
                  </div>
                )}
              </div>
            </Section>
          </div>
        )}

        {activeTab === 'escrow' && (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <Section
              title="Escrow Lookup"
              description="Check escrow status and drive release or hold actions."
              icon={FaLock}
            >
              <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={handleEscrowLookup}>
                <Field label="Order ID">
                  <Input value={escrowForm.orderId} onChange={(e) => setEscrowForm((prev) => ({ ...prev, orderId: e.target.value }))} required />
                </Field>
                <Field label="Amount">
                  <Input type="number" min="0" value={escrowForm.amount} onChange={(e) => setEscrowForm((prev) => ({ ...prev, amount: e.target.value }))} />
                </Field>
                <Field label="Reason" hint="Used for hold, partial release, or cancel.">
                  <Textarea rows="3" value={escrowForm.reason} onChange={(e) => setEscrowForm((prev) => ({ ...prev, reason: e.target.value }))} />
                </Field>
                <div className="md:col-span-2 flex flex-wrap gap-3">
                  <button
                    type="submit"
                    disabled={loadingState.escrowLookup}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#111827] px-4 py-2.5 text-sm font-semibold text-white hover:bg-black disabled:opacity-60"
                  >
                    {loadingState.escrowLookup ? 'Loading...' : 'Check Escrow'}
                  </button>
                  {isAdmin && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleEscrowAction('release')}
                        disabled={loadingState.release}
                        className="inline-flex items-center gap-2 rounded-xl bg-[#16A34A] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#15803D] disabled:opacity-60"
                      >
                        {loadingState.release ? 'Releasing...' : 'Release'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEscrowAction('hold')}
                        disabled={loadingState.hold}
                        className="inline-flex items-center gap-2 rounded-xl bg-[#DC2626] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#B91C1C] disabled:opacity-60"
                      >
                        {loadingState.hold ? 'Holding...' : 'Hold'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEscrowAction('partial')}
                        disabled={loadingState.partial}
                        className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                      >
                        {loadingState.partial ? 'Sending...' : 'Partial Release'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEscrowAction('cancel')}
                        disabled={loadingState.cancel}
                        className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                      >
                        {loadingState.cancel ? 'Cancelling...' : 'Cancel'}
                      </button>
                    </>
                  )}
                </div>
              </form>
            </Section>

            <Section
              title="Escrow Response"
              description="Most recent escrow lookup or action output."
              icon={FaUndo}
            >
              <ResultBox value={escrowResult} />
            </Section>
          </div>
        )}

        {activeTab === 'bulk' && isAdmin && (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <Section
              title="Bulk Logistics Update"
              description="Push a status update to multiple logistics records in one request."
              icon={FaFileInvoiceDollar}
            >
              <form className="grid grid-cols-1 gap-4" onSubmit={handleBulkUpdate}>
                <Field label="Logistics IDs" hint="Paste one ID per line or separate by commas.">
                  <Textarea
                    rows="5"
                    value={bulkForm.logisticsIds}
                    onChange={(e) => setBulkForm((prev) => ({ ...prev, logisticsIds: e.target.value }))}
                    required
                  />
                </Field>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field label="Status">
                    <Select value={bulkForm.status} onChange={(e) => setBulkForm((prev) => ({ ...prev, status: e.target.value }))}>
                      <option value="pending">pending</option>
                      <option value="driver_assigned">driver_assigned</option>
                      <option value="en_route_to_pickup">en_route_to_pickup</option>
                      <option value="picked_up">picked_up</option>
                      <option value="in_transit">in_transit</option>
                      <option value="out_for_delivery">out_for_delivery</option>
                      <option value="delivered">delivered</option>
                      <option value="failed">failed</option>
                    </Select>
                  </Field>
                  <Field label="Notes">
                    <Input value={bulkForm.notes} onChange={(e) => setBulkForm((prev) => ({ ...prev, notes: e.target.value }))} />
                  </Field>
                </div>
                <div>
                  <button
                    type="submit"
                    disabled={loadingState.bulkUpdate}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#F97316] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#EA580C] disabled:opacity-60"
                  >
                    {loadingState.bulkUpdate ? 'Updating...' : 'Run Bulk Update'}
                  </button>
                </div>
              </form>
            </Section>

            <Section
              title="Bulk Result"
              description="Backend response from the last bulk update request."
              icon={FaShippingFast}
            >
              <ResultBox value={bulkResult} />
            </Section>
          </div>
        )}

        {activeTab === 'sinking' && (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <Section
              title="Sinking Fund"
              description="Load driver-level fund details and admin-level analytics."
              icon={FaCoins}
            >
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="Driver ID">
                  <Input value={sinkingForm.driverId} onChange={(e) => setSinkingForm((prev) => ({ ...prev, driverId: e.target.value }))} />
                </Field>
                <Field label="Amount">
                  <Input type="number" min="0" value={sinkingForm.amount} onChange={(e) => setSinkingForm((prev) => ({ ...prev, amount: e.target.value }))} />
                </Field>
                <Field label="Mileage Km">
                  <Input type="number" min="0" value={sinkingForm.mileageKm} onChange={(e) => setSinkingForm((prev) => ({ ...prev, mileageKm: e.target.value }))} />
                </Field>
                <Field label="Reason">
                  <Input value={sinkingForm.reason} onChange={(e) => setSinkingForm((prev) => ({ ...prev, reason: e.target.value }))} />
                </Field>
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleLoadMyFund}
                  disabled={loadingState.myFund}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#111827] px-4 py-2.5 text-sm font-semibold text-white hover:bg-black disabled:opacity-60"
                >
                  {loadingState.myFund ? 'Loading...' : 'Load My Fund'}
                </button>
                <button
                  type="button"
                  onClick={handleLoadDriverFund}
                  disabled={loadingState.driverFund}
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                >
                  {loadingState.driverFund ? 'Loading...' : 'Load Driver Fund'}
                </button>
                <button
                  type="button"
                  onClick={handleLoadContributions}
                  disabled={loadingState.contributions}
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                >
                  {loadingState.contributions ? 'Loading...' : 'Contributions'}
                </button>
                {isAdmin && (
                  <>
                    <button
                      type="button"
                      onClick={handleLoadAllFunds}
                      disabled={loadingState.allFunds}
                      className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                    >
                      {loadingState.allFunds ? 'Loading...' : 'All Funds'}
                    </button>
                    <button
                      type="button"
                      onClick={handleLoadAlerts}
                      disabled={loadingState.alerts}
                      className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                    >
                      {loadingState.alerts ? 'Loading...' : 'Service Alerts'}
                    </button>
                    <button
                      type="button"
                      onClick={handleLoadAnalytics}
                      disabled={loadingState.analytics}
                      className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                    >
                      {loadingState.analytics ? 'Loading...' : 'Analytics'}
                    </button>
                  </>
                )}
              </div>
            </Section>

            <Section
              title="Sinking Fund Data"
              description="The latest payload returned by the backend."
              icon={FaChartLine}
            >
              <ResultBox value={sinkingResult || myFundResult} />
            </Section>
          </div>
        )}

        <div className="rounded-2xl border border-dashed border-orange-200 bg-white/70 p-4 text-sm text-gray-600">
          The backend already exposes these capabilities. This page simply surfaces them in the UI so the current frontend can reach them.
        </div>
      </div>
    </div>
  );
};

export default LogisticsOperations;
