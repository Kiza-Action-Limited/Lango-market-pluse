import { PLAN_IDS } from '../config/subscriptionPlans';

const STORAGE_KEY = 'marketpulse_seller_logistics_addons';

export const HUB_COORDINATES = {
  nairobi: { lat: -1.286389, lng: 36.817223 },
  mombasa: { lat: -4.043477, lng: 39.668206 },
  kisumu: { lat: -0.091702, lng: 34.767956 },
  nakuru: { lat: -0.303099, lng: 36.080025 },
  eldoret: { lat: 0.514277, lng: 35.269779 },
  thika: { lat: -1.03326, lng: 37.06933 },
  machakos: { lat: -1.517683, lng: 37.263414 },
  nyeri: { lat: -0.42013, lng: 36.94759 },
  meru: { lat: 0.04626, lng: 37.65587 },
  kitale: { lat: 1.01572, lng: 35.00622 },
  kakamega: { lat: 0.28273, lng: 34.75187 },
  lira: { lat: 2.2499, lng: 32.8998 },
  kampala: { lat: 0.347596, lng: 32.58252 },
};

const parseStore = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch (error) {
    return {};
  }
};

const saveStore = (store) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
};

const userKey = (user) => String(user?._id || user?.id || user?.email || 'guest');

export const getSellerLogisticsAddon = (user) => {
  const store = parseStore();
  return store[userKey(user)] || {
    active: false,
    planId: PLAN_IDS.MIZIGO,
    selectedProviderId: '',
    selectedProvider: null,
    sellerHub: user?.locationHub || user?.campus || user?.city || '',
    activatedAt: null,
  };
};

export const saveSellerLogisticsAddon = (user, addon) => {
  const store = parseStore();
  store[userKey(user)] = {
    ...getSellerLogisticsAddon(user),
    ...addon,
    planId: PLAN_IDS.MIZIGO,
  };
  saveStore(store);
  return store[userKey(user)];
};

export const activateSellerLogisticsAddon = (user, payload = {}) =>
  saveSellerLogisticsAddon(user, {
    active: true,
    activatedAt: new Date().toISOString(),
    ...payload,
  });

export const deactivateSellerLogisticsAddon = (user) =>
  saveSellerLogisticsAddon(user, {
    active: false,
    selectedProviderId: '',
    selectedProvider: null,
  });

const normalizeKey = (value) => String(value || '').trim().toLowerCase();

export const getHubCoordinates = (value) => {
  if (!value) return null;
  if (typeof value === 'object') {
    const lat = Number(value.lat ?? value.latitude);
    const lng = Number(value.lng ?? value.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }
  return HUB_COORDINATES[normalizeKey(value)] || null;
};

export const calculateDistanceKm = (origin, destination) => {
  const from = getHubCoordinates(origin);
  const to = getHubCoordinates(destination);
  if (!from || !to) return null;

  const earthKm = 6371;
  const dLat = ((to.lat - from.lat) * Math.PI) / 180;
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(earthKm * c);
};

export const normalizeProvider = (provider) => {
  const profile = provider?.logisticsProfile || provider?.profile || {};
  const id = provider?._id || provider?.id || provider?.userId || profile?._id || profile?.id;
  const hub =
    profile.baseHub ||
    profile.locationHub ||
    profile.city ||
    provider.locationHub ||
    provider.city ||
    provider.campus ||
    '';
  const coordinates =
    profile.coordinates ||
    profile.baseCoordinates ||
    provider.coordinates ||
    provider.location ||
    null;

  return {
    id,
    name: provider.fullName || provider.name || provider.businessName || provider.companyName || 'Registered logistics provider',
    phone: provider.phone || profile.phone || '',
    email: provider.email || '',
    hub,
    coordinates,
    driverMode: profile.driverMode || provider.driverMode || '',
    vehiclePlate: profile.vehiclePlate || provider.vehiclePlate || '',
    cargoCapacityKg: profile.cargoCapacityKg || provider.cargoCapacityKg || '',
    verificationStatus: profile.verificationStatus || provider.verificationStatus || provider.status || 'verified',
    raw: provider,
  };
};

export const rankProvidersByDistance = (providers = [], sellerHub = '') =>
  providers
    .map((provider) => {
      const normalized = normalizeProvider(provider);
      const distanceKm = calculateDistanceKm(sellerHub, normalized.coordinates || normalized.hub);
      return { ...normalized, distanceKm };
    })
    .filter((provider) => provider.id && String(provider.verificationStatus).toLowerCase() === 'verified')
    .sort((a, b) => {
      if (a.distanceKm === null && b.distanceKm === null) return a.name.localeCompare(b.name);
      if (a.distanceKm === null) return 1;
      if (b.distanceKm === null) return -1;
      return a.distanceKm - b.distanceKm;
    });
