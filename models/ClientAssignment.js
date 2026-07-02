'use strict';

module.exports = (sequelize, DataTypes) => sequelize.define('ClientAssignment', {
  id:         { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  clientId:   { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  userId:     { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  assignedBy: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  isActive:   { type: DataTypes.TINYINT(1), defaultValue: 1 },
  assignedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  releasedAt: { type: DataTypes.DATE, allowNull: true },
}, { tableName: 'clientassignments', timestamps: false });
