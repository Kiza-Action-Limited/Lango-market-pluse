import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { FaLayerGroup, FaMapMarkerAlt, FaMoneyBillWave, FaPlus, FaSyncAlt, FaTrash, FaTruck } from 'react-icons/fa';
import { logisticsService } from '../../services/logisticsService';
import { formatCurrency } from '../../utils/formatters';

const KENYA_ROUTES = [
  {
    id: 'eldoret-kitale',
    label: 'Eldoret to Kitale',
    originName: 'Eldoret',
    destinationName: 'Kitale',
    origin: { lat: 0.5143, lng: 35.2698 },
    destination: { lat: 1.0157, lng: 35.0062 },
    stops: ['Eldoret', 'Kitale'],
    cargoType: 'Northern Kenya corridor cargo',
  },
  {
    id: 'kitale-lodwar',
    label: 'Kitale to Lodwar',
    originName: 'Kitale',
    destinationName: 'Lodwar',
    origin: { lat: 1.0157, lng: 35.0062 },
    destination: { lat: 3.1191, lng: 35.5966 },
    stops: ['Kitale', 'Kapenguria', 'Lodwar'],
    cargoType: 'Northern Kenya corridor cargo',
  },
  {
    id: 'lodwar-kakuma',
    label: 'Lodwar to Kakuma',
    originName: 'Lodwar',
    destinationName: 'Kakuma',
    origin: { lat: 3.1191, lng: 35.5966 },
    destination: { lat: 3.7167, lng: 34.8667 },
    stops: ['Lodwar', 'Kakuma'],
    cargoType: 'Northern Kenya corridor cargo',
  },
  {
    id: 'kakuma-lokichoggio',
    label: 'Kakuma to Lokichoggio',
    originName: 'Kakuma',
    destinationName: 'Lokichoggio',
    origin: { lat: 3.7167, lng: 34.8667 },
    destination: { lat: 4.2041, lng: 34.3539 },
    stops: ['Kakuma', 'Lokichoggio'],
    cargoType: 'Northern Kenya corridor cargo',
  },
  {
    id: 'kakuma-lodwar',
    label: 'Kakuma to Lodwar',
    originName: 'Kakuma',
    destinationName: 'Lodwar',
    origin: { lat: 3.7167, lng: 34.8667 },
    destination: { lat: 3.1191, lng: 35.5966 },
    stops: ['Kakuma', 'Lodwar'],
    cargoType: 'Northern Kenya corridor cargo',
  },
  {
    id: 'lokichoggio-kakuma',
    label: 'Lokichoggio to Kakuma',
    originName: 'Lokichoggio',
    destinationName: 'Kakuma',
    origin: { lat: 4.2041, lng: 34.3539 },
    destination: { lat: 3.7167, lng: 34.8667 },
    stops: ['Lokichoggio', 'Kakuma'],
    cargoType: 'Northern Kenya corridor cargo',
  },
  {
    id: 'lodwar-lokichoggio',
    label: 'Lodwar to Lokichoggio',
    originName: 'Lodwar',
    destinationName: 'Lokichoggio',
    origin: { lat: 3.1191, lng: 35.5966 },
    destination: { lat: 4.2041, lng: 34.3539 },
    stops: ['Lodwar', 'Kakuma', 'Lokichoggio'],
    cargoType: 'Northern Kenya corridor cargo',
  },
  {
    id: 'lokichoggio-lodwar',
    label: 'Lokichoggio to Lodwar',
    originName: 'Lokichoggio',
    destinationName: 'Lodwar',
    origin: { lat: 4.2041, lng: 34.3539 },
    destination: { lat: 3.1191, lng: 35.5966 },
    stops: ['Lokichoggio', 'Kakuma', 'Lodwar'],
    cargoType: 'Northern Kenya corridor cargo',
  },
  {
    id: 'gt-001-nairobi-nakuru-eldoret',
    routeCode: 'GT-001',
    label: 'Nairobi to Nakuru to Eldoret',
    originName: 'Nairobi',
    destinationName: 'Eldoret',
    origin: { lat: -1.2921, lng: 36.8219 },
    destination: { lat: 0.5143, lng: 35.2698 },
    stops: ['Nairobi', 'Nakuru', 'Eldoret'],
    cargoType: 'Shared truck load',
  },
  {
    id: 'gt-002-nairobi-nakuru-kisumu',
    routeCode: 'GT-002',
    label: 'Nairobi to Nakuru to Kisumu',
    originName: 'Nairobi',
    destinationName: 'Kisumu',
    origin: { lat: -1.2921, lng: 36.8219 },
    destination: { lat: -0.0917, lng: 34.7680 },
    stops: ['Nairobi', 'Nakuru', 'Kisumu'],
    cargoType: 'Shared truck load',
  },
  {
    id: 'gt-003-nairobi-garissa',
    routeCode: 'GT-003',
    label: 'Nairobi to Garissa',
    originName: 'Nairobi',
    destinationName: 'Garissa',
    origin: { lat: -1.2921, lng: 36.8219 },
    destination: { lat: -0.4536, lng: 39.6401 },
    stops: ['Nairobi', 'Garissa'],
    cargoType: 'Shared truck load',
  },
  {
    id: 'gt-004-mombasa-malindi',
    routeCode: 'GT-004',
    label: 'Mombasa to Malindi',
    originName: 'Mombasa',
    destinationName: 'Malindi',
    origin: { lat: -4.0435, lng: 39.6682 },
    destination: { lat: -3.2192, lng: 40.1169 },
    stops: ['Mombasa', 'Malindi'],
    cargoType: 'Shared truck load',
  },
  {
    id: 'gt-005-kisumu-busia',
    routeCode: 'GT-005',
    label: 'Kisumu to Busia',
    originName: 'Kisumu',
    destinationName: 'Busia',
    origin: { lat: -0.0917, lng: 34.7680 },
    destination: { lat: 0.4608, lng: 34.1115 },
    stops: ['Kisumu', 'Busia'],
    cargoType: 'Shared truck load',
  },
  {
    id: 'gt-006-eldoret-kitale-lodwar',
    routeCode: 'GT-006',
    label: 'Eldoret to Kitale to Lodwar',
    originName: 'Eldoret',
    destinationName: 'Lodwar',
    origin: { lat: 0.5143, lng: 35.2698 },
    destination: { lat: 3.1191, lng: 35.5966 },
    stops: ['Eldoret', 'Kitale', 'Lodwar'],
    cargoType: 'Shared truck load',
  },
  {
    id: 'gt-007-lodwar-kakuma',
    routeCode: 'GT-007',
    label: 'Lodwar to Kakuma',
    originName: 'Lodwar',
    destinationName: 'Kakuma',
    origin: { lat: 3.1191, lng: 35.5966 },
    destination: { lat: 3.7167, lng: 34.8667 },
    stops: ['Lodwar', 'Kakuma'],
    cargoType: 'Shared truck load',
  },
  {
    id: 'gt-008-kakuma-lokichoggio',
    routeCode: 'GT-008',
    label: 'Kakuma to Lokichoggio',
    originName: 'Kakuma',
    destinationName: 'Lokichoggio',
    origin: { lat: 3.7167, lng: 34.8667 },
    destination: { lat: 4.2041, lng: 34.3539 },
    stops: ['Kakuma', 'Lokichoggio'],
    cargoType: 'Shared truck load',
  },
  {
    id: 'gt-009-nairobi-kitale-lodwar-kakuma',
    routeCode: 'GT-009',
    label: 'Nairobi to Kitale to Lodwar to Kakuma',
    originName: 'Nairobi',
    destinationName: 'Kakuma',
    origin: { lat: -1.2921, lng: 36.8219 },
    destination: { lat: 3.7167, lng: 34.8667 },
    stops: ['Nairobi', 'Kitale', 'Lodwar', 'Kakuma'],
    cargoType: 'Shared truck load',
  },
  {
    id: 'gt-010-nairobi-eldoret-lodwar-kakuma-lokichoggio',
    routeCode: 'GT-010',
    label: 'Nairobi to Eldoret to Lodwar to Kakuma to Lokichoggio',
    originName: 'Nairobi',
    destinationName: 'Lokichoggio',
    origin: { lat: -1.2921, lng: 36.8219 },
    destination: { lat: 4.2041, lng: 34.3539 },
    stops: ['Nairobi', 'Eldoret', 'Lodwar', 'Kakuma', 'Lokichoggio'],
    cargoType: 'Shared truck load',
  },
];

