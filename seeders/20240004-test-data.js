'use strict';

const bcrypt = require('bcryptjs');

const CLIENTS = [
  { clientCode: 'CLI-001', loanNumber: 'PRES-2023-001', name: 'María Elena Ramos Gutiérrez',     address: 'Col. Escalón, San Salvador',          daysLate:  0, balance:  3500.00, insurance: 180.00, otherFees:  45.00 },
  { clientCode: 'CLI-002', loanNumber: 'PRES-2023-002', name: 'José Antonio Flores Martínez',    address: 'Res. Los Almendros, Santa Tecla',      daysLate:  8, balance:  7200.00, insurance: 360.00, otherFees:  90.00 },
  { clientCode: 'CLI-003', loanNumber: 'PRES-2023-003', name: 'Ana Lucía Hernández Vásquez',     address: 'Bo. San Miguelito, San Salvador',      daysLate: 18, balance:  2100.00, insurance: 105.00, otherFees:  30.00 },
  { clientCode: 'CLI-004', loanNumber: 'PRES-2023-004', name: 'Carlos Roberto Mejía Portillo',   address: 'Colonia Miramonte, San Salvador',      daysLate: 45, balance:  9800.00, insurance: 490.00, otherFees: 150.00 },
  { clientCode: 'CLI-005', loanNumber: 'PRES-2023-005', name: 'Sandra Patricia López Cruz',      address: 'Apopa, San Salvador',                 daysLate: 72, balance:  4500.00, insurance: 225.00, otherFees:  60.00 },
  { clientCode: 'CLI-006', loanNumber: 'PRES-2023-006', name: 'Roberto Ernesto García Salazar',  address: 'Soyapango, San Salvador',             daysLate: 95, balance:  6300.00, insurance: 315.00, otherFees:  80.00 },
  { clientCode: 'CLI-007', loanNumber: 'PRES-2023-007', name: 'Diana Carolina Pérez Molina',     address: 'Ciudad Delgado, San Salvador',        daysLate:130, balance:  1800.00, insurance:  90.00, otherFees:  25.00 },
  { clientCode: 'CLI-008', loanNumber: 'PRES-2023-008', name: 'Miguel Ángel Fuentes Reyes',      address: 'Antiguo Cuscatlán, La Libertad',      daysLate:155, balance: 12000.00, insurance: 600.00, otherFees: 200.00 },
  { clientCode: 'CLI-009', loanNumber: 'PRES-2023-009', name: 'Rosa María Interiano de Pacas',  address: 'Zacamil, Mejicanos',                  daysLate:200, balance:  5400.00, insurance: 270.00, otherFees:  70.00 },
  { clientCode: 'CLI-010', loanNumber: 'PRES-2023-010', name: 'Juan Carlos Zelaya Rivas',        address: 'Col. Las Mercedes, San Miguel',       daysLate:290, balance:  8700.00, insurance: 435.00, otherFees: 120.00 },
  { clientCode: 'CLI-011', loanNumber: 'PRES-2024-001', name: 'Claudia Beatriz Monge Sandoval',  address: 'Bo. El Calvario, Usulután',           daysLate:  5, balance:  3200.00, insurance: 160.00, otherFees:  40.00 },
  { clientCode: 'CLI-012', loanNumber: 'PRES-2024-002', name: 'Eduardo José Amaya Chávez',       address: 'Col. Altavista, Santa Ana',           daysLate: 22, balance:  5800.00, insurance: 290.00, otherFees:  75.00 },
  { clientCode: 'CLI-013', loanNumber: 'PRES-2024-003', name: 'Karla Sofía Villacorta Orellana',address: 'Merliot, La Libertad',                daysLate: 60, balance:  2900.00, insurance: 145.00, otherFees:  35.00 },
  { clientCode: 'CLI-014', loanNumber: 'PRES-2024-004', name: 'Alejandro Rene Dueñas Barrera',  address: 'Col. Quiñones, San Salvador',         daysLate:110, balance:  7600.00, insurance: 380.00, otherFees: 100.00 },
  { clientCode: 'CLI-015', loanNumber: 'PRES-2024-005', name: 'Verónica del Carmen Soto Lara',  address: 'Ilopango, San Salvador',              daysLate:175, balance:  3300.00, insurance: 165.00, otherFees:  45.00 },
  { clientCode: 'CLI-016', loanNumber: 'PRES-2024-006', name: 'Oscar Humberto Recinos Estrada',  address: 'Ayutuxtepeque, San Salvador',         daysLate:240, balance:  9200.00, insurance: 460.00, otherFees: 130.00 },
  { clientCode: 'CLI-017', loanNumber: 'PRES-2024-007', name: 'Ingrid Paola Bonilla Aguilar',    address: 'Metapán, Santa Ana',                 daysLate:320, balance:  4100.00, insurance: 205.00, otherFees:  55.00 },
  { clientCode: 'CLI-018', loanNumber: 'PRES-2024-008', name: 'Gerardo Antonio Melara Pineda',   address: 'Quezaltepeque, La Libertad',          daysLate: 12, balance:  6700.00, insurance: 335.00, otherFees:  85.00 },
  { clientCode: 'CLI-019', loanNumber: 'PRES-2024-009', name: 'Lorena Ximena Castro Aguilar',    address: 'Cojutepeque, Cuscatlán',             daysLate: 82, balance:  2500.00, insurance: 125.00, otherFees:  30.00 },
  { clientCode: 'CLI-020', loanNumber: 'PRES-2024-010', name: 'Francisco Javier Romero Umaña',  address: 'San Vicente, San Vicente',            daysLate:145, balance: 10500.00, insurance: 525.00, otherFees: 175.00 },
];

