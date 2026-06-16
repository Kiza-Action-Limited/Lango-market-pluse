'use strict';

/**
 * Google Maps Service for Lango MarketPulse
 * Handles geocoding, distance matrix, route optimization, and geofencing
 */

const axios = require('axios');
const logger = require('../../utils/logger');
const localGeocoder = require('./localGeocoder.service');

const mapsError = (message, statusCode = 503, code = 'MAPS_SERVICE_ERROR', details = {}) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  Object.assign(error, details);
  return error;
};

const googleMapsRemediation = (googleStatus) => {
  if (googleStatus === 'REQUEST_DENIED') {
    return 'Enable the Google Maps Platform project, confirm billing is active, enable the Geocoding API, and check API key restrictions.';
  }

  if (googleStatus === 'OVER_QUERY_LIMIT') {
    return 'Check Google Maps quota, billing, and project limits for the configured API key.';
  }

  return undefined;
};

const logMapsError = (operation, error) => {
  logger.error(`${operation} error: ${error.message}`, {
    code: error.code,
    statusCode: error.statusCode,
    googleStatus: error.googleStatus,
    axiosStatus: error.response?.status,
    axiosStatusText: error.response?.statusText,
  });
};

const getLocalGeocodeOrThrow = (address, error) => {
  const fallback = localGeocoder.geocodeAddress(address);
  if (fallback) {
    logger.warn('Using local geocoding fallback:', {
      formattedAddress: fallback.formattedAddress,
      reason: error?.code || error?.googleStatus || 'GOOGLE_MAPS_UNAVAILABLE',
    });
    return fallback;
  }

  throw error;
};

class GoogleMapsService {
  constructor() {
    this.apiKey = process.env.GOOGLE_MAPS_API_KEY;
    this.baseUrl = 'https://maps.googleapis.com/maps/api';
    
    if (!this.apiKey) {
      logger.warn('Google Maps API key not configured. Some features will be limited.');
    }
  }

  /**
   * Geocode an address to coordinates
   * @param {string} address - Full address string
   * @returns {Promise<{lat: number, lng: number, formattedAddress: string}>}
   */
  async geocodeAddress(address) {
    if (!this.apiKey) {
      return getLocalGeocodeOrThrow(address, mapsError(
        'Google Maps API key is not configured. Add GOOGLE_MAPS_API_KEY or enter GPS coordinates manually.',
        503,
        'GOOGLE_MAPS_API_KEY_MISSING'
      ));
    }

    try {
      const response = await axios.get(`${this.baseUrl}/geocode/json`, {
        params: {
          address: address,
          key: this.apiKey,
        },
      });

      if (response.data.status === 'OK' && response.data.results.length > 0) {
        const result = response.data.results[0];
        return {
          lat: result.geometry.location.lat,
          lng: result.geometry.location.lng,
          formattedAddress: result.formatted_address,
          placeId: result.place_id,
          viewport: result.geometry.viewport,
        };
      }

      const googleStatus = response.data.status || 'UNKNOWN';
      const googleMessage = response.data.error_message;
      const isConfigError = ['REQUEST_DENIED', 'OVER_QUERY_LIMIT'].includes(googleStatus);
      throw mapsError(
        googleMessage || `Geocoding failed: ${googleStatus}`,
        isConfigError ? 503 : 400,
        `GOOGLE_GEOCODING_${googleStatus}`,
        {
          googleStatus,
          remediation: googleMapsRemediation(googleStatus),
        }
      );
    } catch (error) {
      logMapsError('Geocoding', error);

      if (error.statusCode || error.googleStatus) {
        return getLocalGeocodeOrThrow(address, error);
      }

      return getLocalGeocodeOrThrow(address, mapsError(
        'Unable to reach Google Geocoding API.',
        503,
        'GOOGLE_GEOCODING_UNAVAILABLE',
        { axiosStatus: error.response?.status }
      ));
    }
  }

