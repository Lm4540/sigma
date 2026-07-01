/* SIGMA — Web Worker: compresión de imágenes sin bloquear UI */
'use strict';

self.onmessage = async (e) => {
  const { file, maxPx = 1200, quality = 0.8 } = e.data;
  try {
    const bitmap = await createImageBitmap(file);
    let { width, height } = bitmap;

    if (width > maxPx || height > maxPx) {
      if (width > height) { height = Math.round((height / width) * maxPx); width = maxPx; }
      else                { width  = Math.round((width / height) * maxPx); height = maxPx; }
    }

    const canvas = new OffscreenCanvas(width, height);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
    self.postMessage({ blob });
  } catch (err) {
    self.postMessage({ error: err.message });
  }
};
