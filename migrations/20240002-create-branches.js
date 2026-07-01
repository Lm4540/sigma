'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Branches', {
      id: { type: Sequelize.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
      name: { type: Sequelize.STRING(100), allowNull: false },
      address: { type: Sequelize.TEXT, allowNull: true },
      phone: { type: Sequelize.STRING(20), allowNull: true },
      status: { type: Sequelize.ENUM('on', 'off'), defaultValue: 'on' },
      createdAt: { type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updatedAt: { type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP') },
      createdBy: { type: Sequelize.INTEGER.UNSIGNED, allowNull: true },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('Branches');
  },
};