  /**
   * Reverse geocode coordinates to address
   * @param {number} lat - Latitude
   * @param {number} lng - Longitude
   * @returns {Promise<string>}
   */
  async reverseGeocode(lat, lng) {
    if (!this.apiKey) {
      throw new Error('Google Maps API key not configured');
    }

    try {
      const response = await axios.get(`${this.baseUrl}/geocode/json`, {
        params: {
          latlng: `${lat},${lng}`,
          key: this.apiKey,
        },
      });

      if (response.data.status === 'OK' && response.data.results.length > 0) {
        return response.data.results[0].formatted_address;
      }

      return null;
    } catch (error) {
      logMapsError('Reverse geocoding', error);
      return null;
    }
  }

  /**
   * Calculate distance and duration between two points
   * @param {Object} origin - {lat, lng} or address string
   * @param {Object} destination - {lat, lng} or address string
   * @param {string} mode - 'driving', 'walking', 'bicycling', 'transit'
   * @returns {Promise<{distance: number, duration: number, distanceText: string, durationText: string}>}
   */
  async calculateDistance(origin, destination, mode = 'driving') {
    if (!this.apiKey) {
      // Fallback to Haversine formula if no API key
      return this.calculateHaversineDistance(origin, destination);
    }

    try {
      const response = await axios.get(`${this.baseUrl}/distancematrix/json`, {
        params: {
          origins: this.formatLocationParam(origin),
          destinations: this.formatLocationParam(destination),
          mode: mode,
          key: this.apiKey,
          units: 'metric',
        },
      });

      if (response.data.status === 'OK') {
        const element = response.data.rows[0]?.elements[0];
        
        if (element.status === 'OK') {
          return {
            distance: element.distance.value / 1000, // Convert to km
            duration: element.duration.value / 60,    // Convert to minutes
            distanceText: element.distance.text,
            durationText: element.duration.text,
          };
        }
      }

      // Fallback to Haversine
      return this.calculateHaversineDistance(origin, destination);
    } catch (error) {
      logMapsError('Distance matrix', error);
      return this.calculateHaversineDistance(origin, destination);
    }
  }

  /**
   * Calculate delivery fee based on distance and cargo weight
   * @param {number} distanceKm - Distance in kilometers
   * @param {number} weightKg - Weight in kilograms
   * @param {boolean} isExpress - Express delivery flag
   * @returns {Object} {baseFee, distanceFee, weightFee, expressFee, total}
   */
  calculateDeliveryFee(distanceKm, weightKg = 1, isExpress = false) {
    const baseFee = 100; // KES base fee
    
    // Distance fee: 15 KES per km for first 50km, 10 KES after
    let distanceFee;
    if (distanceKm <= 50) {
      distanceFee = distanceKm * 15;
    } else {
      distanceFee = 50 * 15 + (distanceKm - 50) * 10;
    }
    
    // Weight fee: 30 KES per kg after first 5kg
    const weightFee = weightKg > 5 ? (weightKg - 5) * 30 : 0;
    
    // Express fee: +50% if isExpress
    let expressFee = 0;
    if (isExpress) {
      expressFee = (baseFee + distanceFee + weightFee) * 0.5;
    }
    
    const total = baseFee + distanceFee + weightFee + expressFee;
    
    return {
      baseFee,
      distanceFee,
      weightFee,
      expressFee,
      total: Math.round(total),
    };
  }

  /**
   * Optimize route for multiple stops
   * @param {Array} waypoints - Array of {location, type, orderId}
   * @param {Object} origin - Starting point
   * @param {Object} destination - Ending point
   * @returns {Promise<Array>} Optimized waypoint order
   */
  async optimizeRoute(waypoints, origin, destination) {
    if (!this.apiKey || waypoints.length < 2) {
      // Fallback to nearest neighbor algorithm
      return this.nearestNeighborOptimize(waypoints, origin, destination);
    }

    try {
      const waypointParams = waypoints
        .map(wp => this.formatLocationParam(wp.location))
        .join('|');

      const response = await axios.get(`${this.baseUrl}/directions/json`, {
        params: {
          origin: this.formatLocationParam(origin),
          destination: this.formatLocationParam(destination),
          waypoints: `optimize:true|${waypointParams}`,
          key: this.apiKey,
        },
      });

      if (response.data.status === 'OK') {
        const route = response.data.routes[0];
        const waypointOrder = route.waypoint_order;
        
        // Reorder waypoints based on optimized order
        const optimized = waypointOrder.map(index => waypoints[index]);
        return optimized;
      }
    } catch (error) {
      logMapsError('Route optimization', error);
    }

    return this.nearestNeighborOptimize(waypoints, origin, destination);
  }

