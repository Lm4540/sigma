/**
 * SIGMA — New Workflow Integration Tests
 * Runs test server on port 3005 and tests the entire workflow.
 */
'use strict';

const http = require('http');
const assert = require('assert');
const app = require('../app');
const { Client, CollectionLog } = require('../models');

const PORT = 3005;
const BASE = `http://localhost:${PORT}`;

let server;
let gestorCookie = '';
let jefaCookie = '';
let adminCookie = '';
let secretCookie = '';
let testLogId = null;

function request(opts, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(opts.path, BASE);
    const options = {
      hostname: url.hostname,
      port:     url.port,
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

function multipartRequest(opts, fields, fileBuffer, fileName) {
  return new Promise((resolve, reject) => {
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
    const url = new URL(opts.path, BASE);
    
    let postData = [];
    
    // Append fields
    for (const [key, val] of Object.entries(fields)) {
      if (val !== undefined && val !== null) {
        postData.push(Buffer.from(`--${boundary}\r\n`));
        postData.push(Buffer.from(`Content-Disposition: form-data; name="${key}"\r\n\r\n`));
        postData.push(Buffer.from(`${val}\r\n`));
      }
    }
    
    // Append file
    if (fileBuffer) {
      postData.push(Buffer.from(`--${boundary}\r\n`));
      postData.push(Buffer.from(`Content-Disposition: form-data; name="evidence"; filename="${fileName}"\r\n`));
      postData.push(Buffer.from(`Content-Type: image/png\r\n\r\n`));
      postData.push(fileBuffer);
      postData.push(Buffer.from(`\r\n`));
    }
    
    postData.push(Buffer.from(`--${boundary}--\r\n`));
    
    const body = Buffer.concat(postData);
    
    const options = {
      hostname: url.hostname,
      port:     url.port,
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

(async () => {
  console.log('SIGMA — Running Integration Tests for New Flow');
  console.log('='.repeat(50));

  // Start the server
  server = app.listen(PORT, async () => {
    try {
      // 1. Logins
      gestorCookie = await login('gestor1@sigma.local', 'Password1!');
      assert.ok(gestorCookie, 'Failed to log in as Gestor');
      pass('Login Gestor exitoso');

      jefaCookie = await login('jefa@sigma.local', '12345678');
      assert.ok(jefaCookie, 'Failed to log in as Jefe de Operaciones');
      pass('Login Jefe de Operaciones exitoso');

      adminCookie = await login('admin@sigma.local', 'Admin123!');
      assert.ok(adminCookie, 'Failed to log in as Admin');
      pass('Login Admin exitoso');

      secretCookie = await login('secretaria@sigma.local', 'Password1!');
      assert.ok(secretCookie, 'Failed to log in as Secretaria');
      pass('Login Secretaria exitoso');

      // Reset client 1 coordinates first
      const client = await Client.findByPk(1);
      assert.ok(client, 'Client 1 should exist');
      await client.update({ lastKnownLat: null, lastKnownLng: null });

      // 2. Register collection of type Visita with GPS coordinates and paymentType = nota_abono
      const fakeImage = Buffer.from('fake image content');
      const rCreate = await multipartRequest({ path: '/collections', cookie: gestorCookie }, {
        clientId: 1,
        type: 'Visita',
        comment: 'Visita de prueba nota abono',
        latitude: 13.701234,
        longitude: -89.201234,
        paymentAmount: 150.00,
        paymentType: 'nota_abono'
      }, fakeImage, 'evidence.png');

      assert.strictEqual(rCreate.status, 201, `Failed to create payment: ${JSON.stringify(rCreate.body)}`);
      testLogId = rCreate.body.data.id;
      assert.ok(testLogId, 'Did not receive created log ID');
      pass('Registro de pago con nota_abono y geolocalización exitoso');

      // Verify client GPS coordinates backfilled
      const clientAfter = await Client.findByPk(1);
      assert.strictEqual(parseFloat(clientAfter.lastKnownLat), 13.701234, 'Client lastKnownLat was not updated');
      assert.strictEqual(parseFloat(clientAfter.lastKnownLng), -89.201234, 'Client lastKnownLng was not updated');
      pass('Última ubicación conocida del cliente actualizada correctamente');

      // Verify initial payment status is 'pendiente'
      const logInit = await CollectionLog.findByPk(testLogId);
      assert.strictEqual(logInit.status, 'pendiente', 'Initial payment status should be pendiente');

      // 3. Jefe de Operaciones reviews the payment (status: revisado)
      const rReview = await request({ method: 'PATCH', path: `/collections/${testLogId}/payment`, cookie: jefaCookie }, {
        action: 'solicitar_autorizacion'
      });
      assert.strictEqual(rReview.status, 200, `Jefe review failed: ${JSON.stringify(rReview.body)}`);
      
      const logReviewed = await CollectionLog.findByPk(testLogId);
      assert.strictEqual(logReviewed.status, 'revisado', 'Status should be revisado after review');
      assert.ok(logReviewed.reviewedBy, 'reviewedBy should be set');
      assert.ok(logReviewed.reviewedAt, 'reviewedAt should be set');
      pass('Fase de revisión por Jefe de Operaciones completada (pendiente ➔ revisado)');

      // 4. Admin authorizes the payment (status: autorizado)
      const rAuth = await request({ method: 'PATCH', path: `/collections/${testLogId}/payment`, cookie: adminCookie }, {
        action: 'autorizar'
      });
      assert.strictEqual(rAuth.status, 200, `Admin auth failed: ${JSON.stringify(rAuth.body)}`);

      const logAuthed = await CollectionLog.findByPk(testLogId);
      assert.strictEqual(logAuthed.status, 'autorizado', 'Status should be autorizado after authorization');
      assert.ok(logAuthed.authorizedBy, 'authorizedBy should be set');
      assert.ok(logAuthed.authorizedAt, 'authorizedAt should be set');
      pass('Fase de autorización por Administrador completada (revisado ➔ autorizado)');

      // 5. Secretaria applies the payment (status: aplicado)
      const rApply = await request({ method: 'PATCH', path: `/collections/${testLogId}/apply`, cookie: secretCookie });
      assert.strictEqual(rApply.status, 200, `Secretaria apply failed: ${JSON.stringify(rApply.body)}`);

      const logApplied = await CollectionLog.findByPk(testLogId);
      assert.strictEqual(logApplied.status, 'aplicado', 'Status should be aplicado after ERP application');
      assert.ok(logApplied.appliedBy, 'appliedBy should be set');
      assert.ok(logApplied.appliedAt, 'appliedAt should be set');
      pass('Fase de aplicación ERP por Secretaria completada (autorizado ➔ aplicado)');

      // 6. Verify reports view loads successfully
      const rReports = await request({ method: 'GET', path: '/reports', cookie: adminCookie });
      assert.strictEqual(rReports.status, 200, 'Failed to load reports page');
      assert.ok(typeof rReports.body === 'string' && rReports.body.includes('Pagos recibidos por gestor'), 'Reports page does not include new sections');
      pass('Reportes y exportaciones actualizados y accesibles');

      // Cleanup
      await logApplied.destroy();
      console.log('\n' + '='.repeat(50));
      console.log('RESULTADO: TODOS LOS NUEVOS TESTS PASARON ✓');
      server.close();
      process.exit(0);

    } catch (e) {
      fail('Error en la suite de pruebas del flujo', e);
      if (server) server.close();
      process.exit(1);
    }
  });
})();
