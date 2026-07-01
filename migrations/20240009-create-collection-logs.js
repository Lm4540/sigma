'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('CollectionLogs', {
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
      type: { type: Sequelize.ENUM('Visita', 'Llamada', 'WhatsApp', 'Mensaje'), allowNull: false },
      comment: { type: Sequelize.TEXT, allowNull: false },
      evidenceUrl: { type: Sequelize.STRING(255), allowNull: true },
      latitude: { type: Sequelize.DECIMAL(10, 8), allowNull: true },
      longitude: { type: Sequelize.DECIMAL(11, 8), allowNull: true },
      gpsAlertTriggered: { type: Sequelize.TINYINT(1), defaultValue: 0 },
      paymentAmount: { type: Sequelize.DECIMAL(12, 2), allowNull: true },
      paymentType: { type: Sequelize.ENUM('efectivo', 'especie', 'cheque', 'transferencia'), allowNull: true },
      status: { type: Sequelize.ENUM('pendiente', 'autorizado', 'rechazado', 'aplicado'), defaultValue: 'pendiente' },
      authorizedBy: {
        type: Sequelize.INTEGER.UNSIGNED, allowNull: true,
        references: { model: 'Users', key: 'id' },
        onDelete: 'SET NULL',
      },
      authorizedAt: { type: Sequelize.DATE, allowNull: true },
      appliedBy: {
        type: Sequelize.INTEGER.UNSIGNED, allowNull: true,
        references: { model: 'Users', key: 'id' },
        onDelete: 'SET NULL',
      },
      appliedAt: { type: Sequelize.DATE, allowNull: true },
      createdAt: { type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      createdBy: { type: Sequelize.INTEGER.UNSIGNED, allowNull: true },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('CollectionLogs');
  },
};
