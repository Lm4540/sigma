'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Clients', {
      id: { type: Sequelize.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
      clientCode: { type: Sequelize.STRING(50), allowNull: true, unique: true },
      loanNumber: { type: Sequelize.STRING(50), allowNull: true, unique: true },
      name: { type: Sequelize.STRING(255), allowNull: false },
      address: { type: Sequelize.TEXT, allowNull: true },
      addressLat: { type: Sequelize.DECIMAL(10, 8), allowNull: true },
      addressLng: { type: Sequelize.DECIMAL(11, 8), allowNull: true },
      branchId: {
        type: Sequelize.INTEGER.UNSIGNED, allowNull: true,
        references: { model: 'Branches', key: 'id' },
        onDelete: 'SET NULL',
      },
      daysLate: { type: Sequelize.INTEGER, defaultValue: 0 },
      balance: { type: Sequelize.DECIMAL(12, 2), defaultValue: 0.00 },
      insurance: { type: Sequelize.DECIMAL(12, 2), defaultValue: 0.00 },
      otherFees: { type: Sequelize.DECIMAL(12, 2), defaultValue: 0.00 },
      nextPaymentDate: { type: Sequelize.DATEONLY, allowNull: true },
      lastActivity: { type: Sequelize.DATE, allowNull: true },
      createdAt: { type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      updatedAt: { type: Sequelize.DATE, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP') },
      createdBy: { type: Sequelize.INTEGER.UNSIGNED, allowNull: true },
    });

    // Columna virtual riskCategory — MariaDB/MySQL
    await queryInterface.sequelize.query(`
      ALTER TABLE \`Clients\`
      ADD COLUMN \`riskCategory\` VARCHAR(5) AS (
        CASE
          WHEN \`daysLate\` <= 14 THEN 'A1'
          WHEN \`daysLate\` <= 30 THEN 'A2'
          WHEN \`daysLate\` <= 90 THEN 'B'
          WHEN \`daysLate\` <= 180 THEN 'C'
          WHEN \`daysLate\` <= 270 THEN 'D'
          ELSE 'E'
        END
      ) VIRTUAL
    `);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('Clients');
  },
};
