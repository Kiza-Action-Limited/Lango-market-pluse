const turf = require('@turf/turf');

class RouteOptimizer {
  /**
   * Optimize delivery route for multiple stops using nearest neighbor algorithm
   */
  optimizeRoute(stops) {
    // stops: array of { lat, lng, address, orderId }
    if (stops.length === 0) return [];
    if (stops.length === 1) return stops;

    const optimized = [stops[0]];
    let remaining = stops.slice(1);

    while (remaining.length > 0) {
      const last = optimized[optimized.length - 1];
      let nearestIndex = 0;
      let minDistance = Infinity;

      for (let i = 0; i < remaining.length; i++) {
        const dist = this.haversineDistance(last, remaining[i]);
        if (dist < minDistance) {
          minDistance = dist;
          nearestIndex = i;
        }
      }
      optimized.push(remaining[nearestIndex]);
      remaining.splice(nearestIndex, 1);
    }

    return optimized;
  }

  /**
   * Calculate distance between two points (km)
   */
  haversineDistance(point1, point2) {
    const from = turf.point([point1.lng, point1.lat]);
    const to = turf.point([point2.lng, point2.lat]);
    return turf.distance(from, to, { units: 'kilometers' });
  }

  /**
   * Estimate delivery time based on distance and traffic factor
   */
  estimateDeliveryTime(distanceKm, trafficFactor = 1.2) {
    // Assume average speed 30 km/h
    const timeHours = (distanceKm / 30) * trafficFactor;
    return Math.ceil(timeHours * 60); // minutes
  }

  /**
   * Cluster orders by geographic proximity for batch delivery
   */
  clusterOrders(orders, maxClusterRadiusKm = 5) {
    const clusters = [];
    const used = new Set();

    for (let i = 0; i < orders.length; i++) {
      if (used.has(i)) continue;
      const cluster = [orders[i]];
      used.add(i);
      for (let j = i + 1; j < orders.length; j++) {
        if (used.has(j)) continue;
        const dist = this.haversineDistance(orders[i], orders[j]);
        if (dist <= maxClusterRadiusKm) {
          cluster.push(orders[j]);
          used.add(j);
        }
      }
      clusters.push(cluster);
    }
    return clusters;
  }
}

module.exports = new RouteOptimizer();