  /**
   * Nearest neighbor algorithm for route optimization (fallback)
   */
  nearestNeighborOptimize(waypoints, origin, destination) {
    if (waypoints.length === 0) return [];
    if (waypoints.length === 1) return waypoints;

    const optimized = [waypoints[0]];
    let remaining = waypoints.slice(1);
    let current = waypoints[0].location;

    while (remaining.length > 0) {
      let nearestIndex = 0;
      let minDistance = Infinity;

      for (let i = 0; i < remaining.length; i++) {
        const dist = this.calculateHaversineDistanceSync(current, remaining[i].location);
        if (dist < minDistance) {
          minDistance = dist;
          nearestIndex = i;
        }
      }

      optimized.push(remaining[nearestIndex]);
      current = remaining[nearestIndex].location;
      remaining.splice(nearestIndex, 1);
    }

    return optimized;
  }

  /**
   * Check if a point is within geofence radius
   * @param {Object} point - {lat, lng}
   * @param {Object} center - {lat, lng}
   * @param {number} radiusMeters - Radius in meters (default 50)
   * @returns {boolean}
   */
  isWithinGeofence(point, center, radiusMeters = 50) {
    const distance = this.calculateHaversineDistanceSync(point, center);
    return distance * 1000 <= radiusMeters;
  }

  /**
   * Get ETA with traffic consideration
   * @param {Object} origin
   * @param {Object} destination
   * @param {Date} departureTime
   * @returns {Promise<Object>}
   */
  async getEtaWithTraffic(origin, destination, departureTime = new Date()) {
    if (!this.apiKey) {
      const distance = await this.calculateHaversineDistance(origin, destination);
      const avgSpeed = 30; // km/h average
      const duration = (distance.distance / avgSpeed) * 60;
      return { duration, eta: new Date(departureTime.getTime() + duration * 60000) };
    }

    try {
      const response = await axios.get(`${this.baseUrl}/distancematrix/json`, {
        params: {
          origins: this.formatLocationParam(origin),
          destinations: this.formatLocationParam(destination),
          mode: 'driving',
          departure_time: Math.floor(departureTime / 1000),
          key: this.apiKey,
        },
      });

      if (response.data.status === 'OK') {
        const element = response.data.rows[0]?.elements[0];
        if (element.status === 'OK') {
          const durationMinutes = element.duration_in_traffic.value / 60;
          return {
            duration: durationMinutes,
            durationText: element.duration_in_traffic.text,
            eta: new Date(departureTime.getTime() + durationMinutes * 60000),
          };
        }
      }
    } catch (error) {
      logMapsError('Traffic ETA', error);
    }

    // Fallback
    const distance = await this.calculateHaversineDistance(origin, destination);
    const avgSpeed = 25; // Slower average with traffic
    const duration = (distance.distance / avgSpeed) * 60;
    return { duration, eta: new Date(departureTime.getTime() + duration * 60000) };
  }

  /**
   * Validate delivery location against expected address
   * @param {Object} actualGps - {lat, lng} from driver's phone
   * @param {Object} expectedLocation - Address or {lat, lng}
   * @returns {Promise<{isValid: boolean, distanceMeters: number, message: string}>}
   */
  async validateDeliveryLocation(actualGps, expectedLocation) {
    let expectedCoords;

    if (typeof expectedLocation === 'string') {
      expectedCoords = await this.geocodeAddress(expectedLocation);
    } else if (expectedLocation.lat && expectedLocation.lng) {
      expectedCoords = expectedLocation;
    } else {
      return {
        isValid: false,
        distanceMeters: -1,
        message: 'Invalid expected location format',
      };
    }

    const distanceMeters = this.calculateHaversineDistanceSync(actualGps, expectedCoords) * 1000;
    const isValid = distanceMeters <= 50; // 50 meter radius as specified

    let message;
    if (isValid) {
      message = `Delivery location verified (${Math.round(distanceMeters)}m from expected)`;
    } else {
      message = `Delivery location is ${Math.round(distanceMeters)}m away from expected address. Must be within 50m.`;
    }

    return { isValid, distanceMeters, message };
  }

