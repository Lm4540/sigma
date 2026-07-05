'use strict';

const bcrypt = require('bcryptjs');

module.exports = {
  async up(queryInterface) {
    const hash = await bcrypt.hash('admin123', 10);
    await queryInterface.bulkInsert('Users', [
      {
        id: 1,
        name: 'Administrador del Sistema',
        email: 'admin@sigma.local',
        password: hash,
        roleId: 1,
        branchId: 1,
        specialPermissions: null,
        loginAttempts: 0,
        lockUntil: null,
        status: 'on',
        webAuthnEnabled: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: null,
      },
    ]);
  },
  async down(queryInterface) {
    await queryInterface.bulkDelete('Users', { email: 'admin@sigma.local' }, {});
  },
};
