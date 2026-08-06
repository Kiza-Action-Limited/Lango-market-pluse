const DEFAULT_GPS_STALE_MINUTES = 30;

const TRUST_GPS_STALE_MS = Number(process.env.TRUST_GPS_STALE_MINUTES || DEFAULT_GPS_STALE_MINUTES) * 60 * 1000;

const getId = (value) => value?._id?.toString?.() || value?.toString?.();

const toDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getCoordinatePair = (source = {}) => {
  const lat = Number(source.lat ?? source.gpsLat ?? source.latitude);
  const lng = Number(source.lng ?? source.gpsLng ?? source.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
};

const getVerifiedQrScan = (logistics, step) => (
  (Array.isArray(logistics?.qrScans) ? logistics.qrScans : [])
    .find((scan) => scan.step === step && scan.verified !== false)
);

const hasVerifiedQrScan = (logistics, step) => Boolean(getVerifiedQrScan(logistics, step));

const getPickupTime = (logistics) => (
  toDate(getVerifiedQrScan(logistics, 'pickup')?.scannedAt)
  || toDate(logistics?.pickupQrScannedAt)
  || toDate(logistics?.pickupTime)
);

const getDeliveryGps = (logistics) => (
  getCoordinatePair(getVerifiedQrScan(logistics, 'delivery')?.gpsCoords)
  || getCoordinatePair(logistics?.gpsTracking?.current)
);

const getLastGpsUpdate = (logistics) => {
  const currentDate = toDate(logistics?.gpsTracking?.current?.lastUpdate);
  const history = Array.isArray(logistics?.gpsTracking?.history) ? logistics.gpsTracking.history : [];
  const historyDate = history
    .map((entry) => toDate(entry.timestamp))
    .filter(Boolean)
    .sort((a, b) => b.getTime() - a.getTime())[0];
  return currentDate || historyDate || null;
};

const hasGpsAfterPickup = (logistics) => {
  const pickupAt = getPickupTime(logistics);
  const history = Array.isArray(logistics?.gpsTracking?.history) ? logistics.gpsTracking.history : [];
  if (!pickupAt) return history.length > 0 || Boolean(getCoordinatePair(logistics?.gpsTracking?.current));

  return history.some((entry) => {
    const timestamp = toDate(entry.timestamp);
    return timestamp && timestamp.getTime() >= pickupAt.getTime();
  }) || Boolean(getCoordinatePair(logistics?.gpsTracking?.current));
};

const isVerifiedLogisticsUser = (driver) => {
  if (!driver) return false;
  const role = String(driver.role || '').toLowerCase();
  const profileStatus = String(driver.logisticsProfile?.verificationStatus || '').toLowerCase();
  const accountStatus = String(driver.verificationStatus || '').toLowerCase();
  return role === 'logistics' && (profileStatus === 'verified' || ['verified', 'gold'].includes(accountStatus));
};

const needsLiveGps = (status) => [
  'picked_up',
  'in_transit',
  'out_for_delivery',
  'IN_TRANSIT',
].includes(status);

const buildTrustChecks = ({ order, logistics, escrow, now = new Date() } = {}) => {
  const rawLogistics = logistics?.toObject ? logistics.toObject({ virtuals: true }) : logistics;
  const pickupConfirmed = hasVerifiedQrScan(rawLogistics, 'pickup') || Boolean(rawLogistics?.pickupQrConfirmed);
  const deliveryConfirmed = hasVerifiedQrScan(rawLogistics, 'delivery') || Boolean(rawLogistics?.deliveryQrConfirmed);
  const deliveryGps = getDeliveryGps(rawLogistics);
  const lastGpsUpdate = getLastGpsUpdate(rawLogistics);
  const gpsStale = Boolean(
    rawLogistics &&
    needsLiveGps(rawLogistics.status) &&
    (!lastGpsUpdate || now.getTime() - lastGpsUpdate.getTime() > TRUST_GPS_STALE_MS)
  );
  const driverVerified = rawLogistics?.driver ? isVerifiedLogisticsUser(rawLogistics.driver) : false;
  const logisticsRequired = Boolean(rawLogistics || order?.logisticsFee || escrow?.logistics);

  const checks = [
    {
      key: 'verified_logistics',
      label: 'Verified logistics assigned',
      passed: !rawLogistics || driverVerified,
      blocking: Boolean(rawLogistics),
    },
    {
      key: 'pickup_qr',
      label: 'Pickup QR confirmed',
      passed: !logisticsRequired || pickupConfirmed,
      blocking: logisticsRequired,
    },
    {
      key: 'live_gps_after_pickup',
      label: 'Live GPS recorded after pickup',
      passed: !logisticsRequired || hasGpsAfterPickup(rawLogistics),
      blocking: logisticsRequired,
    },
    {
      key: 'delivery_qr',
      label: 'Delivery QR confirmed',
      passed: !logisticsRequired || deliveryConfirmed,
      blocking: logisticsRequired,
    },
    {
      key: 'delivery_gps',
      label: 'Delivery GPS proof recorded',
      passed: !logisticsRequired || Boolean(deliveryGps),
      blocking: logisticsRequired,
    },
    {
      key: 'gps_freshness',
      label: `GPS fresh within ${Number(process.env.TRUST_GPS_STALE_MINUTES || DEFAULT_GPS_STALE_MINUTES)} minutes while in transit`,
      passed: !gpsStale,
      blocking: false,
    },
  ];

  return {
    checks,
    releaseReady: checks.every((check) => !check.blocking || check.passed),
    riskCount: checks.filter((check) => !check.passed).length,
    blockingRiskCount: checks.filter((check) => check.blocking && !check.passed).length,
    gpsStale,
    lastGpsUpdate,
    pickupConfirmed,
    deliveryConfirmed,
    deliveryGps,
    driverVerified,
  };
};

const assertTrustedRelease = ({ order, logistics, escrow, forceRelease = false } = {}) => {
  const trust = buildTrustChecks({ order, logistics, escrow });
  if (forceRelease || trust.releaseReady) return trust;

  const blockingChecks = trust.checks.filter((check) => check.blocking && !check.passed);
  const error = new Error(`Escrow release blocked until trusted handoff proof is complete: ${blockingChecks.map((check) => check.label).join(', ')}`);
  error.statusCode = 409;
  error.code = 'TRUST_PROOF_REQUIRED';
  error.trust = trust;
  throw error;
};

module.exports = {
  TRUST_GPS_STALE_MS,
  buildTrustChecks,
  assertTrustedRelease,
  getCoordinatePair,
  getVerifiedQrScan,
  hasVerifiedQrScan,
  getLastGpsUpdate,
  isVerifiedLogisticsUser,
};
