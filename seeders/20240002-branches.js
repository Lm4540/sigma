'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.bulkInsert('Branches', [
      { id: 1, name: 'Casa Matriz', address: 'San Salvador, El Salvador', phone: '2222-0000', status: 'on', createdAt: new Date(), updatedAt: new Date(), createdBy: null },
    ]);
  },
  async down(queryInterface) {
    await queryInterface.bulkDelete('Branches', null, {});
  },
};
