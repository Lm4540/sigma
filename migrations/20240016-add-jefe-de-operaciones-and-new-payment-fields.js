'use strict';
const bcrypt = require('bcryptjs');

module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Insertar el rol Jefe de Operaciones (ID 5) si no existe
    const [existingRoles] = await queryInterface.sequelize.query(
      `SELECT id FROM roles WHERE id = 5;`
    );
    if (existingRoles.length === 0) {
      await queryInterface.bulkInsert('roles', [
        { id: 5, name: 'Jefe de Operaciones', status: 'on', createdAt: new Date(), updatedAt: new Date(), createdBy: null }
      ]);
    }

    // 2. Insertar la jefa de operaciones por defecto si no existe
    const [existingUsers] = await queryInterface.sequelize.query(
      `SELECT id FROM users WHERE email = 'jefa@sigma.local';`
    );
    if (existingUsers.length === 0) {
      const hash = bcrypt.hashSync('12345678', 10);
      await queryInterface.bulkInsert('users', [
        {
          name: 'Ana María Orellana',
          email: 'jefa@sigma.local',
          password: hash,
          roleId: 5,
          branchId: 1,
          status: 'on',
          loginAttempts: 0,
          lockUntil: null,
          webAuthnEnabled: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: null
        }
      ]);
    }

    // 3. Modificar columnas ENUM en collectionlogs usando SQL crudo
    await queryInterface.sequelize.query(
      `ALTER TABLE collectionlogs MODIFY COLUMN paymentType ENUM('efectivo', 'nota_abono', 'especie', 'cheque', 'transferencia') NULL;`
    );
    await queryInterface.sequelize.query(
      `ALTER TABLE collectionlogs MODIFY COLUMN status ENUM('pendiente', 'revisado', 'autorizado', 'rechazado', 'aplicado') DEFAULT 'pendiente';`
    );

    // 4. Agregar campos a collectionlogs para la revisión (solo si no existen)
    const [columns] = await queryInterface.sequelize.query(
      `SHOW COLUMNS FROM collectionlogs LIKE 'reviewedBy';`
    );
    if (columns.length === 0) {
      await queryInterface.addColumn('collectionlogs', 'reviewedBy', {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
      });
      await queryInterface.addColumn('collectionlogs', 'reviewedAt', {
        type: Sequelize.DATE,
        allowNull: true
      });
    }

    // 5. Agregar campos a clients (solo si no existen)
    const [clientColumns] = await queryInterface.sequelize.query(
      `SHOW COLUMNS FROM clients LIKE 'lastKnownLat';`
    );
    if (clientColumns.length === 0) {
      await queryInterface.addColumn('clients', 'lastKnownLat', {
        type: Sequelize.DECIMAL(10, 8),
        allowNull: true
      });
      await queryInterface.addColumn('clients', 'lastKnownLng', {
        type: Sequelize.DECIMAL(11, 8),
        allowNull: true
      });
    }

    // 6. Backfill de ubicaciones conocidas en clients basadas en su última visita exitosa
    await queryInterface.sequelize.query(`
      UPDATE clients c
      SET c.lastKnownLat = (
        SELECT cl.latitude
        FROM collectionlogs cl
        WHERE cl.clientId = c.id
          AND cl.type = 'Visita'
          AND cl.latitude IS NOT NULL
        ORDER BY cl.createdAt DESC
        LIMIT 1
      ),
      c.lastKnownLng = (
        SELECT cl.longitude
        FROM collectionlogs cl
        WHERE cl.clientId = c.id
          AND cl.type = 'Visita'
          AND cl.longitude IS NOT NULL
        ORDER BY cl.createdAt DESC
        LIMIT 1
      )
      WHERE EXISTS (
        SELECT 1
        FROM collectionlogs cl
        WHERE cl.clientId = c.id
          AND cl.type = 'Visita'
          AND cl.latitude IS NOT NULL
      );
    `);
  },

  async down(queryInterface, Sequelize) {
    // Reversar en orden inverso
    await queryInterface.sequelize.query(`
      UPDATE clients SET lastKnownLat = NULL, lastKnownLng = NULL;
    `);

    await queryInterface.removeColumn('clients', 'lastKnownLat');
    await queryInterface.removeColumn('clients', 'lastKnownLng');

    await queryInterface.removeColumn('collectionlogs', 'reviewedBy');
    await queryInterface.removeColumn('collectionlogs', 'reviewedAt');

    // Cambiar estados a pendiente si están en revisado, para poder revertir el ENUM
    await queryInterface.sequelize.query(
      `UPDATE collectionlogs SET status = 'pendiente' WHERE status = 'revisado';`
    );
    await queryInterface.sequelize.query(
      `UPDATE collectionlogs SET paymentType = 'efectivo' WHERE paymentType = 'nota_abono';`
    );

    await queryInterface.sequelize.query(
      `ALTER TABLE collectionlogs MODIFY COLUMN paymentType ENUM('efectivo', 'especie', 'cheque', 'transferencia') NULL;`
    );
    await queryInterface.sequelize.query(
      `ALTER TABLE collectionlogs MODIFY COLUMN status ENUM('pendiente', 'autorizado', 'rechazado', 'aplicado') DEFAULT 'pendiente';`
    );

    await queryInterface.bulkDelete('users', { email: 'jefa@sigma.local' });
    await queryInterface.bulkDelete('roles', { id: 5 });
  }
};
