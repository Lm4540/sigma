'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ClientAssignments', {
      id: { type: Sequelize.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
      clientId: {
        type: Sequelize.INTEGER.UNSIGNED, allowNull: false,
        references: { model: 'Clients', key: 'id' },
        onDelete: 'CASCADE',
      },
      userId: {
        type: Sequelize.INTEGER.UNSIGNED, allowNull: false,
        references: { model: 'Users', key: 'id' },
      },
      assignedBy: {
        type: Sequelize.INTEGER.UNSIGNED, allowNull: false,
        references: { model: 'Users', key: 'id' },
      },
      isActive: { type: Sequelize.TINYINT(1), defaultValue: 1 },
      assignedAt: { type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      releasedAt: { type: Sequelize.DATE, allowNull: true },
    });
    await queryInterface.addIndex('ClientAssignments', ['clientId', 'isActive'], { name: 'idx_active_assignment' });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('ClientAssignments');
  },
};
