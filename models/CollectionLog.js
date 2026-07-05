'use strict';

module.exports = (sequelize, DataTypes) => sequelize.define('CollectionLog', {
  id:                 { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  clientId:           { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  userId:             { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  type:               { type: DataTypes.ENUM('Visita', 'Llamada', 'WhatsApp', 'Mensaje'), allowNull: false },
  comment:            { type: DataTypes.TEXT, allowNull: false },
  evidenceUrl:        { type: DataTypes.STRING(255), allowNull: true },
  latitude:           { type: DataTypes.DECIMAL(10, 8), allowNull: true },
  longitude:          { type: DataTypes.DECIMAL(11, 8), allowNull: true },
  gpsAlertTriggered:  { type: DataTypes.TINYINT(1), defaultValue: 0 },
  paymentAmount:      { type: DataTypes.DECIMAL(12, 2), allowNull: true },
  paymentType:        { type: DataTypes.ENUM('efectivo', 'nota_abono', 'especie', 'cheque', 'transferencia'), allowNull: true },
  status:             { type: DataTypes.ENUM('pendiente', 'revisado', 'autorizado', 'rechazado', 'aplicado'), defaultValue: 'pendiente' },
  reviewedBy:         { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  reviewedAt:         { type: DataTypes.DATE, allowNull: true },
  authorizedBy:       { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  authorizedAt:       { type: DataTypes.DATE, allowNull: true },
  appliedBy:          { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  appliedAt:          { type: DataTypes.DATE, allowNull: true },
  createdBy:          { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
}, { tableName: 'collectionlogs', timestamps: true, updatedAt: false });
