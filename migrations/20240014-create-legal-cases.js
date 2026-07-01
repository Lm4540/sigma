'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('LegalCases', {
      id:         { type: Sequelize.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
      clientId:   { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, references: { model: 'Clients', key: 'id' } },
      status:     { type: Sequelize.ENUM('activo', 'resuelto', 'archivado'), defaultValue: 'activo' },
      assignedTo: { type: Sequelize.INTEGER.UNSIGNED, allowNull: true, references: { model: 'Users', key: 'id' } },
      openedAt:   { type: Sequelize.DATE, allowNull: false },
      closedAt:   { type: Sequelize.DATE, allowNull: true },
      notes:      { type: Sequelize.TEXT, allowNull: true },
      createdBy:  { type: Sequelize.INTEGER.UNSIGNED, allowNull: true },
      createdAt:  { type: Sequelize.DATE, allowNull: false },
      updatedAt:  { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.addIndex('LegalCases', ['clientId']);
    await queryInterface.addIndex('LegalCases', ['status']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('LegalCases');
  },
};
