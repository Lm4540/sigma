'use strict';

module.exports = (sequelize, DataTypes) => sequelize.define('Branch', {
  id:        { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  name:      { type: DataTypes.STRING(100), allowNull: false },
  address:   { type: DataTypes.TEXT, allowNull: true },
  phone:     { type: DataTypes.STRING(20), allowNull: true },
  status:    { type: DataTypes.ENUM('on', 'off'), defaultValue: 'on' },
  createdBy: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
}, { tableName: 'branches', timestamps: true });
