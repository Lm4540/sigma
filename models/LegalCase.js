'use strict';

module.exports = (sequelize, DataTypes) => sequelize.define('LegalCase', {
  id:         { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  clientId:   { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  status:     { type: DataTypes.ENUM('activo', 'resuelto', 'archivado'), defaultValue: 'activo' },
  assignedTo: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  openedAt:   { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  closedAt:   { type: DataTypes.DATE, allowNull: true },
  notes:      { type: DataTypes.TEXT, allowNull: true },
  createdBy:  { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
}, { tableName: 'legalcases', timestamps: true });