const COMMENTS = {
  Visita:   ['Visita domiciliar realizada. Cliente recibió notificación de saldo pendiente.','Visita en negocio. Se coordinó fecha de pago con propietario.','Cliente ausente en domicilio. Se dejó aviso escrito con vecino.','Visita exitosa. Cliente prometió cancelar esta semana.','Inspección del negocio como garantía del crédito. Sin novedades.'],
  Llamada:  ['Contacto telefónico exitoso. Cliente reconoció deuda pendiente.','Llamada sin respuesta. Se dejó mensaje en buzón de voz.','Cliente informó dificultades económicas temporales por emergencia.','Acordado plan de pago diferido por 15 días adicionales.','Cliente solicitó estado de cuenta detallado para revisión.'],
  WhatsApp: ['Recordatorio de pago enviado con estado de cuenta adjunto.','Cliente confirmó recepción del recordatorio. Promete pago el viernes.','Se compartió número de cuenta para realizar transferencia.','Cliente solicita extensión de plazo por motivos de salud familiar.','Última notificación enviada antes de escalar proceso de cobro.'],
  Mensaje:  ['SMS de recordatorio de cuota vencida enviado correctamente.','Notificación formal de vencimiento de obligación crediticia enviada.','Confirmación de acuerdo de pago enviada al cliente.','Alerta de mora activa enviada según protocolo de cobranza.','Mensaje de bienvenida al plan de regularización de deuda enviado.'],
};

const rand     = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randInt  = (mn, mx) => Math.floor(Math.random() * (mx - mn + 1)) + mn;
const daysAgo  = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };
const roundM   = (n) => Math.round(n * 100) / 100;

