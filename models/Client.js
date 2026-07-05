'use strict';

module.exports = (sequelize, DataTypes) => sequelize.define('Client', {
  id:              { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  clientCode:      { type: DataTypes.STRING(50), allowNull: true, unique: true },
  loanNumber:      { type: DataTypes.STRING(50), allowNull: true, unique: true },
  name:            { type: DataTypes.STRING(255), allowNull: false },
  address:         { type: DataTypes.TEXT, allowNull: true },
  addressLat:      { type: DataTypes.DECIMAL(10, 8), allowNull: true },
  addressLng:      { type: DataTypes.DECIMAL(11, 8), allowNull: true },
  branchId:        { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  daysLate:        { type: DataTypes.INTEGER, defaultValue: 0 },
  balance:         { type: DataTypes.DECIMAL(12, 2), defaultValue: 0.00 },
  insurance:       { type: DataTypes.DECIMAL(12, 2), defaultValue: 0.00 },
  otherFees:       { type: DataTypes.DECIMAL(12, 2), defaultValue: 0.00 },
  nextPaymentDate: { type: DataTypes.DATEONLY, allowNull: true },
  // Columna GENERATED en MySQL/MariaDB — solo lectura, Sequelize no la escribe
  riskCategory:    { type: DataTypes.STRING(5) },
  lastActivity:    { type: DataTypes.DATE, allowNull: true },
  lastKnownLat:    { type: DataTypes.DECIMAL(10, 8), allowNull: true },
  lastKnownLng:    { type: DataTypes.DECIMAL(11, 8), allowNull: true },
  createdBy:       { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
}, { tableName: 'clients', timestamps: true });
