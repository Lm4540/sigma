'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('RevokedTokens', {
      id: { type: Sequelize.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
      jti: { type: Sequelize.STRING(36), allowNull: false, unique: true },
      userId: {
        type: Sequelize.INTEGER.UNSIGNED, allowNull: false,
        references: { model: 'Users', key: 'id' },
        onDelete: 'CASCADE',
      },
      expiresAt: { type: Sequelize.DATE, allowNull: false },
      revokedAt: { type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
    await queryInterface.addIndex('RevokedTokens', ['jti'], { name: 'idx_jti' });
    await queryInterface.addIndex('RevokedTokens', ['expiresAt'], { name: 'idx_expires' });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('RevokedTokens');
  },
};
