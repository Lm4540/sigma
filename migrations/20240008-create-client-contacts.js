'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ClientContacts', {
      id: { type: Sequelize.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
      clientId: {
        type: Sequelize.INTEGER.UNSIGNED, allowNull: false,
        references: { model: 'Clients', key: 'id' },
        onDelete: 'CASCADE',
      },
      name: { type: Sequelize.STRING(255), allowNull: true },
      phone: { type: Sequelize.STRING(20), allowNull: false },
      relationship: { type: Sequelize.STRING(100), allowNull: true },
      createdAt: { type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      createdBy: { type: Sequelize.INTEGER.UNSIGNED, allowNull: true },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('ClientContacts');
  },
};
