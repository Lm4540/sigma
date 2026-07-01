'use strict';

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '../public/templates');
if (!fs.existsSync(dir)){
  fs.mkdirSync(dir, { recursive: true });
}

// Datos de ejemplo realistas con formato de El Salvador y USD
const data = [
  {
    'Código': 'CLI-1001',
    'Préstamo': 'PREST-5020-001',
    'Nombre': 'Juan Ramón Pérez',
    'Dirección': 'Final 49 Av. Sur, Colonia Flor Blanca, San Salvador',
    'Saldo': 1500.50,
    'Seguro': 12.00,
    'OtrosCargos': 5.00,
    'DiasMora': 12,
    'ProximoPago': '2026-07-05'
  },
  {
    'Código': 'CLI-1002',
    'Préstamo': 'PREST-5020-002',
    'Nombre': 'María Elena Flores',
    'Dirección': 'Urbanización La Cima II, Senda 5 Block G, San Salvador',
    'Saldo': 840.00,
    'Seguro': 8.50,
    'OtrosCargos': 0.00,
    'DiasMora': 45,
    'ProximoPago': '2026-06-30'
  },
  {
    'Código': 'CLI-1003',
    'Préstamo': 'PREST-5020-003',
    'Nombre': 'Carlos Antonio Rivas',
    'Dirección': '3a Calle Oriente y 4a Av. Norte, Santa Ana',
    'Saldo': 0.00,
    'Seguro': 0.00,
    'OtrosCargos': 0.00,
    'DiasMora': 0,
    'ProximoPago': '2026-07-15'
  },
  {
    'Código': 'CLI-1004',
    'Préstamo': 'PREST-5020-004',
    'Nombre': 'Ana Beatriz Martínez',
    'Dirección': 'Residencial Altos de la Metrópolis, Pasaje 8, San Miguel',
    'Saldo': 3200.75,
    'Seguro': 25.00,
    'OtrosCargos': 12.50,
    'DiasMora': 95,
    'ProximoPago': '2026-06-25'
  }
];

const wb = XLSX.utils.book_new();
const ws = XLSX.utils.json_to_sheet(data);

// Ajustar el ancho de las columnas
const wscols = [
  { wch: 15 }, // Código
  { wch: 18 }, // Préstamo
  { wch: 25 }, // Nombre
  { wch: 45 }, // Dirección
  { wch: 12 }, // Saldo (USD)
  { wch: 10 }, // Seguro (USD)
  { wch: 12 }, // Otros Cargos (USD)
  { wch: 10 }, // Días de Mora
  { wch: 15 }  // Próximo Pago (YYYY-MM-DD)
];
ws['!cols'] = wscols;

XLSX.utils.book_append_sheet(wb, ws, 'Clientes');

const outPath = path.join(dir, 'cliente_importacion_ejemplo.xlsx');
XLSX.writeFile(wb, outPath);

console.log('¡Plantilla Excel generada exitosamente en:', outPath);
