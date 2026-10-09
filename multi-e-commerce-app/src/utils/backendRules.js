const randomId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const values = new Uint32Array(2);
    crypto.getRandomValues(values);
    return `${Date.now()}-${Array.from(values, (value) => value.toString(36)).join('')}`;
  }
  return `${Date.now()}`;
};

export const requireOrderReference = (orderId) => {
  const value = String(orderId || '').trim();
  if (!value) throw new Error('Order ID or order number is required.');
  return value;
};

export const requireMongoId = (value, label = 'ID') => {
  const normalized = String(value || '').trim();
  if (!/^[a-f\d]{24}$/i.test(normalized)) {
    throw new Error(`${label} must be a valid backend record ID.`);
  }
  return normalized;
};

export const requirePositiveAmount = (amount, minimum = 1, label = 'Amount') => {
  const value = Number(amount);
  if (!Number.isFinite(value) || value < minimum) {
    throw new Error(`${label} must be at least KES ${minimum}.`);
  }
  return value;
};

export const requireGpsCoords = (gpsCoords) => {
  const lat = Number(gpsCoords?.lat);
  const lng = Number(gpsCoords?.lng);

  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
    throw new Error('GPS coordinates are required before this backend action can continue.');
  }

  return {
    ...gpsCoords,
    lat,
    lng,
  };
};

export const getBrowserGpsCoords = () => new Promise((resolve, reject) => {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    reject(new Error('GPS is not available on this device or browser.'));
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => resolve({
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy,
      speed: position.coords.speed,
      heading: position.coords.heading,
    }),
    () => reject(new Error('Please allow location access before scanning this QR code.')),
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
  );
});

export const resolveGpsCoords = async (gpsCoords) => {
  if (gpsCoords?.lat && gpsCoords?.lng) return requireGpsCoords(gpsCoords);
  return requireGpsCoords(await getBrowserGpsCoords());
};

export const requireQrToken = (token) => {
  const value = String(token || '').trim();
  if (!value) throw new Error('A QR token is required.');
  return value;
};

export const createIdempotencyHeaders = (scope = 'frontend') => ({
  'Idempotency-Key': `${scope}-${randomId()}`,
});

export const withIdempotency = (scope, config = {}) => ({
  ...config,
  headers: {
    ...(config.headers || {}),
    ...createIdempotencyHeaders(scope),
  },
});
