const randomId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
};

export const normalizeKenyanMpesaPhone = (phoneNumber) => {
  let normalized = String(phoneNumber || '').trim().replace(/\D/g, '');

  if (normalized.startsWith('0')) {
    normalized = `254${normalized.slice(1)}`;
  } else if (/^[71]\d{8}$/.test(normalized)) {
    normalized = `254${normalized}`;
  }

  if (!/^254[71]\d{8}$/.test(normalized)) {
    throw new Error('Enter a valid Kenya M-Pesa number, for example 0712345678 or 254712345678.');
  }

  return normalized;
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
