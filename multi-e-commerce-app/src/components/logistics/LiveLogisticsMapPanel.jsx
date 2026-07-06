import React from 'react';
import { Link } from 'react-router-dom';
import { FaExternalLinkAlt, FaMapMarkerAlt, FaRoute, FaSyncAlt, FaTruck } from 'react-icons/fa';

const hasCoordinatePair = (coords) => (
  Number.isFinite(Number(coords?.lat ?? coords?.gpsLat)) &&
  Number.isFinite(Number(coords?.lng ?? coords?.gpsLng))
);

const normalizeCoords = (coords) => {
  if (!hasCoordinatePair(coords)) return null;
  return {
    lat: Number(coords.lat ?? coords.gpsLat),
    lng: Number(coords.lng ?? coords.gpsLng),
    lastUpdate: coords.lastUpdate || coords.updatedAt || coords.timestamp,
  };
};

const buildGoogleMapsSearchUrl = (coords) => {
  const point = normalizeCoords(coords);
  return point ? `https://www.google.com/maps/search/?api=1&query=${point.lat},${point.lng}` : null;
};

const buildGoogleMapsEmbedUrl = (coords) => {
  const point = normalizeCoords(coords);
  return point ? `https://maps.google.com/maps?q=${point.lat},${point.lng}&z=13&output=embed` : null;
};

const formatDateTime = (value) => {
  if (!value) return 'Pending';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 'Pending' : parsed.toLocaleString();
};

const readName = (value, fallback = 'Assigned partner') => (
  value?.businessName ||
  value?.fullName ||
  value?.name ||
  value?.email ||
  fallback
);

const LiveLogisticsMapPanel = ({
  trip,
  tracking,
  order,
  title = 'Live Delivery Map',
  subtitle = 'Track logistics movement from pickup to buyer delivery.',
  eyebrow = 'Google GPS tracking',
  onRefresh,
  refreshing = false,
  trackingHref,
  emptyText = 'Live GPS appears after logistics starts sharing location.',
  className = '',
}) => {
  const liveTracking = tracking?.liveTracking || trip?.liveTracking || {};
  const driverCoords = normalizeCoords(
    liveTracking.driver ||
    trip?.gpsTracking?.current ||
    trip?.driver?.logisticsProfile?.currentLocation
  );
  const pickupCoords = normalizeCoords(liveTracking.pickup || trip?.pickupAddress);
  const deliveryCoords = normalizeCoords(liveTracking.delivery || trip?.shippingAddress || order?.shippingAddress);
  const mapEmbedUrl = liveTracking.embedUrl || buildGoogleMapsEmbedUrl(driverCoords) || buildGoogleMapsEmbedUrl(deliveryCoords) || buildGoogleMapsEmbedUrl(pickupCoords);
  const mapOpenUrl = liveTracking.googleMapsUrl || buildGoogleMapsSearchUrl(driverCoords) || buildGoogleMapsSearchUrl(deliveryCoords) || buildGoogleMapsSearchUrl(pickupCoords);
  const isLive = Boolean(driverCoords);
  const lastUpdate = liveTracking.lastUpdate || driverCoords?.lastUpdate || trip?.updatedAt || order?.updatedAt;
  const orderLabel = trip?.orderNumber || trip?.order?.orderNumber || order?.orderNumber || (order?.id ? `#${String(order.id).slice(-8)}` : 'No active order');
  const driverName = trip?.driverName || readName(trip?.driver, 'Not assigned yet');

  return (
    <section className={`rounded-lg border border-gray-200 bg-white p-5 shadow-sm ${className}`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-[#16A34A]">{eyebrow}</p>
          <h3 className="mt-1 text-lg font-bold text-gray-950">{title}</h3>
          <p className="mt-1 text-sm text-gray-600">{subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#16A34A] bg-white px-3 text-sm font-semibold text-[#15803D] hover:bg-green-50 disabled:opacity-60"
            >
              <FaSyncAlt className={refreshing ? 'animate-spin' : ''} />
              {refreshing ? 'Refreshing' : 'Refresh GPS'}
            </button>
          )}
          {trackingHref && (
            <Link
              to={trackingHref}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-800 hover:bg-gray-50"
            >
              <FaTruck />
              Open tracking
            </Link>
          )}
          {mapOpenUrl && (
            <a
              href={mapOpenUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#0B2D55] px-3 text-sm font-semibold text-white hover:bg-[#123B6D]"
            >
              <FaExternalLinkAlt />
              Google Maps
            </a>
          )}
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
          {mapEmbedUrl ? (
            <iframe
              title="Live logistics GPS Google map"
              src={mapEmbedUrl}
              className="h-80 w-full"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          ) : (
            <div className="flex h-80 items-center justify-center p-6 text-center">
              <div>
                <FaRoute className="mx-auto text-3xl text-[#F97316]" />
                <h4 className="mt-3 font-semibold text-gray-950">GPS map pending</h4>
                <p className="mt-1 text-sm text-gray-600">{emptyText}</p>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className={`rounded-lg border p-4 ${isLive ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
            <p className={`text-xs font-semibold uppercase ${isLive ? 'text-green-700' : 'text-amber-700'}`}>
              {isLive ? 'Live GPS active' : 'Waiting for live GPS'}
            </p>
            <p className="mt-1 text-sm text-gray-700">
              {isLive ? 'Driver location is available for this delivery.' : emptyText}
            </p>
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <p className="text-xs font-semibold uppercase text-gray-500">Order</p>
            <p className="mt-1 font-semibold text-gray-950">{orderLabel}</p>
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <p className="text-xs font-semibold uppercase text-gray-500">Driver</p>
            <p className="mt-1 font-semibold text-gray-950">{driverName}</p>
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <p className="text-xs font-semibold uppercase text-gray-500">Current GPS</p>
            <p className="mt-1 font-semibold text-gray-950">
              {driverCoords ? `${driverCoords.lat}, ${driverCoords.lng}` : 'Not shared yet'}
            </p>
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <p className="text-xs font-semibold uppercase text-gray-500">Last update</p>
            <p className="mt-1 font-semibold text-gray-950">{formatDateTime(lastUpdate)}</p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default LiveLogisticsMapPanel;
