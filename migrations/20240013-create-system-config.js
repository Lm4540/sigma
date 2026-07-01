'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('SystemConfig', {
      id:        { type: Sequelize.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
      key:       { type: Sequelize.STRING(100), allowNull: false, unique: true },
      value:     { type: Sequelize.TEXT, allowNull: false },
      label:     { type: Sequelize.STRING(255), allowNull: true },
      updatedBy: { type: Sequelize.INTEGER.UNSIGNED, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.bulkInsert('SystemConfig', [
      {
        key:       'meta_gestiones_mensual',
        value:     '80',
        label:     'Meta mensual de gestiones por gestor',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        key:       'meta_recuperado_mensual',
        value:     '5000.00',
        label:     'Meta mensual de monto recuperado (USD)',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('SystemConfig');
  },
};
