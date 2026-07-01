/* SIGMA — GPS utilities */
'use strict';

const gps = (() => {
  const getPosition = () => new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Geolocalización no disponible'));
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    });
  });

  return { getPosition };
})();
