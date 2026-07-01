'use strict';

/**
 * Servicio de Geolocalización (GPS)
 * Implementa el cálculo de distancia Haversine y alertas asociadas.
 */

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) {
    return 0;
  }
  const R = 6371; // Radio de la Tierra en Kilómetros
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // Distancia en km
  return distance;
};

const checkProximity = (lat1, lon1, lat2, lon2) => {
  const dist = calculateDistance(lat1, lon1, lat2, lon2);
  const maxDist = parseFloat(process.env.GPS_MAX_DISTANCE_KM || 0.1);
  return dist <= maxDist;
};

module.exports = {
  calculateDistance,
  checkProximity,
};
