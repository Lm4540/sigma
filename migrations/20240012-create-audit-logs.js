'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('AuditLogs', {
      id: { type: Sequelize.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
      userId: {
        type: Sequelize.INTEGER.UNSIGNED, allowNull: true,
        references: { model: 'Users', key: 'id' },
        onDelete: 'SET NULL',
      },
      action: { type: Sequelize.STRING(100), allowNull: false },
      entity: { type: Sequelize.STRING(50), allowNull: true },
      entityId: { type: Sequelize.INTEGER.UNSIGNED, allowNull: true },
      previousValue: { type: Sequelize.JSON, allowNull: true },
      newValue: { type: Sequelize.JSON, allowNull: true },
      ipAddress: { type: Sequelize.STRING(45), allowNull: true },
      userAgent: { type: Sequelize.TEXT, allowNull: true },
      createdAt: { type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('AuditLogs', ['entity', 'entityId'], { name: 'idx_entity' });
    await queryInterface.addIndex('AuditLogs', ['action'], { name: 'idx_action' });
    await queryInterface.addIndex('AuditLogs', ['userId'], { name: 'idx_user_audit' });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('AuditLogs');
  },
};
