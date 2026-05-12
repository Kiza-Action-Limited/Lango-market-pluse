const turf = require('@turf/turf');

/**
 * Check if a point is within a circular geofence
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {Object} fence - { center: { lat, lng }, radiusKm }
 * @returns {boolean}
 */
const isWithinCircle = (lat, lng, fence) => {
  const point = turf.point([lng, lat]);
  const center = turf.point([fence.center.lng, fence.center.lat]);
  const distance = turf.distance(point, center, { units: 'kilometers' });
  return distance <= fence.radiusKm;
};

/**
 * Check if a point is within a polygon geofence
 * @param {number} lat
 * @param {number} lng
 * @param {Array} polygonPoints - Array of [lng, lat] coordinates
 * @returns {boolean}
 */
const isWithinPolygon = (lat, lng, polygonPoints) => {
  const point = turf.point([lng, lat]);
  const polygon = turf.polygon([polygonPoints]);
  return turf.booleanPointInPolygon(point, polygon);
};

/**
 * Calculate distance between two GPS points (km)
 */
const distanceBetween = (lat1, lng1, lat2, lng2) => {
  const from = turf.point([lng1, lat1]);
  const to = turf.point([lng2, lat2]);
  return turf.distance(from, to, { units: 'kilometers' });
};

/**
 * Validate Kenyan GPS boundaries (rough bounding box)
 */
const isWithinKenya = (lat, lng) => {
  return lat >= -4.5 && lat <= 5.0 && lng >= 33.5 && lng <= 42.0;
};

module.exports = {
  isWithinCircle,
  isWithinPolygon,
  distanceBetween,
  isWithinKenya,
};