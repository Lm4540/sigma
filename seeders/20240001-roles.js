'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.bulkInsert('Roles', [
      { id: 1, name: 'Administrador', status: 'on', createdAt: new Date(), updatedAt: new Date(), createdBy: null },
      { id: 2, name: 'Supervisor',    status: 'on', createdAt: new Date(), updatedAt: new Date(), createdBy: null },
      { id: 3, name: 'Gestor',        status: 'on', createdAt: new Date(), updatedAt: new Date(), createdBy: null },
      { id: 4, name: 'Secretaria',    status: 'on', createdAt: new Date(), updatedAt: new Date(), createdBy: null },
    ]);
  },
  async down(queryInterface) {
    await queryInterface.bulkDelete('Roles', null, {});
  },
};
