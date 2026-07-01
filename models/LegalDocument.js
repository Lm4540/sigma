'use strict';

module.exports = (sequelize, DataTypes) => sequelize.define('LegalDocument', {
  id:           { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  caseId:       { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  clientId:     { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  type:         { type: DataTypes.ENUM('demanda','notificacion','resolucion','contrato','poder','resumen','otro'), defaultValue: 'otro' },
  originalName: { type: DataTypes.STRING(255), allowNull: false },
  storedName:   { type: DataTypes.STRING(255), allowNull: false },
  url:          { type: DataTypes.STRING(500), allowNull: false },
  description:  { type: DataTypes.TEXT, allowNull: true },
  uploadedBy:   { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  createdBy:    { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
}, { tableName: 'LegalDocuments', timestamps: true, updatedAt: false });