const DEFAULT_ROUTE = KENYA_ROUTES[0];

const formatDateTime = (value) => {
  if (!value) return 'Pending';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 'Pending' : parsed.toLocaleString();
};

const formatPoint = (point) => {
  if (!point) return 'GPS pending';
  return `${Number(point.lat).toFixed(4)}, ${Number(point.lng).toFixed(4)}`;
};

const getUserName = (user) => (
  user?.businessName ||
  user?.fullName ||
  user?.name ||
  'Seller'
);

const SharedGroupTripPanel = ({
  title = 'Kenya Shared Logistics',
  description = 'Join nearby buyers and sellers going the same direction so one logistics vehicle can carry everyone together.',
  className = '',
  canCreate = false,
  canManageRoutes = false,
  canManagePayments = false,
  allowParticipantPayments = false,
  showWorkflowGuide = true,
  joinOnly = false,
}) => {
  const [routes, setRoutes] = useState(KENYA_ROUTES);
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [routesLoading, setRoutesLoading] = useState(false);
  const [joiningTripId, setJoiningTripId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [savingRoute, setSavingRoute] = useState(false);
  const [deletingRouteId, setDeletingRouteId] = useState(null);
  const [weightByTrip, setWeightByTrip] = useState({});
  const [paymentByTrip, setPaymentByTrip] = useState({});
  const [payingTripId, setPayingTripId] = useState(null);
  const [selectedRouteId, setSelectedRouteId] = useState(DEFAULT_ROUTE.id);
  const [selectedTripId, setSelectedTripId] = useState('');
  const selectedRoute = routes.find((route) => (route.routeId || route.id) === selectedRouteId) || routes[0] || DEFAULT_ROUTE;
  const selectedTrip = trips.find((trip) => (trip.tripId || trip.id) === selectedTripId) || trips[0] || null;
  const [createForm, setCreateForm] = useState({
    originLat: DEFAULT_ROUTE.origin.lat,
    originLng: DEFAULT_ROUTE.origin.lng,
    destinationLat: DEFAULT_ROUTE.destination.lat,
    destinationLng: DEFAULT_ROUTE.destination.lng,
    maxCapacityKg: 3000,
    deadlineHours: 6,
    cargoType: DEFAULT_ROUTE.cargoType,
    notes: `Shared route for ${DEFAULT_ROUTE.label}.`,
  });
  const [routeForm, setRouteForm] = useState({
    routeCode: '',
    label: '',
    originName: '',
    destinationName: '',
    originLat: '',
    originLng: '',
    destinationLat: '',
    destinationLng: '',
    stops: '',
    cargoType: '',
  });

  const normalizeRoute = (route) => ({
    ...route,
    id: route.routeId || route.id,
  });

  const getParticipantId = (participant) => (
    participant?.user?._id ||
    participant?.user?.id ||
    participant?.user ||
    ''
  );

  const getPaymentDraft = (trip) => {
    const tripId = trip.tripId || trip.id;
    const firstParticipant = trip.participants?.[0];
    return {
      participantUserId: getParticipantId(firstParticipant),
      paymentStatus: canManagePayments ? 'paid' : 'pending',
      paymentMethod: 'mpesa',
      paymentReference: '',
      paymentPhone: '',
      amount: canManagePayments ? firstParticipant?.share || '' : trip.yourShare || '',
      notes: '',
      ...(paymentByTrip[tripId] || {}),
    };
  };

  const updatePaymentDraft = (tripId, patch) => {
    setPaymentByTrip((prev) => ({
      ...prev,
      [tripId]: {
        ...(prev[tripId] || {}),
        ...patch,
      },
    }));
  };

  const applyRoute = (routeId, sourceRoutes = routes) => {
    const route = sourceRoutes.find((item) => (item.routeId || item.id) === routeId) || sourceRoutes[0] || DEFAULT_ROUTE;
    setSelectedRouteId(route.routeId || route.id);
    setCreateForm((prev) => ({
      ...prev,
      originLat: route.origin.lat,
      originLng: route.origin.lng,
      destinationLat: route.destination.lat,
      destinationLng: route.destination.lng,
      cargoType: route.cargoType,
      notes: `Shared route for ${route.label}.`,
    }));
  };

  const loadRoutes = async ({ silent = false } = {}) => {
    if (!silent) setRoutesLoading(true);
    try {
      const response = await logisticsService.getGroupTripRoutes();
      const rows = Array.isArray(response) ? response : response?.data || [];
      const nextRoutes = rows.length ? rows.map(normalizeRoute) : KENYA_ROUTES;
      setRoutes(nextRoutes);
      if (!nextRoutes.some((route) => (route.routeId || route.id) === selectedRouteId)) {
        applyRoute(nextRoutes[0]?.routeId || nextRoutes[0]?.id, nextRoutes);
      }
    } catch (error) {
      console.error('Error loading group trip routes:', error);
      if (!silent) toast.error(error.response?.data?.message || 'Failed to load routes');
      setRoutes(KENYA_ROUTES);
    } finally {
      if (!silent) setRoutesLoading(false);
    }
  };

  const loadTrips = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const response = await logisticsService.getOpenGroupTrips({
        originLat: selectedRoute.origin.lat,
        originLng: selectedRoute.origin.lng,
        destinationLat: selectedRoute.destination.lat,
        destinationLng: selectedRoute.destination.lng,
        maxDistanceKm: 80,
        limit: 6,
      });
      const nextTrips = Array.isArray(response) ? response : response?.data || [];
      setTrips(nextTrips);
      setSelectedTripId((prev) => (
        nextTrips.some((trip) => (trip.tripId || trip.id) === prev)
          ? prev
          : nextTrips[0]?.tripId || nextTrips[0]?.id || ''
      ));
    } catch (error) {
      console.error('Error loading group trips:', error);
      if (!silent) toast.error(error.response?.data?.message || 'Failed to load shared logistics trips');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadRoutes({ silent: true });
  }, []);

  useEffect(() => {
    loadTrips({ silent: true });
  }, [selectedRouteId]);

  const joinTrip = async (tripId) => {
    const weightKg = Number(weightByTrip[tripId] || 25);
    if (!Number.isFinite(weightKg) || weightKg <= 0) {
      toast.error('Enter the cargo weight in kg');
      return;
    }

    setJoiningTripId(tripId);
    try {
      const result = await logisticsService.joinGroupTrip({ groupTripId: tripId, weightKg });
      toast.success(`Joined group trip. Your share: ${formatCurrency(result?.yourShare || 0)}`);
      await loadTrips({ silent: true });
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || 'Failed to join group trip');
    } finally {
      setJoiningTripId(null);
    }
  };

  const joinSelectedTrip = () => {
    const tripId = selectedTrip?.tripId || selectedTrip?.id;
    if (!tripId) {
      toast.error('Select an open group trip first');
      return;
    }
    joinTrip(tripId);
  };

  const createTrip = async (event) => {
    event.preventDefault();
    setCreating(true);
    try {
      const payload = {
        ...createForm,
        originLat: Number(createForm.originLat),
        originLng: Number(createForm.originLng),
        destinationLat: Number(createForm.destinationLat),
        destinationLng: Number(createForm.destinationLng),
        maxCapacityKg: Number(createForm.maxCapacityKg),
        deadlineHours: Number(createForm.deadlineHours),
        routeCode: selectedRoute.routeCode,
        routeLabel: selectedRoute.label,
        stops: selectedRoute.stops || [selectedRoute.originName, selectedRoute.destinationName].filter(Boolean),
      };
      await logisticsService.createGroupTrip(payload);
      toast.success(`${selectedRoute.label} shared logistics trip created`);
      await loadTrips({ silent: true });
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || 'Failed to create group trip');
    } finally {
      setCreating(false);
    }
  };

  const createRoute = async (event) => {
    event.preventDefault();
    setSavingRoute(true);
    try {
      await logisticsService.createGroupTripRoute({
        ...routeForm,
        originLat: Number(routeForm.originLat),
        originLng: Number(routeForm.originLng),
        destinationLat: Number(routeForm.destinationLat),
        destinationLng: Number(routeForm.destinationLng),
      });
      toast.success('Route added successfully');
      setRouteForm({
        routeCode: '',
        label: '',
        originName: '',
        destinationName: '',
        originLat: '',
        originLng: '',
        destinationLat: '',
        destinationLng: '',
        stops: '',
        cargoType: '',
      });
      await loadRoutes();
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || 'Failed to add route');
    } finally {
      setSavingRoute(false);
    }
  };

  const recordPayment = async (trip) => {
    const tripId = trip.tripId || trip.id;
    const draft = getPaymentDraft(trip);
    if (canManagePayments && !draft.participantUserId) {
      toast.error('Select a participant to update payment');
      return;
    }

    setPayingTripId(tripId);
    try {
      const result = await logisticsService.recordGroupTripPayment(tripId, {
        ...draft,
        amount: draft.amount ? Number(draft.amount) : undefined,
      });
      const updatedTrip = result?.groupTrip;
      if (updatedTrip) {
        setTrips((prev) => prev.map((item) => (
          (item.tripId || item.id) === tripId ? updatedTrip : item
        )));
      } else {
        await loadTrips({ silent: true });
      }
      updatePaymentDraft(tripId, { paymentReference: '', paymentPhone: '', notes: '' });
      toast.success(canManagePayments ? 'Group trip payment updated' : 'Payment marked as sent');
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || 'Failed to update group trip payment');
    } finally {
      setPayingTripId(null);
    }
  };

  const deleteRoute = async (route) => {
    const routeId = route.routeId || route.id;
    if (!routeId) return;
    if (!window.confirm(`Delete route "${route.label}"?`)) return;

    setDeletingRouteId(routeId);
    try {
      await logisticsService.deleteGroupTripRoute(routeId);
      toast.success('Route deleted');
      await loadRoutes();
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || 'Failed to delete route');
    } finally {
      setDeletingRouteId(null);
    }
  };

  return (
    <section className={`rounded-lg border border-gray-200 bg-white p-5 shadow-sm ${className}`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-[#F97316]">Group trip</p>
          <h3 className="mt-1 text-lg font-bold text-gray-950">{title}</h3>
          <p className="mt-1 max-w-3xl text-sm text-gray-600">{description}</p>
        </div>
        <button
          type="button"
          onClick={() => loadTrips()}
          disabled={loading}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-60"
        >
          <FaSyncAlt className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="mt-5 rounded-lg border border-gray-200 bg-gray-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="text-xs font-semibold uppercase text-gray-500">Choose Kenya route</label>
          {canManageRoutes && (
            <button
              type="button"
              onClick={() => loadRoutes()}
              disabled={routesLoading}
              className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            >
              <FaSyncAlt className={routesLoading ? 'animate-spin' : ''} />
              Routes
            </button>
          )}
        </div>
        <div className="mt-2 grid gap-3 lg:grid-cols-[1fr_auto]">
          <select
            value={selectedRouteId}
            onChange={(event) => applyRoute(event.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-900"
          >
            {routes.map((route) => (
              <option key={route.routeId || route.id} value={route.routeId || route.id}>
                {route.routeCode ? `${route.routeCode} - ` : ''}{route.label}
              </option>
            ))}
          </select>
          <div className="rounded-lg bg-white px-3 py-2 text-xs text-gray-600">
            <span className="font-semibold text-gray-900">{selectedRoute.originName}</span>
            {' to '}
            <span className="font-semibold text-gray-900">{selectedRoute.destinationName}</span>
          </div>
        </div>
        {canManageRoutes && (
          <div className="mt-3 flex flex-wrap gap-2">
            {routes.map((route) => {
              const routeId = route.routeId || route.id;
              return (
                <span key={`manage-${routeId}`} className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-700">
                  {route.routeCode ? `${route.routeCode} - ` : ''}{route.label}
                  <button
                    type="button"
                    onClick={() => deleteRoute(route)}
                    disabled={deletingRouteId === routeId}
                    className="text-red-600 hover:text-red-700 disabled:opacity-50"
                    title="Delete route"
                  >
                    <FaTrash />
                  </button>
                </span>
              );
            })}
          </div>
        )}
      </div>

      {showWorkflowGuide && (
        <div className="mt-5 grid gap-3 md:grid-cols-4">
          {[
            ['Buyer', 'Chooses pickup/delivery, selects route, gets ETA/cost, tracks live.'],
            ['Seller', 'Confirms stock, packages goods, hands over at pickup, uploads proof.'],
            ['Logistics', 'Accepts route cargo, updates checkpoints, confirms delivery by QR.'],
            ['Admin', 'Manages routes, assigns providers, monitors escrow and delivery performance.'],
          ].map(([role, copy]) => (
            <div key={role} className="rounded-lg border border-gray-200 bg-white p-3">
              <p className="text-xs font-semibold uppercase text-[#F97316]">{role}</p>
              <p className="mt-1 text-xs leading-5 text-gray-600">{copy}</p>
            </div>
          ))}
        </div>
      )}

      {canManageRoutes && (
        <form className="mt-5 rounded-lg border border-blue-100 bg-blue-50 p-4" onSubmit={createRoute}>
          <div className="mb-3">
            <p className="text-sm font-semibold text-blue-950">Add Kenya route</p>
            <p className="mt-1 text-xs text-blue-800">Admin-created routes appear immediately in buyer, seller, logistics, and admin dashboards.</p>
          </div>
          <div className="grid gap-3 lg:grid-cols-4">
            <input
              value={routeForm.routeCode}
              onChange={(event) => setRouteForm((prev) => ({ ...prev, routeCode: event.target.value }))}
              placeholder="Code e.g. GT-011"
              className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm"
            />
            <input
              value={routeForm.originName}
              onChange={(event) => setRouteForm((prev) => ({ ...prev, originName: event.target.value }))}
              placeholder="Origin e.g. Nairobi"
              className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm"
              required
            />
            <input
              value={routeForm.destinationName}
              onChange={(event) => setRouteForm((prev) => ({ ...prev, destinationName: event.target.value }))}
              placeholder="Destination e.g. Meru"
              className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm"
              required
            />
            <input
              value={routeForm.label}
              onChange={(event) => setRouteForm((prev) => ({ ...prev, label: event.target.value }))}
              placeholder="Route label"
              className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm"
            />
            <input
              value={routeForm.cargoType}
              onChange={(event) => setRouteForm((prev) => ({ ...prev, cargoType: event.target.value }))}
              placeholder="Cargo type"
              className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm"
            />
            <input
              value={routeForm.stops}
              onChange={(event) => setRouteForm((prev) => ({ ...prev, stops: event.target.value }))}
              placeholder="Stops comma-separated"
              className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm lg:col-span-2"
            />
            <input
              type="number"
              step="0.0001"
              value={routeForm.originLat}
              onChange={(event) => setRouteForm((prev) => ({ ...prev, originLat: event.target.value }))}
              placeholder="Origin lat"
              className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm"
              required
            />
            <input
              type="number"
              step="0.0001"
              value={routeForm.originLng}
              onChange={(event) => setRouteForm((prev) => ({ ...prev, originLng: event.target.value }))}
              placeholder="Origin lng"
              className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm"
              required
            />
            <input
              type="number"
              step="0.0001"
              value={routeForm.destinationLat}
              onChange={(event) => setRouteForm((prev) => ({ ...prev, destinationLat: event.target.value }))}
              placeholder="Destination lat"
              className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm"
              required
            />
            <input
              type="number"
              step="0.0001"
              value={routeForm.destinationLng}
              onChange={(event) => setRouteForm((prev) => ({ ...prev, destinationLng: event.target.value }))}
              placeholder="Destination lng"
              className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm"
              required
            />
          </div>
          <button
            type="submit"
            disabled={savingRoute}
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#0B2D55] px-4 py-2 text-sm font-semibold text-white hover:bg-[#123B6D] disabled:opacity-60"
          >
            <FaPlus />
            {savingRoute ? 'Saving route...' : 'Add route'}
          </button>
        </form>
      )}

      {canCreate && !joinOnly && (
        <form className="mt-5 grid gap-3 rounded-lg border border-orange-100 bg-orange-50 p-4 lg:grid-cols-6" onSubmit={createTrip}>
          <div className="lg:col-span-2">
            <label className="text-xs font-semibold uppercase text-orange-700">Cargo</label>
            <input
              value={createForm.cargoType}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, cargoType: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-orange-200 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-orange-700">Capacity kg</label>
            <input
              type="number"
              min="100"
              value={createForm.maxCapacityKg}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, maxCapacityKg: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-orange-200 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase text-orange-700">Deadline hours</label>
            <input
              type="number"
              min="1"
              max="24"
              value={createForm.deadlineHours}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, deadlineHours: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-orange-200 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div className="lg:col-span-2">
            <label className="text-xs font-semibold uppercase text-orange-700">Selected route</label>
            <p className="mt-2 text-sm font-semibold text-gray-900">{selectedRoute.routeCode ? `${selectedRoute.routeCode} - ` : ''}{selectedRoute.label}</p>
            <p className="text-xs text-gray-600">{formatPoint(selectedRoute.origin)} to {formatPoint(selectedRoute.destination)}</p>
            {Array.isArray(selectedRoute.stops) && selectedRoute.stops.length > 0 && (
              <p className="mt-1 text-xs text-orange-800">Stops: {selectedRoute.stops.join(' > ')}</p>
            )}
          </div>
          <div className="lg:col-span-6">
            <button
              type="submit"
              disabled={creating}
              className="inline-flex items-center gap-2 rounded-lg bg-[#F97316] px-4 py-2 text-sm font-semibold text-white hover:bg-[#EA580C] disabled:opacity-60"
            >
              <FaPlus />
              {creating ? 'Creating...' : 'Start selected route'}
            </button>
          </div>
        </form>
      )}

      {joinOnly && (
        <div className="mt-5 rounded-lg border border-green-100 bg-green-50 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 flex-1">
              <label className="text-xs font-semibold uppercase text-green-700">Available seller group trip</label>
              <select
                value={selectedTripId}
                onChange={(event) => setSelectedTripId(event.target.value)}
                disabled={loading || !trips.length}
                className="mt-1 w-full rounded-lg border border-green-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900 disabled:opacity-60"
              >
                {trips.length ? trips.map((trip) => {
                  const tripId = trip.tripId || trip.id;
                  return (
                    <option key={`choice-${tripId}`} value={tripId}>
                      {trip.routeCode ? `${trip.routeCode} - ` : ''}{trip.routeLabel || selectedRoute.label} - {trip.availableCapacityKg || 0} kg open
                      {trip.initiator ? ` - by ${getUserName(trip.initiator)}` : ''}
                    </option>
                  );
                }) : (
                  <option value="">No seller group trip open on this route</option>
                )}
              </select>
              {selectedTrip && (
                <p className="mt-2 text-xs text-green-800">
                  {selectedTrip.stops?.length ? selectedTrip.stops.join(' > ') : selectedRoute.stops?.join(' > ')}
                  {selectedTrip.initiator ? ` | Started by ${getUserName(selectedTrip.initiator)}` : ''}
                </p>
              )}
            </div>
            <div className="grid gap-2 sm:grid-cols-[140px_auto]">
              <input
                type="number"
                min="1"
                placeholder="Cargo kg"
                value={selectedTrip ? weightByTrip[selectedTrip.tripId || selectedTrip.id] || '' : ''}
                onChange={(event) => {
                  const tripId = selectedTrip?.tripId || selectedTrip?.id;
                  if (!tripId) return;
                  setWeightByTrip((prev) => ({ ...prev, [tripId]: event.target.value }));
                }}
                disabled={!selectedTrip || selectedTrip.joined}
                className="rounded-lg border border-green-200 bg-white px-3 py-2 text-sm disabled:opacity-60"
              />
              <button
                type="button"
                onClick={joinSelectedTrip}
                disabled={!selectedTrip || selectedTrip.joined || joiningTripId === (selectedTrip.tripId || selectedTrip.id)}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#0B2D55] px-4 py-2 text-sm font-semibold text-white hover:bg-[#123B6D] disabled:opacity-60"
              >
                <FaTruck />
                {selectedTrip?.joined ? 'Already joined' : joiningTripId === (selectedTrip?.tripId || selectedTrip?.id) ? 'Joining...' : 'Join selected trip'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        {trips.map((trip) => {
          const fill = Math.min(100, Number(trip.fillPercentage || 0));
          const tripId = trip.tripId || trip.id;
          const paymentDraft = getPaymentDraft(trip);
          const selectedParticipant = trip.participants?.find((participant) => String(getParticipantId(participant)) === String(paymentDraft.participantUserId));
          const showPaymentInfo = canManagePayments || allowParticipantPayments;
          const showPaymentControls = canManagePayments || (allowParticipantPayments && trip.joined);
          return (
            <article
              key={tripId}
              className={`rounded-lg border p-4 ${selectedTripId === tripId ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-gray-50'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-sm font-semibold text-gray-950">{trip.routeCode || selectedRoute.routeCode || tripId}</p>
                  <p className="mt-1 flex items-center gap-1 text-xs text-gray-600">
                    <FaMapMarkerAlt className="text-[#F97316]" />
                    {trip.routeLabel || selectedRoute.label}
                  </p>
                  {Array.isArray(trip.stops || selectedRoute.stops) && (trip.stops || selectedRoute.stops).length > 0 && (
                    <p className="mt-1 text-xs text-gray-500">{(trip.stops || selectedRoute.stops).join(' > ')}</p>
                  )}
                  {trip.initiator && (
                    <p className="mt-1 text-xs font-semibold text-gray-600">Started by {getUserName(trip.initiator)}</p>
                  )}
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-green-700">
                  {trip.joined ? 'Joined' : 'Open'}
                </span>
              </div>

              <div className="mt-4 space-y-3">
                <div>
                  <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
                    <span>Capacity</span>
                    <span>{trip.currentCapacityKg || 0}/{trip.maxCapacityKg || 0} kg</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white">
                    <div className="h-full rounded-full bg-[#16A34A]" style={{ width: `${fill}%` }} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-md bg-white p-2">
                    <p className="text-gray-500">Base fare</p>
                    <p className="font-semibold text-gray-950">{formatCurrency(trip.baseFare || 0)}</p>
                  </div>
                  <div className="rounded-md bg-white p-2">
                    <p className="text-gray-500">People</p>
                    <p className="font-semibold text-gray-950">{trip.participantCount || 0}</p>
                  </div>
                  <div className="rounded-md bg-white p-2">
                    <p className="text-gray-500">Deadline</p>
                    <p className="font-semibold text-gray-950">{formatDateTime(trip.deadline)}</p>
                  </div>
                  <div className="rounded-md bg-white p-2">
                    <p className="text-gray-500">Available</p>
                    <p className="font-semibold text-gray-950">{trip.availableCapacityKg || 0} kg</p>
                  </div>
                  {showPaymentInfo && (
                    <>
                      <div className="rounded-md bg-white p-2">
                        <p className="text-gray-500">Paid</p>
                        <p className="font-semibold text-green-700">{formatCurrency(trip.paymentSummary?.paid || 0)}</p>
                      </div>
                      <div className="rounded-md bg-white p-2">
                        <p className="text-gray-500">Pending</p>
                        <p className="font-semibold text-amber-700">{formatCurrency(trip.paymentSummary?.pending || 0)}</p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {showPaymentControls && (
                <div className="mt-4 rounded-lg border border-emerald-100 bg-white p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase text-emerald-700">
                      <FaMoneyBillWave />
                      Logistics payment
                    </p>
                    <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                      {canManagePayments ? (selectedParticipant?.paymentStatus || 'unpaid') : (trip.yourPaymentStatus || 'unpaid')}
                    </span>
                  </div>
                  {canManagePayments && (
                    <select
                      value={paymentDraft.participantUserId}
                      onChange={(event) => {
                        const nextParticipant = trip.participants?.find((participant) => String(getParticipantId(participant)) === event.target.value);
                        updatePaymentDraft(tripId, {
                          participantUserId: event.target.value,
                          amount: nextParticipant?.share || '',
                          paymentStatus: nextParticipant?.paymentStatus || 'paid',
                        });
                      }}
                      className="mb-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800"
                    >
                      {(trip.participants || []).map((participant) => {
                        const participantId = getParticipantId(participant);
                        return (
                          <option key={`${tripId}-${participantId}`} value={participantId}>
                            {getUserName(participant.user)} - {formatCurrency(participant.share || 0)} - {participant.paymentStatus || 'unpaid'}
                          </option>
                        );
                      })}
                    </select>
                  )}
                  <div className="grid gap-2 sm:grid-cols-2">
                    {canManagePayments && (
                      <select
                        value={paymentDraft.paymentStatus}
                        onChange={(event) => updatePaymentDraft(tripId, { paymentStatus: event.target.value })}
                        className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs"
                      >
                        <option value="paid">Paid</option>
                        <option value="pending">Pending</option>
                        <option value="unpaid">Unpaid</option>
                        <option value="failed">Failed</option>
                        <option value="refunded">Refunded</option>
                      </select>
                    )}
                    <select
                      value={paymentDraft.paymentMethod}
                      onChange={(event) => updatePaymentDraft(tripId, { paymentMethod: event.target.value })}
                      className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs"
                    >
                      <option value="mpesa">M-Pesa</option>
                      <option value="cash">Cash</option>
                      <option value="wallet">Wallet</option>
                      <option value="bank_transfer">Bank transfer</option>
                      <option value="card">Card</option>
                    </select>
                    <input
                      value={paymentDraft.amount}
                      onChange={(event) => updatePaymentDraft(tripId, { amount: event.target.value })}
                      placeholder="Amount"
                      type="number"
                      min="0"
                      className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs"
                    />
                    <input
                      value={paymentDraft.paymentReference}
                      onChange={(event) => updatePaymentDraft(tripId, { paymentReference: event.target.value })}
                      placeholder="M-Pesa receipt/reference"
                      className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs"
                    />
                    <input
                      value={paymentDraft.paymentPhone}
                      onChange={(event) => updatePaymentDraft(tripId, { paymentPhone: event.target.value })}
                      placeholder="Phone number"
                      className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs sm:col-span-2"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => recordPayment(trip)}
                    disabled={payingTripId === tripId}
                    className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#16A34A] px-3 py-2 text-xs font-semibold text-white hover:bg-[#15803D] disabled:opacity-60"
                  >
                    <FaMoneyBillWave />
                    {payingTripId === tripId
                      ? 'Saving payment...'
                      : canManagePayments ? 'Update logistics payment' : 'Mark payment sent'}
                  </button>
                </div>
              )}

              <div className="mt-4 flex gap-2">
                <input
                  type="number"
                  min="1"
                  placeholder="Kg"
                  value={weightByTrip[tripId] || ''}
                  onChange={(event) => setWeightByTrip((prev) => ({ ...prev, [tripId]: event.target.value }))}
                  className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                  disabled={trip.joined}
                />
                <button
                  type="button"
                  onClick={() => joinTrip(tripId)}
                  disabled={trip.joined || joiningTripId === tripId}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#0B2D55] px-3 py-2 text-sm font-semibold text-white hover:bg-[#123B6D] disabled:opacity-60"
                >
                  <FaTruck />
                  {trip.joined ? 'Joined' : joiningTripId === tripId ? 'Joining' : 'Join'}
                </button>
              </div>
            </article>
          );
        })}

        {!trips.length && (
          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center xl:col-span-3">
            <FaLayerGroup className="mx-auto text-3xl text-[#F97316]" />
            <h4 className="mt-3 font-semibold text-gray-950">{joinOnly ? 'No seller group trip open' : 'No open trips on this route yet'}</h4>
            <p className="mt-1 text-sm text-gray-600">
              {joinOnly
                ? 'Choose another route or wait for a seller to start a shared truck load.'
                : 'Start a trip or choose another Kenya route to find buyers and sellers ready to share logistics.'}
            </p>
          </div>
        )}
      </div>
    </section>
  );
};

export default SharedGroupTripPanel;
