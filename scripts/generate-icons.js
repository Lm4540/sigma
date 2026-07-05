/**
 * Genera todos los tamaños de iconos PWA a partir del icono original.
 * Uso: node scripts/generate-icons.js
 */
'use strict';

const sharp = require('sharp');
const path  = require('path');

const ORIGIN = path.join(__dirname, '..', 'public', 'icons', 'icon-origin.png');
const OUT    = path.join(__dirname, '..', 'public', 'icons');

const SIZES = [
  { name: 'favicon-48.png', size: 48 },
  { name: 'icon-72.png',    size: 72 },
  { name: 'icon-96.png',    size: 96 },
  { name: 'icon-128.png',   size: 128 },
  { name: 'icon-192.png',   size: 192 },
  { name: 'icon-512.png',   size: 512 },
];

(async () => {
  console.log('Generando iconos desde:', ORIGIN);
  
  // También extraer el color dominante para referencia
  const { dominant } = await sharp(ORIGIN).stats();
  console.log(`Color dominante detectado: rgb(${dominant.r}, ${dominant.g}, ${dominant.b}) → #${dominant.r.toString(16).padStart(2,'0')}${dominant.g.toString(16).padStart(2,'0')}${dominant.b.toString(16).padStart(2,'0')}`);

  for (const { name, size } of SIZES) {
    const outPath = path.join(OUT, name);
    await sharp(ORIGIN)
      .resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .png()
      .toFile(outPath);
    console.log(`  ✓ ${name} (${size}x${size})`);
  }

  // Generar también favicon.png en la raíz de public
  const faviconPath = path.join(__dirname, '..', 'public', 'favicon.png');
  await sharp(ORIGIN)
    .resize(48, 48, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toFile(faviconPath);
  console.log(`  ✓ favicon.png (48x48) en /public`);

  console.log('\n✓ Todos los iconos generados exitosamente.');
})();
