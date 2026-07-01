'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Tasks', {
      id: { type: Sequelize.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
      userId: {
        type: Sequelize.INTEGER.UNSIGNED, allowNull: false,
        references: { model: 'Users', key: 'id' },
        onDelete: 'CASCADE',
      },
      clientId: {
        type: Sequelize.INTEGER.UNSIGNED, allowNull: true,
        references: { model: 'Clients', key: 'id' },
        onDelete: 'SET NULL',
      },
      title: { type: Sequelize.STRING(255), allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },
      dueDate: { type: Sequelize.DATE, allowNull: false },
      priority: { type: Sequelize.ENUM('baja', 'media', 'alta'), defaultValue: 'media' },
      status: { type: Sequelize.ENUM('pendiente', 'completada', 'vencida'), defaultValue: 'pendiente' },
      isNotified: { type: Sequelize.TINYINT(1), defaultValue: 0 },
      createdAt: { type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updatedAt: { type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP') },
      createdBy: { type: Sequelize.INTEGER.UNSIGNED, allowNull: true },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('Tasks');
  },
};
