/**
 * SIGMA — API Integration Tests
 * Usa http nativo + assert. No requiere paquetes adicionales.
 * Asume servidor corriendo en http://localhost:3000
 */
'use strict';

const http  = require('http');
const https = require('https');
const assert = require('assert');

const BASE = 'http://localhost:3000';

let sessionCookie = '';   // Gestor
let adminCookie   = '';
let secretCookie  = '';
let testLogId     = null;

/* ── Helpers ──────────────────────────────────────────────── */
function request(opts, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(opts.path, BASE);
    const options = {
      hostname: url.hostname,
      port:     url.port || 80,
      path:     url.pathname + url.search,
      method:   opts.method || 'GET',
      headers:  {
        'Content-Type':  'application/json',
        'Cookie':        opts.cookie || '',
        ...(opts.headers || {}),
      },
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(data); } catch { parsed = data; }
        resolve({ status: res.statusCode, headers: res.headers, body: parsed });
      });
    });
    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

function uploadRequest(opts, fileBuffer, fileName) {
  return new Promise((resolve, reject) => {
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    const url = new URL(opts.path, BASE);
    
    let postData = [];
    postData.push(Buffer.from(`--${boundary}\r\n`));
    postData.push(Buffer.from(`Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n`));
    postData.push(Buffer.from(`Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n`));
    postData.push(fileBuffer);
    postData.push(Buffer.from(`\r\n--${boundary}--\r\n`));
    
    const body = Buffer.concat(postData);
    
    const options = {
      hostname: url.hostname,
      port:     url.port || 80,
      path:     url.pathname + url.search,
      method:   'POST',
      headers:  {
        'Content-Type':   `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
        'Cookie':         opts.cookie || '',
        ...(opts.headers || {}),
      },
    };
    
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(data); } catch { parsed = data; }
        resolve({ status: res.statusCode, headers: res.headers, body: parsed });
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function pass(name) { console.log(`  ✓ ${name}`); }
function fail(name, err) { console.error(`  ✗ ${name}:`, err.message || err); process.exitCode = 1; }

async function login(email, password) {
  const res = await request({ method: 'POST', path: '/login' }, { email, password });
  const cookie = res.headers['set-cookie']?.find(c => c.startsWith('token='));
  return cookie ? cookie.split(';')[0] : null;
}

/* ── Tests ────────────────────────────────────────────────── */
async function testAuth() {
  console.log('\n[Auth]');

  // Login con credenciales inválidas
  try {
    const r = await request({ method: 'POST', path: '/login' }, { email: 'no@existe.com', password: 'wrong' });
    assert.strictEqual(r.status, 401, 'Should 401 on bad creds');
    pass('Rechaza credenciales inválidas (401)');
  } catch(e) { fail('Rechaza credenciales inválidas', e); }

  // Login válido — admin
  try {
    adminCookie = await login('admin@sigma.local', 'Admin123!');
    assert.ok(adminCookie, 'No cookie returned for admin');
    pass('Login admin exitoso — cookie recibida');
  } catch(e) { fail('Login admin', e); }

  // Login válido — gestor (primer gestor del seed)
  try {
    sessionCookie = await login('gestor1@sigma.local', 'Password1!');
    assert.ok(sessionCookie, 'No cookie for gestor');
    pass('Login gestor exitoso');
  } catch(e) { fail('Login gestor', e); }

  // Login válido — secretaria
  try {
    secretCookie = await login('secretaria@sigma.local', 'Password1!');
    assert.ok(secretCookie, 'No cookie for secretaria');
    pass('Login secretaria exitoso');
  } catch(e) { fail('Login secretaria', e); }

  // Ruta protegida sin autenticación → redirect o 401
  try {
    const r = await request({ method: 'GET', path: '/dashboard' });
    assert.ok([302, 401].includes(r.status), `Expected redirect or 401, got ${r.status}`);
    pass('Ruta protegida redirige sin sesión');
  } catch(e) { fail('Ruta protegida sin sesión', e); }

  // Validación express-validator — email inválido
  try {
    const r = await request({ method: 'POST', path: '/login' }, { email: 'noesunmail', password: '123' });
    assert.strictEqual(r.status, 422, 'Debería fallar validación');
    pass('express-validator: email inválido → 422');
  } catch(e) { fail('express-validator email', e); }
}

async function testPermissions() {
  console.log('\n[Permisos]');

  // Gestor no puede acceder a /users
  try {
    const r = await request({ method: 'GET', path: '/users', cookie: sessionCookie });
    assert.ok([302, 403].includes(r.status), `Gestor should be blocked from /users, got ${r.status}`);
    pass('Gestor bloqueado en /users');
  } catch(e) { fail('Gestor en /users', e); }

  // Secretaria puede acceder a /collections/pending (autorizado)
  try {
    const r = await request({ method: 'GET', path: '/collections/pending', cookie: secretCookie });
    assert.ok([200, 302].includes(r.status), `Secretaria should access pending, got ${r.status}`);
    pass('Secretaria accede a /collections/pending');
  } catch(e) { fail('Secretaria en pending', e); }

  // Secretaria no puede acceder a /reports
  try {
    const r = await request({ method: 'GET', path: '/reports', cookie: secretCookie });
    assert.ok([302, 403].includes(r.status), `Secretaria should be blocked from reports, got ${r.status}`);
    pass('Secretaria bloqueada en /reports');
  } catch(e) { fail('Secretaria en reports', e); }

  // Admin puede acceder a /reports
  try {
    const r = await request({ method: 'GET', path: '/reports', cookie: adminCookie });
    assert.strictEqual(r.status, 200, `Admin should access reports, got ${r.status}`);
    pass('Admin accede a /reports');
  } catch(e) { fail('Admin en reports', e); }
}

async function testClients() {
  console.log('\n[Clientes]');

  try {
    const r = await request({ method: 'GET', path: '/clients', cookie: adminCookie });
    assert.strictEqual(r.status, 200);
    pass('GET /clients → 200');
  } catch(e) { fail('GET /clients', e); }

  // Búsqueda
  try {
    const r = await request({ method: 'GET', path: '/api/clients/search?q=test', cookie: adminCookie });
    assert.strictEqual(r.status, 200);
    assert.ok(Array.isArray(r.body.data), 'Debe devolver array');
    pass('GET /api/clients/search → 200 con array');
  } catch(e) { fail('GET /api/clients/search', e); }
}

async function testCollectionValidation() {
  console.log('\n[Validación de colecciones]');

  // Crear gestión sin tipo → 422
  try {
    const r = await request({ method: 'POST', path: '/collections', cookie: sessionCookie },
      { clientId: 1, type: '', comment: 'test' });
    assert.strictEqual(r.status, 422, `Expected 422, got ${r.status}`);
    pass('Gestión sin tipo → 422');
  } catch(e) { fail('Gestión sin tipo', e); }

  // Crear gestión con tipo inválido
  try {
    const r = await request({ method: 'POST', path: '/collections', cookie: sessionCookie },
      { clientId: 1, type: 'Invalido', comment: 'test' });
    assert.strictEqual(r.status, 422);
    pass('Gestión con tipo inválido → 422');
  } catch(e) { fail('Gestión tipo inválido', e); }
}

async function testReports() {
  console.log('\n[Reportes]');

  try {
    const r = await request({ method: 'GET', path: '/reports', cookie: adminCookie });
    assert.strictEqual(r.status, 200);
    pass('GET /reports → 200');
  } catch(e) { fail('GET /reports', e); }

  // Filtros de fecha
  try {
    const r = await request({ method: 'GET', path: '/reports?from=2024-01-01&to=2024-12-31', cookie: adminCookie });
    assert.strictEqual(r.status, 200);
    pass('GET /reports con filtros de fecha → 200');
  } catch(e) { fail('GET /reports con filtros', e); }
}

async function testPaymentStateMachine() {
  console.log('\n[Máquina de estados de pagos]');

  // Intentar autorizar un pago con acción inválida
  try {
    const r = await request({ method: 'PATCH', path: '/collections/999/payment', cookie: adminCookie },
      { action: 'accion_invalida' });
    assert.strictEqual(r.status, 422, `Expected 422 for invalid action, got ${r.status}`);
    pass('Acción de pago inválida → 422');
  } catch(e) { fail('Acción de pago inválida', e); }

  // Gestor no puede autorizar pagos
  try {
    const r = await request({ method: 'PATCH', path: '/collections/1/payment', cookie: sessionCookie },
      { action: 'autorizar' });
    assert.ok([302, 403].includes(r.status), `Gestor should be blocked, got ${r.status}`);
    pass('Gestor bloqueado en autorización de pagos');
  } catch(e) { fail('Gestor en autorización', e); }
}

async function testPushApi() {
  console.log('\n[Push API]');

  // GET vapid key
  try {
    const r = await request({ method: 'GET', path: '/api/push-vapid-key', cookie: adminCookie });
    assert.strictEqual(r.status, 200);
    assert.ok(typeof r.body.publicKey === 'string', 'Should return publicKey string');
    pass('GET /api/push-vapid-key → 200 con publicKey');
  } catch(e) { fail('GET push-vapid-key', e); }

  // POST suscripción sin datos → 400
  try {
    const r = await request({ method: 'POST', path: '/api/push-subscription', cookie: adminCookie }, {});
    assert.strictEqual(r.status, 400);
    pass('POST /api/push-subscription sin datos → 400');
  } catch(e) { fail('POST push-subscription vacío', e); }
}

async function testUsers() {
  console.log('\n[Usuarios]');

  // Crear usuario sin email → 422
  try {
    const r = await request({ method: 'POST', path: '/users', cookie: adminCookie },
      { name: 'Test', email: 'noesmail', password: '12345678', roleId: 3 });
    assert.strictEqual(r.status, 422);
    pass('Crear usuario email inválido → 422');
  } catch(e) { fail('Crear usuario email inválido', e); }

  // Cambiar contraseña sin currentPassword → 422
  try {
    const r = await request({ method: 'POST', path: '/users/change-password', cookie: adminCookie },
      { currentPassword: '', newPassword: 'nueva12345' });
    assert.strictEqual(r.status, 422);
    pass('change-password sin currentPassword → 422');
  } catch(e) { fail('change-password sin currentPassword', e); }
}

async function testClientImportExcel() {
  console.log('\n[Importación de Clientes desde Excel]');

  try {
    const XLSX = require('xlsx');
    const { Client } = require('../models');

    // Generar libro de prueba
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet([
      {
        'Código': 'CLI-TEST-API-999',
        'Préstamo': 'PREST-TEST-API-999',
        'Nombre': 'Cliente Importación Test API',
        'Dirección': 'Pasaje Femenino, San Salvador',
        'Saldo': 750.50,
        'Seguro': 10.00,
        'OtrosCargos': 2.50,
        'DiasMora': 15,
        'ProximoPago': '2026-07-20'
      }
    ]);
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const fileBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // Enviar archivo
    const r = await uploadRequest({ path: '/clients/import', cookie: adminCookie }, fileBuffer, 'test_import.xlsx');
    assert.strictEqual(r.status, 200, `Debería retornar 200, obtuvo ${r.status}`);
    assert.strictEqual(r.body.success, true, 'Debería ser success: true');
    pass('POST /clients/import exitoso');

    // Verificar en Base de Datos
    const client = await Client.findOne({ where: { clientCode: 'CLI-TEST-API-999' } });
    assert.ok(client, 'El cliente importado debería existir en la DB');
    assert.strictEqual(client.name, 'Cliente Importación Test API');
    assert.strictEqual(parseFloat(client.balance), 750.50);
    pass('Cliente creado en DB con valores correctos');

    // Intentar actualizar cargando de nuevo el mismo cliente con diferente saldo
    const wsUpdate = XLSX.utils.json_to_sheet([
      {
        'Código': 'CLI-TEST-API-999',
        'Préstamo': 'PREST-TEST-API-999',
        'Nombre': 'Cliente Importación Test API',
        'Dirección': 'Pasaje Femenino, San Salvador',
        'Saldo': 300.00,
        'Seguro': 10.00,
        'OtrosCargos': 2.50,
        'DiasMora': 5,
        'ProximoPago': '2026-07-20'
      }
    ]);
    const wbUpdate = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wbUpdate, wsUpdate, 'Sheet1');
    const fileBufferUpdate = XLSX.write(wbUpdate, { type: 'buffer', bookType: 'xlsx' });

    const r2 = await uploadRequest({ path: '/clients/import', cookie: adminCookie }, fileBufferUpdate, 'test_import_update.xlsx');
    assert.strictEqual(r2.status, 200);

    const clientUpdated = await Client.findOne({ where: { clientCode: 'CLI-TEST-API-999' } });
    assert.strictEqual(parseFloat(clientUpdated.balance), 300.00, 'El saldo del cliente debería haber sido actualizado');
    pass('Cliente actualizado en DB correctamente');

    // Limpieza
    await clientUpdated.destroy();
    pass('Limpieza de cliente de prueba finalizada');
  } catch(e) { fail('Importación de clientes Excel', e); }
}

async function testGpsAlert() {
  console.log('\n[Alerta GPS / Anti-Spoofing]');

  try {
    const { Client, CollectionLog } = require('../models');

    // Actualizar coordenadas del cliente ID = 1 para el test (San Salvador centro)
    const client = await Client.findByPk(1);
    assert.ok(client, 'Cliente 1 debería existir');
    const oldLat = client.addressLat;
    const oldLng = client.addressLng;

    await client.update({
      addressLat: 13.69294000,
      addressLng: -89.21819000
    });

    // 1. Registrar una Visita cercana
    const rClose = await request({ method: 'POST', path: '/collections', cookie: sessionCookie }, {
      clientId: 1,
      type: 'Visita',
      comment: 'Visita cercana test',
      latitude: 13.69310000,
      longitude: -89.21830000
    });

    assert.strictEqual(rClose.status, 201);
    const logClose = await CollectionLog.findByPk(rClose.body.data.id);
    assert.strictEqual(logClose.gpsAlertTriggered, 0, 'No debería disparar alerta GPS por cercanía');
    pass('Visita dentro de rango no dispara alerta');

    // 2. Registrar una Visita lejana
    const rFar = await request({ method: 'POST', path: '/collections', cookie: sessionCookie }, {
      clientId: 1,
      type: 'Visita',
      comment: 'Visita lejana test',
      latitude: 13.75000000,
      longitude: -89.15000000
    });

    assert.strictEqual(rFar.status, 201);
    const logFar = await CollectionLog.findByPk(rFar.body.data.id);
    assert.strictEqual(logFar.gpsAlertTriggered, 1, 'Debería disparar alerta GPS por lejanía');
    pass('Visita fuera de rango dispara alerta gpsAlertTriggered = 1');

    // Limpieza
    await client.update({ addressLat: oldLat, addressLng: oldLng });
    await logClose.destroy();
    await logFar.destroy();
    pass('Limpieza de datos de prueba de GPS finalizada');
  } catch(e) { fail('Alerta GPS / Anti-Spoofing', e); }
}

async function testSupervisorBranchFilter() {
  console.log('\n[Filtro de Gestores por Sucursal para Supervisores]');

  try {
    const { User } = require('../models');

    // Login del supervisor (su sucursal es 1)
    const supervisorCookie = await login('supervisor@sigma.local', 'Password1!');
    assert.ok(supervisorCookie, 'No se pudo iniciar sesión como supervisor');

    // Obtener asignaciones para supervisor
    const r = await request({ method: 'GET', path: '/assignments', cookie: supervisorCookie });
    assert.strictEqual(r.status, 200);

    const bodyStr = r.body;
    
    // Verificamos que el select no tenga gestores de otras sucursales
    const otherUsers = await User.findAll({ where: { roleId: 3, status: 'on', branchId: { [require('sequelize').Op.ne]: 1 } } });
    for (const u of otherUsers) {
      assert.ok(!bodyStr.includes(`value="${u.id}"`), `Supervisor no debería ver al gestor de otra sucursal ID: ${u.id}`);
    }
    
    const branch1Users = await User.findAll({ where: { roleId: 3, status: 'on', branchId: 1 } });
    for (const u of branch1Users) {
      assert.ok(bodyStr.includes(`value="${u.id}"`), `Supervisor debería ver al gestor de su sucursal ID: ${u.id}`);
    }

    pass('Filtro de gestores por sucursal funciona correctamente');
  } catch(e) { fail('Filtro de gestores por sucursal', e); }
}

/* ── Ejecución ────────────────────────────────────────────── */
(async () => {
  console.log('SIGMA — API Test Suite');
  console.log('='.repeat(40));

  await testAuth();
  await testPermissions();
  await testClients();
  await testCollectionValidation();
  await testReports();
  await testPaymentStateMachine();
  await testPushApi();
  await testUsers();
  await testClientImportExcel();
  await testGpsAlert();
  await testSupervisorBranchFilter();

  console.log('\n' + '='.repeat(40));
  if (process.exitCode === 1) {
    console.log('Resultado: FALLOS ENCONTRADOS');
  } else {
    console.log('Resultado: TODOS LOS TESTS PASARON ✓');
  }
})();
