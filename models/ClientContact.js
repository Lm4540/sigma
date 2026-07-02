'use strict';

module.exports = (sequelize, DataTypes) => sequelize.define('ClientContact', {
  id:           { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  clientId:     { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  name:         { type: DataTypes.STRING(255), allowNull: true },
  phone:        { type: DataTypes.STRING(20), allowNull: false },
  relationship: { type: DataTypes.STRING(100), allowNull: true },
  createdBy:    { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
}, { tableName: 'clientcontacts', timestamps: true, updatedAt: false });
