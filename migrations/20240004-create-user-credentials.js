'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('UserCredentials', {
      id: { type: Sequelize.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
      userId: {
        type: Sequelize.INTEGER.UNSIGNED, allowNull: false,
        references: { model: 'Users', key: 'id' },
        onDelete: 'CASCADE',
      },
      credentialId: { type: Sequelize.STRING(1024), allowNull: false },
      publicKey: { type: Sequelize.TEXT, allowNull: false },
      counter: { type: Sequelize.BIGINT, allowNull: false },
      transports: { type: Sequelize.STRING(255), allowNull: true },
      createdAt: { type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('UserCredentials');
  },
};
