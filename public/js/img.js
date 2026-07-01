/* SIGMA — Compresión de imágenes via canvas
   Se usa cuando Web Worker no está disponible (fallback). */
'use strict';

const imgUtils = (() => {
  const MAX_PX  = parseInt(window.SIGMA_IMG_MAX_PX  || 1200);
  const QUALITY = parseFloat(window.SIGMA_IMG_QUALITY || 0.8);

  /**
   * Comprime un File de imagen y devuelve un nuevo Blob.
   * @param {File} file
   * @returns {Promise<Blob>}
   */
  const compress = (file) => new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) return resolve(file);

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > MAX_PX || height > MAX_PX) {
          if (width > height) { height = Math.round((height / width) * MAX_PX); width = MAX_PX; }
          else                { width  = Math.round((width / height) * MAX_PX); height = MAX_PX; }
        }
        const canvas = document.createElement('canvas');
        canvas.width  = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => blob ? resolve(blob) : reject(new Error('toBlob falló')),
          'image/jpeg',
          QUALITY
        );
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  /**
   * Comprime usando Web Worker si está disponible; fallback a canvas directo.
   * @param {File} file
   * @returns {Promise<File>}
   */
  const compressSafe = async (file) => {
    if (typeof Worker !== 'undefined') {
      return new Promise((resolve, reject) => {
        const worker = new Worker('/workers/img-worker.js');
        worker.postMessage({ file, maxPx: MAX_PX, quality: QUALITY });
        worker.onmessage = (e) => {
          worker.terminate();
          if (e.data.error) return reject(new Error(e.data.error));
          resolve(new File([e.data.blob], file.name, { type: 'image/jpeg' }));
        };
        worker.onerror = () => { worker.terminate(); compress(file).then(b => resolve(new File([b], file.name, { type: 'image/jpeg' }))).catch(reject); };
      });
    }
    const blob = await compress(file);
    return new File([blob], file.name, { type: 'image/jpeg' });
  };

  return { compress, compressSafe };
})();
