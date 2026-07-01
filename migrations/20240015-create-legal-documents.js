'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('LegalDocuments', {
      id:           { type: Sequelize.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
      caseId:       { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, references: { model: 'LegalCases', key: 'id' } },
      clientId:     { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, references: { model: 'Clients', key: 'id' } },
      type:         { type: Sequelize.ENUM('demanda','notificacion','resolucion','contrato','poder','resumen','otro'), defaultValue: 'otro' },
      originalName: { type: Sequelize.STRING(255), allowNull: false },
      storedName:   { type: Sequelize.STRING(255), allowNull: false },
      url:          { type: Sequelize.STRING(500), allowNull: false },
      description:  { type: Sequelize.TEXT, allowNull: true },
      uploadedBy:   { type: Sequelize.INTEGER.UNSIGNED, allowNull: true },
      createdBy:    { type: Sequelize.INTEGER.UNSIGNED, allowNull: true },
      createdAt:    { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.addIndex('LegalDocuments', ['caseId']);
    await queryInterface.addIndex('LegalDocuments', ['clientId']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('LegalDocuments');
  },
};