  /**
   * Format location for Google Maps API
   */
  formatLocationParam(location) {
    if (typeof location === 'string') {
      return encodeURIComponent(location);
    }
    if (location.lat && location.lng) {
      return `${location.lat},${location.lng}`;
    }
    return '';
  }

  /**
   * Calculate Haversine distance between two points (async wrapper)
   */
  async calculateHaversineDistance(point1, point2) {
    const distance = this.calculateHaversineDistanceSync(point1, point2);
    return { distance, duration: (distance / 30) * 60 };
  }

  /**
   * Calculate Haversine distance synchronously
   */
  calculateHaversineDistanceSync(point1, point2) {
    const toRad = (deg) => deg * (Math.PI / 180);
    
    const lat1 = point1.lat;
    const lon1 = point1.lng;
    const lat2 = point2.lat;
    const lon2 = point2.lng;
    
    const R = 6371; // Earth's radius in km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Get place autocomplete suggestions
   * @param {string} input - Partial address input
   * @returns {Promise<Array>}
   */
  async getPlaceAutocomplete(input) {
    if (!this.apiKey || !input || input.length < 3) {
      return [];
    }

    try {
      const response = await axios.get(`${this.baseUrl}/place/autocomplete/json`, {
        params: {
          input: input,
          key: this.apiKey,
          components: 'country:ke', // Restrict to Kenya
        },
      });

      if (response.data.status === 'OK') {
        return response.data.predictions.map(prediction => ({
          description: prediction.description,
          placeId: prediction.place_id,
          mainText: prediction.structured_formatting?.main_text,
          secondaryText: prediction.structured_formatting?.secondary_text,
        }));
      }
    } catch (error) {
      logMapsError('Autocomplete', error);
    }

    return [];
  }

  /**
   * Get place details by place ID
   * @param {string} placeId
   * @returns {Promise<Object>}
   */
  async getPlaceDetails(placeId) {
    if (!this.apiKey) {
      throw new Error('Google Maps API key not configured');
    }

    try {
      const response = await axios.get(`${this.baseUrl}/place/details/json`, {
        params: {
          place_id: placeId,
          key: this.apiKey,
          fields: 'name,formatted_address,geometry,vicinity,address_components',
        },
      });

      if (response.data.status === 'OK') {
        const result = response.data.result;
        return {
          name: result.name,
          formattedAddress: result.formatted_address,
          lat: result.geometry.location.lat,
          lng: result.geometry.location.lng,
          vicinity: result.vicinity,
          addressComponents: result.address_components,
        };
      }
    } catch (error) {
      logMapsError('Place details', error);
    }

    return null;
  }

  /**
   * Get snap to road for accurate GPS tracking
   * @param {Array} points - Array of {lat, lng}
   * @returns {Promise<Array>}
   */
  async snapToRoad(points) {
    if (!this.apiKey || points.length === 0) {
      return points;
    }

    try {
      const path = points.map(p => `${p.lat},${p.lng}`).join('|');
      const response = await axios.get(`${this.baseUrl}/roads/snapToRoads`, {
        params: {
          path: path,
          key: this.apiKey,
          interpolate: true,
        },
      });

      if (response.data.snappedPoints) {
        return response.data.snappedPoints.map(sp => ({
          lat: sp.location.latitude,
          lng: sp.location.longitude,
          placeId: sp.placeId,
          originalIndex: sp.originalIndex,
        }));
      }
    } catch (error) {
      logMapsError('Snap to road', error);
    }

    return points;
  }
}

module.exports = new GoogleMapsService();