module.exports = {
  async up(queryInterface) {
    const hash = await bcrypt.hash('Password1!', 10);
    const now  = new Date();

    // ── Usuarios ──────────────────────────────────────────────────────────────
    await queryInterface.bulkInsert('Users', [
      { name: 'Supervisor Regional',         email: 'supervisor@sigma.local', password: hash, roleId: 2, branchId: 1, specialPermissions: null, loginAttempts: 0, lockUntil: null, status: 'on', webAuthnEnabled: 0, createdAt: now, updatedAt: now, createdBy: 1 },
      { name: 'Luis Fernando Castillo',      email: 'gestor1@sigma.local',    password: hash, roleId: 3, branchId: 1, specialPermissions: null, loginAttempts: 0, lockUntil: null, status: 'on', webAuthnEnabled: 0, createdAt: now, updatedAt: now, createdBy: 1 },
      { name: 'Mónica Alejandra Turcios',    email: 'gestor2@sigma.local',    password: hash, roleId: 3, branchId: 1, specialPermissions: null, loginAttempts: 0, lockUntil: null, status: 'on', webAuthnEnabled: 0, createdAt: now, updatedAt: now, createdBy: 1 },
      { name: 'Rafael Antonio Guzmán Díaz', email: 'gestor3@sigma.local',    password: hash, roleId: 3, branchId: 1, specialPermissions: null, loginAttempts: 0, lockUntil: null, status: 'on', webAuthnEnabled: 0, createdAt: now, updatedAt: now, createdBy: 1 },
      { name: 'Estela Margarita Pérez',      email: 'secretaria@sigma.local', password: hash, roleId: 4, branchId: 1, specialPermissions: null, loginAttempts: 0, lockUntil: null, status: 'on', webAuthnEnabled: 0, createdAt: now, updatedAt: now, createdBy: 1 },
    ]);

    // Recuperar IDs de usuarios recién insertados
    const [userRows] = await queryInterface.sequelize.query(
      `SELECT id, email FROM Users WHERE email IN ('supervisor@sigma.local','gestor1@sigma.local','gestor2@sigma.local','gestor3@sigma.local','secretaria@sigma.local') ORDER BY id ASC`
    );
    const supervisorId = userRows.find(u => u.email === 'supervisor@sigma.local').id;
    const gestores = [
      userRows.find(u => u.email === 'gestor1@sigma.local').id,
      userRows.find(u => u.email === 'gestor2@sigma.local').id,
      userRows.find(u => u.email === 'gestor3@sigma.local').id,
    ];
    const secretariaId = userRows.find(u => u.email === 'secretaria@sigma.local').id;

    // ── Clientes ──────────────────────────────────────────────────────────────
    const nextPayment = new Date();
    nextPayment.setDate(1);
    nextPayment.setMonth(nextPayment.getMonth() + 1);
    const npStr = nextPayment.toISOString().split('T')[0];

    await queryInterface.bulkInsert('Clients', CLIENTS.map((c, i) => ({
      clientCode: c.clientCode,
      loanNumber: c.loanNumber,
      name: c.name,
      address: c.address,
      addressLat: null,
      addressLng: null,
      branchId: 1,
      daysLate: c.daysLate,
      balance: c.balance,
      insurance: c.insurance,
      otherFees: c.otherFees,
      nextPaymentDate: npStr,
      lastActivity: daysAgo(randInt(0, 5)),
      createdAt: daysAgo(randInt(90, 180)),
      updatedAt: daysAgo(randInt(0, 10)),
      createdBy: null,
    })));

    // Recuperar IDs de clientes
    const [clientRows] = await queryInterface.sequelize.query(
      `SELECT id, clientCode FROM Clients WHERE clientCode LIKE 'CLI-%' ORDER BY id ASC`
    );
    const clientIds = clientRows.map(r => r.id);

    // ── Asignaciones (distribuir entre 3 gestores) ────────────────────────────
    // Gestor 0: clientes 0-6, Gestor 1: 7-12, Gestor 2: 13-19
    const assignMap = [
      { gestorIdx: 0, range: [0, 6] },
      { gestorIdx: 1, range: [7, 12] },
      { gestorIdx: 2, range: [13, 19] },
    ];
    const assignments = [];
    for (const { gestorIdx, range: [from, to] } of assignMap) {
      for (let i = from; i <= to; i++) {
        assignments.push({
          clientId: clientIds[i],
          userId: gestores[gestorIdx],
          assignedBy: 1,
          isActive: 1,
          assignedAt: daysAgo(randInt(30, 90)),
          releasedAt: null,
        });
      }
    }
    await queryInterface.bulkInsert('ClientAssignments', assignments);

    // ── CollectionLogs ────────────────────────────────────────────────────────
    const TYPES     = ['Visita', 'Llamada', 'WhatsApp', 'Mensaje'];
    const PAY_TYPES = ['efectivo', 'transferencia', 'cheque'];
    const logs = [];

    for (let i = 0; i < clientIds.length; i++) {
      const clientId  = clientIds[i];
      const client    = CLIENTS[i];
      const gestorIdx = i <= 6 ? 0 : i <= 12 ? 1 : 2;
      const gestorId  = gestores[gestorIdx];
      const numLogs   = randInt(3, 8);

      for (let j = 0; j < numLogs; j++) {
        const type      = rand(TYPES);
        const daysBack  = randInt(j * 5 + 1, j * 5 + 25);
        const createdAt = daysAgo(daysBack);
        const hasPago   = client.daysLate > 0 && Math.random() < 0.28;
        const payAmount = hasPago ? roundM(randInt(50, Math.min(400, Math.floor(client.balance))) ) : null;
        const payType   = hasPago ? rand(PAY_TYPES) : null;

        let status = 'pendiente', authorizedBy = null, authorizedAt = null, appliedBy = null, appliedAt = null;

        if (hasPago && daysBack > 12) {
          if (Math.random() < 0.15) {
            // Rechazado
            status = 'rechazado';
            authorizedBy = rand([1, supervisorId]);
            authorizedAt = new Date(createdAt.getTime() + 3 * 3600000);
          } else {
            status = 'autorizado';
            authorizedBy = rand([1, supervisorId]);
            authorizedAt = new Date(createdAt.getTime() + 2 * 3600000);
            if (daysBack > 22) {
              status = 'aplicado';
              appliedBy  = secretariaId;
              appliedAt  = new Date(authorizedAt.getTime() + 86400000);
            }
          }
        }

        logs.push({
          clientId,
          userId: gestorId,
          type,
          comment: rand(COMMENTS[type]),
          evidenceUrl: null,
          latitude:  type === 'Visita' ? parseFloat((13.6929 + (Math.random() - 0.5) * 0.05).toFixed(8)) : null,
          longitude: type === 'Visita' ? parseFloat((-89.2182 + (Math.random() - 0.5) * 0.05).toFixed(8)) : null,
          gpsAlertTriggered: 0,
          paymentAmount: payAmount,
          paymentType: payType,
          status: hasPago ? status : 'pendiente',
          authorizedBy,
          authorizedAt,
          appliedBy,
          appliedAt,
          createdAt,
          createdBy: gestorId,
        });
      }
    }
    await queryInterface.bulkInsert('CollectionLogs', logs);

    // ── AuditLogs ─────────────────────────────────────────────────────────────
    const actions = ['user.login', 'collection.created', 'assignment.created', 'payment.authorized', 'payment.applied', 'user.logout'];
    const allUsers = [1, supervisorId, ...gestores, secretariaId];
    const auditRows = Array.from({ length: 35 }, (_, i) => ({
      userId: rand(allUsers),
      action: rand(actions),
      entity: 'CollectionLogs',
      entityId: randInt(1, logs.length),
      previousValue: null,
      newValue: null,
      ipAddress: `192.168.1.${randInt(10, 50)}`,
      userAgent: 'Mozilla/5.0 (SIGMA Seed Data)',
      createdAt: daysAgo(randInt(0, 30)),
    }));
    await queryInterface.bulkInsert('AuditLogs', auditRows);

    // ── Tareas ────────────────────────────────────────────────────────────────
    const TASK_TITLES = [
      'Visita de seguimiento urgente','Llamada de recordatorio de cuota','Enviar estado de cuenta actualizado',
      'Coordinar plan de pago extrajudicial','Verificar pago prometido en visita anterior',
      'Reunión con cliente en oficina central','Seguimiento a promesa de pago incumplida',
      'Gestión de cobro extrajudicial','Documentar garantías del préstamo','Actualizar datos de contacto',
    ];
    const taskRows = TASK_TITLES.map((title, i) => {
      const due = new Date();
      due.setDate(due.getDate() + randInt(1, 14));
      return {
        userId: rand(gestores),
        clientId: clientIds[randInt(0, clientIds.length - 1)],
        title,
        description: null,
        dueDate: due,
        priority: rand(['baja', 'media', 'alta']),
        status: 'pendiente',
        isNotified: 0,
        createdAt: daysAgo(randInt(0, 7)),
        updatedAt: daysAgo(randInt(0, 3)),
        createdBy: rand([1, supervisorId]),
      };
    });
    await queryInterface.bulkInsert('Tasks', taskRows);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('Tasks',             null, {});
    await queryInterface.bulkDelete('AuditLogs',         null, {});
    await queryInterface.bulkDelete('CollectionLogs',    null, {});
    await queryInterface.bulkDelete('ClientAssignments', null, {});
    await queryInterface.bulkDelete('Clients',           null, {});
    await queryInterface.sequelize.query(`DELETE FROM Users WHERE email IN ('supervisor@sigma.local','gestor1@sigma.local','gestor2@sigma.local','gestor3@sigma.local','secretaria@sigma.local')`);
  },
};
