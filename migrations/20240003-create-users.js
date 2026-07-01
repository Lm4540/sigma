'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Users', {
      id: { type: Sequelize.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
      name: { type: Sequelize.STRING(100), allowNull: false },
      email: { type: Sequelize.STRING(100), allowNull: false, unique: true },
      password: { type: Sequelize.STRING(255), allowNull: false },
      roleId: {
        type: Sequelize.INTEGER.UNSIGNED, allowNull: false,
        references: { model: 'Roles', key: 'id' },
      },
      branchId: {
        type: Sequelize.INTEGER.UNSIGNED, allowNull: true,
        references: { model: 'Branches', key: 'id' },
        onDelete: 'SET NULL',
      },
      specialPermissions: { type: Sequelize.JSON, allowNull: true },
      loginAttempts: { type: Sequelize.TINYINT, defaultValue: 0 },
      lockUntil: { type: Sequelize.DATE, allowNull: true },
      status: { type: Sequelize.ENUM('on', 'off'), defaultValue: 'on' },
      webAuthnEnabled: { type: Sequelize.TINYINT(1), defaultValue: 0 },
      createdAt: { type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updatedAt: { type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP') },
      createdBy: { type: Sequelize.INTEGER.UNSIGNED, allowNull: true },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('Users');
  },
};
