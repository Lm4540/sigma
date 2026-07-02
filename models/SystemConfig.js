'use strict';

module.exports = (sequelize, DataTypes) => sequelize.define('SystemConfig', {
  id:        { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  key:       { type: DataTypes.STRING(100), allowNull: false, unique: true },
  value:     { type: DataTypes.TEXT, allowNull: false },
  label:     { type: DataTypes.STRING(255), allowNull: true },
  updatedBy: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
}, { tableName: 'systemconfig', timestamps: true });
