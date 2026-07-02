'use strict';

module.exports = (sequelize, DataTypes) => sequelize.define('Role', {
  id:        { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  name:      { type: DataTypes.STRING(50), allowNull: false },
  status:    { type: DataTypes.ENUM('on', 'off'), defaultValue: 'on' },
  createdBy: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
}, { tableName: 'roles', timestamps: true });
